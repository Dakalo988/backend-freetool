import express from 'express';
import QRCode from 'qrcode';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { text, type = 'png', size = 256, margin = 2 } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text' });
    }

    const sizeNum = Math.min(1024, Math.max(64, Number(size) || 256));
    const marginNum = Math.min(8, Math.max(0, Number(margin) || 2));

    if (type === 'svg') {
      const svg = await QRCode.toString(text, { type: 'svg', margin: marginNum, width: sizeNum });
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    const mime = type === 'jpeg' || type === 'jpg' ? 'image/jpeg' : 'image/png';
    const buffer = await QRCode.toBuffer(text, {
      type: mime,
      margin: marginNum,
      width: sizeNum
    });
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename=qr.${type === 'jpeg' || type === 'jpg' ? 'jpg' : 'png'}`);
    return res.send(buffer);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

export default router;


