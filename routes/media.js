import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import ytdlp from "youtube-dl-exec";

import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

const router = express.Router();

// Configure ffmpeg binary (works locally; on some hosts you may need a system ffmpeg)
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOADS_DIR });

const ALLOWED_HOSTS = new Set([
  'www.youtube.com', 'youtube.com', 'youtu.be',
  'www.instagram.com', 'instagram.com',
  'www.facebook.com', 'facebook.com', 'm.facebook.com', 'fb.watch',
  'www.tiktok.com', 'tiktok.com', 'vm.tiktok.com'
]);

function validateUrl(input) {
  try {
    const u = new URL(input);
    if (!ALLOWED_HOSTS.has(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

function tmpPath(ext) {
  const id = uuidv4();
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  return path.join(UPLOADS_DIR, `${id}${safeExt}`);
}

// POST /media/download { url, quality? }
router.post('/download', async (req, res) => {
  try {
    const { url, quality = 'best' } = req.body || {};
    const parsed = validateUrl(String(url || ''));
    if (!parsed) return res.status(400).json({ error: 'Invalid or unsupported URL' });

    // Choose container
    const outPath = tmpPath('.mp4');

    // Build args for yt-dlp
    // For mp4 container preference
    const ytdlpArgs = {
      output: outPath,
      format: quality === 'mp4-720' ? 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]/best' : 'bestvideo+bestaudio/best',
      mergeOutputFormat: 'mp4',
      // Reduce stdout noise
      noWarnings: true,
      restrictFilenames: true,
    };

    await ytdlp(url, ytdlpArgs);

    const filename = `video.mp4`;
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const stream = fs.createReadStream(outPath);
    stream.pipe(res);
    stream.on('close', () => {
      fs.rm(outPath, { force: true }, () => {});
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'Failed to download video' });
  }
});

// POST /media/audio { url, bitrate? }
router.post('/audio', async (req, res) => {
  try {
    const { url, bitrate = '192k' } = req.body || {};
    const parsed = validateUrl(String(url || ''));
    if (!parsed) return res.status(400).json({ error: 'Invalid or unsupported URL' });

    const tmpVideo = tmpPath('.mp4');
    const tmpAudio = tmpPath('.mp3');

    // Download best audio+video, then extract audio with ffmpeg
    await ytdlp(url, {
      output: tmpVideo,
      format: 'bestaudio/best',
      mergeOutputFormat: 'mp4',
      noWarnings: true,
      restrictFilenames: true,
    });

    await new Promise((resolve, reject) => {
      ffmpeg(tmpVideo)
        .noVideo()
        .audioBitrate(bitrate)
        .toFormat('mp3')
        .save(tmpAudio)
        .on('end', resolve)
        .on('error', reject);
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
    const stream = fs.createReadStream(tmpAudio);
    stream.pipe(res);
    stream.on('close', () => {
      fs.rm(tmpVideo, { force: true }, () => {});
      fs.rm(tmpAudio, { force: true }, () => {});
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'Failed to extract audio' });
  }
});

// POST /media/upload-to-mp3 (multipart/form-data: file)
router.post('/upload-to-mp3', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const inputPath = req.file.path;
    const outPath = tmpPath('.mp3');

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioBitrate('192k')
        .toFormat('mp3')
        .save(outPath)
        .on('end', resolve)
        .on('error', reject);
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${path.parse(req.file.originalname).name}.mp3"`);
    const stream = fs.createReadStream(outPath);
    stream.pipe(res);
    stream.on('close', () => {
      fs.rm(inputPath, { force: true }, () => {});
      fs.rm(outPath, { force: true }, () => {});
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'Failed to convert to mp3' });
  }
});

export default router;
