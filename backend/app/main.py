from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, emotions, scenarios, chat, calm, panel, biblioteca, profiles, assignments, lumi_chat
from app.gamification import router as gamification_router
import app.models.user
import app.models.child_profile
import app.models.emotion_log
import app.models.scenario_completion
import app.models.chat_conversation
import app.models.chat_message
import app.models.calm_session
import app.models.specialist_note
import app.models.specialist_assignment
import app.models.document
import app.models.document_chunk
import app.models.reward_event
import app.models.user_rewards
import app.models.adult_conversation
import app.models.adult_message

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
app.include_router(chat.router,      prefix="/api/v1/chat",      tags=["chat"])
app.include_router(calm.router,      prefix="/api/v1/calma",     tags=["calma"])
app.include_router(panel.router,      prefix="/api/v1/panel",      tags=["panel"])
app.include_router(biblioteca.router, prefix="/api/v1/biblioteca", tags=["biblioteca"])
app.include_router(profiles.router,           prefix="/api/v1/profiles",     tags=["perfiles"])
app.include_router(gamification_router.router, prefix="/api/v1/gamification", tags=["gamificación"])
app.include_router(assignments.router, prefix="/api/v1/assignments", tags=["asignaciones"])
app.include_router(lumi_chat.router, prefix="/api/v1/lumi-chat", tags=["lumi-chat-adultos"])


@app.get("/health", tags=["sistema"])
def health_check():
    return {"status": "ok", "service": "socialmind-api"}
