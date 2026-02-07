const path = require('path');
const fs = require('fs');

// .envファイルのBOM除去（Windowsメモ帳対策）
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  let content = fs.readFileSync(envPath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) {
    console.log('[Config] Removing BOM from .env file');
    fs.writeFileSync(envPath, content.slice(1), 'utf8');
  }
}

require('dotenv').config({ path: envPath });

const express = require('express');
const multer = require('multer');
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
app.use('/output', express.static('output')); // 生成された動画のダウンロード用
app.use(express.json());

// Helper functions (from bin/slidecast.js)
function formatCommand(cmd, args) {
  const parts = [cmd, ...(args || [])];
  return parts.filter(Boolean).join(' ');
}

function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(`Command not found: ${cmd}. Please ensure it is installed and in PATH.`);
    }
    throw new Error(`Command failed to execute: ${formatCommand(cmd, args)}\n${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr ?? '';
    throw new Error(`Command failed: ${formatCommand(cmd, args)}\n${stderr}`.trimEnd());
  }
  return (result.stdout ?? '').trim();
}

function runOrThrow(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(`Command not found: ${cmd}. Please ensure it is installed and in PATH.`);
    }
    throw new Error(`Command failed to execute: ${formatCommand(cmd, args)}\n${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr ?? '';
    throw new Error(`Command failed: ${formatCommand(cmd, args)}\n${stderr}`.trimEnd());
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
  // Windowsのバックスラッシュをスラッシュに変換（ffmpegはスラッシュを受け付ける）
  let normalized = filePath.replace(/\\/g, '/');
  // シングルクォートをエスケープ
  return normalized.replace(/'/g, "'\\''");
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
  
  // エンコーダー選択: OS判定してハードウェア/ソフトウェアを切り替え
  // - macOS: h264_videotoolbox (GPU、10倍高速)
  // - Windows/Linux: libx264 (CPU、互換性重視)
  const isMac = process.platform === 'darwin';
  const encoder = isMac ? 'h264_videotoolbox' : 'libx264';
  
  const ffmpegArgs = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatPath,
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=1',
    '-pix_fmt', 'yuv420p',
    '-c:v', encoder,
  ];
  
  // libx264の場合は品質プリセット追加（速度と品質のバランス）
  if (!isMac) {
    ffmpegArgs.push('-preset', 'fast');
    ffmpegArgs.push('-crf', '23');
  } else {
    ffmpegArgs.push('-b:v', '2M');
  }
  
  ffmpegArgs.push(videoPath);
  
  console.log(`[Video] Using encoder: ${encoder} (platform: ${process.platform})`);
  runOrThrow('ffmpeg', ffmpegArgs);
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
  const startTime = Date.now();
  console.log('[Video Generate] Starting video generation...');

  try {
    // Get uploaded files
    const pdfFile = req.files['pdf']?.[0];
    const audioFile = req.files['audio']?.[0];
    const markers = JSON.parse(req.body.markers || '[]');

    if (!pdfFile || !audioFile) {
      return res.status(400).json({ error: 'PDF and audio files are required' });
    }

    console.log(`[Video Generate] PDF: ${pdfFile.originalname}, Audio: ${audioFile.originalname}`);
    console.log(`[Video Generate] Markers: ${markers.length} markers`);

    // Create workdir
    fs.mkdirSync(workdir, { recursive: true });

    // Get audio duration
    console.log('[Video Generate] Getting audio duration...');
    const durationSeconds = getAudioDurationSeconds(audioFile.path);
    console.log(`[Video Generate] Audio duration: ${durationSeconds}s (${(durationSeconds/60).toFixed(1)} min)`);

    // Convert PDF to PNG
    console.log('[Video Generate] Converting PDF to PNG...');
    convertPdfToPng(pdfFile.path, workdir);
    const slides = listSlideImages(workdir);
    const slideMap = buildSlideIndexMap(slides);
    console.log(`[Video Generate] Converted ${slides.length} slides`);

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
    console.log('[Video Generate] Building video (this may take a while for long videos)...');
    const concatPath = writeConcatFile(workdir, sequence, durations);
    const videoPath = buildVideo(concatPath, workdir);
    console.log(`[Video Generate] Video built in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    // Merge audio
    console.log('[Video Generate] Merging audio...');
    const outputPath = path.join(workdir, 'output.mp4');
    mergeAudio(videoPath, audioFile.path, outputPath);

    // Check output file size
    const outputStats = fs.statSync(outputPath);
    console.log(`[Video Generate] Output file size: ${(outputStats.size / 1024 / 1024).toFixed(1)}MB`);
    console.log(`[Video Generate] Total processing time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    // 動画をoutputフォルダに移動（ダウンロードリンク用）
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const finalFilename = `slidecast-${Date.now()}.mp4`;
    const finalPath = path.join(outputDir, finalFilename);
    fs.copyFileSync(outputPath, finalPath);
    console.log(`[Video Generate] Video saved to: ${finalPath}`);

    // Cleanup workdir
    fs.rmSync(workdir, { recursive: true, force: true });
    if (pdfFile) fs.unlinkSync(pdfFile.path);
    if (audioFile) fs.unlinkSync(audioFile.path);

    // ダウンロードURLを返す（ストリーミングではなくリンク）
    console.log('[Video Generate] Sending download URL to client...');
    res.json({
      success: true,
      downloadUrl: `/output/${finalFilename}`,
      filename: finalFilename,
      size: outputStats.size
    });

  } catch (error) {
    // Cleanup on error
    if (fs.existsSync(workdir)) {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
    try { if (req.files['pdf']?.[0]?.path) fs.unlinkSync(req.files['pdf'][0].path); } catch (e) {}
    try { if (req.files['audio']?.[0]?.path) fs.unlinkSync(req.files['audio'][0].path); } catch (e) {}

    console.error('[Video Generate] Error:', error.message);
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

    console.log(`Processing ${slides.length} slides in parallel...`);
    const startTime = Date.now();

    // 全スライドを並列処理（Gemini APIのレート制限に注意）
    const summaryPromises = slides.map(async (slide, i) => {
      const slidePath = path.join(workdir, slide);
      const imageData = fs.readFileSync(slidePath);
      const base64Image = imageData.toString('base64');

      const response = await geminiClient.models.generateContent({
        model: 'gemini-3-flash-preview',
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
        }],
        config: {
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      return {
        slide: i + 1,
        summary: response.text || ''
      };
    });

    const summaries = await Promise.all(summaryPromises);
    // スライド番号順にソート
    summaries.sort((a, b) => a.slide - b.slide);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Processed ${slides.length} slides in ${elapsed}s`);

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

  console.log('Calling OpenAI Responses API...');
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

  console.log('OpenAI API response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error response:', errorText);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('OpenAI response status:', data.status);
  console.log('OpenAI output array:', JSON.stringify(data.output, null, 2));

  // Responses API returns output in nested structure
  // Try to find text in various possible locations
  let result = '';
  if (data.output && Array.isArray(data.output)) {
    for (const outputItem of data.output) {
      if (outputItem.content && Array.isArray(outputItem.content)) {
        for (const contentItem of outputItem.content) {
          if (contentItem.text) {
            result += contentItem.text;
          }
        }
      }
      // Also check for direct text property
      if (outputItem.text) {
        result += outputItem.text;
      }
    }
  }

  console.log('Extracted text length:', result.length);
  console.log('Extracted text preview:', result.substring(0, 200));
  return result;
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

// 音声文字起こしキャッシュ
let transcriptCache = null;

// 音声ファイルを圧縮（ffmpegを使用）
function compressAudio(inputPath, outputPath) {
  // 64kbps mono MP3に圧縮（Whisper APIは音声認識なので十分な品質）
  runOrThrow('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-b:a', '64k',
    '-ac', '1',
    outputPath
  ]);
}

// 音声文字起こし（OpenAI Whisper API）
app.post('/api/ai/transcribe', upload.single('audio'), async (req, res) => {
  let tempFiles = []; // クリーンアップ用

  try {
    const audioFile = req.file;
    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    tempFiles.push(audioFile.path);

    if (!OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OPENAI_API_KEY is not set' });
    }

    // ファイルサイズチェック（25MB制限）
    const stats = fs.statSync(audioFile.path);
    let audioPath = audioFile.path;
    let originalName = audioFile.originalname || 'audio.mp3';

    if (stats.size > 25 * 1024 * 1024) {
      // 25MBを超える場合は自動圧縮
      console.log(`Audio file too large (${(stats.size / 1024 / 1024).toFixed(1)}MB), compressing...`);
      const compressedPath = audioFile.path + '.compressed.mp3';
      tempFiles.push(compressedPath);

      try {
        compressAudio(audioFile.path, compressedPath);
        audioPath = compressedPath;
        originalName = 'audio.mp3';

        const compressedStats = fs.statSync(compressedPath);
        console.log(`Compressed to ${(compressedStats.size / 1024 / 1024).toFixed(1)}MB`);

        // 圧縮後も25MBを超える場合はエラー
        if (compressedStats.size > 25 * 1024 * 1024) {
          return res.status(400).json({ error: '圧縮後も音声ファイルが大きすぎます。より短い音声をお試しください。' });
        }
      } catch (compressError) {
        console.error('Audio compression failed:', compressError);
        return res.status(500).json({ error: '音声圧縮に失敗しました: ' + compressError.message });
      }
    }

    // OpenAI SDKを使用してWhisper APIにファイルを送信
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // ファイル名を取得して正しい拡張子の一時ファイルを作成
    const ext = path.extname(originalName) || '.mp3';
    const tempPath = audioPath + ext;
    tempFiles.push(tempPath);

    // ファイルを正しい拡張子でリネーム
    fs.renameSync(audioPath, tempPath);
    // リネーム元を削除リストから除外
    tempFiles = tempFiles.filter(f => f !== audioPath);

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
        language: 'ja'
      });

      const data = transcription;

      // セグメント情報を整形
      const segments = (data.segments || []).map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim()
      }));

      // キャッシュに保存
      transcriptCache = {
        text: data.text,
        segments: segments,
        duration: data.duration
      };

      // 一時ファイル削除
      for (const f of tempFiles) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
      }

      res.json({
        success: true,
        text: data.text,
        segments: segments,
        duration: data.duration
      });
    } catch (innerError) {
      // 内部エラー時に一時ファイルを削除
      for (const f of tempFiles) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
      }
      throw innerError;
    }
  } catch (error) {
    // エラー時のクリーンアップ
    for (const f of tempFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
    }
    console.error('Transcribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// キャッシュされた文字起こしを取得
app.get('/api/ai/transcript', (req, res) => {
  if (!transcriptCache) {
    return res.status(404).json({ error: 'No transcript available. Transcribe audio first.' });
  }
  res.json(transcriptCache);
});

// 自動マーカー生成（GPT-5.2でスライドと音声をマッチング）
app.post('/api/ai/auto-markers', async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OPENAI_API_KEY is not set' });
    }

    if (!slideSummariesCache || slideSummariesCache.length === 0) {
      return res.status(400).json({ error: 'PDFを先に分析してください（PDF分析ボタン）' });
    }

    if (!transcriptCache || !transcriptCache.segments || transcriptCache.segments.length === 0) {
      return res.status(400).json({ error: '音声を先に文字起こししてください（文字起こしボタン）' });
    }

    // スライド要約を整形
    const slideSummaries = slideSummariesCache.map(s =>
      `スライド${s.slide}: ${s.summary}`
    ).join('\n');

    // 音声セグメントを整形
    const audioSegments = transcriptCache.segments.map(seg =>
      `[${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s] ${seg.text}`
    ).join('\n');

    const prompt = `あなたはプレゼンテーションの音声とスライドを同期させるエキスパートです。

以下の情報をもとに、各スライドが表示されるべき最適なタイミング（秒）を提案してください。

【スライド内容】
${slideSummaries}

【音声文字起こし（タイムスタンプ付き）】
${audioSegments}

以下の形式で、各スライドの開始タイミングをJSON形式で出力してください：
{"markers": [{"t": 0, "slide": 1}, {"t": 15.5, "slide": 2}, ...]}

ルール：
1. 最初のマーカーは必ず t=0 から始める
2. スライドの内容に対応する音声が始まるタイミングでマーカーを配置
3. すべてのスライドに対してマーカーを生成
4. 音声の内容とスライドの内容が一致するポイントを見つける
5. JSON形式のみを出力（説明文は不要）`;

    const content = await callOpenAI(prompt);
    console.log('GPT-5.2 response length:', content?.length || 0);
    console.log('GPT-5.2 response preview:', content?.substring(0, 500));

    // JSON部分を抽出
    let markersData;
    try {
      // まずコードブロック内のJSONを探す
      let jsonStr = content;
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      // JSONブロックを抽出
      const jsonMatch = jsonStr.match(/\{[\s\S]*"markers"[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No markers found in:', jsonStr.substring(0, 500));
        throw new Error('マーカーデータが見つかりません');
      }
      markersData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Content was:', content?.substring(0, 1000) || 'empty');
      return res.status(500).json({ error: 'AIの出力をパースできませんでした。もう一度お試しください。' });
    }

    if (!markersData.markers || !Array.isArray(markersData.markers)) {
      return res.status(500).json({ error: '無効なマーカーデータです' });
    }

    // マーカーを検証・整形
    const markers = markersData.markers
      .filter(m => typeof m.t === 'number' && typeof m.slide === 'number')
      .map(m => ({
        t: Math.max(0, m.t),
        slide: Math.max(1, Math.round(m.slide))
      }))
      .sort((a, b) => a.t - b.t);

    // 最初のマーカーがt=0でない場合は追加
    if (markers.length === 0 || markers[0].t > 0.1) {
      markers.unshift({ t: 0, slide: 1 });
    }

    res.json({
      success: true,
      markers: markers,
      slideCount: slideSummariesCache.length
    });
  } catch (error) {
    console.error('Auto markers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 依存コマンドのチェック（サーバー起動前）
function checkDependencies() {
  const locator = process.platform === 'win32' ? 'where' : 'which';
  const deps = ['pdftoppm', 'ffmpeg', 'ffprobe'];
  const missing = [];

  for (const cmd of deps) {
    const result = spawnSync(locator, [cmd], { stdio: 'pipe', encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      missing.push(cmd);
    }
  }

  if (missing.length === 0) return;

  console.error('========================================');
  console.error('エラー: 必要なコマンドが見つかりません');
  console.error('========================================');
  console.error(`未インストール/未検出: ${missing.join(', ')}`);
  console.error('');

  if (process.platform === 'win32') {
    console.error('setup.ps1 を実行してセットアップを完了してください。');
    console.error('ヒント: poppler はインストールされても pdftoppm が PATH に追加されない場合があります。');
    console.error('      その場合は start.bat から起動するか、PC再起動後に再度お試しください。');
  } else {
    console.error('必要なパッケージをインストールしてください:');
    console.error('  macOS: brew install poppler ffmpeg');
    console.error('  Ubuntu/Debian: sudo apt install poppler-utils ffmpeg');
  }

  process.exit(1);
}

checkDependencies();

const server = app.listen(PORT, () => {
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
    console.log('Gemini 3.0 Flash (gemini-3-flash-preview): enabled');
  }
});

// ポート競合時のエラーハンドリング
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nエラー: ポート ${PORT} は既に使用されています。`);
    console.error('他のアプリケーションを閉じるか、ポート番号を変更してください。');
  } else {
    console.error('サーバーエラー:', err.message);
  }
  process.exit(1);
});

// 長時間の動画生成に対応するためタイムアウトを10分に延長
server.timeout = 10 * 60 * 1000; // 10 minutes
server.keepAliveTimeout = 10 * 60 * 1000;
