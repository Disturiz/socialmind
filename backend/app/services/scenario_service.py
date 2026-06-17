from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.scenario_completion import ScenarioCompletion
from app.schemas.scenarios import ScenarioFull, ScenarioMeta, ScenarioStep, ScenarioOption

SCENARIOS_DATA: list[dict] = [
    {
        "id": 1,
        "emoji": "🙋",
        "title": "Saludar",
        "description": "Aprende a saludar a alguien nuevo",
        "steps": [
            {"type": "objective",    "lumi_state": "happy",       "title": "¿Qué aprenderemos hoy?",
             "text": "Hoy aprenderemos cómo saludar a alguien. Saludar hace que las personas se sientan bienvenidas."},
            {"type": "explanation",  "lumi_state": "thinking",    "title": "¿Cómo se hace?",
             "text": "Cuando quieres saludar a alguien, puedes decir '¡Hola!' y decir tu nombre. Mira a la persona un momento y sonríe."},
            {"type": "practice",     "lumi_state": "thinking",
             "question": "Ves a un compañero en el pasillo. ¿Qué haces?",
             "options": [
                 {"text": "Digo ¡Hola! y mi nombre",         "correct": True},
                 {"text": "Paso sin decir nada",              "correct": False},
                 {"text": "Espero que él hable primero",      "correct": False},
             ]},
            {"type": "feedback",     "lumi_state": "happy",       "title": "¡Muy bien!",
             "text": "Saludar primero demuestra que eres amable y amigable. ¡Las personas se sienten felices cuando las saludas!"},
            {"type": "closing",      "lumi_state": "encouraging", "title": "¡Lo lograste!",
             "text": "Ya sabes cómo saludar. Practica con alguien hoy. ¡Cada saludo es una nueva amistad posible!", "badge_emoji": "🌟"},
        ],
    },
    {
        "id": 2,
        "emoji": "💬",
        "title": "Hablar con un compañero",
        "description": "Aprende a iniciar una conversación",
        "steps": [
            {"type": "objective",    "lumi_state": "happy",       "title": "¿Qué aprenderemos hoy?",
             "text": "Aprenderemos cómo empezar a hablar con alguien. No siempre es fácil, ¡pero tú puedes lograrlo!"},
            {"type": "explanation",  "lumi_state": "thinking",    "title": "¿Cómo se hace?",
             "text": "Para iniciar una conversación, puedes preguntar algo que le interese a la otra persona. Por ejemplo: '¿Qué te gusta hacer?' o '¿Viste alguna película buena últimamente?'"},
            {"type": "practice",     "lumi_state": "thinking",
             "question": "Quieres hablar con tu compañero. ¿Qué le dices?",
             "options": [
                 {"text": "¿Qué te gusta hacer en tu tiempo libre?",  "correct": True},
                 {"text": "No digo nada y espero que él hable",        "correct": False},
                 {"text": "Le hablo solo de lo que me gusta a mí",     "correct": False},
             ]},
            {"type": "feedback",     "lumi_state": "happy",       "title": "¡Perfecto!",
             "text": "Preguntar por los intereses de alguien es una gran forma de hacer amigos. ¡A todos nos gusta que se interesen en nosotros!"},
            {"type": "closing",      "lumi_state": "encouraging", "title": "¡Excelente trabajo!",
             "text": "Las conversaciones se vuelven más fáciles con la práctica. ¡Inténtalo hoy con alguien!", "badge_emoji": "💬"},
        ],
    },
    {
        "id": 3,
        "emoji": "🙏",
        "title": "Pedir ayuda",
        "description": "Aprende a pedir ayuda cuando la necesitas",
        "steps": [
            {"type": "objective",    "lumi_state": "happy",       "title": "¿Qué aprenderemos hoy?",
             "text": "Pedir ayuda no es una debilidad. ¡Es algo muy inteligente! Todos necesitamos ayuda a veces."},
            {"type": "explanation",  "lumi_state": "thinking",    "title": "¿Cómo se hace?",
             "text": "Cuando no entiendes algo o necesitas apoyo, puedes decir: '¿Puedes ayudarme con esto?' o '¿Me explicas esta parte, por favor?'"},
            {"type": "practice",     "lumi_state": "thinking",
             "question": "No entiendes una tarea en clase. ¿Qué haces?",
             "options": [
                 {"text": "Le digo al maestro que no entendí y pido explicación", "correct": True},
                 {"text": "Me quedo callado y no hago nada",                       "correct": False},
                 {"text": "Copio la tarea de un compañero",                        "correct": False},
             ]},
            {"type": "feedback",     "lumi_state": "happy",       "title": "¡Muy bien!",
             "text": "Pedir ayuda es una habilidad importante. Muestra que quieres aprender y mejorar."},
            {"type": "closing",      "lumi_state": "encouraging", "title": "¡Lo lograste!",
             "text": "Recuerda: siempre puedes pedir ayuda. Los maestros y amigos están para apoyarte.", "badge_emoji": "🙏"},
        ],
    },
    {
        "id": 4,
        "emoji": "⏳",
        "title": "Esperar turno",
        "description": "Aprende a esperar pacientemente tu turno",
        "steps": [
            {"type": "objective",    "lumi_state": "happy",       "title": "¿Qué aprenderemos hoy?",
             "text": "Cuando esperamos nuestro turno, demostramos respeto por los demás. Hoy aprenderemos cómo hacerlo."},
            {"type": "explanation",  "lumi_state": "thinking",    "title": "¿Cómo se hace?",
             "text": "Si quieres decir algo pero alguien más está hablando, espera a que termine. Puedes respirar profundo mientras esperas y pensar en lo que quieres decir."},
            {"type": "practice",     "lumi_state": "thinking",
             "question": "Quieres decir algo pero tu amigo está hablando. ¿Qué haces?",
             "options": [
                 {"text": "Espero a que termine y luego hablo",  "correct": True},
                 {"text": "Lo interrumpo porque es urgente",      "correct": False},
                 {"text": "Me frustro y me voy",                  "correct": False},
             ]},
            {"type": "feedback",     "lumi_state": "happy",       "title": "¡Excelente!",
             "text": "Esperar el turno muestra que respetas a los demás. ¡Eso es muy importante para hacer amigos!"},
            {"type": "closing",      "lumi_state": "encouraging", "title": "¡Fantástico!",
             "text": "Practicar la paciencia se vuelve más fácil cada día. ¡Sigue adelante!", "badge_emoji": "⏳"},
        ],
    },
    {
        "id": 5,
        "emoji": "💪",
        "title": "Manejar la frustración",
        "description": "Aprende qué hacer cuando algo te molesta",
        "steps": [
            {"type": "objective",    "lumi_state": "happy",       "title": "¿Qué aprenderemos hoy?",
             "text": "A veces las cosas no salen como queremos y nos sentimos frustrados. Es normal. Hoy aprenderemos qué hacer."},
            {"type": "explanation",  "lumi_state": "thinking",    "title": "¿Cómo se hace?",
             "text": "Cuando te sientas frustrado, puedes: 1) Respirar profundo 3 veces. 2) Alejarte un momento. 3) Decir cómo te sientes con palabras calmadas."},
            {"type": "practice",     "lumi_state": "thinking",
             "question": "Un juego no funciona como quieres y sientes que te enojarás. ¿Qué haces?",
             "options": [
                 {"text": "Respiro profundo y me tomo un momento", "correct": True},
                 {"text": "Tiro o golpeo el juego",                 "correct": False},
                 {"text": "Grito de frustración",                   "correct": False},
             ]},
            {"type": "feedback",     "lumi_state": "happy",       "title": "¡Muy bien!",
             "text": "Respirar es una herramienta poderosa. Calma el cuerpo y la mente para que puedas pensar mejor."},
            {"type": "closing",      "lumi_state": "encouraging", "title": "¡Lo lograste!",
             "text": "Manejar la frustración es una habilidad que te ayudará toda la vida. ¡Eres muy valiente!", "badge_emoji": "💪"},
        ],
    },
]

_SCENARIO_MAP: dict[int, ScenarioFull] = {
    s["id"]: ScenarioFull(
        id=s["id"],
        emoji=s["emoji"],
        title=s["title"],
        description=s["description"],
        steps=[
            ScenarioStep(
                type=step["type"],
                lumi_state=step["lumi_state"],
                title=step.get("title"),
                text=step.get("text"),
                question=step.get("question"),
                options=[ScenarioOption(**o) for o in step["options"]] if "options" in step else None,
                badge_emoji=step.get("badge_emoji"),
            )
            for step in s["steps"]
        ],
    )
    for s in SCENARIOS_DATA
}


def list_scenarios() -> list[ScenarioMeta]:
    return [ScenarioMeta(id=s.id, emoji=s.emoji, title=s.title, description=s.description)
            for s in _SCENARIO_MAP.values()]


def get_scenario(scenario_id: int) -> ScenarioFull:
    scenario = _SCENARIO_MAP.get(scenario_id)
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escenario no encontrado.",
        )
    return scenario


def complete_scenario(db: Session, user_id: int, scenario_id: int) -> ScenarioCompletion:
    if scenario_id not in _SCENARIO_MAP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escenario no encontrado.",
        )
    entry = ScenarioCompletion(user_id=user_id, scenario_id=scenario_id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
