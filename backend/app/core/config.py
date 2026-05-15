from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql+asyncpg://promptledger:promptledger@localhost:5432/promptledger"
    REDIS_URL: str = "redis://localhost:6379/0"
    ENABLE_REDIS_RATE_LIMITING: bool = False
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    LLM_PROVIDER: str = "ollama"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    OLLAMA_MODEL: str = "llama3.1:8b"
    OLLAMA_FAST_MODEL: str = "phi3:mini"
    EVAL_LLM_TIMEOUT_SECONDS: int = 45
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET: str = ""
    RESEND_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    GITHUB_WEBHOOK_SECRET: str = "webhook_secret"
    GITHUB_WEBHOOK_ALLOW_UNSIGNED: bool = False
    # Scoring prompt templates (configurable)
    EVAL_SCORE_SYSTEM_PROMPT: str = 'Respond ONLY with valid JSON containing an "overall" key with a numeric value between 0.0 and 1.0. Return no additional text.'
    EVAL_SCORE_USER_TEMPLATE: str = (
        'You are an objective evaluator. Score between 0.0 and 1.0 based ONLY on the criteria.\n'
        'Input: {input}\n'
        'Criteria: {criteria}\n'
        'Response: {response}\n'
        'Return ONLY valid JSON like: {"overall": 0.0}'
    )


settings = Settings()
