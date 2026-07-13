import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AuthCard } from "../../components/AuthCard"
import { InlineFeedback } from "../../components/ui/Toast"
import { api, ApiError } from "../../services/api"

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setMessage("This link is missing its verification token.")
      return
    }
    api
      .verifyEmail(token)
      .then((response) => {
        setStatus("success")
        setMessage(response.message)
      })
      .catch((err) => {
        setStatus("error")
        setMessage(err instanceof ApiError ? err.message : "Could not verify this email.")
      })
  }, [token])

  return (
    <AuthCard title="Email verification">
      {status === "loading" && <p className="text-sm text-muted-foreground">Verifying...</p>}
      {status !== "loading" && <InlineFeedback tone={status === "success" ? "success" : "error"} message={message} />}
      <Link to="/login" className="mt-4 inline-block text-xs text-muted-foreground hover:underline">
        Back to login
      </Link>
    </AuthCard>
  )
}
