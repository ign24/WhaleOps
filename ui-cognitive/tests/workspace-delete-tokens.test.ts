import { describe, it, expect, beforeEach } from "vitest";
import {
  registerDeleteTokenWithId,
  checkTokenStatus,
  lookupDeleteToken,
  consumeDeleteToken,
  _tokenExists,
} from "@/lib/workspace-delete-tokens";

const SAMPLE_DATA = {
  path: "/app/workspace/test-repo",
  size_mb: 42.5,
  location: "workspace",
  target: "test-repo",
};

describe("registerDeleteTokenWithId", () => {
  it("stores a token with the provided ID and marks it valid", () => {
    const tokenId = "explicit-token-abc-123";
    registerDeleteTokenWithId(tokenId, SAMPLE_DATA);

    expect(_tokenExists(tokenId)).toBe(true);
    expect(checkTokenStatus(tokenId)).toBe("valid");
  });

  it("makes the token retrievable via lookupDeleteToken", () => {
    const tokenId = "lookup-test-token";
    registerDeleteTokenWithId(tokenId, SAMPLE_DATA);

    const entry = lookupDeleteToken(tokenId);
    expect(entry).not.toBeNull();
    expect(entry!.path).toBe(SAMPLE_DATA.path);
    expect(entry!.size_mb).toBe(SAMPLE_DATA.size_mb);
    expect(entry!.location).toBe(SAMPLE_DATA.location);
    expect(entry!.target).toBe(SAMPLE_DATA.target);
  });

  it("token is consumable after registration", () => {
    const tokenId = "consume-test-token";
    registerDeleteTokenWithId(tokenId, SAMPLE_DATA);

    const consumed = consumeDeleteToken(tokenId);
    expect(consumed).not.toBeNull();
    expect(consumed!.path).toBe(SAMPLE_DATA.path);

    // consumed — no longer exists
    expect(_tokenExists(tokenId)).toBe(false);
    expect(checkTokenStatus(tokenId)).toBe("not_found");
  });

  it("respects custom expiration via expiresAt parameter", () => {
    const tokenId = "expired-token";
    const pastExpiry = Date.now() - 1000;
    registerDeleteTokenWithId(tokenId, SAMPLE_DATA, pastExpiry);

    expect(checkTokenStatus(tokenId)).toBe("expired");
  });
});
