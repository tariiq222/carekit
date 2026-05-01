/**
 * Email Template Types — Deqah Dashboard
 */

export interface EmailTemplate {
  id: string
  slug: string
  nameAr: string
  nameEn: string | null
  subjectAr: string
  subjectEn: string | null
  htmlBody: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateEmailTemplatePayload {
  nameAr?: string
  nameEn?: string
  subjectAr?: string
  subjectEn?: string
  htmlBody?: string
  isActive?: boolean
}

export interface TemplatePreviewPayload {
  context: Record<string, unknown>
  lang: "ar" | "en"
}

export interface TemplatePreviewResult {
  subject: string
  body: string
}
