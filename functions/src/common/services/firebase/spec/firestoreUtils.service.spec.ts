import { assert, describe, expect, it, vi } from "vitest";
import { patchTeamChangesInFirestore } from "../firestoreUtils.service";
import { createMock } from "../../../spec/createMock";
import * as firestoreService from "../firestore.service";
import type { ITeamFirestore, ITeamOptimizer } from "../../../interfaces/ITeam";

vi.mock("../firestore.service", () => {
  return {
    updateTeamFirestore: vi.fn(),
  };
});

describe("patchTeamChangesInFirestore", () => {
  it("updates Firestore teams with differences from Yahoo teams", async () => {
    const yahooTeams = [
      createMock<ITeamOptimizer>({
        team_key: "team1",
        weekly_deadline: "Tuesday",
        roster_positions: {
          Util: 2,
          "1B": 1,
          C: 1,
          "2B": 1,
          P: 4,
          IL: 4,
          SP: 2,
          RP: 2,
          OF: 3,
          SS: 1,
          "3B": 1,
          BN: 5,
        },
      }),
      createMock<ITeamOptimizer>({
        team_key: "team2",
        weekly_deadline: "Wednesday",
        roster_positions: {
          Util: 2,
          "1B": 1,
          C: 1,
          "2B": 1,
          P: 4,
          IL: 4,
          SP: 2,
          RP: 2,
          OF: 3,
          SS: 1,
          "3B": 1,
          BN: 5,
        },
      }),
    ];
    const firestoreTeams = [
      createMock<ITeamFirestore>({
        uid: "uid1",
        team_key: "team1",
        weekly_deadline: "Monday",
        roster_positions: {
          Util: 2,
          "1B": 1,
          C: 1,
          "2B": 1,
          P: 4,
          IL: 4,
          SP: 2,
          RP: 2,
          OF: 3,
          SS: 1,
          "3B": 1,
          BN: 5,
        },
      }),
      createMock<ITeamFirestore>({
        uid: "uid1",
        team_key: "team2",
        weekly_deadline: "Monday",
        roster_positions: {
          Util: 3,
          "1B": 1,
          C: 1,
          "2B": 1,
          P: 4,
          IL: 4,
          SP: 2,
          RP: 2,
          OF: 3,
          SS: 1,
          "3B": 1,
          BN: 5,
        },
      }),
    ];

    const updateTeamFirestoreSpy = vi.spyOn(
      firestoreService,
      "updateTeamFirestore"
    );

    await patchTeamChangesInFirestore(yahooTeams, firestoreTeams);

    expect(updateTeamFirestoreSpy).toHaveBeenCalledTimes(2);
    expect(updateTeamFirestoreSpy).toHaveBeenCalledWith("uid1", "team1", {
      weekly_deadline: "Tuesday",
    });
    expect(updateTeamFirestoreSpy).toHaveBeenCalledWith("uid1", "team2", {
      weekly_deadline: "Wednesday",
      roster_positions: {
        Util: 2,
        "1B": 1,
        C: 1,
        "2B": 1,
        P: 4,
        IL: 4,
        SP: 2,
        RP: 2,
        OF: 3,
        SS: 1,
        "3B": 1,
        BN: 5,
      },
    });
  });
});
