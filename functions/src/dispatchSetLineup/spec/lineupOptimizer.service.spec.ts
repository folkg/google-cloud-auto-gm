import { describe, expect, it, vi } from "vitest";
import {
  ITeamFirestore,
  ITeamOptimizer,
} from "../../common/interfaces/ITeam.js";
import * as firestoreService from "../../common/services/firebase/firestore.service.js";
import * as yahooAPI from "../../common/services/yahooAPI/yahooAPI.service.js";
import { LineupChanges } from "../interfaces/LineupChanges.js";
import {
  performWeeklyLeagueTransactions,
  setUsersLineup,
} from "../services/setLineups.service.js";
import * as LineupBuilderService from "../services/yahooLineupBuilder.service.js";

// mock firebase-admin
vi.mock("firebase-admin/firestore", () => {
  return {
    getFirestore: vi.fn(),
  };
});
vi.mock("firebase-admin/app", () => {
  return {
    getApps: vi.fn(() => ["null"]),
    initializeApp: vi.fn(),
  };
});

// mock initialize starting goalies
vi.mock("../../common/services/yahooAPI/yahooStartingPlayer.service", () => ({
  initStartingGoalies: vi.fn(() => Promise.resolve()),
  getNHLStartingGoalies: vi.fn().mockReturnValue([]),
}));

// mock Firestore services
const spyUpdateTeamFirestore = vi
  .spyOn(firestoreService, "updateTeamFirestore")
  .mockImplementation(() => Promise.resolve());

describe.concurrent("Full Stack Add Drop Tests in setUsersLineup()", () => {
  // Notes:
  // fetchRostersFromYahoo() should throw an error and cause the function to eit.skip.
  // putLineupChanges() should throw an error and cause the function to eit.skip.
  // postRosterAddDropTransaction() should have caught errors and allow the function to continue.
  it("should patch differences between Yahoo and Firestore teams", async () => {
    const uid = "testUID";
    const teamKey = "419.l.28340.t.1";
    const teams = [{ uid, team_key: teamKey, start_date: 1, end_date: 1 }];

    const rosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/Daily/optimalRoster.json"),
    ];

    const spyFetchRostersFromYahoo = vi
      .spyOn(LineupBuilderService, "fetchRostersFromYahoo")
      .mockReturnValue(Promise.resolve(rosters));

    // mock the API calls
    vi.spyOn(yahooAPI, "putLineupChanges").mockReturnValue(Promise.resolve());
    vi.spyOn(yahooAPI, "postRosterAddDropTransaction").mockReturnValue(
      Promise.resolve() as any
    );
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    await setUsersLineup(uid, teams as ITeamFirestore[]);
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(1);
    expect(spyUpdateTeamFirestore).toHaveBeenCalledTimes(1);
    expect(spyUpdateTeamFirestore).toHaveBeenCalledWith(uid, teamKey, {
      start_date: 1617220000,
      end_date: 1817220000,
    });
  });

  it("should do nothing for already optimal lineup", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }];

    const rosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/Daily/optimalRoster.json"),
    ];

    const expectedRosterModifications: LineupChanges[] = [
      {
        coveragePeriod: "2023-02-28",
        coverageType: "date",
        newPlayerPositions: {},
        teamKey: "419.l.28340.t.1",
      },
    ];
    const spyFetchRostersFromYahoo = vi
      .spyOn(LineupBuilderService, "fetchRostersFromYahoo")
      .mockReturnValue(Promise.resolve(rosters));
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    await setUsersLineup(uid, teams as ITeamFirestore[]);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      expectedRosterModifications,
      uid
    );
    expect(spyPostRosterAddDropTransaction).not.toHaveBeenCalled();
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(1);
  });

  // user with multiple teams, no changes
  it("should do nothing for two already optimal lineup", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }, { team_key: "test2" }];

    const rosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/DailyDrops/noDropsRequired.json"),
      require("./testRosters/NHL/IntradayDrops/noDropsRequired.json"),
    ];

    const expectedRosterModifications: LineupChanges[] = [
      {
        coveragePeriod: "2023-03-17",
        coverageType: "date",
        newPlayerPositions: {},
        teamKey: "419.l.28340.t.1",
      },
      {
        coveragePeriod: "2023-03-17",
        coverageType: "date",
        newPlayerPositions: {},
        teamKey: "419.l.19947.t.6",
      },
    ];
    const spyFetchRostersFromYahoo = vi
      .spyOn(LineupBuilderService, "fetchRostersFromYahoo")
      .mockReturnValue(Promise.resolve(rosters));
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    await setUsersLineup(uid, teams as ITeamFirestore[]);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      expectedRosterModifications,
      uid
    );
    expect(spyPostRosterAddDropTransaction).not.toHaveBeenCalled();
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(1);
  });

  // user with multiple teams, rosterModifications only
  it("should have two roster changes, no transactions", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }, { team_key: "test2" }];

    const rosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/Daily/oneSwapRequired.json"),
      require("./testRosters/NBA/Weekly/1SwapRequired1PlayerToMoveInto1EmptyRosterSpot.json"),
    ];
    const expectedRosterModifications: LineupChanges[] = [
      {
        coveragePeriod: "2023-02-28",
        coverageType: "date",
        newPlayerPositions: {
          "419.p.6726": "BN",
          "419.p.3737": "C",
        },
        teamKey: "419.l.28340.t.1",
      },
      {
        coveragePeriod: "2023-03-08",
        coverageType: "date",
        newPlayerPositions: {
          "418.p.5295": "PF",
          "418.p.4725": "BN",
          "418.p.6021": "G",
        },
        teamKey: "418.l.201581.t.1",
      },
    ];
    const spyFetchRostersFromYahoo = vi
      .spyOn(LineupBuilderService, "fetchRostersFromYahoo")
      .mockReturnValue(Promise.resolve(rosters));
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    await setUsersLineup(uid, teams as ITeamFirestore[]);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      expectedRosterModifications,
      uid
    );
    expect(spyPostRosterAddDropTransaction).not.toHaveBeenCalled();
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(1);
  });

  // - Drop players with same day transactions, lineup optimization (Intraday)
  it("should have one transaction, one refetch, then one lineup change (Intraday)", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }];

    // Set up mock data
    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScore.json"),
    ];
    const updatedRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/IntradayDrops/RefetchedRosters/dropTwoPlayersWithLowestScore.json"),
    ];
    const transaction1 = {
      players: [
        {
          playerKey: "419.p.7528",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Nick Suzuki to make room for Kevin Fiala coming back from injury.",
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };
    const transaction2 = {
      players: [
        {
          playerKey: "419.p.7903",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Barrett Hayton to make room for Kevin Fiala2 coming back from injury.",
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };

    const expectedLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-03-17",
        coverageType: "date",
        newPlayerPositions: {
          "419.p.6377": "BN",
          "419.p.63772": "BN",
        },
        teamKey: "419.l.19947.t.6",
      },
    ];

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(updatedRosters);
    });
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve() as any);
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    await setUsersLineup(uid, teams as ITeamFirestore[]);
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(2);

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(1);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      expectedLineupChanges,
      uid
    );

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(2);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction1,
      uid
    );
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction2,
      uid
    );
  });
  // - Drop players with next day transactions, with lineup optimization (Daily)
  it("should have one lineup change, then one refetch, then one drop (Daily)", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }];

    // Set up mock data
    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScoreAndOptimization.json"),
    ];
    const tomorrowRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/DailyDrops/RefetchedRosters/dropPlayerWithLowestScoreAndOptimization.json"),
    ];

    // we are moving the player from BN to D today, and then dropping tomorrow. No big deal.
    const expectedLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-03-17",
        coverageType: "date",
        newPlayerPositions: {
          "419.p.7155": "D",
          "419.p.5703": "BN",
        },
        teamKey: "419.l.28340.t.1",
      },
    ];
    const transaction1 = {
      players: [
        {
          playerKey: "419.p.7155",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Samuel Girard to make room for Kirill Kaprizov coming back from injury.",
      sameDayTransactions: true,
      teamKey: "419.l.28340.t.1",
    };

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(tomorrowRosters);
    });
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    await setUsersLineup(uid, teams as ITeamFirestore[]);
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(2);

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(1);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      expectedLineupChanges,
      uid
    );

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(1);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction1,
      uid
    );
  });

  it("should drop two players from IL since they were the worst, no other changes", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }, { team_key: "test2" }];

    // Set up mock data
    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScoreIL.json"),
      require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScoreAndOptimization.json"),
    ];
    const updatedRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScoreIL.json"),
      require("./testRosters/NHL/IntradayDrops/RefetchedRosters/dropTwoPlayersWithLowestScore.json"),
    ];
    const tomorrowRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/DailyDrops/RefetchedRosters/dropPlayerWithLowestScoreAndOptimization.json"),
    ];

    const transaction1 = {
      players: [
        {
          playerKey: "419.p.63772",
          transactionType: "drop",
          isInactiveList: true,
        },
      ],
      reason:
        "Dropping Kevin Fiala2 to make room for Kevin Fiala coming back from injury.",
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };
    const transaction2 = {
      players: [
        {
          playerKey: "419.p.6377",
          transactionType: "drop",
          isInactiveList: true,
        },
      ],
      reason:
        "Dropping Kevin Fiala to make room for Kevin Fiala2 coming back from injury.",
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(updatedRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(tomorrowRosters);
    });
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve() as any);
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    await setUsersLineup(uid, teams as ITeamFirestore[]);
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(3);

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(1);

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(3);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction1,
      uid
    );
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction2,
      uid
    );
  });

  it("should have one lineup change, then one refetch, then one drop (again)", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }];

    // Set up mock data
    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/NBA/Daily/oneDropRequiredWithOptimization.json"),
    ];
    const tomorrowRosters: ITeamOptimizer[] = [
      require("./testRosters/NBA/Daily/RefetchedRosters/oneDropRequiredWithOptimization.json"),
    ];

    const expectedLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-03-26",
        coverageType: "date",
        newPlayerPositions: {
          "418.p.5471": "BN",
          "418.p.5826": "Util",
        },
        teamKey: "418.l.201581.t.1",
      },
    ];
    const transaction1 = {
      players: [
        {
          playerKey: "418.p.6047",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Mitchell Robinson to make room for Zion Williamson coming back from injury.",
      sameDayTransactions: true,
      teamKey: "418.l.201581.t.1",
    };

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(tomorrowRosters);
    });
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    await setUsersLineup(uid, teams as ITeamFirestore[]);
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(2);

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(1);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      expectedLineupChanges,
      uid
    );

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(1);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction1,
      uid
    );
  });

  // user with multiple teams, playerTransactions and multiple calls to postRosterModifications (one intraday, one next day)
  it("should have one drop, refetch, two lineup changes, then refetch and drop (again)", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }, { team_key: "test2" }];

    // Set up mock data
    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScore.json"),
      require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScoreAndOptimization.json"),
    ];
    const updatedRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScore.json"),
      require("./testRosters/NHL/IntradayDrops/RefetchedRosters/dropTwoPlayersWithLowestScore.json"),
    ];
    const tomorrowRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/DailyDrops/RefetchedRosters/dropPlayerWithLowestScoreAndOptimization.json"),
    ];

    const expectedLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-03-17",
        coverageType: "date",
        newPlayerPositions: {
          "419.p.6377": "BN",
          "419.p.63772": "BN",
        },
        teamKey: "419.l.19947.t.6",
      },
      {
        coveragePeriod: "2023-03-17",
        coverageType: "date",
        newPlayerPositions: {
          "419.p.7155": "D",
          "419.p.5703": "BN",
        },
        teamKey: "419.l.28340.t.1",
      },
    ];

    const transaction1 = {
      players: [
        {
          playerKey: "419.p.7528",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Nick Suzuki to make room for Kevin Fiala coming back from injury.",
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };
    const transaction2 = {
      players: [
        {
          playerKey: "419.p.7903",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Barrett Hayton to make room for Kevin Fiala2 coming back from injury.",
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };
    const transaction3tomorrow = {
      players: [
        {
          playerKey: "419.p.7155",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Samuel Girard to make room for Kirill Kaprizov coming back from injury.",
      sameDayTransactions: true,
      teamKey: "419.l.28340.t.1",
    };

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(updatedRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(tomorrowRosters);
    });
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve() as any);
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    await setUsersLineup(uid, teams as ITeamFirestore[]);
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(3);

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(1);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      expectedLineupChanges,
      uid
    );

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(3);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction1,
      uid
    );
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction2,
      uid
    );
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction3tomorrow,
      uid
    );
  });

  it("should have two lineup changes, and no add drops because prop doesn't exist (legacy teams)", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }, { team_key: "test2" }];

    // Set up mock data
    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScoreNoDropProp.json"),
      require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScoreAndOptimizationNoDropProp.json"),
    ];

    const expectedLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-03-17",
        coverageType: "date",
        newPlayerPositions: {},
        teamKey: "419.l.19947.t.6",
      },
      {
        coveragePeriod: "2023-03-17",
        coverageType: "date",
        newPlayerPositions: {
          "419.p.7155": "D",
          "419.p.5703": "BN",
        },
        teamKey: "419.l.28340.t.1",
      },
    ];

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve() as any);
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    await setUsersLineup(uid, teams as ITeamFirestore[]);
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(1);

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(1);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      expectedLineupChanges,
      uid
    );

    expect(spyPostRosterAddDropTransaction).not.toHaveBeenCalled();
  });
  // TODO: Add tests for the following
  // - Drop players with same day transactions, with lineup optimization (NFL)
  // - Drop players with next day transactions, with lineup optimization (MLB)
});

function mapFirestoreTeams(team: any): ITeamFirestore {
  return {
    uid: "testUID",
    team_key: team.team_key,
    game_code: "testGameCode",
    start_date: 1,
    end_date: Number.MAX_SAFE_INTEGER,
    weekly_deadline: "testWeeklyDeadline",
    is_subscribed: false,
    is_setting_lineups: false,
    last_updated: Date.now(),
    allow_transactions: false,
    allow_dropping: false,
    allow_adding: false,
    allow_add_drops: false,
    allow_waiver_adds: false,
  };
}

describe("Full stack performTransactionsForWeeklyLeagues()", () => {
  it("should call performTransactionsForWeeklyLeagues() for each transaction", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }, { team_key: "test2" }].map(
      mapFirestoreTeams
    );

    const rosters = [
      require("./testRosters/NBA/WeeklyDrops/oneDropRequiredWithOptimization.json"),
      require("./testRosters/NBA/WeeklyDrops/oneDropRequiredWithOptimization.json"),
    ];

    const transaction1 = {
      players: [
        {
          playerKey: "418.p.6047",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Mitchell Robinson to make room for Zion Williamson coming back from injury.",
      sameDayTransactions: false,
      teamKey: "418.l.201581.t.1",
    };
    const transaction2 = {
      players: [
        {
          playerKey: "418.p.6047",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Mitchell Robinson to make room for Zion Williamson coming back from injury.",
      sameDayTransactions: false,
      teamKey: "418.l.201581.t.1",
    };

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(rosters);
    });

    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    await performWeeklyLeagueTransactions(uid, teams);
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(1);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(2);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction1,
      uid
    );
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction2,
      uid
    );
  });

  it("should eit.skip early with an empty teams array", async () => {
    const uid = "testUID";
    const teams: any[] = [];

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );

    const spyPostRosterAddDropTransaction = vi.spyOn(
      yahooAPI,
      "postRosterAddDropTransaction"
    );
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    await performWeeklyLeagueTransactions(uid, teams);
    expect(spyFetchRostersFromYahoo).not.toHaveBeenCalled();
    expect(spyPostRosterAddDropTransaction).not.toHaveBeenCalled();
  });
});

describe("Test Errors thrown in LineupBuilderService by API service", () => {
  it("should throw an error from the first fetchRostersFromYahoo() API call", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }];

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      throw new Error("Error from fetchRostersFromYahoo() test 1");
    });
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve() as any);
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    expect.assertions(4);
    try {
      await setUsersLineup(uid, teams as ITeamFirestore[]);
    } catch (error) {
      expect(error).toEqual(
        new Error("Error from fetchRostersFromYahoo() test 1")
      );
    }

    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(1);
    expect(spyPutLineupChanges).toHaveBeenCalledTimes(0);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(0);
  });

  it("should throw an error from the second fetchRostersFromYahoo() API call, after dropping a player first (Intraday)", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }];

    // Set up mock data
    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScore.json"),
    ];
    const transaction1 = {
      players: [
        {
          playerKey: "419.p.7528",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Nick Suzuki to make room for Kevin Fiala coming back from injury.",
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };
    const transaction2 = {
      players: [
        {
          playerKey: "419.p.7903",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Barrett Hayton to make room for Kevin Fiala2 coming back from injury.",
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      console.log("throwing error");
      throw new Error("Error from fetchRostersFromYahoo() test 2");
    });
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    expect.assertions(6);
    try {
      await setUsersLineup(uid, teams as ITeamFirestore[]);
    } catch (error) {
      expect(error).toEqual(
        new Error("Error from fetchRostersFromYahoo() test 2")
      );
    }

    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(2);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(2);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction1,
      uid
    );
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction2,
      uid
    );
    expect(spyPutLineupChanges).toHaveBeenCalledTimes(0);
  });

  it("should have two roster changes, and then fail to put changes", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }, { team_key: "test2" }];

    const rosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/Daily/oneSwapRequired.json"),
      require("./testRosters/NBA/Weekly/1SwapRequired1PlayerToMoveInto1EmptyRosterSpot.json"),
    ];
    const expectedRosterModifications: LineupChanges[] = [
      {
        coveragePeriod: "2023-02-28",
        coverageType: "date",
        newPlayerPositions: {
          "419.p.6726": "BN",
          "419.p.3737": "C",
        },
        teamKey: "419.l.28340.t.1",
      },
      {
        coveragePeriod: "2023-03-08",
        coverageType: "date",
        newPlayerPositions: {
          "418.p.5295": "PF",
          "418.p.4725": "BN",
          "418.p.6021": "G",
        },
        teamKey: "418.l.201581.t.1",
      },
    ];
    const spyFetchRostersFromYahoo = vi
      .spyOn(LineupBuilderService, "fetchRostersFromYahoo")
      .mockReturnValue(Promise.resolve(rosters));
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockImplementation(() => {
        throw new Error("Error from putLineupChanges() test 3");
      });
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // test
    expect.assertions(4);
    try {
      await setUsersLineup(uid, teams as ITeamFirestore[]);
    } catch (error) {
      expect(error).toEqual(new Error("Error from putLineupChanges() test 3"));
    }
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      expectedRosterModifications,
      uid
    );
    expect(spyPostRosterAddDropTransaction).not.toHaveBeenCalled();
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(1);
  });

  it("should have one failed transaction, one refetch, then continue to lineup change (Intraday)", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }];

    // Set up mock data
    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScore.json"),
    ];
    const updatedRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/IntradayDrops/RefetchedRosters/dropTwoPlayersWithLowestScore.json"),
    ];
    const transaction1 = {
      players: [
        {
          playerKey: "419.p.7528",
          transactionType: "drop",
          isInactiveList: false,
        },
      ],
      reason:
        "Dropping Nick Suzuki to make room for Kevin Fiala coming back from injury.",
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };

    const expectedLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-03-17",
        coverageType: "date",
        newPlayerPositions: {
          "419.p.6377": "BN",
          "419.p.63772": "BN",
        },
        teamKey: "419.l.19947.t.6",
      },
    ];

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(updatedRosters);
    });
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockImplementation(() => {
        throw new Error("Error from postRosterAddDropTransaction() test 4");
      });
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    await setUsersLineup(uid, teams as ITeamFirestore[]);

    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(2);

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(1);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      expectedLineupChanges,
      uid
    );

    // Will stop after first failed transaction, but allow the rest of the function to continue
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(1);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction1,
      uid
    );
  });

  it("should have one failed lineup change, then not proceed to required drops (Daily)", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }];

    // Set up mock data
    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScoreAndOptimization.json"),
    ];

    // we are moving the player from BN to D today, and then dropping tomorrow. No big deal.
    const expectedLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-03-17",
        coverageType: "date",
        newPlayerPositions: {
          "419.p.7155": "D",
          "419.p.5703": "BN",
        },
        teamKey: "419.l.28340.t.1",
      },
    ];

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    const spyPostRosterAddDropTransaction = vi
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve() as any);
    const spyPutLineupChanges = vi
      .spyOn(yahooAPI, "putLineupChanges")
      .mockImplementation(() => {
        throw new Error("Error from putLineupChanges() test 5");
      });
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    expect.assertions(5);
    try {
      await setUsersLineup(uid, teams as ITeamFirestore[]);
    } catch (error) {
      expect(error).toEqual(new Error("Error from putLineupChanges() test 5"));
    }

    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(1);

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(1);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      expectedLineupChanges,
      uid
    );

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(0);
  });
});
