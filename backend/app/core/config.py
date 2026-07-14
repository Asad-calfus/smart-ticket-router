from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Central application configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    cors_origins: str = "http://localhost:5173"
    max_ticket_message_length: int = 4000

    database_url: str = "postgresql+psycopg://ticket_user:ticket_pass@localhost:5432/ticket_router"

    # llm_provider: "mock" (default, no key needed) | "anthropic" | "openai" | "groq"
    llm_provider: str = "mock"
    anthropic_api_key: str = ""
    llm_model: str = "claude-sonnet-5"
    openai_llm_model: str = "gpt-5-mini"
    groq_api_key: str = ""
    groq_llm_model: str = "openai/gpt-oss-120b"

    # embedding_provider: "mock" (default, no key needed) | "openai"
    # openai_api_key is shared between LLM routing (LLM_PROVIDER=openai) and
    # embeddings (EMBEDDING_PROVIDER=openai) — both call the same OpenAI account.
    embedding_provider: str = "mock"
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 384

    # Symmetric key used to encrypt personal LLM API keys (per-user LLM
    # settings) at rest. Must be a valid Fernet key — generate one with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # Only required if/when a user saves a personal API key; left empty by
    # default so the app still boots with zero config for everyone else.
    llm_key_encryption_secret: str = ""

    # --- Authentication -----------------------------------------------------
    # Set to true only when serving over HTTPS (production). False for local
    # http://localhost dev, where a Secure cookie would simply never be sent.
    cookie_secure: bool = False
    session_lifetime_hours: int = 12
    password_reset_token_lifetime_minutes: int = 30
    email_verification_token_lifetime_hours: int = 24
    agent_invitation_lifetime_days: int = 7

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
