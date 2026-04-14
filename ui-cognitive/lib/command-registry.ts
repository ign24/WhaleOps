export type ChatCommandDefinition = {
  name: string;
  insertValue: string;
  description: string;
};

export const CHAT_COMMANDS: ChatCommandDefinition[] = [
  { name: "/new", insertValue: "/new", description: "Crea una nueva conversacion" },
  { name: "/help", insertValue: "/help", description: "Muestra ayuda de comandos locales" },
  { name: "/tools", insertValue: "/tools ", description: "Lista herramientas disponibles del agente" },
  { name: "/status", insertValue: "/status", description: "Estado del gateway y sesión" },
  { name: "/reset", insertValue: "/reset", description: "Reinicia el chat actual" },
  { name: "/stop", insertValue: "/stop", description: "Detiene respuesta en curso" },
];
