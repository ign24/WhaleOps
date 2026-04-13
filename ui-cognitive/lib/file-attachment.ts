export const CODE_EXTENSIONS = new Set([
  "py", "ts", "js", "tsx", "jsx", "json", "yaml", "yml", "toml",
  "md", "txt", "sh", "bash", "dockerfile", "env", "css", "html", "xml", "sql",
]);

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

export const MAX_CODE_BYTES = 100 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type AttachmentValidationResult =
  | { ok: true; type: "code" | "image" }
  | { ok: false; error: string };

export const validateAttachment = (file: { name: string; size: number }): AttachmentValidationResult => {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isDockerfile = file.name.toLowerCase() === "dockerfile";
  const isCode = CODE_EXTENSIONS.has(ext) || isDockerfile;
  const isImage = IMAGE_EXTENSIONS.has(ext);

  if (!isCode && !isImage) {
    return { ok: false, error: `Tipo de archivo no soportado (.${ext})` };
  }

  if (isCode && file.size > MAX_CODE_BYTES) {
    return { ok: false, error: `El archivo supera el límite de 100 KB` };
  }

  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `La imagen supera el límite de 2 MB` };
  }

  return { ok: true, type: isCode ? "code" : "image" };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getLanguageTag = (name: string): string => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    py: "python", ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml", sh: "bash",
    bash: "bash", md: "markdown", css: "css", html: "html", sql: "sql",
  };
  return map[ext] ?? ext;
};
