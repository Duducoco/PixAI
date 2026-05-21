import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
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
import type {
  ApiProvider,
  ProviderProfile,
  ProviderProfileCreateInput,
  ProviderSettings,
  ProviderSettingsUpdate
} from '@shared/types'

type SettingsProfileFile = {
  id: string
  name: string
  provider: ApiProvider
  baseURL: string
  defaultModel: string
  promptModel: string
  encryptedApiKey?: string
  plainApiKey?: string
  insecureStorage?: boolean
}

type SettingsFile = {
  activeProfileId: string
  profiles: SettingsProfileFile[]
}

type LegacySettingsFile = Partial<SettingsProfileFile> & {
  activeProfileId?: unknown
  profiles?: unknown
}

const DEFAULT_PROFILE_ID = 'default-gpt'

function createDefaultProfile(): SettingsProfileFile {
  return {
    id: DEFAULT_PROFILE_ID,
    name: 'GPT 默认',
    provider: DEFAULT_API_PROVIDER,
    baseURL: getProviderBaseURL(DEFAULT_API_PROVIDER),
    defaultModel: getProviderDefaultModel(DEFAULT_API_PROVIDER),
    promptModel: DEFAULT_PROMPT_MODEL,
    insecureStorage: false
  }
}

const defaultSettings: SettingsFile = {
  activeProfileId: DEFAULT_PROFILE_ID,
  profiles: [createDefaultProfile()]
}

export class SettingsStore {
  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true })
  }

  getPublicSettings(): ProviderSettings {
    return toPublicSettings(this.read())
  }

  getApiKey(): string | null {
    const settings = this.read()
    const active = getActiveProfile(settings)
    if (active.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(active.encryptedApiKey, 'base64'))
    }
    return active.plainApiKey || null
  }

  update(input: ProviderSettingsUpdate): ProviderSettings {
    const current = this.read()
    const active = getActiveProfile(current)
    const updatedActive = applyProfileUpdate(active, input)
    const next = {
      ...current,
      profiles: current.profiles.map((profile) => (profile.id === active.id ? updatedActive : profile))
    }

    this.write(next)
    return this.getPublicSettings()
  }

  createProfile(input: ProviderProfileCreateInput = {}): ProviderSettings {
    const current = this.read()
    const provider = input.provider !== undefined ? normalizeApiProvider(input.provider) : DEFAULT_API_PROVIDER
    const baseProfile: SettingsProfileFile = {
      id: `profile-${randomUUID()}`,
      name: '',
      provider,
      baseURL: getProviderBaseURL(provider),
      defaultModel: getProviderDefaultModel(provider),
      promptModel: DEFAULT_PROMPT_MODEL,
      insecureStorage: false
    }
    const profile = applyProfileUpdate(baseProfile, {
      ...input,
      name: input.name || defaultProfileName(provider, current.profiles)
    })
    const next = {
      activeProfileId: profile.id,
      profiles: [profile, ...current.profiles]
    }

    this.write(next)
    return this.getPublicSettings()
  }

  selectProfile(id: string): ProviderSettings {
    const current = this.read()
    if (!current.profiles.some((profile) => profile.id === id)) {
      throw new Error('Service profile not found.')
    }
    this.write({ ...current, activeProfileId: id })
    return this.getPublicSettings()
  }

  deleteProfile(id: string): ProviderSettings {
    const current = this.read()
    if (current.profiles.length <= 1) {
      throw new Error('At least one service profile is required.')
    }
    const nextProfiles = current.profiles.filter((profile) => profile.id !== id)
    if (nextProfiles.length === current.profiles.length) {
      throw new Error('Service profile not found.')
    }
    const activeProfileId = current.activeProfileId === id ? nextProfiles[0].id : current.activeProfileId
    this.write({ activeProfileId, profiles: nextProfiles })
    return this.getPublicSettings()
  }

  private read(): SettingsFile {
    if (!existsSync(this.filePath)) return defaultSettings
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as LegacySettingsFile
      return normalizeSettingsFile(parsed)
    } catch {
      return defaultSettings
    }
  }

  private write(settings: SettingsFile): void {
    writeFileSync(this.filePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  }
}

function applyProfileUpdate(profile: SettingsProfileFile, input: ProviderSettingsUpdate): SettingsProfileFile {
  const provider = input.provider !== undefined ? normalizeApiProvider(input.provider) : profile.provider
  const next: SettingsProfileFile = {
    ...profile,
    provider,
    ...(input.name !== undefined ? { name: input.name.trim() || profile.name } : {}),
    ...(input.baseURL !== undefined ? { baseURL: input.baseURL.trim().replace(/\/+$/, '') || getProviderBaseURL(provider) } : {}),
    ...(input.provider !== undefined && input.baseURL === undefined ? { baseURL: getProviderBaseURL(provider) } : {}),
    ...(input.defaultModel !== undefined
      ? { defaultModel: normalizeProviderModel(provider, input.defaultModel) }
      : input.provider !== undefined
        ? { defaultModel: normalizeProviderModel(provider, profile.defaultModel) }
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

  return next
}

function normalizeSettingsFile(parsed: LegacySettingsFile): SettingsFile {
  const rawProfiles = Array.isArray(parsed.profiles) ? parsed.profiles : [parsed]
  const profiles = rawProfiles
    .map((profile, index) => normalizeProfile(profile, index))
    .filter((profile): profile is SettingsProfileFile => profile != null)
  const normalizedProfiles = profiles.length > 0 ? profiles : [createDefaultProfile()]
  const activeProfileId = typeof parsed.activeProfileId === 'string'
    && normalizedProfiles.some((profile) => profile.id === parsed.activeProfileId)
    ? parsed.activeProfileId
    : normalizedProfiles[0].id

  return {
    activeProfileId,
    profiles: normalizedProfiles
  }
}

function normalizeProfile(input: unknown, index: number): SettingsProfileFile | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Partial<SettingsProfileFile>
  const provider = record.provider
    ? normalizeApiProvider(record.provider)
    : getModelProvider(record.defaultModel || getProviderDefaultModel(DEFAULT_API_PROVIDER))
  const id = safeText(record.id) || (index === 0 ? DEFAULT_PROFILE_ID : `profile-${index}`)
  const fallbackName = defaultProfileName(provider, [])
  return {
    id,
    name: safeText(record.name) || fallbackName,
    provider,
    baseURL: safeText(record.baseURL) || getProviderBaseURL(provider),
    defaultModel: normalizeProviderModel(provider, record.defaultModel || getProviderDefaultModel(provider)),
    promptModel: safeText(record.promptModel) || DEFAULT_PROMPT_MODEL,
    encryptedApiKey: safeText(record.encryptedApiKey) || undefined,
    plainApiKey: safeText(record.plainApiKey) || undefined,
    insecureStorage: Boolean(record.insecureStorage)
  }
}

function toPublicSettings(settings: SettingsFile): ProviderSettings {
  const active = getActiveProfile(settings)
  return {
    ...toPublicProfile(active),
    activeProfileId: active.id,
    profiles: settings.profiles.map(toPublicProfile)
  }
}

function toPublicProfile(profile: SettingsProfileFile): ProviderProfile {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    baseURL: profile.baseURL,
    defaultModel: profile.defaultModel,
    promptModel: profile.promptModel,
    apiKeyStored: Boolean(profile.encryptedApiKey || profile.plainApiKey),
    insecureStorage: Boolean(profile.insecureStorage)
  }
}

function getActiveProfile(settings: SettingsFile): SettingsProfileFile {
  return settings.profiles.find((profile) => profile.id === settings.activeProfileId) || settings.profiles[0] || createDefaultProfile()
}

function defaultProfileName(provider: ApiProvider, profiles: SettingsProfileFile[]): string {
  const base = provider === 'gemini' ? 'Gemini' : 'GPT'
  const existingCount = profiles.filter((profile) => profile.provider === provider).length
  return existingCount === 0 ? `${base} 默认` : `${base} ${existingCount + 1}`
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
