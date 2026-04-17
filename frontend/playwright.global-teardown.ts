import fs from "node:fs";
import type { FullConfig } from "playwright/test";
import { getPlaywrightDatabasePath, getPlaywrightDatabaseStatePath } from "./playwright.database-path";

const databaseStatePath = getPlaywrightDatabaseStatePath();

export default async function globalTeardown(_: FullConfig) {
  const databasePath = getPlaywrightDatabasePath();
  for (const candidate of [databasePath, `${databasePath}-shm`, `${databasePath}-wal`]) {
    if (candidate) {
      fs.rmSync(candidate, { force: true });
    }
  }

  fs.rmSync(databaseStatePath, { force: true });
}
