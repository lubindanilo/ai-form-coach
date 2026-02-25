const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

function makeS3Client() {
  return new S3Client({ region: process.env.AWS_REGION });
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

module.exports = { presignPutObject, putJson };
