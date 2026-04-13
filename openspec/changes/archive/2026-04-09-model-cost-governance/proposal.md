## Why

Actualmente la UI permite elegir modelos por capacidad (tiers S/A/B), pero no comunica claramente el riesgo de costo ni aplica límites de presupuesto. Con un catálogo mixto (trial/free, créditos limitados y modelos potencialmente caros), esto puede provocar consumo no intencional y accidentes monetarios.

## What Changes

- Añadir metadata de costo y facturación por modelo (free/trial/paid/unknown + nivel de costo) como fuente única en el registry.
- Exponer señales de costo en `ui-cognitive` (badges, etiquetas y advertencias) dentro del selector de modelos y en el estado activo del chat.
- Incorporar guardrails de presupuesto (soft/hard) por sesión y por usuario, con fallback configurable a modelos más baratos cuando se superen umbrales.
- Registrar y mostrar estimaciones de costo por request/sesión/modelo para observabilidad y control operacional.
- Definir configuración explícita por entorno (dev/staging/prod) para bloquear o restringir modelos de alto costo.

## Capabilities

### New Capabilities
- `model-cost-classification`: Catálogo canónico de modelos con clasificación de costo/facturación y política base de uso.
- `chat-cost-guardrails`: Límites de presupuesto y acciones automáticas (warn, block, fallback) durante conversaciones.
- `cost-observability-surface`: Exposición de métricas y señales de costo en UI/API para seguimiento operativo.

### Modified Capabilities
- `session-meta-bar`: Mostrar estado de costo/presupuesto de la sesión junto al modelo activo.

## Impact

- UI (`ui-cognitive`): `lib/model-registry.ts`, `components/chat/model-selector.tsx`, `components/layout`/`session` donde se muestra contexto activo.
- API/BFF (`ui-cognitive/app/api/*`): endpoints de chat/sesión para aplicar guardrails y devolver métricas de costo.
- Configuración y tipados compartidos: políticas de presupuesto por entorno, defaults y validaciones.
- Telemetría/observabilidad: eventos y agregados de costo por modelo, sesión y usuario.
