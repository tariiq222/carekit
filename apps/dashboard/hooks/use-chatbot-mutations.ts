"use client"

// Stubs — TODO: no backend chatbot mutation endpoints yet

function stub<T = Record<string, unknown>>(defaultVal: T = {} as T) {
  return {
    mutate: (_arg?: unknown) => {},
    mutateAsync: async (_arg?: unknown): Promise<T> => defaultVal,
    isPending: false,
  }
}

export function useChatbotMutations() {
  return {
    createSessionMut: stub(),
    endSessionMut: stub(),
    sendMessageMut: stub(),
    staffMsgMut: stub(),
    createKbEntryMut: stub(),
    updateKbEntryMut: stub(),
    deleteKbEntryMut: stub(),
    syncKbMut: stub({ synced: 0 }),
    uploadFileMut: stub(),
    processFileMut: stub(),
    deleteFileMut: stub(),
    updateConfigMut: stub(),
    seedDefaultsMut: stub(),
  }
}
