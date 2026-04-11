export interface SendEmailDto {
  tenantId: string;
  to: string;
  templateSlug: string;
  vars: Record<string, string>;
}
