import { logger } from "firebase-functions";
import { scheduleWeeklyLeagueTransactions } from "../services/scheduleWeeklyLeagueTansactions.service";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

const mockQueue = {
  enqueue: jest.fn(() => Promise.resolve()),
};
const mockFunctionUrl = jest.fn(() => Promise.resolve("https://example.com"));
jest.mock("../../common/services/utilities.service", () => ({
  getFunctionUrl: jest.fn(() => mockFunctionUrl),
}));

// mock the TaskQueue constructor
jest.mock("firebase-admin/functions", () => {
  return {
    TaskQueue: jest.fn().mockImplementation(() => {
      return {
        enqueue: jest.fn(),
      };
    }),
    getFunctions: jest.fn(() => ({
      taskQueue: jest.fn(() => mockQueue),
    })),
  };
});

describe("scheduleWeeklyLeagueTransactions", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockGetActiveWeeklyTeams = jest.spyOn(
    require("../../common/services/firebase/firestore.service"),
    "getActiveWeeklyTeams"
  );

  function mockTeamsSnapshot(teams: any) {
    return {
      docs: teams.map((team: any) => ({
        id: team.team_key,
        data: () => team,
      })),
    };
  }

  it("should enqueue tasks for each active user with playing teams", async () => {
    const teams = [
      {
        uid: "RLSrRcWN3lcYbxKQU1FKqditGDu1",
        team_key: "419.l.14950.t.2",
        start_date: 123456789,
      },
      {
        uid: "RLSrRcWN3lcYbxKQU1FKqditGDu1",
        team_key: "419.l.19947.t.6",
        start_date: 123456789,
      },
      {
        uid: "xAyXmaHKO3aRm9J3fnj2rgZRPnX2",
        team_key: "414.l.358976.t.4",
        start_date: 123456789,
      },
    ];

    // mock the querySnapshot object
    const teamsSnapshot = mockTeamsSnapshot(teams);

    mockGetActiveWeeklyTeams.mockReturnValue(Promise.resolve(teamsSnapshot));

    await scheduleWeeklyLeagueTransactions();

    expect(mockQueue.enqueue).toHaveBeenCalledTimes(2); // check if the enqueue method was called twice
    expect(mockQueue.enqueue).toHaveBeenCalledWith(
      // check if the enqueue method was called with the correct arguments for the first user
      { uid: "RLSrRcWN3lcYbxKQU1FKqditGDu1", teams: teams.slice(0, 2) },
      {
        dispatchDeadlineSeconds: 60 * 5,
        uri: mockFunctionUrl,
      }
    );
    expect(mockQueue.enqueue).toHaveBeenCalledWith(
      // check if the enqueue method was called with the correct arguments for the second user
      { uid: "xAyXmaHKO3aRm9J3fnj2rgZRPnX2", teams: [teams[2]] },
      {
        dispatchDeadlineSeconds: 60 * 5,
        uri: mockFunctionUrl,
      }
    );
  });

  it("should not execute if there are no active users / teams", async () => {
    mockGetActiveWeeklyTeams.mockReturnValue(Promise.resolve([]));
    const logSpy = jest.spyOn(logger, "log");

    await scheduleWeeklyLeagueTransactions();

    expect(logSpy).toHaveBeenCalledWith("No users to set lineups for");
    expect(mockQueue.enqueue).not.toHaveBeenCalled();
  });
});
