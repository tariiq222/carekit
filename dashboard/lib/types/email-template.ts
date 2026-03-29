/**
 * Email Template Types — CareKit Dashboard
 */

export interface EmailTemplate {
  id: string
  slug: string
  nameAr: string
  nameEn: string
  subjectAr: string
  subjectEn: string
  bodyAr: string
  bodyEn: string
  variables: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateEmailTemplatePayload {
  subjectAr?: string
  subjectEn?: string
  bodyAr?: string
  bodyEn?: string
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
