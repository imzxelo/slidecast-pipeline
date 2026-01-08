#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const usage = `slidecast - PDF + audio to MP4

Usage:
  slidecast --pdf <path> --audio <path> --out <path>

Options:
  --pdf <path>       Input PDF file
  --audio <path>     Input audio file (m4a, mp3, etc.)
  --out <path>       Output MP4 file
  --timings <path>   Optional timings CSV (index,seconds)
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
    if (arg === '--pdf' || arg === '--audio' || arg === '--out' || arg === '--timings' || arg === '--workdir') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      if (arg === '--pdf') args.pdf = value;
      if (arg === '--audio') args.audio = value;
      if (arg === '--out') args.out = value;
      if (arg === '--timings') args.timings = value;
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
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
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

  if (args.timings) {
    fatal('timings.csv is not supported yet (Phase 2)');
  }

  const workdir = getWorkdir(args.workdir);
  fs.mkdirSync(workdir, { recursive: true });

  let error = null;

  try {
    const durationSeconds = getAudioDurationSeconds(args.audio);

    if (args.dryRun) {
      process.stdout.write(`Dry run:\n`);
      process.stdout.write(`- Workdir: ${workdir}\n`);
      process.stdout.write(`- Audio duration: ${durationSeconds.toFixed(3)} sec\n`);
      process.stdout.write(`- Planned steps: pdftoppm -> concat -> ffmpeg (video) -> ffmpeg (merge audio)\n`);
      return;
    }

    convertPdfToPng(args.pdf, workdir);
    const slides = listSlideImages(workdir);
    const durations = computeEqualDurations(durationSeconds, slides.length);
    const concatPath = writeConcatFile(workdir, slides, durations);
    const videoPath = buildVideo(concatPath, workdir);

    ensureOutDir(args.out);
    mergeAudio(videoPath, args.audio, args.out);
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
