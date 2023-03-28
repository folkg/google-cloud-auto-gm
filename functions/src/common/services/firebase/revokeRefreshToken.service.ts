import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions";

/**
 * Revoke the refresh token for a user
 *
 * @export
 * @param {string} uid - The user id
 */
export function revokeRefreshToken(uid: string) {
  try {
    getAuth().revokeRefreshTokens(uid);
    logger.log(`Token revoked for user ${uid} successfully.`);
  } catch (error) {
    logger.log(error);
  }
}
