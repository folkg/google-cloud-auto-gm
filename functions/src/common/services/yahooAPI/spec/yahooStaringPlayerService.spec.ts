import { fetchStartingPlayers } from "../yahooStartingPlayer.service";

// mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

describe("Test setStartingPlayers()", function () {
  const intradayTeamsObject = {
    docs: [
      {
        id: "nhl.l.123.t.1",
        data: () => ({
          uid: "123",
          weekly_deadline: "intraday",
          game: "nhl",
        }),
      },
    ],
  };

  const startingPlayersArray = [
    "422.p.8590",
    "422.p.8780",
    "422.p.8856",
    "422.p.8918",
    "422.p.9007",
    "422.p.9124",
    "422.p.9329",
    "422.p.9334",
    "422.p.9459",
    "422.p.9640",
    "422.p.9931",
    "422.p.10141",
    "422.p.10180",
    "422.p.10592",
    "422.p.10730",
    "422.p.60002",
    "422.p.10869",
    "422.p.10903",
    "422.p.10926",
    "422.p.11202",
    "422.p.11381",
    "422.p.11428",
    "422.p.11478",
    "422.p.11480",
    "422.p.11608",
    "422.p.11750",
    "422.p.12215",
    "422.p.12281",
    "422.p.7578",
    "422.p.8180",
  ];
  const startingPlayersObject = require("./startingPlayersObject.json");

  const firestoreService = require("../../firebase/firestore.service");
  const spyGetIntradayTeams = jest.spyOn(firestoreService, "getIntradayTeams");
  const spyStoreStartingPlayersInFirestore = jest.spyOn(
    firestoreService,
    "storeStartingPlayersInFirestore"
  );

  spyGetIntradayTeams.mockImplementation(() =>
    Promise.resolve(intradayTeamsObject)
  );
  spyStoreStartingPlayersInFirestore.mockImplementation(() =>
    Promise.resolve()
  );
  jest
    .spyOn(require("../../yahooAPI/yahooAPI.service"), "getStartingPlayers")
    .mockImplementation(() => Promise.resolve(startingPlayersObject));

  afterEach(() => {
    // restore the spy created with spyOn
    spyGetIntradayTeams.mockClear();
    spyStoreStartingPlayersInFirestore.mockClear();
  });

  test("test NHL setStartingPlayers", async function () {
    const league = "nhl";
    await fetchStartingPlayers(league);
    expect(spyGetIntradayTeams).toHaveBeenCalledWith(league);
    expect(spyStoreStartingPlayersInFirestore).toHaveBeenCalledTimes(1);
    expect(spyStoreStartingPlayersInFirestore).toHaveBeenCalledWith(
      startingPlayersArray,
      league
    );
  });
  test("test MLB setStartingPlayers", async function () {
    const league = "mlb";
    await fetchStartingPlayers(league);
    expect(spyGetIntradayTeams).toHaveBeenCalledWith(league);
    expect(spyStoreStartingPlayersInFirestore).toHaveBeenCalledTimes(1);
    expect(spyStoreStartingPlayersInFirestore).toHaveBeenCalledWith(
      startingPlayersArray,
      league
    );
  });
  test("test NBA setStartingPlayers", async function () {
    const league = "nba";
    await fetchStartingPlayers(league);
    expect(spyGetIntradayTeams).toHaveBeenCalledWith(league);
    expect(spyStoreStartingPlayersInFirestore).not.toHaveBeenCalled();
  });
});
