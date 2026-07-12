import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AuthCard, FormField, inputClassName, primaryButtonClassName } from "../../components/AuthCard"
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
        <p className="text-sm text-red-600">This link is missing its reset token.</p>
        <Link to="/forgot-password" className="mt-3 inline-block text-xs text-slate-600 hover:underline">
          Request a new link
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Reset password">
      {done ? (
        <p className="text-sm text-slate-700">Password reset. Redirecting you to log in...</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <FormField label="New password" htmlFor="new-password">
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClassName}
            />
          </FormField>
          {error && (
            <p className="mb-3 text-xs font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={isSubmitting} className={primaryButtonClassName}>
            {isSubmitting ? "Resetting..." : "Reset password"}
          </button>
        </form>
      )}
    </AuthCard>
  )
}
