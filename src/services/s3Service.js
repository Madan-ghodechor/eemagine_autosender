const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../utils/logger');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function uploadToS3(buffer, fileName) {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || 'us-east-2';
  const key    = `cotravin_assets/Madan/eemagine/vouchers/${fileName}`;

  await s3.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        buffer,
    ContentType: 'application/pdf',
    ACL:         'public-read',
  }));

  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  logger.success(`Uploaded to S3 → ${url}`);
  return url;
}

module.exports = { uploadToS3 };
