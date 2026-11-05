import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  API_PORT: Joi.number().default(4000),
  WEB_URL: Joi.string().uri().default("http://localhost:3000"),

  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),

  S3_ENDPOINT: Joi.string().required(),
  S3_REGION: Joi.string().default("us-east-1"),
  S3_BUCKET: Joi.string().required(),
  S3_ACCESS_KEY: Joi.string().required(),
  S3_SECRET_KEY: Joi.string().required(),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(true),
  S3_PUBLIC_URL: Joi.string().uri().optional(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("30d"),

  OTP_EXPIRES_IN_MINUTES: Joi.number().default(5),
  OTP_MAX_ATTEMPTS: Joi.number().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: Joi.number().default(60),

  SMS_PROVIDER: Joi.string().valid("console").default("console"),

  PLATFORM_COMMISSION_PERCENT: Joi.number().min(0).max(100).default(8),
  ORDER_AUTO_RELEASE_DAYS: Joi.number().min(1).default(3),

  PAYMENT_PROVIDER: Joi.string().valid("mock").default("mock"),
  PAYMENT_WEBHOOK_SECRET: Joi.string().required(),

  SENTRY_DSN: Joi.string().allow("").optional(),
});
