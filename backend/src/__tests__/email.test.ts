/**
 * Phase 2C EM-01/EM-02 — email abstraction + templates.
 */
import { sendEmail, sendOtpEmail, setTransport } from '../email';
import { renderOtpEmail } from '../email/templates/otp';
import { renderInviteEmail } from '../email/templates/invite';
import { renderWelcomeEmail } from '../email/templates/welcome';
import type { EmailMessage, EmailTransport } from '../email/types';

class CapturingTransport implements EmailTransport {
  readonly name = 'capture';
  sent: EmailMessage[] = [];
  shouldThrow = false;
  async send(message: EmailMessage): Promise<void> {
    if (this.shouldThrow) throw new Error('provider down');
    this.sent.push(message);
  }
}

afterEach(() => setTransport(null));

describe('email facade', () => {
  it('delivers a rendered message through the active transport', async () => {
    const capture = new CapturingTransport();
    setTransport(capture);

    const ok = await sendEmail({ to: 'a@b.test', subject: 'Hi', html: '<p>hi</p>', text: 'hi' });

    expect(ok).toBe(true);
    expect(capture.sent).toHaveLength(1);
    expect(capture.sent[0].subject).toBe('Hi');
  });

  it('is fail-soft: a transport error is swallowed and returns false', async () => {
    const capture = new CapturingTransport();
    capture.shouldThrow = true;
    setTransport(capture);

    const ok = await sendEmail({ to: 'a@b.test', subject: 'Hi', html: '<p>hi</p>', text: 'hi' });

    expect(ok).toBe(false);
  });

  it('high-level helpers render + send', async () => {
    const capture = new CapturingTransport();
    setTransport(capture);

    await sendOtpEmail({ to: 'owner@shop.test', code: '123456', ttlMinutes: 10 });

    expect(capture.sent).toHaveLength(1);
    expect(capture.sent[0].to).toBe('owner@shop.test');
    expect(capture.sent[0].html).toContain('123456');
  });
});

describe('email templates', () => {
  it('OTP template embeds the code and TTL in subject, html and text', () => {
    const msg = renderOtpEmail({ to: 'a@b.test', code: '482913', ttlMinutes: 10 });
    expect(msg.subject).toContain('482913');
    expect(msg.html).toContain('482913');
    expect(msg.text).toContain('482913');
    expect(msg.text).toContain('10 minutes');
  });

  it('invite template embeds the accept URL and shop name', () => {
    const url = 'https://app.tyrestock.test/invite/abc123';
    const msg = renderInviteEmail({
      to: 'owner@shop.test',
      shopName: 'Acme Tyres',
      inviteUrl: url,
      kind: 'owner',
      expiresAt: new Date('2026-07-01T00:00:00Z'),
    });
    expect(msg.html).toContain(url);
    expect(msg.text).toContain(url);
    expect(msg.html).toContain('Acme Tyres');
  });

  it('invite template escapes HTML in the shop name (no injection)', () => {
    const msg = renderInviteEmail({
      to: 'owner@shop.test',
      shopName: '<script>alert(1)</script>',
      inviteUrl: 'https://x.test/invite/t',
      kind: 'staff',
      expiresAt: new Date('2026-07-01T00:00:00Z'),
    });
    expect(msg.html).not.toContain('<script>alert(1)</script>');
    expect(msg.html).toContain('&lt;script&gt;');
  });

  it('welcome template embeds the shop name and app URL', () => {
    const msg = renderWelcomeEmail({
      to: 'owner@shop.test',
      shopName: 'Acme Tyres',
      appUrl: 'https://app.tyrestock.test',
    });
    expect(msg.html).toContain('Acme Tyres');
    expect(msg.html).toContain('https://app.tyrestock.test');
  });
});
