import { Roster as Roster } from "./Roster";
import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { Team } from "../interfaces/Team";
import { RosterModification } from "../interfaces/RosterModification";
import { assignPlayerStartScoreFunction } from "../services/playerStartScoreFunctions.service";
import { OptimizationPlayer } from "./OptimizationPlayer";

export class LineupOptimizer {
  private readonly team: Team;
  private roster: Roster;
  private originalPlayerPositions: { [key: string]: string };
  private newPlayerPositions: { [key: string]: string } = {};
  private _verbose = false;
  public set verbose(value: boolean) {
    this._verbose = value;
  }

  constructor(team: Team) {
    this.team = team;
    this.roster = new Roster(
      team.players,
      team.roster_positions,
      assignPlayerStartScoreFunction(team.game_code, team.weekly_deadline)
    );
    this.originalPlayerPositions = this.createPlayerPositionDictionary(
      this.roster.editablePlayers
    );
  }

  public async optimizeStartingLineup(): Promise<RosterModification> {
    if (this.roster.editablePlayers.length === 0) {
      this._verbose &&
        console.info("no players to optimize for team " + this.team.team_key);
      return this.aRosterModification({});
    }

    const optimizeListAtoListB = (
      listA: OptimizationPlayer[],
      listB: OptimizationPlayer[]
    ) => {
      Roster.sortDescendingByScore(listA);
      Roster.sortAscendingByScore(listB);
      this.transferPlayers(listA, listB);
    };

    // player objects within these filtered roster objects are mutable, so changes
    // to these objects will be maintained in the original roster object
    const inactivePlayers = this.roster.inactivePlayers;
    const activePlayers = this.roster.activePlayers;
    optimizeListAtoListB(inactivePlayers, activePlayers);

    // Attempt to fix illegal players by swapping them with all eligible players
    // Illegal players are players that are not eligible for their selected position
    // For example, any player in an IR position that is now healthy, IR+, or NA
    this.resolveIllegalPlayers();

    // TODO: Move all injured players to InactiveList if possible
    // TODO: Add new players from FA if there are empty roster spots

    const benchPlayers = this.roster.benchPlayers;
    const rosterPlayers = this.roster.rosterPlayers;
    optimizeListAtoListB(benchPlayers, rosterPlayers);

    this.newPlayerPositions = this.diffPlayerPositionDictionary(
      this.originalPlayerPositions,
      this.createPlayerPositionDictionary(this.roster.editablePlayers)
    );

    // Return the roster modification object if there are changes
    return this.aRosterModification(this.newPlayerPositions);
  }

  private aRosterModification(newPlayerPositions: {
    [key: string]: string;
  }): RosterModification {
    return {
      teamKey: this.team.team_key,
      coverageType: this.team.coverage_type,
      coveragePeriod: this.team.coverage_period,
      newPlayerPositions,
    };
  }

  private createPlayerPositionDictionary(players: OptimizationPlayer[]) {
    const result: { [key: string]: string } = {};
    players.forEach((player) => {
      result[player.player_key] = player.selected_position;
    });
    return result;
  }

  private diffPlayerPositionDictionary(
    originalPlayerPositions: { [key: string]: string },
    finalPlayerPositions: { [key: string]: string }
  ) {
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

  public isSuccessfullyOptimized(): boolean {
    // TODO: Refactor this further. Maybe we can pull out code into a separate function
    const unfilledPositionsCounter = this.roster.unfilledPositionCounter;
    const benchPlayers = this.roster.benchPlayers;

    if (unfilledActiveRosterPositions().length > 0) {
      console.error(
        `Suboptimal Lineup: unfilledRosterPositions for team ${
          this.team.team_key
        }: ${unfilledActiveRosterPositions()}`
      );
      return false;
    }

    const unfilledPositions = Object.keys(unfilledPositionsCounter);
    for (const position of unfilledPositions) {
      if (position !== "BN" && unfilledPositionsCounter[position] < 0) {
        console.error(
          `Illegal Lineup: Too many players at position ${position} for team ${this.team.team_key}`
        );
        return false;
      }
    }

    const illegallyMovedPlayers = Object.keys(this.newPlayerPositions).filter(
      (movedPlayerKey) =>
        this.roster.illegalPlayers.some(
          (illegalPlayer) => illegalPlayer.player_key === movedPlayerKey
        )
    );
    if (illegallyMovedPlayers.length > 0) {
      console.error(
        `Illegal Lineup: illegalPlayers moved for team ${this.team.team_key}: ${illegallyMovedPlayers}`
      );
      return false;
    }

    const idlePlayers = this.roster.benchPlayers.concat(
      this.roster.inactivePlayers
    );
    for (const idlePlayer of idlePlayers) {
      for (const rosterPlayer of this.roster.rosterPlayers) {
        if (eligibleReplacementPlayerHasLowerScore(idlePlayer, rosterPlayer)) {
          console.error(
            `Suboptimal Lineup: benchPlayer ${idlePlayer.player_name} has a higher score than rosterPlayer ${rosterPlayer.player_name} for team ${this.team.team_key}`
          );
          return false;
        }
      }
    }

    return true;

    // end of verifyOptimization() function

    // TODO: Can we move this into Player class?
    function eligibleReplacementPlayerHasLowerScore(
      playerA: OptimizationPlayer,
      playerB: OptimizationPlayer
    ) {
      return (
        playerA.eligible_positions.includes(playerB.selected_position) &&
        playerB.eligible_positions.includes(playerA.selected_position) &&
        playerA.start_score > playerB.start_score
      );
    }

    // TODO: Will we need this in the transferPlayers() function?
    function unfilledActiveRosterPositions() {
      // get all unfilled positions except for BN and INACTIVE_POSITION_LIST
      const unfilledRosterPositions = Object.keys(
        unfilledPositionsCounter
      ).filter(
        (position) =>
          position !== "BN" &&
          !INACTIVE_POSITION_LIST.includes(position) &&
          unfilledPositionsCounter[position] > 0
      );
      // check if there are any players on bench that can be moved to the unfilled positions
      const result: string[] = [];
      for (const benchPlayer of benchPlayers) {
        for (const unfilledPosition of unfilledRosterPositions) {
          if (benchPlayer.eligible_positions.includes(unfilledPosition)) {
            result.push(unfilledPosition);
          }
        }
      }
      return result;
    }
  }

  private movePlayerToPosition(player: OptimizationPlayer, position: string) {
    player.selected_position = position;
  }

  resolveIllegalPlayers() {
    const illegalPlayers = this.roster.illegalPlayers;
    if (illegalPlayers.length === 0) return;

    const legalPlayers = this.roster.legalPlayers;
    // const inactiveOnRoster = this.roster.inactiveOnRosterPlayers;
    Roster.sortDescendingByScore(illegalPlayers);
    Roster.sortAscendingByScore(legalPlayers);

    const swapWithOtherIllegalPlayers = (playerA: OptimizationPlayer) => {
      for (const playerB of illegalPlayers) {
        if (playerA.isEligibleToSwapWith(playerB)) {
          this._verbose &&
            console.info(
              `swapping ${playerA.player_name} ${playerA.selected_position} with ${playerB.player_name} ${playerB.selected_position}`
            );
          const temp = playerB.selected_position;
          this.movePlayerToPosition(playerB, playerA.selected_position);
          this.movePlayerToPosition(playerA, temp);
          return true;
        }
      }
      return false;
    };

    const swapWithLegalPlayers = (playerA: OptimizationPlayer) => {
      for (const playerB of legalPlayers) {
        if (playerA.isEligibleToSwapWith(playerB)) {
          this._verbose &&
            console.info(
              `swapping ${playerA.player_name} ${playerA.selected_position} with ${playerB.player_name} ${playerB.selected_position}`
            );
          const temp = playerB.selected_position;
          this.movePlayerToPosition(playerB, playerA.selected_position);
          this.movePlayerToPosition(playerA, temp);
          return true;
        }
      }
      return false;
    };

    // const freeUpRosterSpot = (playerA: OptimizationPlayer) => {
    // function should free up only one position, we will call multiple times if more are required
    // };

    for (const illegalPlayer of illegalPlayers) {
      let resolved = swapWithOtherIllegalPlayers(illegalPlayer);
      if (resolved) continue;

      resolved = swapWithLegalPlayers(illegalPlayer);
      // TODO: Three way swap?
      if (resolved) continue;

      // TODO: get list of unfilled positions
      // check if there are any players on bench that can be moved to the unfilled positions
      // if not, free up one position
      // check again
      // free up more positions if needed
    }
  }

  private transferPlayers(
    source: OptimizationPlayer[],
    target: OptimizationPlayer[]
  ): void {
    // temp variables, to be user settings later
    const addPlayersToRoster = false;
    // const dropPlayersFromRoster = false;
    // intialize variables
    const unfilledPositions = this.roster.unfilledPositionCounter;
    const verbose = this._verbose;
    let isPlayerAActiveRoster = false;

    let isPlayerASwapped;
    let i = 0;
    verbose && console.info("source: " + source.map((p) => p.player_name));
    verbose && console.info("target: " + target.map((p) => p.player_name));
    // TODO: if we are always maximizing score now, can we borrow the optimization algorithm from the optimizer?
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
        verbose &&
          console.info(
            "Moving player " + playerA.player_name + " to unfilled position: ",
            unfilledPosition
          );
        // modify the unfilled positions
        verbose &&
          console.info(
            "unfilledPositions before: ",
            JSON.stringify(unfilledPositions)
          );
        unfilledPositions[playerA.selected_position] += 1;
        unfilledPositions[unfilledPosition] -= 1;
        verbose &&
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
        verbose &&
          console.info(
            "eligibleTargetPlayers for player " +
              playerA.player_name +
              ": " +
              eligibleTargetPlayers.map((p) => p.player_name)
          );

        for (const playerB of eligibleTargetPlayers) {
          verbose &&
            console.info(
              "comparing playerA " + playerA.player_name,
              playerA.start_score + " to playerB " + playerB.player_name,
              playerB.start_score
            );

          if (playerA.eligible_positions.includes(playerB.selected_position)) {
            if (playerB.start_score >= playerA.start_score) {
              // if maximizing score, we will only swap directly if sourcePlayer.score > targetPlayer.score
              verbose &&
                console.info(
                  "Need to find a three way swap since sourcePlayer.score < targetPlayer.score"
                );
              const playerC = findPlayerC(playerA, playerB);
              if (playerC) {
                verbose && console.info("Found three way swap");
                swapPlayers(playerA, playerB);
                swapPlayers(playerB, playerC);
                break;
              }
              verbose && console.info("No three way swap found");
            } else {
              verbose && console.info("Direct swap");
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
          verbose &&
            console.info(
              "looking for three way swap to move inactive player to active roster"
            );
          for (const playerB of eligibleSourcePlayers) {
            const playerC = findPlayerC(playerA, playerB);
            if (playerC) {
              verbose && console.info("Found three way swap");
              swapPlayers(playerB, playerC);
              swapPlayers(playerA, playerB);
              break;
            }
            verbose && console.info("No three way swap found");
          }
        }
      }
      // continue without incrementing i if a swap was made
      // this is to ensure we recheck the player swapped to bench for other swaps
      if (isPlayerASwapped) continue;
      verbose && console.info("No swaps for player " + playerA.player_name);
      i++;
      verbose && console.info("i: " + i + " source.length: " + source.length);
    }

    return;

    /**
     * Returns the unfilled position if there is one, otherwise returns undefined
     *
     * @param {OptimizationPlayer} playerA - the player to find an unfilled position for
     * @return {string} - the unfilled position
     */
    function availableUnfilledPosition(playerA: OptimizationPlayer) {
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
        verbose && console.info("numEmptyRosterSpots: ", numEmptyRosterSpots);
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
     * @param {OptimizationPlayer} playerA - The player to move
     * @param {OptimizationPlayer} playerB - The player to move to
     * @return {(OptimizationPlayer | undefined)} - The player that can be moved to playerB's position
     */
    function findPlayerC(
      playerA: OptimizationPlayer,
      playerB: OptimizationPlayer
    ): OptimizationPlayer | undefined {
      const eligiblePlayerC = target.find(
        (playerC: OptimizationPlayer) =>
          playerC.player_key !== playerB.player_key &&
          playerB.eligible_positions.includes(playerC.selected_position) &&
          playerC.eligible_positions.includes(playerA.selected_position) &&
          playerC.start_score < playerA.start_score
      );
      return eligiblePlayerC;
    }

    /**
     * Swaps two players positions in the lineup and in the source and target arrays
     *
     * @param {OptimizationPlayer} playerOne - The first player to swap
     * @param {OptimizationPlayer} playerTwo - The second player to swap
     */
    function swapPlayers(
      playerOne: OptimizationPlayer,
      playerTwo: OptimizationPlayer
    ): void {
      // TODO: Don't want to move to other array if it is all the players. Only if it is a subset of the players.
      verbose &&
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
     * @param {OptimizationPlayer} player - The player to swap
     * @param {string} position - The position to swap the player to
     * @param {{}} newPlayerPositions - The dictionary of players to move
     */
    function movePlayerToPosition(
      player: OptimizationPlayer,
      position: string
    ) {
      // console.log(
      //   "movePlayerToPosition",
      //   player.player_name,
      //   player.selected_position,
      //   position
      // );
      player.selected_position = position;
    }
  }
}
