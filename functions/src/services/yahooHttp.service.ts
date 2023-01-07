import {loadYahooAccessToken} from "../yahooGetAccessToken";
const fetch = require("node-fetch"); // for compatibility with firebase

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
 * @param {string} url the url to post to
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
