import { Roster as Roster } from "./Roster";
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

    this.resolveIllegalPlayers(); // do only if we are doing add drop
    this.optimizeReserveToStaringPlayers();

    // TODO: Move all injured players to InactiveList if possible
    // TODO: Add new players from FA if there are empty roster spots

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

  private openOneRosterSpot(forPlayer?: OptimizationPlayer): boolean {
    const unfilledInactivePositions: string[] =
      this.roster.unfilledInactivePositions;
    if (unfilledInactivePositions.length === 0) return false;

    let inactivePlayersOnRoster: OptimizationPlayer[] =
      this.roster.inactiveOnRosterPlayers;
    if (forPlayer) {
      inactivePlayersOnRoster = inactivePlayersOnRoster.filter(
        (player) => forPlayer.start_score > player.start_score
      );
    }
    Roster.sortAscendingByScore(inactivePlayersOnRoster);

    for (const inactivePlayer of inactivePlayersOnRoster) {
      const eligiblePositions: string[] = inactivePlayer.getEligiblePositionsIn(
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

  private movePlayerToUnfilledPositionInTargetList(
    player: OptimizationPlayer,
    unfilledPositionTargetList: string[]
  ): boolean {
    // TODO: check if we every use this method as a list? Or can we just change it to a string return?
    const unfilledPosition: string = player.getEligiblePositionsIn(
      unfilledPositionTargetList
    )[0];
    this.logInfo("unfilledPosition: " + unfilledPosition);

    if (!unfilledPosition) return false;

    this.movePlayerToPosition(player, unfilledPosition);
    return true;
  }

  private moveILPlayerToUnfilledALPosition(
    player: OptimizationPlayer
  ): boolean {
    this.logInfo("numEmptyRosterSpots: " + this.roster.numEmptyRosterSpots);
    if (!player.isInactiveList()) return false;

    if (this.roster.numEmptyRosterSpots === 0) {
      const result = this.openOneRosterSpot(player);
      if (!result) return false;
    }
    this.movePlayerToPosition(player, "BN");
    return true;
  }

  private resolveIllegalPlayers() {
    const illegalPlayers = this.roster.illegalPlayers;
    if (illegalPlayers.length === 0) return;

    //TODO: Shouldn't we vet allEditablePlayers to make sure we can valid swap?
    const allEditablePlayers = this.roster.editablePlayers;
    Roster.sortDescendingByScore(illegalPlayers);
    Roster.sortAscendingByScore(allEditablePlayers);

    this.logInfo(
      "Resolving illegal players:" +
        illegalPlayers.map((p) => p.player_name).join(", ")
    );

    for (const player of illegalPlayers) {
      // an illegalPlayer may have been resolved in a previous swap
      if (!player.isIllegalPosition()) continue;

      let resolved;
      let unfilledPositionTargetList;

      if (player.isInactiveList()) {
        resolved = this.moveILPlayerToUnfilledALPosition(player);
        if (resolved) continue;

        unfilledPositionTargetList = this.roster.unfilledInactivePositions;
      } else {
        unfilledPositionTargetList = this.roster.unfilledActivePositions;
      }

      resolved = this.movePlayerToUnfilledPositionInTargetList(
        player,
        unfilledPositionTargetList
      );
      if (resolved) continue;

      this.attemptIllegalPlayerSwaps(player, allEditablePlayers);
    }
  }

  private attemptIllegalPlayerSwaps(
    playerA: OptimizationPlayer,
    playerBList: OptimizationPlayer[]
  ): boolean {
    for (const playerB of playerBList) {
      if (playerA === playerB) continue;
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
          // TODO: Remove playerB from source list?
          return true;
        }

        const potentialPlayerAPosition = playerB.isActiveRoster()
          ? "BN"
          : playerB.selected_position;
        if (!playerA.eligible_positions.includes(potentialPlayerAPosition))
          return false;

        this.logInfo(
          `attempting to move playerB ${playerB.player_name} to unfilled position`
        );
        const unfilledPositionTargetList =
          playerA.isInactiveList() && this.roster.numEmptyRosterSpots === 0
            ? this.roster.unfilledInactivePositions
            : this.roster.unfilledAllPositions;
        const result = this.movePlayerToUnfilledPositionInTargetList(
          playerB,
          unfilledPositionTargetList
        );
        if (result) {
          this.movePlayerToPosition(playerA, potentialPlayerAPosition);
          return true;
        }
      }
    }
    this.logInfo(`no swaps found for ${playerA.player_name}`);
    return false;
  }

  private optimizeReserveToStaringPlayers() {
    // TODO: This is the magic.
    const reservePlayers = this.roster.reservePlayers;
    const startingPlayers = this.roster.startingPlayers;
    Roster.sortAscendingByScore(reservePlayers);
    Roster.sortAscendingByScore(startingPlayers);
    this.logInfo("reserve: " + reservePlayers.map((p) => p.player_name));
    this.logInfo("starting: " + startingPlayers.map((p) => p.player_name));

    while (reservePlayers.length > 0) {
      const playerA = reservePlayers.pop();
      if (!playerA) break;
      this.logInfo(`playerA: ${playerA.player_name}`);

      if (playerA.isInactiveList()) {
        this.moveILPlayerToUnfilledALPosition(playerA);
      }
      const playerAOptimized = this.movePlayerToUnfilledPositionInTargetList(
        playerA,
        this.roster.unfilledStartingPositions
      );
      if (playerAOptimized) {
        startingPlayers.push(playerA);
        continue;
      }

      const swappedPlayer = this.swapWithStartingPlayers(playerA);
      if (swappedPlayer) {
        reservePlayers.push(swappedPlayer);
        startingPlayers.push(playerA);
        continue;
      }
      this.logInfo(`No swaps for playerA: ${playerA.player_name}`);
    }
  }

  private swapWithStartingPlayers(
    playerA: OptimizationPlayer
  ): OptimizationPlayer | undefined {
    const startingPlayersList = this.roster.startingPlayers;
    if (playerA.hasLowerScoreThanAllPlayersIn(startingPlayersList)) {
      this.logInfo(
        `Player ${playerA.player_name} is worse than all players in target array. Skipping.`
      );
      return undefined;
    }

    const eligibleTargetPlayers =
      playerA.getEligibleTargetPlayers(startingPlayersList);
    this.logInfo(
      `eligibleTargetPlayers for player ${
        playerA.player_name
      }: ${eligibleTargetPlayers.map((p) => p.player_name)}`
    );
    if (eligibleTargetPlayers.length === 0) return undefined;

    for (const playerB of eligibleTargetPlayers) {
      if (
        playerA.start_score > playerB.start_score &&
        playerB.eligible_positions.includes(playerA.selected_position)
      ) {
        this.swapPlayers(playerA, playerB);
        return playerB;
      } else {
        let swappedPlayer = this.threeWaySwap(playerA, playerB);
        if (swappedPlayer) return swappedPlayer;

        swappedPlayer = this.threeWayMoveToUnfilledPosition(playerA, playerB);
        if (swappedPlayer) return swappedPlayer;
      }
    }
    return undefined;
  }

  private threeWayMoveToUnfilledPosition(
    playerA: OptimizationPlayer,
    playerB: OptimizationPlayer
  ): OptimizationPlayer | undefined {
    this.logInfo(
      `attempting to move playerB ${playerB.player_name} to unfilled position, and playerA ${playerA.player_name} to playerB's old position.`
    );
    const unfilledPositionTargetList: string[] = playerA.isInactiveList()
      ? this.roster.unfilledInactivePositions
      : this.roster.unfilledStartingPositions;
    const playerBOriginalPosition = playerB.selected_position;
    const success = this.movePlayerToUnfilledPositionInTargetList(
      playerB,
      unfilledPositionTargetList
    );
    if (success) {
      this.movePlayerToPosition(playerA, playerBOriginalPosition);
      return playerB;
    }
    return undefined;
  }

  private threeWaySwap(
    playerA: OptimizationPlayer,
    playerB: OptimizationPlayer
  ): OptimizationPlayer | undefined {
    this.logInfo("attempting to find a three way swap");
    const playerCTargetList: OptimizationPlayer[] = playerA.isInactiveList()
      ? this.roster.inactiveListPlayers
      : this.roster.startingPlayers;

    const playerC = this.findPlayerC(playerA, playerB, playerCTargetList);
    if (playerC) {
      this.swapPlayers(playerA, playerB);
      this.swapPlayers(playerB, playerC);
      return playerA.isInactiveList() ? playerB : playerC;
    }
    return undefined;
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
      `Finding playerC for playerA: ${playerA.player_name} ${playerA.player_key} ${playerA.start_score}, playerB: ${playerB.player_name} ${playerB.player_key} ${playerB.start_score}`
    );

    // // If we are moving playerA from inactive to active roster, player B will
    // // go to BN as an intermediary step. This ensures that playerA can swap
    // // with anyone, not just players they share an exact position with.

    const playerBPosition =
      playerA.isInactiveList() && playerB.isActiveRoster()
        ? "BN"
        : playerB.selected_position;

    return playersArray.find(
      (playerC: OptimizationPlayer) =>
        playerB.player_key !== playerC.player_key &&
        (optimizeScore
          ? playerA.start_score > playerC.start_score &&
            playerB.start_score > playerC.start_score
          : playerA.player_key !== playerC.player_key) &&
        playerB.eligible_positions.includes(playerC.selected_position) &&
        playerC.eligible_positions.includes(playerA.selected_position) &&
        playerA.eligible_positions.includes(playerBPosition)
    );
  }

  /**
   * A helper function that will do a high level check to see if the lineup is successfully optimized.
   * This function checks for major issues and may miss some of the smaller possible optimizations.
   *
   * @public
   * @return {boolean}
   */
  public isSuccessfullyOptimized(): boolean {
    const unfilledActiveRosterPositions = this.roster.unfilledActivePositions;
    if (unfilledActiveRosterPositions.length > 0) {
      console.error(
        `Suboptimal Lineup: unfilledRosterPositions for team ${this.team.team_key}: ${unfilledActiveRosterPositions}`
      );
      return false;
    }

    const overfilledPositions = this.roster.overfilledPositions;
    if (overfilledPositions.length > 0) {
      console.error(
        `Illegal Lineup: Too many players at positions: ${overfilledPositions} for team ${this.team.team_key}`
      );
      return false;
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

    for (const reservePlayer of this.roster.reservePlayers) {
      for (const startingPlayer of this.roster.startingPlayers) {
        if (
          reservePlayer.isEligibleToSwapWith(startingPlayer) &&
          reservePlayer.start_score > startingPlayer.start_score
        ) {
          console.error(
            `Suboptimal Lineup: reservePlayer ${reservePlayer.player_name} has a higher score than startingPlayer ${startingPlayer.player_name} for team ${this.team.team_key}`
          );
          return false;
        }
      }
    }

    return true;
  }
}
