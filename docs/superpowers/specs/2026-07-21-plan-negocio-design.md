# Plan de Negocio SocialMind — Modelo Freemium Sostenible

**Fecha:** 2026-07-21
**Estado:** Diseño de estrategia — sin implementación técnica todavía

## Contexto y objetivo

SocialMind ya está en producción, con cuentas reales activas y tres roles (padre, especialista, admin). El proyecto nace de una motivación personal de Douglas Isturiz de dar apoyo accesible a niños y adolescentes en el espectro autista (grado 1).

El objetivo de este documento es definir un modelo de negocio que:
1. Mantenga una capa gratuita real y útil, para no dejar fuera a quienes más lo necesitan.
2. Genere ingresos suficientes para sostener costos de infraestructura (VPS, API de IA) y financiar desarrollo futuro.
3. Sea coherente con los principios de accesibilidad cognitiva y calma del producto (sin fricción, sin ambigüedad, sin sensación de "versión pobre").

Este documento es una **estrategia**, no un plan de implementación técnica. La decisión de cuándo construir el cobro real queda abierta y no es urgente.

## Estructura de niveles (Fase 1)

| Nivel | Quién | Qué obtiene | Paga |
|---|---|---|---|
| **Gratis** | Cualquier padre/madre/tutor, sin verificación de ingresos | Módulos básicos: Selector emocional, Escenarios sociales, Zona de calma, Chat con Lumi (con límite mensual razonable) | No |
| **Premium Familia** | Padres que pueden pagar | Todo lo anterior + Biblioteca (RAG), Aprendo Hábitos, Mi Aventura (gamificación completa), Chat con Lumi sin límite | Sí — suscripción mensual/anual |
| **Especialista Pro** | Terapeutas, psicólogos, docentes | Panel profesional completo: seguimiento de todos sus niños asignados, tendencias emocionales, gestión de biblioteca, notas clínicas | Sí — por especialista |
| **Convenio Institucional** | ONGs, escuelas, fundaciones (negociado manualmente al inicio) | Acceso Premium Familia gratuito para las familias que la institución designe | La institución/donante, no la familia — precio negociado caso por caso |

La cuenta de "Especialista" básica (gratis, como existe hoy) se mantiene para vincularse con niños y ver lo esencial; "Especialista Pro" es una capa de pago adicional sobre esa base.

## Precios sugeridos (punto de partida, no definitivos)

| Nivel | Precio sugerido | Nota |
|---|---|---|
| Premium Familia | USD $4–6/mes (~$40–50/año con descuento anual) | Precio "psicológicamente accesible", similar a una app de streaming básica. El pago anual mejora flujo de caja. |
| Especialista Pro | USD $10–15/mes por especialista | Los profesionales facturan a sus pacientes, pueden absorber un precio mayor; el valor entregado (ahorro de tiempo en seguimiento) lo justifica. |
| Convenio Institucional | Desde USD $2–3/niño/mes, con mínimos por volumen (ej. mínimo 20 niños) | Sirve como ancla de precio para no regalar el valor completo sin ingreso asociado. |

Se recomienda lanzar con estos rangos, medir la tasa de conversión de Gratis → Premium, y ajustar ±30% según la respuesta real del mercado, en vez de intentar calcular un precio "perfecto" de antemano.

## Convenios institucionales — proceso Fase 1 (manual)

No se automatiza el alta institucional en esta fase:

1. **Contacto y negociación**: Douglas (u otro responsable de negocio) negocia precio y cantidad de familias cubiertas directamente con la ONG/escuela/fundación.
2. **Marca de cuentas**: usando el módulo Admin existente, se marca manualmente cada cuenta cubierta como "Premium — Convenio [Institución]". No requiere una pasarela de pago institucional nueva, solo un campo de plan por cuenta.
3. **Seguimiento**: registro de convenios activos y vencimientos se lleva fuera de la plataforma al inicio (hoja de cálculo), hasta que el volumen justifique un panel institucional dedicado.
4. **Renovación**: contacto manual anual/semestral.

La única pieza técnica nueva necesaria para lanzar Fase 1 es: (a) un campo de "tipo de plan" en la cuenta de usuario (gratis/premium) y (b) cobro para familias/especialistas individuales vía pasarela de pago. Los convenios institucionales no requieren desarrollo adicional al inicio.

## Pasarela de pago (consideración práctica)

- **Stripe**: buena integración de suscripciones recurrentes, pero disponibilidad como cuenta receptora varía por país en Latinoamérica.
- **PayPal**: más cobertura regional, comisiones más altas, peor conversión típica en LatAm.
- **Mercado Pago** (u otro procesador local): mejor conversión en varios países de LatAm si el volumen se concentra ahí, pero puede requerir integraciones por país.

**Recomendación Fase 1:** comenzar con Stripe por simplicidad de integración (si la cuenta/entidad de Douglas califica), y evaluar sumar un procesador local (ej. Mercado Pago) más adelante si una parte relevante de usuarios no puede pagar con tarjeta internacional. Decisión final pendiente de validar al momento de implementar el cobro.

## Roadmap de fases

| Fase | Contenido | Cuándo |
|---|---|---|
| Fase 0 | Este documento de estrategia — sin cambios en el producto | Completada 2026-07-21 |
| Fase 1 | Campo de plan (gratis/premium) por cuenta, restricción de módulos según plan, integración de pasarela de pago para Premium Familia y Especialista Pro | A decidir por Douglas, no urgente |
| Fase 2 | Primeros convenios institucionales manuales vía módulo Admin | En paralelo o después de Fase 1, cuando haya interés real de alguna institución |
| Fase 3 | Automatizar alta institucional (panel self-service, checkout por volumen) | Solo si el número de convenios manuales crece lo suficiente para justificarlo |

## Riesgos y consideraciones éticas

- **No debe sentirse como "versión pobre"**: los módulos gratuitos deben seguir siendo experiencias completas y pulidas. El límite debe estar en cantidad/alcance (ej. menos historial, sin biblioteca avanzada), nunca en calidad.
- **Sin fricción para pedir ayuda**: debe existir una forma simple y visible de que una familia sin recursos pida ser conectada con una institución aliada (ej. enlace de contacto "¿No puedes pagar? Escríbenos"), no depender solo de que la ONG los traiga.
- **Transparencia de precio**: cualquier página de precios debe usar el mismo lenguaje simple y calmado del resto de la app — sin letra pequeña ni condiciones confusas, siguiendo el principio de accesibilidad cognitiva del proyecto.
- **Riesgo de concentración**: depender de pocos convenios institucionales grandes es frágil ante la pérdida de uno. Se recomienda diversificar entre B2C, especialistas y varias instituciones, en vez de depender de una sola grande.

## Alternativas consideradas y descartadas (por ahora)

- **Todo automatizado desde el día 1** (4 niveles con checkout institucional self-service): descartado para Fase 1 por requerir desarrollo significativo antes de validar si las instituciones comprarían así.
- **Modelo por consumo medido** (cuota gratuita mensual + pago por exceso, créditos institucionales): descartado por generar incertidumbre de "cuánto voy a pagar", lo cual choca con el principio de simplicidad y previsibilidad del diseño accesible de SocialMind.
- **Verificación de ingresos para acceso gratuito**: descartado — se prefiere un nivel gratuito abierto sin fricción, y reservar el acceso completo subsidiado para las familias que llegan a través de convenios institucionales.

## Próximos pasos

Este documento define la estrategia. La implementación técnica (Fase 1 de la tabla de roadmap) queda pendiente de que Douglas decida iniciarla — en ese momento corresponde crear un plan de implementación específico (vía la skill de `writing-plans`) para el campo de plan, restricciones por módulo, e integración de pasarela de pago.
