/** A file attached to an email (e.g. an invoice PDF). */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

/** A fully-rendered email, ready to hand to any transport. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Address replies should go to (e.g. the shop's contact inbox). */
  replyTo?: string;
  attachments?: EmailAttachment[];
}

/** A transport delivers a rendered message. Implementations: dev (disk), smtp. */
export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}
