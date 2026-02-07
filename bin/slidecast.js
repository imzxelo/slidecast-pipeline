#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const usage = `slidecast - PDF + audio to MP4

Usage:
  slidecast --pdf <path> --audio <path> --out <path> [--timings <path> | --markers <path>]

Options:
  --pdf <path>       Input PDF file
  --audio <path>     Input audio file (m4a, mp3, etc.)
  --out <path>       Output MP4 file
  --timings <path>   Optional timings CSV (index,seconds)
  --markers <path>   Optional markers JSON ({ markers: [{ t, slide }, ...] })
  --workdir <path>   Optional working directory
  --keep-work        Keep working files
  --dry-run          Print planned steps and exit
  -h, --help         Show this help
`;

function parseArgs(argv) {
  const args = {
    pdf: null,
    audio: null,
    out: null,
    timings: null,
    markers: null,
    workdir: null,
    keepWork: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      args.help = true;
      continue;
    }
    if (arg === '--keep-work') {
      args.keepWork = true;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--pdf' || arg === '--audio' || arg === '--out' || arg === '--timings' || arg === '--markers' || arg === '--workdir') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      if (arg === '--pdf') args.pdf = value;
      if (arg === '--audio') args.audio = value;
      if (arg === '--out') args.out = value;
      if (arg === '--timings') args.timings = value;
      if (arg === '--markers') args.markers = value;
      if (arg === '--workdir') args.workdir = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function fatal(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function progress(step, message) {
  process.stdout.write(`[${step}] ${message}\n`);
}

function commandExists(cmd) {
  const result = spawnSync('which', [cmd], { stdio: 'ignore' });
  return result.status === 0;
}

function ensureFileExists(label, filePath) {
  if (!filePath) {
    throw new Error(`${label} is required`);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function getWorkdir(specified) {
  if (specified) return specified;
  return path.join('work', `slidecast-${formatTimestamp(new Date())}`);
}

function runOrThrow(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.error) {
    throw new Error(`Command failed to execute: ${cmd} ${args.join(' ')}\n${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.error) {
    throw new Error(`Command failed to execute: ${cmd} ${args.join(' ')}\n${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
  return result.stdout.trim();
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

function computeEqualDurations(totalSeconds, count) {
  if (count <= 0) {
    throw new Error('No slides available to compute durations');
  }
  const base = totalSeconds / count;
  const durations = Array(count).fill(base);
  const sumFirst = base * (count - 1);
  const last = totalSeconds - sumFirst;
  if (last <= 0) {
    throw new Error('Computed non-positive duration for last slide');
  }
  durations[count - 1] = last;
  return durations;
}

function parseTimingsCsv(timingsPath, slideCount, totalSeconds) {
  const content = fs.readFileSync(timingsPath, 'utf8');
  const durations = Array(slideCount).fill(null);
  const lines = content.split(/\r?\n/);
  let specifiedTotal = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('#')) continue;
    const parts = raw.split(',').map((part) => part.trim());
    if (parts.length < 2) {
      throw new Error(`Invalid timings CSV at line ${i + 1}: "${raw}"`);
    }
    const index = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (!Number.isFinite(index) || !Number.isFinite(seconds)) {
      if (i === 0 && /index|slide|page/i.test(raw)) continue;
      throw new Error(`Invalid timings CSV at line ${i + 1}: "${raw}"`);
    }
    if (!Number.isInteger(index) || index < 1 || index > slideCount) {
      throw new Error(`Timing index out of range at line ${i + 1}: ${parts[0]}`);
    }
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error(`Timing seconds must be > 0 at line ${i + 1}: ${parts[1]}`);
    }
    if (durations[index - 1] !== null) {
      throw new Error(`Duplicate timing for slide ${index}`);
    }
    durations[index - 1] = seconds;
    specifiedTotal += seconds;
  }

  if (specifiedTotal > totalSeconds) {
    throw new Error(`timings.csv total (${specifiedTotal.toFixed(3)}s) exceeds audio duration (${totalSeconds.toFixed(3)}s)`);
  }

  const remaining = totalSeconds - specifiedTotal;
  const unsetIndices = durations.map((value, idx) => (value === null ? idx : null)).filter((value) => value !== null);

  if (unsetIndices.length > 0) {
    const perSlide = remaining / unsetIndices.length;
    if (perSlide <= 0) {
      throw new Error(`Remaining duration (${remaining.toFixed(3)}s) is not enough for ${unsetIndices.length} slides`);
    }
    unsetIndices.forEach((idx) => {
      durations[idx] = perSlide;
    });
  } else if (remaining > 0) {
    durations[slideCount - 1] += remaining;
  }

  durations.forEach((seconds, idx) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error(`Computed non-positive duration for slide ${idx + 1}: ${seconds}`);
    }
  });

  return durations;
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

function parseMarkersJson(markersPath) {
  let data;
  try {
    const raw = fs.readFileSync(markersPath, 'utf8');
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse markers JSON: ${err.message}`);
  }
  if (!data || !Array.isArray(data.markers)) {
    throw new Error('markers.json must include a "markers" array');
  }
  return data.markers;
}

function computeMarkerPlan(markersPath, slideMap, totalSeconds) {
  const markers = parseMarkersJson(markersPath).map((marker, idx) => {
    const t = Number(marker.t);
    const slide = Number(marker.slide);
    if (!Number.isFinite(t) || t < 0) {
      throw new Error(`Marker ${idx + 1} has invalid t: ${marker.t}`);
    }
    if (!Number.isInteger(slide) || slide < 1) {
      throw new Error(`Marker ${idx + 1} has invalid slide: ${marker.slide}`);
    }
    return { t, slide, order: idx + 1 };
  });

  if (markers.length === 0) {
    throw new Error('markers.json must contain at least one marker');
  }

  markers.sort((a, b) => (a.t - b.t) || (a.order - b.order));

  const firstTolerance = 0.001;
  if (markers[0].t > firstTolerance) {
    throw new Error(`First marker must start at t=0 (got ${markers[0].t.toFixed(3)})`);
  }
  if (markers[0].t >= 0 && markers[0].t <= firstTolerance) {
    markers[0].t = 0;
  }

  const sequence = markers.map((marker) => {
    const file = slideMap.get(marker.slide);
    if (!file) {
      throw new Error(`Marker slide ${marker.slide} has no corresponding PNG`);
    }
    return file;
  });

  const durations = [];
  for (let i = 0; i < markers.length; i += 1) {
    const current = markers[i];
    const nextTime = i < markers.length - 1 ? markers[i + 1].t : totalSeconds;
    const duration = nextTime - current.t;
    if (duration <= 0) {
      const nextLabel = i < markers.length - 1 ? markers[i + 1].t.toFixed(3) : totalSeconds.toFixed(3);
      throw new Error(`Non-positive duration at marker ${i + 1} (t=${current.t.toFixed(3)} -> ${nextLabel})`);
    }
    durations.push(duration);
  }

  return { sequence, durations };
}

function escapePath(filePath) {
  return filePath.replace(/'/g, "'\\''");
}

function writeConcatFile(workdir, slides, durations) {
  const concatPath = path.join(workdir, 'concat.txt');
  const lines = [];
  for (let i = 0; i < slides.length; i += 1) {
    const slidePath = path.resolve(workdir, slides[i]);
    lines.push(`file '${escapePath(slidePath)}'`);
    lines.push(`duration ${durations[i].toFixed(3)}`);
  }
  const lastPath = path.resolve(workdir, slides[slides.length - 1]);
  lines.push(`file '${escapePath(lastPath)}'`);
  fs.writeFileSync(concatPath, `${lines.join('\n')}\n`);
  return concatPath;
}

function ensureOutDir(outPath) {
  const dir = path.dirname(outPath);
  if (dir && dir !== '.') {
    fs.mkdirSync(dir, { recursive: true });
  }
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

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    fatal(err.message);
  }

  if (args.help || process.argv.length <= 2) {
    process.stdout.write(usage);
    return;
  }

  try {
    ensureFileExists('PDF', args.pdf);
    ensureFileExists('Audio', args.audio);
    if (!args.out) throw new Error('Output path is required');
  } catch (err) {
    fatal(err.message);
  }

  const missing = ['ffmpeg', 'ffprobe', 'pdftoppm'].filter((cmd) => !commandExists(cmd));
  if (missing.length > 0) {
    fatal(`Missing dependencies: ${missing.join(', ')}. Install with: brew install ffmpeg poppler`);
  }

  if (args.timings && args.markers) {
    fatal('Use either --timings or --markers (not both)');
  }

  const workdir = getWorkdir(args.workdir);
  fs.mkdirSync(workdir, { recursive: true });

  let error = null;

  try {
    progress('1/5', '音声ファイルを解析中...');
    const durationSeconds = getAudioDurationSeconds(args.audio);

    if (args.dryRun) {
      const mode = args.markers ? 'markers' : args.timings ? 'timings' : 'equal';
      process.stdout.write(`\nDry run:\n`);
      process.stdout.write(`- Workdir: ${workdir}\n`);
      process.stdout.write(`- Audio duration: ${durationSeconds.toFixed(3)} sec\n`);
      process.stdout.write(`- Sync mode: ${mode}\n`);
      if (args.markers) {
        process.stdout.write(`- Markers: ${args.markers}\n`);
      }
      if (args.timings) {
        process.stdout.write(`- Timings: ${args.timings}\n`);
      }
      process.stdout.write(`- Planned steps: pdftoppm -> concat -> ffmpeg (video) -> ffmpeg (merge audio)\n`);
      return;
    }

    progress('2/5', 'PDFを画像に変換中...');
    convertPdfToPng(args.pdf, workdir);
    const slides = listSlideImages(workdir);
    const slideMap = buildSlideIndexMap(slides);
    progress('2/5', `${slides.length}枚のスライドを検出`);

    let sequence = slides;
    let durations = null;

    progress('3/5', 'タイミングを計算中...');
    if (args.markers) {
      const markerPlan = computeMarkerPlan(args.markers, slideMap, durationSeconds);
      sequence = markerPlan.sequence;
      durations = markerPlan.durations;
      progress('3/5', `${durations.length}個のマーカーを適用`);
    } else if (args.timings) {
      durations = parseTimingsCsv(args.timings, slides.length, durationSeconds);
      progress('3/5', 'timings.csvを適用');
    } else {
      durations = computeEqualDurations(durationSeconds, slides.length);
      progress('3/5', '等間隔モードを適用');
    }

    progress('4/5', '動画を生成中...');
    const concatPath = writeConcatFile(workdir, sequence, durations);
    const videoPath = buildVideo(concatPath, workdir);

    progress('5/5', '音声を合成中...');
    ensureOutDir(args.out);
    mergeAudio(videoPath, args.audio, args.out);

    progress('完了', `出力: ${args.out}`);
  } catch (err) {
    error = err;
    process.stderr.write(`Error: ${err.message}\n`);
  } finally {
    if (!args.keepWork) {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  }

  if (error) {
    process.exit(1);
  }
}

main();
