import { useState } from "react"
import { Link } from "react-router-dom"
import { AuthCard, FormField } from "../../components/AuthCard"
import { Input } from "../../components/ui/Input"
import { Button } from "../../components/ui/Button"
import { InlineFeedback } from "../../components/ui/Toast"
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
        <InlineFeedback tone="success" message={message} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <FormField label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          {error && (
            <div className="mb-3">
              <InlineFeedback tone="error" message={error} />
            </div>
          )}
          <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        <Link to="/login" className="hover:underline">
          Back to login
        </Link>
      </p>
    </AuthCard>
  )
}
