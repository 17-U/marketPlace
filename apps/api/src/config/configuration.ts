export default () => ({
  env: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.API_PORT ?? "4000", 10),
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    // URL publique de base pour lire les fichiers (ex: domaine R2 personnalisé en prod).
    // Par défaut: endpoint + bucket (fonctionne avec le bucket public MinIO en dev).
    publicUrl: process.env.S3_PUBLIC_URL ?? `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  },

  otp: {
    expiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES ?? "5", 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? "5", 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? "60", 10),
  },

  smsProvider: process.env.SMS_PROVIDER ?? "console",

  platform: {
    commissionPercent: parseInt(process.env.PLATFORM_COMMISSION_PERCENT ?? "8", 10),
    orderAutoReleaseDays: parseInt(process.env.ORDER_AUTO_RELEASE_DAYS ?? "3", 10),
  },

  payment: {
    provider: process.env.PAYMENT_PROVIDER ?? "mock",
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,
  },

  sentryDsn: process.env.SENTRY_DSN ?? "",
});
