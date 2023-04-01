import "./firebase";
import {
  getAllStandings,
  getRostersByTeamID,
  postRosterAddDropTransaction,
} from "../yahooAPI.service";

xdescribe("Yahoo API Live Integration Tests", () => {
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
    } catch (error) {
      console.error(error);
      expect(error).toBeDefined();
    }
    expect(result).toBe(true);
  });

  xit("should getRostersByTeamID", async () => {
    const uid = "xAyXmaHKO3aRm9J3fnj2rgZRPnX2"; // Jeff Barnes
    const JSONresponse = await getRostersByTeamID(["422.l.115494.t.4"], uid);
    console.log(JSON.stringify(JSONresponse));
    expect(JSONresponse).toBeDefined();
  });

  xit("should getAllStandings", async () => {
    const uid = "RLSrRcWN3lcYbxKQU1FKqditGDu1"; // Graeme Folk
    const JSONresponse = await getAllStandings(uid);
    const fs = require("fs");
    fs.writeFileSync(
      "/home/graeme/Software/auto-gm/google-cloud-auto-gm/functions/src/fetchUsersTeams/services/spec/input.json",
      JSON.stringify(JSONresponse)
    );
    expect(JSONresponse).toBeDefined();
  });
});
