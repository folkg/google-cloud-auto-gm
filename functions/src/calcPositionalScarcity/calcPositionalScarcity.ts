import assert from "assert";
import { logger } from "firebase-functions";
import { ITeamFirestore } from "../common/interfaces/ITeam";
import {
  COMPOUND_POSITION_COMPOSITIONS,
  POSITIONAL_MAX_EXTRA_PLAYERS,
} from "../dispatchSetLineup/helpers/constants";

export function calculatePositionalScarcity(
  uid: string,
  firestoreTeams: ITeamFirestore[]
) {
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

  for (const team of firestoreTeams) {
    getReplacementLevels(team);
  }

  // getTopPlayersGeneral(); for each position
  // Do we want to generally store these in a firestore collection, and only do the Yahoo if we need to? That's an optimization for later. Make sure we write tests now to refactor that later.

  // TODO:
  // Adjust the player's ownership score by the modifier for their position when we are performing transactions elsewhere.
  // Make note that the max games played (and other??) uses this score for other purposes, and we DONT want it modified for that.
}

export function getReplacementLevels(
  team: ITeamFirestore
): Record<string, number> {
  const {
    game_code: gameCode,
    roster_positions: rosterPositions,
    num_teams: numTeams,
  } = team;

  const positionsList = Object.keys(rosterPositions);
  const compoundPositions = COMPOUND_POSITION_COMPOSITIONS[gameCode];
  const maxExtraPlayers = POSITIONAL_MAX_EXTRA_PLAYERS[gameCode];

  const result: Record<string, number> = {};

  assignStandardPositions();
  assignCompoundPositions();
  assignBenchPositions();

  return result;

  function assignStandardPositions() {
    for (const position of positionsList) {
      const hasSubPositions =
        compoundPositions[position]?.filter((subPosition) =>
          positionsList.includes(subPosition)
        ).length > 0;

      if (position === "BN" || hasSubPositions) {
        continue;
      }

      result[position] = rosterPositions[position] * numTeams;
    }
  }

  function assignCompoundPositions() {
    for (const compoundPosition in compoundPositions) {
      if (!positionsList.includes(compoundPosition)) {
        continue;
      }

      const numPlayersAtCompoundPosition = rosterPositions[compoundPosition];

      const subPositions: string[] = compoundPositions[compoundPosition].filter(
        (subPosition) => positionsList.includes(subPosition)
      );

      const numStarters = subPositions.reduce(
        (acc, subPosition) => acc + rosterPositions[subPosition],
        0
      );

      distributeExtraPositions(
        subPositions,
        numStarters,
        numPlayersAtCompoundPosition
      );
    }
  }

  function assignBenchPositions() {
    const numBenchPositions = rosterPositions["BN"];

    if (numBenchPositions > 0) {
      const numBenchPlayers = numBenchPositions;
      const numStarters = Object.keys(result).reduce(
        (acc, position) => acc + rosterPositions[position],
        0
      );

      const sortedList = Object.keys(result);
      distributeExtraPositions(sortedList, numStarters, numBenchPlayers);
    }
  }

  function distributeExtraPositions(
    positionList: string[],
    numStarters: number,
    numPlayersInPool: number
  ) {
    positionList.sort(
      (a, b) =>
        (maxExtraPlayers[a] ?? Infinity) - (maxExtraPlayers[b] ?? Infinity)
    );

    for (const position of positionList) {
      const numStartersAtPosition = rosterPositions[position];
      const extraAllowed: number | undefined = maxExtraPlayers[position];
      const newShare = (numStartersAtPosition / numStarters) * numPlayersInPool;
      const numToAdd =
        numTeams *
        (extraAllowed !== undefined
          ? Math.min(newShare, extraAllowed)
          : newShare);
      numStarters -= rosterPositions[position];
      numPlayersInPool -= numToAdd / numTeams;

      result[position] += numToAdd;
    }
  }
}

function test() {
  // const testUsers: string[] = [
  //   "RLSrRcWN3lcYbxKQU1FKqditGDu1",
  //   "xAyXmaHKO3aRm9J3fnj2rgZRPnX2",
  // ]; // Graeme Folk, Jeff Barnes
}
