import { HttpsError, onCall } from "firebase-functions/v2/https";
import { TeamClient, TeamFirestore } from "./interfaces/team";
import { fetchTeamsYahoo } from "./services/fetchUsersTeams.service";
import {
  fetchTeamsFirestore,
  syncTeamsInFirebase,
} from "./services/firestore.service";

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
    throw new HttpsError("internal", err);
  });

  if (yahooTeams.length === 0) {
    throw new HttpsError(
      "internal",
      "No teams were returned from Yahoo. Please try again later."
    );
  }

  // Update the teams in firestore if required
  syncTeamsInFirebase(yahooTeams, uid, firestoreTeams);

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

  return teams;
});
