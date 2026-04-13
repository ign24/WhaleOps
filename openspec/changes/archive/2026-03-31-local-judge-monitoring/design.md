## Context

El sistema tiene un `AgentJudgeEvaluator` en `eval/evaluate.py` que corre sobre un dataset JSON estático vía `scripts/run_judge_eval.py`. El backend NAT escribe trazas de ejecución en un JSONL (`$TRACES_PATH`) con eventos por `trace_id`. Cada traza contiene eventos de tool calls, mensajes LLM y metadata de la sesión.

El judge actual usa Nemotron Super 49B (familia diferente a los agentes, lo cual es correcto para evitar self-enhancement bias). Los problemas son de calibración del prompt, no de arquitectura base.

## Goals / Non-Goals

**Goals:**
- Parsear el JSONL de trazas existente para extraer interacciones evaluables (question + response + trajectory)
- Correr el judge sobre trazas reales sin modificar frontend ni backend
- Mejorar la calibración del judge: rubrics 1-5 completos, CoT, pesos por modo, few-shot
- Producir un reporte legible en terminal (pass rate, scores por dimensión, casos fallidos)

**Non-Goals:**
- Integración al dashboard UI (siguiente fase)
- Escritura de eventos judge al JSONL de trazas (siguiente fase)
- Cambiar el modelo judge o agregar reward model (posterior)
- Evaluación en tiempo real / inline durante la sesión del agente

## Decisions

### D1: Parseo del JSONL de trazas

**Decisión**: El script agrupa eventos por `nat.workflow.run_id` y reconstruye la interacción desde los eventos de tipo mensaje. El user message se extrae del primer evento con role `human`/`user`. La agent response del último evento con role `ai`/`assistant`. La trajectory de eventos con `event_type` conteniendo `tool`.

**Alternativa considerada**: Agregar un endpoint al backend NAT para exponer las trazas formateadas. Descartado — añade dependencia al backend y contradice el objetivo de "local sin tocar nada".

**Riesgo**: Si el formato del JSONL cambia en versiones futuras de NAT, el parser se rompe. Mitigación: el parser usa field resolution con múltiples candidatos (mismo patrón que `lib/observability.ts`).

### D2: Pesos adaptativos por modo

**Decisión**: Pasar el modo (`analyze`/`refactor`/`execute`) como contexto al judge. Los pesos se seleccionan de un mapa estático en Python antes de construir el user message, y se incluyen en el prompt explícitamente para que el judge los aplique.

```
ANALYZE:  goal_fulfillment 0.30, tool_grounding 0.30, output_structure 0.15,
          mode_skill 0.10, safety 0.10, conciseness 0.05
REFACTOR: goal_fulfillment 0.25, tool_grounding 0.35, output_structure 0.15,
          mode_skill 0.10, safety 0.10, conciseness 0.05
EXECUTE:  goal_fulfillment 0.25, tool_grounding 0.20, output_structure 0.10,
          mode_skill 0.10, safety 0.30, conciseness 0.05
```

El score ponderado se recomputa localmente (patrón ya existente) para evitar errores aritméticos del judge.

**Alternativa considerada**: Pesos configurables por YAML. Descartado por ahora — añade complejidad sin beneficio inmediato. Los pesos hardcodeados se pueden externalizar más adelante.

### D3: Chain-of-thought obligatorio en el judge

**Decisión**: El system prompt requiere que el judge emita un bloque `reasoning` por dimensión antes del JSON final. El output format cambia a:

```json
{
  "dimension_reasoning": {
    "goal_fulfillment": "...",
    "tool_grounding": "..."
  },
  "scores": {"goal_fulfillment": 4, "tool_grounding": 3, ...},
  "weighted_score": 3.7,
  "pass": true,
  "critical_failures": [],
  "rationale": "2-4 sentences summary"
}
```

`_parse_judge_output()` se extiende para extraer `dimension_reasoning`. El campo es opcional en el fallback para preservar compatibilidad con tests existentes.

**Por qué**: La literatura (G-Eval, Prometheus) documenta que reasoning-before-score es la mejora de mayor impacto en consistencia del judge. Sin CoT, scores idénticos pueden tener motivaciones contradictorias.

### D4: Few-shot examples en el prompt

**Decisión**: Dos examples por dimensión de mayor impacto (`goal_fulfillment` y `tool_grounding`): uno bueno (score 5) y un hard negative (score 2 — parece bueno pero falla en algo específico). Los examples van en el system prompt, no en el user message, para no contaminar el contexto de evaluación.

**Por qué**: El hard negative es el más importante — enseña al judge dónde están los límites. Sin él, el judge sobre-puntúa respuestas que suenan confiadas pero no están respaldadas por tool output.

### D5: Formato del reporte en terminal

**Decisión**: Output sin dependencias externas (no `rich`, no `tabulate`). Formato texto simple con separadores ASCII. Incluye: resumen global (pass rate, avg score), breakdown por dimensión (avg + barra ASCII), y listado de los N casos fallidos con rationale.

**Alternativa considerada**: `rich` para tablas coloreadas. Descartado — añade dependencia y el script debe correr en cualquier entorno con solo el stack existente.

## Risks / Trade-offs

- **Trazas sin question/response extraíble** → El script skipea silenciosamente trazas donde no puede reconstruir la interacción y reporta cuántas fueron skipeadas. No falla.
- **Trajectories truncadas** → El parser de trazas no trunca a 500 chars como el evaluator actual. Pasa la trajectory completa. Si es muy larga, puede consumir contexto del judge. Mitigación: limitar a los últimos N tool calls si el token count estimado supera un umbral (configurable).
- **Rubrics más detallados pueden cambiar distribución de scores** → Los scores históricos del dataset de 2 muestras pierden comparabilidad. Aceptable — el dataset de 2 muestras no es baseline significativo.
- **CoT aumenta latencia y costo del judge** → Cada eval genera más tokens. Para monitoreo local ocasional es aceptable. Para producción continua habrá que medir el delta.

## Open Questions

- ¿Qué campos exactos usa el JSONL de trazas NAT para el user message y la agent response? Necesita verificación contra un trace real antes de implementar el parser. El diseño usa los candidatos más probables pero puede requerir ajuste.
- ¿El modo (`analyze`/`refactor`/`execute`) está presente en el JSONL o hay que inferirlo? Si no está, el script usa `analyze` como default.
