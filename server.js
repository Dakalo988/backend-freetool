import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import imageRouter from './routes/image.js';
import textRouter from './routes/text.js';
import qrcodeRouter from './routes/qrcode.js';
import mediaRouter from './routes/media.js';
import { startUploadCleanup } from './utils/cleanup.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve uploads statically (files auto-cleaned by cleanup job)
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=300, immutable');
  }
}));

// API routes (no /api prefix now)
app.use('/image', imageRouter);
app.use('/text', textRouter);
app.use('/qrcode', qrcodeRouter);
app.use('/media', mediaRouter);

// Start cleanup job
startUploadCleanup(UPLOADS_DIR, 5 * 60 * 1000, 60 * 1000);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
