from pydantic import BaseModel, EmailStr, Field

from app.models.enums import AssignedTeam, UserRole


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=200)
    location: str = Field(default="Unknown", max_length=120)
    preferred_language: str = Field(default="English", max_length=60)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class AcceptInvitationRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=150)


class CurrentUserRead(BaseModel):
    id: int
    email: str
    role: UserRole
    is_active: bool
    is_email_verified: bool
    customer_id: int | None = None
    agent_display_name: str | None = None
    agent_team: AssignedTeam | None = None


class GenericMessage(BaseModel):
    message: str
