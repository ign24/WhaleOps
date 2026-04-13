## 1. Registry and metadata

- [x] 1.1 Agregar `opennessCategory` (y labels requeridos) al tipado y entries de `ui-cognitive/lib/model-registry.ts`.
- [x] 1.2 Mantener compatibilidad de utilidades existentes y evitar cambios de contrato innecesarios fuera del selector.

## 2. Model selector UI behavior

- [x] 2.1 Reemplazar badges de costo por badges de apertura en `ui-cognitive/components/chat/model-selector.tsx` (chip activo + dropdown).
- [x] 2.2 Eliminar confirmación de selección por costo/billing y conservar bloqueo por política (`block`).
- [x] 2.3 Limpiar labels/constantes sin uso asociadas al flujo de costo en este componente.

## 3. Validation

- [x] 3.1 Actualizar tests en `ui-cognitive/tests/model-selector.test.tsx` para validar badges de apertura.
- [x] 3.2 Agregar/ajustar test para asegurar que no se usa `window.confirm` por costo al seleccionar modelos.
- [x] 3.3 Ejecutar `bun run test -- model-selector` (o equivalente) y corregir fallos.
- [x] 3.4 Traducir tooltips de badges a español explicando el significado de cada categoría.
- [x] 3.5 Ajustar estilo visual de badges a variante minimalista (estética tipo Vercel, menos color).
