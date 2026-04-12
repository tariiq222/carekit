"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  syncKnowledgeBase,
  uploadKnowledgeFile,
  processKnowledgeFile,
  deleteKnowledgeFile,
} from "@/lib/api/chatbot-kb"
import type { CreateKbEntryPayload, UpdateKbEntryPayload } from "@/lib/types/chatbot"

function stub<T = Record<string, unknown>>(defaultVal: T = {} as T) {
  return {
    mutate: (_arg?: unknown) => {},
    mutateAsync: async (_arg?: unknown): Promise<T> => defaultVal,
    isPending: false,
  }
}

export function useChatbotMutations() {
  const qc = useQueryClient()

  const invalidateKb = () => qc.invalidateQueries({ queryKey: queryKeys.chatbot.knowledgeBase.all })
  const invalidateFiles = () => qc.invalidateQueries({ queryKey: queryKeys.chatbot.files.all })

  const createKbEntryMut = useMutation({
    mutationFn: (payload: CreateKbEntryPayload) => createKnowledgeEntry(payload),
    onSuccess: invalidateKb,
  })

  const updateKbEntryMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateKbEntryPayload }) =>
      updateKnowledgeEntry(id, payload),
    onSuccess: invalidateKb,
  })

  const deleteKbEntryMut = useMutation({
    mutationFn: (id: string) => deleteKnowledgeEntry(id),
    onSuccess: invalidateKb,
  })

  const syncKbMut = useMutation({
    mutationFn: () => syncKnowledgeBase(),
    onSuccess: invalidateKb,
  })

  const uploadFileMut = useMutation({
    mutationFn: (file: File) => uploadKnowledgeFile(file),
    onSuccess: invalidateFiles,
  })

  const processFileMut = useMutation({
    mutationFn: (id: string) => processKnowledgeFile(id),
    onSuccess: invalidateFiles,
  })

  const deleteFileMut = useMutation({
    mutationFn: (id: string) => deleteKnowledgeFile(id),
    onSuccess: invalidateFiles,
  })

  return {
    // Session stubs — no backend endpoints
    createSessionMut: stub(),
    endSessionMut: stub(),
    sendMessageMut: stub(),
    staffMsgMut: stub(),

    // KB mutations
    createKbEntryMut,
    updateKbEntryMut,
    deleteKbEntryMut,
    syncKbMut,

    // File mutations
    uploadFileMut,
    processFileMut,
    deleteFileMut,

    // Config stubs — no backend endpoints
    updateConfigMut: stub(),
    seedDefaultsMut: stub(),
  }
}
