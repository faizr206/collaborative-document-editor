import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const playwrightStateDir = path.resolve(__dirname, ".playwright");
const databaseStatePath = path.join(playwrightStateDir, "e2e-db-path.txt");
const backendDir = path.resolve(__dirname, "../backend");

export function getPlaywrightDatabasePath() {
  fs.mkdirSync(playwrightStateDir, { recursive: true });

  if (fs.existsSync(databaseStatePath)) {
    return fs.readFileSync(databaseStatePath, "utf8").trim();
  }

  cleanupStaleDatabases();

  const databasePath = path.join(backendDir, `e2e-${Date.now()}.sqlite`);
  fs.writeFileSync(databaseStatePath, databasePath, "utf8");
  return databasePath;
}

export function getPlaywrightDatabaseStatePath() {
  return databaseStatePath;
}

function cleanupStaleDatabases() {
  for (const entry of fs.readdirSync(backendDir)) {
    if (!/^e2e-\d+\.sqlite(?:-shm|-wal)?$/.test(entry)) {
      continue;
    }

    fs.rmSync(path.join(backendDir, entry), { force: true });
  }
}
