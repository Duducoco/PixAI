import { readFileSync } from 'node:fs'
import type { GenerateContentResponse, Part } from '@google/genai'
import { buildGeminiGenerateContentEndpoint } from '@shared/image-options'
import type { ImageRatio, ReferenceImage } from '@shared/types'
import type { ImageResponseData } from './image-response'

export type GeminiGenerateContentParams = {
  contents: Array<{ role: 'user'; parts: Part[] }>
  config: {
    responseModalities: string[]
    imageConfig?: {
      imageSize?: string
      aspectRatio?: string
    }
  }
}

const SUPPORTED_ASPECT_RATIOS: Record<string, string | null> = {
  '1:1': '1:1',
  '3:2': '3:2',
  '2:3': '2:3',
  '4:3': '4:3',
  '3:4': '3:4',
  '16:9': '16:9',
  '9:16': '9:16',
  '21:9': '21:9',
  '9:21': null
}

export function buildGeminiEndpoint(baseURL: string, model: string): string {
  return buildGeminiGenerateContentEndpoint(baseURL, model)
}

export function buildGeminiGenerateContentParams(
  prompt: string,
  referenceImages: ReferenceImage[],
  ratio: ImageRatio,
  size: string
): GeminiGenerateContentParams {
  const parts: Part[] = []

  for (const ref of referenceImages) {
    if (!ref.filePath) continue
    const fileBuffer = readFileSync(ref.filePath)
    parts.push({
      inlineData: {
        mimeType: ref.mimeType || 'image/jpeg',
        data: fileBuffer.toString('base64')
      }
    })
  }

  parts.push({ text: prompt })

  const imageConfig: NonNullable<GeminiGenerateContentParams['config']['imageConfig']> = {}
  const resolution = toGeminiResolution(size)
  if (resolution) imageConfig.imageSize = resolution
  const aspectRatio = SUPPORTED_ASPECT_RATIOS[ratio]
  if (aspectRatio) imageConfig.aspectRatio = aspectRatio

  return {
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['Text', 'Image'],
      ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {})
    }
  }
}

export function parseGeminiResponse(data: GenerateContentResponse): ImageResponseData[] {
  const images: ImageResponseData[] = []
  if (!data.candidates) return images

  for (const candidate of data.candidates) {
    const parts = candidate.content?.parts
    if (!parts) continue
    for (const part of parts) {
      if (part.inlineData?.data) {
        images.push({ b64_json: part.inlineData.data })
      }
    }
  }

  return images
}

function toGeminiResolution(size: string): string {
  if (['1K', '2K', '4K'].includes(size)) return size
  const match = /^(\d+)x(\d+)$/i.exec(size)
  if (!match) return '4K'
  const maxDim = Math.max(Number(match[1]), Number(match[2]))
  if (maxDim <= 1024) return '1K'
  if (maxDim <= 2048) return '2K'
  return '4K'
}
