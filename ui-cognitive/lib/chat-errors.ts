const normalize = (text: string): string => text.toLowerCase();

export const classifyHttpChatError = (status: number, rawError?: string): string => {
  if (status === 401) {
    return "Tu sesion expiro. Volve a iniciar sesion para continuar.";
  }

  if (status === 502 || status === 503 || status === 504) {
    return "Gateway inactivo. No se pudo conectar con el servidor de IA.";
  }

  if (status >= 500) {
    return "El servidor de IA devolvio un error interno. Intenta nuevamente en unos segundos.";
  }

  if (rawError && rawError.trim().length > 0) {
    return rawError;
  }

  return "No se pudo obtener respuesta del gateway.";
};

export const classifyNetworkChatError = (error: Error): string => {
  const message = normalize(error.message);
  if (message.includes("aborted") || message.includes("timeout")) {
    return "Se agoto el tiempo de espera del agente. Proba con un mensaje mas corto.";
  }

  return "No se pudo conectar con el gateway de IA. Verifica que el backend NAT este activo.";
};

export const normalizeStreamErrorText = (content: string): string => {
  const trimmed = content.trim();
  if (trimmed.startsWith("[NAT]")) {
    return "El agente devolvio un error durante el procesamiento. Intenta nuevamente.";
  }

  if (trimmed.startsWith("[Gateway WS]")) {
    return "Gateway inactivo. Se perdio la conexion durante la respuesta.";
  }

  return content;
};
