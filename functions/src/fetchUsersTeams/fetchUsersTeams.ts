import { HttpsError, onCall } from "firebase-functions/v2/https";
import { TeamClient, TeamFirestore } from "../common/interfaces/team";
import { fetchTeamsYahoo } from "./services/fetchUsersTeams.service";
import {
  fetchTeamsFirestore,
  syncTeamsInFirebase,
} from "../common/services/firebase/firestore.service";

export const fetchuserteams = onCall(async (request): Promise<TeamClient[]> => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to get an access token"
    );
  }

  const [yahooTeams, firestoreTeams] = await Promise.all([
    fetchTeamsYahoo(uid),
    fetchTeamsFirestore(uid),
  ]).catch((err: Error | any) => {
    throw new HttpsError("data-loss", err.message);
  });

  if (yahooTeams.length === 0) {
    throw new HttpsError(
      "internal",
      "No teams were returned from Yahoo. Please try again later."
    );
  }

  // find all teams that are in firestore but not in yahoo
  const extraTeams = firestoreTeams.filter(
    (t) => !yahooTeams.some((y) => y.team_key === t.team_key)
  );

  const teams: TeamClient[] = [];
  firestoreTeams.forEach((firestoreTeam: TeamFirestore) => {
    const yahooTeam: TeamClient | undefined = yahooTeams.find(
      (t) => t.team_key === firestoreTeam.team_key
    );
    if (yahooTeam) {
      // remove the team from the yahooTeams array and merge it with the team from firebase
      yahooTeams.splice(yahooTeams.indexOf(yahooTeam), 1);
      teams.push({ ...yahooTeam, ...firestoreTeam });
    }
  });
  // add the remaining teams from yahoo to the teams array for display on the frontend
  teams.push(...yahooTeams);

  // Update the teams in firestore if required
  try {
    await syncTeamsInFirebase(yahooTeams, extraTeams, uid);
  } catch (err: Error | any) {
    console.log("Error syncing teams in firebase: " + err.message);
  }

  return teams;
});
