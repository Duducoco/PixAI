import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { safeStorage } from 'electron'
import {
  DEFAULT_API_PROVIDER,
  getModelProvider,
  getProviderBaseURL,
  getProviderDefaultModel,
  normalizeApiProvider,
  normalizeProviderModel
} from '@shared/image-options'
import { DEFAULT_PROMPT_MODEL } from '@shared/prompt-options'
import type { ApiProvider, ProviderSettings, ProviderSettingsUpdate } from '@shared/types'

type SettingsFile = {
  provider: ApiProvider
  baseURL: string
  defaultModel: string
  promptModel: string
  encryptedApiKey?: string
  plainApiKey?: string
  insecureStorage?: boolean
}

const defaultSettings: SettingsFile = {
  provider: DEFAULT_API_PROVIDER,
  baseURL: getProviderBaseURL(DEFAULT_API_PROVIDER),
  defaultModel: getProviderDefaultModel(DEFAULT_API_PROVIDER),
  promptModel: DEFAULT_PROMPT_MODEL,
  insecureStorage: false
}

export class SettingsStore {
  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true })
  }

  getPublicSettings(): ProviderSettings {
    const settings = this.read()
    return {
      provider: settings.provider,
      baseURL: settings.baseURL,
      defaultModel: settings.defaultModel,
      promptModel: settings.promptModel,
      apiKeyStored: Boolean(settings.encryptedApiKey || settings.plainApiKey),
      insecureStorage: Boolean(settings.insecureStorage)
    }
  }

  getApiKey(): string | null {
    const settings = this.read()
    if (settings.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(settings.encryptedApiKey, 'base64'))
    }
    return settings.plainApiKey || null
  }

  update(input: ProviderSettingsUpdate): ProviderSettings {
    const current = this.read()
    const provider = input.provider !== undefined ? normalizeApiProvider(input.provider) : current.provider
    const next: SettingsFile = {
      ...current,
      provider,
      ...(input.baseURL !== undefined ? { baseURL: input.baseURL.trim().replace(/\/+$/, '') || getProviderBaseURL(provider) } : {}),
      ...(input.provider !== undefined && input.baseURL === undefined ? { baseURL: getProviderBaseURL(provider) } : {}),
      ...(input.defaultModel !== undefined
        ? { defaultModel: normalizeProviderModel(provider, input.defaultModel) }
        : input.provider !== undefined
          ? { defaultModel: normalizeProviderModel(provider, current.defaultModel) }
          : {}),
      ...(input.promptModel !== undefined ? { promptModel: input.promptModel.trim() || DEFAULT_PROMPT_MODEL } : {})
    }

    if (input.apiKey !== undefined) {
      const key = input.apiKey?.trim() || ''
      delete next.encryptedApiKey
      delete next.plainApiKey
      next.insecureStorage = false
      if (key && safeStorage.isEncryptionAvailable()) {
        next.encryptedApiKey = safeStorage.encryptString(key).toString('base64')
      } else if (key) {
        next.plainApiKey = key
        next.insecureStorage = true
      }
    }

    this.write(next)
    return this.getPublicSettings()
  }

  private read(): SettingsFile {
    if (!existsSync(this.filePath)) return defaultSettings
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<SettingsFile>
      const provider = parsed.provider ? normalizeApiProvider(parsed.provider) : getModelProvider(parsed.defaultModel || defaultSettings.defaultModel)
      return {
        ...defaultSettings,
        ...parsed,
        provider,
        baseURL: parsed.baseURL || getProviderBaseURL(provider),
        defaultModel: normalizeProviderModel(provider, parsed.defaultModel || getProviderDefaultModel(provider)),
        promptModel: parsed.promptModel || DEFAULT_PROMPT_MODEL
      }
    } catch {
      return defaultSettings
    }
  }

  private write(settings: SettingsFile): void {
    writeFileSync(this.filePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  }
}
