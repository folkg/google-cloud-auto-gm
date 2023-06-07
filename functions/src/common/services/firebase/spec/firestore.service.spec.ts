// Import the necessary dependencies and modules
import { loadYahooAccessToken } from "../firestore.service";
import { RevokedRefreshTokenError } from "../errors";
import { vi, describe, it, expect } from "vitest";

// Mock the necessary dependencies
vi.mock("firebase-admin", () => {
  const firestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          data: vi.fn(() => ({
            refreshToken: "-1",
          })),
          exists: true,
        }),
      })),
    })),
  }));

  return {
    initializeApp: vi.fn(),
    firestore,
  };
});

describe.concurrent("loadYahooAccessToken", () => {
  it('should throw RevokedRefreshTokenError when refresh token is "-1"', async () => {
    try {
      await loadYahooAccessToken("123"); // Replace '123' with the actual user ID
      fail("Expected RevokedRefreshTokenError to be thrown.");
    } catch (error: any) {
      expect(error).toBeInstanceOf(RevokedRefreshTokenError);
      expect(error.message).toEqual(
        "RevokedRefreshTokenError: User 123 has revoked access. Stopping all actions for this user."
      );
    }
  });
});
