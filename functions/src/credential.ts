export interface ReturnCredential {
  accessToken: string;
  tokenExpirationTime: number;
}

export interface YahooCredential {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface YahooRefreshRequestBody {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  refresh_token: string;
  grant_type: string;
}
