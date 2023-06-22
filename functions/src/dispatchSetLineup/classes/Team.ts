import assert from "assert";
import { ITeamOptimizer } from "../../common/interfaces/ITeam.js";
import {
  getChild,
  getNow,
  getProgressBetween,
  getWeeklyProgressPacific,
} from "../../common/services/utilities.service.js";
import { INACTIVE_POSITION_LIST } from "../helpers/constants.js";
import { ownershipScoreFunctionFactory } from "../services/playerOwnershipScoreFunctions.service.js";
import { playerStartScoreFunctionFactory } from "../services/playerStartScoreFunctions.service.js";
import { Player } from "./Player.js";
import { PlayerCollection } from "./PlayerCollection.js";

// use declaration merging to add the players property as a Player object to the ITeam interface and the Team class
export interface Team extends ITeamOptimizer {
  players: Player[];
}
export class Team extends PlayerCollection implements Team {
  private _editablePlayers: Player[];
  private _submittedAddDropDifferential = 0;
  private _pendingAddPlayers: Map<string, string[]> = new Map();
  private _pendingDropPlayers: Map<string, string[]> = new Map();
  private _lockedPlayers: Set<string> = new Set();
  private _numNewAdds = 0;

  constructor(team: ITeamOptimizer) {
    super(team.players);

    const teamCopy: Team = structuredClone(team) as Team;
    teamCopy.players = this.players;
    Object.assign(this, teamCopy);

    this._editablePlayers = this.players.filter((player) => player.is_editable);

    this.ownershipScoreFunction = ownershipScoreFunctionFactory(
      this.num_teams * this.numStandardRosterSpots
    );

    const playerStartScoreFunction = playerStartScoreFunctionFactory({
      gameCode: this.game_code,
      weeklyDeadline: this.weekly_deadline,
      ownershipScoreFunction: this.ownershipScoreFunction,
      seasonTimeProgress:
        (getNow() - this.start_date) / (this.end_date - this.start_date),
      gamesPlayed: this.games_played,
      inningsPitched: this.innings_pitched,
    });
    this.players.forEach((player) => {
      player.start_score = playerStartScoreFunction(player);
    });

    if (this.games_played) {
      this.artificiallyReduceRosterSpots();
    }

    this.processPendingTransactions();
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
          this.makeTransactionPlayerInelligible(playerInTransaction);
          this.changePendingAddDrops(isPendingTransaction, playerInTransaction);
        }
      }
    });
  }

  private makeTransactionPlayerInelligible(playerInTransaction: any) {
    const matchingTeamPlayer = this.players.find(
      (player) =>
        player.player_key === getChild(playerInTransaction[0], "player_key")
    );

    if (!matchingTeamPlayer?.isInactiveList()) {
      matchingTeamPlayer?.makeInelliglbeForIL();
    }
  }

  private changePendingAddDrops(
    isPendingTransaction: boolean,
    playerInTransaction: any
  ) {
    const playerKey = getChild(playerInTransaction[0], "player_key");
    const eligiblePositions = getChild(
      playerInTransaction[0],
      "display_position"
    ).split(",");
    // sometimes transaction_data is an array of size 1, sometimes just the object. Why, Yahoo?
    let transactionData = getChild(playerInTransaction, "transaction_data");
    if (Array.isArray(transactionData)) {
      transactionData = transactionData[0];
    }

    const isAddingPlayer =
      transactionData.destination_team_key === this.team_key;

    // only adjust pendingAddDropDifferential count for officially "pending" transactions, not "proposed" trades
    if (isAddingPlayer) {
      if (isPendingTransaction) {
        this._submittedAddDropDifferential += 1;
        this._pendingAddPlayers.set(playerKey, eligiblePositions);
      }
    } else {
      if (isPendingTransaction) {
        this._submittedAddDropDifferential -= 1;
        this._pendingDropPlayers.set(playerKey, eligiblePositions);
      }
      this._lockedPlayers.add(playerKey);
    }
  }

  public get allPendingAddDropDifferential(): number {
    return this._pendingAddPlayers.size - this._pendingDropPlayers.size;
  }

  public addPendingAdd(player: Player): void {
    const { player_key: playerKey, eligible_positions: eligiblePositions } =
      player;
    this._pendingAddPlayers.set(playerKey, eligiblePositions);
    this._numNewAdds += 1;
  }

  public get pendingAddPlayerKeys(): string[] {
    return Array.from(this._pendingAddPlayers.keys());
  }

  public addPendingDrop(player: Player): void {
    const { player_key: playerKey, eligible_positions: eligiblePositions } =
      player;
    this._lockedPlayers.add(playerKey);
    this._pendingDropPlayers.set(playerKey, eligiblePositions);
  }

  public get pendingLockedPlayerKeys(): string[] {
    return Array.from(this._lockedPlayers);
  }

  /**
   * Returns a deep clone of the team as an ITeam object
   *
   * @public
   * @return {ITeamOptimizer}
   */
  public toITeamObject(): ITeamOptimizer {
    const { _editablePlayers, _ownershipScoreFunction, ...team } = this;
    return structuredClone(team) as ITeamOptimizer;
  }

  public get sameDayTransactions(): boolean {
    return (
      (this.weekly_deadline === "" || this.weekly_deadline === "intraday") &&
      this.edit_key === this.coverage_period
    );
  }

  public get editablePlayers(): Player[] {
    return this._editablePlayers;
  }

  public get droppablePlayers(): Player[] {
    return this.players.filter(
      (player) =>
        !player.is_undroppable &&
        !this._lockedPlayers.has(player.player_key) &&
        !player.eligible_positions.some((position) =>
          this.criticalPositions.includes(position)
        )
    );
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

  public get currentEmptyRosterSpots(): number {
    return this.emptyRosterSpotCounter() - this._submittedAddDropDifferential;
  }

  public get pendingEmptyRosterSpots(): number {
    return this.emptyRosterSpotCounter() - this.allPendingAddDropDifferential;
  }

  private emptyRosterSpotCounter(): number {
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
    return this.getPositionsHelper((a, b) => a <= b);
  }

  public get emptyPositions(): string[] {
    return this.getPositionsHelper((a, b) => a < b);
  }

  private getPositionsHelper(
    compareFn: (a: number, b: number) => boolean
  ): string[] {
    const result: string[] = [];

    // get all eligible positions for all players on roster, plus/minus pending adds/drops
    const countablePositions: string[][] = this.players
      .filter((player) => !this._pendingDropPlayers.has(player.player_key))
      .map((player) => {
        const { eligible_positions: eligiblePositions } = player;
        return eligiblePositions;
      })
      .concat(Array.from(this._pendingAddPlayers.values()));

    Object.keys(this.roster_positions).forEach((position) => {
      const playersAtPosition = countablePositions.filter((eligiblePositions) =>
        eligiblePositions.includes(position)
      );
      if (!INACTIVE_POSITION_LIST.includes(position)) {
        if (
          compareFn(playersAtPosition.length, this.roster_positions[position])
        ) {
          result.push(position);
        }
      }
    });

    return result;
  }

  public getPlayersAt(position: string): Player[] {
    return this._editablePlayers.filter(
      (player) => player.selected_position === position
    );
  }

  public isCurrentTransactionPaceOK(): boolean {
    const {
      start_date: startDate,
      end_date: endDate,
      current_weekly_adds: currrentWeeklyAdds,
      max_weekly_adds: maxWeeklyAdds,
      current_season_adds: currentSeasonAdds,
      max_season_adds: maxSeasonAdds,
      _numNewAdds: newAdds,
    } = this;

    let weeklyPaceExceeded = false;
    let seasonPaceExceeded = false;

    if (maxWeeklyAdds > 0) {
      weeklyPaceExceeded = isToleranceExceeded(
        currrentWeeklyAdds + newAdds,
        maxWeeklyAdds,
        getWeeklyProgressPacific()
      );
    }

    if (maxSeasonAdds > 0) {
      seasonPaceExceeded = isToleranceExceeded(
        currentSeasonAdds + newAdds,
        maxSeasonAdds,
        getProgressBetween(startDate, endDate)
      );
    }

    return weeklyPaceExceeded === false && seasonPaceExceeded === false;

    function isToleranceExceeded(
      currentAdds: number,
      maxAdds: number,
      progress: number
    ) {
      const TOLERANCE = 0.1;

      // the fewer the number of remaining adds, the less tolerance we allow
      const dynamicTolerance = TOLERANCE * (maxAdds - currentAdds);

      const isPastTolerance =
        currentAdds >= progress * maxAdds + dynamicTolerance;
      const oneTransactionLeft = currentAdds >= maxAdds - 1;

      return isPastTolerance || oneTransactionLeft;
    }
  }
}
