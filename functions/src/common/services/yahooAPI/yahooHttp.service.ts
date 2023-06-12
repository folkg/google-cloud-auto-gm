import axios from "axios";
import axiosRetry from "axios-retry"; // problematic with TS ES module imports for some reason
// const axiosRetry = require("axios-retry");
import { loadYahooAccessToken } from "../firebase/firestore.service.js";

const API_URL = "https://fantasysports.yahooapis.com/fantasy/v2/";
type AxiosRetry = typeof axiosRetry.default; // weird hack to get around the import issues
const shouldRetry = (error: any) =>
  axiosRetry.isNetworkError(error) ||
  axiosRetry.isRetryableError(error) ||
  error.code === "ECONNABORTED" ||
  error.response?.status === 429;
(axiosRetry as unknown as AxiosRetry)(axios, {
  retries: 3,
  retryCondition: shouldRetry,
});

/**
 * Perform an HTTP put request to the yahoo API
 *
 * @export
 * @async
 * @param {string} url - the url to fetch
 * @param {?string} [uid] - the firebase uid of the user
 * @return {unknown} - the response from the API
 */
export async function httpGetAxios(url: string, uid?: string) {
  if (!uid) {
    return axios.get(API_URL + url);
  }

  const credential = await loadYahooAccessToken(uid);
  const accessToken = credential.accessToken;

  return axios.get(API_URL + url, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });
}

/**
 * Perform an HTTP post request to the Yahoo API
 *
 * @export
 * @async
 * @param {string} url - the FULL url to post to. Does not use API_URL.
 * @param {*} body - the body of the post request
 * @return {unknown} - the response from the API
 */
export function httpPostAxiosUnauth(url: string, body: any) {
  return axios.post(url, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
}

export async function httpPostAxiosAuth(uid: string, url: string, body: any) {
  const credential = await loadYahooAccessToken(uid);
  const accessToken = credential.accessToken;

  return axios.post(API_URL + url, body, {
    headers: {
      "content-type": "application/xml; charset=UTF-8",
      Authorization: "Bearer " + accessToken,
    },
  });
}

/**
 * Perform an HTTP put request to the yahoo API
 *
 * @export
 * @async
 * @param {string} uid The firebase uid of the user
 * @param {string} url - the url to fetch
 * @param {string} body - the body of the put request
 * @return {unknown} - the response from the API
 */
export async function httpPutAxios(uid: string, url: string, body: string) {
  const credential = await loadYahooAccessToken(uid);
  const accessToken = credential.accessToken;

  return axios.put(API_URL + url, body, {
    headers: {
      "content-type": "application/xml; charset=UTF-8",
      Authorization: "Bearer " + accessToken,
    },
  });
}
