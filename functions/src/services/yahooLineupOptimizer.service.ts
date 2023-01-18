import { Player, Roster, RosterModification } from "../interfaces/roster";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";
import { postRosterChanges } from "./yahooAPI.service";
import { HttpsError } from "firebase-functions/v2/https";

// Statuses to be considered a "healthy" player
const HEALTHY_STATUS_LIST = ["Healthy", "Questionable", "Probable"];
// Roster positions considered to be inactive
const INACTIVE_POSITION_LIST = ["IR", "IR+", "NA"];

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
    const rm = optimizeStartingLineup(roster);
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
function optimizeStartingLineup(teamRoster: Roster): RosterModification {
  const {
    team_key: teamKey,
    players,
    coverage_type: coverageType,
    coverage_period: coveragePeriod,
    weekly_deadline: weeklyDeadline,
  } = teamRoster;

  // Function to generate a score for comparing each player's value
  let genPlayerScore: (player: Player) => number;
  if (teamRoster.game_code === "nfl") {
    genPlayerScore = nflScoreFunction();
  } else if (weeklyDeadline && weeklyDeadline !== "intraday") {
    // weeklyDeadline will be something like "1" tor epresent Monday
    genPlayerScore = weeklyLineupScoreFunction();
  } else {
    genPlayerScore = dailyScoreFunction();
  }

  // Loop through all players and add them to the benched, rostered, or IR list
  // Don't swap players if they are not editable or if they are in an IR spot
  const benched: Player[] = [];
  const rostered: Player[] = [];
  const healthyOnIR: Player[] = [];
  const injuredOnRoster: Player[] = [];
  const emptyPositions: any = {};
  players.forEach((player) => {
    if (player.is_editable) {
      // Add anew property to each player 'score'
      player.score = genPlayerScore(player);
      if (INACTIVE_POSITION_LIST.includes(player.selected_position)) {
        // If the player is currently in an IR position
        if (HEALTHY_STATUS_LIST.includes(player.injury_status)) {
          // If the player is actually healthy
          if (player.player_key === null) {
            // Count the number of empty roster spots (null player key)
            emptyPositions[player.selected_position]++;
          } else {
            // If there is a healthy player sitting on the IR, add them
            // to a list for potential swap onto bench/roster
            healthyOnIR.push(player);
          } // end if player_key === null
        } // end if the player is actually healthy
      } else {
        // If the player is NOT currently in an IR position
        if (player.selected_position !== "BN") {
          rostered.push(player);
        } else {
          benched.push(player);
        } // end if player.selected_position == "BN"

        // In addition to adding to the benched or rostered arrays above,
        // check if the player is IR/IR+ eligible and on the bench/roster
        if (player.player_key && player.eligible_positions.includes("IR+")) {
          injuredOnRoster.push(player);
        }
      } // end if player is currently in an IR position
    } // end if player is editable
  });

  // If there are no editable roster players, or there are no editable bench
  // and no editable IR players return from the function at this point.
  if (
    rostered.length === 0 ||
    (benched.length === 0 && healthyOnIR.length === 0)
  ) {
    console.log("No players to optimize for team: " + teamKey);
    return { teamKey, coverageType, coveragePeriod, newPlayerPositions: {} };
  }

  const playerCompareFunction = (a: Player, b: Player) => {
    return a.score - b.score;
  };

  // Define a dictionary to hold the new positions of all swapped players
  const newPlayerPositions: any = {};

  // Before looping all players, check if any IR eligible players can be
  // swapped with healthy players on IR.
  if (healthyOnIR.length > 0 && injuredOnRoster.length > 0) {
    // Healthy players on IR will be sorted higher to lower
    healthyOnIR.sort(playerCompareFunction).reverse();
    // IR eligible players on bench will be sorted lower to higher
    injuredOnRoster.sort(playerCompareFunction);

    // function containing repeated code to move player to bench
    const movePlayerToBN = (player: Player) => {
      newPlayerPositions[player.player_key] = "BN";
      benched.push(player);
    };

    // Priority one will be to move injuredPlayer onto IR. Priority two will
    // be to move injuredPlayer onto IR+.
    // healthyPlayer will be put onto the bench in this function (maybe later)
    for (const healthyPlayer of healthyOnIR) {
      for (let i = 0; i < injuredOnRoster.length; i++) {
        const injuredPlayer = injuredOnRoster[i];
        if (injuredPlayer.eligible_positions.includes("IR")) {
          if (healthyPlayer.selected_position === "IR") {
            // Both players are IR eligible, swap and move to next
            movePlayerToBN(healthyPlayer);
            newPlayerPositions[injuredPlayer.player_key] = "IR";
            injuredOnRoster.splice(i, 1);
            break;
          }
          if (emptyPositions["IR"] > 0) {
            // If there is an empty spot on IR, it doesn't matter if
            // healthyPlayer is IR or IR+, just move injuredPlayer to
            // IR and healthyPlayer to bench
            movePlayerToBN(healthyPlayer);
            newPlayerPositions[injuredPlayer.player_key] = "IR";
            emptyPositions["IR"] -= 1;
            break;
          }
        } else {
          // injuredPlayer is ONLY IR+ eligible
          if (healthyPlayer.selected_position === "IR+") {
            // Both players are IR eligible, swap and move to next
            movePlayerToBN(healthyPlayer);
            newPlayerPositions[injuredPlayer.player_key] = "IR+";
            injuredOnRoster.splice(i, 1);
            break;
          }
          if (emptyPositions["IR+"] > 0) {
            // If there is an empty roster spot
            movePlayerToBN(healthyPlayer);
            newPlayerPositions[injuredPlayer.player_key] = "IR+";
            emptyPositions["IR+"] -= 1;
            break;
          }
        } // end if injuredPlayer is IR eligible
        // If we reach this point, healthyPlayer could not be swapped with
        // current injuredPlayer, check next injuredPlayer
      } // end for i
      // If we reach this point, healthyPlayer could not be swapped onto bench
      // This could happen if healthyPlayer is in IR position, but
      // injuredPlayer only IR+ eligible, with no spare IR/IR+ spots left.
    } // end for healthyPlayer
  } // end check IR players

  // Attempts to move a bench player onto the active roster
  const swapPlayerToActiveRoster = (benchPlayer: Player) => {
    for (const rosterPlayer of rostered) {
      if (
        benchPlayer.eligible_positions.includes(rosterPlayer.selected_position)
      ) {
        // If the rosterPlayer's current position is included in the list of
        //  the benchPlayer's eligible positions.
        // We are only looking closer at players we can actually swap with.
        if (playerCompareFunction(benchPlayer, rosterPlayer) > 0) {
          // If the benchPlayer > score than the rosterPlayer.
          // Perform a 2-way swap.

          // Update the selected position for both swapped players
          benchPlayer.selected_position = rosterPlayer.selected_position;
          rosterPlayer.selected_position = "BN";

          // Add to the newPlayerPositions dictionary
          newPlayerPositions[benchPlayer.player_key] =
            benchPlayer.selected_position;
          if (rosterPlayer.player_key !== "") {
            // Only add the rosterPlayer to dictionary if it was not a dummy
            newPlayerPositions[rosterPlayer.player_key] =
              rosterPlayer.selected_position;
            // rosterPlayer could still potentially displace a different player
            benched.push(rosterPlayer);
          }

          // Add benchPlayer to rostered in place of rosterPlayer and re-sort
          const swapIndex = rostered.indexOf(rosterPlayer);
          rostered[swapIndex] = benchPlayer;
          rostered.sort(playerCompareFunction);

          // Finished with this benchPlayer, they are now on active roster
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
              benchPlayer.selected_position = rosterPlayer.selected_position;
              rosterPlayer.selected_position = thirdPlayer.selected_position;
              thirdPlayer.selected_position = "BN";

              // Add all players the newPlayerPositions that will be swapped
              newPlayerPositions[benchPlayer.player_key] =
                benchPlayer.selected_position;
              newPlayerPositions[rosterPlayer.player_key] =
                rosterPlayer.selected_position;

              if (thirdPlayer.player_key !== "") {
                newPlayerPositions[thirdPlayer.player_key] =
                  thirdPlayer.selected_position;
                benched.push(thirdPlayer);
              }

              // Add benchPlayer to rostered in place of thirdPlayer and resort
              const swapIndex = rostered.indexOf(thirdPlayer);
              rostered[swapIndex] = benchPlayer;
              rostered.sort(playerCompareFunction);

              // We are finished with this benchPlayer,
              // they have been added to the active roster.
              return;
            } // end if possible three-way swap
            thirdPlayer = rostered[++idx];
          } // end while
        } // end if/else compare score
      } // end if players are of compatible positions
    } // end for i loop
  }; // end swapPlayerIntoRoster()

  // both lists will be sorted by player score
  // rostered will behave like an array with the lowest ranked player at idx 0
  rostered.sort(playerCompareFunction);
  // benched will behave like a stack with the lowest ranked player at the top
  // benched.sort(playerCompareFunction).reverse();

  // Loop over benched players with games and swap into the active roster
  while (benched.length > 0) {
    // Pop the benchPlayer off the benched stack, it will either be moved
    // to the roster, or it belongs on the bench and can be ignored.
    const benchPlayer: Player | undefined = benched.pop();
    if (benchPlayer) {
      // Only attempt to swap player if it is better than at least one player
      // on the active roster. Otherwise, just discard and move to the next.
      if (playerCompareFunction(benchPlayer, rostered[0]) > 0) {
        swapPlayerToActiveRoster(benchPlayer);
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
}
/**
 * Default score function used to compare players.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 *  returns a score.
 */
function dailyScoreFunction(): (player: Player) => number {
  return (player: Player) => {
    if (player.player_key === "") return 0;
    const NOT_PLAYING_FACTOR = 0.0001;
    const NOT_STARTING_FACTOR = 0.01;
    // The score will be percent_started
    // TODO: is_starting to be more specific (basketball G, baseball players)
    // Maybe boost the score of players who are starting instead of penalizing?
    let score = player.percent_started;
    if (!player.is_playing) {
      // If a player is not playing, set their score to a minimal value
      score *= NOT_PLAYING_FACTOR;
    } else if (
      player.is_starting === 0 ||
      (player.is_starting === "N/A" &&
        player.eligible_positions.includes("G")) ||
      !HEALTHY_STATUS_LIST.includes(player.injury_status)
    ) {
      // If a player is not starting or hurt, factor their score such that it
      // falls below all healthy players, but above players not playing.
      score *= NOT_STARTING_FACTOR;
    }

    return score;
  };
}

/**
 * Score function used to compare players in NFL leagues.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 *  returns a score.
 */
function nflScoreFunction(): (player: Player) => number {
  return (player: Player) => {
    if (player.player_key === "") return 0;
    const NOT_PLAYING_FACTOR = 0.0001;
    const NOT_STARTING_FACTOR = 0.01;
    // The score will be percent_started / rank_projected_week
    // TODO: is_starting needs to be more specific (basketball G, baseball P)
    // TODO: Does rank_projected_week factor in injury status already?
    // Are we double counting?
    let score = (player.percent_started / player.rank_projected_week) * 100;
    if (!player.is_playing) {
      // If a player is not playing, set their score to a minimal value
      score *= NOT_PLAYING_FACTOR;
    } else if (
      player.is_starting === 0 ||
      (player.is_starting === "N/A" &&
        player.eligible_positions.includes("G")) ||
      !HEALTHY_STATUS_LIST.includes(player.injury_status)
    ) {
      // If a player is not starting or hurt, factor their score such that it
      // falls below all healthy players, but above players not playing.
      score *= NOT_STARTING_FACTOR;
    }

    return score;
  };
}

/**
 * Score function used to compare players in leagues that need their lineups
 * set weekly.
 * Higher scores are better.
 *
 * @return {()} - A function that takes a player and returns a score.
 */
function weeklyLineupScoreFunction(): (player: Player) => number {
  return (player: Player) => {
    if (player.player_key === "") return 0;
    // The score will be the inverse of their projected rank for the next week
    // We will not factor in injury status as Yahoo has already accounted for it
    const score = 100 / player.rank_next7days;
    return score;
  };
}
