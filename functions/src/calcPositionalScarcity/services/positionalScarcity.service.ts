import { logger } from "firebase-functions";
import { IPlayer } from "../../common/interfaces/IPlayer.js";
import { ITeamFirestore } from "../../common/interfaces/ITeam.js";
import { getChild } from "../../common/services/utilities.service.js";
import { getTopPlayersGeneral } from "../../common/services/yahooAPI/yahooAPI.service.js";
import getPlayersFromRoster from "../../common/services/yahooAPI/yahooPlayerProcessing.service.js";
import {
  COMPOUND_POSITION_COMPOSITIONS,
  POSITIONAL_MAX_EXTRA_PLAYERS,
} from "../../common/helpers/constants.js";
import * as Firestore from "../../common/services/firebase/firestore.service.js";

export type ReplacementLevels = Record<string, number>;
export type ScarcityOffsets = Record<string, Record<string, number[]>>;

let SCARCITY_OFFSETS: ScarcityOffsets | null = null;

async function loadScarcityOffsets() {
  SCARCITY_OFFSETS = await Firestore.getPositionalScarcityOffsets();
}

export function clearScarcityOffsets() {
  SCARCITY_OFFSETS = null;
}

export function getScarcityOffsetsForGame(gameCode: string) {
  return SCARCITY_OFFSETS?.[gameCode] ?? {};
}

export async function getScarcityOffsetsForLeague(
  gameCode: string,
  replacementLevels: ReplacementLevels
): Promise<Record<string, number>> {
  if (!SCARCITY_OFFSETS) {
    await loadScarcityOffsets();
  }

  const result: Record<string, number> = {};

  for (const position in replacementLevels) {
    if (Object.hasOwn(replacementLevels, position)) {
      const replacementIndex = replacementLevels[position] - 1;
      const positionScarcityOffsets = SCARCITY_OFFSETS?.[gameCode][position];

      if (!positionScarcityOffsets?.[replacementIndex]) {
        await calculateOffsetForPosition(
          position,
          gameCode,
          replacementIndex + 1
        );
      }

      const offset =
        SCARCITY_OFFSETS?.[gameCode]?.[position]?.[replacementIndex];

      if (!offset) {
        logger.error(
          `No offsets found for position ${position} and replacement level ${replacementIndex}`
        );
        return {};
      }

      result[position] = offset;
    }
  }

  return result;
}

export async function recalculateScarcityOffsetsForAll() {
  const uid = await Firestore.getRandomUID();

  if (!SCARCITY_OFFSETS) {
    await loadScarcityOffsets();
  }

  const promises: Promise<void>[] = [];

  for (const league in SCARCITY_OFFSETS) {
    if (Object.hasOwn(SCARCITY_OFFSETS, league)) {
      const leagueScarcityOffsets = SCARCITY_OFFSETS[league];
      for (const position in leagueScarcityOffsets) {
        if (Object.hasOwn(leagueScarcityOffsets, position)) {
          // Don't await this, just let it run in the background
          const calcPromise = calculateOffsetForPosition(
            position,
            league,
            leagueScarcityOffsets[position].length,
            uid
          );
          promises.push(calcPromise);
        }
      }
    }
  }

  // Wait for all the promises to resolve before exiting
  await Promise.allSettled(promises);
}

export async function calculateOffsetForPosition(
  position: string,
  league: string,
  count: number,
  uid?: string
): Promise<void> {
  if (!uid) {
    uid = await Firestore.getRandomUID();
  }
  const promises = generateFetchPlayerPromises(uid, position, league, count);
  const players = await fetchYahooPlayers(promises);
  if (players) {
    updateOffsetArray(league, position, players);
  }
}

export function generateFetchPlayerPromises(
  uid: string,
  position: string,
  gameCode: string,
  count: number
): Promise<any>[] {
  const result: Promise<any>[] = [];

  if (count < 1) {
    return result;
  }

  let i = 0;
  do {
    result.push(getTopPlayersGeneral(uid, gameCode, position, i * 25));
    i++;
  } while (i * 25 < count);

  return result;
}

async function fetchYahooPlayers(fetchPlayersPromises: Promise<any>[]) {
  try {
    const yahooJSONs: any[] = await Promise.all(fetchPlayersPromises);
    const players: IPlayer[] = yahooJSONs
      .flatMap((yahooJSON) => {
        const gameJSON = yahooJSON.fantasy_content.games[0].game;
        const playersJSON = getChild(gameJSON, "players");
        return getPlayersFromRoster(playersJSON);
      })
      .sort((a, b) => a.percent_owned - b.percent_owned);
    return players;
  } catch (e: any) {
    logger.error("Error in fetchPlayersFromYahoo:", e);
    return null;
  }
}

function updateOffsetArray(
  league: string,
  position: string,
  players: IPlayer[]
) {
  const array: number[] = [];
  for (const player of players) {
    array.push(player.percent_owned);
  }
  array.reverse();

  if (!SCARCITY_OFFSETS) {
    SCARCITY_OFFSETS = {};
  }
  if (!SCARCITY_OFFSETS[league]) {
    SCARCITY_OFFSETS[league] = {};
  }
  SCARCITY_OFFSETS[league][position] = array;
  Firestore.updatePositionalScarcityOffset(league, position, array);
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
