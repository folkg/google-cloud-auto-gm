import { logger } from "firebase-functions";
import { IPlayer } from "../../common/interfaces/IPlayer";
import { ITeamFirestore } from "../../common/interfaces/ITeam";
import { getChild } from "../../common/services/utilities.service";
import { getTopPlayersGeneral } from "../../common/services/yahooAPI/yahooAPI.service";
import getPlayersFromRoster from "../../common/services/yahooAPI/yahooPlayerProcessing.service";
import {
  COMPOUND_POSITION_COMPOSITIONS,
  POSITIONAL_MAX_EXTRA_PLAYERS,
} from "../../dispatchSetLineup/helpers/constants";

export type ReplacementLevels = Record<string, number>;
export type ScarcityOffets = Record<string, number>;

export function getScarcityOffsets(
  replacementLevels: ReplacementLevels,
  players: IPlayer[][] | null
): ScarcityOffets | null {
  if (!players) {
    return null;
  }

  const replacementLevelPlayers = players.map((playerList, index) => {
    const position = Object.keys(replacementLevels)[index];
    const replacementIndex = (replacementLevels[position] - 1) % 25;
    return { position, player: playerList[replacementIndex] };
  });

  const result: ScarcityOffets = {};
  for (const p of replacementLevelPlayers) {
    result[p.position] = p.player.percent_owned;
  }

  return result;
}

export async function fetchPlayersFromYahoo(
  uid: string,
  replacementLevels: ReplacementLevels,
  team: ITeamFirestore
) {
  const getPlayersPromises: Promise<any>[] = [];

  for (const position in replacementLevels) {
    // round the starting replacement level down to the nearest 25 to match the Yahoo pagination (0-indexed)
    const fetchStartingAt =
      Math.floor((replacementLevels[position] - 1) / 25) * 25;
    getPlayersPromises.push(
      getTopPlayersGeneral(uid, team.game_code, position, fetchStartingAt)
    );
  }

  try {
    const yahooJSONs: any[] = await Promise.all(getPlayersPromises);
    const players: IPlayer[][] = yahooJSONs.map((yahooJSON) => {
      // TODO: We need to verify this works
      const gameJSON = yahooJSON.fantasy_content.games[0].game;
      const playersJSON = getChild(gameJSON, "players");
      return getPlayersFromRoster(playersJSON);
    });
    return players;
  } catch (e: any) {
    logger.error("Error in fetchPlayersFromYahoo:", e);
    return null;
  }
}

export function getReplacementLevels(team: ITeamFirestore): ReplacementLevels {
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
