const express  = require('express');
const router   = express.Router();
const { sendInconvenienceEmail }    = require('../services/emailService');
const { sendInconvenienceWhatsApp } = require('../services/whatsappService');
const logger   = require('../utils/logger');

// GET /inconvenience — render the UI
router.get('/', (req, res) => {
  res.render('inconvenience', { title: 'Send Inconvenience Notice', page: 'inconvenience' });
});

// POST /inconvenience/send
// Body: { guestName, email, phone, contactNumber }
router.post('/send', async (req, res) => {
  const { guestName, email, phone } = req.body;

  if (!guestName)       return res.status(400).json({ success: false, error: 'guestName is required.' });
  if (!email && !phone) return res.status(400).json({ success: false, error: 'At least one of email or phone is required.' });

  const results = {};

  if (email) {
    try {
      await sendInconvenienceEmail({ to: email, guestName });
      results.email = { success: true };
      logger.success(`Inconvenience email sent to ${email}`);
    } catch (err) {
      results.email = { success: false, error: err.message };
      logger.error(`Inconvenience email failed to ${email}`, err);
    }
  }

  if (phone) {
    try {
      await sendInconvenienceWhatsApp({ to: phone, guestName });
      results.whatsapp = { success: true };
      logger.success(`Inconvenience WhatsApp sent to ${phone}`);
    } catch (err) {
      results.whatsapp = { success: false, error: err.message };
      logger.error(`Inconvenience WhatsApp failed to ${phone}`, err);
    }
  }

  res.json({ success: true, results });
});

module.exports = router;
