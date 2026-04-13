import { afterEach, describe, expect, it } from "vitest";

describe("lib/env", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.NAT_BACKEND_URL;
  });

  it("returns NAT_BACKEND_URL when set", async () => {
    process.env.NAT_BACKEND_URL = "http://custom-backend:9000";
    const { getBackendUrl } = await import("@/lib/env");
    expect(getBackendUrl()).toBe("http://custom-backend:9000");
  });

  it("falls back to localhost in development", async () => {
    delete process.env.NAT_BACKEND_URL;
    process.env.NODE_ENV = "development";
    const { getBackendUrl } = await import("@/lib/env");
    expect(getBackendUrl()).toBe("http://127.0.0.1:8000");
  });

  it("throws in production when NAT_BACKEND_URL is missing", async () => {
    delete process.env.NAT_BACKEND_URL;
    process.env.NODE_ENV = "production";
    const { getBackendUrl } = await import("@/lib/env");
    expect(() => getBackendUrl()).toThrow("NAT_BACKEND_URL");
  });
});
