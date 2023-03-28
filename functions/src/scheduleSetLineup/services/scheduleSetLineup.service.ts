import { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { getFunctions, TaskQueue } from "firebase-admin/functions";
import { logger } from "firebase-functions";
import { getActiveTeamsForLeagues } from "../../common/services/firebase/firestore.service";
import { getFunctionUrl } from "../../common/services/utilities.service";
import { fetchStartingGoaliesYahoo } from "../../common/services/yahooAPI/yahooStartingGoalie.service";
import { leaguesToSetLineupsFor } from "./scheduling.service";

export async function scheduleSetLineup() {
  const leagues: string[] = await leaguesToSetLineupsFor();

  if (leagues.length === 0) {
    logger.log("No leagues to set lineups for.");
    return;
  }

  if (leagues.includes("nhl")) {
    try {
      await fetchStartingGoaliesYahoo();
    } catch (err: Error | any) {
      logger.error("Error fetching starting goalies from Yahoo " + err.message);
    }
  }

  let teamsSnapshot: QuerySnapshot<DocumentData>;
  try {
    teamsSnapshot = await getActiveTeamsForLeagues(leagues);
  } catch (err: Error | any) {
    logger.error(
      `Error fetching teams from Firebase. ${
        err.message
      }. Leagues: ${leagues.join(", ")}`
    );
    return;
  }

  if (teamsSnapshot.size === 0) {
    logger.log("Leagues found, but no teams to set lineups for.");
    return;
  }

  // create a map of user_id to list of teams
  const activeUsers: Map<string, any[]> = new Map();
  teamsSnapshot.forEach((doc) => {
    const team = doc.data();
    const uid = team.uid;
    team.team_key = doc.id;

    // only add teams where the season has started
    if (team.start_date <= Date.now()) {
      const userTeams = activeUsers.get(uid);
      if (userTeams === undefined) {
        activeUsers.set(uid, [team]);
      } else {
        userTeams.push(team);
      }
    }
  });

  if (activeUsers.size === 0) {
    logger.log("No users to set lineups for");
    return;
  }

  // enqueue a task for each user (with playing teams) to set their lineup
  let queue: TaskQueue<Record<string, any>>;
  let targetUri: string;
  try {
    queue = getFunctions().taskQueue("dispatchsetlineup");
    targetUri = await getFunctionUrl("dispatchsetlineup");
  } catch (err: Error | any) {
    logger.error("Error getting task queue. " + err.message);
    return;
  }

  const enqueues: any[] = [];
  activeUsers.forEach((teams, uid) => {
    enqueues.push(
      queue.enqueue(
        { uid, teams },
        {
          dispatchDeadlineSeconds: 60 * 5, // 5 minutes
          uri: targetUri,
        }
      )
    );
  });

  try {
    await Promise.all(enqueues);
    logger.log("Successfully enqueued tasks");
  } catch (err: Error | any) {
    logger.error("Error enqueuing tasks: " + err.message);
  }
}
