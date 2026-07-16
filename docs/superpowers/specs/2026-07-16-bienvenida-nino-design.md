# Diseño: Módulo Bienvenida del Niño

**Fecha:** 2026-07-16
**Estado:** Aprobado

## Objetivo

Crear una experiencia de primer ingreso para el niño después de que el padre registra su perfil. Lumi lo saluda por nombre en una secuencia corta de 3 pasos antes de llegar al panel principal.

## Contexto

La app ya tiene una pantalla `Welcome.jsx` en `/` para usuarios no autenticados (landing page). Este módulo es distinto: es la bienvenida personalizada para el niño, que ocurre una sola vez, justo después del onboarding del padre.

## Flujo y Trigger

1. El padre crea el perfil del niño en `ChildProfileForm.jsx`
2. Al guardar, en lugar de redirigir a `/inicio`, redirige a `/bienvenida`
3. `WelcomePage.jsx` lee el nombre del niño via `profilesApi.getMe()`
4. Al terminar la secuencia, navega a `/inicio`
5. El `ParentOnboardingGuard` ya no redirige porque el perfil existe — la bienvenida nunca vuelve a mostrarse de forma natural

No se necesita estado persistente (localStorage ni flag en backend). El flujo del onboarding garantiza que solo se muestra una vez.

## Contenido de los Pasos

| Paso | Estado Lumi | Texto |
|------|------------|-------|
| 1 | `happy` | "¡Hola, **[nombre]**! Soy Lumi, tu compañero en SocialMind. 👋" |
| 2 | `encouraging` | "Aquí vamos a aprender juntos a entender tus emociones y practicar situaciones del día a día." |
| 3 | `happy` | "¡Estoy muy contento de conocerte! ¿Listo para explorar?" |

- Pasos 1 y 2: botón "Siguiente →"
- Paso 3: botón "¡Vamos a explorar! 🚀" → navega a `/inicio`

## UI y Layout

```
┌─────────────────────────────┐
│                             │
│         🦉 Lumi             │  ← LumiCharacter (160px), flotando
│                             │
│  ┌───────────────────────┐  │
│  │ ¡Hola, Mateo! Soy    │  │  ← burbuja calm-surface, rounded-3xl
│  │ Lumi, tu compañero   │  │     fade-in + slide-up al cambiar paso
│  │ en SocialMind. 👋    │  │
│  └───────────────────────┘  │
│                             │
│        ● ○ ○               │  ← 3 puntitos de progreso
│                             │
│    [ Siguiente → ]          │  ← Button existente
│                             │
└─────────────────────────────┘
```

- Lumi cambia de estado (`happy` → `encouraging` → `happy`) al avanzar de paso
- Burbuja hace fade-out/in suave (Framer Motion `AnimatePresence`) al cambiar paso
- Sin botón "Atrás" — flujo lineal de onboarding
- `prefers-reduced-motion` cubierto globalmente en `index.css`
- Usa `PageWrapper`, `LumiCharacter`, `Button` existentes — sin nuevos componentes

## Archivos

### Nuevo
- `frontend/src/pages/WelcomePage.jsx` — página de bienvenida del niño

### Modificados
- `frontend/src/router/index.jsx` — agregar ruta `/bienvenida` con `ProtectedRoute`
- `frontend/src/pages/ChildProfileForm.jsx` — cambiar redirect de `/inicio` a `/bienvenida`

## Sin cambios en backend

No requiere migración de BD, endpoints nuevos, ni flag de `has_seen_welcome`.
