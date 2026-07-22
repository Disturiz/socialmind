# Términos y Condiciones + Política de Privacidad

**Fecha:** 2026-07-21
**Estado:** Diseño aprobado — listo para plan de implementación

## Contexto y objetivo

SocialMind está en producción sin ninguna página legal (`Grep` de "terminos|privacidad|Terms|Privacy|legal" en `frontend/src` no encontró coincidencias) ni footer en la app. Douglas quiere una sección de Términos y Condiciones para, entre otras cosas, dejar explícito que el contenido y diseño de la plataforma no puede copiarse ni reproducirse (protección contra plagio), además de cubrir el manejo de datos de los niños que usan la plataforma.

Objetivo: agregar páginas legales accesibles públicamente, con un checkbox de aceptación obligatorio en el registro que quede registrado en la base de datos como evidencia.

## Alcance de esta fase

- Páginas de Términos y Privacidad como rutas públicas independientes.
- Checkbox de aceptación obligatorio en el formulario de registro.
- Registro persistente (con fecha) de que el usuario aceptó, en el backend.
- Enlaces visibles solo en páginas públicas (Welcome, Login, Registro) — no se agrega footer al dashboard interno en esta fase.

Fuera de alcance: panel de administración de versiones de términos, re-consentimiento forzado si el texto cambia, exportación de aceptaciones, acuerdos de tratamiento de datos separados para especialistas. Estos quedan como posible trabajo futuro si se necesita.

## Backend

### Modelo `User` (`backend/app/models/user.py`)
Nuevo campo:
```python
terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

### Migración Alembic
Nueva migración (siguiendo el patrón de `backend/alembic/versions/f3a2c1b9d0e8_add_gamification.py` y similares) que agrega la columna `terms_accepted_at` (nullable) a la tabla `users`. Nullable porque las cuentas existentes no tienen este dato — no se fuerza retroactivamente.

### Schema (`backend/app/schemas/auth.py`)
`RegisterRequest` agrega:
```python
terms_accepted: bool
```
Con un validador que rechaza la petición (422) si `terms_accepted` no es `True`. Mensaje de error: "Debes aceptar los Términos y la Política de Privacidad para crear una cuenta."

### Servicio (`backend/app/services/auth_service.py`)
Al crear el usuario en el flujo de registro, si `terms_accepted` es `True`, se guarda `terms_accepted_at = datetime.now(timezone.utc)`.

## Frontend — páginas legales

Dos páginas nuevas en `frontend/src/pages/`:
- `TerminosPage.jsx` → ruta pública `/terminos`
- `PrivacidadPage.jsx` → ruta pública `/privacidad`

Ambas usan `PageWrapper` y `Card` como el resto de la app (fuente Nunito, colores de marca, `bg-calm-bg`), con el texto organizado en secciones tituladas (no un bloque plano), para mantener legibilidad pese a ser contenido largo. Incluyen fecha de "última actualización" visible arriba.

### Contenido — Términos y Condiciones
Borrador redactado por mí (no es asesoría legal formal — se incluye una nota visible de esto al pie del documento, recomendando revisión por un abogado antes de considerarlo definitivo). Cubre:
1. Qué es SocialMind y para quién es (niños/adolescentes en el espectro autista, grado 1, con supervisión de un adulto responsable).
2. Cuentas: quién puede registrarse (padre/tutor, especialista), veracidad de los datos, responsabilidad sobre la cuenta y su contraseña.
3. Uso permitido y prohibido — **prohibición explícita de copiar, reproducir, redistribuir, hacer scraping, hacer ingeniería inversa o reutilizar el contenido, diseño, textos, ilustraciones y estructura de la plataforma sin autorización escrita** (la cláusula que motivó este trabajo).
4. Naturaleza no clínica: SocialMind es una herramienta pedagógica y de acompañamiento, no reemplaza diagnóstico ni terapia profesional.
5. Uso de inteligencia artificial (Lumi): respuestas guiadas, sin garantía de exactitud clínica, supervisión de un adulto recomendada.
6. Propiedad intelectual: todo el contenido es © SocialMind, derechos reservados.
7. Suspensión o cierre de cuentas por uso indebido.
8. Limitación de responsabilidad y disponibilidad del servicio.
9. Cambios a estos términos y cómo se notifican.
10. Contacto para dudas legales.

### Contenido — Política de Privacidad
Cubre, con foco en que se maneja información de menores (dato sensible):
1. Qué datos se recopilan (cuenta del adulto responsable, perfil del niño/a: nombre, edad, avatar; interacciones dentro de la plataforma: emociones registradas, conversaciones con Lumi, progreso).
2. Para qué se usan esos datos (brindar el servicio, seguimiento pedagógico del especialista vinculado, mejora del producto) — nunca para publicidad ni venta a terceros.
3. Con quién se comparte: el especialista que el padre vincule explícitamente al perfil del niño; proveedores de infraestructura e IA necesarios para operar (VPS, API de IA) bajo sus propias condiciones de confidencialidad — sin venta ni cesión comercial de datos a terceros.
4. Seguridad: cifrado de contraseñas, acceso restringido por rol.
5. Derechos del usuario: acceso, corrección y eliminación de los datos de su hijo/a — cómo solicitarlo.
6. Retención de datos y qué pasa al eliminar una cuenta.
7. Almacenamiento local: la sesión (token y datos básicos del usuario) se guarda en `localStorage` del navegador (confirmado en `frontend/src/context/AuthContext.jsx`), no en cookies de terceros ni con fines de rastreo publicitario.
8. Contacto para ejercer derechos de privacidad.

## Frontend — formulario de registro (`Register.jsx`)

- Se agrega un checkbox antes del botón "Crear mi cuenta":
  > "Acepto los **Términos y Condiciones** y la **Política de Privacidad**" — con "Términos y Condiciones" y "Política de Privacidad" como enlaces (`target="_blank"`) a `/terminos` y `/privacidad`, para no perder el progreso del formulario al leerlos.
- Nuevo estado `termsAccepted` (boolean, default `false`).
- El botón de submit permanece deshabilitado mientras `termsAccepted` sea `false`.
- Al hacer submit, se envía `terms_accepted: true` junto al resto del payload de registro.

## Frontend — enlaces públicos

En `Welcome.jsx`, `Login.jsx` y `Register.jsx` se agrega un pie de página simple y discreto (texto pequeño, color `text-secondary`) con dos enlaces: "Términos y Condiciones" y "Política de Privacidad", apuntando a `/terminos` y `/privacidad`. No se modifica ninguna página del dashboard interno en esta fase.

## Rutas (`frontend/src/router/index.jsx`)

Dos rutas públicas nuevas, sin protección de auth:
```jsx
{ path: '/terminos',   element: <TerminosPage /> },
{ path: '/privacidad', element: <PrivacidadPage /> },
```

## Testing

- Backend: test que el registro falla con 422 si `terms_accepted` es `false` o falta; test que `terms_accepted_at` se guarda correctamente cuando es `true`.
- Frontend: test de que el botón de submit está deshabilitado hasta marcar el checkbox (siguiendo el patrón de tests ya existentes, ej. `frontend/src/test/ScenarioFlow.test.jsx`).

## Riesgos y consideraciones

- **No es asesoría legal formal**: el texto es un borrador razonable redactado por IA/Douglas, no por un abogado. Se deja explícito en ambas páginas y se recomienda revisión profesional antes de depender de esto en una disputa real.
- **Cuentas existentes**: quedan con `terms_accepted_at = NULL`. No se fuerza re-aceptación retroactiva en esta fase; queda como decisión futura si se considera necesario.
## Próximos pasos

Este spec queda listo para generar el plan de implementación (`writing-plans`) cuando Douglas confirme que quiere proceder a construirlo.
