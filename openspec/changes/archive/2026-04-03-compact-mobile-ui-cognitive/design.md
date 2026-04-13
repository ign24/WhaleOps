## Context

`ui-cognitive` ya cuenta con layout split de chat, meta bar y panel/drawer de actividad/conversaciones, pero en móvil la densidad actual deja poco espacio para mensajes y contexto. Se requiere una optimización acotada a presentación visual en breakpoints móviles, manteniendo intacta la lógica de negocio y navegación.

## Goals / Non-Goals

**Goals:**
- Aumentar contenido visible en viewport móvil reduciendo alturas, paddings y gaps no esenciales.
- Compactar header y controles de conversaciones/drawer para bajar el costo visual inicial.
- Ajustar cards y escala tipográfica mobile-first con legibilidad consistente.
- Mantener 100% de compatibilidad funcional con el comportamiento actual.

**Non-Goals:**
- No cambiar flujos de chat, estados, SSE, tool-calls, ni persistencia.
- No introducir rediseño desktop ni nuevos componentes funcionales.
- No modificar APIs, contratos, rutas, ni permisos.

## Decisions

- Aplicar cambios solo en estilos y layout responsive (`sm`/`md` hacia abajo), manteniendo estructura funcional existente.
- Priorizar tokens/variables y utilidades existentes en `ui-cognitive` para evitar divergencias visuales.
- Compactar por capas: (1) contenedor chat/layout, (2) header, (3) conversaciones + drawer, (4) cards + tipografía.
- Validar que el resultado preserve targets táctiles aceptables y contraste/lectura en móvil.

## Risks / Trade-offs

- [Riesgo: compresión excesiva afecta legibilidad] -> Mitigación: definir mínimos de font-size/line-height y validar lectura real en viewport pequeño.
- [Riesgo: controles táctiles demasiado pequeños] -> Mitigación: mantener áreas táctiles mínimas aunque se reduzca padding visual.
- [Riesgo: inconsistencia entre móvil y desktop] -> Mitigación: encapsular cambios en media queries mobile-first sin tocar reglas desktop.
- [Trade-off: mayor densidad vs aire visual] -> Mitigación: reducir vacíos estructurales antes que eliminar separación semántica entre bloques.

## Migration Plan

- Implementación directa sin migración de datos.
- Despliegue normal frontend.
- Rollback simple revirtiendo el change-set de estilos si se detectan regresiones visuales.

## Open Questions

- Ninguna bloqueante para iniciar; los ajustes se guiarán por el baseline visual actual y comparación before/after en viewport móvil.
