module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".spec.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  globalSetup: "<rootDir>/test/integration/setup.ts",
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "./coverage",
  moduleNameMapper: {
    "^@app/(.*)$": "<rootDir>/src/$1",
  },
};
