import "./firebase";
import {
  getUsersTeams,
  getRostersByTeamID,
  postRosterAddDropTransaction,
  getTopAvailablePlayers,
} from "../yahooAPI.service";
import { describe, it, expect } from "vitest";

describe.skip("Yahoo API Live Integration Tests", () => {
  // Danger: This test will actually perform API calls to Yahoo! and will drop players if not mocked.
  it.skip("should actually make a move in Yahoo", async () => {
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
    } catch (error) {
      console.error(error);
      expect(error).toBeDefined();
    }
    expect(result).toBe(true);
  }, 10000);

  it("should getRostersByTeamID", async () => {
    const uid = "mzJVgridDRSG3zwFQxAuIhNro9V2"; // Jeff Barnes
    const JSONresponse = await getRostersByTeamID(["422.l.90351.t.2 "], uid);
    console.log(JSON.stringify(JSONresponse));
    expect(JSONresponse).toBeDefined();
  }, 10000);

  it("should getRostersByTeamID(2)", async () => {
    const uid = "LimuNc51OoelVHOOw4rQjWTflUh2"; // real user!!!
    const JSONresponse = await getRostersByTeamID(["422.l.20786.t.11"], uid);
    console.log(JSON.stringify(JSONresponse));
    expect(JSONresponse).toBeDefined();
  }, 10000);

  it("should getUserTeams", async () => {
    const uid = "W8uNiMNNF8evwePX7aaFwvE8ojn1"; // Graeme Folk
    const JSONresponse = await getUsersTeams(uid);
    // const fs = require("fs");
    // fs.writeFileSync(
    //   "/home/graeme/Software/auto-gm/google-cloud-auto-gm/functions/src/fetchUsersTeams/services/spec/input.json",
    //   JSON.stringify(JSONresponse)
    // );
    expect(JSONresponse).toBeDefined();
  }, 10000);

  it("should get All available players", async () => {
    const uid = "mzJVgridDRSG3zwFQxAuIhNro9V2"; // Jeff Barnes
    const JSONresponse = await getTopAvailablePlayers("422.l.90351", uid);
    // const fs = require("fs");
    // fs.writeFileSync("./all-players.json", JSON.stringify(JSONresponse));
    expect(JSONresponse).toBeDefined();
  }, 10000);

  it("should get free agents only", async () => {
    const uid = "mzJVgridDRSG3zwFQxAuIhNro9V2"; // Jeff Barnes
    const JSONresponse = await getTopAvailablePlayers("422.l.90351", uid, "FA");
    // const fs = require("fs");
    // fs.writeFileSync("./free-agents.json", JSON.stringify(JSONresponse));
    expect(JSONresponse).toBeDefined();
  }, 10000);
});
