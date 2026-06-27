const express = require('express');
const router  = express.Router();
const { generateVoucher } = require('../services/generateVoucher');
const logger  = require('../utils/logger');

// POST /api/voucher/generate
router.post('/generate', async (req, res) => {
  try {
    const result = await generateVoucher(req.body);
    res.json({ success: true, s3Url: result.s3Url, fileName: result.fileName, guestName: result.guestName });
  } catch (err) {
    logger.error('Voucher generation failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
