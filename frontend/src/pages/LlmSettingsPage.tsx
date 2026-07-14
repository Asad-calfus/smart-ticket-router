import { useEffect, useState } from "react"
import { Bot, Check, FlaskConical, KeyRound, RefreshCw, Sparkles, Zap } from "lucide-react"
import { ErrorState, LoadingSkeleton } from "../components/StateViews"
import { Button } from "../components/ui/Button"
import { PasswordInput, Select } from "../components/ui/Input"
import { InlineFeedback } from "../components/ui/Toast"
import { api, ApiError } from "../services/api"
import type { LlmModelInfo, LLMProviderName, UserLLMSettingsRead } from "../types"

const PROVIDERS: { value: LLMProviderName; label: string; description: string; icon: typeof Bot }[] = [
  { value: "mock", label: "Mock", description: "Free, no key, rule-based", icon: FlaskConical },
  { value: "anthropic", label: "Anthropic", description: "Claude models", icon: Bot },
  { value: "openai", label: "OpenAI", description: "GPT models", icon: Sparkles },
  { value: "groq", label: "Groq", description: "Fast open-source models", icon: Zap },
]

const REASONING_LEVEL_LABELS: Record<string, string> = {
  minimal: "Minimal — fastest, cheapest",
  low: "Low",
  medium: "Medium",
  high: "High — most thorough",
}

export function LlmSettingsPage() {
  const [settings, setSettings] = useState<UserLLMSettingsRead | null>(null)
  const [defaults, setDefaults] = useState<Record<string, string>>({})
  const [provider, setProvider] = useState<LLMProviderName>("mock")
  const [modelName, setModelName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [reasoningEffort, setReasoningEffort] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const [models, setModels] = useState<LlmModelInfo[]>([])
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [isFetchingModels, setIsFetchingModels] = useState(false)

  function load() {
    setIsLoading(true)
    setError(null)
    Promise.all([api.getMyLlmSettings(), api.getLlmProviderDefaults()])
      .then(([mine, providerDefaults]) => {
        setSettings(mine)
        setDefaults(providerDefaults)
        setProvider(mine.provider)
        setModelName(mine.model_name)
        setReasoningEffort(mine.reasoning_effort ?? "")
        setApiKey("")
        // A key is already on file for this provider — load its live model
        // list right away so the dropdown isn't empty on first render.
        if (mine.provider !== "mock" && mine.has_api_key) {
          fetchModels(mine.provider)
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your LLM settings."))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  async function fetchModels(forProvider: LLMProviderName, keyOverride?: string) {
    if (forProvider === "mock") {
      setModels([])
      setModelsError(null)
      return
    }
    setIsFetchingModels(true)
    setModelsError(null)
    try {
      const response = await api.listLlmModels(forProvider, keyOverride)
      setModels(response.models)
      setModelsError(response.error)
    } catch (err) {
      setModels([])
      setModelsError(err instanceof ApiError ? err.message : "Could not reach the provider to list models.")
    } finally {
      setIsFetchingModels(false)
    }
  }

  function handleProviderChange(next: LLMProviderName) {
    setProvider(next)
    setModels([])
    setModelsError(null)
    setReasoningEffort("")
    // Only replace the model field with the provider's suggested default when
    // it's empty or still holding the previous provider's default — never
    // clobber a model name the agent typed themselves.
    if (!modelName || modelName === defaults[provider]) {
      setModelName(defaults[next] ?? "")
    }
    // If they already have a saved key for the newly selected provider, load
    // its models immediately without asking them to retype the key.
    if (next !== "mock" && settings?.provider === next && settings.has_api_key) {
      fetchModels(next)
    }
  }

  function handleModelChange(nextModelId: string) {
    setModelName(nextModelId)
    const supportedLevels = models.find((m) => m.id === nextModelId)?.reasoning_levels ?? []
    if (!supportedLevels.includes(reasoningEffort)) {
      setReasoningEffort("")
    }
  }

  const selectedModelInfo = models.find((m) => m.id === modelName)
  const reasoningLevels = selectedModelInfo?.reasoning_levels ?? []

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setSavedMessage(null)
    setError(null)
    try {
      const updated = await api.saveMyLlmSettings({
        provider,
        model_name: modelName,
        api_key: apiKey === "" ? undefined : apiKey,
        reasoning_effort: reasoningLevels.length > 0 && reasoningEffort ? reasoningEffort : null,
      })
      setSettings(updated)
      setApiKey("")
      setSavedMessage("LLM settings saved.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your LLM settings.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleClearKey() {
    setIsSaving(true)
    setSavedMessage(null)
    setError(null)
    try {
      const updated = await api.saveMyLlmSettings({ provider, model_name: modelName, api_key: "" })
      setSettings(updated)
      setApiKey("")
      setSavedMessage("API key removed.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove your API key.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <LoadingSkeleton rows={5} />
  if (error && !settings) return <ErrorState message={error} onRetry={load} />
  if (!settings) return null

  const activeProvider = PROVIDERS.find((p) => p.value === settings.provider) ?? PROVIDERS[0]
  const ActiveIcon = activeProvider.icon

  return (
    <div className="p-4">
      <div className="mx-auto max-w-lg text-center">
        <h2 className="text-lg font-semibold text-foreground">LLM settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which AI routes your tickets and bring your own API key. This only affects your own account — other
          agents keep using the workspace default unless they set one too.
        </p>
      </div>

      <div className="mt-4 mx-auto flex max-w-lg items-center gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent">
          <ActiveIcon size={18} />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">Currently routing your tickets through</p>
          <p className="text-sm font-semibold text-foreground">
            {activeProvider.label}
            {settings.provider !== "mock" && settings.model_name && ` · ${settings.model_name}`}
            {settings.provider !== "mock" && (settings.has_api_key ? " · personal key saved" : " · no key saved yet")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 mx-auto max-w-lg space-y-4 rounded-lg border border-border bg-surface p-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Provider</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PROVIDERS.map((p) => {
              const Icon = p.icon
              const selected = provider === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleProviderChange(p.value)}
                  className={`relative flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors duration-150 ${
                    selected
                      ? "border-accent bg-accent-subtle"
                      : "border-border bg-surface hover:border-accent hover:bg-surface-2"
                  }`}
                >
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Check size={11} />
                    </span>
                  )}
                  <Icon size={18} className={selected ? "text-accent" : "text-muted-foreground"} />
                  <span className={`text-xs font-semibold ${selected ? "text-accent" : "text-foreground"}`}>
                    {p.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{p.description}</span>
                </button>
              )
            })}
          </div>
        </div>

        {provider !== "mock" && (
          <div className="space-y-3 rounded-md border border-border bg-surface-2 p-3">
            <label htmlFor="llm-api-key" className="block text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <KeyRound size={12} />
                API key
              </span>
              <PasswordInput
                id="llm-api-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings.has_api_key ? `Saved, ending in ${settings.key_last4}` : "Paste your API key"}
                autoComplete="off"
                className="mt-1"
              />
            </label>
            {settings.has_api_key && (
              <p className="text-xs text-muted-foreground">
                A key is saved (ending in <span className="font-mono">{settings.key_last4}</span>). Leave the field
                blank to keep it, or{" "}
                <button type="button" onClick={handleClearKey} className="text-accent hover:underline">
                  remove it
                </button>
                .
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Model</p>
              <button
                type="button"
                onClick={() => fetchModels(provider, apiKey || undefined)}
                disabled={isFetchingModels || (!apiKey && !settings.has_api_key)}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={12} className={isFetchingModels ? "animate-spin" : ""} />
                {isFetchingModels ? "Checking key..." : models.length > 0 ? "Refresh models" : "Load models"}
              </button>
            </div>

            {modelsError && <InlineFeedback tone="error" message={modelsError} />}

            {models.length > 0 ? (
              <Select value={modelName} onChange={(e) => handleModelChange(e.target.value)}>
                <option value="" disabled>
                  Choose a model...
                </option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </Select>
            ) : (
              <input
                id="llm-model"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder={defaults[provider] ?? ""}
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent"
              />
            )}
            <p className="text-xs text-muted-foreground">
              {models.length > 0
                ? "Fetched live from the provider — always up to date, never a typo."
                : "Enter/save your key, then load models to pick from the provider's real list instead of typing a name."}
            </p>

            {reasoningLevels.length > 0 && (
              <label htmlFor="llm-reasoning-effort" className="block text-xs font-medium text-muted-foreground">
                Reasoning effort
                <Select
                  id="llm-reasoning-effort"
                  value={reasoningEffort}
                  onChange={(e) => setReasoningEffort(e.target.value)}
                  className="mt-1"
                >
                  <option value="">Provider default</option>
                  {reasoningLevels.map((level) => (
                    <option key={level} value={level}>
                      {REASONING_LEVEL_LABELS[level] ?? level}
                    </option>
                  ))}
                </Select>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Higher effort can improve tricky cases but costs more tokens and takes longer.
                </span>
              </label>
            )}
          </div>
        )}

        {error && <InlineFeedback tone="error" message={error} />}
        {savedMessage && <InlineFeedback tone="success" message={savedMessage} />}

        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
