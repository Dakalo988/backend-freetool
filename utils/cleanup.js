import fs from 'fs';
import path from 'path';

export function startUploadCleanup(directoryPath, maxFileAgeMs = 5 * 60 * 1000, intervalMs = 60 * 1000) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  const runCleanup = () => {
    fs.readdir(directoryPath, (err, files) => {
      if (err) return;
      const now = Date.now();
      for (const file of files) {
        const full = path.join(directoryPath, file);
        fs.stat(full, (statErr, stats) => {
          if (statErr) return;
          if (now - stats.mtimeMs > maxFileAgeMs) {
            fs.unlink(full, () => {});
          }
        });
      }
    });
  };

  runCleanup();
  const timer = setInterval(runCleanup, intervalMs);
  if (timer && typeof timer.unref === 'function') timer.unref();
}


