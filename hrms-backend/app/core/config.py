from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_LOCAL_ENV = _BACKEND_ROOT / ".env"

_ENV_FILES: tuple[str, ...] = (str(_LOCAL_ENV),) if _LOCAL_ENV.is_file() else ()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # Every setting comes from .env (or the process environment). There are no
    # defaults in code: a missing key stops start-up with a message naming it.
    # A key that is not needed can be left empty (for example COOKIE_DOMAIN=).
    port: int = Field(alias="PORT")
    db_host: str = Field(alias="DB_HOST")
    db_port: int = Field(alias="DB_PORT")
    db_user: str = Field(alias="DB_USER")
    db_pass: str = Field(alias="DB_PASS")
    db_name: str = Field(alias="DB_NAME")
    # SQLAlchemy pool: "queue" (QueuePool) or "null" (NullPool escape hatch).
    db_pool_class: Literal["queue", "null"] = Field(alias="DB_POOL_CLASS")
    db_pool_size: int = Field(alias="DB_POOL_SIZE")
    db_max_overflow: int = Field(alias="DB_MAX_OVERFLOW")
    db_pool_pre_ping: bool = Field(alias="DB_POOL_PRE_PING")
    db_pool_recycle: int = Field(alias="DB_POOL_RECYCLE")
    db_pool_timeout: int = Field(alias="DB_POOL_TIMEOUT")
    db_ssl: bool = Field(alias="DB_SSL")
    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = Field(alias="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(alias="JWT_EXPIRE_MINUTES")
    cors_origins: str = Field(alias="CORS_ORIGINS")
    cookie_secure: bool = Field(alias="COOKIE_SECURE")
    cookie_samesite: Literal["lax", "strict", "none"] = Field(alias="COOKIE_SAMESITE")
    # Empty = no cookie domain.
    cookie_domain: str | None = Field(alias="COOKIE_DOMAIN")
    minio_endpoint: str = Field(alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(alias="MINIO_BUCKET")
    minio_secure: bool = Field(alias="MINIO_SECURE")
    # Fernet key for Gov ID / bank / document numbers. Empty = use JWT_SECRET.
    field_encryption_key: str | None = Field(alias="FIELD_ENCRYPTION_KEY")
    # true = activation also emails the invite; false = login is created, email skipped.
    onboarding_send_invite_email: bool = Field(alias="ONBOARDING_SEND_INVITE_EMAIL")
    # Temporary local/dev bypass. Never enable in production.
    auth_bypass: bool = Field(alias="AUTH_BYPASS")
    # Runtime environment label (development / staging / production).
    environment: str = Field(alias="ENVIRONMENT")
    # Comma-separated Microsoft sign-in emails allowed in as Superadmin. The account
    # is created on that person's first sign-in, named from Microsoft. Empty = off.
    # BOOTSTRAP_ADMIN_EMAIL is the older name for the same setting.
    superadmin_emails: str = Field(
        validation_alias=AliasChoices("SUPERADMIN_EMAILS", "BOOTSTRAP_ADMIN_EMAIL"),
    )
    # Where module access grants come from: "db" = Manage Access grant rows.
    rbac_grant_source: Literal["db"] = Field(default="db", alias="RBAC_GRANT_SOURCE")
    # How emails are delivered. "smtp" (the SMTP_* settings below) for now;
    # other providers (e.g. Microsoft Graph, Amazon SES) can be added.
    email_provider: str = Field(alias="EMAIL_PROVIDER")
    # Background worker that sends queued notification emails, with retries.
    notification_worker_enabled: bool = Field(alias="NOTIFICATION_WORKER_ENABLED")
    # 0 = no polling: the worker wakes when an email is queued or a retry is due, so a
    # serverless database (Neon) can scale to zero. Set e.g. 30 for a slow safety poll.
    notification_poll_seconds: int = Field(alias="NOTIFICATION_POLL_SECONDS", ge=0)
    # 0 = edited email wording is loaded at start-up and after each save. Set e.g. 60
    # when several backends share one database so an edit reaches them all.
    template_refresh_seconds: int = Field(alias="TEMPLATE_REFRESH_SECONDS", ge=0)
    # SMTP server used when EMAIL_PROVIDER=smtp (e.g. the company mail server).
    smtp_enabled: bool = Field(alias="SMTP_ENABLED")
    smtp_host: str = Field(alias="SMTP_HOST")
    smtp_port: int = Field(alias="SMTP_PORT")
    # "starttls" (usually port 587), "ssl" (usually 465) or "none" (internal relays).
    smtp_security: Literal["starttls", "ssl", "none"] = Field(alias="SMTP_SECURITY")
    smtp_user: str = Field(alias="SMTP_USER")
    smtp_pass: SecretStr = Field(alias="SMTP_PASS")
    smtp_from_email: str = Field(alias="SMTP_FROM_EMAIL")
    smtp_from_name: str = Field(alias="SMTP_FROM_NAME")
    # Public frontend origin linked from emails (e.g. the invite's sign-in link).
    app_public_url: str = Field(alias="APP_PUBLIC_URL")
    # Microsoft Entra ID (OIDC): required for sign-in unless AUTH_BYPASS=true.
    entra_tenant_id: str = Field(alias="TENANT_ID")
    entra_client_id: str = Field(alias="CLIENT_ID")
    entra_client_secret: SecretStr = Field(alias="CLIENT_SECRET")
    entra_redirect_uri: str = Field(alias="REDIRECT_URI")
    entra_post_login_redirect: str = Field(alias="MSAL_REDIRECT_URI")
    entra_scopes: str = Field(alias="SCOPES")
    # Photon (or compatible) geocoder for address autocomplete.
    geocoder_base_url: str = Field(alias="GEOCODER_BASE_URL")
    geocoder_user_agent: str = Field(alias="GEOCODER_USER_AGENT")

    @field_validator(
        "auth_bypass",
        "notification_worker_enabled",
        "onboarding_send_invite_email",
        "smtp_enabled",
        "db_pool_pre_ping",
        mode="before",
    )
    @classmethod
    def parse_boolish(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().lower() in {"1", "true", "yes", "on"}
        return v

    @field_validator("db_pool_class", "cookie_samesite", "smtp_security", mode="before")
    @classmethod
    def lowercase_choice(cls, v: object) -> object:
        return v.strip().lower() if isinstance(v, str) else v

    @field_validator("environment", mode="before")
    @classmethod
    def normalize_environment(cls, v: object) -> object:
        return v.strip().lower() if isinstance(v, str) else v

    @field_validator("cookie_domain", "field_encryption_key", mode="before")
    @classmethod
    def empty_is_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("app_public_url", "entra_post_login_redirect", mode="before")
    @classmethod
    def strip_public_url(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().strip('"').strip("'").rstrip("/")
        return v

    @field_validator(
        "entra_tenant_id",
        "entra_client_id",
        "entra_redirect_uri",
        "entra_scopes",
        mode="before",
    )
    @classmethod
    def strip_entra_str(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().strip('"').strip("'")
        return v

    @property
    def entra_configured(self) -> bool:
        secret = self.entra_client_secret.get_secret_value().strip()
        return bool(
            self.entra_tenant_id
            and self.entra_client_id
            and secret
            and self.entra_redirect_uri
            and self.entra_post_login_redirect
        )

    @property
    def entra_authority(self) -> str:
        return f"https://login.microsoftonline.com/{self.entra_tenant_id}"

    @property
    def entra_authorize_url(self) -> str:
        return f"{self.entra_authority}/oauth2/v2.0/authorize"

    @property
    def entra_token_url(self) -> str:
        return f"{self.entra_authority}/oauth2/v2.0/token"

    @property
    def entra_jwks_url(self) -> str:
        return f"{self.entra_authority}/discovery/v2.0/keys"

    @property
    def entra_issuer(self) -> str:
        return f"{self.entra_authority}/v2.0"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_pass}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


class MissingSettingsError(RuntimeError):
    """One or more required settings are absent from .env and the environment."""


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        problems = exc.errors()
        if problems and all(item["type"] == "missing" for item in problems):
            names = ", ".join(str(item["loc"][0]) for item in problems)
            raise MissingSettingsError(
                f"Your .env is missing: {names}. Copy those lines from .env.example "
                "into .env and fill in the values."
            ) from None
        raise
