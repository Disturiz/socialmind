# SocialMind Etapa 7 — Sistema de Gamificación y Recompensas: Diseño y Especificación

**Fecha:** 2026-06-27
**Autor:** Douglas Isturiz
**Estado:** Aprobado

---

## Resumen

Sistema de gamificación para niños con autismo grado 1 que combina estrellas (puntos por acción), insignias (logros coleccionables) y niveles temáticos basados en la aventura con el personaje Lumi. El progreso es visible para el niño en una pantalla dedicada "Mi aventura", y también accesible para padres y especialistas en sus paneles existentes.

---

## Alcance de Etapa 7

**Incluido:**
- Modelos `reward_events` y `child_rewards` con migración Alembic
- Archivo de configuración `gamification/config.py` con reglas de estrellas, niveles e insignias
- Servicio `gamification_service.py` con `register_event()` y `get_child_progress()`
- Endpoint REST `GET /api/v1/gamification/progreso/{child_id}`
- Integración en servicios existentes: chat, zona de calma, escenarios sociales
- Pantalla `MiAventura.jsx` con ruta `/mi-aventura` (rol child)
- Componentes de gamificación: `StarCounter`, `LevelCard`, `BadgeGrid`, `BadgeItem`, `RewardCelebration`
- Sección de progreso en `ChildDetail.jsx` (panel especialista)
- Tarjeta de progreso por niño en Dashboard de padre
- Tests backend (pytest) y frontend (Vitest)

**Excluido:**
- Tienda de recompensas o canje de estrellas por premios
- Ranking entre niños (no aplica por diseño inclusivo)
- Notificaciones push al ganar recompensas
- Configuración de reglas desde el panel admin (las reglas están en código)

---

## Modelo de Datos

### Tabla `reward_events`
Log inmutable de cada acción premiada. Nunca se modifica una vez creada.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| child_id | UUID FK | Referencia al perfil del niño |
| event_type | Enum | `scenario_completed`, `calm_session`, `lumi_chat`, `daily_streak` |
| stars_earned | Integer | Estrellas otorgadas por este evento |
| created_at | Timestamp | Fecha y hora del evento |
| extra_data | JSON | Datos adicionales (ej: `scenario_id`) |

### Tabla `child_rewards`
Resumen cacheado por niño. Se actualiza con cada `register_event()`.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| child_id | UUID FK (único) | Un registro por niño |
| total_stars | Integer | Acumulado total de estrellas |
| current_level_key | String | Key del nivel actual (ej: `heroe_social`) |
| current_streak | Integer | Días consecutivos activos |
| last_activity_date | Date | Última fecha de actividad (para racha) |
| badges | JSON | Array de keys de insignias ganadas |
| updated_at | Timestamp | Última actualización |

---

## Configuración de Reglas (`gamification/config.py`)

### Estrellas por acción

| Acción | Estrellas |
|--------|-----------|
| Completar escenario social | 10 ⭐ |
| Usar zona de calma | 5 ⭐ |
| Chatear con Lumi | 3 ⭐ |
| Racha diaria (1 vez/día) | 15 ⭐ |

### Niveles — Aventura con Lumi

| Key | Nombre | Estrellas mínimas |
|-----|--------|-------------------|
| `explorador` | Explorador | 0 |
| `aventurero` | Aventurero | 50 |
| `heroe_social` | Héroe Social | 150 |
| `guardian_calma` | Guardián de la Calma | 300 |
| `companero_lumi` | Compañero de Lumi | 500 |

### Insignias (13 total)

| Key | Nombre | Condición |
|-----|--------|-----------|
| `primer_paso` | Primer Paso | Completar 1 escenario |
| `social_pro` | Social Pro | Completar 5 escenarios |
| `maestro_social` | Maestro Social | Completar todos los escenarios |
| `momento_tranquilo` | Momento Tranquilo | Usar zona de calma 1 vez |
| `zen` | Zen | Usar zona de calma 10 veces |
| `buen_conversador` | Buen Conversador | Chatear con Lumi 1 vez |
| `amigo_lumi` | Amigo de Lumi | Chatear con Lumi 10 veces |
| `semana_completa` | Semana Completa | Racha de 7 días |
| `mes_dedicado` | Mes Dedicado | Racha de 30 días |
| `nivel_aventurero` | Aventurero | Alcanzar nivel Aventurero |
| `nivel_heroe` | Héroe Social | Alcanzar nivel Héroe Social |
| `nivel_guardian` | Guardián de la Calma | Alcanzar nivel Guardián de la Calma |
| `nivel_companero` | Compañero de Lumi | Alcanzar nivel Compañero de Lumi |

---

## Backend

### Estructura de archivos

```
backend/app/gamification/
  __init__.py
  config.py       ← STARS_PER_EVENT, LEVELS, BADGES
  models.py       ← RewardEvent, ChildRewards (SQLAlchemy)
  schemas.py      ← Pydantic: ProgressResponse, BadgeInfo, LevelInfo
  service.py      ← register_event(), get_child_progress()
  router.py       ← GET /api/v1/gamification/progreso/{child_id}
```

### Lógica de `register_event(db, child_id, event_type)`

1. Crear registro en `reward_events` con estrellas según `STARS_PER_EVENT[event_type]`
2. Evaluar racha diaria: si `last_activity_date` es ayer → incrementar streak y crear evento `daily_streak` (15 ⭐); si es hoy → no crear evento de racha ni cambiar streak; si es anterior → resetear streak a 1 y crear evento `daily_streak` (15 ⭐). El evento `daily_streak` se dispara máximo una vez por día, al realizar cualquier acción.
3. Actualizar `total_stars` en `child_rewards`
4. Recalcular `current_level_key` según umbrales de `LEVELS`
5. Evaluar cada badge en `BADGES` contra conteos de `reward_events` — agregar las nuevas al JSON `badges`
6. Retornar `{ new_badges: [...], level_up: bool }` para que el frontend muestre celebración

### Endpoints

`GET /api/v1/gamification/progreso/{child_id}`
- Accesible por: el propio niño, su padre, especialistas asignados, admin
- Respuesta: `ProgressResponse` con total_stars, nivel actual, próximo nivel, % de progreso, streak, lista de badges (ganadas + bloqueadas)

### Puntos de integración

Los siguientes servicios existentes llaman a `register_event` al completar su acción principal:

- `chat_service.py` → `register_event(db, child_id, "lumi_chat")` al iniciar una nueva sesión de chat (una vez por sesión, no por cada mensaje)
- Endpoint `POST /api/v1/calma/sesiones` → `register_event(db, child_id, "calm_session")` al crear sesión
- Endpoint de completar escenario → `register_event(db, child_id, "scenario_completed", extra_data={"scenario_id": ...})`

---

## Frontend

### Pantalla `MiAventura.jsx` (`/mi-aventura`)

Accesible solo con rol `child` (usando `ChildRoute` existente).

**Estructura visual (de arriba a abajo):**
1. `StarCounter` — total de estrellas y racha actual (días consecutivos)
2. `LevelCard` — nombre del nivel con ilustración de Lumi, barra de progreso al siguiente nivel
3. `BadgeGrid` — grilla de 13 insignias: ganadas en color, bloqueadas en gris con candado
4. `RewardCelebration` — overlay de animación al ganar insignia o subir de nivel

**Principios sensoriales aplicados:**
- Sin flashes ni sonidos bruscos
- Animación de celebración: brillo suave o confeti lento
- Colores de insignias: paleta suave del proyecto (no saturados)
- Texto en insignias bloqueadas: descripción de cómo desbloquearla

### Componentes nuevos

```
frontend/src/components/gamification/
  StarCounter.jsx       ← ⭐ total + 🔥 racha
  LevelCard.jsx         ← nivel + barra de progreso
  BadgeGrid.jsx         ← grilla responsive de badges
  BadgeItem.jsx         ← badge individual (ganada/bloqueada)
  RewardCelebration.jsx ← animación de celebración (Framer Motion)
```

### Integración en paneles existentes

**`ChildDetail.jsx` (panel especialista):**
Nueva sección "Progreso y recompensas" debajo de la información existente:
- Nivel actual + estrellas totales + racha
- Grilla reducida de insignias ganadas (solo las obtenidas)

**Dashboard padre:**
Tarjeta de progreso por cada perfil de niño:
- Avatar del niño + nivel actual + total estrellas + racha

### API

`frontend/src/api/gamificationApi.js`
- `getChildProgress(childId)` → `GET /api/v1/gamification/progreso/{childId}`

---

## Tests

### Backend (pytest)
- `test_register_event`: estrellas correctas por tipo de evento
- `test_daily_streak`: lógica de racha (incremento, reset, mismo día)
- `test_badge_evaluation`: cada insignia se otorga en la condición exacta
- `test_level_up`: nivel cambia al cruzar umbral
- `test_get_child_progress`: endpoint retorna estructura completa
- `test_permissions`: solo roles autorizados acceden al progreso

### Frontend (Vitest)
- `StarCounter`: renderiza estrellas y racha correctamente
- `BadgeGrid`: muestra ganadas en color, bloqueadas en gris
- `LevelCard`: barra de progreso con porcentaje correcto
- `MiAventura`: integración completa con datos mockeados

---

## Migraciones Alembic

Una migración nueva crea ambas tablas: `reward_events` y `child_rewards`.
