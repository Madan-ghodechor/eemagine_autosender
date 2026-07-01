const logger = require('../utils/logger');

async function sendWhatsAppVoucher({ to, guestName, hotelName, stayDate, s3Url, fileName = 'Voucher' }) {
  const phone       = to.replace(/\D/g, '');
  const contactName = process.env.CONTACT_NAME   || '';
  const contactNum  = process.env.CONTACT_NUMBER || '';

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
            { type: 'text', text: hotelName },
            { type: 'text', text: stayDate },
            { type: 'text', text: contactName },
            { type: 'text', text: contactNum },
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

// ── Inconvenience notice — no document attachment ──
async function sendInconvenienceWhatsApp({ to, guestName }) {
  const contactNumber = process.env.CONTACT_NUMBER || '';
  const phone  = to.replace(/\D/g, '');
  const apiUrl = process.env.CHEERIO_API_URL || 'https://pre-prod.cheerio.in/direct-apis/v1/whatsapp/template/send';

  const payload = {
    to: phone,
    data: {
      name: 'eemagine_2026_booking_inconvenience',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: guestName },
            { type: 'text', text: contactNumber },
          ],
        },
      ],
    },
  };

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

  logger.success(`WhatsApp inconvenience notice sent to ${phone}`);
  return JSON.parse(responseText);
}

module.exports = { sendWhatsAppVoucher, sendInconvenienceWhatsApp };
