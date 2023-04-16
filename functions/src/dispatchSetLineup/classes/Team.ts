// import { logger } from "firebase-functions";
import { getChild } from "../../common/services/utilities.service";
import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { ITeam } from "../interfaces/ITeam";
import { ownershipScoreFunction } from "../services/playerOwnershipScoreFunctions.service";
import { playerStartScoreFunctionFactory } from "../services/playerStartScoreFunctions.service";
import { Player } from "./Player";

// use declaration merging to add the players property as a Player object to the ITeam interface and the Team class
export interface Team extends ITeam {
  players: Player[];
}
export class Team implements Team {
  private _editablePlayers: Player[];
  private pendingTransactionCount: { [key: string]: number } = {};

  constructor(team: ITeam) {
    // TODO: Change Team to ITeam everywhere
    // get rid of the team property in LineupOptimizer and just use this Roster object.
    // return the .toTeam() method from the LineupOptimizer
    const teamCopy = structuredClone(team) as Team;
    teamCopy.players = teamCopy.players.map((player) => new Player(player));
    Object.assign(this, teamCopy);

    this._editablePlayers = this.players.filter((player) => player.is_editable);

    const playerStartScoreFunction = playerStartScoreFunctionFactory(
      this.game_code,
      this.weekly_deadline
    );

    this.players.forEach((player) => {
      player.start_score = playerStartScoreFunction(player);
      player.ownership_score = ownershipScoreFunction(
        player,
        this.num_teams * this.numStandardRosterSpots
      );
      player.eligible_positions.push("BN"); // not included by default in Yahoo
    });
    this.processPendingTransactions();
    // logger.log(
    //   this._allPlayers
    //     .sort((a, b) => b.ownership_score - a.ownership_score)
    //     .map(
    //       (player) =>
    //         player.player_name +
    //         " " +
    //         player.ownership_score +
    //         " " +
    //         player.percent_owned
    //     )
    // );
  }

  private processPendingTransactions(): void {
    this.transactions?.forEach((transaction) => {
      // TODO: Is this what an accepted trade looks like too? "proposed" is all I have seen so far.
      const isPendingTransaction =
        getChild(transaction, "status") === "pending";
      const playersObject = getChild(transaction, "players");

      for (const key in playersObject) {
        if (key !== "count") {
          if (isPendingTransaction) {
            // TODO: If a player is in a proposed trade, can they be added to the IL? Is his inside or outside the IF?
            const playerInTransaction = playersObject[key];
            this.makeTransactionPlayerILInnelligible(playerInTransaction);

            // only count for officially "pending" transactions, not "proposed" trades
            this.countPendingAddDrops(playerInTransaction);
          }
        }
      }
    });
  }

  private countPendingAddDrops(playerInTransaction: any) {
    const isAddingPlayer =
      getChild(playerInTransaction.player, "transaction_data")
        .destination_team_key === this.team_key;
    const transactionType = isAddingPlayer ? "add" : "drop";
    this.pendingTransactionCount[transactionType] =
      (this.pendingTransactionCount[transactionType] || 0) + 1;
  }

  private makeTransactionPlayerILInnelligible(playerInTransaction: any) {
    const matchingTeamPlayer = this.players.find(
      (player) =>
        player.player_key ===
        getChild(playerInTransaction.player[0], "player_key")
    );
    matchingTeamPlayer?.makeInelliglbeForIL();
  }

  /**
   * Returns a deep clone of the team as an ITeam object
   *
   * @public
   * @return {ITeam}
   */
  public toITeamObject(): ITeam {
    const { _editablePlayers, ...team } = this;
    return structuredClone(team) as ITeam;
  }

  /**
   * Sorts players in place by score, lowest to highest
   *
   * @static
   * @param {Player[]} players - array of players to sort
   */
  static sortAscendingByScore(players: Player[]) {
    players.sort((a, b) => a.start_score - b.start_score);
  }

  /**
   * Sorts players in place by score, highest to lowest
   *
   * @static
   * @param {Player[]} players - array of players to sort
   */
  static sortDescendingByScore(players: Player[]) {
    players.sort((a, b) => b.start_score - a.start_score);
  }

  public get sameDayTransactions(): boolean {
    return (
      (this.weekly_deadline === "" || this.weekly_deadline === "intraday") &&
      this.edit_key === this.coverage_period
    );
  }

  // alias for players
  public get allPlayers(): Player[] {
    return this.players;
  }

  public get editablePlayers(): Player[] {
    return this._editablePlayers;
  }

  public get illegalPlayers(): Player[] {
    return this._editablePlayers.filter(
      (player) => !player.eligible_positions.includes(player.selected_position)
    );
  }

  public get startingPlayers(): Player[] {
    return this._editablePlayers.filter(
      (player) =>
        !INACTIVE_POSITION_LIST.includes(player.selected_position) &&
        player.selected_position !== "BN"
    );
  }

  /**
   * players on the reserve list, which includes players on the inactive list
   * and players on the bench
   *
   * @public
   * @readonly
   * @type {Player[]}
   */
  public get reservePlayers(): Player[] {
    return this._editablePlayers.filter((player) => player.isReservePlayer());
  }

  public get inactiveListEligiblePlayers(): Player[] {
    return this._editablePlayers.filter((player) =>
      player.isInactiveListEligible()
    );
  }

  public get inactiveOnRosterPlayers(): Player[] {
    return this._editablePlayers.filter(
      (player) =>
        player.isActiveRoster() &&
        player.eligible_positions.some((position) =>
          INACTIVE_POSITION_LIST.includes(position)
        )
    );
  }

  public get healthyOnIL(): Player[] {
    return this._editablePlayers.filter(
      (player) => player.isHealthy() && player.isInactiveList()
    );
  }

  private get unfilledPositionCounter(): { [key: string]: number } {
    const result = { ...this.roster_positions };
    this.players.forEach((player) => {
      result[player.selected_position]--;
    });
    return result;
  }

  public get unfilledAllPositions(): string[] {
    return Object.keys(this.unfilledPositionCounter).filter(
      (position) => this.unfilledPositionCounter[position] > 0
    );
  }

  public get unfilledActivePositions(): string[] {
    return Object.keys(this.unfilledPositionCounter).filter(
      (position) =>
        position !== "BN" &&
        !INACTIVE_POSITION_LIST.includes(position) &&
        this.unfilledPositionCounter[position] > 0
    );
  }

  public get unfilledInactivePositions(): string[] {
    return Object.keys(this.unfilledPositionCounter).filter(
      (position) =>
        INACTIVE_POSITION_LIST.includes(position) &&
        this.unfilledPositionCounter[position] > 0
    );
  }

  public get unfilledStartingPositions(): string[] {
    return Object.keys(this.unfilledPositionCounter).filter(
      (position) =>
        position !== "BN" &&
        !INACTIVE_POSITION_LIST.includes(position) &&
        this.unfilledPositionCounter[position] > 0
    );
  }

  public get overfilledPositions(): string[] {
    return Object.keys(this.unfilledPositionCounter).filter(
      (position) =>
        position !== "BN" && this.unfilledPositionCounter[position] < 0
    );
  }

  public get numEmptyRosterSpots(): number {
    const unfilledPositions = this.unfilledPositionCounter;
    return Object.keys(unfilledPositions).reduce((acc, position) => {
      if (!INACTIVE_POSITION_LIST.includes(position))
        acc += unfilledPositions[position];
      return acc;
    }, 0);
  }

  public get numStandardRosterSpots(): number {
    return Object.keys(this.roster_positions).reduce((acc, position) => {
      if (!INACTIVE_POSITION_LIST.includes(position))
        acc += this.roster_positions[position];
      return acc;
    }, 0);
  }

  public get criticalPositions(): string[] {
    return Object.keys(this.roster_positions).filter((position) => {
      const playersAtPosition = this.players.filter((player) =>
        player.eligible_positions.includes(position)
      );
      return (
        !INACTIVE_POSITION_LIST.includes(position) &&
        playersAtPosition.length <= this.roster_positions[position]
      );
    });
  }

  public get positionalScores() {
    return Object.keys(this.roster_positions).map((position) => {
      const positionScore = this.players.reduce((acc, player) => {
        if (player.eligible_positions.includes(position))
          acc += player.ownership_score;
        return acc;
      }, 0);
      return { position: positionScore };
    });
  }
}
