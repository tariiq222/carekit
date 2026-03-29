"use client"

/**
 * Chatbot Mutations Hook — CareKit Dashboard
 *
 * All chatbot-related TanStack Query mutations in one place:
 * sessions, knowledge base, files, config, and staff messages.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createChatSession,
  endChatSession,
  sendChatMessage,
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  syncKnowledgeBase,
  uploadKnowledgeFile,
  processKnowledgeFile,
  deleteKnowledgeFile,
  updateChatbotConfig,
  seedChatbotDefaults,
  sendStaffMessage,
} from "@/lib/api/chatbot"

export function useChatbotMutations() {
  const qc = useQueryClient()

  const invalidateSessions = () =>
    qc.invalidateQueries({ queryKey: queryKeys.chatbot.sessions.all })
  const invalidateKb = () =>
    qc.invalidateQueries({ queryKey: queryKeys.chatbot.knowledgeBase.all })
  const invalidateFiles = () =>
    qc.invalidateQueries({ queryKey: queryKeys.chatbot.files.all })
  const invalidateConfig = () =>
    qc.invalidateQueries({ queryKey: queryKeys.chatbot.config.all })

  const createSessionMut = useMutation({
    mutationFn: createChatSession,
    onSuccess: invalidateSessions,
  })

  const endSessionMut = useMutation({
    mutationFn: endChatSession,
    onSuccess: invalidateSessions,
  })

  const sendMessageMut = useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      sendChatMessage(sessionId, content),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({
        queryKey: queryKeys.chatbot.sessions.detail(vars.sessionId),
      }),
  })

  const createKbEntryMut = useMutation({
    mutationFn: createKnowledgeEntry,
    onSuccess: invalidateKb,
  })

  const updateKbEntryMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateKnowledgeEntry>[1]) =>
      updateKnowledgeEntry(id, payload),
    onSuccess: invalidateKb,
  })

  const deleteKbEntryMut = useMutation({
    mutationFn: deleteKnowledgeEntry,
    onSuccess: invalidateKb,
  })

  const syncKbMut = useMutation({
    mutationFn: syncKnowledgeBase,
    onSuccess: invalidateKb,
  })

  const uploadFileMut = useMutation({
    mutationFn: uploadKnowledgeFile,
    onSuccess: invalidateFiles,
  })

  const processFileMut = useMutation({
    mutationFn: processKnowledgeFile,
    onSuccess: invalidateFiles,
  })

  const deleteFileMut = useMutation({
    mutationFn: deleteKnowledgeFile,
    onSuccess: invalidateFiles,
  })

  const updateConfigMut = useMutation({
    mutationFn: updateChatbotConfig,
    onSuccess: invalidateConfig,
  })

  const seedDefaultsMut = useMutation({
    mutationFn: seedChatbotDefaults,
    onSuccess: invalidateConfig,
  })

  const staffMsgMut = useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      sendStaffMessage(sessionId, content),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({
        queryKey: queryKeys.chatbot.sessions.detail(vars.sessionId),
      }),
  })

  return {
    createSessionMut,
    endSessionMut,
    sendMessageMut,
    staffMsgMut,
    createKbEntryMut,
    updateKbEntryMut,
    deleteKbEntryMut,
    syncKbMut,
    uploadFileMut,
    processFileMut,
    deleteFileMut,
    updateConfigMut,
    seedDefaultsMut,
  }
}
