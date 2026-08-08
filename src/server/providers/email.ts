export type EmailMessage = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  metadata?: Record<string, unknown>;
};

export type EmailSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console-email";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const messageId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.info("[EmailProvider]", {
      provider: this.name,
      messageId,
      to: message.to,
      subject: message.subject,
      cc: message.cc,
      bcc: message.bcc,
      replyTo: message.replyTo,
      hasHtml: Boolean(message.html),
      hasText: Boolean(message.text),
      metadata: message.metadata,
    });
    return { success: true, messageId };
  }
}

export const emailProvider: EmailProvider = new ConsoleEmailProvider();
