import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AuthCard, FormField, inputClassName, primaryButtonClassName } from "../../components/AuthCard"
import { useAuth } from "../../contexts/AuthContext"
import { api, ApiError } from "../../services/api"

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await api.acceptInvitation({ token, password, display_name: displayName })
      await refresh()
      navigate("/")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept this invitation.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthCard title="Accept invitation">
        <p className="text-sm text-red-600">This link is missing its invitation token.</p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Accept your invitation" subtitle="Set your display name and password to finish joining.">
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Display name" htmlFor="display-name">
          <input
            id="display-name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClassName}
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClassName}
          />
        </FormField>
        {error && (
          <p className="mb-3 text-xs font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClassName}>
          {isSubmitting ? "Joining..." : "Accept & continue"}
        </button>
      </form>
    </AuthCard>
  )
}
