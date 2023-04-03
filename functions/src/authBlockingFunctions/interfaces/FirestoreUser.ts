export interface FirestoreUser {
  accessToken: string;
  refreshToken: string;
  tokenExpirationTime: number;
  freeTrialExpirationTime: number;
  subscriptionExpirationTime: number;
}
