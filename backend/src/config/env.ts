import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // JWT
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Security
  AUTH_MAX_FAILED_LOGINS: z.coerce.number().int().positive().default(5),

  // CORS – comma-separated origins
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Seed / admin
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_FULL_NAME: z.string().optional(),

  // Platform admin (master admin — seeded; lives outside all tenants, Phase 2A/2B)
  PLATFORM_ADMIN_EMAIL: z.string().email().optional(),
  PLATFORM_ADMIN_PASSWORD: z.string().min(8).optional(),
  PLATFORM_ADMIN_FULL_NAME: z.string().optional(),

  // Public URLs (used to build invite/login links in emails)
  APP_URL: z.string().url().default('http://localhost:3000'),

  // Email (Phase 2C). EMAIL_TRANSPORT=dev writes rendered mail to disk and logs;
  // =smtp sends via any SMTP provider (Resend/Postmark/SES). Prod must use smtp.
  EMAIL_TRANSPORT: z.enum(['dev', 'smtp']).default('dev'),
  EMAIL_FROM: z.string().default('TyreStock <no-reply@tyrestock.app>'),
  EMAIL_DEV_DIR: z.string().default('tmp/emails'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // File storage (Phase 2C). STORAGE_TRANSPORT=local writes under STORAGE_LOCAL_DIR
  // (dev); =s3 targets an S3/R2 bucket (prod — wired later). Used by logo upload.
  STORAGE_TRANSPORT: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('uploads'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),

  // Headless Chrome for branded PDF rendering (Phase 2D). If unset, the renderer
  // probes common install paths; the backend Docker image installs Chromium.
  CHROME_PATH: z.string().optional(),
})
  .superRefine((cfg, ctx) => {
    // If SMTP transport is selected, its connection settings become required.
    if (cfg.EMAIL_TRANSPORT === 'smtp') {
      for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] as const) {
        if (!cfg[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when EMAIL_TRANSPORT=smtp`,
          });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print field-level errors and abort – do not catch this in production
  console.error('\n❌  Invalid environment variables:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nCopy .env.example → .env and fill in the required values.\n');
  process.exit(1);
}

export const env = parsed.data;
