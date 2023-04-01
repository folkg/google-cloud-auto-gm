import { postRosterAddDropTransaction } from "../yahooAPI.service";
const js2xmlparser = require("js2xmlparser");

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

const yahooHttpService = require("../yahooHttp.service");
describe("YahooAPI Service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
