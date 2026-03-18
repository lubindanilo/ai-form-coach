const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

function makeS3Client() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

  // Compat: some envs use AWS_SECRET_KEY instead of AWS_SECRET_ACCESS_KEY
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY;

  const credentials =
    accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined; // fallback to default provider chain (IAM role, etc.)

  return new S3Client({ region, credentials });
}

async function presignPutObject({ bucket, key, contentType, expiresIn = 120 }) {
  const s3 = makeS3Client();
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType
  });
  return await getSignedUrl(s3, cmd, { expiresIn });
}

async function presignGetObject({ bucket, key, expiresIn = 600 }) {
  const s3 = makeS3Client();
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });
  return await getSignedUrl(s3, cmd, { expiresIn });
}

async function putJson({ bucket, key, obj }) {
  const s3 = makeS3Client();
  const body = Buffer.from(JSON.stringify(obj, null, 2), "utf-8");
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: "application/json"
  }));
}

module.exports = { presignPutObject, presignGetObject, putJson };
