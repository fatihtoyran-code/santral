/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  Activity, 
  Settings, 
  RefreshCw, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  TrendingUp, 
  Zap, 
  CloudSun, 
  Building2, 
  Plus, 
  Search, 
  ChevronRight, 
  Info, 
  Database,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  X,
  FileText
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar
} from "recharts";
import { Facility, KvaRecord, DemandRecord, SystemLog, DashboardStats } from "./types";

// Dynamic colors for facilities to make the charts beautiful
const FACILITY_COLOR_MAP: Record<string, string> = {
  "K499": "#fbbf24", // yellow/amber
  "K500": "#f59e0b", // deep amber
  "G500": "#ea580c", // orange
  "G499": "#f97316", // light orange
  "M499": "#3b82f6", // blue
  "M500": "#6366f1", // indigo
  "T500": "#10b981", // emerald green
};

export default function App() {
  // Application state
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ totalKva: 0, totalNetDaily: 0, activeFacilities: 0, totalFacilities: 7 });
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [settings, setSettings] = useState({ scraperMode: "simulation", scraperIntervalKva: 300 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  
  // Chart query and filtering state
  const [timeframeHours, setTimeframeHours] = useState<number>(24); // 1, 24, 168 (7d), 720 (30d)
  const [chartMetric, setChartMetric] = useState<"kva" | "demand" | "net">("kva");
  const [selectedFacilities, setSelectedFacilities] = useState<Record<string, boolean>>({
    K499: true, K500: true, G500: true, G499: true, M499: true, M500: true, T500: true
  });
  
  // History data
  const [historyKva, setHistoryKva] = useState<KvaRecord[]>([]);
  const [historyDemand, setHistoryDemand] = useState<DemandRecord[]>([]);

  // Settings & Override management
  const [intervalInput, setIntervalInput] = useState<string>("300");
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [overrideKva, setOverrideKva] = useState<string>("");
  const [overrideDel, setOverrideDel] = useState<string>("");
  const [overrideRec, setOverrideRec] = useState<string>("");
  const [submittingOverride, setSubmittingOverride] = useState(false);
  const [customLog, setCustomLog] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState<string>("all");

  // Tab states: modern or legacy (Python Dash match)
  const [activeTab, setActiveTab] = useState<"modern" | "legacy">("legacy");

  // Legacy Dash States
  const [legacyDate, setLegacyDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [legacyStart, setLegacyStart] = useState<string>("06:00");
  const [legacyEnd, setLegacyEnd] = useState<string>("20:50");
  const [legacyTesis, setLegacyTesis] = useState<string>("Hepsi");
  const [legacyLoading, setLegacyLoading] = useState<boolean>(false);
  const [legacyData, setLegacyData] = useState<{
    toplamKva: number;
    gunlukUretim: number;
    aylikUretim: number;
    kvaChartData: any[];
    monthlyBarData: any[];
  } | null>(null);

  const fetchLegacyData = async () => {
    try {
      setLegacyLoading(true);
      const res = await fetch(`/api/legacy-analytics?date=${legacyDate}&start=${legacyStart}&end=${legacyEnd}&facility=${legacyTesis}`);
      const data = await res.json();
      setLegacyData(data);
    } catch (err) {
      console.error("Error fetching legacy analytics:", err);
    } finally {
      setLegacyLoading(false);
    }
  };

  const handleLegacyShortcut = (minutes: number) => {
    const now = new Date();
    const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const startNow = new Date(now.getTime() - minutes * 60 * 1000);
    const startHHMM = `${String(startNow.getHours()).padStart(2, "0")}:${String(startNow.getMinutes()).padStart(2, "0")}`;
    
    setLegacyStart(startHHMM);
    setLegacyEnd(nowHHMM);
    setLegacyDate(now.toISOString().substring(0, 10));
  };

  const zamanOpsiyon = useMemo(() => {
    const ops = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 10) {
        ops.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return ops;
  }, []);

  // Sync effect for legacy tab
  useEffect(() => {
    if (activeTab === "legacy") {
      const dateStringRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateStringRegex.test(legacyDate)) {
        fetchLegacyData();
      }
    }
  }, [legacyDate, legacyStart, legacyEnd, legacyTesis, activeTab]);

  // Fetch critical live telemetry
  const fetchLiveData = async () => {
    try {
      // Parallelize fetches to get fast load speeds
      const [facRes, statsRes, logsRes, settingsRes] = await Promise.all([
        fetch("/api/facilities"),
        fetch("/api/stats"),
        fetch("/api/logs"),
        fetch("/api/settings")
      ]);

      const [facData, statsData, logsData, settingsData] = await Promise.all([
        facRes.json(),
        statsRes.json(),
        logsRes.json(),
        settingsRes.json()
      ]);

      setFacilities(facData);
      setStats(statsData);
      setLogs(logsData);
      setSettings(settingsData);
    } catch (err) {
      console.error("Error polling live telemetry:", err);
    }
  };

  // Fetch full metrics history based on active timeframes
  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/history?hours=${timeframeHours}`);
      const data = await res.json();
      setHistoryKva(data.kva || []);
      setHistoryDemand(data.demand || []);
    } catch (err) {
      console.error("Error fetching telemetry history:", err);
    }
  };

  // Onmount setup + Polling (every 5 seconds)
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await Promise.all([fetchLiveData(), fetchHistory()]);
      setLoading(false);
    };
    initialize();

    const intervalId = setInterval(fetchLiveData, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Update history whenever timeframe hours changes
  useEffect(() => {
    fetchHistory();
  }, [timeframeHours]);

  // Synchronize internal state input with setting changes
  useEffect(() => {
    setIntervalInput(settings.scraperIntervalKva.toString());
  }, [settings.scraperIntervalKva]);

  // Trigger manual immediate scrape check
  const handleTriggerManualScrape = async (facilityId: string = "all") => {
    setScanning(true);
    try {
      const res = await fetch("/api/scraper/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId })
      });
      const data = await res.json();
      if (data.success) {
        await Promise.all([fetchLiveData(), fetchHistory()]);
      }
    } catch (err) {
      console.error("Failed to run manual scrape:", err);
    } finally {
      setScanning(false);
    }
  };

  // Change scraper mode
  const handleToggleScraperMode = async (mode: "real" | "simulation") => {
    try {
      const res = await fetch("/api/scraper/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, scraperMode: data.mode }));
        fetchLiveData();
      }
    } catch (err) {
      console.error("Failed to toggle scraper mode:", err);
    }
  };

  // Change scan interval
  const handleUpdateInterval = async (e: React.FormEvent) => {
    e.preventDefault();
    const secs = parseInt(intervalInput);
    if (isNaN(secs) || secs < 10) return;

    try {
      const res = await fetch("/api/scraper/interval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds: secs })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, scraperIntervalKva: data.interval }));
        writeFeedbackToast("kVA Tarama Aralığı Başarıyla Güncellendi");
      }
    } catch (err) {
      console.error("Failed to update interval:", err);
    }
  };

  // Submit diagnostic manual telemetry overrides
  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacility) return;
    setSubmittingOverride(true);

    try {
      const payload: any = { facilityId: selectedFacility.id };
      if (overrideKva) payload.kva = overrideKva;
      if (overrideDel && overrideRec) {
        payload.del = overrideDel;
        payload.rec = overrideRec;
      }

      const res = await fetch("/api/facilities/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setOverrideKva("");
        setOverrideDel("");
        setOverrideRec("");
        // Reload details
        const facRes = await fetch("/api/facilities");
        const facs = await facRes.json();
        setFacilities(facs);
        const updated = facs.find((f: Facility) => f.id === selectedFacility.id);
        if (updated) setSelectedFacility(updated);
        
        await Promise.all([fetchLiveData(), fetchHistory()]);
      }
    } catch (err) {
      console.error("Error setting override:", err);
    } finally {
      setSubmittingOverride(false);
    }
  };

  // Clear system logs
  const handleClearLogs = async () => {
    try {
      const res = await fetch("/api/logs/clear", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setLogs([]);
      }
    } catch (err) {
      console.error("Failed clearing logs:", err);
    }
  };

  // Simple feedback helper
  const writeFeedbackToast = (msg: string) => {
    // We add to backend logs as system banner to preserve professional terminal aesthetic
    console.log(msg);
  };

  // Facilities Toggling helper
  const toggleFacilitySelection = (facilityId: string) => {
    setSelectedFacilities(prev => ({
      ...prev,
      [facilityId]: !prev[facilityId]
    }));
  };

  // Filter logs reactively
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.message.toLowerCase().includes(logSearch.toLowerCase()) || 
                            (log.tesis && log.tesis.toLowerCase().includes(logSearch.toLowerCase()));
      const matchesType = logTypeFilter === "all" || log.type === logTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [logs, logSearch, logTypeFilter]);

  // Formulate data structures optimized for recharts consumption
  // Recharts requires [{ timestamp, K499: val, K500: val, ... }]
  const processedKvaChartData = useMemo(() => {
    const timeMap: Record<string, Record<string, number>> = {};
    
    historyKva.forEach(record => {
      // Format time based on timeframe complexity (show full timestamp, hour only, or date depending on zoom level)
      let timeKey = record.timestamp;
      if (timeframeHours <= 24) {
        // Just HH:MM
        timeKey = record.timestamp.substring(11, 16);
      } else {
        // MM-DD HH:MM
        timeKey = record.timestamp.substring(5, 16);
      }

      if (!timeMap[timeKey]) {
        timeMap[timeKey] = {};
      }
      
      if (selectedFacilities[record.tesis]) {
        timeMap[timeKey][record.tesis] = record.kva_total;
      }
    });

    return Object.entries(timeMap).map(([time, values]) => ({
      time,
      ...values
    })).sort((a,b) => a.time.localeCompare(b.time));
  }, [historyKva, selectedFacilities, timeframeHours]);

  const processedDemandChartData = useMemo(() => {
    const timeMap: Record<string, Record<string, number>> = {};
    
    historyDemand.forEach(record => {
      let timeKey = record.timestamp;
      if (timeframeHours <= 24) {
        timeKey = record.timestamp.substring(11, 16);
      } else {
        timeKey = record.timestamp.substring(5, 10); // just date for multi-day
      }

      if (!timeMap[timeKey]) {
        timeMap[timeKey] = {};
      }

      if (selectedFacilities[record.tesis]) {
        // Metric can be absolute Del/Rec or net
        if (chartMetric === "demand") {
          timeMap[timeKey][`${record.tesis}_Del`] = record.del_kwh || 0;
          timeMap[timeKey][`${record.tesis}_Rec`] = record.rec_kwh || 0;
        } else if (chartMetric === "net") {
          timeMap[timeKey][record.tesis] = record.net_kwh || 0;
        }
      }
    });

    return Object.entries(timeMap).map(([time, values]) => ({
      time,
      ...values
    })).sort((a,b) => a.time.localeCompare(b.time));
  }, [historyDemand, selectedFacilities, chartMetric, timeframeHours]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* HEADER SECTION */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3 md:px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-amber-600 to-yellow-400 rounded-lg text-slate-950">
            <Activity className="h-6 w-6" id="app-logo-icon" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Enerji Telemetri Takip Paneli
              <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                v1.2.0 Python Core
              </span>
            </h1>
            <p className="text-xs text-slate-400">Solar Enerji Üretim Tesisleri ve Grid Telemetri Portu Canlı Takip Sistemi</p>
          </div>
        </div>

        {/* Real-time status badge */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono font-medium text-emerald-400">SİSTEM BAĞLANTISI AKTİF</span>
          </div>

          <button 
            onClick={() => handleTriggerManualScrape("all")}
            disabled={scanning}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white font-medium text-xs transition duration-200 shadow-md shadow-indigo-900/30 font-sans cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? "Tüm Tesisler Taranıyor..." : "Şimdi Tara (Tümü)"}
          </button>
        </div>
      </header>

      {/* PANEL MODES TABS SELECTOR */}
      <section className="px-4 md:px-6 pt-4 bg-slate-950 flex border-b border-slate-900 justify-start">
        <div className="flex bg-slate-900/40 p-1 rounded-t-xl border-t border-x border-slate-900 gap-1">
          <button
            onClick={() => setActiveTab("modern")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === "modern" 
                ? "bg-gradient-to-r from-amber-600 to-yellow-500 text-slate-950 shadow-md font-bold" 
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Modern Takip Paneli
          </button>
          <button
            onClick={() => setActiveTab("legacy")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === "legacy" 
                ? "bg-slate-800 text-amber-400 border border-slate-700 font-bold shadow-md" 
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Klasik kVA Paneli (Flask-Dash Modu)
          </button>
        </div>
      </section>

      {activeTab === "legacy" ? (
        /* REPLICATED CLASSIC PYTHON FLASK-DASHBOARD VIEW */
        <div className="flex-1 p-4 md:p-6 bg-slate-950 max-w-4xl mx-auto w-full flex flex-col gap-6 animate-fade-in">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-amber-400">Canlı kVA Paneli (Klasik Görünüm)</h2>
            <p className="text-xs text-slate-400 mt-1">Python orijinal Flask/Dash stilinde kVA ve Enerji Dengesi Analiz Ekranı</p>
          </div>

          {/* DATE & TIME SELECTOR BAR */}
          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:flex-1">
              {/* DatePicker */}
              <div className="flex flex-col gap-1 w-full">
                <span className="text-[10px] font-medium text-slate-400 font-mono">Tarih Seçimi</span>
                <input 
                  type="date" 
                  value={legacyDate}
                  onChange={(e) => setLegacyDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-105 outline-none focus:border-amber-500 font-mono w-full"
                />
              </div>

              {/* Start Time */}
              <div className="flex flex-col gap-1 w-full">
                <span className="text-[10px] font-medium text-slate-400 font-mono">Saat Başlangıç</span>
                <select 
                  value={legacyStart} 
                  onChange={(e) => setLegacyStart(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-105 outline-none focus:border-amber-500 font-mono w-full"
                >
                  {zamanOpsiyon.map(op => (
                    <option key={`start-${op}`} value={op}>{op}</option>
                  ))}
                </select>
              </div>

              {/* End Time */}
              <div className="flex flex-col gap-1 w-full">
                <span className="text-[10px] font-medium text-slate-400 font-mono">Saat Bitiş</span>
                <select 
                  value={legacyEnd} 
                  onChange={(e) => setLegacyEnd(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-105 outline-none focus:border-amber-500 font-mono w-full"
                >
                  {zamanOpsiyon.map(op => (
                    <option key={`end-${op}`} value={op}>{op}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* FACILITY SELECTOR & TIME SHORTCUTS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Tesis Seçimi Dropdown */}
            <div className="md:col-span-6 bg-slate-900/30 p-3 rounded-lg border border-slate-900 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300">Tesis Seçimi</label>
              <select 
                value={legacyTesis}
                onChange={(e) => setLegacyTesis(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-100 outline-none focus:border-amber-500 w-full"
              >
                <option value="Hepsi">Hepsi</option>
                {facilities.map(f => (
                  <option key={`legS-${f.id}`} value={f.id}>{f.id} - {f.name.split(' ')[1] || 'Saha'}</option>
                ))}
              </select>
            </div>

            {/* Kısayol buttons */}
            <div className="md:col-span-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-slate-900/30 p-3 rounded-lg border border-slate-900 w-full h-full">
              <span className="text-xs font-bold text-slate-300">Hızlı Kısayol:</span>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 w-full sm:w-auto">
                <button
                  onClick={() => handleLegacyShortcut(10)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded transition duration-150 cursor-pointer"
                >
                  10 dk
                </button>
                <button
                  onClick={() => handleLegacyShortcut(30)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded transition duration-150 cursor-pointer"
                >
                  30 dk
                </button>
                <button
                  onClick={() => handleLegacyShortcut(60)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded transition duration-150 cursor-pointer"
                >
                  1 saat
                </button>
              </div>
            </div>
          </div>

          {/* THREE CORE BOXES (KARTLAR) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Box 1: Anlık Güç */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center select-none shadow-md">
              <span className="text-xs font-semibold text-rose-500">Anlık Güç</span>
              <div className="text-3xl font-black text-rose-500 mt-2 font-mono">
                {legacyLoading ? (
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-rose-500 my-1" />
                ) : (
                  `${legacyData ? legacyData.toplamKva.toLocaleString("tr-TR") : "0"} kVA`
                )}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Seçili periyot katsayı ağırlıklı kVA gücü</p>
            </div>

            {/* Box 2: Günlük Üretim */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center select-none shadow-md">
              <span className="text-xs font-semibold text-emerald-500">Günlük Üretim</span>
              <div className="text-3xl font-black text-emerald-500 mt-2 font-mono">
                {legacyLoading ? (
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-emerald-500 my-1" />
                ) : (
                  `${legacyData ? legacyData.gunlukUretim.toLocaleString("tr-TR") : "0"} kWh`
                )}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Dün sonu ile bugün sonu farkından net kazanç</p>
            </div>

            {/* Box 3: Aylık Üretim */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center select-none shadow-md">
              <span className="text-xs font-semibold text-indigo-400">Aylık Üretim (Kümülatif)</span>
              <div className="text-3xl font-black text-indigo-400 mt-2 font-mono">
                {legacyLoading ? (
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-400 my-1" />
                ) : (
                  `${legacyData ? legacyData.aylikUretim.toLocaleString("tr-TR") : "0"} kWh`
                )}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Ay başından seçili güne kadar toplam net kazanç</p>
            </div>
          </div>

          {/* BOX 4: LINE CHART FOR TARGET TIME PERIOD */}
          <div className="bg-slate-900/30 border border-slate-900 p-4 md:p-5 rounded-xl flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-rose-500" />
              Zaman Serisi kVA Güç Akış Grafiği
            </h3>
            
            <div className="h-[280px] bg-slate-950 p-2 rounded-lg border border-slate-900/60">
              {legacyLoading ? (
                <div className="h-full flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin" />
                </div>
              ) : legacyData && legacyData.kvaChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={legacyData.kvaChartData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
                    <XAxis dataKey="time" stroke="#475569" fontSize={9} />
                    <YAxis stroke="#475569" fontSize={9} unit=" kVA" />
                    <Tooltip contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "6px", fontSize: "10px" }} />
                    <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "10px", pt: 10 }} />
                    {legacyTesis === "Hepsi" ? (
                      Object.keys(FACILITY_COLOR_MAP).map(id => (
                        <Line 
                          key={`legL-${id}`} 
                          type="monotone" 
                          dataKey={id} 
                          name={id} 
                          stroke={FACILITY_COLOR_MAP[id]} 
                          strokeWidth={2} 
                          dot={false} 
                        />
                      ))
                    ) : (
                      <Line 
                        type="monotone" 
                        dataKey={legacyTesis} 
                        name={legacyTesis} 
                        stroke={FACILITY_COLOR_MAP[legacyTesis] || "#3b82f6"} 
                        strokeWidth={2} 
                        dot={false} 
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  Mevcut filtrelerle kVA güç akış verisi bulunamadı.
                </div>
              )}
            </div>
          </div>

          {/* BOX 5: MONTHLY DAILY BAR CHART */}
          <div className="bg-slate-900/30 border border-slate-900 p-4 md:p-5 rounded-xl flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-500" />
              Aylık Günlük Net Üretim Çubuk Grafiği (kWh)
            </h3>

            <div className="h-[200px] bg-slate-950 p-2 rounded-lg border border-slate-900/60">
              {legacyLoading ? (
                <div className="h-full flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 text-emerald-500 animate-spin" />
                </div>
              ) : legacyData && legacyData.monthlyBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={legacyData.monthlyBarData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
                    <XAxis dataKey="day" stroke="#475569" fontSize={9} />
                    <YAxis stroke="#475569" fontSize={9} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "6px", fontSize: "10px" }}
                      formatter={(value: any) => [`${value.toLocaleString("tr-TR")} kWh`, "Net Üretim"]}
                    />
                    <Bar dataKey="netProduction" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  Aylık üretim verisi bulunamadı.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* CORE STATS BOARD */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 md:p-6 bg-slate-950">
        
        {/* STAT 1: ACTIVE INSTANTANEOUS KVA */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-amber-500/40 transition duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400">Anlık kVA Üretim/Yük</span>
            <span className="p-1 px-1.5 text-[10px] font-mono rounded bg-amber-500/10 text-amber-400 border border-amber-500/25">Anlık Gözlem</span>
          </div>
          <div className="mt-2.5">
            <div className="text-3xl font-extrabold tracking-tight text-amber-400 font-mono">
              {stats.totalKva.toLocaleString("tr-TR")} <span className="text-sm font-semibold">kVA</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1.5">
              <Zap className="h-3 w-3 text-amber-400" />
              Sistem anlık deşarj/güç üretimi
            </div>
          </div>
        </div>

        {/* STAT 2: TOTAL DELIVERED GRID (Del) */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-blue-500/40 transition duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400">Sistem Şebeke Çekimi (Del)</span>
            <span className="p-1 px-1.5 text-[10px] font-mono rounded bg-blue-500/10 text-blue-400 border border-blue-500/25">Aktif Tüketim</span>
          </div>
          <div className="mt-2.5">
            <div className="text-3xl font-extrabold tracking-tight text-blue-400 font-mono">
              {stats.totalDel ? stats.totalDel.toLocaleString("tr-TR") : "0"} <span className="text-sm font-semibold">kWh</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1.5">
              <ArrowUpRight className="h-3 w-3 text-blue-400" />
              Şebekeden çekilen kümülatif enerji
            </div>
          </div>
        </div>

        {/* STAT 3: TOTAL SOLAR RECEIVED (Rec) */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-emerald-500/40 transition duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400">Sisteme Basılan (Rec)</span>
            <span className="p-1 px-1.5 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">Aktif Üretim</span>
          </div>
          <div className="mt-2.5">
            <div className="text-3xl font-extrabold tracking-tight text-emerald-400 font-mono">
              {stats.totalRec ? stats.totalRec.toLocaleString("tr-TR") : "0"} <span className="text-sm font-semibold">kWh</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1.5">
              <ArrowDownRight className="h-3 w-3 text-emerald-400" />
              Şebekeye basılan kümülatif üretim
            </div>
          </div>
        </div>

        {/* STAT 4: TOTAL COLECTIVE NET */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-indigo-500/40 transition duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400">Net Enerji Dengesi</span>
            <span className={`p-1 px-1.5 text-[10px] font-mono rounded ${stats.totalNet < 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              {stats.totalNet < 0 ? "Enerji İhracatı" : "Enerji İthalatı"}
            </span>
          </div>
          <div className="mt-2.5">
            <div className={`text-3xl font-extrabold tracking-tight font-mono ${stats.totalNet < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.totalNet ? stats.totalNet.toLocaleString("tr-TR") : "0"} <span className="text-sm font-semibold">kWh</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1.5">
              <Info className="h-3 w-3" />
              Del - Rec farkı (eksi değer kazançtır)
            </div>
          </div>
        </div>

        {/* STAT 5: STATION PERFORMANCE */}
        <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between hover:border-indigo-500/40 transition duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-slate-400">Çevrimiçi Tesis / Port</span>
            <span className="p-1 px-1.5 text-[10px] font-mono rounded bg-purple-500/10 text-purple-400 border border-purple-500/25">İletişim</span>
          </div>
          <div className="mt-2.5">
            <div className="text-3xl font-extrabold tracking-tight text-white font-mono">
              {stats.activeFacilities} <span className="text-slate-500 text-lg">/</span> {stats.totalFacilities}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1.5">
              <Building2 className="h-3 w-3 text-slate-400" />
              Aktif scrapper port erişimi
            </div>
          </div>
        </div>

      </section>

      {/* SYSTEM CONTROLLER & UTILITIES DRAWER */}
      <section className="px-4 md:px-6 pb-2">
        <div className="bg-slate-900/20 border border-slate-900 p-4 rounded-lg flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex flex-wrap items-center gap-6">
            
            {/* Scrapper Mode Config */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Sliders className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                Sorgu Kaynağı Seçimi (Scraper Modu)
              </span>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => handleToggleScraperMode("simulation")}
                  className={`px-3 py-1 text-xs rounded font-medium transition duration-150 cursor-pointer ${
                    settings.scraperMode === "simulation" 
                      ? "bg-amber-500 text-slate-950" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sanal Simülatör (7/24 Aktif)
                </button>
                <button
                  onClick={() => handleToggleScraperMode("real")}
                  className={`px-3 py-1 text-xs rounded font-medium transition duration-150 cursor-pointer ${
                    settings.scraperMode === "real" 
                      ? "bg-rose-600 text-white" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Gerçek Sahalar (IP Adresleri)
                </button>
              </div>
            </div>

            {/* kVA Interval Set */}
            <form onSubmit={handleUpdateInterval} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">
                kVA Tarama Sıklığı (Saniye)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  value={intervalInput}
                  onChange={(e) => setIntervalInput(e.target.value)}
                  className="bg-slate-950 border border-slate-800 outline-none rounded px-3 py-1 text-xs w-24 focus:border-amber-500 text-slate-100 font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded text-xs font-medium transition duration-150 border border-slate-700 cursor-pointer"
                >
                  Güncelle
                </button>
              </div>
            </form>

          </div>

          <div className="text-xs text-slate-400 lg:text-right bg-slate-950/40 p-2 px-3 rounded border border-slate-900 font-mono w-full lg:w-auto">
            {settings.scraperMode === "real" ? (
              <p className="text-rose-400 flex items-center justify-end gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                Dikkat: Gerçek IP modunda sahaların ağ geçitlerine (78.189.x / 5.26.x) talep gönderilir.
              </p>
            ) : (
              <p className="text-amber-400 flex items-center justify-end gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Simülatör Modu: Güneş verileri saatlik güneş döngüsüne uygun üretilmektedir.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* DASHBOARD CORE LAYOUT */}
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 p-4 md:p-6">
        
        {/* LEFT COLUMN: INTERACTIVE TELEMETRY VIZ (8 Columns out of 12) */}
        <section className="xl:col-span-8 flex flex-col gap-6">
          
          <div className="bg-slate-900/30 border border-slate-900 p-4 md:p-5 rounded-xl flex flex-col gap-4">
            
            {/* Viz Header with filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                <h2 className="text-base font-semibold text-white">Çoklu Tesis Karşılaştırmalı Zaman Serisi Grafik</h2>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Metric filter selects */}
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setChartMetric("kva")}
                    className={`px-3 py-1 text-xs rounded transition duration-150 cursor-pointer ${
                      chartMetric === "kva" ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Anlık Güç (kVA)
                  </button>
                  <button
                    onClick={() => {
                      setChartMetric("demand");
                      // Demand is only stored inside demand history, let's limit minimum timeframe for clean bars
                      if (timeframeHours < 24) setTimeframeHours(24);
                    }}
                    className={`px-3 py-1 text-xs rounded transition duration-150 cursor-pointer ${
                      chartMetric === "demand" ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Toplam Tüketici (Del/Rec)
                  </button>
                  <button
                    onClick={() => {
                      setChartMetric("net");
                      if (timeframeHours < 24) setTimeframeHours(24);
                    }}
                    className={`px-3 py-1 text-xs rounded transition duration-150 cursor-pointer ${
                      chartMetric === "net" ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Net Tüketim Dengesi
                  </button>
                </div>

                {/* Duration Limit Selector */}
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {chartMetric === "kva" && (
                    <button
                      onClick={() => setTimeframeHours(1)}
                      className={`px-2.5 py-1 text-xs rounded transition duration-150 cursor-pointer ${
                        timeframeHours === 1 ? "bg-slate-800 text-amber-400 font-medium" : "text-slate-400"
                      }`}
                    >
                      1 Saat
                    </button>
                  )}
                  <button
                    onClick={() => setTimeframeHours(24)}
                    className={`px-2.5 py-1 text-xs rounded transition duration-150 cursor-pointer ${
                      timeframeHours === 24 ? "bg-slate-800 text-amber-400 font-medium" : "text-slate-400"
                    }`}
                  >
                    24 Saat
                  </button>
                  <button
                    onClick={() => setTimeframeHours(168)}
                    className={`px-2.5 py-1 text-xs rounded transition duration-150 cursor-pointer ${
                      timeframeHours === 168 ? "bg-slate-800 text-amber-400 font-medium" : "text-slate-400"
                    }`}
                  >
                    7 Gün
                  </button>
                  <button
                    onClick={() => setTimeframeHours(720)}
                    className={`px-2.5 py-1 text-xs rounded transition duration-150 cursor-pointer ${
                      timeframeHours === 720 ? "bg-slate-800 text-amber-400 font-medium" : "text-slate-400"
                    }`}
                  >
                    30 Gün
                  </button>
                </div>
              </div>
            </div>

            {/* Overlying checklist - Choose what to display */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
              <span className="text-xs text-slate-400 flex items-center gap-1 mr-2 font-medium">
                <SlidersHorizontal className="h-3 w-3" />
                Sinyal Filtresi:
              </span>
              {facilities.map(f => (
                <button
                  key={f.id}
                  onClick={() => toggleFacilitySelection(f.id)}
                  className={`px-2.5 py-1 rounded text-xs transition duration-150 border flex items-center gap-1.5 cursor-pointer ${
                    selectedFacilities[f.id]
                      ? "bg-slate-900 text-white font-medium shadow-sm border-slate-700"
                      : "bg-transparent text-slate-500 border-slate-950 opacity-40 hover:opacity-75"
                  }`}
                >
                  <span 
                    className="inline-block w-2 h-2 rounded-full" 
                    style={{ backgroundColor: FACILITY_COLOR_MAP[f.id] }}
                  ></span>
                  {f.id}
                </button>
              ))}
            </div>

            {/* CHART VIEWPORTS */}
            <div className="h-[380px] w-full bg-slate-950/50 p-2 rounded-xl border border-slate-900/60 flex items-center justify-center">
              {loading ? (
                <div className="text-center flex flex-col items-center gap-3">
                  <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
                  <p className="text-xs text-slate-400">Geçmiş veriler yükleniyor...</p>
                </div>
              ) : (chartMetric === "kva" && processedKvaChartData.length === 0) || 
                  (chartMetric !== "kva" && processedDemandChartData.length === 0) ? (
                <div className="text-center p-6 text-slate-500 text-xs flex flex-col items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-slate-600" />
                  Mevcut filtrelerle eşleşen geçmiş telemetri verisi bulunamadı.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMetric === "kva" ? (
                    <LineChart 
                      data={processedKvaChartData}
                      margin={{ top: 15, right: 25, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
                      <XAxis 
                        dataKey="time" 
                        stroke="#475569" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#475569" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        unit=" kva"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px", fontSize: "11px" }}
                        labelClassName="text-slate-400 font-semibold mb-1"
                      />
                      <Legend 
                        iconType="circle" 
                        iconSize={7} 
                        wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} 
                      />
                      {facilities.map(f => (
                        selectedFacilities[f.id] && (
                          <Line
                            key={f.id}
                            type="monotone"
                            dataKey={f.id}
                            name={`${f.id} (${f.name.split(' ')[1] || 'Saha'})`}
                            stroke={FACILITY_COLOR_MAP[f.id]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        )
                      ))}
                    </LineChart>
                  ) : chartMetric === "net" ? (
                    <LineChart 
                      data={processedDemandChartData}
                      margin={{ top: 15, right: 25, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
                      <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} unit=" kWh" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px", fontSize: "11px" }}
                        labelClassName="text-slate-400 font-semibold mb-1"
                      />
                      <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                      {facilities.map(f => (
                        selectedFacilities[f.id] && (
                          <Line
                            key={f.id}
                            type="monotone"
                            dataKey={f.id}
                            name={`${f.id} Net`}
                            stroke={FACILITY_COLOR_MAP[f.id]}
                            strokeWidth={2.5}
                            dot={{ r: 2 }}
                          />
                        )
                      ))}
                    </LineChart>
                  ) : (
                    // Bar comparison for Delivered & Received cumulative meters split
                    <BarChart 
                      data={processedDemandChartData}
                      margin={{ top: 15, right: 25, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
                      <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} unit=" kWh" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px", fontSize: "11px" }}
                        labelClassName="text-slate-400 font-semibold mb-1"
                      />
                      <Legend iconType="rect" wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} />
                      
                      {/* Plot Del as negative (or adjacent bars) and Rec as positive */}
                      {facilities.map(f => (
                        selectedFacilities[f.id] && (
                          <Bar 
                            key={`${f.id}_Del`} 
                            dataKey={`${f.id}_Del`} 
                            name={`${f.id} Verilen (Del)`} 
                            fill={FACILITY_COLOR_MAP[f.id]} 
                            stackId={`${f.id}`}
                            opacity={0.45}
                          />
                        )
                      ))}
                      {facilities.map(f => (
                        selectedFacilities[f.id] && (
                          <Bar 
                            key={`${f.id}_Rec`} 
                            dataKey={`${f.id}_Rec`} 
                            name={`${f.id} Alınan (Rec)`} 
                            fill={FACILITY_COLOR_MAP[f.id]} 
                            stackId={`${f.id}`}
                          />
                        )
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-mono text-center flex items-center justify-center gap-4">
              <span>● K499/K500/G500/G499: Solar Jeneneratörler</span>
              <span>● M499/M500: Tüketici Fabrika & Trafolar</span>
              <span>● T500: Turges Çoklu İnverter Güneş Sahası</span>
            </div>

          </div>

          {/* LOWER LOGS BOX (Anlık terminal takibi) */}
          <div className="bg-slate-900/30 border border-slate-900 p-4 md:p-5 rounded-xl flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                <h2 className="text-base font-semibold text-white">Sistem Log Konsolu (log.txt İzleyici)</h2>
              </div>
              
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48 bg-slate-950 rounded-lg border border-slate-800 flex items-center px-2">
                  <Search className="h-3.5 w-3.5 text-slate-500 min-w-[14px]" />
                  <input
                    type="text"
                    placeholder="Log ara..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs text-slate-200 p-1.5 w-full placeholder:text-slate-600"
                  />
                </div>

                <select 
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg p-1.5 font-sans"
                  value={logTypeFilter}
                  onChange={(e) => setLogTypeFilter(e.target.value)}
                >
                  <option value="all">Filtrele: Tümü</option>
                  <option value="info">Bilgi (INFO)</option>
                  <option value="success">Başarılı (OK)</option>
                  <option value="error">Hatalar (ERR)</option>
                </select>

                <button
                  onClick={handleClearLogs}
                  className="p-1.5 hover:bg-slate-850 bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition duration-150 cursor-pointer"
                  title="Konsolu Temizle"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* LIVE CONSOLE INTERACTIVE FEED */}
            <div className="bg-slate-950 border border-slate-900 rounded-lg h-56 overflow-y-auto p-3 font-mono text-xs flex flex-col gap-2 scroll-smooth">
              {filteredLogs.length === 0 ? (
                <div className="text-center text-slate-600 italic py-12">
                  Eşleşen sistem log kaydı bulunamadı.
                </div>
              ) : (
                filteredLogs.map(log => {
                  let badgeColor = "text-slate-500 bg-slate-900 border-slate-900";
                  if (log.type === "success") badgeColor = "text-emerald-400 bg-emerald-950/20 border-emerald-900/30";
                  if (log.type === "error") badgeColor = "text-rose-400 bg-rose-950/20 border-rose-900/30";
                  if (log.type === "warning") badgeColor = "text-amber-400 bg-amber-950/20 border-amber-900/30";

                  return (
                    <div key={log.id} className="flex items-start gap-2 py-0.5 border-b border-slate-900/40 hover:bg-slate-900/20 px-1 rounded transition duration-100">
                      <span className="text-slate-600 select-none min-w-[125px]">{log.timestamp}</span>
                      
                      {log.tesis && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-indigo-400 border border-slate-800 leading-none">
                          {log.tesis}
                        </span>
                      )}

                      <span className={`px-1 rounded text-[10px] leading-none select-none ${badgeColor} border`}>
                        {log.type.toUpperCase()}
                      </span>

                      <span className={`flex-1 break-all ${
                        log.type === "error" ? "text-rose-300" : 
                        log.type === "success" ? "text-emerald-200" : "text-slate-300"
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add manual custom logging diagnostic line */}
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Konsola el ile log kaydı gönder (Test)..."
                value={customLog}
                onChange={(e) => setCustomLog(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customLog.trim()) {
                    // Send test log directly by hitting the overriding endpoint or local insertion
                    // For speed, mock local insertion in list, can also call api logs if we expose posting
                    const entry: SystemLog = {
                      id: Math.random().toString(),
                      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
                      message: customLog,
                      type: "info",
                    };
                    setLogs(prev => [entry, ...prev]);
                    setCustomLog("");
                  }
                }}
                className="bg-slate-950 text-xs border border-slate-850 focus:border-indigo-500 rounded px-3 py-1.5 flex-1 text-slate-200 outline-none placeholder:text-slate-600 font-mono"
              />
              <button 
                onClick={() => {
                  if (customLog.trim()) {
                    const entry: SystemLog = {
                      id: Math.random().toString(),
                      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
                      message: customLog,
                      type: "info",
                    };
                    setLogs(prev => [entry, ...prev]);
                    setCustomLog("");
                  }
                }}
                className="text-xs font-semibold px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded transition duration-150 cursor-pointer"
              >
                Gönder
              </button>
            </div>

          </div>

        </section>

        {/* RIGHT COLUMN: FACILITIES TRACKER CARDS (4 Columns out of 12) */}
        <section className="xl:col-span-4 flex flex-col gap-5">
          
          <div className="border border-slate-900 bg-slate-900/10 p-4 md:p-5 rounded-xl">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-400" />
              Saha İletişim Noktaları
            </h2>

            {/* FACILITIES LIST CARD STACK */}
            <div className="flex flex-col gap-3">
              {facilities.map(f => {
                const isActive = f.status === "online";
                const isIdle = f.status === "idle";
                const isError = f.status === "error";

                return (
                  <div
                    key={f.id}
                    onClick={() => {
                      setSelectedFacility(f);
                      // Clear standard form inputs on selection
                      setOverrideKva(f.lastKva?.toString() || "");
                      setOverrideDel(f.lastDel?.toString() || "");
                      setOverrideRec(f.lastRec?.toString() || "");
                    }}
                    className={`p-3.5 rounded-xl border transition-all duration-300 cursor-pointer hover:scale-[1.01] ${
                      selectedFacility?.id === f.id
                        ? "bg-slate-900 border-indigo-500/60 shadow-lg shadow-indigo-950/40"
                        : "bg-slate-950/60 border-slate-900 hover:border-slate-800"
                    }`}
                  >
                    
                    {/* Header line of card */}
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span 
                            className="inline-block w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: FACILITY_COLOR_MAP[f.id] }}
                          ></span>
                          <span className="font-mono text-sm font-bold text-white leading-none">{f.id}</span>
                        </div>
                        <h3 className="text-xs text-slate-400 font-medium mt-1 leading-snug">{f.name}</h3>
                      </div>

                      {/* Status pill badge */}
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                        isActive ? "text-emerald-400 bg-emerald-950/20 border-emerald-900/30" :
                        isIdle ? "text-slate-400 bg-slate-900 border-slate-800" :
                        "text-rose-400 bg-rose-950/20 border-rose-900/30"
                      }`}>
                        {f.status === "online" ? "ÜRETİM" : f.status === "idle" ? "BEKLEMEDE" : "HATA"}
                      </span>
                    </div>

                    {/* Numeric stats section */}
                    <div className="grid grid-cols-2 gap-2 mt-3 p-2 bg-slate-950/40 border border-slate-900/80 rounded-lg">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-slate-500 leading-none">kVA Toplam</span>
                        <span className="text-xs font-mono font-bold text-amber-400">
                          {f.lastKva !== null ? `${f.lastKva} kVA` : "—"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-slate-500 leading-none">Net Enerji (Net)</span>
                        <span className={`text-xs font-mono font-bold ${f.lastNet !== null && f.lastNet < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {f.lastNet !== null ? `${f.lastNet.toLocaleString()} kWh` : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Sub references */}
                    <div className="flex justify-between items-center mt-3 text-[10px] text-slate-500 font-mono">
                      <span>{f.url}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* FACILITY METRICS OVERRIDE / PANEL DRAWER */}
          {selectedFacility && (
            <div className="border border-slate-900 bg-slate-900/20 p-4 md:p-5 rounded-xl flex flex-col gap-4 animate-fadeIn">
              <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-4.5 w-4.5 text-amber-500" />
                  <h3 className="text-sm font-semibold text-white">
                    {selectedFacility.id} Detaylı Kontrol Paneli
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedFacility(null)}
                  className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Station General metadata */}
              <div className="flex flex-col gap-2 text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-900 font-mono">
                <p className="flex justify-between">
                  <span className="text-slate-500">Tesis Adı:</span>
                  <span className="text-slate-200">{selectedFacility.name}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500">Port Hedef URL:</span>
                  <a href={selectedFacility.url} target="_blank" rel="noreferrer" className="text-amber-400 underline hover:text-amber-300">
                    {selectedFacility.url}
                  </a>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500">kVA Tarama Zamanı:</span>
                  <span className="text-slate-200">{selectedFacility.lastUpdatedKva || "Bulunmuyor"}</span>
                </p>
                <p className="flex justify-between border-t border-slate-900 pt-2 mt-1">
                  <span className="text-slate-500">Tüketim Tarama Zamanı:</span>
                  <span className="text-slate-200">{selectedFacility.lastUpdatedDemand || "Bulunmuyor"}</span>
                </p>

                {selectedFacility.errorMassage && (
                  <div className="mt-2.5 p-2 rounded bg-rose-950/20 text-rose-300 border border-rose-900/30 text-[11px] leading-snug">
                    <span className="font-bold flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3 w-3 text-rose-400" />
                      Son Hata Raporu:
                    </span>
                    {selectedFacility.errorMassage}
                  </div>
                )}
              </div>

              {/* T500 SPECIAL TURGES INVERTERS REPRESENTATION */}
              {selectedFacility.id === "T500" && (
                <div className="p-3 bg-indigo-950/10 border border-indigo-900/30 rounded-lg flex flex-col gap-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 select-noneUnified uppercase tracking-wider">
                      <Database className="h-3.5 w-3.5" />
                      T500 Entegre 5 İnverter Dağılımı
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 italic">5 Cihaz Ayrık Kayıt</span>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const deviceNo = index + 1;
                      const deviceKva = selectedFacility.lastKva !== null ? parseFloat((selectedFacility.lastKva / 5).toFixed(2)) : 0;
                      
                      return (
                        <div key={deviceNo} className="bg-slate-950/80 border border-slate-900 p-2.5 rounded text-center flex flex-col gap-0.5">
                          <span className="text-[9px] text-slate-500 font-bold block leading-none">INV #{deviceNo}</span>
                          <span className="text-xs font-mono font-bold text-emerald-400 block mt-1.5">{deviceKva}</span>
                          <span className="text-[8px] text-slate-600 block mt-0.5 leading-none font-mono">kVA</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-snug italic font-mono bg-slate-950/40 p-1.5 rounded">
                    T500 kVA total değeri 5'e bölünerek her inverter için PC üzerinde ("C:/santral/data.db" daily_reports & tescom_data) SQLite veri tablolarına yazılır.
                  </p>
                </div>
              )}

              {/* MANUAL TEST OVERRIDES (Sadece Geliştirici Deneyimleri İçin) */}
              <form onSubmit={handleOverrideSubmit} className="flex flex-col gap-3 pt-1 border-t border-slate-900">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-400 select-none">
                  <span>Değer Güçlendirme (Hata Giderme Simülasyonu)</span>
                  <span className="px-1 text-[9px] bg-amber-500/10 border border-amber-500/20 rounded font-normal text-amber-400">Veri Testi</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-medium">Manuel kVA Gir</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="kVA"
                      value={overrideKva}
                      onChange={(e) => setOverrideKva(e.target.value)}
                      className="bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-xs text-slate-100 font-mono outline-none focus:border-amber-500/60"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-medium">Del/Rec Veri Seti (kWh)</label>
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="number"
                        placeholder="Del"
                        value={overrideDel}
                        onChange={(e) => setOverrideDel(e.target.value)}
                        className="bg-slate-950 border border-slate-850 rounded p-1 text-center text-xs text-slate-100 font-mono outline-none focus:border-amber-500/60"
                      />
                      <input
                        type="number"
                        placeholder="Rec"
                        value={overrideRec}
                        onChange={(e) => setOverrideRec(e.target.value)}
                        className="bg-slate-950 border border-slate-850 rounded p-1 text-center text-xs text-slate-100 font-mono outline-none focus:border-amber-500/60"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTriggerManualScrape(selectedFacility.id)}
                    disabled={scanning}
                    className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80 rounded font-medium text-xs transition duration-150 cursor-pointer text-center"
                  >
                    Porttan Tekil Sorgula
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOverride}
                    className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-xs transition duration-150 cursor-pointer text-center"
                  >
                    {submittingOverride ? "Override Ediliyor..." : "Değerleri Kaydet"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

      </main>
        </>
      )}

      {/* FOOTER METRICS AND CREDITS */}
      <footer className="border-t border-slate-900 bg-slate-950 p-4 md:px-6 text-center text-[11px] text-slate-600 flex flex-col md:flex-row justify-between items-center gap-3">
        <p>© 2026 Enerji Telemetri Merkezi. Tüm hakları saklıdır.</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            NodeJS 22.14.0 Engine
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-500 font-mono">SQLite kva_data.db Blueprint Mirror</span>
        </div>
      </footer>
    </div>
  );
}
