import { getAuth } from "firebase-admin/auth";

/**
 * Revoke the refresh token for a user
 *
 * @export
 * @param {string} uid - The user id
 */
export function revokeRefreshToken(uid: string) {
  try {
    getAuth().revokeRefreshTokens(uid);
    console.log(`Token revoked for user ${uid} successfully.`);
  } catch (error) {
    console.log(error);
  }
}
