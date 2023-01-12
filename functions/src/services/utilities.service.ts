// TODO: move ot utilities file for use elsewhere as well
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
