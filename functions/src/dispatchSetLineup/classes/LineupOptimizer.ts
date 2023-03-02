import { Roster as Roster } from "./Roster";
import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { Team } from "../interfaces/Team";
import { Player } from "../interfaces/Player";
import { RosterModification } from "../interfaces/RosterModification";
import { assignPlayerStartSitScoreFunction } from "../services/playerStartSitScoreFunctions.service";

export class LineupOptimizer {
  private team: Team;
  private roster: Roster;
  private originalPlayerPositions: { [key: string]: string };
  private newPlayerPositions: { [key: string]: string } = {};
  private unfilledPositionsCounter: { [key: string]: number };
  private _verboseLogging = false;
  public set verbose(value: boolean) {
    this._verboseLogging = value;
  }

  constructor(team: Team) {
    this.team = team;
    this.roster = new Roster(
      team.players,
      assignPlayerStartSitScoreFunction(team.game_code, team.weekly_deadline)
    );
    this.originalPlayerPositions = this.createPlayerPositionDictionary(
      this.roster.editablePlayers
    );
    this.unfilledPositionsCounter = this.getUnfilledRosterPositions(
      this.roster.allPlayers,
      team.roster_positions
    );
  }

  public async optimizeStartingLineup() {
    if (this.roster.editablePlayers.length === 0) {
      this.verbose &&
        console.info("no players to optimize for team " + this.team.team_key);
      return this.aRosterModification({});
    }

    // Attempt to fix illegal players by swapping them with all eligible players
    // Illegal players are players that are not eligible for their selected position
    // For example, any player in an IR position that is now healthy, IR+, or NA
    const illegalPlayers = this.roster.illegalPlayers;
    if (illegalPlayers.length > 0) {
      const legalPlayers = this.roster.legalPlayers;
      Roster.sortDescendingByScore(illegalPlayers);
      Roster.sortAscendingByScore(legalPlayers);
      // first check if a simple swap is possible between any two players on illelegalPlayers
      // if not, then call swapPlayer()
      this.verbose &&
        console.info("swapping illegalPlayers amongst themselves:");
      internalDirectPlayerSwap(illegalPlayers);

      this.verbose && console.info("swapping illegalPlayer / legalPlayers:");
      // illegalPlayers  will be sorted high to low, legalPlayers will be sorted low to high
      transferPlayers(
        illegalPlayers,
        legalPlayers,
        this.unfilledPositionsCounter
      );
    }

    // TODO: Move all injured players to InactiveList if possible
    // TODO: Add new players from FA if there are empty roster spots

    this.verbose && console.info("swapping bench / roster:");
    const benchPlayers = this.roster.benchPlayers;
    const rosterPlayers = this.roster.rosterPlayers;
    Roster.sortDescendingByScore(benchPlayers);
    Roster.sortAscendingByScore(rosterPlayers);
    transferPlayers(
      benchPlayers,
      rosterPlayers,
      this.unfilledPositionsCounter,
      true
    );

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

  private getUnfilledRosterPositions(
    players: Player[],
    rosterPositions: { [key: string]: number }
  ) {
    const result: { [key: string]: number } = { ...rosterPositions };
    players.forEach((player) => {
      result[player.selected_position]--;
    });
    return result;
  }

  public isSuccessfullyOptimized(): boolean {
    const unfilledPositionsCounter = this.unfilledPositionsCounter;

    if (unfilledActiveRosterPositions().length > 0) {
      console.error(
        `unfilledRosterPositions for team ${
          this.team.team_key
        }: ${unfilledActiveRosterPositions()}`
      );
      return false;
    }

    const unfilledPositions = Object.keys(unfilledPositionsCounter);
    for (const position of unfilledPositions) {
      if (position !== "BN" && unfilledPositionsCounter[position] < 0) {
        console.error(
          `too many players at position ${position} for team ${this.team.team_key}`
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
        `illegalPlayers moved for team ${this.team.team_key}: ${illegallyMovedPlayers}`
      );
      return false;
    }

    for (const benchPlayer of this.roster.benchPlayersWithGameToday) {
      for (const rosterPlayer of this.roster.rosterPlayers) {
        if (eligibleReplacementPlayerHasLowerScore(benchPlayer, rosterPlayer)) {
          console.error(
            `benchPlayer ${benchPlayer.player_name} has a higher score than rosterPlayer ${rosterPlayer.player_name} for team ${this.team.team_key}`
          );
          return false;
        }
      }
    }

    return true;

    // end of verifyOptimization() function

    function eligibleReplacementPlayerHasLowerScore(
      benchPlayer: Player,
      rosterPlayer: Player
    ) {
      return (
        benchPlayer.eligible_positions.includes(
          rosterPlayer.selected_position
        ) && benchPlayer.score > rosterPlayer.score
      );
    }

    function unfilledActiveRosterPositions() {
      return Object.keys(unfilledPositionsCounter).filter(
        (position) =>
          position !== "BN" &&
          !INACTIVE_POSITION_LIST.includes(position) &&
          unfilledPositionsCounter[position] > 0
      );
    }
  }
}

function transferPlayers(
  illegalPlayers: Player[],
  legalPlayers: Player[],
  unfilledPositionsCounter: { [key: string]: number },
  boolean: boolean = false
) {
  throw new Error("Function not implemented.");
}

function internalDirectPlayerSwap(illegalPlayers: Player[]) {
  throw new Error("Function not implemented.");
}
// interface LOPlayer extends Player {}
// class LOPlayer implements Player {
//   // TODO: Add comparison methods for sorting
// }
