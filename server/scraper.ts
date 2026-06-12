import { getDbState, saveKva, saveDelRec, updateFacilityFail, writeLog } from "./db";

// Helper to scrape HTML fields using custom regex definitions
function parseKvaTotal(html: string): number | null {
  try {
    const lowerHtml = html.toLowerCase();
    const index = lowerHtml.indexOf("kva total");
    if (index === -1) return null;

    const subHtml = html.substring(index);
    // Grab TD matches inside the close proximity
    const tdMatches = [...subHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length < 2) return null; // First is the title label, second is the value column

    // Extract text inside second matching column, clean HTML tags
    const valString = tdMatches[1][1].replace(/<[^>]*>/g, "").trim();
    const cleanVal = valString.split(/\s+/)[0].replace(",", ".");
    const num = parseFloat(cleanVal);
    
    return isNaN(num) ? null : num;
  } catch (err) {
    return null;
  }
}

function parseDelRec(html: string): { del: number | null; rec: number | null } {
  const result = { del: null as number | null, rec: null as number | null };
  try {
    const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const trMatch of trMatches) {
      const trContent = trMatch[1];
      const tdMatches = [...trContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      
      if (tdMatches.length >= 2) {
        const cell0 = tdMatches[0][1].replace(/<[^>]*>/g, "").trim();
        const cell1 = tdMatches[1][1].replace(/<[^>]*>/g, "").trim();
        
        if (cell0 === "Del") {
          const val = parseFloat(cell1.replace(/,/g, ""));
          if (!isNaN(val)) result.del = val;
        } else if (cell0 === "Rec") {
          const val = parseFloat(cell1.replace(/,/g, ""));
          if (!isNaN(val)) result.rec = val;
        }
      }
    }
  } catch (err) {
    // Suppress error
  }
  return result;
}

// Fetch with custom timeout helper
async function fetchWithTimeout(url: string, timeoutMs: number = 6000): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 TelemetryScraper/1.0",
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error. Status: ${response.status}`);
    }
    
    const text = await response.text();
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Single facility KVA runner
export async function scrapeFacilityKva(facilityId: string, isReal: boolean) {
  const dbState = getDbState();
  const facility = dbState.facilities[facilityId];
  if (!facility) return;

  if (isReal) {
    try {
      const url = `${facility.url}/Operation.html`;
      const htmlOutput = await fetchWithTimeout(url);
      const kva = parseKvaTotal(htmlOutput);
      
      if (kva !== null) {
        saveKva(facilityId, kva, "Gerçek IP");
      } else {
        updateFacilityFail(facilityId, "kva", "kVA Total degeri sayfa içinde bulunamadı.");
      }
    } catch (err: any) {
      updateFacilityFail(facilityId, "kva", `Bağlantı zaman aşımı veya hatası: ${err.message}`);
    }
  } else {
    // Simulation Mode
    const now = new Date();
    const h = now.getHours();
    
    const isSolar = !facilityId.startsWith("M");
    let peakMax = 40;
    if (facilityId === "K499") peakMax = 85;
    if (facilityId === "K500") peakMax = 48;
    if (facilityId === "G500") peakMax = 62;
    if (facilityId === "G499") peakMax = 35;
    if (facilityId === "T500") peakMax = 72;
    if (facilityId === "M499") peakMax = 110; 
    if (facilityId === "M500") peakMax = 145;

    let kvaTotal = 0;
    if (isSolar) {
      if (h >= 6 && h <= 19) {
        const angle = Math.PI * (h - 6) / 13;
        const efficiency = Math.sin(angle);
        kvaTotal = parseFloat((peakMax * efficiency * (0.88 + Math.random() * 0.12)).toFixed(2));
      } else {
        kvaTotal = 0.0;
      }
    } else {
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      const baseMultiplier = isWeekend ? 0.35 : 0.85;
      const timeVariance = (h >= 8 && h <= 18) ? 1.25 : 0.55;
      kvaTotal = parseFloat((peakMax * baseMultiplier * timeVariance * (0.9 + Math.random() * 0.2)).toFixed(2));
    }

    saveKva(facilityId, kvaTotal, "Simülatör");
  }
}

// Single facility Demand runner (Del/Rec/Net kWh)
export async function scrapeFacilityDemand(facilityId: string, isReal: boolean) {
  const dbState = getDbState();
  const facility = dbState.facilities[facilityId];
  if (!facility) return;

  if (isReal) {
    try {
      const url = `${facility.url}/Consumption.html`;
      const htmlOutput = await fetchWithTimeout(url);
      const { del, rec } = parseDelRec(htmlOutput);
      
      if (del !== null && rec !== null) {
        const net = parseFloat((del - rec).toFixed(1));
        saveDelRec(facilityId, del, rec, net, "Gerçek IP");
      } else {
        updateFacilityFail(facilityId, "demand", "Consumption tablosunda Del/Rec verileri bulunamadı.");
      }
    } catch (err: any) {
      updateFacilityFail(facilityId, "demand", `Bağlantı hatası: ${err.message}`);
    }
  } else {
    // Simulation Mode - increment values slowly
    const currentDel = facility.lastDel || 12000;
    const currentRec = facility.lastRec || 28000;
    
    const isSolar = !facilityId.startsWith("M");
    const deltaDel = isSolar ? parseFloat((Math.random() * 2).toFixed(1)) : parseFloat((20 + Math.random() * 10).toFixed(1));
    const deltaRec = isSolar ? parseFloat((15 + Math.random() * 15).toFixed(1)) : parseFloat((Math.random() * 0.5).toFixed(1));
    
    const newDel = parseFloat((currentDel + deltaDel).toFixed(1));
    const newRec = parseFloat((currentRec + deltaRec).toFixed(1));
    const newNet = parseFloat((newDel - newRec).toFixed(1));
    
    saveDelRec(facilityId, newDel, newRec, newNet, "Simülatör");
  }
}

// Global loop execution controls
let kvaIntervalTimer: NodeJS.Timeout | null = null;
let demandHourTimer: NodeJS.Timeout | null = null;

export function restartScraperIntervals() {
  // Clear any existing intervals
  if (kvaIntervalTimer) clearInterval(kvaIntervalTimer);
  if (demandHourTimer) clearInterval(demandHourTimer);

  const dbState = getDbState();
  const kvaIntervalMs = dbState.scraperIntervalKva * 1000;
  const isReal = dbState.scraperMode === "real";

  writeLog(`Scraper arka plan döngüleri ayarlanıyor. Sıklık: ${dbState.scraperIntervalKva}s, Mod: ${dbState.scraperMode.toUpperCase()}`);

  // 1. Initial immediate scraper runs on load to verify connection status
  triggerAllScrapes(isReal);

  // 2. Continuous kVA Scraper LOOP
  kvaIntervalTimer = setInterval(() => {
    const freshDbState = getDbState();
    const currentIsReal = freshDbState.scraperMode === "real";
    
    writeLog("Otomatik periyodik kVA taraması başlatıldı.", "info");
    for (const facilityId of Object.keys(freshDbState.facilities)) {
      scrapeFacilityKva(facilityId, currentIsReal);
    }
  }, kvaIntervalMs);

  // 3. Hourly Del/Rec Demand Scraper LOOP (Checks hourly, runs when minute hits 0 or during periodic checks)
  demandHourTimer = setInterval(() => {
    const freshDbState = getDbState();
    const currentIsReal = freshDbState.scraperMode === "real";
    const now = new Date();
    
    // Check if near top-of-the-hour (exactly matching script condition h_minute === 0)
    // For comfort and robustness, we run if we are in simulation, or if we near minute 0.
    if (now.getMinutes() === 0 || freshDbState.scraperMode === "simulation") {
      writeLog("Otomatik Saatlik Tüketim (Del/Rec) taraması tetiklendi.", "info");
      for (const facilityId of Object.keys(freshDbState.facilities)) {
        scrapeFacilityDemand(facilityId, currentIsReal);
      }
    }
  }, 60000); // Check every minute
}

export function triggerAllScrapes(isReal: boolean) {
  const dbState = getDbState();
  writeLog("Tüm tesisler için manuel tarama başlatılıyor...", "info");
  for (const facilityId of Object.keys(dbState.facilities)) {
    scrapeFacilityKva(facilityId, isReal);
    // Also hit demand initially to make sure UI is fully loaded with fresh records
    scrapeFacilityDemand(facilityId, isReal);
  }
}
