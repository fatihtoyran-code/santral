import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";

console.log("== SQLite Db Inspector ==");
console.log("process.env.SQLITE_DB_PATH:", process.env.SQLITE_DB_PATH);
console.log("Platform:", process.platform);

const DB_DIR = path.join(process.cwd(), "data");
const possiblePaths = [
  process.env.SQLITE_DB_PATH,
  path.join(DB_DIR, "kva_data.db"),
  path.join(DB_DIR, "data.db"),
  path.join(process.cwd(), "kva_data.db"),
  path.join(process.cwd(), "data.db"),
  "/santral/kva_data.db",
  "/santral/data.db",
].filter(Boolean) as string[];

console.log("\nChecking possible database file paths:");
for (const p of possiblePaths) {
  const exists = fs.existsSync(p);
  console.log(`- ${p}: ${exists ? "FOUND" : "NOT FOUND"}`);
  if (exists) {
    try {
      const stats = fs.statSync(p);
      console.log(`  Size: ${stats.size} bytes`);
    } catch (e) {}
  }
}

// Find files ending in .db in current workspace
function findDbFiles(dir: string, depth = 0) {
  if (depth > 3) return;
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f === "node_modules" || f === ".git" || f === "dist") continue;
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        findDbFiles(fullPath, depth + 1);
      } else if (f.endsWith(".db")) {
        console.log(`Found db file: ${fullPath} (${stat.size} bytes)`);
      }
    }
  } catch (err) {}
}

console.log("\nSearching workspace for *.db files...");
findDbFiles(process.cwd());

const actualDbPath = process.env.SQLITE_DB_PATH || path.join(DB_DIR, "kva_data.db");
if (fs.existsSync(actualDbPath)) {
  console.log(`\nOpening actual DB: ${actualDbPath}`);
  const db = new sqlite3.Database(actualDbPath);
  
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables: any[]) => {
    if (err) {
      console.error("Error reading tables:", err);
      return;
    }
    console.log("Tables found:", tables.map(t => t.name));
    
    if (tables.length === 0) {
      console.log("No tables found.");
      return;
    }

    const promises = tables.map(t => {
      return new Promise<void>((resolve) => {
        db.all(`PRAGMA table_info(${t.name})`, (err2, cols: any[]) => {
          if (err2) {
            console.error(`Error reading scheme for ${t.name}:`, err2);
          } else {
            console.log(`\nTable Schema for [${t.name}]:`);
            cols.forEach(c => {
              console.log(`  - Col: ${c.name}, Type: ${c.type}, NotNull: ${c.notnull}, DefaultVal: ${c.dflt_value}, PK: ${c.pk}`);
            });
          }
          resolve();
        });
      });
    });

    Promise.all(promises).then(() => {
      // Also query a sample of rows from each table to preview actual column data
      const samplePromises = tables.map(t => {
        return new Promise<void>((resolve) => {
          db.all(`SELECT * FROM ${t.name} LIMIT 3`, (err3, rows: any[]) => {
            if (err3) {
              console.error(`Error querying rows for ${t.name}:`, err3);
            } else {
              console.log(`\nSample Data from [${t.name}] (Max 3 rows):`);
              console.log(JSON.stringify(rows, null, 2));
            }
            resolve();
          });
        });
      });

      Promise.all(samplePromises).then(() => {
        db.close();
      });
    });
  });
} else {
  console.log(`\nDB at ${actualDbPath} does not exist yet.`);
}
