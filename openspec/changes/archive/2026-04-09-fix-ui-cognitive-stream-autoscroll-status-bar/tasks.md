## 1. Estado de streaming visual

- [x] 1.1 Extender el hook/typewriter para exponer `isVisualStreaming` y `isQueueDrained` sin timers nuevos fuera de `requestAnimationFrame`.
- [x] 1.2 Actualizar consumidores del hook para separar estado de red (`isSending`) y estado de render visual (`visualStreamingActive`).
- [x] 1.3 Validar que al abortar red con `AbortController` el render visual drene solo el contenido ya bufferizado.

## 2. Auto-scroll durante render visual

- [x] 2.1 Ajustar `ChatPanel` para mantener auto-scroll al ultimo mensaje mientras `visualStreamingActive` sea true y el usuario siga en bottom.
- [x] 2.2 Preservar la intencion del usuario: pausar auto-scroll si hace scroll hacia arriba y reanudar solo con accion explicita de volver al fondo.
- [x] 2.3 Revisar clases/flags de streaming en el mensaje activo para que dependan de fin de render visual en lugar de fin de red.

## 3. Barra luminosa multi-agente

- [x] 3.1 Derivar visibilidad de barra luminosa desde `ActivityEntry` activos (`running`/`pending`) para todos los agentes activos durante render visual.
- [x] 3.2 Actualizar componentes de resumen/estado en chat para evitar hardcode por nombre de agente o herramienta.
- [x] 3.3 Asegurar apagado consistente de indicadores cuando termina `visualStreamingActive` y no quedan agentes activos.

## 4. Pruebas y regresiones

- [x] 4.1 Agregar tests en `ui-cognitive/tests/chat-panel.test.tsx` para el desfase entre fin de red y fin de render visual, verificando que el auto-scroll sigue activo en esa ventana.
- [x] 4.2 Agregar tests de respeto de scroll manual (usuario arriba) durante `visualStreamingActive` para garantizar que no se fuerce el viewport.
- [x] 4.3 Agregar tests para visibilidad consistente de barra luminosa en escenarios multi-agente activos/inactivos.
- [x] 4.4 Verificar que el boton detener sigue abortando red correctamente sin romper la finalizacion visual local.

## 5. Validacion final

- [x] 5.1 Ejecutar `bun run lint` en `ui-cognitive`.
- [x] 5.2 Ejecutar `bun run test` en `ui-cognitive` y confirmar cobertura de los nuevos casos de desalineacion red/render.
