const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function getUpload(opts = {}) {
  ensureUploadDir();
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, unique + path.extname(file.originalname));
    },
  });
  // For import (xlsx), use memoryStorage so we can parse the buffer
  if (opts.memory) {
    return multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  }
  return multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
}

// Use memoryStorage for import routes
function getMemoryUpload() {
  return multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
}

module.exports = { getUpload: getMemoryUpload, UPLOAD_DIR };
