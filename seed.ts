import Database from "better-sqlite3";
import { MOCK_PHLEBOTOMISTS } from "./constants.js";

const db = new Database("disha.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    email TEXT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    status TEXT,
    labId TEXT,
    isAvailable INTEGER DEFAULT 1,
    grade TEXT,
    monthlyEarnings REAL DEFAULT 0,
    completedCalls INTEGER DEFAULT 0,
    rejectedCalls INTEGER DEFAULT 0,
    shiftStart TEXT,
    shiftEnd TEXT,
    lastActive INTEGER
  );

  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    patientName TEXT,
    patientPhone TEXT,
    verificationCode TEXT,
    otpGeneratedAt INTEGER,
    otpExpiresAt INTEGER,
    otpRetryCount INTEGER DEFAULT 0,
    isOtpLocked INTEGER DEFAULT 0,
    type TEXT,
    destLat REAL,
    destLng REAL,
    destAddress TEXT,
    placedAt INTEGER,
    acceptedAt INTEGER,
    visitedAt INTEGER,
    collectedAt INTEGER,
    handoverAt INTEGER,
    status TEXT,
    assignedPhleboId TEXT,
    labId TEXT,
    estimatedTatMinutes INTEGER,
    isPriority INTEGER DEFAULT 0,
    billingJson TEXT,
    visitPhoto TEXT,
    samplePhoto TEXT,
    handoverPhoto TEXT,
    voiceNote TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER,
    userId TEXT,
    action TEXT,
    details TEXT,
    ip TEXT
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed Users
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (
    id, name, phone, email, username, password, role, status, labId, isAvailable, grade, monthlyEarnings, completedCalls, rejectedCalls, shiftStart, shiftEnd
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const p of MOCK_PHLEBOTOMISTS) {
  insertUser.run(
    p.id, p.name, p.phone, p.email, p.username, p.password, p.role, p.status, p.labId, 
    p.isAvailable ? 1 : 0, p.grade, p.monthlyEarnings, p.completedCalls, p.rejectedCalls, 
    p.shiftStart, p.shiftEnd
  );
}

console.log("Database seeded successfully.");
db.close();
