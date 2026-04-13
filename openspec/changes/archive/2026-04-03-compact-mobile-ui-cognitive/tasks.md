## 1. Baseline y alcance mínimo

- [x] 1.1 Identificar en `ui-cognitive` los componentes/estilos exactos de chat/layout, header, conversaciones y cards que afectan móvil.
- [x] 1.2 Definir baseline visual móvil (before) para asegurar que solo se toquen reglas de densidad visual sin cambios funcionales.

## 2. Implementación mobile-first de densidad

- [x] 2.1 Reducir espacios verticales no esenciales en contenedores de chat/layout para breakpoints móviles.
- [x] 2.2 Compactar header móvil (alturas, paddings, separación interna) preservando controles e información.
- [x] 2.3 Compactar barra/botón de conversaciones y drawer móvil manteniendo el mismo comportamiento de apertura/cierre y navegación.
- [x] 2.4 Ajustar cards y tipografía con escala mobile-first para mejorar legibilidad y uso del viewport.

## 3. Verificación y control de riesgos

- [x] 3.1 Validar que no existan cambios funcionales en chat, streaming, selección de conversaciones ni estado del drawer.
- [x] 3.2 Verificar legibilidad/tap targets en móvil real o emulado (ancho pequeño) y ausencia de regresiones en breakpoints intermedios.
- [x] 3.3 Ejecutar lint/build frontend aplicable y documentar cualquier ajuste necesario manteniendo alcance mínimo.
