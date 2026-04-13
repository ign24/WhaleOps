## 1. Contrato de configuracion Compose

- [ ] 1.1 Estandarizar variables de entorno de observabilidad para local y VPS en Docker Compose (`NAT_BACKEND_URL=http://nat:8000`, `TRACES_PATH=/app/traces/agent_traces.jsonl`).
- [ ] 1.2 Alinear `.env.example` y `docker-compose.yml` con el contrato unico y eliminar ejemplos ambiguos para conectividad UI->NAT.

## 2. Endurecimiento de API de observabilidad

- [ ] 2.1 Ajustar `app/api/observability/summary/route.ts` para reportar diagnostico explicito cuando falle `monitor/users` o falte configuracion.
- [ ] 2.2 Ajustar `lib/observability.ts` para priorizar `TRACES_PATH` y distinguir ausencia de archivo vs falta de datos procesables.

## 3. UX de diagnostico en dashboard

- [ ] 3.1 Actualizar `components/observability/dashboard-view.tsx` para presentar estados accionables de error/configuracion.
- [ ] 3.2 Mantener mensaje de “sin trazas” diferenciado de “ruta/configuracion invalida”.

## 4. Documentacion y verificacion

- [ ] 4.1 Actualizar `README.md` con topologia Compose unica y pasos de verificacion operativa.
- [ ] 4.2 Ejecutar validaciones del proyecto (lint/tests/build) y revisar que local/VPS sigan el mismo contrato.
