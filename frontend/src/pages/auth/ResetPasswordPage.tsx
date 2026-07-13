import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AuthCard, FormField } from "../../components/AuthCard"
import { PasswordInput } from "../../components/ui/Input"
import { Button } from "../../components/ui/Button"
import { InlineFeedback } from "../../components/ui/Toast"
import { api, ApiError } from "../../services/api"

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await api.resetPassword(token, newPassword)
      setDone(true)
      setTimeout(() => navigate("/login"), 1500)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthCard title="Reset password">
        <InlineFeedback tone="error" message="This link is missing its reset token." />
        <Link to="/forgot-password" className="mt-3 inline-block text-xs text-muted-foreground hover:underline">
          Request a new link
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Reset password">
      {done ? (
        <InlineFeedback tone="success" message="Password reset. Redirecting you to log in..." />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <FormField label="New password" htmlFor="new-password">
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </FormField>
          {error && (
            <div className="mb-3">
              <InlineFeedback tone="error" message={error} />
            </div>
          )}
          <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
