## Context

El flujo actual de chat en `ui-cognitive` renderiza tokens en vivo desde SSE (`choices[].delta.content`) pero no consume un evento de uso final de tokens. En backend, `safe_tool_calling_agent.py` puede emitir `Usage` real cuando el proveedor retorna `usage_metadata`; si no, hace fallback estimado por conteo de palabras.

Esto genera dos problemas de producto: (1) el usuario no distingue precisión real vs estimada y (2) no existe reconciliación explícita al final del stream para mostrar el valor más confiable disponible.

Restricciones:
- Mantener compatibilidad con el stream actual (`data: { choices... }`) y eventos `metadata/activity/error`.
- No romper persistencia de historial ni actividad intermedia.
- Evitar presentar estimaciones como métricas exactas.

## Goals / Non-Goals

**Goals:**
- Exponer en la UI un contador de tokens “realista” y transparente.
- Mostrar estimación durante escritura/streaming y reconciliar a valor real al finalizar cuando haya `usage` del backend.
- Definir contrato SSE estable para token usage y su nivel de precisión.
- Mantener fallback usable cuando no haya metadata real de proveedor.

**Non-Goals:**
- Facturación exacta por proveedor/modelo en tiempo real.
- Tokenización perfecta por cada familia de modelo durante tipeo local.
- Cambiar la arquitectura de observabilidad fuera del flujo de chat.

## Decisions

### D1: Fuente autoritativa de “valor real”

**Decisión:** El valor autoritativo SHALL ser el `usage` final emitido por backend al cerrar la respuesta.

**Alternativas consideradas:**
- *Contar deltas en frontend* (descartado): no incluye tokens de prompt ni transformaciones del backend.
- *Usar solo estimación* (descartado): no cumple el objetivo de realismo para costo/contexto.
- *Uso final backend (elegido)*: es la señal más cercana al proveedor y consistente con observabilidad.

### D2: Contrato SSE de uso de tokens

**Decisión:** Agregar evento SSE explícito (`event: usage`) desde `/api/chat` hacia cliente con payload normalizado.

Payload objetivo:
- `promptTokens`
- `completionTokens`
- `totalTokens`
- `isEstimated` (boolean)

**Racional:** Evita inferencias frágiles desde chunks de texto y desacopla rendering de chat del cálculo de métricas.

### D3: UX de precisión

**Decisión:** Mostrar estado de precisión en UI con convención explícita:
- `~N` para estimado (typing/stream o fallback)
- `N` sin prefijo para real
- etiqueta corta `estimado` / `real` donde aplique

**Alternativas consideradas:**
- *No mostrar precisión* (descartado): confunde y sobrepromete exactitud.
- *Ocultar estimación hasta final* (descartado): pierde feedback útil durante escritura.

### D4: Reconciliación estimado→real

**Decisión:** Durante stream se puede mostrar estimación provisional; al recibir evento `usage` final, la UI reemplaza el valor por el real (si `isEstimated=false`). Si el backend solo dispone fallback, el valor permanece estimado.

### D5: Fallback backend

**Decisión:** Mantener fallback cuando no haya metadata real, pero marcarlo explícitamente como estimado en el contrato emitido al frontend.

## Risks / Trade-offs

- **[Desfase visual entre estimado y real]** → Mitigación: transición explícita (badge/label) y update atómico al cierre.
- **[Heterogeneidad de modelos]** → Mitigación: fijar backend final como fuente autoritativa y no prometer precisión local.
- **[Eventos SSE fuera de orden]** → Mitigación: procesar `usage` como idempotente y priorizar el último evento válido antes de `[DONE]`.
- **[Falta de usage real del proveedor]** → Mitigación: conservar valor estimado y exponer `isEstimated=true`.

## Migration Plan

1. Extender contrato interno de `/api/chat` para emitir `event: usage`.
2. Actualizar parser SSE y estado de `chat-panel` para consumir usage con precisión.
3. Extender `SessionMetaBar` para reflejar tokens de sesión cuando estén disponibles.
4. Agregar/ajustar tests de route, parser y UI.

Rollback:
- Si falla la adopción de evento `usage`, el stream de contenido sigue funcionando; desactivar render de contador y conservar comportamiento actual.

## Open Questions

- ¿El contador visible principal vive en input composer, en meta bar, o en ambos?
- ¿Se requiere desglose `prompt/completion` en UI principal o alcanza con `total`?
- ¿Se desea persistir token usage por mensaje en historial para re-render consistente al recargar sesión?
