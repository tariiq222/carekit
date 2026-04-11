export interface SendPushDto {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
