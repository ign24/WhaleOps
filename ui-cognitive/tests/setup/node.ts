import { afterEach } from "vitest";

afterEach(() => {
  delete process.env.NAT_BACKEND_URL;
  delete process.env.NAT_CHAT_TIMEOUT_MS;
});
