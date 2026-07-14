import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom"
import { AdminLayout } from "./components/AdminLayout"
import { AgentLayout } from "./components/AgentLayout"
import { CustomerLayout } from "./components/CustomerLayout"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { ThemeProvider } from "./contexts/ThemeContext"
import { AcceptInvitationPage } from "./pages/auth/AcceptInvitationPage"
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage"
import { LoginPage } from "./pages/auth/LoginPage"
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage"
import { SignupPage } from "./pages/auth/SignupPage"
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage"
import { AgentsPage } from "./pages/admin/AgentsPage"
import { AuditLogPage } from "./pages/admin/AuditLogPage"
import { AnalyticsPage } from "./pages/AnalyticsPage"
import { LlmSettingsPage } from "./pages/LlmSettingsPage"
import { MyTicketsPage } from "./pages/customer/MyTicketsPage"
import { NewTicketPage } from "./pages/customer/NewTicketPage"
import { ProfilePage } from "./pages/customer/ProfilePage"
import { TicketConversationPage } from "./pages/customer/TicketConversationPage"
import { WorkspacePage } from "./pages/WorkspacePage"

function HomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === "Customer") return <Navigate to="/my-tickets" replace />
  return <Navigate to="/workspace" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomeRedirect />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["Customer"]} />}>
        <Route element={<CustomerLayout />}>
          <Route path="/my-tickets" element={<MyTicketsPage />} />
          <Route path="/new-ticket" element={<NewTicketPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/tickets/:ticketId" element={<TicketConversationPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["Support Agent", "Admin"]} />}>
        <Route element={<AgentLayout />}>
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings/llm" element={<LlmSettingsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AgentsPage />} />
          <Route path="/admin/audit-log" element={<AuditLogPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App
