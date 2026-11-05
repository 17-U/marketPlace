export const SMS_PROVIDER = "SMS_PROVIDER";

export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}
