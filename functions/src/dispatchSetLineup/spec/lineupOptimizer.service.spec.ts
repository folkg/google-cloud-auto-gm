import { LineupChanges } from "../interfaces/LineupChanges";
import { ITeamOptimizer } from "../../common/interfaces/ITeam";
import {
  performWeeklyLeagueTransactions,
  setUsersLineup,
} from "../services/setLineups.service";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

// mock initialize starting goalies
jest.mock("../../common/services/yahooAPI/yahooStartingPlayer.service", () => ({
  initStartingGoalies: jest.fn(() => Promise.resolve()),
  getNHLStartingGoalies: jest.fn().mockReturnValue([]),
}));

// mock Firestore services
const spyUpdateTeamFirestore = jest
  .spyOn(
    require("../../common/services/firebase/firestore.service"),
    "updateTeamFirestore"
  )
  .mockImplementation(() => Promise.resolve());

// To mock and spy on yahooAPI calls
const yahooAPI = require("../../common/services/yahooAPI/yahooAPI.service");

// To mock and spy on the fetchRostersFromYahoo() and return a roster object for testing
const LineupBuilderService = require("../services/yahooLineupBuilder.service");

describe("Full Stack Add Drop Tests in setUsersLineup()", () => {
  afterEach(() => {
    // restore the spy created with spyOn
    jest.restoreAllMocks();
  });

  // Notes:
  // fetchRostersFromYahoo() should throw an error and cause the function to exit.
  // putLineupChanges() should throw an error and cause the function to exit.
  // postRosterAddDropTransaction() should have caught errors and allow the function to continue.
  it("should patch differences between Yahoo and Firestore teams", async () => {
    const uid = "testUID";
    const teamKey = "419.l.28340.t.1";
    const teams = [{ uid, team_key: teamKey, start_date: 1, end_date: 1 }];

    const rosters: ITeamOptimizer[] = [
      require("./testRosters/NHL/Daily/optimalRoster.json"),
    ];

    const spyFetchRostersFromYahoo = jest
      .spyOn(LineupBuilderService, "fetchRostersFromYahoo")
      .mockReturnValue(Promise.resolve(rosters));

    // mock the API calls
    jest.spyOn(yahooAPI, "putLineupChanges").mockReturnValue(Promise.resolve());
    jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());

    await setUsersLineup(uid, teams);
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
    const spyFetchRostersFromYahoo = jest
      .spyOn(LineupBuilderService, "fetchRostersFromYahoo")
      .mockReturnValue(Promise.resolve(rosters));
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());

    await setUsersLineup(uid, teams);
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
    const spyFetchRostersFromYahoo = jest
      .spyOn(LineupBuilderService, "fetchRostersFromYahoo")
      .mockReturnValue(Promise.resolve(rosters));
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());

    await setUsersLineup(uid, teams);
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
    const spyFetchRostersFromYahoo = jest
      .spyOn(LineupBuilderService, "fetchRostersFromYahoo")
      .mockReturnValue(Promise.resolve(rosters));
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());

    await setUsersLineup(uid, teams);
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
        },
      ],
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };
    const transaction2 = {
      players: [
        {
          playerKey: "419.p.7903",
          transactionType: "drop",
        },
      ],
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
    const spyFetchRostersFromYahoo = jest.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(updatedRosters);
    });
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());

    // Run test
    await setUsersLineup(uid, teams);
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
        },
      ],
      sameDayTransactions: true,
      teamKey: "419.l.28340.t.1",
    };

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = jest.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(tomorrowRosters);
    });
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());

    // Run test
    await setUsersLineup(uid, teams);
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
        },
      ],
      sameDayTransactions: true,
      teamKey: "418.l.201581.t.1",
    };

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = jest.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(tomorrowRosters);
    });
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());

    // Run test
    await setUsersLineup(uid, teams);
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
        },
      ],
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };
    const transaction2 = {
      players: [
        {
          playerKey: "419.p.7903",
          transactionType: "drop",
        },
      ],
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };
    const transaction3tomorrow = {
      players: [
        {
          playerKey: "419.p.7155",
          transactionType: "drop",
        },
      ],
      sameDayTransactions: true,
      teamKey: "419.l.28340.t.1",
    };

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = jest.spyOn(
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
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());

    // Run test
    await setUsersLineup(uid, teams);
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
    const spyFetchRostersFromYahoo = jest.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());

    // Run test
    await setUsersLineup(uid, teams);
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

describe("Full stack performTransactionsForWeeklyLeagues()", () => {
  afterEach(() => {
    // restore the spy created with spyOn
    jest.restoreAllMocks();
  });

  it("should call performTransactionsForWeeklyLeagues() for each transaction", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }, { team_key: "test2" }];

    const rosters = [
      require("./testRosters/NBA/WeeklyDrops/oneDropRequiredWithOptimization.json"),
      require("./testRosters/NBA/WeeklyDrops/oneDropRequiredWithOptimization.json"),
    ];

    const transaction1 = {
      players: [
        {
          playerKey: "418.p.6047",
          transactionType: "drop",
        },
      ],
      sameDayTransactions: false,
      teamKey: "418.l.201581.t.1",
    };
    const transaction2 = {
      players: [
        {
          playerKey: "418.p.6047",
          transactionType: "drop",
        },
      ],
      sameDayTransactions: false,
      teamKey: "418.l.201581.t.1",
    };

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = jest.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(rosters);
    });

    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());

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
    const spyFetchRostersFromYahoo = jest.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );

    const spyPostRosterAddDropTransaction = jest.spyOn(
      yahooAPI,
      "postRosterAddDropTransaction"
    );

    // Run test
    await performWeeklyLeagueTransactions(uid, teams);
    expect(spyFetchRostersFromYahoo).not.toHaveBeenCalled();
    expect(spyPostRosterAddDropTransaction).not.toHaveBeenCalled();
  });
});

describe("Test Errors thrown in LineupBuilderService by API service", () => {
  afterEach(() => {
    // restore the spy created with spyOn
    jest.restoreAllMocks();
  });

  it("should throw an error from the first fetchRostersFromYahoo() API call", async () => {
    const uid = "testUID";
    const teams = [{ team_key: "test1" }];

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = jest.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      throw new Error("Error from fetchRostersFromYahoo() test 1");
    });
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());

    // Run test
    expect.assertions(4);
    try {
      await setUsersLineup(uid, teams);
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
        },
      ],
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };
    const transaction2 = {
      players: [
        {
          playerKey: "419.p.7903",
          transactionType: "drop",
        },
      ],
      sameDayTransactions: true,
      teamKey: "419.l.19947.t.6",
    };

    // Set up spies and mocks
    const spyFetchRostersFromYahoo = jest.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      throw new Error("Error from fetchRostersFromYahoo() test 2");
    });
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());

    // Run test
    expect.assertions(6);
    try {
      await setUsersLineup(uid, teams);
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
    const spyFetchRostersFromYahoo = jest
      .spyOn(LineupBuilderService, "fetchRostersFromYahoo")
      .mockReturnValue(Promise.resolve(rosters));
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockImplementation(() => {
        throw new Error("Error from putLineupChanges() test 3");
      });
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());

    // test
    expect.assertions(4);
    try {
      await setUsersLineup(uid, teams);
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
        },
      ],
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
    const spyFetchRostersFromYahoo = jest.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(updatedRosters);
    });
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockImplementation(() => {
        throw new Error("Error from postRosterAddDropTransaction() test 4");
      });
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockReturnValue(Promise.resolve());

    // Run test
    await setUsersLineup(uid, teams);

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
    const spyFetchRostersFromYahoo = jest.spyOn(
      LineupBuilderService,
      "fetchRostersFromYahoo"
    );
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve(initialRosters);
    });
    spyFetchRostersFromYahoo.mockImplementationOnce(() => {
      return Promise.resolve([]);
    });
    const spyPostRosterAddDropTransaction = jest
      .spyOn(yahooAPI, "postRosterAddDropTransaction")
      .mockReturnValue(Promise.resolve());
    const spyPutLineupChanges = jest
      .spyOn(yahooAPI, "putLineupChanges")
      .mockImplementation(() => {
        throw new Error("Error from putLineupChanges() test 5");
      });

    // Run test
    expect.assertions(5);
    try {
      await setUsersLineup(uid, teams);
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
