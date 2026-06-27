# Guía de Prueba Local — SocialMind

Guía paso a paso para levantar y probar todos los módulos de SocialMind en tu máquina.

---

## Requisitos previos

- **Docker Desktop** instalado y corriendo (ícono en la bandeja del sistema activo)
- Archivo `.env` configurado en la raíz del proyecto (ver sección siguiente)

---

## 1. Configurar variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```bash
# En la raíz del proyecto (C:\Users\distu\socialmind)
copy .env.example .env
```

Edita `.env` con estos valores mínimos:

```env
# Base de datos
POSTGRES_DB=socialmind
POSTGRES_USER=socialmind_user
POSTGRES_PASSWORD=socialmind_pass_local
DATABASE_URL=postgresql://socialmind_user:socialmind_pass_local@db:5432/socialmind

# JWT (cualquier cadena larga y aleatoria)
JWT_SECRET_KEY=clave_super_secreta_para_desarrollo_local_123456
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# App
APP_ENV=development
CORS_ORIGINS=http://localhost:3000

# APIs de IA (requeridas para Chat y Biblioteca)
ANTHROPIC_API_KEY=sk-ant-...    ← tu clave real aquí
OPENAI_API_KEY=sk-...           ← tu clave real aquí
```

> **Nota:** Sin `ANTHROPIC_API_KEY`, el Chat con Lumi y la Zona de Calma funcionarán con un mensaje de fallback. Sin `OPENAI_API_KEY`, la Biblioteca no podrá procesar PDFs.

---

## 2. Levantar la aplicación

Abre una terminal en la raíz del proyecto y ejecuta:

```bash
docker compose up --build
```

La primera vez tarda 2-4 minutos (descarga imágenes, instala dependencias). Verás logs de los tres servicios: `db`, `backend`, `frontend`.

La aplicación está lista cuando veas:

```
socialmind_backend   | INFO:     Application startup complete.
socialmind_frontend  | Local:   http://localhost:3000/
```

### URLs

| Servicio | URL |
|---|---|
| Aplicación web | http://localhost:3000 |
| API REST (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

### Detener la aplicación

```bash
# Ctrl+C para parar los logs, luego:
docker compose down

# Para borrar también la base de datos (datos):
docker compose down -v
```

---

## 3. Módulos y cómo probarlos

### 3.1 Registro e inicio de sesión

**URL:** http://localhost:3000

#### Crear cuenta de Padre/Familia

1. Click en **"Registrarse"** en la pantalla de bienvenida
2. Completar:
   - Nombre completo: `Juan García`
   - Email: `juan@test.com`
   - Contraseña: `Test1234` _(mínimo 8 caracteres)_
   - Rol: **Padre / Familia** (por defecto)
3. Click en **"Crear cuenta"** → redirige al Dashboard

#### Crear cuenta de Especialista

1. Volver a http://localhost:3000 y click en **"Registrarse"**
2. Completar:
   - Nombre completo: `Dra. Ana López`
   - Email: `ana@test.com`
   - Contraseña: `Test1234`
   - Rol: **Especialista**
3. Click en **"Crear cuenta"** → redirige al Dashboard del especialista (muestra módulos adicionales)

---

### 3.2 Dashboard

**Acceso:** Automático tras iniciar sesión.

- **Como Padre:** verás 4 tarjetas — Selector emocional, Escenarios sociales, Chat con Lumi, Zona de calma
- **Como Especialista:** verás esas 4 más Panel Profesional y Biblioteca

Haz click en cualquier tarjeta para navegar al módulo.

---

### 3.3 Selector Emocional

**URL:** http://localhost:3000/emociones

1. Se muestran 5 emociones con emoji grande: Feliz 😊, Nervioso 😰, Confundido 🤔, Frustrado 😤, Cansado 😴
2. Click en cualquier emoción → el sistema registra la selección y navega a los escenarios
3. Vuelve al Dashboard (botón atrás o header)

---

### 3.4 Escenarios Sociales

**URL:** http://localhost:3000/escenarios

Hay 5 escenarios disponibles:

| # | Escenario |
|---|---|
| 1 | 🙋 Saludar |
| 2 | 💬 Hablar con un compañero |
| 3 | 🙏 Pedir ayuda |
| 4 | ⏳ Esperar turno |
| 5 | 💪 Manejar la frustración |

**Flujo de cada escenario:**

1. Click en un escenario → pantalla de objetivo ("¿Qué aprenderemos hoy?")
2. Botón **"Siguiente"** → pantalla de explicación
3. Botón **"Siguiente"** → pantalla de práctica con 3 opciones
4. Seleccionar una opción → feedback de Lumi (correcto/incorrecto)
5. Botón **"Siguiente"** → pantalla de cierre con badge logrado 🌟
6. Botón **"Terminar"** → vuelve a la lista

**Verificar:** al seleccionar la opción correcta, Lumi muestra estado `happy`. Con opción incorrecta, muestra feedback de corrección.

---

### 3.5 Chat con Lumi

**URL:** http://localhost:3000/chat

> Requiere `ANTHROPIC_API_KEY` válida en `.env`.

1. Lumi aparece con un saludo inicial y 3-4 botones de respuesta
2. Seleccionar un botón → Lumi responde con nuevo mensaje y nuevas opciones
3. El chat siempre termina con la opción **"Terminar"**
4. El niño **nunca escribe texto libre** — solo selecciona botones

**Casos a probar:**
- Seleccionar "Terminar" en cualquier momento → cierra el chat correctamente
- Navegar al chat desde el Selector Emocional → Lumi adapta el tono a la emoción registrada
- Si la biblioteca tiene PDFs cargados, Lumi puede buscar en ellos automáticamente (tool use RAG)

---

### 3.6 Zona de Calma

**URL:** http://localhost:3000/calma

> Requiere `ANTHROPIC_API_KEY` válida para la frase de Lumi. Sin clave, muestra frase de fallback.

**Flujo:**

1. Seleccionar actividad:
   - 🌬️ **Respirar** — ejercicio de respiración guiada
   - ⏸️ **Pausar** — temporizador visual de pausa
   - 💬 **Frase calmante** — Lumi genera una frase personalizada

2. Completar la actividad
3. Botón **"Listo"** → registra la sesión y vuelve al Dashboard

**Respiración guiada:**
- Animación visual de inhalar / sostener / exhalar
- Contador de ciclos completados
- Botón para detener en cualquier momento

---

### 3.7 Panel Profesional

**URL:** http://localhost:3000/panel

> Solo accesible con rol `specialist`. Un usuario `parent` que intente entrar es redirigido al Dashboard.

**Flujo:**

1. Iniciar sesión como especialista (`ana@test.com`)
2. Dashboard → tarjeta **"Panel Profesional"**
3. Ver lista de todos los perfiles de niños registrados en la plataforma
4. Click en un perfil → ver historial:
   - Últimas emociones registradas
   - Sesiones de calma completadas
   - Conversaciones con Lumi
5. Agregar nota al especialista: campo de texto + botón **"Guardar nota"**
6. La nota queda asociada al perfil del niño

**Nota:** Los datos aparecen si hubo actividad previa. Para ver datos, primero usa los módulos con la cuenta `parent`.

---

### 3.8 Biblioteca

**URL:** http://localhost:3000/biblioteca

> Solo accesible con rol `specialist`. Requiere `OPENAI_API_KEY` para procesar PDFs.

**Subir un PDF:**

1. Iniciar sesión como especialista
2. Dashboard → tarjeta **"Biblioteca"**
3. Click en el selector de archivo → elegir un PDF (máx. 10 MB)
4. Click en **"Subir documento"** → el botón muestra **"Subiendo..."**
5. Al completar, el documento aparece en la lista con:
   - Nombre original del archivo
   - Tamaño (KB/MB)
   - Fecha de subida
   - Badge de estado: 🟢 **listo** / 🟡 **procesando** / 🔴 **error**

**Eliminar un documento:**

1. Click en **"Eliminar"** en la tarjeta del documento
2. Aparece confirmación inline: "¿Eliminar este documento?" con botones **"Sí, eliminar"** y **"Cancelar"**
3. Confirmar → el documento desaparece de la lista

**Estado vacío:** si no hay documentos, muestra "Aún no hay documentos en la biblioteca."

**Probar el RAG:**

1. Subir un PDF con contenido sobre autismo o desarrollo social
2. Ir al Chat con Lumi y hacer que el niño mencione un tema relacionado
3. Lumi buscará automáticamente en la biblioteca y enriquecerá su respuesta

---

## 4. API REST — Swagger UI

Accede a http://localhost:8000/docs para ver y probar todos los endpoints directamente.

**Autenticación en Swagger:**

1. `POST /api/v1/auth/login` → copiar el `access_token` de la respuesta
2. Click en botón **"Authorize"** (candado) en la esquina superior derecha
3. Pegar: `Bearer <token>` → **"Authorize"**

**Endpoints principales:**

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/v1/auth/register` | Crear cuenta |
| POST | `/api/v1/auth/login` | Iniciar sesión |
| GET | `/api/v1/auth/me` | Perfil del usuario actual |
| GET | `/api/v1/emotions` | Listar emociones disponibles |
| POST | `/api/v1/emotions/log` | Registrar emoción |
| GET | `/api/v1/scenarios` | Listar escenarios |
| GET | `/api/v1/scenarios/{id}` | Detalle de un escenario |
| POST | `/api/v1/chat/start` | Iniciar conversación con Lumi |
| POST | `/api/v1/chat/{id}/message` | Enviar mensaje al chat |
| POST | `/api/v1/calma/phrase` | Generar frase calmante |
| POST | `/api/v1/calma/session` | Registrar sesión de calma |
| GET | `/api/v1/panel/children` | Lista de niños (solo specialist) |
| POST | `/api/v1/biblioteca/upload` | Subir PDF (solo specialist) |
| GET | `/api/v1/biblioteca/documents` | Listar documentos |
| DELETE | `/api/v1/biblioteca/documents/{id}` | Eliminar documento |

---

## 5. Solución de problemas frecuentes

**El frontend muestra pantalla en blanco:**
- Esperar 30 segundos más; el servidor de Vite puede tardar en compilar
- Revisar logs: `docker compose logs frontend`

**Error "connection refused" al iniciar sesión:**
- El backend no está listo. Revisar: `docker compose logs backend`
- Si hay error de base de datos, esperar el healthcheck: `docker compose logs db`

**Chat no responde / muestra error:**
- Verificar que `ANTHROPIC_API_KEY` está en `.env` y es válida
- Reiniciar el backend: `docker compose restart backend`

**Subir PDF falla con error 500:**
- Verificar que `OPENAI_API_KEY` está en `.env` y es válida
- Verificar que el archivo es un PDF real (no renombrado)

**Reiniciar con base de datos limpia:**
```bash
docker compose down -v
docker compose up --build
```

---

## 6. Resumen de cuentas de prueba sugeridas

| Cuenta | Email | Contraseña | Rol | Módulos disponibles |
|---|---|---|---|---|
| Padre | `juan@test.com` | `Test1234` | parent | Emociones, Escenarios, Chat, Calma |
| Especialista | `ana@test.com` | `Test1234` | specialist | Todo lo anterior + Panel + Biblioteca |
