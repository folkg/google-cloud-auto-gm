// Import the necessary dependencies and modules
import { loadYahooAccessToken } from "../firestore.service";
import { RevokedRefreshTokenError } from "../errors";

// Mock the necessary dependencies
jest.mock("firebase-admin", () => {
  const firestore = jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          data: jest.fn(() => ({
            refreshToken: "-1",
          })),
          exists: true,
        }),
      })),
    })),
  }));

  return {
    initializeApp: jest.fn(),
    firestore,
  };
});

describe("loadYahooAccessToken", () => {
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
