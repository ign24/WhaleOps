## 1. Model cost metadata foundation

- [x] 1.1 Extender `ui-cognitive/lib/model-registry.ts` con `costCategory`, `billingType`, `riskLevel`, `pricingRef` y `policyTag` por modelo.
- [x] 1.2 Implementar utilidades de normalización/lectura de metadata de costo (resolver defaults `unknown` y políticas por entorno).
- [x] 1.3 Agregar tests unitarios de registry para validación de metadatos y políticas (`warn/block/allow`).

## 2. UI cost signals and selection safeguards

- [x] 2.1 Actualizar `components/chat/model-selector.tsx` para mostrar badges de costo y tipo de facturación por modelo.
- [x] 2.2 Agregar confirmación/warning UX al seleccionar modelos `HIGH` o `UNKNOWN`.
- [x] 2.3 Actualizar barra de sesión/meta para reflejar modelo activo + estado de presupuesto.
- [x] 2.4 Agregar tests de UI para rendering de badges y flujo de warning/confirmación.

## 3. Budget guardrails in chat API

- [x] 3.1 Definir configuración de presupuesto (session/user `softLimit` y `hardLimit`, acción `fallback|block`, `fallbackModelKey`) por entorno.
- [x] 3.2 Integrar evaluación de presupuesto previa a cada request de chat en rutas API de `ui-cognitive`.
- [x] 3.3 Implementar acciones determinísticas de hard limit (fallback y bloqueo con error estructurado).
- [x] 3.4 Registrar eventos de guardrail (warning, fallback, block) en telemetría de sesión.

## 4. Cost observability surface

- [x] 4.1 Implementar contrato de metadata de costo estimado por request (input/output/cumulative/budgetState).
- [x] 4.2 Exponer agregados por sesión y por modelo para consumo de UI observability.
- [x] 4.3 Conectar UI para mostrar estado de presupuesto en superficies activas del chat.

## 5. Policy controls and safety rollout

- [x] 5.1 Introducir feature flags para fases de rollout (read-only, soft-limit, hard-limit).
- [x] 5.2 Configurar política por entorno para modelos de alto riesgo (`warn` en staging, `block` en producción según configuración).
- [x] 5.3 Definir estrategia de rollback desactivando enforcement y manteniendo visibilidad.

## 6. Verification and docs

- [x] 6.1 Añadir tests de integración API para escenarios `below-soft`, `cross-soft`, `cross-hard-fallback`, `cross-hard-block`.
- [x] 6.2 Ejecutar `bun run lint`, `bun run test`, `bun run build` en `ui-cognitive` y corregir regresiones.
- [x] 6.3 Documentar operación de costos/presupuestos (fuente de tarifas, defaults y límites) en docs del proyecto.
