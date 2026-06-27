# Proyecto_Social_Mind.md

# Prototipo V1

# Plataforma Inteligente de Apoyo Social y Educativo para Personas en el Espectro Autista Grado 1

---

# 1. PROPÓSITO DEL PROYECTO

SocialMind es una plataforma multimedia e inteligente orientada inicialmente a niños y adolescentes dentro del espectro autista grado 1.
Segunda etapa desarrollar la plataforma para incluir adultos.

El objetivo principal del prototipo es demostrar que una plataforma accesible, calmada y pedagógica apoyada por inteligencia artificial puede ayudar al desarrollo de habilidades sociales, emocionales y comunicacionales.

La plataforma NO debe:

- diagnosticar condiciones médicas
- reemplazar terapia profesional
- emitir recomendaciones clínicas
- realizar evaluaciones psicológicas

La plataforma SÍ debe:

- apoyar habilidades sociales
- ofrecer ejercicios guiados
- promover regulación emocional
- explicar conceptos de forma simple
- crear experiencias seguras y accesibles

---

# 2. OBJETIVO DEL PROTOTIPO V1

El objetivo del prototipo NO es construir el producto completo.

El objetivo es validar:

- experiencia de usuario
- accesibilidad cognitiva
- interacción guiada con IA
- utilidad pedagógica
- aceptación por profesionales TEA

---

# 3. PÚBLICO OBJETIVO

Usuarios principales:

- niños y adolescentes de 8 a 17 años
- autismo grado 1

Usuarios secundarios:

- padres
- terapeutas
- psicólogos
- docentes
- instituciones educativas

---

# 4. PRINCIPIOS CRÍTICOS DE DISEÑO

## Accesibilidad Cognitiva

La interfaz debe:

- ser simple
- calmada
- estructurada
- intuitiva

Evitar:

- exceso de animaciones
- sonidos agresivos
- interfaces sobrecargadas
- demasiados elementos simultáneos

---

## Diseño Sensorial

Usar:

- colores suaves
- espacios amplios
- botones grandes
- transiciones suaves
- tipografía clara

Evitar:

- flashes
- movimientos bruscos
- colores extremadamente intensos
- sobreestimulación visual

---

## Comunicación

Toda la aplicación debe:

- usar frases cortas
- lenguaje simple
- instrucciones claras
- retroalimentación positiva

La IA debe:

- responder de forma calmada
- evitar sarcasmo
- evitar ambigüedad
- evitar ironías complejas
- ser empática
- ser pedagógica

---

# 5. STACK TECNOLÓGICO

## Frontend

- React
- Vite
- Tailwind CSS
- Framer Motion
- React Router
- Axios

## Backend

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT Authentication

## IA

- Sonnet
- LLM conversacional guiado
- Moderación de contenido
- RAG futuro
- infografias

## Infraestructura

- Docker
- Docker Compose
- Easypanel
- VPS Contabo

---

# 6. ARQUITECTURA GENERAL

Frontend:

- interfaz accesible
- mobile first
- responsive
- PWA

Backend:

- API REST
- autenticación JWT
- endpoints modulares

Base de datos:

- usuarios por tipos
- escenarios sociales
- emociones
- progreso
- conversaciones

---

# 7. MÓDULOS A DESARROLLAR V1

## Módulo 1 — Bienvenida

Pantalla inicial:

- personaje guía amigable
- bienvenida calmada
- diseño limpio
- navegación simple

Debe transmitir:

- seguridad
- tranquilidad
- empatía

---

## Módulo 2 — Selector emocional

El usuario debe poder seleccionar emociones como:

- feliz
- nervioso
- confundido
- frustrado
- cansado

La pantalla debe:

- usar íconos grandes
- tener colores suaves
- evitar exceso de texto

---

## Módulo 3 — Escenarios Sociales

Debe incluir inicialmente:

1. Saludar
2. Hablar con un compañero
3. Pedir ayuda
4. Esperar turno
5. Manejar frustración

Cada escenario debe contener:

- objetivo pedagógico
- explicación inicial
- conversación guiada
- retroalimentación positiva
- cierre motivacional

---

## Módulo 4 — Chat IA Guiado

La IA NO debe ser completamente libre.

La conversación debe:

- seguir flujos guiados
- usar respuestas cortas
- ofrecer botones de opciones

Ejemplo:

- "Responder amablemente"
- "Pedir ayuda"
- "Respirar primero"

---

## Módulo 5 — Zona de Calma

Debe incluir:

- respiración guiada
- temporizador visual
- frases calmadas
- pausa sensorial

Diseño:

- minimalista
- relajante
- silencioso

---

## Módulo 6 — Panel Profesional Básico

Debe mostrar:

- escenarios completados
- emociones frecuentes
- actividades realizadas

NO mostrar:

- diagnósticos
- evaluaciones clínicas

---

# 8. REGLAS IMPORTANTES PARA GENERACIÓN DE CÓDIGO

## Código

Todo el código debe ser:

- limpio
- modular
- escalable
- comentado
- profesional

---

## Frontend

Usar:

- componentes reutilizables
- arquitectura limpia
- separación clara

Priorizar:

- accesibilidad
- UX/UI
- simplicidad

---

## Backend

Usar:

- routers separados
- servicios desacoplados
- validaciones
- manejo de errores
- logs

---

## Seguridad

Siempre:

- usar variables .env
- proteger secretos
- validar inputs
- sanitizar datos
- usar JWT seguro

Nunca:

- exponer API keys
- guardar secretos en frontend

---

# 9. EXPERIENCIA VISUAL

La aplicación debe sentirse:

- amigable
- moderna
- segura
- relajante
- pedagógica

Inspiración visual:

- Duolingo
- Headspace
- Khan Academy Kids

Pero con:

- menor ruido visual
- menos estimulación
- navegación más calmada

---

# 10. ROADMAP

## ETAPA 1

- estructura inicial
- docker
- frontend base
- backend base
- autenticación

## ETAPA 2

- selector emocional
- escenarios sociales
- flujo pedagógico

## ETAPA 3

- integración IA
- conversaciones guiadas

## ETAPA 4

- zona de calma
- sonidos suaves
- multimedia

## ETAPA 5

- dashboard institucional
- reportes
- despliegue

---

# 11. PROMPTS BASE PARA CLAUDE

## Prompt inicial

Lee completamente AGENTS.md y crea la estructura profesional inicial del proyecto SocialMind siguiendo exactamente la arquitectura y principios definidos.

---

## Prompt Backend

Construye el backend inicial utilizando FastAPI, PostgreSQL, JWT y SQLAlchemy siguiendo arquitectura modular profesional.

---

## Prompt Frontend

Construye un frontend accesible utilizando React, Tailwind y Framer Motion con diseño calmado y amigable para niños y adolescentes TEA.

---

## Prompt IA

Construye un servicio de IA guiada utilizando Sonnet con respuestas pedagógicas, calmadas y accesibles.

---

# 12. MISIÓN DEL PROYECTO

Construir tecnología con impacto humano real.

La prioridad del proyecto no es impresionar técnicamente, sino ayudar genuinamente a personas dentro del espectro autista mediante experiencias accesibles, empáticas y pedagógicas.
