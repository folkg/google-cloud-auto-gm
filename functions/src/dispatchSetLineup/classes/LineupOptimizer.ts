import { logger } from "firebase-functions";
import { ITeam } from "../interfaces/ITeam";
import { LineupChanges } from "../interfaces/LineupChanges";
import { PlayerTransaction } from "../interfaces/PlayerTransaction";
import { Player } from "./Player";
import { Team } from "./Team";

export class LineupOptimizer {
  private team: Team;
  private originalPlayerPositions: { [key: string]: string };
  private deltaPlayerPositions: { [key: string]: string } = {};
  private playerTransactions: PlayerTransaction[] = [];

  public verbose = false;
  private logInfo(...args: any[]) {
    if (this.verbose) logger.info(...args);
  }

  constructor(team: ITeam) {
    this.team = new Team(team);
    this.originalPlayerPositions = this.createPlayerPositionDictionary(
      this.team.editablePlayers
    );
  }

  public getCurrentTeamState(): ITeam {
    return this.team.toITeamObject();
  }

  public findDropPlayerTransactions(): PlayerTransaction[] {
    // find drops by attempting to move healthy players off IL unsuccessfully
    this.resolveHealthyPlayersOnIL();
    // Separate functions for add players and add/drop players
    // TODO: Call this.openOneRosterSpot() with no args in loop until false is returned
    // TODO: Call addNewPlayersFromFA() if there are empty roster spots now freed by the above
    // Any players added by the above will be available for the next round of swaps
    // TODO: Call this.optimizeReserveToStaringPlayers() again? How does optimizer use the free roster spots? We don't want to add new players to the starting lineup if we can avoid it and they will be needed by the optimizer
    return this.playerTransactions;
  }

  findAddPlayerTransactions(): PlayerTransaction[] {
    throw new Error("Method not implemented.");
  }

  public optimizeStartingLineup(): LineupChanges {
    if (this.team.editablePlayers.length === 0) {
      this.logInfo(`no players to optimize for team ${this.team.team_key}`);
      return this.formatLineupChange();
    }

    this.resolveAllIllegalPlayers();
    this.optimizeReserveToStaringPlayers();

    this.deltaPlayerPositions = this.diffPlayerPositionDictionary(
      this.originalPlayerPositions,
      this.createPlayerPositionDictionary(this.team.editablePlayers)
    );

    // Return the roster modification object if there are changes
    return this.formatLineupChange();
  }

  private formatLineupChange(): LineupChanges {
    return {
      teamKey: this.team.team_key,
      coverageType: this.team.coverage_type,
      coveragePeriod: this.team.coverage_period,
      newPlayerPositions: this.deltaPlayerPositions,
    };
  }

  private createPlayerPositionDictionary(players: Player[]) {
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

  private resolveHealthyPlayersOnIL(): void {
    const healthyPlayersOnIL = this.team.healthyOnIL;
    if (healthyPlayersOnIL.length === 0) return;

    Team.sortDescendingByScore(healthyPlayersOnIL);
    for (const player of healthyPlayersOnIL) {
      const success = this.resolveIllegalPlayer(player);
      if (!success) {
        this.dropPlayerFromRoster(player);
      }
    }
  }

  private resolveAllIllegalPlayers(): void {
    const illegalPlayers = this.team.illegalPlayers;
    if (illegalPlayers.length === 0) return;

    Team.sortDescendingByScore(illegalPlayers);
    this.logInfo(
      `Resolving illegal players: ${illegalPlayers
        .map((p) => p.player_name)
        .join(", ")}`
    );
    for (const player of illegalPlayers) {
      this.resolveIllegalPlayer(player);
    }
  }

  private resolveIllegalPlayer(player: Player): boolean {
    this.logInfo(`Resolving illegal player: ${player.player_name}`);
    // an illegalPlayer may have been resolved in a previous swap
    if (!player.isIllegalPosition()) return true;

    let success;
    let unfilledPositionTargetList;

    if (player.isInactiveList()) {
      success = this.moveILPlayerToUnfilledALPosition(player);
      if (success) return true;

      unfilledPositionTargetList = this.team.unfilledInactivePositions;
    } else {
      unfilledPositionTargetList = this.team.unfilledActivePositions;
    }

    success = this.movePlayerToUnfilledPositionInTargetList(
      player,
      unfilledPositionTargetList
    );
    if (success) return true;

    success = this.attemptIllegalPlayerSwaps(player);
    if (success) return true;

    return false;
  }

  private attemptIllegalPlayerSwaps(playerA: Player): boolean {
    const allEditablePlayers = this.team.editablePlayers;
    Team.sortAscendingByScore(allEditablePlayers);

    if (allEditablePlayers.length === 0) return false;

    for (const playerB of allEditablePlayers) {
      this.logInfo(
        `comparing ${playerA.player_name} to ${playerB.player_name}`
      );

      if (playerA.isEligibleToSwapWith(playerB)) {
        this.swapPlayers(playerA, playerB);
        return true;
      } else {
        const success = this.threeWaySwapIllegalPlayer(playerA, playerB);
        if (success) return true;

        this.threeWayMoveIllegalToUnfilledPosition(playerA, playerB);
      }
    }
    this.logInfo(`no swaps found for ${playerA.player_name}`);
    return false;
  }

  private threeWayMoveIllegalToUnfilledPosition(
    playerA: Player,
    playerB: Player
  ) {
    const potentialPlayerAPosition = playerB.isActiveRoster()
      ? "BN"
      : playerB.selected_position;

    if (!playerA.eligible_positions.includes(potentialPlayerAPosition)) return;

    this.logInfo(
      `attempting to move playerB ${playerB.player_name} to unfilled position`
    );
    const illegalPlayerACannotMoveToOpenRosterSpot =
      playerA.isInactiveList() && this.team.numEmptyRosterSpots === 0;

    const unfilledPositionTargetList = illegalPlayerACannotMoveToOpenRosterSpot
      ? this.team.unfilledInactivePositions
      : this.team.unfilledAllPositions;
    const success = this.movePlayerToUnfilledPositionInTargetList(
      playerB,
      unfilledPositionTargetList
    );
    if (success) {
      this.movePlayerToPosition(playerA, potentialPlayerAPosition);
    }
  }
  private threeWaySwapIllegalPlayer(playerA: Player, playerB: Player): boolean {
    this.logInfo("attempting to find a three way swap");
    const playerC = this.findPlayerCforIllegalPlayerA(
      playerA,
      playerB,
      this.team.editablePlayers
    );
    if (playerC) {
      this.logInfo("three-way swap found!");
      if (playerA.isInactiveList() && playerB.isActiveRoster()) {
        this.movePlayerToPosition(playerB, "BN");
      }
      this.swapPlayers(playerA, playerB);
      this.swapPlayers(playerB, playerC);
      return true;
    }
    return false;
  }

  private optimizeReserveToStaringPlayers(): void {
    const reservePlayers = this.team.reservePlayers;
    Team.sortAscendingByScore(reservePlayers);
    this.logInfo(
      `reserve players: ${reservePlayers.map((p) => p.player_name)}`
    );

    while (reservePlayers.length > 0) {
      const playerA = reservePlayers.pop();
      if (!playerA) break;
      if (playerA.isStartingRoster()) continue;
      this.logInfo(`playerA: ${playerA.player_name}`);

      let proceedToLookForUnfilledPositionInStarters = true;
      if (playerA.isInactiveList()) {
        proceedToLookForUnfilledPositionInStarters =
          this.moveILPlayerToUnfilledALPosition(playerA);
      }
      const success =
        proceedToLookForUnfilledPositionInStarters &&
        this.movePlayerToUnfilledPositionInTargetList(
          playerA,
          this.team.unfilledStartingPositions
        );

      if (success) {
        continue;
      }

      const playerMovedToReserve = this.swapWithStartingPlayers(playerA);
      if (playerMovedToReserve) {
        // if a player was swapped back into the reserve list, we need to
        // re-evaluate the player we just swapped to see if it can be moved back
        reservePlayers.push(playerMovedToReserve);
      } else this.logInfo(`No swaps for playerA: ${playerA.player_name}`);
    }
  }

  private swapWithStartingPlayers(playerA: Player): Player | undefined {
    const eligibleTargetPlayers = this.getEliglibleStartingPlayers(playerA);
    if (!eligibleTargetPlayers || eligibleTargetPlayers.length === 0)
      return undefined;

    for (const playerB of eligibleTargetPlayers) {
      if (playerA.isEligibleAndHigherScoreThan(playerB)) {
        this.swapPlayers(playerA, playerB);
        return playerB;
      } else {
        let playerMovedToReserve = this.threeWaySwap(playerA, playerB);
        if (playerMovedToReserve) return playerMovedToReserve;

        playerMovedToReserve = this.threeWayMoveToUnfilledPosition(
          playerA,
          playerB
        );
        // only return playerB to go back into the reserve list if it was moved to the IL
        if (playerMovedToReserve?.isInactiveList()) return playerMovedToReserve;
        if (playerMovedToReserve?.isStartingRoster()) return undefined;
      }
    }
    return undefined;
  }

  private getEliglibleStartingPlayers(playerA: Player): Player[] | undefined {
    const startingPlayersList = this.team.startingPlayers;
    Team.sortAscendingByScore(startingPlayersList);

    if (playerA.hasLowerStartScoreThanAll(startingPlayersList)) {
      this.logInfo(
        `Player ${playerA.player_name} ${playerA.start_score} is worse than all players in target array. Skipping.`
      );
      return undefined;
    }

    const result = playerA.getEligibleTargetPlayers(startingPlayersList);
    this.logInfo(
      `eligibleTargetPlayers for player ${playerA.player_name}: ${result.map(
        (p) => p.player_name
      )}`
    );
    return result;
  }

  private threeWayMoveToUnfilledPosition(
    playerA: Player,
    playerB: Player
  ): Player | undefined {
    this.logInfo(
      `attempting to move playerB ${playerB.player_name} to unfilled position, and playerA ${playerA.player_name} to playerB's old position.`
    );
    const unfilledPositionTargetList: string[] = playerA.isInactiveList()
      ? this.team.unfilledInactivePositions
      : this.team.unfilledStartingPositions;
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

  private threeWaySwap(playerA: Player, playerB: Player): Player | undefined {
    this.logInfo("attempting to find a three way swap");
    const playerCTargetList: Player[] = playerA.isInactiveList()
      ? this.team.inactiveListEligiblePlayers
      : this.team.startingPlayers;

    const playerC = this.findPlayerCforOptimization(
      playerA,
      playerB,
      playerCTargetList
    );
    if (playerC) {
      this.swapPlayers(playerA, playerB);
      this.swapPlayers(playerB, playerC);
      return playerA.isInactiveList() ? playerB : playerC;
    }
    return undefined;
  }

  private movePlayerToPosition(player: Player, position: string): void {
    this.logInfo(`moving player ${player.player_name} to position ${position}`);
    player.selected_position = position;
  }

  private swapPlayers(playerA: Player, playerB: Player): void {
    this.logInfo(
      `swapping ${playerA.player_name} ${playerA.selected_position} with ${playerB.player_name} ${playerB.selected_position}`
    );
    const temp = playerB.selected_position;
    this.movePlayerToPosition(playerB, playerA.selected_position);
    this.movePlayerToPosition(playerA, temp);
  }

  private openOneRosterSpot(playerToOpenSpotFor?: Player): boolean {
    const unfilledInactivePositions: string[] =
      this.team.unfilledInactivePositions;
    if (unfilledInactivePositions.length === 0) return false;

    let inactivePlayersOnRoster: Player[] = this.team.inactiveOnRosterPlayers;
    if (playerToOpenSpotFor) {
      inactivePlayersOnRoster = inactivePlayersOnRoster.filter(
        (player) => playerToOpenSpotFor.start_score > player.start_score
      );
    }
    Team.sortAscendingByScore(inactivePlayersOnRoster);

    for (const inactivePlayer of inactivePlayersOnRoster) {
      const eligiblePosition = inactivePlayer.findEligiblePositionIn(
        unfilledInactivePositions
      );
      if (eligiblePosition) {
        this.logInfo(
          `freeing up one roster spot: ${inactivePlayer.selected_position}`
        );
        this.movePlayerToPosition(inactivePlayer, eligiblePosition);
        return true;
      }
    }

    return false;
  }

  /**
   * Drops the lowest scoring player that is not undroppable or in a critical
   * position. If playerToOpenSpotFor is provided, it will only drop players
   * that have a lower ownership score than playerToOpenSpotFor.
   *
   * This function will not immediately drop the player, but will instead add a
   * transaction to the transaction list to be processed by the caller.
   *
   *
   * @param {Player} playerToOpenSpotFor
   */
  private dropPlayerFromRoster(playerToOpenSpotFor: Player): void {
    const playerToDrop = this.getPlayerToDrop(playerToOpenSpotFor);
    this.logInfo(`playerToDrop: ${playerToDrop.player_name}`);

    if (playerToDrop === playerToOpenSpotFor) return;
    if (!playerToDrop.ownership_score) return; // in case of Yahoo API error

    const pt: PlayerTransaction = {
      teamKey: this.team.team_key,
      sameDayTransactions: this.team.sameDayTransactions,
      players: [
        {
          playerKey: playerToDrop.player_key,
          transactionType: "drop",
        },
      ],
    };
    this.playerTransactions.push(pt);
    this.logInfo(
      `Added a new transaction from dropPlayerToWaivers: ${JSON.stringify(pt)}`
    );
  }

  private getPlayerToDrop(playerToOpenSpotFor: Player) {
    return this.team.allPlayers
      .filter(
        (player) =>
          !player.is_undroppable &&
          !this.isTooLateToDrop(player) &&
          !this.getAlreadyDroppedPlayers().includes(player.player_key) &&
          !player.eligible_positions.some((position) =>
            this.team.criticalPositions.includes(position)
          )
      )
      .reduce(
        (prevPlayer, currPlayer) =>
          prevPlayer.ownership_score < currPlayer.ownership_score
            ? prevPlayer
            : currPlayer,
        playerToOpenSpotFor
      );
  }

  private isTooLateToDrop(player: Player) {
    return this.team.sameDayTransactions && !player.is_editable;
  }

  private getAlreadyDroppedPlayers() {
    return this.playerTransactions
      .flatMap((transaction) => transaction.players)
      .filter((player) => player.transactionType === "drop")
      .map((player) => player.playerKey);
  }

  private movePlayerToUnfilledPositionInTargetList(
    player: Player,
    unfilledPositionTargetList: string[]
  ): boolean {
    const unfilledPosition = player.findEligiblePositionIn(
      unfilledPositionTargetList
    );
    this.logInfo(`unfilledPosition: ${unfilledPosition}`);

    if (!unfilledPosition) return false;

    this.movePlayerToPosition(player, unfilledPosition);
    return true;
  }

  private moveILPlayerToUnfilledALPosition(player: Player): boolean {
    this.logInfo(`numEmptyRosterSpots ${this.team.numEmptyRosterSpots}`);
    if (!player.isInactiveList()) return false;

    if (this.team.numEmptyRosterSpots === 0) {
      const success = this.openOneRosterSpot(player);
      if (!success) return false;
    }
    this.movePlayerToPosition(player, "BN");
    return true;
  }

  /**
   * Find a list of third players, playerC, who is eligible to facilitate a
   * three-way swap between playerA and playerB. Return undefined if none found
   *
   * This finds a left-hand rotation swap, i.e. player A ->B -> C
   *
   * @private
   * @param {Player} playerA - player to be swapped out
   * @param {Player} playerB - player to be swapped in
   * @param {Player[]} playersArray - array of players to search for playerC
   * @return {(Player[] | undefined)} playerC or undefined if not found
   */
  private getPotentialPlayerCList(
    playerA: Player,
    playerB: Player,
    playersArray: Player[]
  ): Player[] | undefined {
    this.logInfo(
      `Finding playerC for playerA: ${playerA.player_name} ${playerA.player_key} ${playerA.selected_position} ${playerA.start_score}, playerB: ${playerB.player_name} ${playerB.player_key} ${playerB.selected_position} ${playerB.start_score}`
    );

    // If we are moving playerA from inactive to active roster, player B will
    // go to BN as an intermediary step. This ensures that playerA can swap
    // with anyone, not just players they share an exact position with.

    const playerBPosition =
      playerA.isInactiveList() && playerB.isActiveRoster()
        ? "BN"
        : playerB.selected_position;

    return playersArray.filter(
      (playerC: Player) =>
        playerB !== playerC &&
        playerA !== playerC &&
        playerB.eligible_positions.includes(playerC.selected_position) &&
        playerC.eligible_positions.includes(playerA.selected_position) &&
        playerA.eligible_positions.includes(playerBPosition) &&
        playerC.selected_position !== playerA.selected_position
    );
  }

  private findPlayerCforIllegalPlayerA(
    playerA: Player,
    playerB: Player,
    playersArray: Player[]
  ) {
    return this.getPotentialPlayerCList(playerA, playerB, playersArray)?.at(0);
  }

  private findPlayerCforOptimization(
    playerA: Player,
    playerB: Player,
    playersArray: Player[]
  ): Player | undefined {
    return this.getPotentialPlayerCList(playerA, playerB, playersArray)?.find(
      (playerC: Player) =>
        playerA.start_score > playerC.start_score &&
        playerB.start_score > playerC.start_score
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
    let result = true;
    result = this.checkForUnfilledRosterPositions() && result;
    result = this.checkForOverfilledRosterPositions() && result;
    result = this.checkForIllegallyMovedPlayers() && result;
    result = this.checkForSuboptimalLineup() && result;
    return result;
  }

  private checkForUnfilledRosterPositions(): boolean {
    const unfilledActiveRosterPositions = this.team.unfilledActivePositions;
    const reservePlayersEligibleForUnfilledPositions =
      this.team.reservePlayers.filter(
        (player) =>
          player.isActiveRoster() &&
          player.eligible_positions.some((position) =>
            unfilledActiveRosterPositions.includes(position)
          )
      );
    if (reservePlayersEligibleForUnfilledPositions.length > 0) {
      logger.error(
        `Suboptimal Lineup: unfilledRosterPositions for team ${this.team.team_key}: ${unfilledActiveRosterPositions}`,
        reservePlayersEligibleForUnfilledPositions,
        this.team,
        { deltaPlayerPositions: this.deltaPlayerPositions }
      );
      return false;
    }
    return true;
  }

  private checkForOverfilledRosterPositions(): boolean {
    const overfilledPositions = this.team.overfilledPositions;
    if (overfilledPositions.length > 0) {
      logger.error(
        `Illegal Lineup: Too many players at positions: ${overfilledPositions} for team ${this.team.team_key}`,
        this.team,
        { deltaPlayerPositions: this.deltaPlayerPositions }
      );
      return false;
    }
    return true;
  }
  private checkForIllegallyMovedPlayers(): any {
    const illegallyMovedPlayers = Object.keys(this.deltaPlayerPositions).filter(
      (movedPlayerKey) =>
        this.team.illegalPlayers.some(
          (illegalPlayer) => illegalPlayer.player_key === movedPlayerKey
        )
    );
    if (illegallyMovedPlayers.length > 0) {
      logger.error(
        `Illegal Lineup: illegalPlayers moved for team ${this.team.team_key}: ${illegallyMovedPlayers}`,
        this.team,
        { deltaPlayerPositions: this.deltaPlayerPositions }
      );
      return false;
    }
    return true;
  }
  private checkForSuboptimalLineup(): any {
    const suboptimalLineup = this.team.reservePlayers.some((reservePlayer) =>
      this.team.startingPlayers.some((startingPlayer) =>
        reservePlayer.isEligibleAndHigherScoreThan(startingPlayer)
      )
    );
    if (suboptimalLineup) {
      logger.error(
        `Suboptimal Lineup: reservePlayers have higher scores than startingPlayers for team ${this.team.team_key}`,
        this.team,
        { deltaPlayerPositions: this.deltaPlayerPositions }
      );
      return false;
    }
    return true;
  }
}
