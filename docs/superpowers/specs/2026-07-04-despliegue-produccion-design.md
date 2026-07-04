# Despliegue en Producción — VPS Contabo + Easypanel: Design Spec

**Fecha:** 2026-07-04  
**Autor:** Douglas Isturiz

---

## Contexto

SocialMind corre en desarrollo con `docker-compose.yml` usando volúmenes de código fuente, `--reload` en el backend y `npm run dev` en el frontend. Nada de eso es apto para producción. Este spec cubre la infraestructura mínima para un despliegue funcional en el VPS de Contabo con Easypanel ya instalado.

**Dominio:** `socialmind.it.com` (y `www.socialmind.it.com`)  
**SSL:** Traefik (gestionado por Easypanel) — automático, sin configuración adicional en los contenedores.

---

## Arquitectura

```
Internet → Traefik (Easypanel, SSL/443) → Nginx :80
                                            ├── /api/* → backend:8000
                                            └── /* → React SPA (dist/)
```

Un solo stack `docker-compose.prod.yml` con tres servicios:

| Servicio | Imagen base | Responsabilidad |
|----------|-------------|-----------------|
| `db` | `postgres:15-alpine` | Base de datos, volumen persistente |
| `backend` | `backend/Dockerfile` (existente) | FastAPI + Alembic migrations |
| `nginx` | `frontend/Dockerfile.prod` (nuevo) | Sirve React SPA + proxea `/api/` al backend |

Easypanel expone el servicio `nginx` en el dominio `socialmind.it.com`. Traefik agrega HTTPS automáticamente.

---

## Detalle por componente

### 1. `docker-compose.prod.yml`

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

**Diferencias vs. `docker-compose.yml` (dev):**
- Sin `volumes:` de código fuente en backend ni frontend
- Sin `--reload` en backend
- `--workers 2` en uvicorn
- `restart: always` en todos los servicios
- Solo Nginx expone puerto (80), backend sin ports directos
- Build arg `VITE_API_URL=https://socialmind.it.com` para el frontend

### 2. `frontend/Dockerfile.prod` — multi-stage build

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

**Por qué `VITE_API_URL=https://socialmind.it.com`:**  
El código en `frontend/src/services/api.js` construye el baseURL como `${VITE_API_URL}/api/v1`. Con el dominio completo, las llamadas quedan `https://socialmind.it.com/api/v1/...`. Es el mismo origen que la página, sin CORS cross-origin. Nginx recibe `/api/v1/...` y proxea al backend.

### 3. `frontend/nginx.conf`

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

### 4. `.env.prod.example`

```env
# Base de datos
POSTGRES_DB=socialmind
POSTGRES_USER=socialmind_user
POSTGRES_PASSWORD=CAMBIA_ESTO_SECRETO_LARGO

# URL de conexión (db = nombre del servicio Docker)
DATABASE_URL=postgresql://socialmind_user:CAMBIA_ESTO_SECRETO_LARGO@db:5432/socialmind

# JWT
JWT_SECRET_KEY=CAMBIA_ESTO_CADENA_ALEATORIA_64_CHARS
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# App
APP_ENV=production
CORS_ORIGINS=https://socialmind.it.com

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

Este archivo se commitea sin valores reales. En el VPS se crea `.env` a partir de este ejemplo con los valores reales. El `.env` real NUNCA se commitea.

---

## Workflow de despliegue (primera vez)

En el VPS, dentro del directorio del proyecto:

```bash
# 1. Clonar el repo
git clone https://github.com/Disturiz/socialmind.git
cd socialmind

# 2. Crear .env con valores de producción
cp .env.prod.example .env
# Editar .env con nano o vim

# 3. Levantar el stack
docker-compose -f docker-compose.prod.yml up -d --build

# 4. En Easypanel: exponer el servicio nginx en socialmind.it.com
#    Traefik agrega SSL automáticamente
```

## Workflow de actualización (deploys futuros)

```bash
git pull origin main
docker-compose -f docker-compose.prod.yml up -d --build
```

Alembic corre automáticamente al iniciar el backend (el `command` en compose ya lo incluye).

---

## .gitignore

Verificar que `.env` (con valores reales) ya está en `.gitignore`. `.env.prod.example` sí se commitea.

---

## Restricciones

- Sin CI/CD automático en V1 — deploy manual por SSH.
- Sin certificado SSL gestionado por nosotros — Traefik/Easypanel lo hace.
- `backend/Dockerfile` existente no se modifica — ya es válido para producción.
- Sin cambios a código de aplicación — solo infraestructura.
- `www.socialmind.it.com` → configurar en Easypanel como dominio adicional apuntando al mismo servicio nginx.
