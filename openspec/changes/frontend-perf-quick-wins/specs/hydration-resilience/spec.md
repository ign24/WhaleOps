## ADDED Requirements

### Requirement: Body-level hydration warning suppression

El layout raíz (`app/layout.tsx`) SHALL declarar `suppressHydrationWarning` en el elemento `<body>` para neutralizar mutaciones DOM introducidas por extensiones de navegador (ej: DarkReader) que no son parte del árbol React.

#### Scenario: Root layout body has suppressHydrationWarning
- **WHEN** se lee el JSX de `RootLayout` en `app/layout.tsx`
- **THEN** el elemento `<body>` MUST incluir la prop `suppressHydrationWarning`

### Requirement: No hydration error when extension-like attributes are injected

La aplicación SHALL hidratarse sin emitir errores de hidratación en consola cuando atributos de estilo/data comunes de extensiones (como `data-darkreader-inline-stroke`, `--darkreader-inline-stroke`) son inyectados en descendientes del `<body>` antes de la hidratación.

#### Scenario: DarkReader-like injection produces no hydration error
- **WHEN** se navega a `/login` (o cualquier ruta del app) y, antes de la hidratación, se inyectan atributos `data-darkreader-inline-stroke` y estilos `--darkreader-inline-stroke` en SVGs del layout
- **THEN** la consola del navegador MUST NOT emitir ningún error cuyo mensaje coincida con `/hydrat(ed|ion)/i`
