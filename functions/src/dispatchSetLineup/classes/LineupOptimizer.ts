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

  public verbose = false;
  private logInfo(...args: any[]) {
    if (this.verbose) console.info(...args);
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

  public optimizeStartingLineup(): RosterModification {
    if (this.roster.editablePlayers.length === 0) {
      this.logInfo("no players to optimize for team " + this.team.team_key);
      return this.aRosterModification({});
    }

    const optimizeListAtoListB = (
      listA: OptimizationPlayer[],
      listB: OptimizationPlayer[]
    ) => {
      Roster.sortDescendingByScore(listA);
      Roster.sortAscendingByScore(listB);
      this.transferOptimalPlayers(listA, listB);
    };

    const isWeeklyDeadline =
      this.team.weekly_deadline !== "intraday" &&
      this.team.weekly_deadline !== "";
    if (isWeeklyDeadline) {
      const inactivePlayers = this.roster.inactivePlayers;
      const activePlayers = this.roster.activePlayers;
      this.logInfo("Optimizing inactive players to active players");
      optimizeListAtoListB(inactivePlayers, activePlayers);
    }

    this.resolveIllegalPlayers();

    // TODO: Move all injured players to InactiveList if possible
    // TODO: Add new players from FA if there are empty roster spots

    const benchPlayers = this.roster.benchPlayers;
    const rosterPlayers = this.roster.activeRosterPlayers;
    this.logInfo("Optimizing bench players to active roster players");
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

  private movePlayerToPosition(player: OptimizationPlayer, position: string) {
    this.logInfo(
      "moving player " + player.player_name + " to position " + position
    );
    player.selected_position = position;
  }

  private getEligiblePositions(
    player: OptimizationPlayer,
    positionsList: string[]
  ) {
    return player.eligible_positions.filter(
      (position) =>
        position !== player.selected_position &&
        positionsList.includes(position)
    );
  }

  private openOneRosterSpot(): boolean {
    const unfilledInactivePositions: string[] =
      this.roster.unfilledInactivePositions;
    if (unfilledInactivePositions.length === 0) return false;

    const inactivePlayersOnRoster: OptimizationPlayer[] =
      this.roster.inactiveOnRosterPlayers;
    Roster.sortAscendingByScore(inactivePlayersOnRoster);

    for (const inactivePlayer of inactivePlayersOnRoster) {
      const eligiblePositions: string[] = this.getEligiblePositions(
        inactivePlayer,
        unfilledInactivePositions
      );
      if (eligiblePositions.length > 0) {
        this.logInfo("freeing up one roster spot:");
        this.movePlayerToPosition(inactivePlayer, eligiblePositions[0]);
        return true;
      }
    }
    return false;
  }

  resolveIllegalPlayers() {
    const illegalPlayers = this.roster.illegalPlayers;
    if (illegalPlayers.length === 0) return;

    const allEditablePlayers = this.roster.editablePlayers;
    Roster.sortDescendingByScore(illegalPlayers);
    Roster.sortAscendingByScore(allEditablePlayers);

    this.logInfo(
      "Resolving illegal players:" +
        illegalPlayers.map((p) => p.player_name).join(", ")
    );

    for (const player of illegalPlayers) {
      const resolved = this.attemptMoveToUnfilledPosition(player);
      if (!resolved) {
        this.attemptSwapWithList(player, allEditablePlayers);
      }
    }
  }

  private attemptMoveToUnfilledPosition(player: OptimizationPlayer): boolean {
    const positionsList = player.isActiveRoster()
      ? this.roster.unfilledActivePositions //could change to this.roster.unfilledPositions for more flexibility
      : this.roster.unfilledInactivePositions;

    let unfilledPosition = this.getEligiblePositions(player, positionsList)[0];

    this.logInfo("unfilledPosition: " + unfilledPosition);

    if (!unfilledPosition) {
      if (player.isActiveRoster()) return false;

      this.logInfo("numEmptyRosterSpots: " + this.roster.numEmptyRosterSpots);

      if (this.roster.numEmptyRosterSpots === 0) {
        const result = this.openOneRosterSpot();
        if (!result) return false;
      }
      unfilledPosition = "BN";
    }

    this.movePlayerToPosition(player, unfilledPosition);
    return true;
  }

  private attemptSwapWithList(
    playerA: OptimizationPlayer,
    playerBList: OptimizationPlayer[]
  ): boolean {
    for (const playerB of playerBList) {
      this.logInfo(
        `comparing ${playerA.player_name} to ${playerB.player_name}`
      );

      if (playerA.isEligibleToSwapWith(playerB)) {
        this.swapPlayers(playerA, playerB);
        return true;
      } else {
        this.logInfo("attempting to find a three way swap");
        const playerC = this.findPlayerC(playerA, playerB, playerBList, false);
        if (playerC) {
          this.logInfo("three-way swap found!");
          if (playerA.isInactiveList() && playerB.isActiveRoster()) {
            this.movePlayerToPosition(playerB, "BN");
          }
          this.swapPlayers(playerA, playerB);
          this.swapPlayers(playerB, playerC);
          return true;
        }
        // this.logInfo("attempting to move playerB to unfilled position");
        // const tempPosition = playerB.selected_position;
        // const result = this.attemptMoveToUnfilledPosition(playerB);
        // if (result) {
        //   this.movePlayerToPosition(playerA, tempPosition);
        // }
      }
    }
    return false;
  }

  private swapPlayers(
    playerA: OptimizationPlayer,
    playerB: OptimizationPlayer
  ): void {
    this.logInfo(
      `swapping ${playerA.player_name} ${playerA.selected_position} with ${playerB.player_name} ${playerB.selected_position}`
    );
    const temp = playerB.selected_position;
    this.movePlayerToPosition(playerB, playerA.selected_position);
    this.movePlayerToPosition(playerA, temp);
  }

  /**
   * Find a third player, playerC, who is eligible to facilitate a three-way swap
   * between playerA and playerB. Return undefined if no such player is found.
   *
   * This finds a left-hand rotation swap, i.e. player A ->B -> C
   *
   * @private
   * @param {OptimizationPlayer} playerA - player to be swapped out
   * @param {OptimizationPlayer} playerB - player to be swapped in
   * @param {OptimizationPlayer[]} playersArray - array of players to search for playerC
   * @returns {(OptimizationPlayer | undefined)} playerC or undefined if not found
   */
  private findPlayerC(
    playerA: OptimizationPlayer,
    playerB: OptimizationPlayer,
    playersArray: OptimizationPlayer[],
    optimizeScore: boolean = true
  ): OptimizationPlayer | undefined {
    this.logInfo(
      `Finding playerC for playerA: ${playerA.player_key} ${playerA.start_score}, playerB: ${playerB.player_key} ${playerB.start_score}`
    );

    // If we are moving playerA from inactive to active roster, player B will
    // go to BN as an intermediary step. This ensures that playerA can swap
    // with anyone, not just players they share an exact position with.
    const playerBPosition =
      playerA.isInactiveList() && playerB.isActiveRoster()
        ? "BN"
        : playerB.selected_position;

    return playersArray.find(
      (playerC: OptimizationPlayer) =>
        playerB.player_key !== playerC.player_key &&
        (optimizeScore
          ? playerA.start_score > playerC.start_score
          : playerA.player_key !== playerC.player_key) &&
        playerB.eligible_positions.includes(playerC.selected_position) &&
        playerC.eligible_positions.includes(playerA.selected_position) &&
        playerA.eligible_positions.includes(playerBPosition)
    );
  }

  private transferOptimalPlayers(
    source: OptimizationPlayer[],
    target: OptimizationPlayer[]
  ): void {
    // temp variables, to be user settings later
    // const addPlayersToRoster = false;
    // const dropPlayersFromRoster = false;
    // intialize variables
    const swapPlayers = (
      playerOne: OptimizationPlayer,
      playerTwo: OptimizationPlayer
    ): void => {
      this.swapPlayers(playerOne, playerTwo);
      source[source.indexOf(playerOne)] = playerTwo;
      target[target.indexOf(playerTwo)] = playerOne;
      isPlayerASwapped = true;
    };

    let isPlayerASwapped;
    let i = 0;
    this.logInfo("source: " + source.map((p) => p.player_name));
    this.logInfo("target: " + target.map((p) => p.player_name));
    // TODO: if we are always maximizing score now, can we borrow the optimization algorithm from the optimizer?
    // TODO: Can we make this more like the resolveIllegalPlayer function?
    while (i < source.length) {
      const playerA = source[i];
      isPlayerASwapped = false;

      let unfilledPosition;
      if (playerA.isActiveRoster()) {
        unfilledPosition = this.getEligiblePositions(
          playerA,
          this.roster.unfilledActivePositions
        )[0];
      } else if (this.roster.numEmptyRosterSpots > 0) {
        unfilledPosition = "BN";
      }
      if (unfilledPosition) {
        this.logInfo(
          `Moving player ${playerA.player_name} to unfilled position: ${unfilledPosition}`
        );
        this.movePlayerToPosition(playerA, unfilledPosition);
        // splice the player from source and add to target array
        const idx = source.indexOf(playerA);
        target.push(source.splice(idx, 1)[0]);

        // continue without incrementing i if a swap was made
        continue;
      }

      const isPlayerWorseThanTargetArray =
        playerA.start_score < Math.min(...target.map((tp) => tp.start_score));
      if (isPlayerWorseThanTargetArray) {
        this.logInfo(
          `Player ${playerA.player_name} is worse than all players in target array. Skipping.`
        );
        i++;
        continue;
      }

      const eligibleTargetPlayers = target.filter((targetPlayer) =>
        targetPlayer.eligible_positions.includes(playerA.selected_position)
      );
      this.logInfo(
        `eligibleTargetPlayers for player ${
          playerA.player_name
        }: ${eligibleTargetPlayers.map((p) => p.player_name)}`
      );

      if (eligibleTargetPlayers.length > 0) {
        for (const playerB of eligibleTargetPlayers) {
          this.logInfo(
            `comparing ${playerA.player_name} ${playerA.start_score} to ${playerB.player_name} ${playerB.start_score}`
          );
          if (playerA.eligible_positions.includes(playerB.selected_position)) {
            if (playerA.start_score <= playerB.start_score) {
              this.logInfo(
                "Need to find a three way swap since sourcePlayer.score < targetPlayer.score"
              );
              const playerC = this.findPlayerC(playerA, playerB, target);
              if (playerC) {
                this.logInfo("Found three way swap");
                swapPlayers(playerA, playerB);
                swapPlayers(playerB, playerC);
                break;
              }
              this.logInfo("No three way swap found");
              this.logInfo("Trying to move playerB to unfilled position");
              const tempPosition = playerB.selected_position;
              const result = this.attemptMoveToUnfilledPosition(playerB);
              if (result) {
                this.movePlayerToPosition(playerA, tempPosition);
                break;
              }
            } else {
              this.logInfo("Direct swap");
              swapPlayers(playerA, playerB);
              break;
            }
          }
        }
      }
      // continue without incrementing i if a swap was made
      // this is to ensure we recheck the player swapped to bench for other swaps
      if (isPlayerASwapped) continue;
      this.logInfo("No swaps for player " + playerA.player_name);
      i++;
      this.logInfo("i: " + i + " source.length: " + source.length);
    }
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

    // TODO: Move this into Roster class
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
      for (const rosterPlayer of this.roster.activeRosterPlayers) {
        if (
          idlePlayer.isEligibleToSwapWith(rosterPlayer) &&
          idlePlayer.start_score > rosterPlayer.start_score
        ) {
          console.error(
            `Suboptimal Lineup: benchPlayer ${idlePlayer.player_name} has a higher score than rosterPlayer ${rosterPlayer.player_name} for team ${this.team.team_key}`
          );
          return false;
        }
      }
    }

    return true;

    // end of verifyOptimization() function

    // TODO: Will we need this in the transferPlayers() function?
    function unfilledActiveRosterPositions() {
      // TODO: Replace this with this.roster.unfilledActiveRosterPositions
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
}
