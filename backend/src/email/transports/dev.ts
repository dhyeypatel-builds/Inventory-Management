import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import type { EmailMessage, EmailTransport } from '../types';

/**
 * Development transport: writes each rendered email to disk (one .html file) and
 * logs its subject/recipient. Lets the full OTP/invite flow run locally with no
 * provider account. The output dir is resolved relative to the backend cwd.
 */
export class DevEmailTransport implements EmailTransport {
  readonly name = 'dev';
  private readonly dir = resolve(process.cwd(), env.EMAIL_DEV_DIR);

  async send(message: EmailMessage): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTo = message.to.replace(/[^a-z0-9@._-]/gi, '_');
    const file = join(this.dir, `${stamp}__${safeTo}.html`);
    await writeFile(file, message.html, 'utf8');

    // Persist attachments next to the HTML so the full flow (e.g. invoice PDF)
    // can be inspected locally without an SMTP provider.
    const attachmentFiles: string[] = [];
    for (const att of message.attachments ?? []) {
      const safeName = att.filename.replace(/[^a-z0-9._-]/gi, '_');
      const attFile = join(this.dir, `${stamp}__${safeTo}__${safeName}`);
      await writeFile(attFile, att.content);
      attachmentFiles.push(attFile);
    }

    logger.info(
      { to: message.to, subject: message.subject, file, attachments: attachmentFiles },
      '📧 [dev email] written to disk',
    );
  }
}
