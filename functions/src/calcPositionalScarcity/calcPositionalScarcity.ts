import assert from "assert";
import { logger } from "firebase-functions";
import { ITeamFirestore } from "../common/interfaces/ITeam";
import {
  ScarcityOffets,
  fetchPlayersFromYahoo,
  getReplacementLevels,
  getScarcityOffsets,
} from "./services/positionalScarcity.service";
export async function calculatePositionalScarcity(
  uid: string,
  firestoreTeams: ITeamFirestore[]
) {
  // Load document from firestore that has the following format:
  // {
  //   nfl: {
  //     QB: {
  //       24: 50,
  //       48: 50,
  //     },
  //   },
  //   nba: {
  //     PG: {
  //       24: 50,
  //       48: 50,
  //     },
  //   },
  // }
  // If we cannot find our number of players at each position, we need to calculate it, and then add it to the document.
  // Once per week, we will do a full recalculation of the firestore document.
  // A user should only have to calculate this once ever, and then the document will take care of itself after that.

  // TODO: Do we want to rename the dispatchSetLineup folder? It containes most of the code we will be using for this
  // TODO: Do we want to rename the scheduleSetLineup folder? It is going to be scheduling more than just setting lineups
  // TODO:
  // 1. Calculate the number of players at each position that will be considered replacement level
  // 2. Fetch the x players around this replacment level at each position, and calculate their ownership scores
  // 3. Sort the players, and get the ownership score of the replacement level player
  // 4. Store the the modifier for each position in the user's document
  // 5. Store the modifier for each position in a set for each league key in the global here, maybe another team is in the same league and could use it. Log it to see if it ever happens.
  assert(uid, "No uid provided");
  assert(firestoreTeams, "No teams provided");
  if (firestoreTeams.length === 0) {
    logger.log(`No teams for user ${uid}`);
    return;
  }

  const result: ScarcityOffets[] = [];

  for (const team of firestoreTeams) {
    const replacementLevels = getReplacementLevels(team);
    const players = await fetchPlayersFromYahoo(uid, replacementLevels, team);
    const offsets = getScarcityOffsets(replacementLevels, players);
    if (offsets) {
      result.push(offsets);
    }
  }

  // getTopPlayersGeneral(); for each position
  // Do we want to generally store these in a firestore collection, and only do the Yahoo if we need to? That's an optimization for later. Make sure we write tests now to refactor that later.

  // TODO:
  // Adjust the player's ownership score by the modifier for their position when we are performing transactions elsewhere.
  // Make note that the max games played (and other??) uses this score for other purposes, and we DONT want it modified for that.
  return result;
}

function test() {
  // const testUsers: string[] = [
  //   "RLSrRcWN3lcYbxKQU1FKqditGDu1",
  //   "xAyXmaHKO3aRm9J3fnj2rgZRPnX2",
  // ]; // Graeme Folk, Jeff Barnes
}
