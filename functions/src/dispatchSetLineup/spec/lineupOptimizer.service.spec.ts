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
import * as TopAvailablePlayersService from "../services/yahooTopAvailablePlayersBuilder.service.js";

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

// mock initialize starting goalies/pitchers
vi.mock("../../common/services/yahooAPI/yahooStartingPlayer.service", () => ({
  initStartingGoalies: vi.fn(() => Promise.resolve()),
  initStartingPitchers: vi.fn(() => Promise.resolve()),
  getNHLStartingGoalies: vi.fn().mockReturnValue([]),
  getMLBStartingPitchers: vi.fn().mockReturnValue([]),
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
    expect(spyPutLineupChanges).not.toHaveBeenCalled();
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
    expect(spyPutLineupChanges).not.toHaveBeenCalled();
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

  it("Drop one player to make room for healthy on IR (daily)", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }, { team_key: "test2" }];

    // Set up mock data
    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScoreAndOptimization.json"),
    ];
    const tomorrowRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/DailyDrops/RefetchedRosters/dropPlayerWithLowestScoreAndOptimization.json"),
    ];

    const transaction1 = {
      players: [
        {
          isInactiveList: false,
          playerKey: "419.p.7155",
          transactionType: "drop",
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
      .mockReturnValue(Promise.resolve() as any);
    vi.spyOn(yahooAPI, "getTopAvailablePlayers").mockReturnValue(
      Promise.resolve()
    );

    // Run test
    await setUsersLineup(uid, teams as ITeamFirestore[]);
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(2);

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(1);

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(1);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction1,
      uid
    );
  });

  it("should drop none, since the worst player is the healthy player on IL", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }, { team_key: "test2" }];

    // Set up mock data
    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScoreAndOptimization2.json"),
    ];
    const tomorrowRosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/DailyDrops/RefetchedRosters/dropPlayerWithLowestScoreAndOptimization.json"),
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
    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(1);

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(1);

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(0);
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
      require("./testRosters/NHL/IntradayDrops/RefetchedRosters/dropTwoPlayersWithLowestScore.json"),
      require("./testRosters/NHL/DailyDrops/dropPlayerWithLowestScoreAndOptimization.json"),
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

  it("should add one player and then move them to the active roster (Intraday)", async () => {
    const uid = "testUID";
    const teams = [
      { team_key: "422.l.115494.t.4", allow_adding: true, game_code: "MLB" },
    ];
    const transaction1 = {
      players: [
        {
          isInactiveList: false,
          isFromWaivers: false,
          playerKey: "422.p.10234",
          transactionType: "add",
        },
      ],
      reason:
        "Moved Freddy Peralta to the inactive list to make room to add Dansby Swanson",
      sameDayTransactions: true,
      teamKey: "422.l.115494.t.4",
      isFaabRequired: true,
    };
    const addPlayerLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-04-07",
        coverageType: "date",
        newPlayerPositions: {
          "422.p.10660": "IL",
          "422.p.106602": "BN",
          "422.p.11014": "IL+",
        },
        teamKey: "422.l.115494.t.4",
      },
    ];
    const optimizationLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-04-07",
        coverageType: "date",
        newPlayerPositions: {
          "422.p.10234": "Util",
          "422.p.11251": "P",
          "422.p.9876": "BN",
        },
        teamKey: "422.l.115494.t.4",
      },
    ];

    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );

    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/MLB/AddBestPlayer.json"),
    ];
    const updatedRosters: ITeamOptimizer[] = [
      require("./testRosters/MLB/AddBestPlayer-refetched.json"),
    ];
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(updatedRosters);
    });

    const spyFetchTopAvailablePlayers = vi.spyOn(
      TopAvailablePlayersService,
      "fetchTopAvailablePlayersFromYahoo"
    );
    const topAvailablePlayersPromise = require("./topAvailablePlayers/promises/topAvailablePlayersPromise1.json");
    const restTopAvailablePlayersPromise = require("./topAvailablePlayers/promises/restTopAvailablePlayersPromise1.json");
    spyFetchTopAvailablePlayers.mockImplementationOnce(() => {
      return Promise.resolve(topAvailablePlayersPromise);
    });
    spyFetchTopAvailablePlayers.mockImplementationOnce(() => {
      return Promise.resolve(restTopAvailablePlayersPromise);
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
    expect(spyFetchTopAvailablePlayers).toHaveBeenCalledTimes(2);

    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(2);

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(1);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction1,
      uid
    );

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(2);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      addPlayerLineupChanges,
      uid
    );
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      optimizationLineupChanges,
      uid
    );
  });

  it("should add one player by moving other to IL, then swap 3 others, and then optimize the active roster (Intraday)", async () => {
    const uid = "testUID";
    const teams = [
      {
        team_key: "422.l.119198.t.3",
        allow_dropping: true,
        allow_adding: true,
        allow_add_drops: true,
        allow_waiver_adds: true,
        game_code: "MLB",
      },
    ];
    const transactions = [
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.10234",
            transactionType: "add",
          },
        ],
        reason:
          "Moved Alex Cobb to the inactive list to make room to add Dansby Swanson",
        sameDayTransactions: true,
        teamKey: "422.l.119198.t.3",
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.10666",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.12339",
            transactionType: "drop",
          },
        ],
        reason:
          "Adding Anthony Santander (OF, Util, BN) [61.78] and dropping James Outman (OF, Util, BN) [38.01].",
        sameDayTransactions: true,
        teamKey: "422.l.119198.t.3",
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.12024",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.9557",
            transactionType: "drop",
          },
        ],
        reason:
          "Adding Jordan Walker (3B, OF, Util, BN) [57.70] and dropping Javier Báez (SS, Util, BN) [38.58].",
        sameDayTransactions: true,
        teamKey: "422.l.119198.t.3",
      },
      {
        isFaabRequired: true,
        players: [
          {
            isFromWaivers: false,
            isInactiveList: false,
            playerKey: "422.p.9331",
            transactionType: "add",
          },
          {
            isInactiveList: false,
            playerKey: "422.p.8918",
            transactionType: "drop",
          },
        ],
        reason:
          "Adding James Paxton (SP, P, BN) [50.03] and dropping Alex Cobb (SP, P, BN, IL) [27.88].",
        sameDayTransactions: true,
        teamKey: "422.l.119198.t.3",
      },
    ];

    const addPlayerLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-04-07",
        coverageType: "date",
        newPlayerPositions: {
          "422.p.11014": "IL",
        },
        teamKey: "422.l.119198.t.3",
      },
    ];
    const optimizationLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-04-07",
        coverageType: "date",
        newPlayerPositions: {
          "422.p.10234": "Util",
          "422.p.11251": "P",
          "422.p.9876": "BN",
        },
        teamKey: "422.l.119198.t.3",
      },
    ];

    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );

    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/MLB/free1spotILswap.json"),
    ];
    const updatedRosters: ITeamOptimizer[] = [
      require("./testRosters/MLB/free1spotILswap-refetched.json"),
    ];
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(updatedRosters);
    });

    const spyFetchTopAvailablePlayers = vi.spyOn(
      TopAvailablePlayersService,
      "fetchTopAvailablePlayersFromYahoo"
    );
    const topAvailablePlayersPromise = require("./topAvailablePlayers/promises/topAvailablePlayersPromise2.json");
    const restTopAvailablePlayersPromise = require("./topAvailablePlayers/promises/restTopAvailablePlayersPromise2.json");
    spyFetchTopAvailablePlayers.mockImplementationOnce(() => {
      return Promise.resolve(topAvailablePlayersPromise);
    });
    spyFetchTopAvailablePlayers.mockImplementationOnce(() => {
      return Promise.resolve(restTopAvailablePlayersPromise);
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
    expect(spyFetchTopAvailablePlayers).toHaveBeenCalledTimes(2);

    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(2);

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(4);
    for (const transaction of transactions) {
      expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
        transaction,
        uid
      );
    }
    expect(spyPutLineupChanges).toHaveBeenCalledTimes(2);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      addPlayerLineupChanges,
      uid
    );
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      optimizationLineupChanges,
      uid
    );
  });

  it("should drop one player to make room for healthy on IL, post the lineup changes, then perform some swaps", async () => {
    const uid = "testUID";
    const teams = [
      {
        team_key: "422.l.115494.t.4",
        allow_dropping: true,
        allow_adding: true,
        allow_add_drops: true,
        allow_waiver_adds: true,
        game_code: "MLB",
      },
    ];
    const transactions = [
      {
        teamKey: "422.l.115494.t.4",
        sameDayTransactions: true,
        reason:
          "Dropping Brendan Donovan to make room for Kris Bryant coming back from injury.",
        players: [
          {
            playerKey: "422.p.12351",
            transactionType: "drop",
            isInactiveList: false,
          },
        ],
      },
      {
        teamKey: "422.l.115494.t.4",
        sameDayTransactions: true,
        reason:
          "Adding Bobby Miller (SP, P, BN) [54.79] and dropping Kris Bryant (OF, Util, BN) [29.83].",
        isFaabRequired: true,
        players: [
          {
            playerKey: "422.p.12037",
            transactionType: "add",
            isInactiveList: false,
            isFromWaivers: true,
          },
          {
            playerKey: "422.p.9558",
            transactionType: "drop",
            isInactiveList: false,
          },
        ],
      },
      {
        teamKey: "422.l.115494.t.4",
        sameDayTransactions: true,
        reason:
          "Adding José Alvarado (RP, P, BN) [30.87] and dropping Josh Sborz (RP, P, BN) [15.81].",
        isFaabRequired: true,
        players: [
          {
            playerKey: "422.p.10692",
            transactionType: "add",
            isInactiveList: false,
            isFromWaivers: true,
          },
          {
            playerKey: "422.p.11214",
            transactionType: "drop",
            isInactiveList: false,
          },
        ],
      },
    ];

    const dropPlayerLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-06-30",
        coverageType: "date",
        newPlayerPositions: {
          "422.p.9558": "BN",
        },
        teamKey: "422.l.115494.t.4",
      },
    ];

    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );

    const initialRosters: ITeamOptimizer[] = [
      require("./problematicAddDrop/moveILtoBN-lineup.json"),
    ];
    const updatedRosters: ITeamOptimizer[] = [
      require("./problematicAddDrop/moveILtoBN-lineup2.json"),
    ];

    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(updatedRosters);
    });

    const spyFetchTopAvailablePlayers = vi.spyOn(
      TopAvailablePlayersService,
      "fetchTopAvailablePlayersFromYahoo"
    );
    const topAvailablePlayersPromise = require("./problematicAddDrop/healthyOnILShouldBeIllegal-addcandidates.json");
    spyFetchTopAvailablePlayers.mockImplementationOnce(() => {
      return Promise.resolve(topAvailablePlayersPromise);
    });
    spyFetchTopAvailablePlayers.mockImplementationOnce(() => {
      return Promise.resolve({});
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
    expect(spyFetchTopAvailablePlayers).toHaveBeenCalledTimes(2);

    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(2);

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(3);
    for (const transaction of transactions) {
      expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
        transaction,
        uid
      );
    }

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(2);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      dropPlayerLineupChanges,
      uid
    );
  });

  it("should add one player and then move them to the active roster (Next Day)", async () => {
    const uid = "testUID";
    const teams = [
      {
        team_key: "422.l.115494.t.4",
        allow_adding: true,
        allow_dropping: true,
        allow_transactions: true,
        allow_add_drops: true,
        allow_waiver_adds: true,
        game_code: "MLB",
      },
    ];
    const transaction1 = {
      players: [
        {
          isInactiveList: false,
          isFromWaivers: false,
          playerKey: "422.p.10234",
          transactionType: "add",
        },
      ],
      reason:
        "Moved Freddy Peralta to the inactive list to make room to add Dansby Swanson",
      sameDayTransactions: true,
      teamKey: "422.l.115494.t.4",
      isFaabRequired: true,
    };
    const optimizationLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-04-08",
        coverageType: "date",
        newPlayerPositions: {
          "422.p.10660": "IL",
          "422.p.106602": "BN",
          "422.p.11014": "IL+",
        },
        teamKey: "422.l.115494.t.4",
      },
    ];
    const addPlayerLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-04-08",
        coverageType: "date",
        newPlayerPositions: {
          "422.p.10660": "IL",
          "422.p.106602": "BN",
          "422.p.11014": "IL+",
        },
        teamKey: "422.l.115494.t.4",
      },
    ];

    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );

    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/MLB/AddBestPlayerDaily.json"),
    ];
    const tomorrowRosters: ITeamOptimizer[] = [
      require("./testRosters/MLB/AddBestPlayerDaily-refetched.json"),
    ];
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(tomorrowRosters);
    });

    const spyFetchTopAvailablePlayers = vi.spyOn(
      TopAvailablePlayersService,
      "fetchTopAvailablePlayersFromYahoo"
    );
    const topAvailablePlayersPromise = require("./topAvailablePlayers/promises/topAvailablePlayersPromise1.json");
    const restTopAvailablePlayersPromise = require("./topAvailablePlayers/promises/restTopAvailablePlayersPromise1.json");
    spyFetchTopAvailablePlayers.mockImplementationOnce(() => {
      return Promise.resolve(topAvailablePlayersPromise);
    });
    spyFetchTopAvailablePlayers.mockImplementationOnce(() => {
      return Promise.resolve(restTopAvailablePlayersPromise);
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
    expect(spyFetchTopAvailablePlayers).toHaveBeenCalledTimes(2);

    expect(spyFetchRostersFromYahoo).toHaveBeenCalledTimes(2);

    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(1);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledWith(
      transaction1,
      uid
    );

    expect(spyPutLineupChanges).toHaveBeenCalledTimes(2);
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      optimizationLineupChanges,
      uid
    );
    expect(spyPutLineupChanges).toHaveBeenCalledWith(
      addPlayerLineupChanges,
      uid
    );
  });

  it("should not add anyone (but still optimize) since user setting does not allow for adds", async () => {
    const uid = "testUID";
    const teams = [
      { team_key: "422.l.115494.t.4", allow_adding: false, game_code: "MLB" },
    ];

    const optimizationLineupChanges: LineupChanges[] = [
      {
        coveragePeriod: "2023-04-07",
        coverageType: "date",
        newPlayerPositions: {
          "422.p.10660": "IL",
          "422.p.106602": "BN",
          "422.p.11014": "BN",
          "422.p.11251": "P",
        },
        teamKey: "422.l.115494.t.4",
      },
    ];

    const spyFetchRostersFromYahoo = vi.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );

    const initialRosters: ITeamOptimizer[] = [
      require("./testRosters/MLB/AddBestPlayer.json"),
    ];
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });

    const spyFetchTopAvailablePlayers = vi.spyOn(
      TopAvailablePlayersService,
      "fetchTopAvailablePlayersFromYahoo"
    );

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
      optimizationLineupChanges,
      uid
    );

    expect(spyFetchTopAvailablePlayers).toHaveBeenCalledTimes(0);
    expect(spyPostRosterAddDropTransaction).toHaveBeenCalledTimes(0);
  });
});

describe("Full stack performTransactionsForWeeklyLeagues()", () => {
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
      optimization_level: 2,
      allow_transactions: false,
      allow_dropping: false,
      allow_adding: false,
      allow_add_drops: false,
      allow_waiver_adds: false,
    };
  }
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

  it("should exit early with an empty teams array", async () => {
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
