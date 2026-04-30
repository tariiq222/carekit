/**
 * Media API — Deqah Dashboard
 * Controller: dashboard/media
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"

export interface MediaFile {
  id: string
  bucket: string
  storageKey: string
  filename: string
  mimetype: string
  size: number
  visibility: string
  ownerType?: string
  ownerId?: string
  uploadedBy?: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface UploadFilePayload {
  visibility?: string
  ownerType?: string
  ownerId?: string
  uploadedBy?: string
}

export interface PresignedUrlResponse {
  url: string
  expiresAt: string
}

export interface ListFilesQuery {
  page?: number
  limit?: number
}

export async function fetchFile(id: string): Promise<MediaFile> {
  return api.get<MediaFile>(`/dashboard/media/${id}`)
}

export async function fetchFiles(
  query: ListFilesQuery = {},
): Promise<PaginatedResponse<MediaFile>> {
  return api.get<PaginatedResponse<MediaFile>>("/dashboard/media", {
    page: query.page,
    limit: query.limit,
  })
}

export async function deleteFile(id: string): Promise<void> {
  await api.delete(`/dashboard/media/${id}`)
}

export async function fetchPresignedUrl(
  id: string,
  query: { expirySeconds?: number } = {},
): Promise<PresignedUrlResponse> {
  return api.get<PresignedUrlResponse>(
    `/dashboard/media/${id}/presigned-url`,
    query,
  )
}
