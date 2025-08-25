import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.bin';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${base}-${timestamp}${ext}`);
  }
});

const upload = multer({ storage });

const VALID_TARGETS = new Set(['png', 'jpeg', 'jpg', 'webp']);

router.post('/convert', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const targetParam = String(req.body.target || '').toLowerCase();
    const target = targetParam === 'jpg' ? 'jpeg' : targetParam;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!VALID_TARGETS.has(target)) {
      return res.status(400).json({ error: 'Invalid target format' });
    }

    // Convert
    const inputPath = file.path;
    const outputPath = path.join(UPLOADS_DIR, `${path.parse(file.filename).name}.${target}`);

    let pipeline = sharp(inputPath);
    if (target === 'png') pipeline = pipeline.png();
    if (target === 'jpeg') pipeline = pipeline.jpeg({ quality: 90 });
    if (target === 'webp') pipeline = pipeline.webp({ quality: 90 });

    await pipeline.toFile(outputPath);

    // Stream result as download
    const downloadName = `${path.parse(file.originalname).name}.${target}`;
    res.setHeader('Content-Type', `image/${target}`);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);

    stream.on('close', () => {
      // Optional: keep the converted file for 5 minutes cleanup to handle retries
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'Conversion failed' });
  }
});

export default router;


