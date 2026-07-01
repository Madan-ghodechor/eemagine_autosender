const puppeteer = require('puppeteer');
const fs   = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { uploadToS3 } = require('./s3Service');

const TEMPLATE_PATH = path.join(__dirname, '../templates/hotel_voucher.html');

function renderTemplate(html, data) {
  let rendered = html;
  Object.entries(data).forEach(([key, value]) => {
    const safe = String(value ?? '');
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => safe);
  });
  rendered = rendered.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, block) => (data[key] ? block : '')
  );
  return rendered;
}

function splitHotelName(hotelName) {
  const upper = (hotelName || 'HOTEL').toUpperCase();
  const words = upper.split(' ');
  if (words.length <= 1) return { line1: upper, line2: '' };
  const half = Math.ceil(words.length / 2);
  return { line1: words.slice(0, half).join(' '), line2: words.slice(half).join(' ') };
}

const HOTEL_IMAGES = {
  'ITC Grand Chola':    'https://aws-taxivaxi-bucket.s3.us-east-2.amazonaws.com/cotravin_assets/Madan/eemagine/ITC%20GRAND%20CHOLA.png',
  'Park Hyatt Chennai': 'https://aws-taxivaxi-bucket.s3.us-east-2.amazonaws.com/cotravin_assets/Madan/eemagine/Park+hyatt+hotel+image-32.svg',
};

function getHotelImg(hotelName) {
  const match = Object.keys(HOTEL_IMAGES).find(k =>
    hotelName.toLowerCase().includes(k.toLowerCase())
  );
  return match ? HOTEL_IMAGES[match] : 'https://dummy.link/default-hotel.png';
}

async function waitForImages(page) {
  await page.evaluate(async () => {
    const images = Array.from(document.images);

    await Promise.all(images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();

      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));

    await Promise.all(images.map((img) => (
      img.decode ? img.decode().catch(() => {}) : Promise.resolve()
    )));
  });
}

async function generatePDF(row, bookingId) {
  const hotelName    = row['Hotel Name'] || 'Hotel';
  const { line1, line2 } = splitHotelName(hotelName);
  const roomType     = (row['Room Type'] || 'Single').toString().trim();
  const hotelAddress = (row['Hotel Address'] || '').replace(/\r?\n/g, '<br>');
  const resolvedId   = bookingId || `EEMA-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
  const thirdGuestName = row['Third Guest Name'] || row['thirdGuestName'] || '';
  const thirdGuestContact = row['Third Guest Contact'] || row['thirdGuestContact'] || '';
  const thirdGuestEmail = row['Third Guest Email'] || row['thirdGuestEmail'] || '';
  const thirdGuestDetails = String(thirdGuestName || thirdGuestContact || thirdGuestEmail).trim();
  const hasThirdGuest = Boolean(thirdGuestDetails);

  const data = {
    bookingId: resolvedId,
    bookingDate:           row['Booking Date'] || '',
    hotelName,
    hotelImg:              getHotelImg(hotelName),
    isITCGrandChola:       hotelName.toLowerCase().includes('itc grand chola') ? 'true' : '',
    hotelBadgeLine1:       line1,
    hotelBadgeLine2:       line2,
    hotelAddress,
    hotelContact:          row['Hotel Support Contact'] || '',
    hotelEmail:            row['Hotel Support Email'] || '',
    hotelGoogleLocation:   row['Hotel Google Location'] || '#',
    roomType,
    roomLabel:             `ROOM 1 - ${roomType.toUpperCase()} OCCUPANCY`,
    checkInDate:           row['Check -In Date'] || row['Check-In Date'] || '',
    checkOutDate:          row['Check-Out Date'] || '',
    primaryGuestName:      row['Primary Guest Name'] || '',
    primaryGuestContact:   row['Primary Guest Contact'] || '',
    primaryGuestEmail:     row['Primary Guest Email'] || '',
    secondaryGuestName:    row['Secondary Guest Name'] || row['secondaryGuestName'] || '',
    secondaryGuestContact: row['Secondary Guest Contact'] || row['secondaryGuestContact'] || '',
    secondaryGuestEmail:   row['Secondary Guest Email'] || row['secondaryGuestEmail'] || '',
    hasSecondaryGuest:     (row['Secondary Guest Name'] || row['secondaryGuestName'] || '').trim() ? 'true' : '',
    thirdGuestName,
    thirdGuestContact,
    thirdGuestEmail,
    hasThirdGuest:          hasThirdGuest ? 'true' : '',
    mealPlan:              'APAI',
  };

  const html     = renderTemplate(fs.readFileSync(TEMPLATE_PATH, 'utf-8'), data);
  const safeName = (data.primaryGuestName || 'guest').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  // const fileName = bookingId ? `${bookingId}.pdf` : `hotel_voucher_${safeName}_${Date.now()}.pdf`;

  const fileName = `${safeName}_hotel_voucher.pdf`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let buffer;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    await waitForImages(page);
    await page.addStyleTag({
      content: `@page { margin: 0 !important; size: A4 portrait; } html, body { margin: 0 !important; padding: 0 !important; }`,
    });
    buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await browser.close();
  }

  return { buffer, fileName, guestName: data.primaryGuestName };
}

// generateVoucher = generatePDF + S3 upload (used by manual voucher route)
async function generateVoucher(row, bookingId) {
  const result = await generatePDF(row, bookingId);
  logger.info(`[${result.fileName}] Uploading to S3…`);
  const s3Url = await uploadToS3(result.buffer, result.fileName);
  return { ...result, s3Url };
}

module.exports = { generatePDF, generateVoucher };
