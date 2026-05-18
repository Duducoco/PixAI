import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Conversation } from '@shared/types'
import { useAppStore } from './app-store'

describe('app store conversation defaults', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    useAppStore.setState({
      conversations: [],
      activeConversationId: null,
      runsByConversation: {},
      toast: null
    })
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true
    })
    vi.restoreAllMocks()
  })

  it('creates a new conversation with the active conversation image settings', async () => {
    const active = createConversation({ id: 'old', ratio: '9:16', size: '2160x3840', quality: 'medium' })
    const created = createConversation({ id: 'new', ratio: '9:16', size: '2160x3840', quality: 'medium' })
    const create = vi.fn(() => Promise.resolve(created))
    installWindow({ create })
    useAppStore.setState({
      conversations: [active],
      activeConversationId: active.id,
      runsByConversation: { [active.id]: [] },
      toast: null
    })

    await useAppStore.getState().createConversation()

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      ratio: '9:16',
      size: '2160x3840',
      quality: 'medium',
      model: 'gpt-image-2',
      n: 1,
      outputFormat: 'png',
      outputCompression: null,
      background: 'auto',
      moderation: 'auto',
      stream: false,
      partialImages: 0,
      inputFidelity: null,
      referenceImageMode: 'combined',
      maxRetries: 0,
      generationTimeoutSeconds: 300,
      autoSaveHistory: true,
      keepFailureDetails: false
    }))
    expect(useAppStore.getState().activeConversationId).toBe('new')
    expect(useAppStore.getState().conversations[0]).toMatchObject({
      id: 'new',
      ratio: '9:16',
      size: '2160x3840',
      quality: 'medium'
    })
  })

  it('uses the configured provider model when creating a conversation from an incompatible active model', async () => {
    const active = createConversation({ id: 'old', model: 'gpt-image-2', ratio: '1:1', size: '1024x1024' })
    const created = createConversation({
      id: 'new',
      model: 'gemini-3-pro-image-preview',
      ratio: '1:1',
      size: '4K'
    })
    const create = vi.fn(() => Promise.resolve(created))
    installWindow({ create })
    useAppStore.setState({
      settings: {
        provider: 'gemini',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        apiKeyStored: true,
        defaultModel: 'gemini-3-pro-image-preview',
        promptModel: 'gemini-3.1-flash',
        insecureStorage: false
      },
      conversations: [active],
      activeConversationId: active.id,
      runsByConversation: { [active.id]: [] },
      toast: null
    })

    await useAppStore.getState().createConversation()

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3-pro-image-preview',
      size: '4K'
    }))
  })

  it('uses the standard resolution when changing ratios without an explicit size', async () => {
    const active = createConversation({ id: 'c1', ratio: '16:9', size: '3840x2160', quality: 'high' })
    const update = vi.fn((_id: string, input: Partial<Conversation>) => Promise.resolve({ ...active, ...input }))
    installWindow({ update })
    useAppStore.setState({
      conversations: [active],
      activeConversationId: active.id,
      toast: null
    })

    await useAppStore.getState().updateActiveConversation({ ratio: '9:16' })

    expect(update).toHaveBeenCalledWith(active.id, { ratio: '9:16', size: '1008x1792' })
    expect(useAppStore.getState().conversations[0]).toMatchObject({
      ratio: '9:16',
      size: '1008x1792'
    })
  })

  it('passes the active conversation retry count into image generation', async () => {
    const active = createConversation({ id: 'c1', draftPrompt: 'prompt', maxRetries: 3 })
    const generate = vi.fn(() => Promise.resolve({
      run: {
        id: 'run-1',
        conversationId: active.id,
        prompt: 'prompt',
        model: active.model,
        ratio: active.ratio,
        size: active.size,
        quality: active.quality,
        n: active.n,
        status: 'succeeded',
        durationMs: 1000,
        errorMessage: null,
        errorDetails: null,
        maxRetries: 3,
        retryAttempts: {},
        retryFailures: {},
        generationMode: 'text-to-image',
        referenceImages: [],
        createdAt: '2026-05-10T00:00:01.000Z',
        items: []
      },
      items: []
    }))
    installWindow({
      update: vi.fn((_id: string, input: Partial<Conversation>) => Promise.resolve({ ...active, ...input })),
      runs: vi.fn(() => Promise.resolve([])),
      generate,
      historyList: vi.fn(() => Promise.resolve([]))
    })
    useAppStore.setState({
      settings: { provider: 'gpt', baseURL: 'https://example.test', apiKeyStored: true, defaultModel: 'gpt-image-2', promptModel: 'gpt-5.4-mini', insecureStorage: false },
      conversations: [active],
      activeConversationId: active.id,
      runsByConversation: { [active.id]: [] },
      history: [],
      query: '',
      sort: 'newest',
      favoritesOnly: false,
      toast: null
    })

    await useAppStore.getState().generate()

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: active.id,
      prompt: 'prompt',
      maxRetries: 3,
      generationTimeoutSeconds: 300
    }))
  })

  it('generates with the configured provider model when the active conversation has an incompatible model', async () => {
    const active = createConversation({
      id: 'c1',
      draftPrompt: 'prompt',
      model: 'gpt-image-2',
      size: '1024x1024'
    })
    const generate = vi.fn(() => Promise.resolve({
      run: {
        id: 'run-1',
        conversationId: active.id,
        prompt: 'prompt',
        model: 'gemini-3-pro-image-preview',
        ratio: active.ratio,
        size: '4K',
        quality: active.quality,
        n: active.n,
        status: 'succeeded',
        durationMs: 1000,
        errorMessage: null,
        errorDetails: null,
        maxRetries: active.maxRetries,
        retryAttempts: {},
        retryFailures: {},
        generationMode: 'text-to-image',
        referenceImages: [],
        createdAt: '2026-05-10T00:00:01.000Z',
        items: []
      },
      items: []
    }))
    installWindow({
      update: vi.fn((_id: string, input: Partial<Conversation>) => Promise.resolve({ ...active, ...input })),
      runs: vi.fn(() => Promise.resolve([])),
      generate,
      historyList: vi.fn(() => Promise.resolve([]))
    })
    useAppStore.setState({
      settings: {
        provider: 'gemini',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        apiKeyStored: true,
        defaultModel: 'gemini-3-pro-image-preview',
        promptModel: 'gemini-3.1-flash',
        insecureStorage: false
      },
      conversations: [active],
      activeConversationId: active.id,
      runsByConversation: { [active.id]: [] },
      history: [],
      query: '',
      sort: 'newest',
      favoritesOnly: false,
      toast: null
    })

    await useAppStore.getState().generate()

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3-pro-image-preview',
      size: '4K'
    }))
  })

  it('passes per-reference reference mode into image generation', async () => {
    const active = createConversation({
      id: 'c1',
      draftPrompt: 'black and white',
      n: 2,
      referenceImageMode: 'per-reference',
      referenceImages: [
        {
          id: 'ref-1',
          name: 'first.png',
          mimeType: 'image/png',
          filePath: 'first.png',
          fileSizeBytes: 10,
          createdAt: '2026-05-10T00:00:00.000Z'
        },
        {
          id: 'ref-2',
          name: 'second.png',
          mimeType: 'image/png',
          filePath: 'second.png',
          fileSizeBytes: 10,
          createdAt: '2026-05-10T00:00:00.000Z'
        }
      ]
    })
    const generate = vi.fn(() => Promise.resolve({
      run: {
        id: 'run-1',
        conversationId: active.id,
        prompt: 'black and white',
        model: active.model,
        ratio: active.ratio,
        size: active.size,
        quality: active.quality,
        n: 4,
        status: 'succeeded',
        durationMs: 1000,
        errorMessage: null,
        errorDetails: null,
        maxRetries: 0,
        retryAttempts: {},
        retryFailures: {},
        generationMode: 'image-to-image',
        referenceImages: active.referenceImages,
        createdAt: '2026-05-10T00:00:01.000Z',
        items: []
      },
      items: []
    }))
    installWindow({
      update: vi.fn((_id: string, input: Partial<Conversation>) => Promise.resolve({ ...active, ...input })),
      runs: vi.fn(() => Promise.resolve([])),
      generate,
      historyList: vi.fn(() => Promise.resolve([]))
    })
    useAppStore.setState({
      settings: { provider: 'gpt', baseURL: 'https://example.test', apiKeyStored: true, defaultModel: 'gpt-image-2', promptModel: 'gpt-5.4-mini', insecureStorage: false },
      conversations: [active],
      activeConversationId: active.id,
      runsByConversation: { [active.id]: [] },
      history: [],
      query: '',
      sort: 'newest',
      favoritesOnly: false,
      toast: null
    })

    await useAppStore.getState().generate()

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      n: 2,
      referenceImageIds: ['ref-1', 'ref-2'],
      referenceImageMode: 'per-reference'
    }))
  })
})

function installWindow(conversation: {
  create?: ReturnType<typeof vi.fn>
  update?: ReturnType<typeof vi.fn>
  runs?: ReturnType<typeof vi.fn>
  generate?: ReturnType<typeof vi.fn>
  historyList?: ReturnType<typeof vi.fn>
}): void {
  Object.defineProperty(globalThis, 'window', {
    value: {
      setTimeout: globalThis.setTimeout,
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
      pixai: {
        conversation: {
          ...conversation,
          runs: conversation.runs
        },
        image: {
          generate: conversation.generate
        },
        history: {
          list: conversation.historyList
        }
      }
    },
    configurable: true
  })
}

function createConversation(input: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    title: '新会话',
    draftPrompt: '',
    model: 'gpt-image-2',
    ratio: '1:1',
    size: '1024x1024',
    quality: 'auto',
    n: 1,
    outputFormat: 'png',
    outputCompression: null,
    background: 'auto',
    moderation: 'auto',
    stream: false,
    partialImages: 0,
    inputFidelity: null,
    referenceImageMode: 'combined',
    maxRetries: 0,
    generationTimeoutSeconds: 300,
    autoSaveHistory: true,
    keepFailureDetails: false,
    referenceImages: [],
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
    ...input
  }
}
