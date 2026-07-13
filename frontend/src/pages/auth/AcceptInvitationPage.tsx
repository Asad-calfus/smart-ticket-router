import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AuthCard, FormField } from "../../components/AuthCard"
import { Input, PasswordInput } from "../../components/ui/Input"
import { Button } from "../../components/ui/Button"
import { InlineFeedback } from "../../components/ui/Toast"
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
        <InlineFeedback tone="error" message="This link is missing its invitation token." />
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Accept your invitation" subtitle="Set your display name and password to finish joining.">
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Display name" htmlFor="display-name">
          <Input id="display-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        {error && (
          <div className="mb-3">
            <InlineFeedback tone="error" message={error} />
          </div>
        )}
        <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Joining..." : "Accept & continue"}
        </Button>
      </form>
    </AuthCard>
  )
}
