import { logger } from "firebase-functions";
import { ITeamFirestore, ITeamOptimizer } from "../../interfaces/ITeam.js";
import { updateTeamFirestore } from "./firestore.service.js";

export function enrichTeamsWithFirestoreSettings(
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

export async function patchTeamChangesInFirestore(
  yahooTeams: ITeamOptimizer[],
  firestoreTeams: ITeamFirestore[]
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
      const yahooValue = yahooTeam[key as keyof ITeamOptimizer];
      const firestoreValue = firestoreTeam[key as keyof ITeamFirestore];
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
