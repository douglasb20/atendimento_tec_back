/**
 * Configura o CORS do bucket de storage.
 *
 * O upload de mídia e avatar é feito pelo browser direto no bucket, via URL
 * assinada. Sem CORS o browser bloqueia o PUT no preflight, e a falha nem
 * chega ao backend. Rodar uma vez por bucket:
 *
 *   node scripts-cors.js                       # aplica as origens abaixo
 *   node scripts-cors.js https://meu.site.com  # acrescenta uma origem
 */
require('dotenv').config();
const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');

const ORIGENS = ['http://localhost:3000', ...process.argv.slice(2)];

(async () => {
  const s3 = new S3Client({
    region: process.env.STORAGE_REGION,
    endpoint: process.env.STORAGE_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY,
      secretAccessKey: process.env.STORAGE_SECRET_KEY,
    },
  });

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: process.env.STORAGE_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ORIGENS,
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  const atual = await s3.send(new GetBucketCorsCommand({ Bucket: process.env.STORAGE_BUCKET }));
  console.log('CORS aplicado:', JSON.stringify(atual.CORSRules, null, 2));
})().catch((e) => {
  console.error('Falhou:', e.name, '|', e.message);
  process.exit(1);
});
