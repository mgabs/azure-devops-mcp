/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  moduleNameMapper: {
    "^(\\.\\.?/.*)\\.js$": "$1",
    "^@modelcontextprotocol/sdk/(.*)\\.js$": "@modelcontextprotocol/sdk/$1.js"
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
};
