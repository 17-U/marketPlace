export const EMAIL_CHANNEL = "EMAIL_CHANNEL";

export interface EmailChannel {
  send(to: string, subject: string, body: string): Promise<void>;
}
