import assert from "assert";
import { logger } from "firebase-functions";
import { ITeamFirestore } from "../common/interfaces/ITeam";
import {
  COMPOUND_POSITION_COMPOSITIONS,
  POSITIONAL_MAX_EXTRA_PLAYERS,
} from "../dispatchSetLineup/helpers/constants";
import { getTopPlayersGeneral } from "../common/services/yahooAPI/yahooAPI.service";
import { getChild } from "../common/services/utilities.service";
import { IPlayer } from "../common/interfaces/IPlayer";

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

  const result: Record<string, number> = {};

  for (const team of firestoreTeams) {
    const players = await fetchPlayersFromYahoo(team);
    const offsets = getScarcityOffsets(players);
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

  function getScarcityOffsets(players: any[] | null) {
    if (!players) {
      return null;
    }
    const replacementLevelPlayers = players.map((playerList, index) => {
      const replacementIndex = Math.floor(
        replacementLevels[Object.keys(replacementLevels)[index]] / 25
      );
      return playerList[replacementIndex];
    });

    return replacementLevelPlayers.map((player) => {
      return { [player.position]: player.ownership_score };
    });
  }
}

async function fetchPlayersFromYahoo(team: ITeamFirestore) {
  const replacementLevels = getReplacementLevels(team);
  const getPlayersPromises: Promise<any>[] = [];

  for (const position in replacementLevels) {
    // round the starting replacement level down to the nearest 25
    const fetchStartingAt = Math.floor(replacementLevels[position] / 25) * 25;
    getPlayersPromises.push(
      getTopPlayersGeneral(team.game_code, position, fetchStartingAt)
    );
  }

  try {
    const yahooJSONs: any[] = await Promise.all(getPlayersPromises);
    const players: IPlayer[][] = yahooJSONs.map((yahooJSON) => {
      // TODO: We need to verify this works
      const gameJSON = yahooJSON.fantasy_content.games[0].game;
      const playersJSON = getChild(gameJSON, "players");
      // TODO: This should be moved into common territory. We might need to move a lot of things.
      return getPlayersFromRoster(playersJSON);
    });
  } catch (e) {
    logger.error(e);
    return null;
  }
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
    numTotalStartingSpots: number,
    numSpotsToDistribute: number
  ) {
    let numPlayersToDistribute = numSpotsToDistribute * numTeams;

    positionList.sort(
      (a, b) =>
        (maxExtraPlayers[a] ?? Infinity) - (maxExtraPlayers[b] ?? Infinity)
    );

    for (const position of positionList) {
      const numStartersAtPosition = rosterPositions[position];
      const newShare =
        (numStartersAtPosition / numTotalStartingSpots) *
        numPlayersToDistribute;

      const extraAllowed: number | undefined = maxExtraPlayers[position];
      const totalAllowed: number =
        extraAllowed !== undefined
          ? (numStartersAtPosition + extraAllowed) * numTeams
          : Infinity;

      const newTotal = Math.min(newShare + result[position], totalAllowed);
      const numAdded = newTotal - result[position];

      numPlayersToDistribute -= numAdded;
      numTotalStartingSpots -= rosterPositions[position];

      result[position] = newTotal;
    }
  }
}

function test() {
  // const testUsers: string[] = [
  //   "RLSrRcWN3lcYbxKQU1FKqditGDu1",
  //   "xAyXmaHKO3aRm9J3fnj2rgZRPnX2",
  // ]; // Graeme Folk, Jeff Barnes
}
