# Model Cost Governance

Esta UI aplica gobernanza de costo para reducir riesgo de consumo accidental.

## Resumen operativo

- Cada modelo tiene metadata canónica: `costCategory`, `billingType`, `riskLevel`, `pricingRef`, `policyTag`.
- El selector muestra badges (`FREE`, `LOW`, `MED`, `HIGH`, `UNKNOWN`) y aplica confirmación para riesgo alto.
- El backend evalúa presupuesto por request con límites:
  - **soft limit**: permite continuar y marca warning.
  - **hard limit**: bloquea o aplica fallback, según configuración.

## Variables de entorno

| Variable | Default | Descripción |
|---|---:|---|
| `MODEL_COST_GUARDRAILS_ENABLED` | `1` | Activa gobernanza de costo en backend |
| `MODEL_COST_SOFT_LIMIT_ENABLED` | `1` | Activa señal de soft limit |
| `MODEL_COST_HARD_LIMIT_ENABLED` | `1` | Activa enforcement de hard limit |
| `MODEL_COST_SOFT_LIMIT_USD` | `0.15` | Umbral soft por sesión |
| `MODEL_COST_HARD_LIMIT_USD` | `0.30` | Umbral hard por sesión |
| `MODEL_COST_HARD_ACTION` | `fallback` | `fallback` o `block` |
| `MODEL_COST_FALLBACK_MODEL_KEY` | `nemotron_super` | Modelo usado al superar hard limit |
| `MODEL_POLICY_ENV` | `development` | Entorno de policy (`development/staging/production`) |
| `NEXT_PUBLIC_MODEL_POLICY_ENV` | (opcional) | Entorno de policy en UI |

### Piso mínimo de límites

Para evitar configuraciones inválidas, el runtime aplica un piso interno:

- `softLimitUsd >= 0.00001`
- `hardLimitUsd >= softLimitUsd + 0.00001`

Si se envían valores menores por env vars, se normalizan automáticamente.

## Señales en runtime

- SSE `event: metadata` incluye estado de presupuesto y costo estimado acumulado.
- SSE `event: usage` incluye costo estimado por request y acumulados.
- `/api/observability/summary` expone `costSummary` por usuario para panel operativo.

## Rollback rápido

Para desactivar enforcement y mantener visibilidad:

1. `MODEL_COST_GUARDRAILS_ENABLED=0` (desactiva bloqueo/fallback)
2. Mantener metadata UI y métricas observability activas
3. Recalibrar límites y volver a activar enforcement gradualmente

## Nota

Los valores de costo son **estimados** para prevención operativa y no sustituyen reconciliación contable de proveedor.
