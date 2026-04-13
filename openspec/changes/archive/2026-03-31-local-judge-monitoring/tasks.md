## 1. Calibrated Judge Prompt

- [x] 1.1 Reescribir el system prompt en `evaluate.py` con rubrics 1/2/3/4/5 completos para las 6 dimensiones
- [x] 1.2 Agregar dos few-shot examples en el system prompt: uno bueno (score 5) y un hard negative (score 2) para `goal_fulfillment` y `tool_grounding`
- [x] 1.3 Agregar instrucción de CoT: el judge debe emitir `dimension_reasoning` antes de `scores`
- [x] 1.4 Actualizar el JSON output schema en el prompt para incluir `dimension_reasoning`
- [x] 1.5 Definir el mapa de pesos por modo como constante en `evaluate.py` (analyze / refactor / execute)
- [x] 1.6 Hacer que `AgentJudgeEvaluator.__init__` acepte `mode: str = "analyze"` y seleccione los pesos del mapa
- [x] 1.7 Actualizar `_build_user_message()` para incluir el modo activo y los pesos en el contexto enviado al judge
- [x] 1.8 Extender `_parse_judge_output()` para extraer `dimension_reasoning` sin romper si está ausente

## 2. Tests del judge mejorado

- [x] 2.1 Actualizar tests unitarios existentes en `tests/unit/` para el nuevo output format con `dimension_reasoning`
- [x] 2.2 Agregar test: modo `refactor` usa peso 0.35 en `tool_grounding`
- [x] 2.3 Agregar test: modo desconocido cae back a pesos de `analyze`
- [x] 2.4 Agregar test: `_parse_judge_output()` tolera JSON sin `dimension_reasoning`
- [x] 2.5 Expandir `data/eval_judge_test.json` de 2 a 10 muestras con trajectories realistas (3 buenas, 3 regulares, 4 malas)

## 3. Trace Parser

- [x] 3.1 Crear `scripts/run_judge_from_traces.py` con función `parse_traces(path) -> list[dict]`
- [x] 3.2 Implementar agrupación de eventos por `nat.workflow.run_id`
- [x] 3.3 Implementar extracción de `question` (primer evento human/user) con múltiples candidatos de field names
- [x] 3.4 Implementar extracción de `agent_response` (último evento ai/assistant)
- [x] 3.5 Implementar extracción de `trajectory` desde eventos de tool (sin truncado a 500 chars)
- [x] 3.6 Implementar lógica de skip silencioso para trazas sin question o response recuperable
- [x] 3.7 Agregar flag `--last N` para evaluar solo los N traces más recientes por timestamp
- [x] 3.8 Agregar validaciones de entorno al inicio: `TRACES_PATH` existe, `NVIDIA_API_KEY` seteado

## 4. Reporte Terminal

- [x] 4.1 Implementar función `print_report(results)` con resumen global: N evaluados, pass rate, avg weighted score
- [x] 4.2 Implementar sección de scores por dimensión con barra ASCII (20 chars, proporcional a 5.0)
- [x] 4.3 Implementar sección de casos fallidos: trace_id, weighted score, critical_failures, rationale
- [x] 4.4 Verificar que el script no requiere dependencias fuera del stack existente (no rich, no tabulate)

## 5. Validación end-to-end

- [x] 5.1 Correr `uv run ruff check .` y `uv run ruff format --check .` sin errores
- [x] 5.2 Correr `uv run pytest -x` — todos los tests pasan incluyendo los nuevos
- [ ] 5.3 Ejecutar `python scripts/run_judge_from_traces.py --last 5` contra traces reales y verificar el reporte
- [x] 5.4 Ejecutar `python scripts/run_judge_eval.py` con el dataset expandido y verificar que el judge diferencia correctamente buenas/malas respuestas
