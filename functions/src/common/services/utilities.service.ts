const { GoogleAuth } = require("google-auth-library");

/**
 * The properties of the Player object are not consistent.
 * This function will find the property by name.
 *
 * @param {any[]} array - The array to search
 * @param {string} key - The property name to search for
 * @return {*} - The value of the property
 */
export function getChild(array: any[], key: string) {
  for (const element of array) {
    if (element[key]) {
      return element[key];
    }
  }
  return null;
}

let auth: any;
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
 * convert date (PST) to a string in the format YYYY-MM-DD
 *
 * @param {Date} date - The date to convert
 * @return {string}
 */
export function datePSTString(date: Date): string {
  const datePTC: string = date.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateParts: string[] = datePTC.split("/");
  const dateString: string =
    dateParts[2] + "-" + dateParts[0] + "-" + dateParts[1];
  return dateString;
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
