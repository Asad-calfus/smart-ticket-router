import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { AuthCard, FormField } from "../../components/AuthCard"
import { Input, PasswordInput } from "../../components/ui/Input"
import { Button } from "../../components/ui/Button"
import { InlineFeedback } from "../../components/ui/Toast"
import { useAuth } from "../../contexts/AuthContext"
import { ApiError } from "../../services/api"

const DEMO_PASSWORD = "DemoPass123!"
const DEMO_ACCOUNTS = [
  { label: "Customer", email: "customer@example.com", description: "Create and track tickets" },
  { label: "Support Agent", email: "agent@example.com", description: "Route and resolve tickets" },
  { label: "Admin", email: "admin@example.com", description: "Manage agents and audit logs" },
] as const

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeDemo, setActiveDemo] = useState<string | null>(null)

  async function performLogin(loginEmail: string, loginPassword: string) {
    await login(loginEmail, loginPassword)
    navigate("/")
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await performLogin(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log in.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDemoLogin(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email)
    setPassword(DEMO_PASSWORD)
    setError(null)
    setActiveDemo(account.label)
    try {
      await performLogin(account.email, DEMO_PASSWORD)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log in.")
    } finally {
      setActiveDemo(null)
    }
  }

  return (
    <AuthCard title="Log in" subtitle="Smart Support Ticket Router">
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
        <FormField label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
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
          {isSubmitting ? "Logging in..." : "Log in"}
        </Button>
      </form>
      <section className="mt-5 border-t border-border pt-4" aria-labelledby="demo-login-heading">
        <h2 id="demo-login-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Demo accounts
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Click a role to log in instantly, or type the credentials below manually. Password for all: {DEMO_PASSWORD}
        </p>
        <div className="mt-3 grid gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              disabled={isSubmitting || activeDemo !== null}
              onClick={() => handleDemoLogin(account)}
              className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors duration-150 hover:border-accent hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>
                <span className="block text-xs font-semibold text-foreground">{account.label}</span>
                <span className="block text-[11px] text-muted-foreground">{account.description}</span>
                <span className="block font-mono text-[11px] text-muted-foreground">{account.email}</span>
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-accent">
                {activeDemo === account.label ? "Opening..." : "Open"}
                {activeDemo !== account.label && <ArrowRight size={14} />}
              </span>
            </button>
          ))}
        </div>
      </section>
      <div className="mt-4 flex flex-col gap-1 text-xs text-muted-foreground">
        <Link to="/forgot-password" className="hover:underline">
          Forgot password?
        </Link>
        <span>
          New customer?{" "}
          <Link to="/signup" className="font-medium text-foreground hover:underline">
            Sign up
          </Link>
        </span>
      </div>
    </AuthCard>
  )
}
