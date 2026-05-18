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
      provider: 'gpt',
      baseURL: 'https://api.openai.com',
      defaultModel: 'gpt-image-2',
      promptModel: 'gpt-5.4-mini'
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
      defaultModel: 'gemini-2.5-flash-image'
    })
  })
})

function createStore(): SettingsStore {
  return new SettingsStore(createSettingsFile())
}

function createSettingsFile(): string {
  return join(mkdtempSync(join(tmpdir(), 'pixai-settings-test-')), 'settings.json')
}
