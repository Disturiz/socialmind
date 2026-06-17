from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, emotions, scenarios
import app.models.user          # noqa: ensure models registered for Alembic
import app.models.child_profile  # noqa: ensure models registered for Alembic
import app.models.emotion_log    # noqa: ensure models registered for Alembic
import app.models.scenario_completion  # noqa: ensure models registered for Alembic

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

app.include_router(auth.router,      prefix="/api/v1/auth",      tags=["autenticación"])
app.include_router(emotions.router,  prefix="/api/v1/emotions",  tags=["emociones"])
app.include_router(scenarios.router, prefix="/api/v1/scenarios", tags=["escenarios"])


@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok", "service": "socialmind-api"}
