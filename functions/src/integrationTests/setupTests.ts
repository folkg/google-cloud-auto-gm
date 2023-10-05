import { initializeApp } from "firebase-admin";
import { firebaseConfig } from "./firebaseConfig";
import { describe } from "vitest";

let describeIfIntegrationTesting = describe.skip;

if (process.env.INTEGRATION_TEST_ENABLED === "true") {
  initializeApp(firebaseConfig);
  describeIfIntegrationTesting = describe;
}

export { describeIfIntegrationTesting };
