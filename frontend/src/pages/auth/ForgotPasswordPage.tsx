import { useState } from "react"
import { Link } from "react-router-dom"
import { AuthCard, FormField, inputClassName, primaryButtonClassName } from "../../components/AuthCard"
import { api, ApiError } from "../../services/api"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const response = await api.forgotPassword(email)
      setMessage(response.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard title="Forgot password" subtitle="We'll send a reset link if the email exists.">
      {message ? (
        <p className="text-sm text-slate-700">{message}</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <FormField label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClassName}
            />
          </FormField>
          {error && (
            <p className="mb-3 text-xs font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={isSubmitting} className={primaryButtonClassName}>
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-4 text-xs text-slate-500">
        <Link to="/login" className="hover:underline">
          Back to login
        </Link>
      </p>
    </AuthCard>
  )
}
