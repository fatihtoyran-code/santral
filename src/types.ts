/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Facility {
  id: string; // e.g. "K499"
  name: string; // Friendly name
  url: string; // Scout URL
  status: "online" | "offline" | "idle" | "error";
  lastKva: number | null;
  lastDel: number | null;
  lastRec: number | null;
  lastNet: number | null;
  lastUpdatedKva: string | null;
  lastUpdatedDemand: string | null;
  errorMassage?: string | null;
}

export interface KvaRecord {
  id?: number;
  timestamp: string; // ISO string or YYYY-MM-DD HH:mm:ss
  tesis: string;
  kva_total: number;
}

export interface DemandRecord {
  id?: number;
  timestamp: string;
  tesis: string;
  del_kwh: number | null;
  rec_kwh: number | null;
  net_kwh: number | null;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  tesis?: string;
}

export interface DashboardStats {
  totalKva: number;
  totalNetDaily: number;
  activeFacilities: number;
  totalFacilities: number;
}
