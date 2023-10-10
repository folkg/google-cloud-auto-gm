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
import { enrichTeamsWithFirestoreSettings } from "../../common/services/firebase/firestoreUtils.service.js";
import { LineupOptimizer } from "../../dispatchSetLineup/classes/LineupOptimizer.js";
import { LineupChanges } from "../../dispatchSetLineup/interfaces/LineupChanges.js";
import { PlayerTransaction } from "../../dispatchSetLineup/interfaces/PlayerTransaction.js";
import { fetchRostersFromYahoo } from "../../common/services/yahooAPI/yahooLineupBuilder.service.js";
import {
  TopAvailablePlayers,
  fetchTopAvailablePlayersFromYahoo,
} from "../../common/services/yahooAPI/yahooTopAvailablePlayersBuilder.service.js";
import { getScarcityOffsetsForTeam } from "../../calcPositionalScarcity/services/positionalScarcity.service.js";

type TransctionsData = {
  dropPlayerTransactions: PlayerTransaction[][] | null;
  lineupChanges: LineupChanges[] | null;
  addSwapTransactions: PlayerTransaction[][] | null;
};
type TransactionResults = {
  postedTransactions: PlayerTransaction[];
  failedReasons: string[];
};
type PostTransactionsResult = {
  success: boolean;
  transactionResults: TransactionResults;
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

  const firestoreTeams: ITeamFirestore[] = teams.docs.map((doc) => {
    const team = doc.data();
    team.team_key = doc.id;
    return team as ITeamFirestore;
  });

  const intradayTeams = firestoreTeams.filter(
    (team) => team.weekly_deadline === "intraday" || team.game_code === "nfl"
  );
  const nextDayTeams = firestoreTeams.filter(
    (team) =>
      (team.weekly_deadline === "" ||
        team.weekly_deadline === (getCurrentPacificNumDay() + 1).toString()) &&
      team.game_code !== "nfl"
  );

  const topAvailablePlayerCandidates: TopAvailablePlayers =
    await getTopAvailablePlayers(firestoreTeams, uid);

  const [todays, tomorrows] = await Promise.all([
    getPlayerTransactionsForDate(
      uid,
      intradayTeams,
      topAvailablePlayerCandidates
    ),
    getPlayerTransactionsForDate(
      uid,
      nextDayTeams,
      topAvailablePlayerCandidates,
      tomorrowsDateAsString()
    ),
  ]);

  const dropPlayerTransactions = (todays.dropPlayerTransactions ?? []).concat(
    tomorrows.dropPlayerTransactions ?? []
  );

  const lineupChanges = (todays.lineupChanges ?? []).concat(
    tomorrows.lineupChanges ?? []
  );

  const addSwapTransactions = (todays.addSwapTransactions ?? []).concat(
    tomorrows.addSwapTransactions ?? []
  );

  return {
    dropPlayerTransactions,
    lineupChanges,
    addSwapTransactions,
  };
}

export async function postTransactions(
  transactionData: TransctionsData,
  uid: string
): Promise<PostTransactionsResult> {
  let success = false;
  let allPostedTransactions: PlayerTransaction[] = [];
  let allFailedReasons: string[] = [];

  const { dropPlayerTransactions, lineupChanges, addSwapTransactions } =
    transactionData;

  if (dropPlayerTransactions) {
    // any dropped players need to be processed before healthy players on IL are moved to BN with lineupChanges
    const { postedTransactions, failedReasons } = await postSomeTransactions(
      dropPlayerTransactions
    );

    success = true;
    allPostedTransactions = postedTransactions;
    allFailedReasons = failedReasons;
  }

  if (lineupChanges) {
    // any injured players on roster need to be moved to IL before add player transactions are processed with addSwapTransactions
    await putAllLineupChanges(lineupChanges);

    success = true;
  }

  if (addSwapTransactions) {
    const { postedTransactions, failedReasons } = await postSomeTransactions(
      addSwapTransactions
    );

    allPostedTransactions = allPostedTransactions.concat(postedTransactions);
    allFailedReasons = allFailedReasons.concat(failedReasons);
    success = true;
  }

  if (allPostedTransactions.length > 0) {
    sendSuccessfulTransactionEmail(allPostedTransactions, uid);
  }

  return {
    success,
    transactionResults: {
      postedTransactions: allPostedTransactions,
      failedReasons: allFailedReasons,
    },
  };

  async function postSomeTransactions(
    transactions: PlayerTransaction[][]
  ): Promise<TransactionResults> {
    try {
      return await postTransactionsHelper(transactions, uid);
    } catch (error) {
      logger.error("Error in postSomeTransactions()", error);
      logger.error("Transactions object: ", { transactions });
      throw error;
    }
  }

  async function putAllLineupChanges(lineupChanges: LineupChanges[]) {
    try {
      await putLineupChanges(lineupChanges, uid);
    } catch (error) {
      logger.error("Error in putAllLineupChanges()", error);
      logger.error("Lineup changes object: ", { lineupChanges });
      throw error;
    }
  }
}

async function getPlayerTransactionsForDate(
  uid: string,
  firestoreTeams: ITeamFirestore[],
  topAvailablePlayerCandidates: TopAvailablePlayers,
  date?: string
): Promise<TransctionsData> {
  assert(uid, "No uid provided");
  assert(firestoreTeams, "No teams provided");

  const teamKeys: string[] = firestoreTeams.map((t) => t.team_key);
  let usersTeams = await fetchRostersFromYahoo(teamKeys, uid, date);
  if (usersTeams.length === 0)
    return {
      dropPlayerTransactions: null,
      lineupChanges: null,
      addSwapTransactions: null,
    };

  usersTeams = enrichTeamsWithFirestoreSettings(usersTeams, firestoreTeams);

  const [dropPlayerTransactions, lineupChanges, addSwapTransactions] =
    await createPlayersTransactions(usersTeams, topAvailablePlayerCandidates);

  return {
    dropPlayerTransactions,
    lineupChanges,
    addSwapTransactions,
  };
}

export async function getTopAvailablePlayers(
  firestoreTeams: ITeamFirestore[],
  uid: string
) {
  // TODO: Do we want to initiate the promises here, or earlier in the call stack before we know usersTeams.length > 0?
  // Pro: We can get the top available players while we wait for the usersTeamsPromise to resolve
  // Con: We are initiating a bunch of promises that we may not need, using up API calls

  // TODO: Check pace before fetching add candidates? Could check each team inside the following function

  const [
    topAvailablePlayersPromise,
    nflTopAvailablePlayersPromise,
    restTopAvailablePlayersPromise,
  ] = generateTopAvailablePlayerPromises(firestoreTeams, uid);

  const topAvailablePlayerCandidates: TopAvailablePlayers =
    await mergeTopAvailabePlayers(
      topAvailablePlayersPromise,
      nflTopAvailablePlayersPromise,
      restTopAvailablePlayersPromise
    );
  return topAvailablePlayerCandidates;
}

export async function createPlayersTransactions(
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
    const positionalScarcityOffsets = await getScarcityOffsetsForTeam(team);
    const lo = new LineupOptimizer(team, positionalScarcityOffsets);

    let dpt: PlayerTransaction[] | null;
    if (team.allow_dropping) {
      lo.generateDropPlayerTransactions();

      dpt = lo.playerTransactions;
      if (dpt) {
        dropPlayerTransactions.push(dpt);
        // TODO: Remove this, temporary logging to spot check the new positional scarcity offset functionality
        logger.log(
          `positionalScarcityOffsets for team ${
            team.team_key
          }: ${JSON.stringify(positionalScarcityOffsets)}`
        );
        logger.log(`dropPlayerTransactions: ${JSON.stringify(dpt)}`);
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
        // TODO: Remove this, temporary logging to spot check the new positional scarcity offset functionality
        logger.log(
          `positionalScarcityOffsets for team ${
            team.team_key
          }: ${JSON.stringify(positionalScarcityOffsets)}`
        );
        logger.log(`addSwapPlayerTransactions: ${JSON.stringify(pt)}`);
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
): Promise<TransactionResults> {
  const postedTransactions: PlayerTransaction[] = [];
  const failedReasons: string[] = [];

  const allTransactionsPromises = playerTransactions
    .flat()
    .map((transaction) => postRosterAddDropTransaction(transaction, uid));

  const results = await Promise.allSettled(allTransactionsPromises);

  let error = false;
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      const transaction = result.value;
      transaction && postedTransactions.push(transaction);
    } else if (result.status === "rejected") {
      error = true;
      const { reason } = result;
      logger.error(
        `Error in postAllTransactions() for User: ${uid}: ${JSON.stringify(
          reason
        )}`
      );
      failedReasons.push(reason);
    }
  });

  if (error) {
    throw new Error("Error in postAllTransactions()");
  }

  return { postedTransactions, failedReasons };
}

export function sendSuccessfulTransactionEmail(
  transactionsPosted: PlayerTransaction[],
  uid: string
) {
  const body = ["The following transactions were processed:"].concat(
    stringifyTransactions(transactionsPosted)
  );
  sendUserEmail(
    uid,
    "Transactions were Automatically Processed for your Teams",
    body
  );
}

export function sendPotentialTransactionEmail(
  transactionsProposed: PlayerTransaction[],
  uid: string
) {
  const body = [
    "The following transactions have been proposed for your teams:",
  ].concat(stringifyTransactions(transactionsProposed));
  sendUserEmail(
    uid,
    "New Transactions Available for your Teams",
    body,
    "Go to Transactions",
    "https://fantasyautocoach.com/transactions"
  );
}

function stringifyTransactions(transactions: PlayerTransaction[]): string[] {
  const result: string[] = [];

  const groupedTransactions = groupTransactionsByTeam(transactions);

  Object.keys(groupedTransactions).forEach((teamKey) => {
    const teamTransactions = groupedTransactions[teamKey];
    result.push(
      `<strong>${teamTransactions[0].teamName} (${teamTransactions[0].leagueName}):</strong>`
    );
    teamTransactions.forEach((t) => {
      result.push(
        `${t.reason} ${
          t.players.some((p) => p.isFromWaivers)
            ? "(Waiver Claim)"
            : "(Free Agent Pickup)"
        }`
      );
    });
  });

  return result;
}

function groupTransactionsByTeam(transactions: PlayerTransaction[]) {
  const result: { [key: string]: PlayerTransaction[] } = {};

  transactions.forEach((t) => {
    if (result[t.teamKey]) {
      result[t.teamKey].push(t);
    } else {
      result[t.teamKey] = [t];
    }
  });

  return result;
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
