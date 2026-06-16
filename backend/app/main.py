from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
import app.models  # noqa: importar modelos para que Alembic los detecte

app = FastAPI(
    title="SocialMind API",
    description="Plataforma de apoyo social para personas en el espectro autista",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok", "service": "socialmind-api"}
