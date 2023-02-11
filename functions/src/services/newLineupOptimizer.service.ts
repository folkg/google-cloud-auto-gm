import { Player, Roster, RosterModification } from "../interfaces/roster";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";
import { postRosterChanges } from "./yahooAPI.service";
import { HttpsError } from "firebase-functions/v2/https";

import {
  HEALTHY_STATUS_LIST,
  INACTIVE_POSITION_LIST,
} from "../helpers/constants";
import {
  nflScoreFunction,
  weeklyLineupScoreFunction,
  nhlScoreFunction,
  dailyScoreFunction,
} from "./playerScoreFunctions.service";
import { partitionArray } from "./utilities.service";

/**
 * Will optimize the starting lineup for a specific users teams
 *
 * @export
 * @async
 * @param {(string)} uid - The user id
 * @param {(string[])} teams - The team ids
 * @return {unknown}
 */
export async function setUsersLineup2(
  uid: string,
  teams: string[]
): Promise<void> {
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to get an access token"
    );
  }
  if (!teams) {
    throw new HttpsError(
      "invalid-argument",
      "You must provide a list of teams to optimize"
    );
  }

  const rosters = await fetchRostersFromYahoo(teams, uid);
  const rosterModifications: RosterModification[] = [];
  for (const roster of rosters) {
    const rm = await optimizeStartingLineup2(roster);
    if (rm) {
      rosterModifications.push(rm);
    }
  }

  return await postRosterChanges(rosterModifications, uid);
}

/**
 * Will optimize the starting lineup for a given roster
 *
 * @export
 * @param {Roster} teamRoster - The roster to optimize
 * @return {*} {RosterModification} - The roster modification to make
 */
async function optimizeStartingLineup2(
  teamRoster: Roster
): Promise<RosterModification> {
  const {
    team_key: teamKey,
    players,
    coverage_type: coverageType,
    coverage_period: coveragePeriod,
    weekly_deadline: weeklyDeadline,
    empty_positions: unfilledPositions,
  } = teamRoster;

  let newPlayerPositions: { [key: string]: string } = {};

  let genPlayerScore: (player: Player) => number;
  if (teamRoster.game_code === "nfl") {
    genPlayerScore = nflScoreFunction();
  } else if (weeklyDeadline && weeklyDeadline !== "intraday") {
    // weeklyDeadline will be something like "1" to represent Monday
    genPlayerScore = weeklyLineupScoreFunction();
  } else if (teamRoster.game_code === "nhl") {
    genPlayerScore = await nhlScoreFunction();
  } else {
    genPlayerScore = dailyScoreFunction();
  }

  const editablePlayers = players.filter((player) => player.is_editable);
  editablePlayers.forEach((player) => {
    player.score = genPlayerScore(player);
  });
  // sort lower to higher
  editablePlayers.sort((a, b) => a.score - b.score);

  // Attempt to fix illegal players by swapping them with all eligible players
  // Illegal players are players that are not eligible for their selected position
  // For example, any player in an IR position that is now healthy, IR+, or NA

  const [illegalPlayers, legalPlayers] = partitionArray(
    editablePlayers,
    (player) => !player.eligible_positions.includes(player.selected_position)
  );
  // reverse sort higher to lower
  illegalPlayers.reverse();
  // first check if a simple swap is possible between any two players on illelegalPlayers
  // if not, then call swapPlayer()
  newPlayerPositions = internalDirectPlayerSwap(illegalPlayers);

  newPlayerPositions = {
    ...newPlayerPositions,
    ...swapPlayers(illegalPlayers, legalPlayers, unfilledPositions),
  };

  // TODO: Move all injured players to InactiveList if possible
  // TODO: Add new players from FA if there are empty roster spots

  // Optimize the active roster by swapping eligible players from bench to roster
  const [roster, bench] = partitionArray(
    editablePlayers,
    (player) => player.selected_position !== "BN"
  );

  newPlayerPositions = {
    ...newPlayerPositions,
    ...swapPlayers(bench, roster, unfilledPositions),
  };

  // Return the roster modification object if there are changes
  if (Object.keys(newPlayerPositions).length > 0) {
    const rosterModification: RosterModification = {
      teamKey,
      coverageType,
      coveragePeriod,
      newPlayerPositions,
    };
    return rosterModification;
  } else {
    return { teamKey, coverageType, coveragePeriod, newPlayerPositions: {} };
  }
}

/**
 * Moves a player to a new position
 *
 * @param {Player} player - The player to move
 * @param {string} position - The new position
 */
function movePlayerToPosition(
  player: Player,
  position: string,
  newPlayerPositions: { [key: string]: string }
) {
  player.selected_position = position;
  newPlayerPositions[player.player_key] = position;
}

/**
 * Make direct swaps between players in the playersArr array
 *
 * @param {Player[]} playersArr - The array of players to swap
 * @return {{ [key: string]: string; }} - dictionary of players moved to new positions
 */
function internalDirectPlayerSwap(playersArr: Player[]): {
  [key: string]: string;
} {
  let newPlayerPositions: { [key: string]: string } = {};
  for (const playerA of playersArr) {
    for (const playerB of playersArr) {
      if (
        playerB.player_key !== playerA.player_key &&
        playerB.eligible_positions.includes(playerA.selected_position) &&
        playerA.eligible_positions.includes(playerB.selected_position)
      ) {
        const temp = playerB.selected_position;
        movePlayerToPosition(
          playerB,
          playerA.selected_position,
          newPlayerPositions
        );
        movePlayerToPosition(playerA, temp, newPlayerPositions);
      }
    }
  }
  return newPlayerPositions;
}

/**
 * Attempts to move all players from source to target by either swapping
 * eligible players between arrays or moving players to unfilled positions.
 *
 * The function will explore possible three-way swaps if a direct swap is not possible.
 *
 * @param {Player[]} source - array of players to move from
 * @param {Player[]} target - array of players to move to
 * @param {{ [key: string]: number }} unfilledPositions - dictionary of unfilled positions
 * @return {{ [key: string]: string; }} - dictionary of players moved to new positions
 */
function swapPlayers(
  source: Player[],
  target: Player[],
  unfilledPositions: { [key: string]: number }
) {
  let newPlayerPositions: { [key: string]: string } = {};
  let isSourceActiveRoster = false;
  let isTargetActiveRoster = false;
  const isMaximizingScore = () => {
    return isSourceActiveRoster && isTargetActiveRoster;
  };
  const isMovingILToRoster = () => {
    return !isSourceActiveRoster && isTargetActiveRoster;
  };
  const movePlayerTo = (player: Player, position: string) => {
    movePlayerToPosition(player, position, newPlayerPositions);
  };

  // example: source = bench, target = roster, unfilledPositions = { LW: 1, RW: 1 }
  // example: source = healthyOnIL, target = activeRoster, unfilledPositions = {}
  // example: source = illegalPlayers, target = allPlayers, unfilledPositions = {}
  // example 1: sourcePlayer = BN, targetPlayer = LW
  // example 2: sourcePlayer = BN, targetPlayer = LW, thirdPlayer = Util
  // example 3: sourcePlayer = BN, unfilledPosition = LW
  // example 4: sourcePlayer = IR, targetPlayer = LW
  // example 5: sourcePlayer = IR, targetPlayer = LW, thirdPlayer = IR+
  // example 6: sourcePlayer = NA, thirdPlayer = IR+

  // playerA is always from source, and is the player we are trying to move
  // playerB can be from source or target, and is the player we are trying to move playerA to
  // playerC is always from target, and is the player we are trying to move playerB to
  let swapped;
  let i = 0;
  while (i < source.length) {
    swapped = false;
    const playerA = source[i];
    isSourceActiveRoster = !INACTIVE_POSITION_LIST.includes(
      playerA.selected_position
    );
    // Note: eligibleTargetPlayers will be all players when moving bench to roster
    const eligibleTargetPlayers = target.filter((targetPlayer) =>
      targetPlayer.eligible_positions.includes(playerA.selected_position)
    );
    if (eligibleTargetPlayers.length > 0) {
      for (const playerB of eligibleTargetPlayers) {
        isTargetActiveRoster = !INACTIVE_POSITION_LIST.includes(
          playerB.selected_position
        );
        // if BN -> Roster, check playerA can move to playerB
        //  if not position, move to next playerB
        //    if position, then check score
        //      if score, then two way swap
        //      if not score, then three way swap
        // if IR -> ActiveRoster, make two way swap
        if (isMovingILToRoster()) {
          movePlayerTo(playerB, "BN");
          swapPlayers(playerA, playerB);
          break;
        }

        if (playerA.eligible_positions.includes(playerB.selected_position)) {
          if (isMaximizingScore() && playerB.score >= playerA.score) {
            // if maximizing score, we will only swap directly if sourcePlayer.score > targetPlayer.score
            const playerC = findPlayerC(playerA, playerB);
            if (playerC) {
              swapPlayers(playerA, playerB);
              swapPlayers(playerB, playerC);
              break;
            }
          } else {
            swapPlayers(playerA, playerB);
            break;
            // TODO: What about rechecking the player swapped to bench? ie. recheck in source. Might need to convert to for i loop.
          }
        }
      }
    } else {
      // if there are no eligible target players, then we will look for a three way swap in the source players
      // this scenario is only possible when moving inactive players to the active roster
      const eligibleSourcePlayers = source.filter(
        (sourcePlayer) =>
          sourcePlayer.player_key !== playerA.player_key &&
          sourcePlayer.eligible_positions.includes(playerA.selected_position)
      );
      if (eligibleSourcePlayers.length > 0) {
        for (const playerB of eligibleSourcePlayers) {
          const playerC = findPlayerC(playerA, playerB);
          if (playerC) {
            swapPlayers(playerB, playerC);
            swapPlayers(playerA, playerB);
            break;
          }
        }
      }
    }
    // break without incrementing i if a swap was made
    // this is to ensure we recheck the player swapped to bench for other swaps
    if (swapped) break;

    // TODO: Refactor this into a function
    // Finally, if there are no eligible player swaps, then we will look for an unfilled position
    let unfilledPosition: string | undefined;
    if (isMovingILToRoster()) {
      const emptyRosterSpots = Object.keys(unfilledPositions).reduce(
        (acc, key) => {
          if (!INACTIVE_POSITION_LIST.includes(key))
            acc += unfilledPositions[key];
          return acc;
        },
        0
      );
      if (emptyRosterSpots > 0) {
        unfilledPosition = "BN";
      }
      //TODO: else Drop players to make room for playerA
    } else {
      unfilledPosition = Object.keys(unfilledPositions).find(
        (position) =>
          unfilledPositions[position] > 0 &&
          playerA.eligible_positions.includes(position)
      );
    }

    if (unfilledPosition) {
      // if there is an unfilled position, then we will move the player to that position
      movePlayerTo(playerA, unfilledPosition);
      // splice the player from source and add to target
      const idx = source.indexOf(playerA);
      target.push(source.splice(idx, 1)[0]);
      // decrement the unfilled position
      unfilledPositions[unfilledPosition] -= 1;
    }
    i++;
  }

  return newPlayerPositions;

  /**
   * Finds a third player that can be moved to the position of playerB
   *
   * @param {Player} playerA - The player to move
   * @param {Player} playerB - The player to move to
   * @return {(Player | undefined)} - The player that can be moved to playerB's position
   */
  function findPlayerC(playerA: Player, playerB: Player): Player | undefined {
    const eligibleThirdPlayer = target.find(
      (thirdPlayer) =>
        thirdPlayer.eligible_positions.includes(playerB.selected_position) &&
        thirdPlayer.player_key !== playerB.player_key &&
        (isMaximizingScore() ? thirdPlayer.score < playerA.score : true)
    );
    return eligibleThirdPlayer;
  }

  /**
   * Swaps two players positions in the lineup and in the source and target arrays
   *
   * @param {Player} playerOne - The first player to swap
   * @param {Player} playerTwo - The second player to swap
   */
  function swapPlayers(playerOne: Player, playerTwo: Player) {
    // TODO: Don't want to move to other array if it is all the players. Only if it is a subset of the players.
    const idxOne = source.indexOf(playerOne);
    const idxTwo = target.indexOf(playerTwo);
    source[idxOne] = playerTwo;
    target[idxTwo] = playerOne;

    const tempPosition = playerOne.selected_position;
    movePlayerTo(playerOne, playerTwo.selected_position);
    movePlayerTo(playerTwo, tempPosition);

    swapped = true;
  }
}
