import assert from "assert";
import { logger } from "firebase-functions";
import { IPlayer } from "../../common/interfaces/IPlayer.js";
import {
  ITeamFirestore,
  ITeamOptimizer,
} from "../../common/interfaces/ITeam.js";
import {
  getCurrentPacificNumDay,
  getPacificTimeDateString,
} from "../../common/services/utilities.service.js";
import {
  postRosterAddDropTransaction,
  putLineupChanges,
} from "../../common/services/yahooAPI/yahooAPI.service.js";

import { sendUserEmail } from "../../common/services/email/email.service.js";
import { getActiveTeamsForUser } from "../../common/services/firebase/firestore.service.js";
import { LineupOptimizer } from "../../dispatchSetLineup/classes/LineupOptimizer.js";
import { LineupChanges } from "../../dispatchSetLineup/interfaces/LineupChanges.js";
import { PlayerTransaction } from "../../dispatchSetLineup/interfaces/PlayerTransaction.js";
import { fetchRostersFromYahoo } from "../../dispatchSetLineup/services/yahooLineupBuilder.service.js";
import {
  TopAvailablePlayers,
  fetchTopAvailablePlayersFromYahoo,
} from "../../dispatchSetLineup/services/yahooTopAvailablePlayersBuilder.service.js";

type TransctionsData = {
  dropPlayerTransactions: PlayerTransaction[][] | null;
  lineupChanges: LineupChanges[] | null;
  addSwapTransactions: PlayerTransaction[][] | null;
};

/**
 * Will optimize the starting lineup for a specific users teams
 *
 * @export
 * @async
 * @param {(string)} uid - The user id
 * @param {(any[])} firestoreTeams - The team objects from Firestore
 * @return {unknown}
 */
export async function getTransactions(uid: string): Promise<TransctionsData> {
  assert(uid, "No uid provided");

  const teams = await getActiveTeamsForUser(uid);

  if (teams.size === 0) {
    logger.log(`No active teams for user ${uid}`);
    return {
      dropPlayerTransactions: null,
      lineupChanges: null,
      addSwapTransactions: null,
    };
  }

  const firestoreTeams: ITeamFirestore[] = teams.docs
    .map((team) => team.data() as ITeamFirestore)
    .filter((team) => team.start_date <= Date.now());

  const intradayTeams = firestoreTeams.filter(
    (team) => team.weekly_deadline === "intraday"
  );
  const nextDayTeams = firestoreTeams.filter(
    (team) =>
      team.weekly_deadline === "" ||
      team.weekly_deadline === (getCurrentPacificNumDay() + 1).toString()
  );

  // Fetch player transactions for today and tomorrow in parallel
  const [todays, tomorrows] = await Promise.all([
    getPlayerTransactionsFor(uid, intradayTeams),
    getPlayerTransactionsFor(uid, nextDayTeams, tomorrowsDateAsString()),
  ]);

  const dropPlayerTransactions = [
    ...(todays.dropPlayerTransactions ?? []),
    ...(tomorrows.dropPlayerTransactions ?? []),
  ];

  const lineupChanges = [
    ...(todays.lineupChanges ?? []),
    ...(tomorrows.lineupChanges ?? []),
  ];

  const addSwapTransactions = [
    ...(todays.addSwapTransactions ?? []),
    ...(tomorrows.addSwapTransactions ?? []),
  ];

  return {
    dropPlayerTransactions,
    lineupChanges,
    addSwapTransactions,
  };
}

export async function postTransactions(
  dropPlayerTransactions: PlayerTransaction[][] | null,
  lineupChanges: LineupChanges[] | null,
  addSwapTransactions: PlayerTransaction[][] | null,
  uid: string
): Promise<boolean> {
  let result = false;

  if (dropPlayerTransactions) {
    // any dropped players need to be processed before healthy players on IL are moved to BN with lineupChanges
    await postSomeTransactions(dropPlayerTransactions);
    result = true;
  }

  if (lineupChanges) {
    // any injured players on roster need to be moved to IL before add player transactions are processed with addSwapTransactions
    await putAllLineupChanges(lineupChanges);
    result = true;
  }

  if (addSwapTransactions) {
    await postSomeTransactions(addSwapTransactions);
    result = true;
  }

  return result;

  async function postSomeTransactions(transactions: PlayerTransaction[][]) {
    try {
      await postTransactionsHelper(transactions, uid);
    } catch (error) {
      logger.error("Error in processTransactionsForSameDayChanges()", error);
      logger.error("Transactions object: ", { transactions });
      //   logger.error("Original teams object: ", { teams });
      // continue the function even if posting transactions fails, we can still proceed to optimize lineup
    }
  }

  async function putAllLineupChanges(lineupChanges: LineupChanges[]) {
    try {
      await putLineupChanges(lineupChanges, uid);
    } catch (error) {
      logger.error("Error in processTransactionsForSameDayChanges()", error);
      logger.error("Lineup changes object: ", { lineupChanges });
      //   logger.error("Original teams object: ", { teams });
      throw error;
    }
  }
}

export async function getPlayerTransactionsFor(
  uid: string,
  firestoreTeams: ITeamFirestore[],
  date?: string
): Promise<TransctionsData> {
  assert(uid, "No uid provided");
  assert(firestoreTeams, "No teams provided");

  const [
    topAvailablePlayersPromise,
    nflTopAvailablePlayersPromise,
    restTopAvailablePlayersPromise,
  ] = generateTopAvailablePlayerPromises(firestoreTeams, uid);

  const teamKeys: string[] = firestoreTeams.map((t) => t.team_key);
  let usersTeams = await fetchRostersFromYahoo(teamKeys, uid, date);
  if (usersTeams.length === 0)
    return {
      dropPlayerTransactions: null,
      lineupChanges: null,
      addSwapTransactions: null,
    };

  usersTeams = enrichTeamsWithFirestoreSettings(usersTeams, firestoreTeams);

  const topAvailablePlayerCandidates: TopAvailablePlayers =
    await mergeTopAvailabePlayers(
      topAvailablePlayersPromise,
      nflTopAvailablePlayersPromise,
      restTopAvailablePlayersPromise
    );

  const [dropPlayerTransactions, lineupChanges, addSwapTransactions] =
    await createPlayersTransactions(usersTeams, topAvailablePlayerCandidates);

  return {
    dropPlayerTransactions,
    lineupChanges,
    addSwapTransactions,
  };
}

function enrichTeamsWithFirestoreSettings(
  yahooTeams: ITeamOptimizer[],
  firestoreTeams: ITeamFirestore[]
): ITeamOptimizer[] {
  return yahooTeams.map((yahooTeam) => {
    const firestoreTeam = firestoreTeams.find(
      (firestoreTeam) => firestoreTeam.team_key === yahooTeam.team_key
    );

    return {
      allow_adding: firestoreTeam?.allow_adding ?? false,
      allow_dropping: firestoreTeam?.allow_dropping ?? false,
      allow_add_drops: firestoreTeam?.allow_add_drops ?? false,
      allow_waiver_adds: firestoreTeam?.allow_waiver_adds ?? false,
      allow_transactions: firestoreTeam?.allow_transactions ?? false,
      ...yahooTeam,
    };
  });
}

async function createPlayersTransactions(
  teams: ITeamOptimizer[],
  allAddCandidates: TopAvailablePlayers
): Promise<
  [
    PlayerTransaction[][] | null,
    LineupChanges[] | null,
    PlayerTransaction[][] | null
  ]
> {
  const dropPlayerTransactions: PlayerTransaction[][] = [];
  const addSwapPlayerTransactions: PlayerTransaction[][] = [];
  const allLineupChanges: LineupChanges[] = [];

  for (const team of teams) {
    const lo = new LineupOptimizer(team);

    let dpt: PlayerTransaction[] | null;
    if (team.allow_dropping) {
      lo.generateDropPlayerTransactions();

      dpt = lo.playerTransactions;
      if (dpt) {
        dropPlayerTransactions.push(dpt);
      }
    }

    const addCandidates: IPlayer[] = allAddCandidates[team.team_key];

    if (addCandidates?.length > 0) {
      lo.addCandidates = addCandidates;

      if (team.allow_adding) {
        lo.generateAddPlayerTransactions();
      }
      if (team.allow_add_drops) {
        lo.generateSwapPlayerTransactions();
      }

      // filter out any add transactions that are already in drop transactions by comparing the reason field
      const pt: PlayerTransaction[] | undefined = lo.playerTransactions?.filter(
        (pt) => !dpt?.some((dpt) => dpt.reason === pt.reason)
      );
      if (pt) {
        addSwapPlayerTransactions.push(pt);
      }
    }

    const lc: LineupChanges | null = lo.lineupChanges;
    if (lc) {
      allLineupChanges.push(lc);
    }
  }

  return [
    dropPlayerTransactions.length > 0 ? dropPlayerTransactions : null,
    allLineupChanges.length > 0 ? allLineupChanges : null,
    addSwapPlayerTransactions.length > 0 ? addSwapPlayerTransactions : null,
  ];
}

async function postTransactionsHelper(
  playerTransactions: PlayerTransaction[][],
  uid: string
): Promise<void> {
  const allTransactionsPromises = playerTransactions
    .flat()
    .map((transaction) => postRosterAddDropTransaction(transaction, uid));

  const results = await Promise.allSettled(allTransactionsPromises);

  const transactionsPosted: PlayerTransaction[] = [];
  let error = false;
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      const transaction = result.value;
      transaction && transactionsPosted.push(transaction);
    } else if (result.status === "rejected") {
      error = true;
      logger.error(
        `Error in postAllTransactions() for User: ${uid}: ${JSON.stringify(
          result.reason
        )}`
      );
    }
  });

  if (transactionsPosted.length > 0) {
    sendSuccessfulTransactionEmail(transactionsPosted, uid);
  }
  if (error) {
    throw new Error("Error in postAllTransactions()");
  }
}

export function sendSuccessfulTransactionEmail(
  transactionsPosted: PlayerTransaction[],
  uid: string
) {
  const body = ["The following transactions were processed:"].concat(
    transactionsPosted.map(
      (t) =>
        `${t.teamKey}: ${t.reason} ${
          t.players.some((p) => p.isFromWaivers)
            ? "(Waiver claim created only)"
            : "(Transaction completed)"
        }`
    )
  );
  sendUserEmail(uid, "Transactions were Processed!", body);
}

export function sendPotentialTransactionEmail(
  transactionsProposed: PlayerTransaction[],
  uid: string
) {
  const body = [
    "The following transactions have been proposed for your teams:",
  ].concat(transactionsProposed.map((t) => `${t.teamKey}: ${t.reason}`));
  sendUserEmail(uid, "Transactions Available for your Teams!", body);
}

function tomorrowsDateAsString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getPacificTimeDateString(tomorrow);
}

export function generateTopAvailablePlayerPromises(
  firestoreTeams: ITeamFirestore[],
  uid: string
) {
  const nflTeamKeysAddingPlayers: string[] = firestoreTeams
    .filter(
      (team) =>
        (team.allow_adding || team.allow_add_drops) && team.game_code === "nfl"
    )
    .map((team) => team.team_key);
  const restTeamKeysAddingPlayers: string[] = firestoreTeams
    .filter(
      (team) =>
        (team.allow_adding || team.allow_add_drops) && team.game_code !== "nfl"
    )
    .map((team) => team.team_key);
  const allTeamKeysAddingPlayers: string[] = nflTeamKeysAddingPlayers.concat(
    restTeamKeysAddingPlayers
  );

  if (allTeamKeysAddingPlayers.length === 0) {
    return [Promise.resolve({}), Promise.resolve({}), Promise.resolve({})];
  }

  const topAvailablePlayersPromise: Promise<TopAvailablePlayers> =
    fetchTopAvailablePlayersFromYahoo(
      allTeamKeysAddingPlayers,
      uid,
      "A",
      "sort=R_PO"
    );

  let nflTopAvailablePlayersPromise: Promise<TopAvailablePlayers>;
  if (nflTeamKeysAddingPlayers.length > 0) {
    nflTopAvailablePlayersPromise = fetchTopAvailablePlayersFromYahoo(
      nflTeamKeysAddingPlayers,
      uid,
      "A",
      "sort=AR_L4W;sort_type=last4weeks"
    );
  } else {
    nflTopAvailablePlayersPromise = Promise.resolve({});
  }

  let restTopAvailablePlayersPromise: Promise<TopAvailablePlayers>;
  if (restTeamKeysAddingPlayers.length > 0) {
    restTopAvailablePlayersPromise = fetchTopAvailablePlayersFromYahoo(
      restTeamKeysAddingPlayers,
      uid,
      "A",
      "sort=AR_L14;sort_type=biweekly"
    );
  } else {
    restTopAvailablePlayersPromise = Promise.resolve({});
  }

  return [
    topAvailablePlayersPromise,
    nflTopAvailablePlayersPromise,
    restTopAvailablePlayersPromise,
  ];
}

export async function mergeTopAvailabePlayers(
  topAvailablePlayersPromise: Promise<TopAvailablePlayers>,
  nflTopAvailablePlayersPromise: Promise<TopAvailablePlayers>,
  restTopAvailablePlayersPromise: Promise<TopAvailablePlayers>
): Promise<TopAvailablePlayers> {
  const result: TopAvailablePlayers = {};

  const resolvedPlayers = await Promise.all([
    topAvailablePlayersPromise,
    nflTopAvailablePlayersPromise,
    restTopAvailablePlayersPromise,
  ]);

  resolvedPlayers.forEach((resolvedPromise: TopAvailablePlayers) => {
    Object.keys(resolvedPromise).forEach((teamKey) => {
      if (Array.isArray(result[teamKey])) {
        result[teamKey].push(...resolvedPromise[teamKey]);
      } else {
        result[teamKey] = resolvedPromise[teamKey];
      }
    });
  });

  return result;
}
