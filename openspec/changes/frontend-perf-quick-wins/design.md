## Context

`ui-cognitive` (Next 16.1.6, React 19.2, Turbopack/Webpack) sirve dos rutas pesadas: `/chat/[sessionKey]` y `/observability`. Auditoría con `next-devtools` MCP y la guía de performance de Vercel revela cuatro problemas medibles y de bajo esfuerzo:

1. **Bundle barrels no optimizados**: 17 archivos importan de `lucide-react`, múltiples de `motion`, `recharts` y `@floating-ui/react`. `next.config.ts` solo declara `output: "standalone"`.
2. **Libs pesadas eager-loaded**: `mermaid` (~800KB), `shiki` (~500KB), `recharts`, `katex` se bundlean en el first-load chunk del chat aunque se usen condicionalmente.
3. **Re-render cascada en streaming**: `MessageMarkdown` pasa `components={{...}}` inline a `ReactMarkdown`. El objeto se recrea por render → cada token entrante invalida la memoización y re-renderiza el árbol markdown completo.
4. **Hydration mismatches**: DarkReader inyecta atributos como `data-darkreader-inline-stroke` en SVGs post-render. React descarta el árbol SSR y re-renderiza en cliente.

Estado actual del proyecto:
- `package.json` usa Vitest 4 + Playwright. Scripts: `test`, `test:e2e`, `test:coverage`.
- Sin test de bundle-size ni render-count hoy.
- `app/layout.tsx:33` ya tiene `suppressHydrationWarning` en `<html>` pero no en `<body>`.

## Goals / Non-Goals

**Goals:**
- Reducir First Load JS de `/chat/[sessionKey]` ≥ 20% (baseline vs post).
- Reducir renders de `MessageMarkdown` durante streaming ≥ 80% (N tokens → ≤ 1.2·N renders en lugar de N × árbol completo).
- Eliminar hydration warnings provocados por extensiones tipo DarkReader.
- Cubrir los cuatro cambios con tests que fallen antes de la implementación (RED) y pasen después (GREEN).

**Non-Goals:**
- Split de `chat-panel.tsx` (2185 LOC) — change separado.
- Migración `LazyMotion` — change separado.
- Paralelización de `/api/chat/route.ts` — change separado.
- Service worker / PWA.
- CSS bundle optimization.

## Decisions

### D1: `experimental.optimizePackageImports` vs `modularizeImports`
**Elegido:** `experimental.optimizePackageImports` con lista explícita.
**Por qué:** soportado oficialmente en Next 16; lucide-react está en la whitelist default pero la lista explícita nos da control verificable. `modularizeImports` es legacy y requiere patrones por paquete.
**Alternativa descartada:** babel-plugin-transform-imports — incompatible con SWC.

### D2: `next/dynamic` con `ssr: false` vs `React.lazy`
**Elegido:** `next/dynamic` con `ssr: false` para `MermaidDiagram` y charts de recharts (solo tienen sentido en cliente); `next/dynamic` con `ssr: true` para `CodeBlock` (shiki puede renderizar en SSR para FCP de bloques de código largos).
**Por qué:** `next/dynamic` integra con el streaming de RSC y loading boundaries. `React.lazy` requeriría `<Suspense>` manual y no juega bien con App Router.

### D3: Carga condicional de `rehype-katex`
**Elegido:** detección heurística en el contenido (`/\$[^\n]+\$|\$\$/`) y `useMemo` del arreglo `rehypePlugins`. Sólo se importa `rehype-katex` y su CSS cuando hay match.
**Alternativa descartada:** importarlo siempre — el CSS de katex pesa ~23KB gzip y la mayoría de mensajes no tienen math.
**Trade-off:** el primer mensaje con math tendrá un chunk extra que cargar; aceptable porque es condicional y cacheable.

### D4: Hoist `components={{...}}` a constante module-level
**Elegido:** extraer la definición a `MARKDOWN_COMPONENTS` fuera del componente. Los renderers internos (`CodeBlock`, `MermaidDiagram`) se referencian por nombre; el `code` renderer decide qué componente usar internamente.
**Por qué:** asegura **referential stability** entre renders → `ReactMarkdown` (internamente memoizado) puede bailar en cambios reales de `children`.
**Trade-off:** los renderers pierden closure sobre props del componente padre; hoy no usan nada del parent scope, así que es seguro. Si en el futuro necesitan `enhancementState`, pasarlo vía contexto o data-attributes (ya se usa `data-chat-enhancement` en el wrapper).

### D5: `suppressHydrationWarning` alcance
**Elegido:** agregar en `<body>` de `app/layout.tsx`. Scope mínimo para cubrir el caso común (atributos inyectados por extensiones en cualquier descendiente visible) sin silenciar hydration errors legítimos del árbol React (que siguen validándose nivel por nivel).
**Nota:** `suppressHydrationWarning` solo suprime **un** nivel; los descendientes siguen validándose. Por eso no basta con `<html>`.

### D6: Cómo medir bundle size en tests
**Elegido:** `scripts/measure-bundle.mjs` parsea `.next/app-build-manifest.json` + tamaños de chunks en `.next/static/chunks/`. El test (`tests/bundle-budget.test.ts`) carga el JSON producido por el script y valida contra presupuestos.
**Por qué:** parsear el output stdout de `next build` es frágil; el manifest es estable y determinístico.
**Presupuestos (post-implementación, margen 10%):**
- `/chat/[sessionKey]` First Load JS ≤ **baseline × 0.80** (capturar baseline antes de implementar).

### D7: Cómo medir render-count en streaming
**Elegido:** test de Vitest + Testing Library que envuelve `MessageMarkdown` en un `RenderCounter` (HOC que incrementa un ref cada render del hijo) y actualiza `content` token-por-token con `rerender`. Assertion: `counter.current <= tokens.length * 1.2`.
**Alternativa descartada:** `React.Profiler` — overhead mayor, API menos estable en testing.

### D8: Cómo testear hydration-resilience
**Elegido:** test Playwright que navega a `/chat/[sessionKey]`, antes de que React hidrate inyecta atributos `data-darkreader-*` en elementos del árbol, y valida que `page.on('console')` no reciba errores con mensaje `/hydrat/i`.
**Alternativa descartada:** test unit con happy-dom — no emula el ciclo de hidratación real de React/Next.

## Risks / Trade-offs

- **[Riesgo]** `experimental.optimizePackageImports` es flag experimental; en alguna minor de Next puede cambiar. → **Mitigación:** lock de versión en `package.json`, test de bundle corre en CI y detectaría regresión de tamaño.
- **[Riesgo]** `ssr: false` en `CodeBlock` mostraría un flash de "unstyled code" en páginas que rendericen markdown en server. → **Mitigación:** mantener `ssr: true` en `CodeBlock` (ver D2); usar skeleton/`loading` component que reproduzca layout. Para `MermaidDiagram` sí `ssr: false` — mermaid usa APIs DOM.
- **[Riesgo]** Detección heurística de math (`\$...\$`) da falsos positivos en texto con precios (`$10 y $20`). → **Mitigación:** regex más estricto que requiera contenido matemático razonable (`/\$[^$\s][^$\n]*[^$\s]\$|\$\$/`), o fallback a cargar katex cuando hay cualquier `$` — costo aceptable.
- **[Riesgo]** Hoist de `MARKDOWN_COMPONENTS` cambia closures si algún renderer dependía de props. → **Mitigación:** revisión manual de cada renderer en el edit; los actuales sólo usan `props` de react-markdown.
- **[Riesgo]** Test de bundle-size requiere `next build` completo, lento (~60s). → **Mitigación:** script separado `bun run test:bundle`, no en `test` watch. Corre en CI o pre-push.

## Migration Plan

1. Capturar baseline: `bun run build` y persistir `baseline-bundle.json` (no comiteado, pero referenciado en TDD).
2. Implementar tasks en orden TDD: RED (test falla) → GREEN (implementación mínima) → siguiente task.
3. Validar GREEN final: `bun run test:all` + `bun run test:bundle` + `bun run test:e2e`.
4. Verificar manualmente en `/chat` y `/observability` con DevTools → Network → "First Load JS" vs baseline.
5. Rollback: revert commit; flag experimental no deja state en `.next/` que requiera limpiar (`rm -rf .next` si acaso).

## Open Questions

- ¿El presupuesto del 20% de reducción es alcanzable sin tocar `chat-panel.tsx`? Respuesta estimada: sí, solo con dynamic imports de mermaid+shiki+recharts. Validaremos con el baseline.
- ¿`rehype-katex` condicional rompe el flujo de streaming si el primer chunk no tiene math y el segundo sí? Respuesta: `useMemo([content])` recomputa `rehypePlugins` cuando aparece match; react-markdown reprocesa. Aceptable.
