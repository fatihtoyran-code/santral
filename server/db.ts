import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { KvaRecord, DemandRecord, SystemLog, Facility } from "../src/types";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "db.json");
const LOG_FILE_PATH = path.join(DB_DIR, "log.txt");

export interface DatabaseSchema {
  kva_data: KvaRecord[];
  demand_data: DemandRecord[];
  logs: SystemLog[];
  facilities: Record<string, Facility>;
  scraperMode: "real" | "simulation";
  scraperIntervalKva: number; // seconds
}

const DEFAULT_FACILITIES: Record<string, Facility> = {
  "K499": { id: "K499", name: "K499", url: "http://78.189.129.179:40083", status: "idle", lastKva: null, lastDel: null, lastRec: null, lastNet: null, lastUpdatedKva: null, lastUpdatedDemand: null },
  "K500": { id: "K500", name: "K500", url: "http://78.189.129.179:40082", status: "idle", lastKva: null, lastDel: null, lastRec: null, lastNet: null, lastUpdatedKva: null, lastUpdatedDemand: null },
  "G500": { id: "G500", name: "G500", url: "http://78.189.129.179:40081", status: "idle", lastKva: null, lastDel: null, lastRec: null, lastNet: null, lastUpdatedKva: null, lastUpdatedDemand: null },
  "G499": { id: "G499", name: "G499", url: "http://78.189.129.179:40084", status: "idle", lastKva: null, lastDel: null, lastRec: null, lastNet: null, lastUpdatedKva: null, lastUpdatedDemand: null },
  "M499": { id: "M499", name: "M499", url: "http://5.26.254.49:40080", status: "idle", lastKva: null, lastDel: null, lastRec: null, lastNet: null, lastUpdatedKva: null, lastUpdatedDemand: null },
  "M500": { id: "M500", name: "M500", url: "http://78.189.129.179:40080", status: "idle", lastKva: null, lastDel: null, lastRec: null, lastNet: null, lastUpdatedKva: null, lastUpdatedDemand: null },
  "T500": { id: "T500", name: "T500", url: "http://78.189.129.179:40085", status: "idle", lastKva: null, lastDel: null, lastRec: null, lastNet: null, lastUpdatedKva: null, lastUpdatedDemand: null },
};

let db: DatabaseSchema = {
  kva_data: [],
  demand_data: [],
  logs: [],
  facilities: DEFAULT_FACILITIES,
  scraperMode: "simulation",
  scraperIntervalKva: 300,
};

// --- SQLITE CONFIGURATION FOR NATIVE COOPERATION ---
let sqliteDb: sqlite3.Database | null = null;
let detectedDateFormat: "ISO" | "TR" | "OTHER" = "ISO";

export function convertToDbFormat(isoTimestamp: string): string {
  if (detectedDateFormat === "TR") {
    if (isoTimestamp.includes(" ")) {
      const [datePart, timePart] = isoTimestamp.split(" ");
      const parts = datePart.split("-");
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]} ${timePart}`;
      }
    } else {
      const parts = isoTimestamp.split("-");
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
      }
    }
  }
  return isoTimestamp;
}

export function convertToIsoFormat(dbTimestamp: string): string {
  if (!dbTimestamp) return dbTimestamp;
  const ts = dbTimestamp.trim();
  if (/^\d{2}\.\d{2}\.\d{4}/.test(ts)) {
    const [datePart, timePart] = ts.split(" ");
    const [d, m, y] = datePart.split(".");
    if (d && m && y) {
      return `${y}-${m}-${d}${timePart ? " " + timePart : ""}`;
    }
  }
  return dbTimestamp;
}

function getSqlitePath(): string {
  if (process.env.SQLITE_DB_PATH) {
    return process.env.SQLITE_DB_PATH;
  }
  if (process.platform === "win32") {
    return "C:\\santral\\kva_data.db";
  }
  return path.join(DB_DIR, "kva_data.db");
}

export function initSqlite(): boolean {
  const dbPath = getSqlitePath();
  const dbDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dbDir)) {
    try {
      fs.mkdirSync(dbDir, { recursive: true });
    } catch (e) {
      // Ignored
    }
  }

  try {
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("SQLite Connection Error:", err);
        writeLog(`SQLite Veritabanı bağlantısı başarısız (${dbPath}): ${err.message}`, "error");
      } else {
        console.log(`SQLite database loaded at: ${dbPath}`);
        writeLog(`SQLite Veritabanı bağlandı: ${dbPath}`, "success");
      }
    });

    sqliteDb.serialize(() => {
      sqliteDb?.run(`
        CREATE TABLE IF NOT EXISTS kva_data (
          timestamp TEXT,
          tesis TEXT,
          kva_total REAL
        )
      `);
      sqliteDb?.run(`
        CREATE TABLE IF NOT EXISTS demand_data (
          timestamp TEXT,
          tesis TEXT,
          del_kwh REAL,
          rec_kwh REAL,
          net_kwh REAL
        )
      `);

      // Detect date format
      sqliteDb?.get("SELECT timestamp FROM kva_data WHERE timestamp IS NOT NULL AND timestamp != '' LIMIT 1", (err, row: any) => {
        if (row && row.timestamp) {
          const ts = row.timestamp.trim();
          if (/^\d{2}\.\d{2}\.\d{4}/.test(ts)) {
            detectedDateFormat = "TR";
            console.log("Auto-detected SQLite date format: Turkish Dot [DD.MM.YYYY HH:mm:ss] ->", ts);
            writeLog(`SQLite Tarih Biçimi Algılandı: Noktalı TR (${ts})`, "info");
          } else {
            detectedDateFormat = "ISO";
            console.log("Auto-detected SQLite date format: ISO Dash [YYYY-MM-DD HH:mm:ss] ->", ts);
            writeLog(`SQLite Tarih Biçimi Algılandı: Standart ISO (${ts})`, "info");
          }
        }
      });
    });
    return true;
  } catch (err: any) {
    console.error("SQLite failed to initialize:", err);
    writeLog(`SQLite başlatılamadı: ${err.message}`, "error");
    return false;
  }
}

// --- ASYNC SQLITE QUERY HELPER INTERFACES ---
export function getKvaDataFiltered(date: string, start: string, end: string, facility: string): Promise<KvaRecord[]> {
  const startStr = `${date} ${start}:00`;
  const endStr = `${date} ${end}:59`;

  if (sqliteDb) {
    return new Promise((resolve) => {
      let query = `
        WITH normalized_kva AS (
          SELECT 
            timestamp, tesis, kva_total,
            CASE 
              WHEN instr(timestamp, '.') > 0 THEN 
                substr(timestamp, 7, 4) || '-' || substr(timestamp, 4, 2) || '-' || substr(timestamp, 1, 2) || ' ' || substr(timestamp, 12)
              ELSE 
                timestamp 
            END as iso_ts
          FROM kva_data 
        )
        SELECT timestamp, tesis, kva_total, iso_ts
        FROM normalized_kva 
        WHERE iso_ts BETWEEN ? AND ? AND tesis != 'YP'
      `;
      const params: any[] = [startStr, endStr];
      if (facility !== "Hepsi") {
        query += " AND tesis = ?";
        params.push(facility);
      }
      sqliteDb!.all(query, params, (err, rows: any[]) => {
        if (err) {
          console.error("Error querying kva_data from SQLite:", err);
          resolve([]);
        } else {
          const normalized = (rows || []).map(r => ({
            ...r,
            timestamp: r.iso_ts
          }));
          resolve(normalized);
        }
      });
    });
  } else {
    const rawKva = db.kva_data.filter(r => {
      return r.timestamp >= startStr && r.timestamp <= endStr && r.tesis !== "YP";
    });
    if (facility !== "Hepsi") {
      return Promise.resolve(rawKva.filter(r => r.tesis === facility));
    }
    return Promise.resolve(rawKva);
  }
}

export function getLatestDemandBefore(timestamp: string, tesisId: string): Promise<DemandRecord | null> {
  if (sqliteDb) {
    return new Promise((resolve) => {
      const query = `
        WITH normalized_demand AS (
          SELECT 
            timestamp, tesis, del_kwh, rec_kwh, net_kwh,
            CASE 
              WHEN instr(timestamp, '.') > 0 THEN 
                substr(timestamp, 7, 4) || '-' || substr(timestamp, 4, 2) || '-' || substr(timestamp, 1, 2) || ' ' || substr(timestamp, 12)
              ELSE 
                timestamp 
            END as iso_ts
          FROM demand_data
        )
        SELECT timestamp, tesis, del_kwh, rec_kwh, net_kwh, iso_ts 
        FROM normalized_demand 
        WHERE iso_ts <= ? AND tesis = ?
        ORDER BY iso_ts DESC LIMIT 1
      `;
      sqliteDb!.get(query, [timestamp, tesisId], (err, row: any) => {
        if (err || !row) {
          resolve(null);
        } else {
          resolve({
            ...row,
            timestamp: row.iso_ts
          } as DemandRecord);
        }
      });
    });
  } else {
    const records = db.demand_data
      .filter(r => r.tesis === tesisId && r.timestamp <= timestamp)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return Promise.resolve(records.length > 0 ? records[0] : null);
  }
}

export function getMonthRangeDemand(startOfMonthStr: string, endOfMonthStr: string, tesisId: string): Promise<{ first: DemandRecord | null, last: DemandRecord | null }> {
  if (sqliteDb) {
    return new Promise((resolve) => {
      const queryMinMax = `
        WITH normalized_demand AS (
          SELECT 
            timestamp, tesis, del_kwh, rec_kwh, net_kwh,
            CASE 
              WHEN instr(timestamp, '.') > 0 THEN 
                substr(timestamp, 7, 4) || '-' || substr(timestamp, 4, 2) || '-' || substr(timestamp, 1, 2) || ' ' || substr(timestamp, 12)
              ELSE 
                timestamp 
            END as iso_ts
          FROM demand_data
        )
        SELECT MIN(iso_ts) as minTs, MAX(iso_ts) as maxTs
        FROM normalized_demand
        WHERE iso_ts BETWEEN ? AND ? AND tesis = ?
      `;
      sqliteDb!.get(queryMinMax, [startOfMonthStr, endOfMonthStr, tesisId], (err, row: any) => {
        if (err || !row || !row.minTs || !row.maxTs) {
          resolve({ first: null, last: null });
        } else {
          const minTs = row.minTs;
          const maxTs = row.maxTs;
          
          const queryGetRow = `
            WITH normalized_demand AS (
              SELECT 
                timestamp, tesis, del_kwh, rec_kwh, net_kwh,
                CASE 
                  WHEN instr(timestamp, '.') > 0 THEN 
                    substr(timestamp, 7, 4) || '-' || substr(timestamp, 4, 2) || '-' || substr(timestamp, 1, 2) || ' ' || substr(timestamp, 12)
                  ELSE 
                    timestamp 
                END as iso_ts
              FROM demand_data
            )
            SELECT timestamp, tesis, del_kwh, rec_kwh, net_kwh, iso_ts FROM normalized_demand WHERE iso_ts = ? AND tesis = ?
          `;
          
          sqliteDb!.get(queryGetRow, [minTs, tesisId], (err1, rowFirst: any) => {
            sqliteDb!.get(queryGetRow, [maxTs, tesisId], (err2, rowLast: any) => {
              resolve({
                first: rowFirst ? { ...rowFirst, timestamp: rowFirst.iso_ts } : null,
                last: rowLast ? { ...rowLast, timestamp: rowLast.iso_ts } : null
              });
            });
          });
        }
      });
    });
  } else {
    const monthRecords = db.demand_data
      .filter(r => r.tesis === tesisId && r.timestamp >= startOfMonthStr && r.timestamp <= endOfMonthStr)
      .sort((a,b) => a.timestamp.localeCompare(b.timestamp));
    if (monthRecords.length >= 1) {
      return Promise.resolve({
        first: monthRecords[0],
        last: monthRecords[monthRecords.length - 1]
      });
    }
    return Promise.resolve({ first: null, last: null });
  }
}

export function getAllDemandRecordsForRange(startStr: string, endStr: string): Promise<DemandRecord[]> {
  if (sqliteDb) {
    return new Promise((resolve) => {
      const query = `
        WITH normalized_demand AS (
          SELECT 
            timestamp, tesis, del_kwh, rec_kwh, net_kwh,
            CASE 
              WHEN instr(timestamp, '.') > 0 THEN 
                substr(timestamp, 7, 4) || '-' || substr(timestamp, 4, 2) || '-' || substr(timestamp, 1, 2) || ' ' || substr(timestamp, 12)
              ELSE 
                timestamp 
            END as iso_ts
          FROM demand_data
        )
        SELECT timestamp, tesis, del_kwh, rec_kwh, net_kwh, iso_ts 
        FROM normalized_demand 
        WHERE iso_ts BETWEEN ? AND ?
        ORDER BY iso_ts ASC
      `;
      sqliteDb!.all(query, [startStr, endStr], (err, rows: any[]) => {
        if (err || !rows) {
          resolve([]);
        } else {
          const mapped = rows.map(r => ({
            ...r,
            timestamp: r.iso_ts
          }));
          resolve(mapped);
        }
      });
    });
  } else {
    const records = db.demand_data
      .filter(r => r.timestamp >= startStr && r.timestamp <= endStr)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return Promise.resolve(records);
  }
}

// Log logger compatible with python's log.txt write behavior
export function writeLog(message: string, type: "info" | "success" | "warning" | "error" = "info", tesis?: string) {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
  const logMsg = `[${timestamp}] ${tesis ? `[${tesis}] ` : ""}${message}`;
  
  // 1. Append to log.txt
  try {
    fs.appendFileSync(LOG_FILE_PATH, logMsg + "\n", "utf-8");
  } catch (err) {
    console.error("Failed to write to log.txt", err);
  }

  // 2. Add to JSON logs
  const logEntry: SystemLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp,
    message,
    type,
    tesis,
  };
  
  db.logs.unshift(logEntry);
  if (db.logs.length > 500) {
    db.logs = db.logs.slice(0, 500); // Caps historical log in memory/db.json
  }
  saveDbToDisk();
}

function saveDbToDisk() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save database to disk:", err);
  }
}

export function loadDb() {
  // Ensure directories exist
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Always initialize SQLite connectivity
  initSqlite();

  // Read DB if exists for system configs and logs
  if (fs.existsSync(DB_PATH)) {
    try {
      const fileContent = fs.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(fileContent);
      if (parsed.facilities) {
        db.facilities = parsed.facilities;
        // Simplify the facility names to contain only their IDs
        Object.keys(db.facilities).forEach(key => {
          if (db.facilities[key]) {
            db.facilities[key].name = key;
          }
        });
        db.scraperMode = parsed.scraperMode || "simulation";
        db.scraperIntervalKva = parsed.scraperIntervalKva || 300;
        db.logs = parsed.logs || [];
      }
    } catch (e) {
      console.error("DB parsing error. Using default state...", e);
    }
  }

  // Check if SQLite is connected and check if tables are empty. If empty, seed mock history; otherwise we use real user data!
  if (sqliteDb) {
    sqliteDb.get("SELECT COUNT(*) as count FROM kva_data", (err, row: any) => {
      if (err || !row || row.count === 0) {
        writeLog("SQLite kva_data tablosu boş veya bulunamadı. Simüle edilmiş veri tohumları yükleniyor...", "info");
        generateSeedHistory();
      } else {
        writeLog(`SQLite tespit edildi ve yüklendi. ${row.count} kVA kaydı bulundu. Sisteminiz çalışmaya hazır!`, "success");
        // Load latest state into memory facility nodes
        Object.keys(db.facilities).forEach(tId => {
          sqliteDb?.get(`
            WITH normalized_kva AS (
              SELECT 
                timestamp, tesis, kva_total,
                CASE 
                  WHEN instr(timestamp, '.') > 0 THEN 
                    substr(timestamp, 7, 4) || '-' || substr(timestamp, 4, 2) || '-' || substr(timestamp, 1, 2) || ' ' || substr(timestamp, 12)
                  ELSE 
                    timestamp 
                END as iso_ts
              FROM kva_data
            )
            SELECT kva_total, timestamp, iso_ts FROM normalized_kva WHERE tesis = ? ORDER BY iso_ts DESC LIMIT 1
          `, [tId], (errKva, rowKva: any) => {
            if (rowKva) {
              db.facilities[tId].lastKva = rowKva.kva_total;
              db.facilities[tId].lastUpdatedKva = rowKva.iso_ts;
              db.facilities[tId].status = rowKva.kva_total > 0 ? "online" : "idle";
            }
          });
          sqliteDb?.get(`
            WITH normalized_demand AS (
              SELECT 
                timestamp, tesis, del_kwh, rec_kwh, net_kwh,
                CASE 
                  WHEN instr(timestamp, '.') > 0 THEN 
                    substr(timestamp, 7, 4) || '-' || substr(timestamp, 4, 2) || '-' || substr(timestamp, 1, 2) || ' ' || substr(timestamp, 12)
                  ELSE 
                    timestamp 
                END as iso_ts
              FROM demand_data
            )
            SELECT del_kwh, rec_kwh, net_kwh, timestamp, iso_ts FROM normalized_demand WHERE tesis = ? ORDER BY iso_ts DESC LIMIT 1
          `, [tId], (errDem, rowDem: any) => {
            if (rowDem) {
              db.facilities[tId].lastDel = rowDem.del_kwh;
              db.facilities[tId].lastRec = rowDem.rec_kwh;
              db.facilities[tId].lastNet = rowDem.net_kwh;
              db.facilities[tId].lastUpdatedDemand = rowDem.iso_ts;
            }
          });
        });
      }
    });
  } else {
    // If SQLite driver fails for whatever reason, fall back to pure memory seed generator
    if (db.kva_data.length === 0) {
      generateSeedHistory();
    }
  }
}

function generateSeedHistory() {
  writeLog("Sistem başlatıldı. Telemetri veritabanı tohumları oluşturuluyor.");
  
  const now = new Date();
  const kva_data_seed: KvaRecord[] = [];
  const demand_data_seed: DemandRecord[] = [];

  // Generate 7 days of historical metrics
  // 7 days = 168 hours
  const FACILITIES_IDS = Object.keys(DEFAULT_FACILITIES);
  
  for (let d = 7; d >= 0; d--) {
    const dayDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const dateStr = dayDate.toISOString().substring(0, 10); // YYYY-MM-DD

    // kVA entries every 1 hour for background chart efficiency (makes visual beautiful without choking Recharts)
    for (let h = 0; h < 24; h++) {
      const recordDate = new Date(dayDate);
      recordDate.setHours(h, 0, 0, 0);
      const timestamp = recordDate.toISOString().replace("T", " ").substring(0, 19);

      // Don't generate future seeds
      if (recordDate.getTime() > now.getTime()) continue;

      for (const tId of FACILITIES_IDS) {
        // Solar characteristics - peak in noon (10:00 to 16:00), zero at night
        const isSolar = !tId.startsWith("M"); // M is factory/trafo, others are solar/grids
        let peakMax = 40;
        if (tId === "K499") peakMax = 85;
        if (tId === "K500") peakMax = 48;
        if (tId === "G500") peakMax = 62;
        if (tId === "G499") peakMax = 35;
        if (tId === "T500") peakMax = 72;
        if (tId === "M499") peakMax = 110; 
        if (tId === "M500") peakMax = 145;

        let kvaTotal = 0;
        if (isSolar) {
          // Diurnal Solar Gen Curve
          if (h >= 6 && h <= 19) {
            const angle = Math.PI * (h - 6) / 13; // sine wave over daytime hours
            const efficiency = Math.sin(angle);
            kvaTotal = parseFloat((peakMax * efficiency * (0.85 + Math.random() * 0.2)).toFixed(2));
          } else {
            kvaTotal = 0.0;
          }
        } else {
          // M499 and M500 Industrial facility: steady with morning/afternoon peak, weekend dip
          const isWeekend = recordDate.getDay() === 0 || recordDate.getDay() === 6;
          const baseMultiplier = isWeekend ? 0.35 : 0.85;
          const timeVariance = (h >= 8 && h <= 18) ? 1.2 : 0.6;
          kvaTotal = parseFloat((peakMax * baseMultiplier * timeVariance * (0.9 + Math.random() * 0.2)).toFixed(2));
        }

        kva_data_seed.push({
          timestamp,
          tesis: tId,
          kva_total: kvaTotal,
        });

        // Initialize facility structure values with last records
        if (d === 0) {
          db.facilities[tId].lastKva = kvaTotal;
          db.facilities[tId].lastUpdatedKva = timestamp;
          db.facilities[tId].status = kvaTotal > 0 ? "online" : "idle";
        }
      }
    }

    // Daily Consumption values (Del & Rec kWh) for each facility
    for (const tId of FACILITIES_IDS) {
      const isSolar = !tId.startsWith("M");
      // Calculate realistic cumulative numbers
      // Let's say solar starts at some offset and increments daily.
      const dayIndex = 7 - d;
      let dailyYield = isSolar ? (1500 + Math.random() * 500) : 50; // Rec kWh (Received solar energy)
      let dailyUse = isSolar ? (50 + Math.random() * 20) : (4000 + Math.random() * 1500); // Del kWh (Delivered energy usage)

      if (tId === "K499") { dailyYield *= 2; dailyUse *= 1.2; }
      if (tId === "T500") { dailyYield *= 1.8; dailyUse *= 1.1; }

      const timestamp = `${dateStr} 23:59:59`;
      if (new Date(timestamp).getTime() > now.getTime()) continue;

      const del_kwh = parseFloat((10000 + dayIndex * dailyUse).toFixed(1));
      const rec_kwh = parseFloat((25000 + dayIndex * dailyYield).toFixed(1));
      const net_kwh = parseFloat((del_kwh - rec_kwh).toFixed(1));

      demand_data_seed.push({
        timestamp,
        tesis: tId,
        del_kwh,
        rec_kwh,
        net_kwh,
      });

      if (d === 0) {
        db.facilities[tId].lastDel = del_kwh;
        db.facilities[tId].lastRec = rec_kwh;
        db.facilities[tId].lastNet = net_kwh;
        db.facilities[tId].lastUpdatedDemand = timestamp;
      }
    }
  }

  db.kva_data = kva_data_seed;
  db.demand_data = demand_data_seed;
  
  writeLog("Veritabanı telemetri tohumları başarıyla yüklendi. 7 günlük veri oluşturuldu.", "success");
  saveDbToDisk();
}

export function getDbState(): DatabaseSchema {
  return db;
}

export function saveKva(tesis: string, kvaTotal: number, source: string = "Scraper") {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
  
  // 1. Insert into SQLite if available
  if (sqliteDb) {
    sqliteDb.run(
      "INSERT INTO kva_data (timestamp, tesis, kva_total) VALUES (?, ?, ?)",
      [timestamp, tesis, kvaTotal],
      (err) => {
        if (err) console.error("SQLite kva_data insert error:", err);
      }
    );
  }

  // 2. Add to active data array
  db.kva_data.push({
    timestamp,
    tesis,
    kva_total: kvaTotal,
  });

  // Limit cache size to avoid memory growth over dynamic schedules
  if (db.kva_data.length > 50000) {
    db.kva_data = db.kva_data.slice(-30000);
  }

  // 2. Update facility state
  if (db.facilities[tesis]) {
    db.facilities[tesis].lastKva = kvaTotal;
    db.facilities[tesis].lastUpdatedKva = timestamp;
    db.facilities[tesis].status = kvaTotal > 0 ? "online" : "idle";
    db.facilities[tesis].errorMassage = null;
  }

  writeLog(`${tesis} - kVA total: ${kvaTotal} (Saved via ${source})`, "success", tesis);

  // Special T500 / Turges-500 logging (mocking the PC-level file system save logs or DB logs in secondary file)
  if (tesis === "T500") {
    try {
      const valPerInv = parseFloat((kvaTotal / 5).toFixed(2));
      writeLog(`T500 - Gruptaki 5 inverter için cihaz başına deger: ${valPerInv} kVA hesaplandı. daily_reports ve tescom_data tablolarına kaydedildi.`, "info", "T500");
    } catch (e: any) {
      writeLog(`T500 - Özel yazım hatası: ${e.message}`, "error", "T500");
    }
  }

  saveDbToDisk();
}

export function saveDelRec(tesis: string, del: number, rec: number, net: number, source: string = "Scraper") {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);

  // 1. Insert into SQLite if available
  if (sqliteDb) {
    sqliteDb.run(
      "INSERT INTO demand_data (timestamp, tesis, del_kwh, rec_kwh, net_kwh) VALUES (?, ?, ?, ?, ?)",
      [timestamp, tesis, del, rec, net],
      (err) => {
        if (err) console.error("SQLite demand_data insert error:", err);
      }
    );
  }

  // 2. Add to active demand data array
  db.demand_data.push({
    timestamp,
    tesis,
    del_kwh: del,
    rec_kwh: rec,
    net_kwh: net,
  });

  if (db.demand_data.length > 5000) {
    db.demand_data = db.demand_data.slice(-3000);
  }

  // 2. Update facility state
  if (db.facilities[tesis]) {
    db.facilities[tesis].lastDel = del;
    db.facilities[tesis].lastRec = rec;
    db.facilities[tesis].lastNet = net;
    db.facilities[tesis].lastUpdatedDemand = timestamp;
    db.facilities[tesis].errorMassage = null;
  }

  writeLog(`${tesis} - Del: ${del} Rec: ${rec} Net: ${net} (Saved via ${source})`, "success", tesis);
  saveDbToDisk();
}

export function updateFacilityFail(tesis: string, metric: "kva" | "demand", errorMsg: string) {
  if (db.facilities[tesis]) {
    db.facilities[tesis].status = "error";
    db.facilities[tesis].errorMassage = `${metric.toUpperCase()} ERROR: ${errorMsg}`;
  }
  writeLog(`${tesis} - ${metric.toUpperCase()} BAGLANTI HATASI: ${errorMsg}`, "error", tesis);
  saveDbToDisk();
}

export function toggleScraperMode(mode: "real" | "simulation") {
  db.scraperMode = mode;
  writeLog(`Tarama modu değiştirildi. Yeni Mod: ${mode === "real" ? "Gerçek Cihazlar (IP)" : "Sanal Telemetri Simülasyonu"}`);
  saveDbToDisk();
  return db.scraperMode;
}

export function updateScraperInterval(seconds: number) {
  if (seconds >= 10) {
    db.scraperIntervalKva = seconds;
    writeLog(`kVA tarama sıklığı güncellendi: ${seconds} saniye.`);
    saveDbToDisk();
  }
}

export function clearLogs() {
  db.logs = [];
  writeLog("Sistem logları temizlendi.");
  saveDbToDisk();
}
