import { RosterModification } from "../interfaces/RosterModification";
import { Team } from "../interfaces/Team";
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

// To mock postRosterModifications
const yahooAPI = require("../../common/services/yahooAPI/yahooAPI.service");

// To mock the fetchRostersFromYahoo() and return a roster object for testing
const LineupBuilderService = require("../services/yahooLineupBuilder.service");

describe("LineupOptimizerService full stack", () => {
  afterEach(() => {
    // restore the spy created with spyOn
    jest.restoreAllMocks();
  });

  it("should do nothing for already optimal lineup", async () => {
    const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1"; // Graeme Folk
    const teams = ["419.l.28340.t.1"]; // Graeme Folk

    const roster: Team[] = [
      require("./testRosters/NHL/Daily/optimalRoster.json"),
    ];
    jest
      .spyOn(LineupBuilderService, "fetchRostersFromYahoo")
      .mockReturnValue(Promise.resolve(roster));

    const expectedRosterModifications: RosterModification[] = [
      {
        coveragePeriod: "2023-02-28",
        coverageType: "date",
        newPlayerPositions: {},
        teamKey: "419.l.28340.t.1",
      },
    ];
    const spyPostRosterModifications = jest
      .spyOn(yahooAPI, "postRosterModifications")
      .mockReturnValue(Promise.resolve());

    await setUsersLineup(uid, teams);
    expect(spyPostRosterModifications).toHaveBeenCalledWith(
      expectedRosterModifications,
      uid
    );
  });

  // TODO: Add tests where we call on multiple rosters no changes, single and multiple rosters with simple modifications
  // TODO: Add tests where we add in playerTransactions and multiple calls to postRosterModifications
});
