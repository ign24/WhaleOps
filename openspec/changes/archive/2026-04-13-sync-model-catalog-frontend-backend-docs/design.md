## Context

Source of truth de modelos: `src/cognitive_code_agent/configs/config.yml`.

Problema observado:
- `ui-cognitive/lib/model-registry.ts` quedó con solo 6 modelos.
- Faltaban modelos switchables (`qwen_coder`, `kimi_reader`, `gemma_4_31b_it`) y aliases relacionados.
- Tests/docs se adaptaron al estado incompleto (ej: "no hay vision model") generando contradicción con backend/specs.

## Decisions

1. **Paridad frontend = modelos switchables del runtime**
   - El picker de UI mostrará modelos seleccionables por modo.
   - `nemotron_super_thinking` se mantiene como variante interna (toggle), no opción duplicada.

2. **Backend completo documentado explícitamente**
   - README root lista todos los `llms` configurados, separando catálogo completo de subset UI.

3. **Tests de contrato de catálogo**
   - Tests de `model-registry` verifican presencia de modelos switchables críticos y que exista modelo vision por defecto (`gemma_4_31b_it`).

## Risks

- Desalineación futura cuando se modifique `config.yml` sin tocar UI.
  - Mitigación: tests de registry + sección de docs con regla de alineación.
