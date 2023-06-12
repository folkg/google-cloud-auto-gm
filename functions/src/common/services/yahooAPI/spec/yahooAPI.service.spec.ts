import js2xmlparser from "js2xmlparser";
import { postRosterAddDropTransaction } from "../yahooAPI.service.js";
import * as yahooHttpService from "../yahooHttp.service.js";

import { afterEach, describe, expect, it, vi } from "vitest";

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

describe.concurrent("YahooAPI Service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

    const spyHttpPostAxiosAuth = vi.spyOn(
      yahooHttpService,
      "httpPostAxiosAuth"
    );
    spyHttpPostAxiosAuth.mockImplementation(() => {
      return Promise.resolve() as any;
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

    const spyHttpPostAxiosAuth = vi.spyOn(
      yahooHttpService,
      "httpPostAxiosAuth"
    );
    spyHttpPostAxiosAuth.mockImplementation(() => {
      return Promise.resolve() as any;
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

    const spyHttpPostAxiosAuth = vi.spyOn(
      yahooHttpService,
      "httpPostAxiosAuth"
    );
    spyHttpPostAxiosAuth.mockImplementation(() => {
      return Promise.resolve() as any;
    });

    await postRosterAddDropTransaction(transaction, uid);
    expect(spyHttpPostAxiosAuth).toHaveBeenCalledWith(
      uid,
      "league/418.l.201581/transactions",
      expectedXML
    );
  });
});
