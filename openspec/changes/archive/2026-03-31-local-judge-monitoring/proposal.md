## Why

El AgentJudgeEvaluator existe pero opera sobre un dataset estático de 2 muestras sintéticas y solo puede ejecutarse como proceso de eval offline. No hay forma de evaluar la calidad de respuestas reales del agente sin intervención manual, y el prompt del judge tiene gaps conocidos (rubrics incompletos en 2/4, sin CoT obligatorio, pesos estáticos ignorando el modo de ejecución). El resultado es que no hay señal de calidad sobre lo que el agente produce en producción local.

## What Changes

- **Nuevo script** `scripts/run_judge_from_traces.py`: lee el JSONL de trazas (`$TRACES_PATH`), extrae interacciones reales (question, agent response, trajectory), corre el judge sobre cada una y emite un reporte formateado en terminal.
- **Judge mejorado** en `src/cognitive_code_agent/eval/evaluate.py`:
  - Rubrics completos en todos los niveles 1/2/3/4/5 (hoy solo 1/3/5)
  - Chain-of-thought obligatorio: el judge razona antes de asignar score
  - Pesos adaptativos por modo (`analyze`, `refactor`, `execute`)
  - Few-shot examples calibrados (un caso bueno y un hard negative por dimensión clave)
- **Dataset de calibración** expandido en `data/eval_judge_test.json`: de 2 a 10+ muestras con trajectories reales para validar el judge mejorado.

## Capabilities

### New Capabilities

- `trace-judge-runner`: Script local que extrae interacciones reales del JSONL de trazas y las evalúa con el judge, sin tocar frontend ni backend.
- `calibrated-judge-prompt`: Prompt del judge con rubrics 1-5 completos, CoT obligatorio, pesos por modo y few-shot examples.

### Modified Capabilities

- (ninguna — no se modifican specs existentes)

## Impact

- `scripts/run_judge_from_traces.py`: archivo nuevo
- `src/cognitive_code_agent/eval/evaluate.py`: modificación del system prompt y lógica de pesos
- `src/cognitive_code_agent/data/eval_judge_test.json`: expansión del dataset
- `tests/unit/`: nuevos tests unitarios para los pesos por modo y el parser de trazas
- Sin cambios en frontend, backend NAT, ni configuración de producción
