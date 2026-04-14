// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockGet })),
}));

import { getSession } from "@/lib/auth";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(payload: object, options: { expiresIn?: string | number; secret?: Uint8Array } = {}) {
  const { expiresIn = "7d", secret = JWT_SECRET } = options;
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(secret);
}

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when no cookie is present", async () => {
    mockGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns the session payload for a valid token", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await makeToken({ userId: "user_abc", email: "test@example.com", expiresAt });
    mockGet.mockReturnValue({ value: token });

    const session = await getSession();

    expect(session?.userId).toBe("user_abc");
    expect(session?.email).toBe("test@example.com");
  });

  test("returns null for a token signed with the wrong secret", async () => {
    const token = await makeToken(
      { userId: "user_abc", email: "test@example.com" },
      { secret: new TextEncoder().encode("wrong-secret") }
    );
    mockGet.mockReturnValue({ value: token });

    expect(await getSession()).toBeNull();
  });

  test("returns null for a malformed token", async () => {
    mockGet.mockReturnValue({ value: "not.a.valid.jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken(
      { userId: "user_abc", email: "test@example.com" },
      { expiresIn: Math.floor(Date.now() / 1000) - 1 }
    );
    mockGet.mockReturnValue({ value: token });

    expect(await getSession()).toBeNull();
  });
});
