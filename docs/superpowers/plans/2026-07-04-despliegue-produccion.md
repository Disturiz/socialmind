# Despliegue en Producción — Contabo + Easypanel: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la infraestructura Docker de producción para desplegar SocialMind en un VPS Contabo con Easypanel ya instalado.

**Architecture:** Un stack `docker-compose.prod.yml` con tres servicios (db, backend, nginx). El frontend se compila con Vite en un multi-stage Dockerfile y se sirve con Nginx, que también proxea `/api/` al backend. Easypanel/Traefik maneja SSL en el borde; los contenedores solo escuchan en HTTP.

**Tech Stack:** Docker + Docker Compose, Nginx, PostgreSQL 15, Python 3.11, Node 20, Easypanel/Traefik.

## Global Constraints

- Sin cambios al código de aplicación — solo archivos de infraestructura.
- `VITE_API_URL=https://socialmind.it.com` baked en el build del frontend (build arg).
- Backend corre con `--workers 2` y sin `--reload` en producción.
- `alembic upgrade head` corre automáticamente antes de arrancar uvicorn.
- `restart: always` en todos los servicios de producción.
- Solo el servicio `nginx` expone puerto (80) — backend sin ports directos al host.
- `.env` real nunca se commitea (ya está en `.gitignore`). Solo `.env.prod.example`.
- Dominio: `socialmind.it.com`.
- `CORS_ORIGINS=https://socialmind.it.com` en el `.env` de producción.

---

## File Map

| Archivo | Acción |
|---------|--------|
| `docker-compose.prod.yml` | Crear |
| `frontend/Dockerfile.prod` | Crear |
| `frontend/nginx.conf` | Crear |
| `.env.prod.example` | Crear |

---

## Task 1: `docker-compose.prod.yml`

**Files:**
- Create: `docker-compose.prod.yml`

**Interfaces:**
- Produces: stack verificable con `docker-compose -f docker-compose.prod.yml config`
- Consume (Task 2): servicio `nginx` referencia `frontend/Dockerfile.prod`

- [ ] **Step 1: Crear `docker-compose.prod.yml`**

Crear el archivo en la raíz del proyecto con exactamente este contenido:

```yaml
version: '3.9'

services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - socialmind_net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    networks:
      - socialmind_net
    command: >
      sh -c "alembic upgrade head &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"

  nginx:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      args:
        VITE_API_URL: https://socialmind.it.com
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - socialmind_net

volumes:
  postgres_data:

networks:
  socialmind_net:
    driver: bridge
```

- [ ] **Step 2: Verificar que el YAML es válido**

```bash
docker-compose -f docker-compose.prod.yml config
```

Expected: imprime el YAML resuelto sin errores. Si hay error de sintaxis, lo señalará con línea exacta.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "feat: docker-compose.prod.yml — stack de producción"
```

---

## Task 2: `frontend/Dockerfile.prod` + `frontend/nginx.conf`

**Files:**
- Create: `frontend/Dockerfile.prod`
- Create: `frontend/nginx.conf`

**Interfaces:**
- Consumes (de Task 1): el servicio `nginx` en compose referencia `context: ./frontend, dockerfile: Dockerfile.prod`
- Produces: imagen Docker que sirve el SPA en puerto 80 y proxea `/api/` a `backend:8000`

- [ ] **Step 1: Crear `frontend/Dockerfile.prod`**

```dockerfile
# Stage 1: Build React
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=https://socialmind.it.com
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Serve con Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 2: Crear `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 3: Verificar que el Dockerfile construye correctamente**

Desde la raíz del proyecto:

```bash
docker build -f frontend/Dockerfile.prod frontend/ -t sm-nginx-test
```

Expected: build exitoso con mensaje `Successfully built ...` (o equivalente en BuildKit). El stage 1 corre `npm run build` y el stage 2 copia `/dist` a Nginx.

Si falla en `npm ci`: verificar que `frontend/package.json` y `frontend/package-lock.json` existen.  
Si falla en `npm run build`: correr `cd frontend && npm run build` localmente para ver el error.

- [ ] **Step 4: Verificar que el Nginx config es válido dentro del contenedor**

```bash
docker run --rm sm-nginx-test nginx -t
```

Expected:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

- [ ] **Step 5: Limpiar imagen de test**

```bash
docker rmi sm-nginx-test
```

- [ ] **Step 6: Commit**

```bash
git add frontend/Dockerfile.prod frontend/nginx.conf
git commit -m "feat: Dockerfile.prod y nginx.conf — build y serve del frontend en producción"
```

---

## Task 3: `.env.prod.example`

**Files:**
- Create: `.env.prod.example`

**Interfaces:**
- Produce: referencia documentada de todas las variables requeridas en producción

- [ ] **Step 1: Crear `.env.prod.example`**

```env
# ============================================================
# SocialMind — Variables de entorno para PRODUCCIÓN
# ============================================================
# Copiar este archivo a .env en el VPS y completar los valores.
# NUNCA commitear .env con valores reales.
# ============================================================

# Base de datos PostgreSQL
POSTGRES_DB=socialmind
POSTGRES_USER=socialmind_user
POSTGRES_PASSWORD=CAMBIA_ESTO_PASSWORD_LARGO_Y_SEGURO

# URL de conexión — 'db' es el nombre del servicio Docker
DATABASE_URL=postgresql://socialmind_user:CAMBIA_ESTO_PASSWORD_LARGO_Y_SEGURO@db:5432/socialmind

# JWT — generar con: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=CAMBIA_ESTO_CADENA_ALEATORIA_DE_64_CARACTERES
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# App
APP_ENV=production
CORS_ORIGINS=https://socialmind.it.com

# Anthropic — Chat IA
ANTHROPIC_API_KEY=sk-ant-api03-...
```

- [ ] **Step 2: Verificar que `.env` está en `.gitignore` y `.env.prod.example` no**

```bash
grep "^\.env$" .gitignore
```

Expected: imprime `.env` — confirma que el archivo real no se subirá a git.

```bash
grep "env.prod.example" .gitignore
```

Expected: sin output — `.env.prod.example` NO está ignorado (es intencional, se commitea).

- [ ] **Step 3: Commit**

```bash
git add .env.prod.example
git commit -m "docs: .env.prod.example — variables requeridas para despliegue en producción"
```

---

## Verificación final del stack completo (opcional, requiere .env con valores reales)

Una vez en el VPS con el `.env` completo:

```bash
docker-compose -f docker-compose.prod.yml up -d --build
docker-compose -f docker-compose.prod.yml ps
```

Expected: los tres servicios en estado `Up` (o `healthy` para db).

```bash
curl http://localhost/api/v1/health
```

Expected: `{"status": "ok"}` o similar (si existe el endpoint de health).

```bash
curl http://localhost/
```

Expected: HTML del index.html de React.
