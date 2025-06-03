module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".spec.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  setupFilesAfterEnv: ["<rootDir>/test/integration/setup.ts"],
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "./coverage",
  moduleNameMapper: {
    "^@app/(.*)$": "<rootDir>/src/$1",
  },
};
