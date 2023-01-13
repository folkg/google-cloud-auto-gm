import {loadYahooAccessToken} from "../yahooGetAccessToken";
const fetch = require("node-fetch"); // for compatibility with firebase
import axios from "axios";

const API_URL = "https://fantasysports.yahooapis.com/fantasy/v2/";

/**
 * Perform an HTTP get request to the Yahoo API
 * @async
 * @param {string} url - the url to fetch
 * @param {string} uid The firebase uid of the user
 * @return {Promise<any>} The JSON object returned from Yahoo
 */
export async function httpGet(url: string, uid: string): Promise<any> {
  const credential = await loadYahooAccessToken(uid);
  const accessToken = credential.accessToken;

  const response = await fetch(API_URL + url, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  // check for HTTP errors
  if (!response.ok) {
    return Promise.reject(response);
  }
  return Promise.resolve(response.json());
}

/**
 * Perform an HTTP post request to the Yahoo API
 * @param {string} url the FULL url to post to. Does not use API_URL.
 * @param {*} body the body of the post request
 * @return {Promise<any>} the response from the API
 */
export async function httpPost(url: string, body: any): Promise<any> {
  const response = await fetch(url, {
    method: "post",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body,
  });

  // check for HTTP errors
  if (!response.ok) {
    return Promise.reject(response);
  }
  return Promise.resolve(response.json());
}

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

  const response = await axios.get(API_URL + url, {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  return response;
}

/**
 * Perform an HTTP post request to the Yahoo API
 *
 * @export
 * @async
 * @param {string} url - the url to fetch
 * @param {*} body - the body of the post request
 * @return {unknown} - the response from the API
 */
export async function httpPostAxios(url: string, body: any) {
  const response = await axios.post(url, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return response;
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

  const response = await axios.put(API_URL + url, body, {
    headers: {
      "content-type": "application/xml; charset=UTF-8",
      "Authorization": "Bearer " + accessToken,
    },
  });

  return response;
}
