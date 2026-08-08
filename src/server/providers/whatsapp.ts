export type WhatsAppMessage = {
  to: string;
  body: string;
  templateName?: string;
  templateParams?: Record<string, string>;
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
};

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export interface WhatsAppProvider {
  readonly name: string;
  send(message: WhatsAppMessage): Promise<WhatsAppSendResult>;
}

export class ConsoleWhatsAppProvider implements WhatsAppProvider {
  readonly name = "console-whatsapp";

  async send(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    const messageId = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.info("[WhatsAppProvider]", {
      provider: this.name,
      messageId,
      to: message.to,
      body: message.body,
      templateName: message.templateName,
      templateParams: message.templateParams,
      mediaUrl: message.mediaUrl,
      metadata: message.metadata,
    });
    return { success: true, messageId };
  }
}

export const whatsappProvider: WhatsAppProvider = new ConsoleWhatsAppProvider();
