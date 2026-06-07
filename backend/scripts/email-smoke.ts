/**
 * SMTP smoke test — sends one real email using the configured transport.
 * Reads backend/.env. Usage:
 *   npx tsx scripts/email-smoke.ts            # sends to SMTP_USER (yourself)
 *   npx tsx scripts/email-smoke.ts you@x.com  # sends to a specific address
 */
import 'dotenv/config';
import { getTransport, sendOtpEmail } from '../src/email';

async function main(): Promise<void> {
  const to = process.argv[2] ?? process.env.SMTP_USER;
  if (!to) {
    console.error('No recipient. Pass an address or set SMTP_USER in .env.');
    process.exit(1);
  }

  console.log(`Transport: ${getTransport().name}`);
  console.log(`Sending a test sign-in code to: ${to}`);

  const ok = await sendOtpEmail({ to, code: '123456', ttlMinutes: 10 });

  if (ok) {
    console.log('✅ Sent. Check the inbox (and spam) for the code email.');
  } else {
    console.error('❌ Send failed — check SMTP_HOST/PORT/USER/PASS and the server log above.');
    process.exit(1);
  }
}

main();
