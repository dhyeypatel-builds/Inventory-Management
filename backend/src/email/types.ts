/** A fully-rendered email, ready to hand to any transport. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** A transport delivers a rendered message. Implementations: dev (disk), smtp. */
export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}
