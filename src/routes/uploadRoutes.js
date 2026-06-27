const express = require('express');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const { parseExcel } = require('../services/excelService');
const Booking = require('../models/Booking');
const logger  = require('../utils/logger');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const ALLOWED_EXT = ['.xlsx', '.xls', '.csv'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// In-memory session store (replace with Redis/DB when scaling)
const resultCache = new Map();

// ── GET /upload/history ──
router.get('/history', (req, res) => {
  const entries = [...resultCache.entries()].reverse().slice(0, 50).map(([token, v]) => ({
    token,
    fileName: v.fileName,
    rowCount: v.rowCount,
    columns: v.columns.length,
    activeSheet: v.activeSheet,
    uploadedAt: v.uploadedAt,
  }));
  res.render('history', { title: 'Upload History', page: 'history', entries });
});

// ── POST /upload ──
router.post('/', async (req, res) => {
  // No file attached
  if (!req.files || !req.files.excelFile) {
    return res.render('index', { title: 'Upload', page: 'home', error: 'No file selected. Please choose an Excel or CSV file.' });
  }

  const file = req.files.excelFile;
  const ext  = path.extname(file.name).toLowerCase();

  // Validate extension
  if (!ALLOWED_EXT.includes(ext)) {
    return res.render('index', {
      title: 'Upload', page: 'home',
      error: `Invalid file type "${ext}". Only ${ALLOWED_EXT.join(', ')} are accepted.`,
    });
  }

  // Save to uploads/
  ensureDir(UPLOAD_DIR);
  const safeName  = path.basename(file.name, ext).replace(/[^a-z0-9_-]/gi, '_');
  const savedName = `${safeName}_${Date.now()}${ext}`;
  const savedPath = path.join(UPLOAD_DIR, savedName);

  try {
    await file.mv(savedPath);

    const sheetName = req.body.sheetName?.trim() || undefined;
    const result    = parseExcel(savedPath, sheetName);

    const token    = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const jsonPath = savedPath.replace(/\.(xlsx|xls|csv)$/i, '.json');
    fs.writeFileSync(jsonPath, JSON.stringify(result.rows, null, 2), 'utf-8');

    resultCache.set(token, {
      ...result,
      fileName: file.name,
      fileSize: formatBytes(file.size),
      filePath: savedPath,
      jsonFile: path.basename(jsonPath),
      uploadedAt: new Date().toISOString(),
    });

    logger.success(`Parsed "${file.name}" → ${result.rowCount} rows, ${result.columns.length} cols`);
    res.redirect(`/upload/preview/${token}`);

    // Async save to MongoDB (does not block the redirect)
    ;(async () => {
      const year   = new Date().getFullYear().toString().slice(-2);
      const prefix = `CT${year}EEMA`;

      // Find last assigned number for this prefix so we continue the sequence
      const last = await Booking.findOne(
        { bookingId: { $regex: `^${prefix}` } },
        { bookingId: 1 }
      ).sort({ bookingId: -1 });

      const startNum = last
        ? (parseInt(last.bookingId.replace(prefix, ''), 10) || 0) + 1
        : 1;

      const docs = result.rows.map((row, i) => ({
        bookingId:   `${prefix}${String(startNum + i).padStart(4, '0')}`,
        batchId:     token,
        fileName:    file.name,
        rowIndex:    i,
        data:        row,
        voucherSend: false,
      }));

      await Booking.insertMany(docs);
      logger.success(`Saved ${docs.length} booking(s) to MongoDB [batch: ${token}] — IDs ${docs[0].bookingId}…${docs.at(-1).bookingId}`);
    })().catch(err => logger.error('MongoDB save error', err));

  } catch (err) {
    logger.error('Upload/parse error', err);
    res.render('index', { title: 'Upload', page: 'home', error: err.message });
  }
});

// ── GET /upload/preview/:token ──
router.get('/preview/:token', (req, res) => {
  const data = resultCache.get(req.params.token);
  if (!data) {
    return res.status(404).render('error', { status: '404', message: 'Preview session not found. Please re-upload.' });
  }
  res.render('preview', { title: `Preview — ${data.fileName}`, page: 'preview', token: req.params.token, ...data });
});

// ── GET /upload/download-json?file=<filename> ──
router.get('/download-json', (req, res) => {
  const file = req.query.file;
  if (!file || file.includes('..') || /[\\/]/.test(file)) {
    return res.status(400).json({ error: 'Invalid file parameter.' });
  }
  const filePath = path.join(UPLOAD_DIR, file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }
  res.download(filePath, file);
});

// ── GET /upload/json/:token  (raw JSON API) ──
router.get('/json/:token', (req, res) => {
  const data = resultCache.get(req.params.token);
  if (!data) return res.status(404).json({ error: 'Token not found.' });
  res.json({ rows: data.rows, columns: data.columns, activeSheet: data.activeSheet, rowCount: data.rowCount });
});

module.exports = router;
