import { Team } from "../interfaces/Team";
import { IPlayer } from "../interfaces/IPlayer";
import { RosterModification } from "../interfaces/RosterModification";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";
import { postRosterModifications } from "../../common/services/yahooAPI/yahooAPI.service";
import { HttpsError } from "firebase-functions/v2/https";

import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { partitionArray } from "../../common/services/utilities.service";
import { assignPlayerStartScoreFunction } from "./playerStartScoreFunctions.service";
import { initStartingGoalies } from "../../common/services/yahooAPI/yahooStartingGoalie.service";
import { LineupOptimizer } from "../classes/LineupOptimizer";

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

  // initialize starting goalies global array
  await initStartingGoalies();

  const rosterModifications: RosterModification[] =
    await getRosterModifications(teams, uid);

  await postRosterModifications(rosterModifications, uid);

  return Promise.resolve();
}

const verboseLogging = false;
/**
 * Will get the required roster modifications for a given user
 *
 * @async
 * @param {string[]} teams - The teams to optimize
 * @param {string} uid - The user id
 * @return {Promise<RosterModification[]>} - The roster modifications to make
 */
async function getRosterModifications(
  teams: string[],
  uid: string
): Promise<RosterModification[]> {
  const rosters = await fetchRostersFromYahoo(teams, uid);
  const rosterModifications: RosterModification[] = [];

  console.log(
    "optimizing for user: " + uid + "teams: " + JSON.stringify(teams)
  );

  for (const roster of rosters) {
    console.log(JSON.stringify(roster));
    const lo = new LineupOptimizer(roster);
    const rm = lo.optimizeStartingLineup();
    lo.isSuccessfullyOptimized(); // will log any errors
    // const rm = await optimizeStartingLineup2(roster);
    console.info(
      "rm for team " + roster.team_key + " is " + JSON.stringify(rm)
    );
    if (rm) {
      rosterModifications.push(rm);
    }
  }
  return rosterModifications;
}

/**
 * Will optimize the starting lineup for a given roster
 *
 * @export
 * @param {Team} teamRoster - The roster to optimize
 * @return {*} {RosterModification} - The roster modification to make
 */
export async function optimizeStartingLineup2(
  teamRoster: Team
): Promise<RosterModification> {
  const {
    team_key: teamKey,
    players,
    coverage_type: coverageType,
    coverage_period: coveragePeriod,
    weekly_deadline: weeklyDeadline,
    roster_positions: rosterPositions,
  } = teamRoster;

  const originalPlayerPositions = createPlayerPositionDict(players);

  const unfilledPositions = getUnfilledPositions(players, rosterPositions);

  const editablePlayers = players.filter((player) => player.is_editable);
  if (editablePlayers.length === 0) {
    verboseLogging &&
      console.info("no players to optimize for team " + teamKey);
    return { teamKey, coverageType, coveragePeriod, newPlayerPositions: {} };
  }

  const genPlayerScore: (player: IPlayer) => number =
    assignPlayerStartScoreFunction(teamRoster.game_code, weeklyDeadline);
  editablePlayers.forEach((player) => {
    player.start_score = genPlayerScore(player);
    player.eligible_positions.push("BN"); // not included by default in Yahoo
  });
  // sort lower score to higher score
  editablePlayers.sort((a, b) => a.start_score - b.start_score);

  // Attempt to fix illegal players by swapping them with all eligible players
  // Illegal players are players that are not eligible for their selected position
  // For example, any player in an IR position that is now healthy, IR+, or NA

  // TODO: This isn't quite right. Need to check health status as well in roster. We need more filters/partitions.

  const [illegalPlayers, legalPlayers] = partitionArray(
    editablePlayers,
    (player) => !player.eligible_positions.includes(player.selected_position)
  );
  if (illegalPlayers.length > 0) {
    illegalPlayers.reverse();
    // first check if a simple swap is possible between any two players on illelegalPlayers
    // if not, then call swapPlayer()
    verboseLogging &&
      console.info("swapping illegalPlayers amongst themselves:");
    internalDirectPlayerSwap(illegalPlayers);

    verboseLogging && console.info("swapping illegalPlayer / legalPlayers:");
    // illegalPlayers  will be sorted high to low, legalPlayers will be sorted low to high
    swapPlayers(illegalPlayers, legalPlayers, unfilledPositions);
  }

  // TODO: Move all injured players to InactiveList if possible
  // TODO: Add new players from FA if there are empty roster spots

  // Optimize the active roster by swapping eligible players from bench to roster
  // // TODO: roster here will include inactive players as well.
  // const [roster, bench] = partitionArray(
  //   editablePlayers,
  //   (player) => player.selected_position !== "BN"
  // );
  const activeRoster = editablePlayers.filter(
    (player) => !INACTIVE_POSITION_LIST.includes(player.selected_position)
  );
  const [bench, roster] = partitionArray(
    activeRoster,
    (player) => player.selected_position === "BN"
  );

  verboseLogging && console.info("swapping bench / roster:");
  // bench will be sorted high to low, roster will be sorted low to high
  bench.reverse();
  swapPlayers(bench, roster, unfilledPositions, true);

  const finalPlayerPositions = createPlayerPositionDict(players);
  const newPlayerPositions = playerPositionDictDiff(
    originalPlayerPositions,
    finalPlayerPositions
  );

  // helper function to verify that the optimization was successful
  verifyOptimization();

  // Return the roster modification object if there are changes
  const rosterModification: RosterModification = {
    teamKey,
    coverageType,
    coveragePeriod,
    newPlayerPositions,
  };
  return rosterModification;

  /**
   * Will verify that the optimization was successful
   *
   * @return {boolean}
   */
  function verifyOptimization(): boolean {
    const unfilledRosterPositions = Object.keys(unfilledPositions).filter(
      (position) =>
        position !== "BN" &&
        !INACTIVE_POSITION_LIST.includes(position) &&
        unfilledPositions[position] > 0
    );
    if (unfilledRosterPositions.length > 0) {
      console.error(
        `unfilledRosterPositions for team ${teamKey}: ${unfilledRosterPositions}`
      );
      return false;
    }

    const [benchPlayers, rosterPlayers] = partitionArray(
      players,
      (player) => player.selected_position === "BN"
    );
    const benchPlayersWithGame = benchPlayers.filter(
      (player) => player.is_playing
    );

    if (benchPlayersWithGame.length === 0) return true;
    // loop through each bench player and check if there are any roster players with a lower score
    for (const benchPlayer of benchPlayersWithGame) {
      for (const rosterPlayer of rosterPlayers) {
        if (
          benchPlayer.eligible_positions.includes(
            rosterPlayer.selected_position
          ) &&
          benchPlayer.start_score > rosterPlayer.start_score
        ) {
          console.error(
            `benchPlayer ${benchPlayer.player_name} has a higher score than rosterPlayer ${rosterPlayer.player_name} for team ${teamKey}`
          );
          return false;
        }
      }
    }
    return true;
  }
}

/**
 * Creates a dictionary of player keys to their original selected positions
 *
 * @param {IPlayer[]} players - The players on the roster
 * @return {{}} - The dictionary of player keys to their original selected positions
 */
function createPlayerPositionDict(players: IPlayer[]): {
  [key: string]: string;
} {
  const result: { [key: string]: string } = {};
  players.forEach((player) => {
    result[player.player_key] = player.selected_position;
  });
  return result;
}

/**
 * Will calculate the difference between the original player positions and the final player positions
 *
 * @param {{}} originalPlayerPositions - The original player positions
 * @param {{}} finalPlayerPositions - The final player positions
 * @return {{}} - The difference between the original player positions and the final player positions
 */
function playerPositionDictDiff(
  originalPlayerPositions: { [key: string]: string },
  finalPlayerPositions: { [key: string]: string }
): { [key: string]: string } {
  const result: { [key: string]: string } = {};
  Object.keys(originalPlayerPositions).forEach((playerKey) => {
    if (
      originalPlayerPositions[playerKey] !== finalPlayerPositions[playerKey]
    ) {
      result[playerKey] = finalPlayerPositions[playerKey];
    }
  });
  return result;
}

/**
 * Will calculate the number of unfilled positions for a given roster
 *
 * @param {IPlayer[]} players - The players on the roster
 * @param {{}} rosterPositions - The roster positions
 * @return {{}} - The number of unfilled positions
 */
function getUnfilledPositions(
  players: IPlayer[],
  rosterPositions: { [key: string]: number }
): { [key: string]: number } {
  const unfilledPositions: { [key: string]: number } = { ...rosterPositions };
  players.forEach((player) => {
    unfilledPositions[player.selected_position]--;
  });
  return unfilledPositions;
}

/**
 * Make direct swaps between players in the playersArr array
 *
 * @param {IPlayer[]} playersArr - The array of players to swap
 */
function internalDirectPlayerSwap(playersArr: IPlayer[]): void {
  for (const playerA of playersArr) {
    for (const playerB of playersArr) {
      if (
        playerB.player_key !== playerA.player_key &&
        playerB.eligible_positions.includes(playerA.selected_position) &&
        playerA.eligible_positions.includes(playerB.selected_position)
      ) {
        verboseLogging &&
          console.info(
            `swapping ${playerA.player_name} ${playerA.selected_position} with ${playerB.player_name} ${playerB.selected_position}`
          );
        const temp = playerB.selected_position;
        movePlayerToPosition(playerB, playerA.selected_position);
        movePlayerToPosition(playerA, temp);
      }
    }
  }

  /**
   * Will swap players between two arrays of players
   *
   * @param {IPlayer} player - The player to swap
   * @param {string} position - The position to swap the player to
   * @param {{}} newPlayerPositions - The dictionary of players to move
   */
  function movePlayerToPosition(player: IPlayer, position: string) {
    player.selected_position = position;
  }
}

/**
 * Attempts to move all players from source to target by either swapping
 * eligible players between arrays or moving players to unfilled positions.
 *
 * The function will explore possible three-way swaps if a direct swap is not possible.
 *
 * @param {IPlayer[]} source - array of players to move from
 * @param {IPlayer[]} target - array of players to move to
 * @param {{}} unfilledPositions - dictionary of unfilled positions
 * @param {boolean} isMaximizingScore - whether to maximize score on target array
 */
function swapPlayers(
  source: IPlayer[],
  target: IPlayer[],
  unfilledPositions: { [key: string]: number },
  isMaximizingScore = false
) {
  // temp variables, to be user settings later
  const addPlayersToRoster = false;
  // const dropPlayersFromRoster = false;
  // intialize variables
  let isPlayerAActiveRoster = false;
  let isPlayerBActiveRoster = false;
  const isSwappingILToRoster = () => {
    return !isPlayerAActiveRoster && isPlayerBActiveRoster;
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
  let isPlayerASwapped;
  let i = 0;
  verboseLogging && console.info("source: " + source.map((p) => p.player_name));
  verboseLogging && console.info("target: " + target.map((p) => p.player_name));
  while (i < source.length) {
    const playerA = source[i];
    isPlayerASwapped = false;

    isPlayerAActiveRoster = !INACTIVE_POSITION_LIST.includes(
      playerA.selected_position
    );

    const unfilledPosition: string | undefined =
      availableUnfilledPosition(playerA);
    if (unfilledPosition) {
      // if there is an unfilled position, then we will move the player to that position
      verboseLogging &&
        console.info(
          "Moving player " + playerA.player_name + " to unfilled position: ",
          unfilledPosition
        );
      // modify the unfilled positions
      verboseLogging &&
        console.info(
          "unfilledPositions before: ",
          JSON.stringify(unfilledPositions)
        );
      unfilledPositions[playerA.selected_position] += 1;
      unfilledPositions[unfilledPosition] -= 1;
      verboseLogging &&
        console.info(
          "unfilledPositions after: ",
          JSON.stringify(unfilledPositions)
        );

      movePlayerToPosition(playerA, unfilledPosition);
      // splice the player from source and add to target
      const idx = source.indexOf(playerA);
      target.push(source.splice(idx, 1)[0]);

      // continue without incrementing i if a swap was made
      continue;
    }

    if (
      isMaximizingScore &&
      playerA.start_score < Math.min(...target.map((tp) => tp.start_score))
    ) {
      i++;
      continue;
    }
    // Note: eligibleTargetPlayers will be all players when moving bench to roster

    const eligibleTargetPlayers = target.filter((targetPlayer) =>
      targetPlayer.eligible_positions.includes(playerA.selected_position)
    );

    if (eligibleTargetPlayers.length > 0) {
      verboseLogging &&
        console.info(
          "eligibleTargetPlayers for player " +
            playerA.player_name +
            ": " +
            eligibleTargetPlayers.map((p) => p.player_name)
        );

      for (const playerB of eligibleTargetPlayers) {
        verboseLogging &&
          console.info(
            "comparing playerA " + playerA.player_name,
            playerA.start_score + " to playerB " + playerB.player_name,
            playerB.start_score
          );

        isPlayerBActiveRoster = !INACTIVE_POSITION_LIST.includes(
          playerB.selected_position
        );

        if (isSwappingILToRoster()) {
          // TODO: This is the same as moving playerB to playerA's position, and moving playerA to unfilled position
          // we can re-use the code from above if we extract it as a function instead
          verboseLogging &&
            console.info(
              `Swapping ${playerA.player_name} ${playerA.selected_position} to BN, and ${playerB.player_name} ${playerB.selected_position} to ${playerA.selected_position}`
            );

          const idx = source.indexOf(playerA);
          target.push(source.splice(idx, 1)[0]);

          movePlayerToPosition(playerB, playerA.selected_position);
          movePlayerToPosition(playerA, "BN");

          isPlayerASwapped = true;

          break;
        }

        if (playerA.eligible_positions.includes(playerB.selected_position)) {
          if (isMaximizingScore && playerB.start_score >= playerA.start_score) {
            // if maximizing score, we will only swap directly if sourcePlayer.score > targetPlayer.score
            verboseLogging &&
              console.info(
                "Need to find a three way swap since sourcePlayer.score < targetPlayer.score"
              );
            const playerC = findPlayerC(playerA, playerB);
            if (playerC) {
              verboseLogging && console.info("Found three way swap");
              swapPlayers(playerA, playerB);
              swapPlayers(playerB, playerC);
              break;
            }
            verboseLogging && console.info("No three way swap found");
          } else {
            verboseLogging && console.info("Direct swap");
            swapPlayers(playerA, playerB);
            break;
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
        verboseLogging &&
          console.info(
            "looking for three way swap to move inactive player to active roster"
          );
        for (const playerB of eligibleSourcePlayers) {
          const playerC = findPlayerC(playerA, playerB);
          if (playerC) {
            verboseLogging && console.info("Found three way swap");
            swapPlayers(playerB, playerC);
            swapPlayers(playerA, playerB);
            break;
          }
          verboseLogging && console.info("No three way swap found");
        }
      }
    }
    // continue without incrementing i if a swap was made
    // this is to ensure we recheck the player swapped to bench for other swaps
    if (isPlayerASwapped) continue;
    verboseLogging &&
      console.info("No swaps for player " + playerA.player_name);
    i++;
    verboseLogging &&
      console.info("i: " + i + " source.length: " + source.length);
  }

  return;

  /**
   * Returns the unfilled position if there is one, otherwise returns undefined
   *
   * @param {IPlayer} playerA - the player to find an unfilled position for
   * @return {string} - the unfilled position
   */
  function availableUnfilledPosition(playerA: IPlayer) {
    let unfilledPosition: string | undefined;
    if (!isPlayerAActiveRoster) {
      const numEmptyRosterSpots = Object.keys(unfilledPositions).reduce(
        (acc, key) => {
          if (!INACTIVE_POSITION_LIST.includes(key))
            acc += unfilledPositions[key];
          return acc;
        },
        0
      );
      verboseLogging &&
        console.info("numEmptyRosterSpots: ", numEmptyRosterSpots);
      if (numEmptyRosterSpots > 0) {
        unfilledPosition = "BN";
      }
      // TODO: else Drop players to make room for playerA
    } else {
      unfilledPosition = Object.keys(unfilledPositions).find((position) => {
        let predicate: boolean =
          position !== playerA.selected_position &&
          unfilledPositions[position] > 0 &&
          playerA.eligible_positions.includes(position);
        if (!addPlayersToRoster) {
          // if we are not adding players to the roster, do not move players to inactive positions
          predicate &&= !INACTIVE_POSITION_LIST.includes(position);
        }
        return predicate;
      });
    }
    return unfilledPosition;
  }

  /**
   * Finds a third player that can be moved to the position of playerB
   *
   * @param {IPlayer} playerA - The player to move
   * @param {IPlayer} playerB - The player to move to
   * @return {(IPlayer | undefined)} - The player that can be moved to playerB's position
   */
  function findPlayerC(
    playerA: IPlayer,
    playerB: IPlayer
  ): IPlayer | undefined {
    const eligibleThirdPlayer = target.find(
      (thirdPlayer: IPlayer) =>
        thirdPlayer.player_key !== playerB.player_key &&
        playerB.eligible_positions.includes(thirdPlayer.selected_position) &&
        (isMaximizingScore
          ? thirdPlayer.start_score < playerA.start_score
          : true)
    );
    return eligibleThirdPlayer;
  }

  /**
   * Swaps two players positions in the lineup and in the source and target arrays
   *
   * @param {IPlayer} playerOne - The first player to swap
   * @param {IPlayer} playerTwo - The second player to swap
   */
  function swapPlayers(playerOne: IPlayer, playerTwo: IPlayer): void {
    // TODO: Don't want to move to other array if it is all the players. Only if it is a subset of the players.
    verboseLogging &&
      console.info(
        `swapping ${playerOne.player_name} ${playerOne.selected_position} with ${playerTwo.player_name} ${playerTwo.selected_position}`
      );
    const idxOne = source.indexOf(playerOne);
    const idxTwo = target.indexOf(playerTwo);
    source[idxOne] = playerTwo;
    target[idxTwo] = playerOne;

    const tempPosition = playerOne.selected_position;
    movePlayerToPosition(playerOne, playerTwo.selected_position);
    movePlayerToPosition(playerTwo, tempPosition);

    isPlayerASwapped = true;
  }

  /**
   * Will swap players between two arrays of players
   *
   * @param {IPlayer} player - The player to swap
   * @param {string} position - The position to swap the player to
   * @param {{}} newPlayerPositions - The dictionary of players to move
   */
  function movePlayerToPosition(player: IPlayer, position: string) {
    // console.log(
    //   "movePlayerToPosition",
    //   player.player_name,
    //   player.selected_position,
    //   position
    // );
    player.selected_position = position;
  }
}
