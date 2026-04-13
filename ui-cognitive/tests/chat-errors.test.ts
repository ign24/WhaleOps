import { describe, expect, it } from "vitest";

import {
  classifyHttpChatError,
  classifyNetworkChatError,
  normalizeStreamErrorText,
} from "@/lib/chat-errors";

describe("classifyHttpChatError", () => {
  it("maps 401 to a session-expired message", () => {
    const message = classifyHttpChatError(401, "Unauthorized");
    expect(message).toContain("sesion");
  });

  it("maps 502 to gateway unavailable", () => {
    const message = classifyHttpChatError(502, "Bad Gateway");
    expect(message).toContain("Gateway inactivo");
  });

  it("maps 500 to backend failure", () => {
    const message = classifyHttpChatError(500, "NAT backend responded 500");
    expect(message).toContain("error interno");
  });
});

describe("classifyNetworkChatError", () => {
  it("maps timeout-like abort to timeout message", () => {
    const message = classifyNetworkChatError(new Error("The operation was aborted"));
    expect(message).toContain("tiempo");
  });

  it("maps generic network failures to gateway offline", () => {
    const message = classifyNetworkChatError(new TypeError("Failed to fetch"));
    expect(message).toContain("No se pudo conectar");
  });
});

describe("normalizeStreamErrorText", () => {
  it("normalizes NAT marker to user-friendly message", () => {
    const normalized = normalizeStreamErrorText("[NAT] upstream failed");
    expect(normalized).toContain("El agente devolvio un error");
  });

  it("normalizes Gateway WS marker to user-friendly message", () => {
    const normalized = normalizeStreamErrorText("[Gateway WS] disconnected");
    expect(normalized).toContain("Gateway inactivo");
  });
});
