import { GoogleAuth } from "google-auth-library";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import spacetime from "spacetime";
// const spacetime = require("spacetime"); // problematic with TS ES module imports for some reason

/**
 * The properties of the Player object are not consistent.
 * This function will find the property by name.
 *
 * @param {any[]} array - The array to search
 * @param {string} key - The property name to search for
 * @return {*} - The value of the property
 */
export function getChild(array: any[], key: string) {
  const element = array.find((o) => o[key] !== undefined);
  return element ? element[key] : null;
}

export function parseStringToInt(value: string, defaultValue = -1): number {
  return parseInt(value) || defaultValue;
}

let auth: GoogleAuth<any>;
/**
 * Get the URL of a given v2 cloud function.
 *
 * @param {string} name the function's name
 * @param {string} location the function's location
 * @return {Promise<string>} The URL of the function
 *
 */
export async function getFunctionUrl(name: string, location = "us-central1") {
  if (!auth) {
    auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
  }
  const projectId = await auth.getProjectId();
  const url =
    "https://cloudfunctions.googleapis.com/v2beta/" +
    `projects/${projectId}/locations/${location}/functions/${name}`;

  const client = await auth.getClient();
  const res = await client.request({ url });
  const uri = res.data?.serviceConfig?.uri;
  if (!uri) {
    throw new Error(`Unable to retreive uri for function at ${url}`);
  }
  return uri;
}

/**
 * convert date (PT) to a string in the format YYYY-MM-DD
 *
 * @param {Date} date - The date to convert
 * @return {string} - The date, pacific time, in the format YYYY-MM-DD
 */
export function getPacificTimeDateString(date: Date): string {
  const t = spacetime(date, "Canada/Pacific");
  const year = String(t.year());
  const month = String(t.month() + 1).padStart(2, "0");
  const day = String(t.date()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * get the start of the day in pacific time (00:00:00.000)
 *
 * @export
 * @param {string} date - The date string to convert
 * @return {number} - The start of the day in pacific time
 */
export function getPacificStartOfDay(date: string): number {
  return spacetime(date, "Canada/Pacific").startOf("day").epoch;
}

/**
 * get the end of the day in pacific time (23:59:59.999)
 *
 * @export
 * @param {string} date - The date string to convert
 * @return {number} - The end of the day in pacific time
 */
export function getPacificEndOfDay(date: string): number {
  return spacetime(date, "Canada/Pacific").endOf("day").epoch;
}

/**
 * get the current hour in pacific time
 *
 * @export
 * @return {number} - The current hour in pacific time
 */
export function getCurrentPacificHour(): number {
  return spacetime.now("Canada/Pacific").hour();
}

/**
 * 	Return the current day of the week (Pacific Time) as an integer, starting on sunday (day-0)
 *
 * @export
 * @return {number} - The current day of the week (Pacific Time) as an integer, starting on sunday (day-0)
 */
export function getCurrentPacificNumDay(): number {
  return spacetime.now("Canada/Pacific").day();
}

/**
 * Return now() as an epoch number.
 *
 * Useful for mocking the current time in tests, if we ever need to.
 *
 * @export
 * @return {number}
 */
export function getNow(): number {
  return spacetime.now().epoch;
}

/**
 * Takes an array and a predicate function and returns an array of two arrays.
 * The first array contains all the elements that satisfy the predicate.
 * The second array contains all the elements that do not satisfy the predicate.
 *
 * @template T The type of the array elements
 * @param {T[]} arr The array to partition
 * @param {()} predicate The predicate function
 * @return {[][]} The partitioned array
 */
export function partitionArray<T>(
  arr: T[],
  predicate: (item: T) => boolean
): T[][] {
  return arr.reduce(
    (acc, item) => {
      if (predicate(item)) {
        acc[0].push(item);
      } else {
        acc[1].push(item);
      }
      return acc;
    },
    [[], []] as T[][]
  );
}

/**
 * Returns true if the array is empty or all of the sub arrays are empty.
 *
 * @export
 * @template T The type of the array elements
 * @param {T} arr The array to check
 * @return {boolean} True if the array is empty or all of the sub arrays are empty
 */
export function is2DArrayEmpty<T>(arr: T[][]): boolean {
  return arr.length === 0 || arr.every((subArr) => subArr.length === 0);
}
