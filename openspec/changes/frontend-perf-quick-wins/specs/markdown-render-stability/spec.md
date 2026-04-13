## ADDED Requirements

### Requirement: Stable components prop identity across renders

`MessageMarkdown` SHALL pasar a `ReactMarkdown` un objeto `components` con **identidad referencial estable** entre renders. La definición MUST residir en el scope del módulo (constante module-level) y NOT en el scope del componente.

#### Scenario: Components prop has referential stability
- **WHEN** se monta `MessageMarkdown` y luego se re-renderiza con distinto `content`
- **THEN** la referencia al objeto `components` pasado a `ReactMarkdown` MUST ser `===` entre ambos renders

### Requirement: Bounded render count during streaming

`MessageMarkdown` SHALL limitar el número de renders observados durante streaming de tokens a a lo sumo `1.2 × numero_de_tokens`. La meta es evitar re-render del árbol completo de react-markdown por cambio de identidad de props.

#### Scenario: Streaming N tokens triggers at most 1.2N renders
- **WHEN** se renderiza `MessageMarkdown` y se actualiza su prop `content` N veces (N ≥ 10) concatenando un token por vez
- **THEN** el número de veces que el componente interno de `MessageMarkdown` ejecutó su función render MUST ser ≤ `N * 1.2`

#### Scenario: Constant content does not re-render
- **WHEN** `MessageMarkdown` se re-renderiza con `content` idéntico al anterior (misma string)
- **THEN** el componente memoizado MUST NOT ejecutar su función render adicional (gracias a `memo` + identidad estable de props)
