export interface FirestoreUser {
  accessToken: string;
  refreshToken: string;
  tokenExpirationTime: number;
  isFreeTrialActivated: boolean;
  isSubscribed: boolean;
  subscriptionExpirationTime: number;
}
