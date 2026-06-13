import express from "express";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";
import { 
  loadDb, 
  getDbState, 
  toggleScraperMode, 
  updateScraperInterval, 
  clearLogs, 
  writeLog, 
  saveKva,
  saveDelRec,
  getKvaDataFiltered,
  getLatestDemandBefore,
  getMonthRangeDemand,
  getAllDemandRecordsForRange
} from "./server/db";
import { 
  restartScraperIntervals, 
  scrapeFacilityKva, 
  scrapeFacilityDemand 
} from "./server/scraper";

async function startServer() {
  // Initialize Database on startup
  loadDb();
  
  // Start the background scraping cycles
  restartScraperIntervals();

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const httpServer = http.createServer(app);

  // Middleware for parsing JSON requests
  app.use(express.json());

  // --- API ROUTING SECTION ---

  // Get all facilities and their current status
  app.get("/api/facilities", (req, res) => {
    try {
      const state = getDbState();
      res.json(Object.values(state.facilities));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get active system settings
  app.get("/api/settings", (req, res) => {
    try {
      const state = getDbState();
      res.json({
        scraperMode: state.scraperMode,
        scraperIntervalKva: state.scraperIntervalKva,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get historical telemetry data
  app.get("/api/history", (req, res) => {
    try {
      const state = getDbState();
      const facilityId = req.query.facility as string;
      const hoursLimit = parseInt(req.query.hours as string || "168"); // default to 7 days
      
      let kvaFiltered = state.kva_data;
      let demandFiltered = state.demand_data;

      // Filter by facility
      if (facilityId && facilityId !== "all") {
        kvaFiltered = kvaFiltered.filter(r => r.tesis === facilityId);
        demandFiltered = demandFiltered.filter(r => r.tesis === facilityId);
      }

      // Filter by timeframe
      const cutoffTime = Date.now() - hoursLimit * 60 * 60 * 1000;
      kvaFiltered = kvaFiltered.filter(r => new Date(r.timestamp).getTime() >= cutoffTime);
      demandFiltered = demandFiltered.filter(r => new Date(r.timestamp).getTime() >= cutoffTime);

      res.json({
        kva: kvaFiltered,
        demand: demandFiltered
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Toggle scraper scan mode (Real vs. Simulator)
  app.post("/api/scraper/toggle", (req, res) => {
    try {
      const { mode } = req.body;
      if (mode !== "real" && mode !== "simulation") {
        return res.status(400).json({ error: "Invalid mode. Must be 'real' or 'simulation'" });
      }
      const newMode = toggleScraperMode(mode);
      // Restart background intervals with updated settings
      restartScraperIntervals();
      res.json({ success: true, mode: newMode });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update dynamic scan interval
  app.post("/api/scraper/interval", (req, res) => {
    try {
      const { seconds } = req.body;
      const numSeconds = parseInt(seconds);
      if (isNaN(numSeconds) || numSeconds < 10) {
        return res.status(400).json({ error: "Interval must be a number and at least 10 seconds." });
      }
      updateScraperInterval(numSeconds);
      restartScraperIntervals();
      res.json({ success: true, interval: numSeconds });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger manual instantaneous check
  app.post("/api/scraper/scan", async (req, res) => {
    try {
      const { facilityId } = req.body;
      const state = getDbState();
      const isReal = state.scraperMode === "real";

      if (facilityId && facilityId !== "all") {
        if (!state.facilities[facilityId]) {
          return res.status(404).json({ error: `Facility ${facilityId} not found.` });
        }
        writeLog(`Tesis için el ile tarama istendi: ${facilityId}`, "info", facilityId);
        await scrapeFacilityKva(facilityId, isReal);
        await scrapeFacilityDemand(facilityId, isReal);
      } else {
        writeLog("Tüm tesisler için el ile tarama istendi.", "info");
        const promises = Object.keys(state.facilities).map(async (id) => {
          await scrapeFacilityKva(id, isReal);
          await scrapeFacilityDemand(id, isReal);
        });
        await Promise.all(promises);
      }

      res.json({ success: true, message: "Manual scan completed successfully." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get real-time logger entries
  app.get("/api/logs", (req, res) => {
    try {
      const state = getDbState();
      res.json(state.logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Clear system logs
  app.post("/api/logs/clear", (req, res) => {
    try {
      clearLogs();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add a manual test log or override metric values (highly useful for developers debugging from the UI)
  app.post("/api/facilities/override", (req, res) => {
    try {
      const { facilityId, kva, del, rec } = req.body;
      const state = getDbState();
      if (!state.facilities[facilityId]) {
        return res.status(404).json({ error: "Facility not found" });
      }

      if (kva !== undefined) {
        saveKva(facilityId, parseFloat(kva), "El ile Giris");
      }
      if (del !== undefined && rec !== undefined) {
        const net = parseFloat((parseFloat(del) - parseFloat(rec)).toFixed(1));
        saveDelRec(facilityId, parseFloat(del), parseFloat(rec), net, "El ile Giris");
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Fetch consolidated status stats
  app.get("/api/stats", (req, res) => {
    try {
      const state = getDbState();
      const facilitiesList = Object.values(state.facilities);
      
      const totalKva = facilitiesList.reduce((acc, f) => acc + (f.lastKva || 0), 0);
      const activeFacilities = facilitiesList.filter(f => f.status === "online").length;
      
      // Calculate collective Del, Rec, Net counts
      const totalDel = facilitiesList.reduce((acc, f) => acc + (f.lastDel || 0), 0);
      const totalRec = facilitiesList.reduce((acc, f) => acc + (f.lastRec || 0), 0);
      const totalNet = totalDel - totalRec;

      res.json({
        totalKva: parseFloat(totalKva.toFixed(2)),
        activeFacilities,
        totalFacilities: facilitiesList.length,
        totalDel: parseFloat(totalDel.toFixed(1)),
        totalRec: parseFloat(totalRec.toFixed(1)),
        totalNet: parseFloat(totalNet.toFixed(1))
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- LEGACY DASHBOARD ANALYTICS ENDPOINT ---
  app.get("/api/legacy-analytics", async (req, res) => {
    try {
      const state = getDbState();
      const { date, start, end, facility } = req.query;

      const selectedDate = (date as string) || new Date().toISOString().substring(0, 10);
      const startTime = (start as string) || "06:00";
      const endTime = (end as string) || "20:50";
      const seciliTesis = (facility as string) || "Hepsi";

      const TESIS_KATSAYILARI: Record<string, number> = {
        "K499": 1.03, "K500": 1.03, "G500": 1.03, "G499": 1.03,
        "M499": 1.03, "M500": 1.03, "T500": 1.03, "YP": 1.0
      };

      // 1. Fetch kva_data for the selected time range asynchronously
      const kvaFiltered = await getKvaDataFiltered(selectedDate, startTime, endTime, seciliTesis);

      // Format for charts
      const chartPointsMap: Record<string, Record<string, number>> = {};
      const uniqueTimestamps = Array.from(new Set(kvaFiltered.map(r => r.timestamp))).sort();

      uniqueTimestamps.forEach(ts => {
        const hhmm = ts.substring(11, 16);
        if (!chartPointsMap[hhmm]) {
          chartPointsMap[hhmm] = {};
        }
      });

      kvaFiltered.forEach(r => {
        const hhmm = r.timestamp.substring(11, 16);
        const katsayi = TESIS_KATSAYILARI[r.tesis] || 1.0;
        chartPointsMap[hhmm][r.tesis] = parseFloat((r.kva_total * katsayi).toFixed(2));
      });

      const kvaChartData = Object.entries(chartPointsMap).map(([time, values]) => {
        return { time, ...values };
      }).sort((a, b) => a.time.localeCompare(b.time));

      // Calculate combined instant total
      let toplamKva = 0;
      const activeIds = seciliTesis === "Hepsi" ? ["K499", "K500", "G500", "G499", "M499", "M500", "T500"] : [seciliTesis];
      
      activeIds.forEach(id => {
        const facKvas = kvaFiltered.filter(r => r.tesis === id);
        if (facKvas.length > 0) {
          const sorted = [...facKvas].sort((a,b) => b.timestamp.localeCompare(a.timestamp));
          const lastVal = sorted[0].kva_total;
          const katsayi = TESIS_KATSAYILARI[id] || 1.0;
          toplamKva += lastVal * katsayi;
        }
      });

      // Fetch cached data for fast in-memory calculations
      const dateObj = new Date(selectedDate);
      let gunlukUretim = 0;
      let aylikUretim = 0;
      const monthlyBarData: { day: string; netProduction: number }[] = [];

      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const monthNum = dateObj.getMonth() + 1;
        const daysInMonth = new Date(year, monthNum, 0).getDate();

        // 3 days preceding start of month to cover all necessary previous day-offset values safely
        const startOfMonth = new Date(year, monthNum - 1, 1);
        const threeDaysBefore = new Date(startOfMonth.getTime() - 3 * 24 * 60 * 60 * 1000);
        const threeDaysBeforeStr = threeDaysBefore.toISOString().substring(0, 10) + " 00:00:00";
        const endOfMonthStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")} 23:59:59`;

        // 1. Fetch ALL relevant demand records in ONE beautiful hit!
        const cachedDbRecords = await getAllDemandRecordsForRange(threeDaysBeforeStr, endOfMonthStr);

        // Quick helper to fetch the latest record on or before a timestamp (similar to getLatestDemandBefore but completely in-memory)
        const findLatestInMemory = (timestamp: string, tesisId: string) => {
          for (let i = cachedDbRecords.length - 1; i >= 0; i--) {
            const r = cachedDbRecords[i];
            if (r.tesis === tesisId && r.timestamp <= timestamp) {
              return r;
            }
          }
          return null;
        };

        const getDailyFarkInMemory = (tesisId: string, queryDateStr: string): number => {
          try {
            const tDate = new Date(queryDateStr);
            if (isNaN(tDate.getTime())) return 0;
            
            const yestDate = new Date(tDate.getTime() - 24 * 60 * 60 * 1000);
            const yestDateStr = yestDate.toISOString().substring(0, 10);

            const bugunSon = `${queryDateStr} 23:59:59`;
            const dunSon = `${yestDateStr} 23:59:59`;

            const dunRecords = findLatestInMemory(dunSon, tesisId);
            const bugunRecords = findLatestInMemory(bugunSon, tesisId);

            if (dunRecords && bugunRecords) {
              if (dunRecords.del_kwh !== null && dunRecords.rec_kwh !== null && bugunRecords.del_kwh !== null && bugunRecords.rec_kwh !== null) {
                const del_fark = bugunRecords.del_kwh - dunRecords.del_kwh;
                const rec_fark = bugunRecords.rec_kwh - dunRecords.rec_kwh;
                const net = del_fark - rec_fark;
                const katsayi = TESIS_KATSAYILARI[tesisId] || 1.0;
                return net * katsayi;
              }
            }
          } catch (e) {
            // Ignored
          }
          return 0;
        };

        // 2. Calculate daily production for the date
        if (seciliTesis === "Hepsi") {
          let sumDiff = 0;
          Object.keys(state.facilities).forEach(id => {
            sumDiff += getDailyFarkInMemory(id, selectedDate);
          });
          gunlukUretim = sumDiff;
        } else {
          gunlukUretim = getDailyFarkInMemory(seciliTesis, selectedDate);
        }
        gunlukUretim = gunlukUretim * -1;

        // 3. Calculate monthly cumulative production
        const startOfMonthStr = `${year}-${String(monthNum).padStart(2, "0")}-01 00:00:00`;
        const endOfMonthStrActive = `${selectedDate} 23:59:59`;
        const targetTesisler = seciliTesis === "Hepsi" ? Object.keys(state.facilities) : [seciliTesis];

        targetTesisler.forEach(tId => {
          const first = findLatestInMemory(startOfMonthStr, tId);
          const last = findLatestInMemory(endOfMonthStrActive, tId);

          if (first && last) {
            if (first.del_kwh !== null && first.rec_kwh !== null && last.del_kwh !== null && last.rec_kwh !== null) {
              const uretim = Math.abs(last.del_kwh - first.del_kwh);
              const tuketim = Math.abs(last.rec_kwh - first.rec_kwh);
              const net = (uretim - tuketim) * -1;
              const katsayi = TESIS_KATSAYILARI[tId] || 1.0;
              aylikUretim += net * katsayi;
            }
          }
        });

        // 4. Generate daily totals bar chart for the entire month
        for (let g = 1; g <= daysInMonth; g++) {
          const loopDateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
          let dayUretim = 0;
          if (seciliTesis === "Hepsi") {
            Object.keys(state.facilities).forEach(id => {
              dayUretim += getDailyFarkInMemory(id, loopDateStr);
            });
          } else {
            dayUretim = getDailyFarkInMemory(seciliTesis, loopDateStr);
          }

          monthlyBarData.push({
            day: String(g).padStart(2, "0"),
            netProduction: Math.round(dayUretim * -1) || 0
          });
        }
      }

      // Ensure values are secure against NaN
      const finishedToplamKva = isNaN(toplamKva) ? 0 : toplamKva;
      const finishedGunlukUretim = isNaN(gunlukUretim) ? 0 : gunlukUretim;
      const finishedAylikUretim = isNaN(aylikUretim) ? 0 : aylikUretim;

      res.json({
        toplamKva: parseFloat(finishedToplamKva.toFixed(1)),
        gunlukUretim: Math.round(finishedGunlukUretim),
        aylikUretim: Math.round(finishedAylikUretim),
        kvaChartData: kvaChartData || [],
        monthlyBarData: monthlyBarData || []
      });

    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- VITE AND CLIENT BUILD MIDDLEWARE SETUP ---

  // Handle asset serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server: httpServer }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom full-stack backend running on port ${PORT}`);
    writeLog(`Sistem web sunucusu başarıyla başlatıldı ve ${PORT} portuna bağlandı.`);
  });
}

startServer();
