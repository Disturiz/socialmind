STARS_PER_EVENT = {
    "scenario_completed": 10,
    "calm_session": 5,
    "lumi_chat": 3,
    "daily_streak": 15,
}

LEVELS = [
    {"key": "explorador",     "name": "Explorador",           "min_stars": 0},
    {"key": "aventurero",     "name": "Aventurero",           "min_stars": 50},
    {"key": "heroe_social",   "name": "Héroe Social",         "min_stars": 150},
    {"key": "guardian_calma", "name": "Guardián de la Calma", "min_stars": 300},
    {"key": "companero_lumi", "name": "Compañero de Lumi",    "min_stars": 500},
]

BADGES = [
    {"key": "primer_paso",       "name": "Primer Paso",          "condition": {"event_type": "scenario_completed", "count": 1}},
    {"key": "social_pro",        "name": "Social Pro",           "condition": {"event_type": "scenario_completed", "count": 5}},
    {"key": "maestro_social",    "name": "Maestro Social",       "condition": {"unique_scenarios": 5}},
    {"key": "momento_tranquilo", "name": "Momento Tranquilo",    "condition": {"event_type": "calm_session", "count": 1}},
    {"key": "zen",               "name": "Zen",                  "condition": {"event_type": "calm_session", "count": 10}},
    {"key": "buen_conversador",  "name": "Buen Conversador",     "condition": {"event_type": "lumi_chat", "count": 1}},
    {"key": "amigo_lumi",        "name": "Amigo de Lumi",        "condition": {"event_type": "lumi_chat", "count": 10}},
    {"key": "semana_completa",   "name": "Semana Completa",      "condition": {"streak": 7}},
    {"key": "mes_dedicado",      "name": "Mes Dedicado",         "condition": {"streak": 30}},
    {"key": "nivel_aventurero",  "name": "Aventurero",           "condition": {"level": "aventurero"}},
    {"key": "nivel_heroe",       "name": "Héroe Social",         "condition": {"level": "heroe_social"}},
    {"key": "nivel_guardian",    "name": "Guardián de la Calma", "condition": {"level": "guardian_calma"}},
    {"key": "nivel_companero",   "name": "Compañero de Lumi",    "condition": {"level": "companero_lumi"}},
]
