export interface ListDocumentsDto {
  tenantId: string;
  page?: number;
  limit?: number;
  status?: 'PENDING' | 'EMBEDDED' | 'FAILED';
}

export interface GetDocumentDto {
  tenantId: string;
  documentId: string;
}

export interface DeleteDocumentDto {
  tenantId: string;
  documentId: string;
}

export interface UpdateDocumentDto {
  tenantId: string;
  documentId: string;
  title?: string;
  metadata?: Record<string, unknown>;
}
