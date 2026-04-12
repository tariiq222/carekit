import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchFile,
  fetchFiles,
  deleteFile,
  fetchPresignedUrl,
  type ListFilesQuery,
} from "@/lib/api/media"

export const mediaKeys = {
  all: ["media"] as const,
  files: (query: ListFilesQuery) => ["media", "files", query] as const,
  file: (id: string) => ["media", id] as const,
  presigned: (id: string) => ["media", id, "presigned"] as const,
}

export function useMediaFiles(query: ListFilesQuery = {}) {
  return useQuery({
    queryKey: mediaKeys.files(query),
    queryFn: () => fetchFiles(query),
    staleTime: 60 * 1000,
  })
}

export function useMediaFile(id: string) {
  return useQuery({
    queryKey: mediaKeys.file(id),
    queryFn: () => fetchFile(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePresignedUrl(id: string, expirySeconds?: number) {
  return useQuery({
    queryKey: mediaKeys.presigned(id),
    queryFn: () => fetchPresignedUrl(id, { expirySeconds }),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

export function useDeleteFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all })
    },
  })
}
