import { getChild, getNow } from "../../common/services/utilities.service";
import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { ITeamOptimizer } from "../../common/interfaces/ITeam";
import { ownershipScoreFunction } from "../services/playerOwnershipScoreFunctions.service";
import { playerStartScoreFunctionFactory } from "../services/playerStartScoreFunctions.service";
import { Player } from "./Player";
import assert from "assert";

// use declaration merging to add the players property as a Player object to the ITeam interface and the Team class
export interface Team extends ITeamOptimizer {
  players: Player[];
}
export class Team implements Team {
  private _editablePlayers: Player[];
  private _pendingAddDropDifferential = 0;

  constructor(team: ITeamOptimizer) {
    const teamCopy = structuredClone(team) as Team;
    teamCopy.players = teamCopy.players.map((player) => new Player(player));
    Object.assign(this, teamCopy);

    this._editablePlayers = this.players.filter((player) => player.is_editable);

    const numPlayersInLeague = this.num_teams * this.numStandardRosterSpots;

    const playerStartScoreFunction = playerStartScoreFunctionFactory({
      gameCode: this.game_code,
      weeklyDeadline: this.weekly_deadline,
      numPlayersInLeague,
      seasonTimeProgress:
        (getNow() - this.start_date) / (this.end_date - this.start_date),
      gamesPlayed: this.games_played,
      inningsPitched: this.innings_pitched,
    });

    this.players.forEach((player) => {
      player.start_score = playerStartScoreFunction(player);
      player.ownership_score = ownershipScoreFunction(
        player,
        numPlayersInLeague
      );
      player.eligible_positions.push("BN"); // not included by default in Yahoo
    });

    if (this.games_played) {
      this.artificiallyReduceRosterSpots();
    }
    this.processPendingTransactions();
    // console.log(
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

  private artificiallyReduceRosterSpots() {
    assert(this.games_played !== undefined);
    const BUFFER = 0.015;
    for (const position of this.games_played) {
      // Use a 1.5% buffer to allow for some day-to-day variance
      // Results in an 83.23 roster spot requirement for 82 games max, or 164.43 for 162 games max
      if (
        position.games_played.projected >
        position.games_played.max * (1 + BUFFER)
      ) {
        this.reduceAvailableRosterSpots(position.position, 1);
      }
    }
    if (this.innings_pitched !== undefined) {
      if (
        this.innings_pitched.projected >
        this.innings_pitched.max * (1 + BUFFER)
      ) {
        this.reduceAvailableRosterSpots("P", 1) ||
          this.reduceAvailableRosterSpots("RP", 1) ||
          this.reduceAvailableRosterSpots("SP", 1);
      }
    }
  }

  private reduceAvailableRosterSpots(position: string, quantity = 1): boolean {
    if (
      !INACTIVE_POSITION_LIST.includes(position) &&
      this.roster_positions[position] !== undefined
    ) {
      const reduction = Math.min(quantity, this.roster_positions[position]);
      this.roster_positions[position] -= reduction;
      this.roster_positions["BN"] += reduction;
      return true;
    }
    return false;
  }

  private processPendingTransactions(): void {
    this.transactions?.forEach((transaction) => {
      const playersObject = getChild(transaction, "players");
      const isPendingTransaction =
        getChild(transaction, "status") === "pending";

      for (const key in playersObject) {
        if (key !== "count") {
          const playerInTransaction = playersObject[key].player;
          this.makeTransactionPlayerILInelligible(playerInTransaction);
          // only count for officially "pending" transactions, not "proposed" trades
          if (isPendingTransaction) {
            this.changePendingAddDrops(playerInTransaction);
          }
        }
      }
    });
  }

  private changePendingAddDrops(playerInTransaction: any) {
    // sometimes transaction_data is an array of size 1, sometimes just the object. Why, Yahoo?
    let transactionData = getChild(playerInTransaction, "transaction_data");
    if (Array.isArray(transactionData)) {
      transactionData = transactionData[0];
    }
    const isAddingPlayer =
      transactionData.destination_team_key === this.team_key;
    this._pendingAddDropDifferential += isAddingPlayer ? 1 : -1;
  }

  private makeTransactionPlayerILInelligible(playerInTransaction: any) {
    const matchingTeamPlayer = this.players.find(
      (player) =>
        player.player_key === getChild(playerInTransaction[0], "player_key")
    );

    // Don't make a player ineligible if they are already on the IL
    if (matchingTeamPlayer?.isInactiveList()) return;

    matchingTeamPlayer?.makeInelliglbeForIL();
  }

  public get pendingAddDropDifferential() {
    return this._pendingAddDropDifferential;
  }

  /**
   * Returns a deep clone of the team as an ITeam object
   *
   * @public
   * @return {ITeamOptimizer}
   */
  public toITeamObject(): ITeamOptimizer {
    const { _editablePlayers, ...team } = this;
    return structuredClone(team) as ITeamOptimizer;
  }

  /**
   * Sorts players in place by score, lowest to highest
   *
   * @static
   * @param {Player[]} players - array of players to sort
   * @return {Player[]} - sorted array of players
   */
  static sortAscendingByScore(players: Player[]): Player[] {
    return players.sort((a, b) => a.start_score - b.start_score);
  }

  /**
   * Sorts players in place by score, highest to lowest
   *
   * @static
   * @param {Player[]} players - array of players to sort
   * @return {Player[]} - sorted array of players
   */
  static sortDescendingByScore(players: Player[]): Player[] {
    return players.sort((a, b) => b.start_score - a.start_score);
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

  public get unfilledPositionCounter(): { [key: string]: number } {
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

  public get unfilledStartingPositions(): string[] {
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
    }, -this.pendingAddDropDifferential);
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

  public getPlayersAt(position: string): Player[] {
    return this._editablePlayers.filter(
      (player) => player.selected_position === position
    );
  }
}
