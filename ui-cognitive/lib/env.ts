const DEFAULT_NAT_BACKEND_URL = "http://127.0.0.1:8000";

export function getBackendUrl(): string {
  const url = process.env.NAT_BACKEND_URL;
  if (url) return url;

  if (process.env.NODE_ENV === "production") {
    throw new Error("NAT_BACKEND_URL is required in production");
  }

  return DEFAULT_NAT_BACKEND_URL;
}
