import { describeIfIntegrationTesting } from "./setupTests";

import { expect, it } from "vitest";
import {
  getPositionalScarcityOffsets,
  getRandomUID,
} from "../common/services/firebase/firestore.service";

describeIfIntegrationTesting("Firestore Integration", () => {
  it("should return uid", async () => {
    const result = await getRandomUID();
    console.log(result);
    expect(result).toBeDefined();
  });

  it("should return positional scarcity offsets", async () => {
    const result = await getPositionalScarcityOffsets();
    console.log(result);
    expect(result).toBeDefined();
    for (const league in result) {
      if (result.hasOwnProperty(league)) {
        for (const position in result[league]) {
          if (result[league].hasOwnProperty(position)) {
            expect(Array.isArray(result[league][position])).toBe(true);
          }
        }
      }
    }
  });
});
