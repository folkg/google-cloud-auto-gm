// /** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        isolatedModules: true,
      },
    ],
  },
  // transform: {
  //   "^.+\\.ts$": "@swc/jest",
  // },
  testEnvironment: "node",
  testMatch: ["**/spec/*.spec.ts"],
};
