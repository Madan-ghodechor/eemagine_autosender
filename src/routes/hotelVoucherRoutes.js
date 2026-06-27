const express = require('express');
const router  = express.Router();
const { generateVoucher } = require('../services/generateVoucher');
const logger  = require('../utils/logger');

// GET /vouchers/hotel/generate-pdf  → serve the form UI
router.get('/generate-pdf', (req, res) => {
  res.render('generate_hotel_voucher', { title: 'Generate Hotel Voucher PDF', page: 'generate-pdf' });
});

// POST /vouchers/hotel/generate-pdf  → generate PDF, upload to S3, stream buffer back to browser
router.post('/generate-pdf', express.json({ limit: '2mb' }), async (req, res) => {
  const row = req.body.row;
  if (!row || typeof row !== 'object') {
    return res.status(400).json({ error: 'Provide a single row object in body: { "row": { ... } }' });
  }

  logger.info(`Generating voucher for "${row['Primary Guest Name'] || 'unknown'}"…`);

  try {
    const result = await generateVoucher(row);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.end(result.buffer);
  } catch (err) {
    logger.error('Voucher generation error', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
