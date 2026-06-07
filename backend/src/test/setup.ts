// Set test environment variables before any module is imported.
// This lets env.ts validate successfully without a real .env file in CI.
process.env.NODE_ENV = 'test';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/tyrestock_test';

process.env.JWT_ACCESS_SECRET =
  'test-access-secret-minimum-32-characters-long!!';
process.env.JWT_REFRESH_SECRET =
  'test-refresh-secret-minimum-32-characters-long!!';

process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.AUTH_MAX_FAILED_LOGINS = '5';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.PORT = '3002'; // avoid conflict with a running dev server

// Tests never send real email: force the dev transport regardless of a local
// .env that may select SMTP (and clear any inherited SMTP creds).
process.env.EMAIL_TRANSPORT = 'dev';
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
