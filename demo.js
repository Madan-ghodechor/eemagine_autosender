/**
 * demo.js — Run this to test voucher generation locally without a running server.
 * Usage: node demo.js
 */
require('dotenv').config();
const { generateVoucher, generateVoucherImage } = require('./src/services/voucherService');
const logger = require('./src/utils/logger');

async function run() {
  const voucherData = {
    recipientName: 'Sonali Magar',
    amount: 500,
    currency: '₹',
    code: 'DEMO-2026',
    title: 'Gift Voucher',
    brand: 'Eemagine',
    category: 'Shopping',
    description: 'Valid on all products. Cannot be combined with other offers. Non-transferable.',
    expiryDate: '25/06/2027',
    voucherId: 'VCH-DEMO-001',
  };

  logger.info('Generating voucher PDF...');
  const pdfPath = await generateVoucher(voucherData, 'demo_voucher.pdf');
  logger.success(`PDF  → ${pdfPath}`);

  logger.info('Generating voucher PNG image...');
  const imgPath = await generateVoucherImage(voucherData, 'demo_voucher.png');
  logger.success(`PNG  → ${imgPath}`);

  logger.info('Done! Check the ./vouchers/ directory.');
}

run().catch((err) => {
  logger.error('Demo failed', err);
  process.exit(1);
});
