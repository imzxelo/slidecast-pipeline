require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = 3001;

// API Keys (set via .env file or environment variable)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// Gemini client
let geminiClient = null;
if (GEMINI_API_KEY) {
  geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// Upload configuration
const upload = multer({ dest: 'uploads/' });

// Serve static files
app.use(express.static('editor'));
app.use(express.json());

// Helper functions (from bin/slidecast.js)
function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
  return result.stdout.trim();
}

function runOrThrow(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}\n${result.stderr}`);
  }
}

function getAudioDurationSeconds(audioPath) {
  const output = runCapture('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ]);
  const seconds = Number(output);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Invalid audio duration: ${output}`);
  }
  return seconds;
}

function convertPdfToPng(pdfPath, workdir) {
  const prefix = path.join(workdir, 'slide');
  runOrThrow('pdftoppm', ['-png', '-r', '150', pdfPath, prefix]);
}

function listSlideImages(workdir) {
  const files = fs.readdirSync(workdir);
  const slides = files
    .filter((file) => /^slide-\d+\.png$/.test(file))
    .map((file) => ({
      file,
      index: Number(file.match(/^slide-(\d+)\.png$/)[1]),
    }))
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.file);

  if (slides.length === 0) {
    throw new Error('No slide images generated');
  }

  return slides;
}

function buildSlideIndexMap(slides) {
  const map = new Map();
  slides.forEach((file) => {
    const match = file.match(/^slide-(\d+)\.png$/);
    if (match) {
      map.set(Number(match[1]), file);
    }
  });
  return map;
}

function computeMarkerPlan(markers, slideMap, totalSeconds) {
  const sorted = markers.map((marker, idx) => {
    const t = Number(marker.t);
    const slide = Number(marker.slide);
    return { t, slide, order: idx + 1 };
  }).sort((a, b) => (a.t - b.t) || (a.order - b.order));

  if (sorted.length === 0) {
    throw new Error('No markers provided');
  }

  // 最初のマーカーがt=0でない場合、スライド1をt=0に自動追加
  if (sorted[0].t > 0.001) {
    sorted.unshift({ t: 0, slide: 1, order: 0 });
  } else {
    sorted[0].t = 0;
  }

  const sequence = sorted.map((marker) => {
    const file = slideMap.get(marker.slide);
    if (!file) {
      throw new Error(`Marker slide ${marker.slide} has no corresponding PNG`);
    }
    return file;
  });

  const durations = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const nextTime = i < sorted.length - 1 ? sorted[i + 1].t : totalSeconds;
    const duration = nextTime - current.t;
    if (duration <= 0) {
      throw new Error(`Non-positive duration at marker ${i + 1}`);
    }
    durations.push(duration);
  }

  return { sequence, durations };
}

function computeEqualDurations(totalSeconds, count) {
  const base = totalSeconds / count;
  const durations = Array(count).fill(base);
  durations[count - 1] = totalSeconds - base * (count - 1);
  return durations;
}

function escapePath(filePath) {
  return filePath.replace(/'/g, "'\\''");
}

function writeConcatFile(workdir, slides, durations) {
  const concatPath = path.join(workdir, 'concat.txt');
  const lines = [];
  for (let i = 0; i < slides.length; i++) {
    const slidePath = path.resolve(workdir, slides[i]);
    lines.push(`file '${escapePath(slidePath)}'`);
    lines.push(`duration ${durations[i].toFixed(3)}`);
  }
  const lastPath = path.resolve(workdir, slides[slides.length - 1]);
  lines.push(`file '${escapePath(lastPath)}'`);
  fs.writeFileSync(concatPath, `${lines.join('\n')}\n`);
  return concatPath;
}

function buildVideo(concatPath, workdir) {
  const videoPath = path.join(workdir, 'video.mp4');
  runOrThrow('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatPath,
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-c:v', 'libx264',
    videoPath,
  ]);
  return videoPath;
}

function mergeAudio(videoPath, audioPath, outPath) {
  runOrThrow('ffmpeg', [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    outPath,
  ]);
}

// API endpoint for video generation
app.post('/api/generate', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  const workdir = path.join('work', `gen-${Date.now()}`);

  try {
    // Get uploaded files
    const pdfFile = req.files['pdf']?.[0];
    const audioFile = req.files['audio']?.[0];
    const markers = JSON.parse(req.body.markers || '[]');

    if (!pdfFile || !audioFile) {
      return res.status(400).json({ error: 'PDF and audio files are required' });
    }

    // Create workdir
    fs.mkdirSync(workdir, { recursive: true });

    // Get audio duration
    const durationSeconds = getAudioDurationSeconds(audioFile.path);

    // Convert PDF to PNG
    convertPdfToPng(pdfFile.path, workdir);
    const slides = listSlideImages(workdir);
    const slideMap = buildSlideIndexMap(slides);

    // Calculate durations
    let sequence = slides;
    let durations;

    if (markers.length > 0) {
      const plan = computeMarkerPlan(markers, slideMap, durationSeconds);
      sequence = plan.sequence;
      durations = plan.durations;
    } else {
      durations = computeEqualDurations(durationSeconds, slides.length);
    }

    // Generate video
    const concatPath = writeConcatFile(workdir, sequence, durations);
    const videoPath = buildVideo(concatPath, workdir);

    // Merge audio
    const outputPath = path.join(workdir, 'output.mp4');
    mergeAudio(videoPath, audioFile.path, outputPath);

    // Send file
    res.download(outputPath, 'slidecast-output.mp4', (err) => {
      // Cleanup
      fs.rmSync(workdir, { recursive: true, force: true });
      if (pdfFile) fs.unlinkSync(pdfFile.path);
      if (audioFile) fs.unlinkSync(audioFile.path);
    });

  } catch (error) {
    // Cleanup on error
    if (fs.existsSync(workdir)) {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
    if (req.files['pdf']?.[0]) fs.unlinkSync(req.files['pdf'][0].path);
    if (req.files['audio']?.[0]) fs.unlinkSync(req.files['audio'][0].path);

    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PDF slide summaries cache (per session)
let slideSummariesCache = null;

// Gemini 3.0 Flash でスライドを要約
async function summarizeSlides(pdfPath) {
  if (!geminiClient) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // PDFをPNG変換（一時ディレクトリ）
  const workdir = path.join('work', `summary-${Date.now()}`);
  fs.mkdirSync(workdir, { recursive: true });

  try {
    convertPdfToPng(pdfPath, workdir);
    const slides = listSlideImages(workdir);

    const summaries = [];

    for (let i = 0; i < slides.length; i++) {
      const slidePath = path.join(workdir, slides[i]);
      const imageData = fs.readFileSync(slidePath);
      const base64Image = imageData.toString('base64');

      const response = await geminiClient.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Image
              }
            },
            {
              text: 'このスライドの内容を日本語で簡潔に要約してください。箇条書きで主要なポイントを3つ以内で挙げてください。'
            }
          ]
        }]
      });

      summaries.push({
        slide: i + 1,
        summary: response.text || ''
      });
    }

    return summaries;
  } finally {
    // 一時ディレクトリを削除
    fs.rmSync(workdir, { recursive: true, force: true });
  }
}

// スライド要約を取得（キャッシュあり）
async function getSlideSummaries(pdfPath) {
  if (slideSummariesCache) {
    return slideSummariesCache;
  }
  slideSummariesCache = await summarizeSlides(pdfPath);
  return slideSummariesCache;
}

// AI API endpoints (using OpenAI GPT-5.2 Responses API with reasoning)
async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set. Please add it to .env file.');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5.2',
      input: prompt,
      reasoning: { effort: 'medium' }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  // Responses API returns output in nested structure
  return data.output?.[0]?.content?.[0]?.text || '';
}

// Generate summary for video description
app.post('/api/ai/summary', async (req, res) => {
  try {
    const { pdfName, audioName, slideCount, duration } = req.body;

    // スライド要約がキャッシュされていれば使用
    let slideContent = '';
    if (slideSummariesCache && slideSummariesCache.length > 0) {
      slideContent = '\n\n【スライド内容】\n' +
        slideSummariesCache.map(s => `スライド${s.slide}: ${s.summary}`).join('\n');
    }

    const prompt = `あなたはYouTube動画の説明文を作成するアシスタントです。
以下の情報をもとに、eラーニング教材の動画説明文を日本語で作成してください。

PDF名: ${pdfName}
音声ファイル名: ${audioName}
スライド枚数: ${slideCount}枚
動画の長さ: 約${Math.round(duration / 60)}分${slideContent}

説明文は以下の構成で作成してください：
- 概要（2-3文）
- 学習目標（箇条書き3項目）
- 対象者

簡潔で分かりやすい説明文を作成してください。`;

    const content = await callOpenAI(prompt);
    res.json({ title: '動画概要欄', content });
  } catch (error) {
    console.error('AI Summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extract key points from presentation
app.post('/api/ai/keypoints', async (req, res) => {
  try {
    const { pdfName, slideCount, markers, duration } = req.body;

    // スライド要約がキャッシュされていれば使用
    let slideContent = '';
    if (slideSummariesCache && slideSummariesCache.length > 0) {
      slideContent = '\n\n【スライド内容】\n' +
        slideSummariesCache.map(s => `スライド${s.slide}: ${s.summary}`).join('\n');
    }

    const prompt = `あなたはプレゼンテーション分析のエキスパートです。
以下の情報をもとに、この教材のキーポイントを抽出してください。

PDF名: ${pdfName}
スライド枚数: ${slideCount}枚
マーカー数: ${markers.length}個
動画の長さ: 約${Math.round(duration / 60)}分${slideContent}

以下の形式でキーポイントを5つ程度抽出してください：
1. [キーポイント1]
2. [キーポイント2]
...

スライドの内容に基づいて重要なポイントを挙げてください。`;

    const content = await callOpenAI(prompt);
    res.json({ title: 'キーポイント', content });
  } catch (error) {
    console.error('AI Keypoints error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate quiz questions
app.post('/api/ai/quiz', async (req, res) => {
  try {
    const { pdfName, slideCount } = req.body;

    // スライド要約がキャッシュされていれば使用
    let slideContent = '';
    if (slideSummariesCache && slideSummariesCache.length > 0) {
      slideContent = '\n\n【スライド内容】\n' +
        slideSummariesCache.map(s => `スライド${s.slide}: ${s.summary}`).join('\n');
    }

    const prompt = `あなたは教育コンテンツの専門家です。
以下の情報をもとに、理解度確認クイズを作成してください。

PDF名: ${pdfName}
スライド枚数: ${slideCount}枚${slideContent}

以下の形式で3問のクイズを作成してください：

【問題1】
Q: [質問文]
A: [選択肢A]
B: [選択肢B]
C: [選択肢C]
正解: [正解の選択肢]

スライドの内容に基づいた問題を作成してください。`;

    const content = await callOpenAI(prompt);
    res.json({ title: '理解度クイズ', content });
  } catch (error) {
    console.error('AI Quiz error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PDF分析エンドポイント（Gemini 3.0 Flash でスライドを要約）
app.post('/api/ai/analyze', upload.single('pdf'), async (req, res) => {
  try {
    const pdfFile = req.file;
    if (!pdfFile) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    if (!geminiClient) {
      fs.unlinkSync(pdfFile.path);
      return res.status(400).json({ error: 'GEMINI_API_KEY is not set' });
    }

    const summaries = await summarizeSlides(pdfFile.path);
    slideSummariesCache = summaries;

    // Cleanup
    fs.unlinkSync(pdfFile.path);

    res.json({
      success: true,
      slideCount: summaries.length,
      summaries: summaries
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('AI Analyze error:', error);
    res.status(500).json({ error: error.message });
  }
});

// キャッシュされた要約を取得
app.get('/api/ai/summaries', (req, res) => {
  if (!slideSummariesCache) {
    return res.status(404).json({ error: 'No summaries available. Analyze PDF first.' });
  }
  res.json({ summaries: slideSummariesCache });
});

app.listen(PORT, () => {
  console.log(`Slide Sync Editor running at http://localhost:${PORT}`);

  // OpenAI status
  if (!OPENAI_API_KEY) {
    console.log('Note: OPENAI_API_KEY is not set. AI generation features will not work.');
  } else {
    console.log('OpenAI GPT-5.2 (Responses API): enabled');
  }

  // Gemini status
  if (!GEMINI_API_KEY) {
    console.log('Note: GEMINI_API_KEY is not set. PDF analysis features will not work.');
  } else {
    console.log('Gemini 2.0 Flash: enabled');
  }
});
