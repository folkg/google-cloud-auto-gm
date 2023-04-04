import { logger } from "firebase-functions";
import { updateTeamFirestore } from "../../common/services/firebase/firestore.service";
import {
  datePSTString,
  is2DArrayEmpty,
} from "../../common/services/utilities.service";
import {
  postRosterAddDropTransaction,
  putLineupChanges,
} from "../../common/services/yahooAPI/yahooAPI.service";
import {
  initStartingGoalies,
  initStartingPitchers,
} from "../../common/services/yahooAPI/yahooStartingPlayer.service";
import { LineupOptimizer } from "../classes/LineupOptimizer";
import { ITeam } from "../interfaces/ITeam";
import { LineupChanges } from "../interfaces/LineupChanges";
import { PlayerTransaction } from "../interfaces/PlayerTransaction";
import { fetchRostersFromYahoo } from "./yahooLineupBuilder.service";
import assert = require("assert/strict");

/**
 * Will optimize the starting lineup for a specific users teams
 *
 * @export
 * @async
 * @param {(string)} uid - The user id
 * @param {(any[])} firestoreTeams - The team objects from Firestore
 * @return {unknown}
 */
export async function setUsersLineup(
  uid: string,
  firestoreTeams: any[]
): Promise<void> {
  assert(uid, "No uid provided");
  assert(firestoreTeams, "No teams provided");
  if (firestoreTeams.length === 0) {
    logger.log(`No teams for user ${uid}`);
    return;
  }

  const hasNHLTeam = firestoreTeams.some((team) => team.game_code === "nhl");
  if (hasNHLTeam) {
    await initStartingGoalies();
  }
  const hasMLBTeam = firestoreTeams.some((team) => team.game_code === "mlb");
  if (hasMLBTeam) {
    await initStartingPitchers();
  }

  const teamKeys: string[] = firestoreTeams.map((t) => t.team_key);

  let usersTeams = await fetchRostersFromYahoo(teamKeys, uid);
  await patchTeamChangesInFirestore(usersTeams, firestoreTeams);

  usersTeams = enrichTeamsWithFirestoreSettings(usersTeams, firestoreTeams);
  usersTeams = await processTransactionsForSameDayChanges(usersTeams, uid);
  usersTeams = await processTodaysLineupChanges(usersTeams, uid);
  await processTransactionsForNextDayChanges(usersTeams, uid);
}

export async function performWeeklyLeagueTransactions(
  uid: string,
  firestoreTeams: any[]
): Promise<void> {
  assert(uid, "No uid provided");
  assert(firestoreTeams, "No teams provided");
  if (firestoreTeams.length === 0) {
    logger.log(`No weekly teams for user ${uid}`);
    return;
  }

  const teamKeys: string[] = firestoreTeams.map((t) => t.team_key);
  let usersTeams = await fetchRostersFromYahoo(
    teamKeys,
    uid,
    tomorrowsDateAsString()
  );
  usersTeams = enrichTeamsWithFirestoreSettings(usersTeams, firestoreTeams);
  const transactions = getPlayerTransactions(usersTeams);
  if (!is2DArrayEmpty(transactions)) {
    try {
      await postAllTransactions(transactions, uid);
    } catch (error) {
      logger.error("Error in performTransactionsForWeeklyLeagues()");
      logger.error("Teams object: ", usersTeams);
    }
  }
}

function enrichTeamsWithFirestoreSettings(
  yahooTeams: ITeam[],
  firestoreTeams: any[]
): ITeam[] {
  return yahooTeams.map((yahooTeam) => {
    const firestoreTeam = firestoreTeams.find(
      (firestoreTeam) => firestoreTeam.team_key === yahooTeam.team_key
    );

    return {
      allow_adding: firestoreTeam?.allow_adding ?? false,
      allow_dropping: firestoreTeam?.allow_dropping ?? false,
      ...yahooTeam,
    };
  });
}

async function patchTeamChangesInFirestore(
  yahooTeams: ITeam[],
  firestoreTeams: any[]
): Promise<void> {
  const sharedKeys = Object.keys(firestoreTeams[0]).filter(
    (key) => key in yahooTeams[0]
  );

  for (const firestoreTeam of firestoreTeams) {
    const yahooTeam = yahooTeams.find(
      (yahooTeam) => firestoreTeam.team_key === yahooTeam.team_key
    );
    if (!yahooTeam) return;

    const differences: { [key: string]: any } = {};
    sharedKeys.forEach((key) => {
      const yahooValue = yahooTeam[key as keyof ITeam];
      const firestoreValue = firestoreTeam[key];
      if (yahooValue !== firestoreValue) {
        differences[key] = yahooValue;
      }
    });

    if (Object.keys(differences).length > 0) {
      logger.info(
        `different values between yahoo and firestore teams for team ${yahooTeam.team_key}`,
        differences
      );
      await updateTeamFirestore(
        firestoreTeam.uid,
        yahooTeam.team_key,
        differences
      );
    }
  }
}

async function processTodaysLineupChanges(
  teams: ITeam[],
  uid: string
): Promise<ITeam[]> {
  const result: ITeam[] = [];

  const allLineupChanges: LineupChanges[] = [];
  for (const team of teams) {
    const lo = new LineupOptimizer(team);
    const lineupChanges = lo.optimizeStartingLineup();
    result.push(lo.getCurrentTeamState());
    lo.isSuccessfullyOptimized(); // will log any errors, we could remove this later once we're confident in the optimizer
    if (lineupChanges) {
      allLineupChanges.push(lineupChanges);
    }
  }

  if (allLineupChanges.length > 0) {
    // if there is a failure calling the Yahoo API, an error will be thrown, and we will let it propagate up
    try {
      await putLineupChanges(allLineupChanges, uid);
    } catch (error) {
      logger.error(error);
      logger.error("Lineup changes object: ", allLineupChanges);
      logger.error("Teams object: ", teams);
      throw error;
    }
  }

  return result;
}

async function processTransactionsForSameDayChanges(
  originalTeams: ITeam[],
  uid: string
): Promise<ITeam[]> {
  let result: ITeam[] = originalTeams;

  const teams = getTeamsWithSameDayTransactions(originalTeams);
  const transactions = getPlayerTransactions(teams);
  if (!is2DArrayEmpty(transactions)) {
    try {
      await postAllTransactions(transactions, uid);
    } catch (error) {
      logger.error("Error in processTransactionsForSameDayChanges()", error);
      logger.error("Teams object: ", originalTeams);
    }
    // returns a new deep copy of the teams with the updated player transactions
    result = await refetchAndPatchTeams(transactions, uid, originalTeams);
  }

  return result;
}

async function processTransactionsForNextDayChanges(
  originalTeams: ITeam[],
  uid: string
): Promise<void> {
  // check if there are any transactions required for teams with next day changes
  // this pre-check is to save on Yahoo API calls
  const teams = getTeamsForNextDayTransactions(originalTeams);
  const potentialTransactions = getPlayerTransactions(teams);

  if (is2DArrayEmpty(potentialTransactions)) {
    return;
  }

  // if there are transactions required, get tomorrow's rosters and perform the transactions
  const uniqueTeamKeys = getTeamKeysFromTransactions(potentialTransactions);
  const tomorrowsTeams = await fetchRostersFromYahoo(
    uniqueTeamKeys,
    uid,
    tomorrowsDateAsString()
  );

  const transactions = getPlayerTransactions(tomorrowsTeams);
  if (!is2DArrayEmpty(transactions)) {
    try {
      await postAllTransactions(transactions, uid);
    } catch (error) {
      logger.error("Error in processTransactionsForNextDayChanges()", error);
      logger.error("Teams object: ", originalTeams);
    }
  }
}

function getPlayerTransactions(teams: ITeam[]): PlayerTransaction[][] {
  const result: PlayerTransaction[][] = [];

  for (const team of teams) {
    let playerTransactions: PlayerTransaction[] = [];
    const lo = new LineupOptimizer(team);

    if (team.allow_dropping) {
      playerTransactions = lo.findDropPlayerTransactions();
    }

    if (isTransactionPaceBehindTimeline(team)) {
      if (team.allow_adding) {
        // TODO: This method needs to actually be implemented. I'm not sure if the lo will be responsible for this or not
        playerTransactions.push(...lo.findAddPlayerTransactions());
      }
      // TODO: Can add add/dropping here as well
    }

    if (playerTransactions.length > 0) {
      result.push(playerTransactions);
    }
  }

  return result;
}

async function refetchAndPatchTeams(
  todaysPlayerTransactions: PlayerTransaction[][],
  uid: string,
  originalTeams: ITeam[]
): Promise<ITeam[]> {
  const result = structuredClone(originalTeams);

  const updatedTeamKeys = getTeamKeysFromTransactions(todaysPlayerTransactions);
  const updatedTeams = await fetchRostersFromYahoo(updatedTeamKeys, uid);

  updatedTeams.forEach((updatedTeam) => {
    const originalIdx = result.findIndex(
      (originalTeam: ITeam) => originalTeam.team_key === updatedTeam.team_key
    );
    result[originalIdx] = updatedTeam;
  });

  return result;
}

async function postAllTransactions(
  playerTransactions: PlayerTransaction[][],
  uid: string
): Promise<void> {
  const allTransactions = playerTransactions.flat();
  // if there is a failure calling the Yahoo API, it will be swallowed here, and we will simply log it
  for (const transaction of allTransactions) {
    try {
      await postRosterAddDropTransaction(transaction, uid);
    } catch (err: any) {
      logger.error(
        `Error in postAllTransactions() for User: ${uid}: ${err.message}`
      );
      logger.error("Transaction: ", transaction);
      throw err;
    }
  }

  // TODO: This is the code to use if we want to use Promise.allSettled in parallel
  // const allTransactionsPromises = playerTransactions
  //   .flat()
  //   .map((transaction) => postRosterAddDropTransaction(transaction, uid));
  // const results = await Promise.allSettled(allTransactionsPromises);
}

function getTeamsWithSameDayTransactions(teams: ITeam[]): ITeam[] {
  return teams.filter(
    (team) =>
      (team.allow_adding || team.allow_dropping) &&
      team.weekly_deadline !== "1" &&
      team.edit_key === team.coverage_period
  );
}

function getTeamsForNextDayTransactions(teams: ITeam[]): ITeam[] {
  return teams.filter(
    (team) =>
      (team.allow_adding || team.allow_dropping) &&
      team.weekly_deadline !== "1" &&
      team.edit_key !== team.coverage_period
  );
}

function getTeamKeysFromTransactions(
  transactions: PlayerTransaction[][]
): string[] {
  const uniqueKeys = new Set<string>();
  for (const team of transactions) {
    for (const playerTransaction of team) {
      uniqueKeys.add(playerTransaction.teamKey);
    }
  }
  return Array.from(uniqueKeys);
}

function tomorrowsDateAsString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return datePSTString(tomorrow);
}

/**
 * Returns true if the team is behind the pace of the season timeline
 * This is used to determine if the team should be allowed to add players
 * 
 * The final transaction of the week or season will not be allowed
 * The tolerance is used to allow for some leeway in the timeline
 * 
 *
 * @param {ITeam} {
  start_date,
  end_date,
  current_weekly_adds,
  max_weekly_adds,
  current_season_adds,
  max_season_adds,
} - the destructured team object
 * @return {boolean} - true if the team is behind the timeline
 */
function isTransactionPaceBehindTimeline({
  start_date: startDate,
  end_date: endDate,
  current_weekly_adds: currrentWeeklyAdds,
  max_weekly_adds: maxWeeklyAdds,
  current_season_adds: currentSeasonAdds,
  max_season_adds: maxSeasonAdds,
}: ITeam): boolean {
  const TOLERANCE = 0.1;

  // TODO: Alternatively, current_weekly_adds <= weekProgress * max_weekly_adds + TOLERANCE * (max_weekly_adds - current_weekly_adds)

  if (maxWeeklyAdds > 0) {
    const weekProgress = getWeeklyProgressPST();
    if (
      areTransactionsPastTolerance(
        currrentWeeklyAdds,
        maxWeeklyAdds,
        weekProgress
      )
    ) {
      return false;
    }
  }

  if (maxSeasonAdds > 0) {
    const seasonTimeProgress = (Date.now() - startDate) / (endDate - startDate);
    if (
      areTransactionsPastTolerance(
        currentSeasonAdds,
        maxSeasonAdds,
        seasonTimeProgress
      )
    ) {
      return false;
    }
  }

  return true;

  function areTransactionsPastTolerance(
    currentAdds: number,
    maxAdds: number,
    progress: number
  ) {
    // TODO: Is this double counting?
    // the greater the number of remaining adds, the more tolerance we allow
    const toleranceValue = TOLERANCE * (maxAdds - currentAdds);

    if (currentAdds <= progress * maxAdds + toleranceValue) return true;

    if (currentAdds >= maxAdds - 1) return true;

    return false;
  }
}

function getWeeklyProgressPST() {
  const nowString = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });
  const now = new Date(nowString);
  // Adjust the day number to make Monday 0 and Sunday 6
  const day = (now.getDay() + 6) % 7;
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalMinutes = day * 24 * 60 + hour * 60 + minute;
  return totalMinutes / (7 * 24 * 60);
}
