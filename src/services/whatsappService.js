const logger = require('../utils/logger');

/**
 * Send the EEMAgine 2026 booking voucher via Cheerio WhatsApp template API.
 * @param {object} options
 * @param {string} options.to           - Phone number (digits only or with country code)
 * @param {string} options.guestName    - {{1}} in body
 * @param {string} options.stayDate     - {{2}} in body e.g. "25 June 2026"
 * @param {string} options.contact      - {{3}} in body e.g. "+91 8840165393"
 * @param {string} options.s3Url        - Public S3 URL of the voucher PDF
 * @param {string} [options.fileName]   - Display filename for the document header
 */
async function sendWhatsAppVoucher({ to, guestName, stayDate, contact, s3Url, fileName = 'Voucher' }) {
  const phone = to.replace(/\D/g, '');

  const payload = {
    to: phone,
    data: {
      name: 'eemagine_2026_booking',
      language: { code: 'en' },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'document',
              document: { link: s3Url, filename: fileName },
            },
          ],
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: guestName },
            { type: 'text', text: stayDate },
            { type: 'text', text: "+91 8840165393" },
          ],
        },
      ],
    },
  };

  const apiUrl = process.env.CHEERIO_API_URL || 'https://pre-prod.cheerio.in/direct-apis/v1/whatsapp/template/send';

  const res = await fetch(apiUrl, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    process.env.CHEERIO_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();
  if (!res.ok) {
    throw new Error(`Cheerio API ${res.status}: ${responseText}`);
  }

  logger.success(`WhatsApp template sent to ${phone}`);
  return JSON.parse(responseText);
}

module.exports = { sendWhatsAppVoucher };
