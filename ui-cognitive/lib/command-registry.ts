export type ChatCommandDefinition = {
  name: string;
  insertValue: string;
  description: string;
};

export const CHAT_COMMANDS: ChatCommandDefinition[] = [
  { name: "/new", insertValue: "/new", description: "Crea una nueva conversacion" },
  { name: "/help", insertValue: "/help", description: "Muestra ayuda de comandos locales" },
  { name: "/tools", insertValue: "/tools ", description: "Lista herramientas disponibles del agente" },
  { name: "/status", insertValue: "/status", description: "Estado de la sesión" },
  { name: "/reset", insertValue: "/reset", description: "Reinicia el chat actual" },
  { name: "/stop", insertValue: "/stop", description: "Detiene respuesta en curso" },
  {
    name: "/analyze",
    insertValue: "/analyze ",
    description: "Solicita analisis completo (code, security, QA, docs)",
  },
  {
    name: "/quick-review",
    insertValue: "/quick-review ",
    description: "Solicita analisis rapido orientado a code review",
  },
  {
    name: "/refactor",
    insertValue: "/refactor ",
    description: "Refactoriza codigo del repo analizado (Devstral)",
  },
  {
    name: "/execute",
    insertValue: "/execute ",
    description: "Ejecuta operaciones git: commit, push, PR (Kimi)",
  },
  {
    name: "/models",
    insertValue: "/models",
    description: "Cambiar modelo de inferencia",
  },
  {
    name: "/thinking",
    insertValue: "/thinking",
    description: "Activar/desactivar modo thinking (solo Nemotron)",
  },
  {
    name: "/temperature",
    insertValue: "/temperature ",
    description: "Cambiar preset de temperatura: low (0.1) / medium (0.3) / high (0.7)",
  },
];
