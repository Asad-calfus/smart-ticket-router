import { CheckCircle2, XCircle } from "lucide-react"

type ToastTone = "success" | "error"

const TONE_STYLES: Record<ToastTone, { border: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  success: { border: "border-success-border", bg: "bg-success-bg", text: "text-success", icon: CheckCircle2 },
  error: { border: "border-danger-border", bg: "bg-danger-bg", text: "text-danger", icon: XCircle },
}

export function InlineFeedback({ tone, message }: { tone: ToastTone; message: string }) {
  const { border, bg, text, icon: Icon } = TONE_STYLES[tone]
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-center gap-2 rounded-md border ${border} ${bg} px-3 py-2 text-sm ${text}`}
    >
      <Icon size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  )
}
