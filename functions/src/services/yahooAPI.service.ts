import { AxiosError } from "axios";
import { RosterModification } from "../interfaces/roster";
import { httpPutAxios } from "./yahooHttp.service";
const js2xmlparser = require("js2xmlparser");

/**
 * Post the roster changes to Yahoo
 *
 * @export
 * @async
 * @param {RosterModification[]} rosterModifications
 * @param {string} uid The firebase uid of the user
 * @return {unknown}
 */
export async function postRosterChanges(
  rosterModifications: RosterModification[],
  uid: string
): Promise<boolean> {
  const putRequests: Promise<any>[] = [];
  // eslint-disable-next-line guard-for-in
  for (const rosterModification of rosterModifications) {
    // TODO: Check for null here? Or has that been taken care of already?
    const { teamKey, coverageType, coveragePeriod, newPlayerPositions } =
      rosterModification;

    const players: any[] = [];
    // eslint-disable-next-line guard-for-in
    for (const playerKey in newPlayerPositions) {
      const position = newPlayerPositions[playerKey];
      players.push({
        player_key: playerKey,
        position: position,
      });
    }

    const data: any = {
      roster: {
        coverage_type: coverageType,
        [coverageType]: coveragePeriod,
        players: {
          player: players,
        },
      },
    };
    const xmlBody = js2xmlparser.parse("fantasy_content", data);
    putRequests.push(httpPutAxios(uid, "team/" + teamKey + "/roster", xmlBody));
  }
  // perform all put requests in parallel
  try {
    // const allResults =
    await Promise.all(putRequests);
    // allResults.forEach((result) => {
    //   console.log(result.data);
    // });
    // TODO: Log the last_updated timestamp to each team in firebase
    console.log("All roster changes posted successfully for uid: " + uid);
    return true;
  } catch (error: AxiosError | any) {
    if (error.response) {
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
    }
    // TODO: Log this clearly, and send an email to the user?
    console.log("Error posting roster changes for uid: " + uid);
    return false;
  }
}
