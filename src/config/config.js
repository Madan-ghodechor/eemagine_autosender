require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,

  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    fromName: process.env.EMAIL_FROM_NAME || 'Eemagine',
  },

  voucher: {
    outputDir: process.env.VOUCHER_OUTPUT_DIR || './vouchers',
  },
};
