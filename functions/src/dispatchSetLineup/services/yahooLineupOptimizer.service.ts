import { Player, Roster, RosterModification } from "../interfaces/roster";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";
import { postRosterModifications } from "../../common/services/yahooAPI/yahooAPI.service";

import {
  HEALTHY_STATUS_LIST,
  INACTIVE_POSITION_LIST,
} from "../helpers/constants";
import {
  nflScoreFunction,
  weeklyLineupScoreFunction,
  nhlScoreFunction,
  dailyScoreFunction,
} from "./playerStartSitScoreFunctions.service";
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
export async function setUsersLineup(
  uid: string,
  teams: string[]
): Promise<void> {
  if (!uid) {
    throw new Error(
      "User must be logged in to get an access token. No uid provided."
    );
  }
  if (!teams) {
    throw new Error("No teams provided to optimize lineups for. User: " + uid);
  }

  // initialize starting goalies global array
  await initStartingGoalies();

  const rosters = await fetchRostersFromYahoo(teams, uid);
  const rosterModifications: RosterModification[] = [];
  for (const roster of rosters) {
    const rm = optimizeStartingLineup(roster);
    if (rm) {
      rosterModifications.push(rm);
    }
  }

  return await postRosterModifications(rosterModifications, uid);
}

/**
 * Will optimize the starting lineup for a given roster
 *
 * @export
 * @param {Roster} teamRoster - The roster to optimize
 * @return {*} {RosterModification} - The roster modification to make
 */
function optimizeStartingLineup(teamRoster: Roster): RosterModification {
  const {
    team_key: teamKey,
    players,
    coverage_type: coverageType,
    coverage_period: coveragePeriod,
    weekly_deadline: weeklyDeadline,
    roster_positions: rosterPositions,
  } = teamRoster;

  const unfilledPositions = getUnfilledPositions(players, rosterPositions);
  let emptyRosterSpots: number = Object.keys(unfilledPositions).reduce(
    (acc, key) => {
      if (!INACTIVE_POSITION_LIST.includes(key)) acc += unfilledPositions[key];
      return acc;
    },
    0
  );

  let genPlayerScore: (player: Player) => number;
  if (teamRoster.game_code === "nfl") {
    genPlayerScore = nflScoreFunction();
  } else if (weeklyDeadline && weeklyDeadline !== "intraday") {
    // weeklyDeadline will be something like "1" to represent Monday
    genPlayerScore = weeklyLineupScoreFunction();
  } else if (teamRoster.game_code === "nhl") {
    genPlayerScore = nhlScoreFunction();
  } else {
    genPlayerScore = dailyScoreFunction();
  }

  const {
    rostered,
    injuredOnRoster,
    benched,
    healthyOnIR,
  }: {
    rostered: Player[];
    injuredOnRoster: Player[];
    benched: Player[];
    healthyOnIR: Player[];
  } = fillRosterArrays(players, genPlayerScore);

  // If there are no editable players on roster or bench, return
  if (
    rostered.length === 0 ||
    (benched.length === 0 && healthyOnIR.length === 0)
  ) {
    // console.log("No players to optimize for team: " + teamKey);
    return { teamKey, coverageType, coveragePeriod, newPlayerPositions: {} };
  }

  const newPlayerPositions: any = {};
  if (healthyOnIR.length > 0 && injuredOnRoster.length > 0) {
    // Healthy players on IR will be sorted higher to lower
    healthyOnIR.sort(playerCompareFunction);
    healthyOnIR.reverse();
    // IR eligible players on bench will be sorted lower to higher
    injuredOnRoster.sort(playerCompareFunction);

    // Loop through all healthy players on IR and attempt to swap them with
    // IR eligible players on the bench. This may not be possible.
    for (const healthyPlayer of healthyOnIR) {
      findInactivePlayerSwap(
        injuredOnRoster,
        unfilledPositions,
        healthyPlayer,
        benched,
        newPlayerPositions
      );
      // finally, if there are any empty roster spots, move the injured player there
      if (emptyRosterSpots > 0) {
        movePlayerTo(healthyPlayer, "BN", newPlayerPositions);
        benched.push(healthyPlayer);
        emptyRosterSpots -= 1;
      }
    }
  } // end check IR players

  // TODO: If there are empty roster spots, add a player from free agency.
  // Loop through all injuredOnRoster and attempt to move them into empty IR/IL spots
  // If this is an intraday league, do this async and wait. Otherwise, do it
  // synchronously. What happens here if it is only one thread?
  rostered.sort(playerCompareFunction);
  while (benched.length > 0) {
    // Pop the benchPlayer off the benched stack, it will either be moved
    // to the roster, or it belongs on the bench and can be ignored.
    const benchPlayer: Player | undefined = benched.pop();
    if (benchPlayer) {
      const positionsList = benchPlayer.eligible_positions.filter(
        (pos) => INACTIVE_POSITION_LIST.indexOf(pos) === -1
      );
      const isPlayerMoved = moveToUnfilledPosition(positionsList, benchPlayer);
      if (isPlayerMoved) {
        rostered.push(benchPlayer);
        rostered.sort(playerCompareFunction);
        continue;
      }
      if (playerCompareFunction(benchPlayer, rostered[0]) > 0) {
        // Only attempt to swap player if it is better than at least one player
        // on the active roster. Otherwise, just discard and move to the next.
        findActivePlayerSwap(
          benchPlayer,
          rostered,
          benched,
          newPlayerPositions
        );
      }
    }
  } // end while

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

  /**
   * This function will attempt to move a player from the bench to an unfilled
   * position on the roster. If it is successful, it will return true. Otherwise,
   * it will return false.
   *
   *
   * @param {string[]} positionsList - The list of positions to check
   * @param {Player} benchPlayer - The player to move
   * @return {boolean} - Whether the player was moved or not
   */
  function moveToUnfilledPosition(
    positionsList: string[],
    benchPlayer: Player
  ): boolean {
    for (const eligiblePosition of positionsList) {
      if (unfilledPositions[eligiblePosition] > 0) {
        movePlayerTo(benchPlayer, eligiblePosition, newPlayerPositions);
        unfilledPositions[eligiblePosition] -= 1;
        return true;
      }
    }
    return false;
  }
}

/**
 * Will calculate the number of unfilled positions for a given roster
 *
 * @param {Player[]} players - The players on the roster
 * @param {{ [key: string]: number }} rosterPositions - The roster positions
 * @returns {{ [key: string]: number }} - The number of unfilled positions
 */
function getUnfilledPositions(
  players: Player[],
  rosterPositions: { [key: string]: number }
): { [key: string]: number } {
  const unfilledPositions: { [key: string]: number } = { ...rosterPositions };
  players.forEach((player) => {
    unfilledPositions[player.selected_position]--;
  });
  return unfilledPositions;
}

/**
 * This function will loop through all players and add them to the appropriate
 * array based on their status and eligibility.
 *
 * @param {Player[]} players - The players to loop through
 * @param {(player)} genPlayerScore - The function to generate the score for a player
 * @return {{ rostered: Player[], injuredOnRoster: Player[], benched: Player[], healthyOnIR: Player[] }} - The arrays of players
 */
function fillRosterArrays(
  players: Player[],
  genPlayerScore: (player: Player) => number
) {
  const benched: Player[] = [];
  const rostered: Player[] = [];
  const healthyOnIR: Player[] = [];
  const injuredOnRoster: Player[] = [];
  players.forEach((player) => {
    if (player.is_editable) {
      player.score = genPlayerScore(player);

      if (INACTIVE_POSITION_LIST.includes(player.selected_position)) {
        if (HEALTHY_STATUS_LIST.includes(player.injury_status)) {
          // If there is a healthy player sitting on the IR
          healthyOnIR.push(player);
        }
      } else {
        if (player.selected_position !== "BN") {
          rostered.push(player);
        } else {
          benched.push(player);
        } // end if player.selected_position == "BN"

        // check if player.eligible_positions and INACTIVE_POSITION_LIST arrays intersect
        const inactiveEligiblePositions = player.eligible_positions.filter(
          (value) => INACTIVE_POSITION_LIST.includes(value)
        );
        if (inactiveEligiblePositions.length > 0) {
          injuredOnRoster.push(player);
        }
      } // end if player is currently in an IR position
    } // end if player is editable
  });
  return { rostered, injuredOnRoster, benched, healthyOnIR };
}

/**
 * Compares two players by score.
 *
 * @param {Player} a - A player object
 * @param {Player} b - A player object
 * @return {number} - A number indicating the relative order of the two players.
 */
function playerCompareFunction(a: Player, b: Player): number {
  return a.score - b.score;
}

/**
 * Finds an active roster spot for a healthy player to replace an injured player
 *
 * @param {Player[]} injuredOnRoster - List of injured players on the active roster
 * @param {*} emptyPositions - List of empty positions on the active roster
 * @param {Player} healthyPlayer - A healthy player to replace an injured player
 * @param {Player[]} benched - List of benched players
 * @param {*} newPlayerPositions - Dictionary of player positions to be updated
 * Returns nothing, but updates newPlayerPositions and emptyPositions
 */
function findInactivePlayerSwap(
  injuredOnRoster: Player[],
  emptyPositions: any,
  healthyPlayer: Player,
  benched: Player[],
  newPlayerPositions: any
): void {
  for (let i = 0; i < injuredOnRoster.length; i++) {
    const injuredPlayer = injuredOnRoster[i];

    // A function to find an available position for the injured player
    // in a specific list of Inactive Positions
    const findAvailblePosition = (positionsList: string[]) => {
      for (const eligiblePosition of injuredPlayer.eligible_positions) {
        if (positionsList.includes(eligiblePosition)) {
          if (eligiblePosition === healthyPlayer.selected_position) {
            swapPlayers(eligiblePosition);
            return true;
          } else if (emptyPositions[eligiblePosition] > 0) {
            swapPlayers(eligiblePosition);
            emptyPositions[eligiblePosition] -= 1;
            return true;
          }
        }
      }
      return false;

      /**
       * Swaps the healthy player with the injured player
       *
       * @param {string} eligiblePosition - The eligible position for the injured player
       */
      function swapPlayers(eligiblePosition: string) {
        movePlayerTo(healthyPlayer, "BN", newPlayerPositions);
        benched.push(healthyPlayer);
        movePlayerTo(injuredPlayer, eligiblePosition, newPlayerPositions);
        emptyPositions[injuredPlayer.selected_position] += 1;
        injuredOnRoster.splice(i, 1);
      }
    };

    // split the list into priority 1 and priority 2 and attempt to swap
    const INACTIVE_POSITION_LIST_P1 = ["IR", "IL"];
    if (findAvailblePosition(INACTIVE_POSITION_LIST_P1)) {
      return;
    }

    const INACTIVE_POSITION_LIST_P2 = INACTIVE_POSITION_LIST.filter(
      (pos) => !INACTIVE_POSITION_LIST_P1.includes(pos)
    );
    if (findAvailblePosition(INACTIVE_POSITION_LIST_P2)) {
      return;
    }
  }
}

/**
 * Attempts to move a bench player onto the active roster
 *
 * @param {Player} benchPlayer - The player to move onto the active roster
 * @param {Player[]} rostered - List of players on the active roster
 * @param {Player[]} benched - List of players on the bench
 * @param {*} newPlayerPositions - Dictionary of player positions to be updated
 */
function findActivePlayerSwap(
  benchPlayer: Player,
  rostered: Player[],
  benched: Player[],
  newPlayerPositions: any
) {
  for (const rosterPlayer of rostered) {
    if (
      benchPlayer.eligible_positions.includes(rosterPlayer.selected_position)
    ) {
      if (playerCompareFunction(benchPlayer, rosterPlayer) > 0) {
        // Perform a 2-way swap.
        movePlayerTo(
          benchPlayer,
          rosterPlayer.selected_position,
          newPlayerPositions
        );
        movePlayerTo(rosterPlayer, "BN", newPlayerPositions);

        // rosterPlayer could still potentially displace a different player
        benched.push(rosterPlayer);

        // Add benchPlayer to rostered in place of rosterPlayer and re-sort
        const swapIndex = rostered.indexOf(rosterPlayer);
        rostered[swapIndex] = benchPlayer;
        rostered.sort(playerCompareFunction);

        return;
      } else {
        // If the benchPlayer has a lower score than the rosterPlayer
        // Look for three-way swaps available to accomodate benchPlayer
        // Compare the rosterPlayer with each (thirdPlayer) with lower
        // score than benchPlayer
        let idx = 0;
        let thirdPlayer = rostered[idx];
        while (playerCompareFunction(thirdPlayer, benchPlayer) < 0) {
          if (
            rosterPlayer.eligible_positions.includes(
              thirdPlayer.selected_position
            )
          ) {
            // If rosterPlayer can be swapped with any of the earlier players,
            // Perform a 3-way swap.
            movePlayerTo(
              benchPlayer,
              rosterPlayer.selected_position,
              newPlayerPositions
            );
            movePlayerTo(
              rosterPlayer,
              thirdPlayer.selected_position,
              newPlayerPositions
            );
            movePlayerTo(thirdPlayer, "BN", newPlayerPositions);

            // Add benchPlayer to rostered in place of thirdPlayer and resort
            const swapIndex = rostered.indexOf(thirdPlayer);
            rostered[swapIndex] = benchPlayer;
            rostered.sort(playerCompareFunction);

            return;
          } // end if possible three-way swap
          thirdPlayer = rostered[++idx];
        } // end while
      } // end if/else compare score
    } // end if players are of compatible positions
  } // end for i loop
} // end swapPlayerIntoRoster()

/**
 * A small helper function to move a player to a new position
 *
 * @param {Player} player - The player to move
 * @param {string} position - The new position to move the player to
 * @param {*} newPlayerPositions - Dictionary of player positions to be updated
 */
function movePlayerTo(
  player: Player,
  position: string,
  newPlayerPositions: any
) {
  player.selected_position = position;
  newPlayerPositions[player.player_key] = position;
}
