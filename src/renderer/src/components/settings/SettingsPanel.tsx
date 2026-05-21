import { useEffect, useState, type JSX } from 'react'
import { CircleHelp, Plus, Settings, Trash2 } from 'lucide-react'
import {
  DEFAULT_API_PROVIDER,
  DEFAULT_GPT_BASE_URL,
  DEFAULT_IMAGE_OUTPUT_FORMAT,
  DEFAULT_MODEL,
  IMAGE_BACKGROUND_LABELS,
  MAX_IMAGE_MAX_RETRIES,
  IMAGE_BACKGROUNDS,
  IMAGE_INPUT_FIDELITIES,
  IMAGE_MODEL_LABELS,
  IMAGE_MODERATIONS,
  IMAGE_OUTPUT_FORMATS,
  IMAGE_QUALITIES,
  IMAGE_RATIOS,
  formatImageQuality,
  getDefaultGeminiSize,
  getDefaultImageSize,
  getGeminiSizeOptions,
  getImageSizeOptions,
  getModelProvider,
  getProviderBaseURL,
  getProviderDefaultModel,
  getProviderModelOptions,
  IMAGE_INPUT_FIDELITY_LABELS,
  IMAGE_MODERATION_LABELS,
  IMAGE_OUTPUT_FORMAT_LABELS,
  isGeminiModel,
  normalizeProviderModel,
  supportsImageInputFidelity
} from '@shared/image-options'
import { DEFAULT_PROMPT_MODEL } from '@shared/prompt-options'
import type { ApiProvider, ImageQuality, ImageRatio } from '@shared/types'
import { useAppStore } from '@renderer/store/app-store'
import { GallerySelect } from '@renderer/components/gallery/GallerySelect'

const ratios: ImageRatio[] = IMAGE_RATIOS
const qualities: ImageQuality[] = IMAGE_QUALITIES
const providerOptions: Array<{ value: ApiProvider; label: string }> = [
  { value: 'gpt', label: 'GPT' },
  { value: 'gemini', label: 'Gemini' }
]

export function SettingsPanel(): JSX.Element {
  const {
    settings,
    conversations,
    activeConversationId,
    updateActiveConversation,
    updateSettings,
    createSettingsProfile,
    selectSettingsProfile,
    deleteSettingsProfile
  } = useAppStore()
  const conversation = conversations.find((item) => item.id === activeConversationId) || null
  const isImageToImage = (conversation?.referenceImages.length || 0) > 0
  const [profileName, setProfileName] = useState(settings?.name || '')
  const [provider, setProvider] = useState<ApiProvider>(settings?.provider || DEFAULT_API_PROVIDER)
  const [baseURL, setBaseURL] = useState(settings?.baseURL || DEFAULT_GPT_BASE_URL)
  const [defaultModel, setDefaultModel] = useState(settings?.defaultModel || DEFAULT_MODEL)
  const [promptModel, setPromptModel] = useState(settings?.promptModel || DEFAULT_PROMPT_MODEL)
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    if (settings) {
      const nextProvider = settings.provider || getModelProvider(settings.defaultModel)
      setProfileName(settings.name)
      setProvider(nextProvider)
      setBaseURL(settings.baseURL || getProviderBaseURL(nextProvider))
      setDefaultModel(normalizeProviderModel(nextProvider, settings.defaultModel))
      setPromptModel(settings.promptModel)
    }
  }, [settings])

  if (!conversation) return <aside className="inspector" />

  const selectedDefaultModel = normalizeProviderModel(provider, defaultModel)
  const activeProvider = settings?.provider || provider
  const conversationModel = conversation.model || getProviderDefaultModel(activeProvider)
  const conversationProvider = getModelProvider(conversationModel)
  const geminiMode = isGeminiModel(conversationModel)
  const sizeOptions = geminiMode ? getGeminiSizeOptions() : getImageSizeOptions(conversation.ratio)
  const selectedSize = geminiMode
    ? (sizeOptions.some((option) => option.value === conversation.size) ? conversation.size : getDefaultGeminiSize())
    : (sizeOptions.some((option) => option.value === conversation.size) ? conversation.size : getDefaultImageSize(conversation.ratio))

  return (
    <aside className="inspector">
      <div className="config-stack">
        <section className="panel">
          <h3>
            当前服务
            <span className={`pill ${settings?.apiKeyStored ? 'good' : 'warn'}`}>{settings?.apiKeyStored ? '已配置' : '未配置'}</span>
          </h3>
          {settings ? (
            <label className="field">
              <span>服务配置</span>
              <GallerySelect
                value={settings.activeProfileId}
                options={settings.profiles.map((profile) => ({
                  value: profile.id,
                  label: `${profile.name} · ${profile.provider === 'gemini' ? 'Gemini' : 'GPT'}`
                }))}
                ariaLabel="选择服务配置"
                className="settings-select"
                onChange={(id) => void selectSettingsProfile(id)}
              />
            </label>
          ) : null}
          <div className="service-profile-actions">
            <button
              type="button"
              onClick={() => void createSettingsProfile({
                name: 'Gemini 默认',
                provider: 'gemini',
                defaultModel: getProviderDefaultModel('gemini')
              })}
            >
              <Plus size={14} />
              新增 Gemini
            </button>
            <button
              type="button"
              onClick={() => void createSettingsProfile({
                name: 'GPT 默认',
                provider: 'gpt',
                defaultModel: getProviderDefaultModel('gpt')
              })}
            >
              <Plus size={14} />
              新增 GPT
            </button>
          </div>
          <details className="service-profile-editor">
            <summary>
              <span>编辑当前服务配置</span>
              <span className="pill tiny">{settings?.name || '默认配置'}</span>
            </summary>
            <div className="service-profile-editor-body">
              <label className="field">
                <span>名称</span>
                <input className="input-control" value={profileName} onChange={(event) => setProfileName(event.target.value)} />
              </label>
          <label className="field">
            <span>平台</span>
            <GallerySelect
              value={provider}
              options={providerOptions}
              ariaLabel="选择平台"
              className="settings-select"
              onChange={(nextProvider) => {
                setProvider(nextProvider)
                setBaseURL(getProviderBaseURL(nextProvider))
                setDefaultModel(getProviderDefaultModel(nextProvider))
              }}
            />
          </label>
          <label className="field">
            <span>Base URL</span>
            <input className="input-control" value={baseURL} onChange={(event) => setBaseURL(event.target.value)} />
          </label>
          <label className="field">
            <span>API Key</span>
            <input
              className="input-control"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type="password"
              placeholder={settings?.apiKeyStored ? '已保存，留空不修改' : 'sk-...'}
            />
          </label>
          <label className="field">
            <span>图片默认模型</span>
            <GallerySelect
              value={selectedDefaultModel}
              options={getProviderModelOptions(provider).map((value) => ({ value, label: IMAGE_MODEL_LABELS[value] || value }))}
              ariaLabel="选择图片默认模型"
              className="settings-select"
              onChange={setDefaultModel}
            />
          </label>
          <label className="field">
            <span>提示词助手模型</span>
            <input className="input-control" value={promptModel} onChange={(event) => setPromptModel(event.target.value)} />
          </label>
          {settings?.insecureStorage ? <div className="status-error">当前系统无法加密，API Key 已降级保存在本地设置文件中。</div> : null}
          <button
            className="primary full"
            onClick={() => {
              void (async () => {
                await updateSettings({
                  name: profileName,
                  provider,
                  baseURL,
                  defaultModel: selectedDefaultModel,
                  promptModel,
                  apiKey: apiKey.trim() ? apiKey : undefined
                })
                if (conversation.model !== selectedDefaultModel) {
                  await updateActiveConversation({
                    model: selectedDefaultModel,
                    size: isGeminiModel(selectedDefaultModel) ? getDefaultGeminiSize() : getDefaultImageSize(conversation.ratio)
                  })
                }
                setApiKey('')
              })()
            }}
          >
            <Settings size={15} />
            保存当前配置
          </button>
              {settings && settings.profiles.length > 1 ? (
                <button
                  type="button"
                  className="danger full"
                  onClick={() => {
                    if (!window.confirm(`确认删除「${settings.name}」吗？`)) return
                    void deleteSettingsProfile(settings.activeProfileId)
                  }}
                >
                  <Trash2 size={15} />
                  删除当前配置
                </button>
              ) : null}
            </div>
          </details>
        </section>
        <section className="panel">
          <h3>当前会话参数</h3>
          <label className="field">
            <span>模型</span>
            <GallerySelect
              value={conversationModel}
              options={getProviderModelOptions(conversationProvider).map((value) => ({ value, label: IMAGE_MODEL_LABELS[value] || value }))}
              ariaLabel="选择当前会话模型"
              className="settings-select"
              onChange={(model) => void updateActiveConversation({
                model,
                size: isGeminiModel(model) ? getDefaultGeminiSize() : getDefaultImageSize(conversation.ratio)
              })}
            />
          </label>
          <div className="field">
            <span>图片比例</span>
            <div className="segmented">
              {ratios.map((ratio) => (
                <button
                  key={ratio}
                  className={conversation.ratio === ratio ? 'on' : ''}
                  onClick={() => void updateActiveConversation({ ratio, size: geminiMode ? getDefaultGeminiSize() : getDefaultImageSize(ratio) })}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>分辨率</span>
            <GallerySelect
              value={selectedSize}
              options={sizeOptions}
              ariaLabel="选择分辨率"
              className="settings-select"
              onChange={(size) => void updateActiveConversation({ size })}
            />
          </div>
          <div className="field">
            <span className="field-label-with-help">
              <span>质量</span>
              <button
                type="button"
                className="info-icon"
                title="质量越高，细节通常更多，但生成会更慢，也更容易放大成本。"
                aria-label="质量说明"
              >
                <CircleHelp size={14} />
              </button>
            </span>
            <div className="segmented">
              {qualities.map((quality) => (
                <button
                  key={quality}
                  className={conversation.quality === quality ? 'on' : ''}
                  onClick={() => void updateActiveConversation({ quality })}
                >
                  {formatImageQuality(quality)}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>生成数量</span>
            <input
              className="input-control"
              type="number"
              min={1}
              max={10}
              value={conversation.n}
              onChange={(event) => void updateActiveConversation({ n: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>失败重试次数</span>
            <input
              className="input-control"
              type="number"
              min={0}
              max={MAX_IMAGE_MAX_RETRIES}
              step={1}
              value={conversation.maxRetries}
              onChange={(event) => void updateActiveConversation({ maxRetries: Number(event.target.value) })}
            />
          </label>
          <details className="advanced-settings">
            <summary>
              <span>高级设置</span>
              <span className={`pill tiny ${isImageToImage ? 'blue' : ''}`}>{isImageToImage ? '图生图' : '文生图'}</span>
            </summary>
            <div className="advanced-settings-body">
              <ToggleRow
                label="流式输出"
                help="开启后会以流式方式接收图片结果；默认关闭。"
                checked={conversation.stream}
                onChange={() => void updateActiveConversation({ stream: !conversation.stream })}
              />
              {isImageToImage ? (
                <ToggleRow
                  label="逐张参考图生成"
                  help={`开启后同一提示词会分别作用于每张参考图；总输出为参考图数量 × 生成数量。`}
                  checked={conversation.referenceImageMode === 'per-reference'}
                  onChange={() => void updateActiveConversation({
                    referenceImageMode: conversation.referenceImageMode === 'per-reference' ? 'combined' : 'per-reference'
                  })}
                />
              ) : null}
              <label className="field">
                <span className="field-label-with-help">
                  <span>超时时间(秒)</span>
                  <button
                    type="button"
                    className="info-icon"
                    title="单张图片的最大等待时间；每次重试都会重新计时。"
                    aria-label="超时时间说明"
                  >
                    <CircleHelp size={14} />
                  </button>
                </span>
                <input
                  className="input-control"
                  type="number"
                  min={1}
                  step={1}
                  value={conversation.generationTimeoutSeconds}
                  onChange={(event) => {
                    const value = event.target.value.trim()
                    void updateActiveConversation({
                      generationTimeoutSeconds: value ? Number(value) : conversation.generationTimeoutSeconds
                    })
                  }}
                />
              </label>
              <label className="field">
                <span className="field-label-with-help">
                  <span>输出格式</span>
                  <button
                    type="button"
                    className="info-icon"
                    title={`控制最终图片文件格式，默认使用 ${DEFAULT_IMAGE_OUTPUT_FORMAT.toUpperCase()}`}
                    aria-label="输出格式说明"
                  >
                    <CircleHelp size={14} />
                  </button>
                </span>
                <GallerySelect
                  value={conversation.outputFormat}
                  options={IMAGE_OUTPUT_FORMATS.map((value) => ({ value, label: IMAGE_OUTPUT_FORMAT_LABELS[value] }))}
                  ariaLabel="输出格式"
                  className="settings-select"
                  onChange={(outputFormat) => void updateActiveConversation({ outputFormat })}
                />
              </label>
              <label className="field">
                <span className="field-label-with-help">
                  <span>输出压缩</span>
                  <button
                    type="button"
                    className="info-icon"
                    title="仅 JPEG 和 WebP 有效，数值越高画质越好、文件越大。"
                    aria-label="输出压缩说明"
                  >
                    <CircleHelp size={14} />
                  </button>
                </span>
                <input
                  className="input-control"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={conversation.outputCompression ?? ''}
                  disabled={conversation.outputFormat === 'png'}
                  placeholder="留空"
                  onChange={(event) => {
                    const value = event.target.value.trim()
                    void updateActiveConversation({ outputCompression: value ? Number(value) : null })
                  }}
                />
              </label>
              <label className="field">
                <span className="field-label-with-help">
                  <span>背景</span>
                  <button
                    type="button"
                    className="info-icon"
                    title="选择是否保持自动背景或强制不透明背景。"
                    aria-label="背景说明"
                  >
                    <CircleHelp size={14} />
                  </button>
                </span>
                <GallerySelect
                  value={conversation.background}
                  options={IMAGE_BACKGROUNDS.map((value) => ({ value, label: IMAGE_BACKGROUND_LABELS[value] }))}
                  ariaLabel="背景"
                  className="settings-select"
                  onChange={(background) => void updateActiveConversation({ background })}
                />
              </label>
              <label className="field">
                <span className="field-label-with-help">
                  <span>审核策略</span>
                  <button
                    type="button"
                    className="info-icon"
                    title="控制内容审核强度，默认使用自动策略。"
                    aria-label="审核策略说明"
                  >
                    <CircleHelp size={14} />
                  </button>
                </span>
                <GallerySelect
                  value={conversation.moderation}
                  options={IMAGE_MODERATIONS.map((value) => ({ value, label: IMAGE_MODERATION_LABELS[value] }))}
                  ariaLabel="审核策略"
                  className="settings-select"
                  onChange={(moderation) => void updateActiveConversation({ moderation })}
                />
              </label>
              <label className="field">
                <span className="field-label-with-help">
                  <span>中间图数量</span>
                  <button
                    type="button"
                    className="info-icon"
                    title="仅流式输出时有效，范围为 0 到 3。"
                    aria-label="中间图数量说明"
                  >
                    <CircleHelp size={14} />
                  </button>
                </span>
                <input
                  className="input-control"
                  type="number"
                  min={0}
                  max={3}
                  step={1}
                  value={conversation.partialImages ?? 0}
                  disabled={!conversation.stream}
                  onChange={(event) => void updateActiveConversation({ partialImages: Number(event.target.value) })}
                />
              </label>
              {isImageToImage && supportsImageInputFidelity(conversation.model) ? (
                <label className="field">
                  <span className="field-label-with-help">
                    <span>输入保真度</span>
                    <button
                      type="button"
                      className="info-icon"
                      title="编辑场景下控制对输入参考图细节的保留程度。"
                      aria-label="输入保真度说明"
                    >
                      <CircleHelp size={14} />
                    </button>
                  </span>
                  <GallerySelect
                    value={conversation.inputFidelity ?? ''}
                    options={[
                      { value: '', label: '保持默认' },
                      ...IMAGE_INPUT_FIDELITIES.map((value) => ({ value, label: IMAGE_INPUT_FIDELITY_LABELS[value] }))
                    ]}
                    ariaLabel="输入保真度"
                    className="settings-select"
                    onChange={(inputFidelity) => void updateActiveConversation({
                      inputFidelity: inputFidelity === '' ? null : inputFidelity
                    })}
                  />
                </label>
              ) : null}
            </div>
          </details>
          <ToggleRow
            label="自动写入历史"
            checked={conversation.autoSaveHistory}
            onChange={() => void updateActiveConversation({ autoSaveHistory: !conversation.autoSaveHistory })}
          />
          <ToggleRow
            label="失败详情保留"
            checked={conversation.keepFailureDetails}
            onChange={() => void updateActiveConversation({ keepFailureDetails: !conversation.keepFailureDetails })}
          />
        </section>
      </div>
    </aside>
  )
}

function ToggleRow({
  label,
  help,
  checked,
  onChange
}: {
  label: string
  help?: string
  checked: boolean
  onChange: () => void
}): JSX.Element {
  return (
    <button className="toggle-row" onClick={onChange}>
      <span className="field-label-with-help">
        <span>{label}</span>
        {help ? (
          <span className="info-icon" title={help} aria-label={`${label}说明`}>
            <CircleHelp size={14} />
          </span>
        ) : null}
      </span>
      <span className={`switch ${checked ? '' : 'off'}`} />
    </button>
  )
}
