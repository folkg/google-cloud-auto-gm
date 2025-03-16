import { initializeApp } from "firebase-admin";
import { describe } from "vitest";

let describeIfIntegrationTesting = describe.skip;

if (process.env.INTEGRATION_TEST_ENABLED === "true") {
  let firebaseConfig;
  try {
    firebaseConfig = require("./firebaseConfig.json");
  } catch (_e) {
    firebaseConfig = {};
  }
  initializeApp(firebaseConfig);
  describeIfIntegrationTesting = describe;
}

export { describeIfIntegrationTesting };
