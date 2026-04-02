import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'disha.db');
const sqliteDb = new Database(dbPath);

// Initialize tables
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS metrics (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS labs (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS hospitals (id TEXT PRIMARY KEY, data TEXT);
  CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, data TEXT);
`);

export const dbHelper = {
  getUsers: () => {
    const rows = sqliteDb.prepare('SELECT * FROM users').all() as any[];
    return new Map(rows.map(r => [r.id, JSON.parse(r.data)]));
  },
  setUser: (id: string, data: any) => {
    sqliteDb.prepare('INSERT OR REPLACE INTO users (id, data) VALUES (?, ?)').run(id, JSON.stringify(data));
  },
  getCalls: () => {
    const rows = sqliteDb.prepare('SELECT * FROM calls').all() as any[];
    return new Map(rows.map(r => [r.id, JSON.parse(r.data)]));
  },
  setCall: (id: string, data: any) => {
    sqliteDb.prepare('INSERT OR REPLACE INTO calls (id, data) VALUES (?, ?)').run(id, JSON.stringify(data));
  },
  getMetrics: () => {
    const rows = sqliteDb.prepare('SELECT * FROM metrics').all() as any[];
    return new Map(rows.map(r => [r.id, JSON.parse(r.data)]));
  },
  setMetric: (id: string, data: any) => {
    sqliteDb.prepare('INSERT OR REPLACE INTO metrics (id, data) VALUES (?, ?)').run(id, JSON.stringify(data));
  },
  getConfig: () => {
    const row = sqliteDb.prepare('SELECT data FROM config WHERE key = ?').get('system_config') as any;
    return row ? row.data : null;
  },
  setConfig: (data: string) => {
    sqliteDb.prepare('INSERT OR REPLACE INTO config (key, data) VALUES (?, ?)').run('system_config', data);
  },
  getLabs: () => {
    const rows = sqliteDb.prepare('SELECT * FROM labs').all() as any[];
    return new Map(rows.map(r => [r.id, JSON.parse(r.data)]));
  },
  setLab: (id: string, data: any) => {
    sqliteDb.prepare('INSERT OR REPLACE INTO labs (id, data) VALUES (?, ?)').run(id, JSON.stringify(data));
  },
  clearLabs: () => {
    sqliteDb.prepare('DELETE FROM labs').run();
  },
  getHospitals: () => {
    const rows = sqliteDb.prepare('SELECT * FROM hospitals').all() as any[];
    return new Map(rows.map(r => [r.id, JSON.parse(r.data)]));
  },
  setHospital: (id: string, data: any) => {
    sqliteDb.prepare('INSERT OR REPLACE INTO hospitals (id, data) VALUES (?, ?)').run(id, JSON.stringify(data));
  },
  clearHospitals: () => {
    sqliteDb.prepare('DELETE FROM hospitals').run();
  },
  getLogs: () => {
    const rows = sqliteDb.prepare('SELECT * FROM logs').all() as any[];
    return rows.map(r => JSON.parse(r.data));
  },
  addLog: (id: string, data: any) => {
    sqliteDb.prepare('INSERT OR REPLACE INTO logs (id, data) VALUES (?, ?)').run(id, JSON.stringify(data));
  }
};
