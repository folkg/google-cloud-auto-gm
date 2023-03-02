import { Roster as Roster } from "./Roster";
import { INACTIVE_POSITION_LIST } from "../helpers/constants";
import { Team } from "../interfaces/Team";
import { Player } from "../interfaces/Player";
import { RosterModification } from "../interfaces/RosterModification";
import { assignPlayerStartSitScoreFunction } from "../services/playerStartSitScoreFunctions.service";

class LineupOptimizer {
  private team: Team;
  private roster: Roster;
  private originalPlayerPositions: { [key: string]: string };
  private unfilledPositions: { [key: string]: number };
  private _verboseLogging: boolean = false;
  public set verbose(value: boolean) {
    this._verboseLogging = value;
  }

  constructor(team: Team) {
    this.team = team;

    this.roster = new Roster(
      team.players,
      assignPlayerStartSitScoreFunction(team.game_code, team.weekly_deadline)
    );

    this.originalPlayerPositions = this.createPlayerPositionDict(
      this.roster.editablePlayers
    );

    this.unfilledPositions = this.getUnfilledPositions(
      this.roster.allPlayers,
      team.roster_positions
    );
  }

  public async optimizeStartingLineup() {
    if (this.roster.editablePlayers.length === 0) {
      this.verbose &&
        console.info("no players to optimize for team " + this.team.team_key);
      return this.rosterModification({});
    }

    // Attempt to fix illegal players by swapping them with all eligible players
    // Illegal players are players that are not eligible for their selected position
    // For example, any player in an IR position that is now healthy, IR+, or NA
    const illegalPlayers = this.roster.illegalPlayers;
    if (illegalPlayers.length > 0) {
      const legalPlayers = this.roster.legalPlayers;
      Roster.sortAscendingByScore(legalPlayers);
      Roster.sortDescendingByScore(illegalPlayers);
      // first check if a simple swap is possible between any two players on illelegalPlayers
      // if not, then call swapPlayer()
      this.verbose &&
        console.info("swapping illegalPlayers amongst themselves:");
      internalDirectPlayerSwap(illegalPlayers);

      this.verbose && console.info("swapping illegalPlayer / legalPlayers:");
      // illegalPlayers  will be sorted high to low, legalPlayers will be sorted low to high
      swapPlayers(illegalPlayers, legalPlayers, this.unfilledPositions);
    }

    // TODO: Move all injured players to InactiveList if possible
    // TODO: Add new players from FA if there are empty roster spots

    this.verbose && console.info("swapping bench / roster:");
    const benchPlayers = this.roster.benchPlayers;
    const rosterPlayers = this.roster.rosterPlayers;
    Roster.sortDescendingByScore(benchPlayers);
    Roster.sortAscendingByScore(rosterPlayers);
    swapPlayers(benchPlayers, rosterPlayers, this.unfilledPositions, true);

    const newPlayerPositions = this.playerPositionDictDiff(
      this.originalPlayerPositions,
      this.createPlayerPositionDict(this.roster.editablePlayers)
    );

    // helper function to verify that the optimization was successful
    this.verifyOptimization();

    // Return the roster modification object if there are changes
    return this.rosterModification(newPlayerPositions);
  }

  private rosterModification(newPlayerPositions: {
    [key: string]: string;
  }): RosterModification {
    return {
      teamKey: this.team.team_key,
      coverageType: this.team.coverage_type,
      coveragePeriod: this.team.coverage_period,
      newPlayerPositions,
    };
  }

  private createPlayerPositionDict(players: Player[]) {
    const result: { [key: string]: string } = {};
    players.forEach((player) => {
      result[player.player_key] = player.selected_position;
    });
    return result;
  }

  private playerPositionDictDiff(
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

  private getUnfilledPositions(
    players: Player[],
    rosterPositions: { [key: string]: number }
  ) {
    const unfilledPositions: { [key: string]: number } = { ...rosterPositions };
    players.forEach((player) => {
      unfilledPositions[player.selected_position]--;
    });
    return unfilledPositions;
  }

  private verifyOptimization(): boolean {
    const unfilledPositions = this.unfilledPositions;

    if (unfilledActiveRosterPositions().length > 0) {
      console.error(
        `unfilledRosterPositions for team ${
          this.team.team_key
        }: ${unfilledActiveRosterPositions()}`
      );
      return false;
    }

    if (arePositionsOverfilled()) {
      return false;
    }

    if (this.roster.getIllegalPlayers().length > 0) {
      console.error(
        `illegalPlayers for team ${
          this.team.team_key
        }: ${this.roster.getIllegalPlayers()}`
      );
      return false;
    }

    for (const benchPlayer of this.roster.getBenchPlayersWithGameToday()) {
      for (const rosterPlayer of this.roster.getRosterPlayers()) {
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
      return Object.keys(unfilledPositions).filter(
        (position) =>
          position !== "BN" &&
          !INACTIVE_POSITION_LIST.includes(position) &&
          unfilledPositions[position] > 0
      );
    }

    function arePositionsOverfilled() {
      for (const position of Object.keys(unfilledPositions)) {
        if (position !== "BN" && unfilledPositions[position] < 0) {
          console.error(
            `too many players at position ${position} for team ${this.roster.team_key}`
          );
          return true;
        }
      }
      return false;
    }
  }
}

interface LOPlayer extends Player {}
class LOPlayer implements Player {
  // TODO: Add comparison methods for sorting
}
