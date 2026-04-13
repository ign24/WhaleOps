## Context

`ui-cognitive` ya dispone de un `MODEL_REGISTRY` y un selector por tier (S/A/B), pero no existe una capa explícita de gobernanza de costo. En la práctica, el runtime puede operar con modelos de distinto esquema de facturación (trial con créditos, pago por uso, self-hosted) sin que el usuario tenga visibilidad clara ni límites preventivos.

El cambio cruza varias capas: catálogo de modelos, experiencia de chat, rutas API de sesión/chat y observabilidad. El objetivo es reducir riesgo operacional (sobrecosto accidental) sin degradar demasiado la experiencia de uso.

## Goals / Non-Goals

**Goals:**
- Definir una taxonomía canónica de costo/facturación por modelo reutilizable en UI y API.
- Exponer señales claras de costo en el punto de decisión (selector de modelo y barra de sesión).
- Aplicar límites de presupuesto por sesión/usuario con acciones predecibles (warn, fallback o block).
- Registrar métricas de costo estimado por request y agregarlas por sesión/modelo para control operativo.

**Non-Goals:**
- Implementar facturación real del proveedor ni reconciliación contable exacta.
- Cambiar el motor de inferencia o la política de routing principal de NAT.
- Resolver pricing exacto de todos los vendors en tiempo real (se usa configuración controlada + categoría).

## Decisions

### 1) Catálogo único de gobernanza de costo en `model-registry`
- **Decisión**: extender `ModelEntry` con `costCategory`, `billingType`, `riskLevel` y referencias de pricing (`pricingRef`), más un `policyTag` para controles por entorno.
- **Rationale**: evita divergencia entre etiquetas visuales y enforcement backend.
- **Alternativas consideradas**:
  - Catálogo separado solo para backend: reduce acoplamiento UI pero duplica datos.
  - Cálculo dinámico desde provider APIs: más preciso pero inestable y complejo para MVP de control.

### 2) Guardrails determinísticos en API de chat/sesión
- **Decisión**: evaluar presupuesto antes de ejecutar cada request con dos umbrales:
  - `softLimit`: permite continuar pero devuelve warning estructurado.
  - `hardLimit`: bloquea o fuerza fallback según política.
- **Rationale**: comportamiento auditable y testeable; evita sorpresas de costo.
- **Alternativas consideradas**:
  - Solo avisos UI (sin bloqueo): insuficiente para evitar accidentes.
  - Solo hard limit global: demasiado brusco y sin señal temprana.

### 3) Fallback explícito y configurable
- **Decisión**: cuando `hardLimit` se supera, intentar fallback a un modelo permitido de menor costo (`fallbackModelKey`) y registrar evento; si no hay fallback válido, bloquear.
- **Rationale**: continuidad operativa con control financiero.
- **Alternativas consideradas**:
  - Bloqueo inmediato siempre: más seguro pero peor UX.
  - Fallback implícito por tier: opaco y difícil de explicar al usuario.

### 4) Observabilidad de costo estimado (no contable)
- **Decisión**: calcular costo estimado por request usando tokens in/out y tarifa configurada; persistir agregados por sesión/modelo/usuario para UI operativa.
- **Rationale**: suficiente para control preventivo y alertas.
- **Alternativas consideradas**:
  - Sin estimación hasta tener billing real: deja ciego al operador.
  - Estimación ultra detallada por proveedor en vivo: alto costo de mantenimiento.

### 5) Señales de riesgo en UI en puntos críticos
- **Decisión**: badges y warnings en selector + sesión activa (`FREE`, `LOW`, `MED`, `HIGH`, `UNKNOWN`; trial/paid/self-hosted), con confirmación para `HIGH/UNKNOWN`.
- **Rationale**: la prevención debe ocurrir antes del envío.
- **Alternativas consideradas**:
  - Mostrar costo solo en panel observability: llega tarde para prevenir.

## Risks / Trade-offs

- **[Riesgo] Estimación distinta al costo real del proveedor** → **Mitigación**: etiquetar explícitamente como estimado, mantener `pricingRef` y versionado de tarifas.
- **[Riesgo] Falsos bloqueos por políticas conservadoras** → **Mitigación**: límites por entorno/rol y modo dry-run en staging.
- **[Riesgo] Mayor complejidad UX con demasiadas señales** → **Mitigación**: lenguaje corto, badges compactos y warnings solo en `HIGH/UNKNOWN` o al cruzar límites.
- **[Riesgo] Drift entre catálogo de modelos y backend real** → **Mitigación**: validaciones de arranque y tests de contrato modelo->policy.

## Migration Plan

1. **Fase 1 (read-only)**: introducir metadata de costo + UI badges sin bloqueo.
2. **Fase 2 (soft enforcement)**: activar `softLimit` con warnings estructurados y telemetría.
3. **Fase 3 (hard enforcement)**: activar `hardLimit` con fallback y bloqueo controlado.
4. **Fase 4 (operación)**: umbrales por entorno/rol, alertas y ajuste fino de defaults.

**Rollback:** feature flags para desactivar enforcement (`soft/hard`) manteniendo únicamente visibilidad de costo.

## Open Questions

- ¿Dónde persistir presupuesto por usuario de forma durable (JSON local, redis, DB) en esta etapa?
- ¿Qué política default aplicar para modelos `UNKNOWN` en producción (warn o block)?
- ¿Se requiere cuota por equipo además de cuota por usuario/sesión?
- ¿Cuál será la fuente de verdad de tarifas (archivo versionado, admin UI, secreto/remote config)?
