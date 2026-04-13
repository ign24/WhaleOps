## 1. Señal de finalización en ChatPanel

- [x] 1.1 Agregar estado local de toast de finalización y render de banner minimalista no intrusivo.
- [x] 1.2 Implementar utilidades cliente para alerta de atención (notificación del navegador + marcador temporal en `document.title`) con guardas de compatibilidad.
- [x] 1.3 Disparar la señal de finalización al cerrar `sendMessageToAgent` sin afectar aborts ni manejo de errores existente.

## 2. Cobertura y verificación

- [x] 2.1 Agregar/ajustar pruebas en `ui-cognitive/tests/chat-panel.test.tsx` para validar aparición del aviso de finalización.
- [x] 2.2 Ejecutar pruebas target de `chat-panel` y corregir regresiones.
- [x] 2.3 Ejecutar `bun run lint` en `ui-cognitive` para validar que el cambio mantiene consistencia.
