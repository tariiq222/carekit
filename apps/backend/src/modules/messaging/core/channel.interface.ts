import type { MessagingEvent } from './messaging-events.js';

export interface ChannelSendPayload {
  userId: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  data?: Record<string, string>;
  event: MessagingEvent;
  /** Direct recipient email — provided by dispatcher when resolved */
  recipientEmail?: string;
}

export interface ChannelSendResult {
  ok: boolean;
  skipped?: 'user_opt_out' | 'channel_disabled' | 'no_address' | 'no_token';
  error?: string;
}

export interface Channel {
  readonly name: 'push' | 'email' | 'sms';
  send(payload: ChannelSendPayload): Promise<ChannelSendResult>;
  isEnabled(): boolean;
}
