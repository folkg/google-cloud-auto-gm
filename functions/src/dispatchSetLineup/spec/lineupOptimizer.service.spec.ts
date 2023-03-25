import { LineupChanges } from "../interfaces/LineupChanges";
import { ITeam } from "../interfaces/ITeam";
import { setUsersLineup } from "../services/lineupOptimizer.service";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

// mock initialize starting goalies
jest.mock("../../common/services/yahooAPI/yahooStartingGoalie.service", () => ({
  initStartingGoalies: jest.fn(() => Promise.resolve()),
  getNHLStartingGoalies: jest.fn().mockReturnValue([]),
}));

// To mock and spy on yahooAPI calls
const yahooAPI = require("../../common/services/yahooAPI/yahooAPI.service");

// To mock and spy on the fetchRostersFromYahoo() and return a roster object for testing
const LineupBuilderService = require("../services/yahooLineupBuilder.service");

describe("Full Stack Add Drop Tests", () => {
  afterEach(() => {
    // restore the spy created with spyOn
    jest.restoreAllMocks();
  });

  it("should do nothing for already optimal lineup", async () => {
    const uid = "testUID";
    const teams = ["test1"];

    const rosters: ITeam[] = [
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
    const teams = ["test1", "test2"];

    const rosters: ITeam[] = [
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
    const teams = ["test1", "test2"];

    const rosters: ITeam[] = [
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
  it("should have one transaction, one refetch, then one lineup change", async () => {
    const uid = "testUID";
    const teams = ["test1"];

    // Set up mock data
    const initialRosters: ITeam[] = [
      require("./testRosters/NHL/IntradayDrops/dropTwoPlayersWithLowestScore.json"),
    ];
    const updatedRosters: ITeam[] = [
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
  it("should have one lineup change, then one refetch, then one drop", async () => {
    const uid = "testUID";
    const teams = ["test1"];

    // Set up mock data
    // TODO: Fill in all the missing data
    const initialRosters: ITeam[] = [require("?")];
    const updatedRosters: ITeam[] = [require("?")];
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

  // - Drop players with next day transactions, with lineup optimization (Weekly)
  // - Drop players with next day transactions, no lineup optimization (Weekly)
  // user with multiple teams, playerTransactions and multiple calls to postRosterModifications (one intraday, one next day)
  // Lineup optimization only because add/drops DISALLOWED. Check that it doesn't call postRosterModifications and only fetchesYahooRsotrts once. Duplicate test 3

  // TODO: Add tests for the following
  // - Drop players with same day transactions, with lineup optimization (NFL)
  // - Drop players with contious waivers, no lineup optimization (Intraday)
  // - Drop players with contious waivers, with lineup optimization (Intraday)
});
