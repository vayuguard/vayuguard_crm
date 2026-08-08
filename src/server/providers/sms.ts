export type SmsMessage = {
  to: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export type SmsSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

export class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console-sms";

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const messageId = `sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.info("[SmsProvider]", {
      provider: this.name,
      messageId,
      to: message.to,
      body: message.body,
      metadata: message.metadata,
    });
    return { success: true, messageId };
  }
}

export const smsProvider: SmsProvider = new ConsoleSmsProvider();
