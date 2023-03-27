// required to initialize firebase-admin and firestore
// import "./firebase";
import { postRosterAddDropTransaction } from "../yahooAPI.service";
const js2xmlparser = require("js2xmlparser");

// if we want to run the first test with the actual API, we need to uncomment the import firebase above, and comment out the below.
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

const yahooHttpService = require("../yahooHttp.service");
describe("YahooAPI Service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Danger: This test will actually perform API calls to Yahoo! and will drop players if not mocked.
  xit("should actually make a move in Yahoo", async () => {
    const uid = "xAyXmaHKO3aRm9J3fnj2rgZRPnX2"; // Jeff Barnes

    const transaction = {
      sameDayTransactions: true,
      teamKey: "418.l.201581.t.1",
      players: [
        {
          playerKey: "418.p.5295",
          transactionType: "drop",
        },
        {
          playerKey: "418.p.5069",
          transactionType: "add",
        },
      ],
    };

    expect.assertions(1);
    let result = false;
    try {
      result = await postRosterAddDropTransaction(transaction, uid);
      console.log("result: " + result);
    } catch (err) {
      console.error(err);
      expect(err).toBeDefined();
    }
    expect(result).toBe(true);
  });

  it("should call API to drop players", async () => {
    const uid = "xAyXmaHKO3aRm9J3fnj2rgZRPnX2"; // Jeff Barnes

    const expectedJSON = {
      transaction: {
        type: "drop",
        player: {
          player_key: "418.p.6047",
          transaction_data: {
            type: "drop",
            source_team_key: "418.l.201581.t.1",
          },
        },
      },
    };
    const expectedXML = js2xmlparser.parse("fantasy_content", expectedJSON);

    const transaction = {
      sameDayTransactions: true,
      teamKey: "418.l.201581.t.1",
      players: [
        {
          playerKey: "418.p.6047",
          transactionType: "drop",
        },
      ],
    };

    const spyHttpPostAxiosAuth = jest.spyOn(
      yahooHttpService,
      "httpPostAxiosAuth"
    );
    spyHttpPostAxiosAuth.mockImplementation(() => {
      return Promise.resolve();
    });

    await postRosterAddDropTransaction(transaction, uid);
    expect(spyHttpPostAxiosAuth).toHaveBeenCalledWith(
      uid,
      "league/418.l.201581/transactions",
      expectedXML
    );
  });

  it("should call API to add players", async () => {
    const uid = "xAyXmaHKO3aRm9J3fnj2rgZRPnX2"; // Jeff Barnes

    const expectedJSON = {
      transaction: {
        type: "add",
        player: {
          player_key: "418.p.6047",
          transaction_data: {
            type: "add",
            destination_team_key: "418.l.201581.t.1",
          },
        },
      },
    };
    const expectedXML = js2xmlparser.parse("fantasy_content", expectedJSON);

    const transaction = {
      sameDayTransactions: true,
      teamKey: "418.l.201581.t.1",
      players: [
        {
          playerKey: "418.p.6047",
          transactionType: "add",
        },
      ],
    };

    const spyHttpPostAxiosAuth = jest.spyOn(
      yahooHttpService,
      "httpPostAxiosAuth"
    );
    spyHttpPostAxiosAuth.mockImplementation(() => {
      return Promise.resolve();
    });

    await postRosterAddDropTransaction(transaction, uid);
    expect(spyHttpPostAxiosAuth).toHaveBeenCalledWith(
      uid,
      "league/418.l.201581/transactions",
      expectedXML
    );
  });

  it("should call API to add/drop players", async () => {
    const uid = "xAyXmaHKO3aRm9J3fnj2rgZRPnX2"; // Jeff Barnes

    const expectedJSON = {
      transaction: {
        type: "add/drop",
        players: {
          player: [
            {
              player_key: "418.p.6047",
              transaction_data: {
                type: "add",
                destination_team_key: "418.l.201581.t.1",
              },
            },
            {
              player_key: "418.p.6048",
              transaction_data: {
                type: "drop",
                source_team_key: "418.l.201581.t.1",
              },
            },
          ],
        },
      },
    };
    const expectedXML = js2xmlparser.parse("fantasy_content", expectedJSON);

    // drop and add are reversed to test that the order doesn't matter
    const transaction = {
      sameDayTransactions: true,
      teamKey: "418.l.201581.t.1",
      players: [
        {
          playerKey: "418.p.6048",
          transactionType: "drop",
        },
        {
          playerKey: "418.p.6047",
          transactionType: "add",
        },
      ],
    };

    const spyHttpPostAxiosAuth = jest.spyOn(
      yahooHttpService,
      "httpPostAxiosAuth"
    );
    spyHttpPostAxiosAuth.mockImplementation(() => {
      return Promise.resolve();
    });

    await postRosterAddDropTransaction(transaction, uid);
    expect(spyHttpPostAxiosAuth).toHaveBeenCalledWith(
      uid,
      "league/418.l.201581/transactions",
      expectedXML
    );
  });
});
