import { describe, expect, it } from 'vitest'
import { buildGeminiGenerateContentParams } from './gemini-request'

describe('gemini request', () => {
  it('omits aspect ratio when ratio is auto', () => {
    const params = buildGeminiGenerateContentParams('test prompt', [], 'auto', '4K')
    expect(params.config.imageConfig?.aspectRatio).toBeUndefined()
    expect(params.config.imageConfig?.imageSize).toBe('4K')
  })

  it('maps explicit ratio when supported', () => {
    const params = buildGeminiGenerateContentParams('test prompt', [], '16:9', '4K')
    expect(params.config.imageConfig?.aspectRatio).toBe('16:9')
  })
})
