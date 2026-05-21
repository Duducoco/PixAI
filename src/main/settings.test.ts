import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { SettingsStore } from './settings'

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString('utf8')
  }
}))

describe('settings store', () => {
  it('uses a separate default prompt assistant model', () => {
    const store = createStore()

    expect(store.getPublicSettings()).toMatchObject({
      id: 'default-gpt',
      name: 'GPT 默认',
      provider: 'gpt',
      baseURL: 'https://api.openai.com',
      defaultModel: 'gpt-image-2',
      promptModel: 'gpt-5.4-mini',
      activeProfileId: 'default-gpt',
      profiles: [
        expect.objectContaining({
          id: 'default-gpt',
          name: 'GPT 默认'
        })
      ]
    })
  })

  it('updates prompt model without changing image model', () => {
    const store = createStore()

    const settings = store.update({ promptModel: 'gpt-5.4' })

    expect(settings.defaultModel).toBe('gpt-image-2')
    expect(settings.promptModel).toBe('gpt-5.4')
    expect(store.getPublicSettings().promptModel).toBe('gpt-5.4')
  })

  it('switches provider defaults and normalizes image model choices', () => {
    const store = createStore()

    const geminiSettings = store.update({ provider: 'gemini' })

    expect(geminiSettings.provider).toBe('gemini')
    expect(geminiSettings.baseURL).toBe('https://generativelanguage.googleapis.com/v1beta')
    expect(geminiSettings.defaultModel).toBe('gemini-3.1-flash-image-preview')

    const gptSettings = store.update({ provider: 'gpt', defaultModel: 'gemini-2.5-flash-image' })

    expect(gptSettings.provider).toBe('gpt')
    expect(gptSettings.baseURL).toBe('https://api.openai.com')
    expect(gptSettings.defaultModel).toBe('gpt-image-2')
  })

  it('creates and selects service profiles', () => {
    const store = createStore()

    const created = store.createProfile({
      name: 'Gemini 工作',
      provider: 'gemini',
      apiKey: 'gemini-key'
    })

    expect(created).toMatchObject({
      name: 'Gemini 工作',
      provider: 'gemini',
      defaultModel: 'gemini-3.1-flash-image-preview',
      apiKeyStored: true
    })
    expect(created.profiles).toHaveLength(2)
    expect(store.getApiKey()).toBe('gemini-key')

    const gptProfile = created.profiles.find((profile) => profile.provider === 'gpt')
    expect(gptProfile).toBeTruthy()
    const selected = store.selectProfile(gptProfile!.id)

    expect(selected.provider).toBe('gpt')
    expect(store.getApiKey()).toBeNull()
  })

  it('updates and deletes the active service profile', () => {
    const store = createStore()
    const created = store.createProfile({ provider: 'gemini', name: 'Gemini 临时' })

    const updated = store.update({ name: 'Gemini 正式', promptModel: 'gemini-3.1-flash' })

    expect(updated.name).toBe('Gemini 正式')
    expect(updated.promptModel).toBe('gemini-3.1-flash')

    const afterDelete = store.deleteProfile(created.activeProfileId)

    expect(afterDelete.provider).toBe('gpt')
    expect(afterDelete.profiles).toHaveLength(1)
  })

  it('infers provider from old settings files without a provider field', () => {
    const filePath = createSettingsFile()
    writeFileSync(filePath, JSON.stringify({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      defaultModel: 'gemini-2.5-flash-image',
      promptModel: 'gpt-5.4-mini'
    }), 'utf8')

    const store = new SettingsStore(filePath)

    expect(store.getPublicSettings()).toMatchObject({
      provider: 'gemini',
      defaultModel: 'gemini-2.5-flash-image',
      profiles: [
        expect.objectContaining({
          provider: 'gemini',
          defaultModel: 'gemini-2.5-flash-image'
        })
      ]
    })
  })
})

function createStore(): SettingsStore {
  return new SettingsStore(createSettingsFile())
}

function createSettingsFile(): string {
  return join(mkdtempSync(join(tmpdir(), 'pixai-settings-test-')), 'settings.json')
}
