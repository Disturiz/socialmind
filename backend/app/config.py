from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:3000"
    app_env: str = "development"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    resend_api_key: str = ""
    frontend_url: str = "https://socialmind.it.com"

    class Config:
        env_file = ".env"

settings = Settings()
