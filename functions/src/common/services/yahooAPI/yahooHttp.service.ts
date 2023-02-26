import axios from "axios";
import { loadYahooAccessToken } from "../firebase/firestore.service";

const API_URL = "https://fantasysports.yahooapis.com/fantasy/v2/";

/**
 * Perform an HTTP put request to the yahoo API
 *
 * @export
 * @async
 * @param {string} url - the url to fetch
 * @param {string} uid The firebase uid of the user
 * @return {unknown} - the response from the API
 */
export async function httpGetAxios(url: string, uid: string) {
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
export function httpPostAxios(url: string, body: any) {
  return axios.post(url, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
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
