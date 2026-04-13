# Comparativa: CGN-Agent vs OpenClaw vs OpenCode vs Google Antigravity

## Qué es cada uno

- **CGN-Agent**: agente único multi-modo (`/analyze`, `/execute`, `chat`) sobre NVIDIA NAT 1.4.1, backend FastAPI, UI Next.js 16 propia (`ui-cognitive`), memoria de tres capas (working / Redis episódica / Milvus vectorial), MCP (filesystem, GitHub, Context7). Producto interno de Cognitive LATAM / CGN Labs.
- **OpenClaw**: agente personal open-source (Peter Steinberger). Self-hosted, corre local, usa apps de mensajería como interfaz. Mantiene diario, identidad y to-do persistentes.
- **OpenCode (sst/opencode)**: CLI/TUI en Go del equipo SST, agnóstico de proveedor. Vive en la terminal, con sesiones, LSP y tooling para edición/ejecución.
- **Google Antigravity**: IDE agent-first (fork modificado de VS Code) lanzado por Google con Gemini 3 (nov-2025). Manager view para orquestar varios agentes en paralelo, *Artifacts* verificables.

## Cuadro comparativo

| Dimensión | **CGN-Agent** | **OpenClaw** | **OpenCode (sst)** | **Google Antigravity** |
|---|---|---|---|---|
| **Categoría** | Agente vertical de code-intelligence (B2B interno) | Asistente personal generalista | CLI/TUI coding agent | IDE agent-first |
| **Interfaz primaria** | Web UI Next.js + API REST | Apps de mensajería (Slack, WhatsApp, iMessage…) | Terminal (Bubble Tea TUI) | IDE de escritorio (fork VS Code) + Manager view |
| **Modelo de despliegue** | Self-hosted (Docker Compose, Easypanel) | Self-hosted local | Local CLI | App de escritorio Google (Mac/Win/Linux), preview gratuita |
| **Licencia** | Privado (Cognitive LATAM) | Open-source | Open-source | Propietario, gratis en preview |
| **Framework de agente** | NVIDIA NAT 1.4.1 + LangGraph | Propio (gateway + skills) | Propio en Go | Propio, agent-first sobre VS Code |
| **Modelos soportados** | **Acceso inmediato a todo el catálogo de NVIDIA NIM** vía integración directa, sin capa de traducción. Selector de modelo en runtime por modo. | BYO API key, multi-LLM | Multi-proveedor (Claude, OpenAI, Gemini, Bedrock, Groq, OpenRouter, local) | Gemini 3 Pro/Flash (default), Claude Sonnet 4.5, GPT-OSS |
| **Arquitectura de agentes** | Single-agent multi-modo + sub-agents (reader, security, qa, review, docs) | Single agent personal con skills | Single agent | Multi-agent paralelo orquestado desde Manager view |
| **Memoria** | 3 capas: working (eviction summarization) + Redis episódica + Milvus vectorial | Diario + identity file + to-do persistente local | Sesiones SQLite | Per-workspace, gestionada por la plataforma |
| **Tooling code-specific** | fs, shell tiered safety, git, MCP GitHub, Context7, Tavily, SAST, secrets, CVE | fs, shell, browser, email, APIs (generalista) | Edición de archivos, shell, LSP, vim-like editor | Edición, terminal integrada, browser automation, screenshots, artifacts |
| **Streaming** | Respuesta en vivo token a token; si el stream se cae, cambia a modo bloqueante automáticamente para no perder la respuesta | Sí (mensajería) | Sí, en TUI | Sí, en IDE |
| **Verificación de salida** | Tool-call cards, Activity Panel, trazas NAT exporter | Logs en chats | TUI logs | Artifacts verificables (planes, screenshots, browser recordings) |
| **MCP** | First-class (filesystem, GitHub, Context7) | Vía conectores propios | Compatible MCP | Compatible (parte del agent-first stack) |
| **Observabilidad** | NAT file exporter + métricas por usuario | Diario + logs locales | Logs CLI | Telemetría integrada al IDE |
| **Foco / sweet spot** | Análisis de repos grandes, refactors guiados, QA y security en code-bases empresariales | Asistente general que vive en tu mensajería | Dev solo en terminal, vendor-neutral | Delegar tareas largas a agentes mientras hacés otra cosa |
| **Diferenciador** | Memoria semántica por repo + sub-agents especializados + safety tiers + UI propia con stream cognitivo + acceso directo al catálogo NIM | Vive donde vos chateás; viral por simplicidad y privacidad local | Verdaderamente agnóstico de proveedor, ligero, hackeable | Manager paralelo + artifacts auditables + Gemini 3 nativo |
| **Limitaciones vs el resto** | Acoplado al ecosistema NIM (no llama OpenAI/Anthropic/Gemini directo), UI propia que mantener | No es un coding agent puro, débil en repos grandes | Sin UI rica, sin memoria vectorial, sin sub-agents | Cerrado, dependés del IDE, menos hackeable |

## Lectura corta

CGN-Agent juega en otra liga que OpenClaw (asistente personal generalista por mensajería) y compite más de cerca con **OpenCode** (mismo dominio: coding agent) y con **Antigravity** (mismo paradigma agent-first con UI propia).

Frente a OpenCode, CGN-Agent gana en memoria semántica por repo, sub-agents especializados, UI cognitiva y amplitud de modelos (todo NIM, directo); pierde en flexibilidad multi-proveedor.

Frente a Antigravity, CGN-Agent gana en self-hosting, privacidad y verticalización; pierde en orquestación paralela visible y artifacts verificables — dos features que valdría la pena mirar para una próxima iteración.

## Fuentes

- [GitHub - sst/opencode](https://github.com/sst/opencode/tree/dev)
- [OpenCode docs](https://opencode.ai/docs/)
- [Build with Google Antigravity — Google Developers Blog](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
- [Google Antigravity — Wikipedia](https://en.wikipedia.org/wiki/Google_Antigravity)
- [GitHub - openclaw/openclaw](https://github.com/openclaw/openclaw)
- [OpenClaw — Personal AI Assistant](https://openclaw.ai/)
