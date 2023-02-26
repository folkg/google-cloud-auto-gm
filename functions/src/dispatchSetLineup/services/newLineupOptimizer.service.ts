import { Player, Roster, RosterModification } from "../interfaces/roster";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";
import { postRosterModifications } from "../../common/services/yahooAPI/yahooAPI.service";
import { HttpsError } from "firebase-functions/v2/https";

import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { partitionArray } from "../../common/services/utilities.service";
import { assignPlayerStartSitScoreFunction } from "./playerStartSitScoreFunctions.service";
import { initStartingGoalies } from "../../common/services/yahooAPI/yahooStartingGoalie.service";

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

  return await postRosterModifications(rosterModifications, uid);
}

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

  for (const roster of rosters) {
    const rm = await optimizeStartingLineup2(roster);
    console.log("rm for team " + roster.team_key + " is " + JSON.stringify(rm));
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

  const genPlayerScore: (player: Player) => number =
    await assignPlayerStartSitScoreFunction(
      teamRoster.game_code,
      weeklyDeadline
    );

  const editablePlayers = players.filter((player) => player.is_editable);
  if (editablePlayers.length === 0) {
    console.log("no players to optimize for team " + teamKey);
    return { teamKey, coverageType, coveragePeriod, newPlayerPositions: {} };
  }
  editablePlayers.forEach((player) => {
    player.score = genPlayerScore(player);
    player.eligible_positions.push("BN"); // not included by default in Yahoo
  });
  // sort lower to higher
  editablePlayers.sort((a, b) => a.score - b.score);

  // Attempt to fix illegal players by swapping them with all eligible players
  // Illegal players are players that are not eligible for their selected position
  // For example, any player in an IR position that is now healthy, IR+, or NA

  // TODO: Assumption was that "BN" is on player's eligible positions. It's not. Could cause bugs.
  // TODO: This isn't quite right. Need to check health status as well in roster. We need more filters/partitions.

  const [illegalPlayers, legalPlayers] = partitionArray(
    editablePlayers,
    (player) => !player.eligible_positions.includes(player.selected_position)
  );
  if (illegalPlayers.length > 0) {
    illegalPlayers.reverse();
    // first check if a simple swap is possible between any two players on illelegalPlayers
    // if not, then call swapPlayer()
    console.log("swapping illegalPlayers amongst themselves:");
    newPlayerPositions = internalDirectPlayerSwap(illegalPlayers);
    console.log(
      "after internalDirectPlayerSwap: " + JSON.stringify(newPlayerPositions)
    );

    console.log("swapping illegalPlayer / legalPlayers:");
    newPlayerPositions = {
      ...newPlayerPositions,
      ...swapPlayers(illegalPlayers, legalPlayers, unfilledPositions),
    };
    console.log(
      "after swapPlayers illegalPlayer / legalPlayers: " +
        JSON.stringify(newPlayerPositions)
    );
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

  console.log("swapping bench / roster:");
  newPlayerPositions = {
    ...newPlayerPositions,
    ...swapPlayers(bench, roster, unfilledPositions),
  };
  console.log(
    "after swapPlayers bench / roster: " + JSON.stringify(newPlayerPositions)
  );

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
 * Will swap players between two arrays of players
 *
 * @param {Player} player - The player to swap
 * @param {string} position - The position to swap the player to
 * @param {{}} newPlayerPositions - The dictionary of players to move
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
 * @return {{}} - dictionary of players moved to new positions
 */
function internalDirectPlayerSwap(playersArr: Player[]): {
  [key: string]: string;
} {
  const newPlayerPositions: { [key: string]: string } = {};
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
 * @param {{}} unfilledPositions - dictionary of unfilled positions
 * @return {{}} - dictionary of players moved to new positions
 */
function swapPlayers(
  source: Player[],
  target: Player[],
  unfilledPositions: { [key: string]: number }
) {
  // temp variables, to be user settings later
  const addPlayersToRoster = false;
  // const dropPlayersFromRoster = false;
  // intialize variables
  const newPlayerPositions: { [key: string]: string } = {};
  let isPlayerAActiveRoster = false;
  let isPlayerBActiveRoster = false;
  const isMaximizingScore = () => {
    return isPlayerAActiveRoster && isPlayerBActiveRoster;
  };
  const isSwappingILToRoster = () => {
    return !isPlayerAActiveRoster && isPlayerBActiveRoster;
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
  let isPlayerASwapped;
  let i = 0;
  console.log("source: " + source.map((p) => p.player_name));
  console.log("target: " + target.map((p) => p.player_name));
  while (i < source.length) {
    const playerA = source[i];
    isPlayerASwapped = false;

    isPlayerAActiveRoster = !INACTIVE_POSITION_LIST.includes(
      playerA.selected_position
    );
    // Note: eligibleTargetPlayers will be all players when moving bench to roster
    const eligibleTargetPlayers = target.filter((targetPlayer) =>
      targetPlayer.eligible_positions.includes(playerA.selected_position)
    );
    if (eligibleTargetPlayers.length > 0) {
      console.log(
        "eligibleTargetPlayers for player " +
          playerA.player_name +
          ": " +
          eligibleTargetPlayers.map((p) => p.player_name)
      );

      for (const playerB of eligibleTargetPlayers) {
        console.log(
          "comparing playerA " + playerA.player_name,
          playerA.score + " to playerB " + playerB.player_name,
          playerB.score
        );

        isPlayerBActiveRoster = !INACTIVE_POSITION_LIST.includes(
          playerB.selected_position
        );
        // if BN -> Roster, check playerA can move to playerB
        //  if not position, move to next playerB
        //    if position, then check score
        //      if score, then two way swap
        //      if not score, then three way swap
        // if IR -> ActiveRoster, make two way swap
        if (isSwappingILToRoster()) {
          movePlayerTo(playerB, "BN");
          swapPlayers(playerA, playerB);
          break;
        }

        if (playerA.eligible_positions.includes(playerB.selected_position)) {
          if (isMaximizingScore() && playerB.score >= playerA.score) {
            // if maximizing score, we will only swap directly if sourcePlayer.score > targetPlayer.score
            console.log(
              "Need to find a three way swap since sourcePlayer.score < targetPlayer.score"
            );
            const playerC = findPlayerC(playerA, playerB);
            if (playerC) {
              console.log("Found three way swap");
              swapPlayers(playerA, playerB);
              swapPlayers(playerB, playerC);
              break;
            }
            console.log("No three way swap found");
          } else {
            console.log("Direct swap");
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
        console.log(
          "looking for three way swap to move inactive player to active roster"
        );
        for (const playerB of eligibleSourcePlayers) {
          const playerC = findPlayerC(playerA, playerB);
          if (playerC) {
            console.log("Found three way swap");
            swapPlayers(playerB, playerC);
            swapPlayers(playerA, playerB);
            break;
          }
          console.log("No three way swap found");
        }
      }
    }
    // continue without incrementing i if a swap was made
    // this is to ensure we recheck the player swapped to bench for other swaps
    if (isPlayerASwapped) continue;
    console.log("No swaps for player " + playerA.player_name);

    // TODO: Refactor this into a function
    // Finally, if there are no eligible player swaps, then we will look for an unfilled position
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
      console.log("numEmptyRosterSpots: ", numEmptyRosterSpots);
      if (numEmptyRosterSpots > 0) {
        unfilledPosition = "BN";
      }
      // TODO: else Drop players to make room for playerA
    } else {
      unfilledPosition = Object.keys(unfilledPositions).find((position) => {
        let predicate: boolean =
          unfilledPositions[position] > 0 &&
          playerA.eligible_positions.includes(position);
        if (!addPlayersToRoster) {
          // if we are not adding players to the roster, do not move players to inactive positions
          predicate &&= !INACTIVE_POSITION_LIST.includes(position);
        }
        return predicate;
      });
    }

    if (unfilledPosition) {
      // if there is an unfilled position, then we will move the player to that position
      console.log(
        "Moving player " + playerA.player_name + " to unfilled position: ",
        unfilledPosition
      );
      // modify the unfilled positions
      console.log(
        "unfilledPositions before: ",
        JSON.stringify(unfilledPositions)
      );
      unfilledPositions[playerA.selected_position] += 1;
      unfilledPositions[unfilledPosition] -= 1;
      console.log(
        "unfilledPositions after: ",
        JSON.stringify(unfilledPositions)
      );

      movePlayerTo(playerA, unfilledPosition);
      // splice the player from source and add to target
      const idx = source.indexOf(playerA);
      target.push(source.splice(idx, 1)[0]);

      // continue without incrementing i if a swap was made
      continue;
    }
    i++;
    console.log("i: " + i + " source.length: " + source.length);
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
      (thirdPlayer: Player) =>
        thirdPlayer.player_key !== playerB.player_key &&
        playerB.eligible_positions.includes(thirdPlayer.selected_position) &&
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
  function swapPlayers(playerOne: Player, playerTwo: Player): void {
    // TODO: Don't want to move to other array if it is all the players. Only if it is a subset of the players.
    console.log("swapping", playerOne.player_name, playerTwo.player_name);
    const idxOne = source.indexOf(playerOne);
    const idxTwo = target.indexOf(playerTwo);
    source[idxOne] = playerTwo;
    target[idxTwo] = playerOne;

    const tempPosition = playerOne.selected_position;
    movePlayerTo(playerOne, playerTwo.selected_position);
    movePlayerTo(playerTwo, tempPosition);

    isPlayerASwapped = true;
  }
}
