import express from 'express';

const router = express.Router();

// Simple optional backend text utilities – frontend will do these too
router.post('/convert', (req, res) => {
  const { text = '', mode } = req.body || {};
  if (typeof text !== 'string') return res.status(400).json({ error: 'Invalid text' });

  let result = text;
  switch (mode) {
    case 'upper':
      result = text.toUpperCase();
      break;
    case 'lower':
      result = text.toLowerCase();
      break;
    case 'title':
      result = text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      break;
    case 'sentence':
      result = text.replace(/(^\s*[a-z])|([\.\?\!]\s*[a-z])/g, (c) => c.toUpperCase());
      break;
    case 'removeLineBreaks':
      result = text.replace(/\r?\n+/g, ' ');
      break;
    case 'wordCount': {
      const words = (text.trim().match(/\b\w+\b/g) || []).length;
      return res.json({ result: String(words) });
    }
    default:
      break;
  }
  return res.json({ result });
});

export default router;


