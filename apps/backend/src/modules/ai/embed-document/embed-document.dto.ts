export interface EmbedDocumentDto {
  tenantId: string;
  title: string;
  content: string;
  sourceType: 'manual' | 'url' | 'file';
  sourceRef?: string;
  metadata?: Record<string, unknown>;
}
