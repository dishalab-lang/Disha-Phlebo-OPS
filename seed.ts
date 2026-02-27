import sqlite3 from 'sqlite3';

const db = new sqlite3.Database("disha.db", (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the disha.db database.');
});

// Initialize Database Schema
db.serialize(() => {
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
  `, (err) => {
    if (err) {
      console.error(err.message);
    }
  });

  // Seed Users
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      id, name, phone, email, username, password, role, status, labId, isAvailable, grade, monthlyEarnings, completedCalls, rejectedCalls, shiftStart, shiftEnd
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const MOCK_PHLEBOTOMISTS = [
      {
          id: 'DEV01',
          name: 'System Developer',
          phone: '0000000000',
          email: 'dev@disha.com',
          username: 'dev',
          password: 'dev',
          role: 'DEVELOPER',
          status: 'APPROVED',
          labId: 'LAB01',
          isAvailable: true,
          grade: 'A',
          monthlyEarnings: 0,
          completedCalls: 0,
          rejectedCalls: 0,
          shiftStart: '00:00',
          shiftEnd: '23:59',
      },
      {
          id: 'ADM01',
          name: 'System Admin',
          phone: '0000000001',
          email: 'admin@disha.com',
          username: 'admin',
          password: '123',
          role: 'SYSTEM_ADMIN',
          status: 'APPROVED',
          labId: 'LAB01',
          isAvailable: true,
          grade: 'A',
          monthlyEarnings: 0,
          completedCalls: 0,
          rejectedCalls: 0,
          shiftStart: '00:00',
          shiftEnd: '23:59',
      },
      {
          id: 'DIS01',
          name: 'Dispatcher',
          phone: '0000000002',
          email: 'dispatch@disha.com',
          username: 'dispatch',
          password: '123',
          role: 'DISPATCHER',
          status: 'APPROVED',
          labId: 'LAB01',
          isAvailable: true,
          grade: 'A',
          monthlyEarnings: 0,
          completedCalls: 0,
          rejectedCalls: 0,
          shiftStart: '09:00',
          shiftEnd: '18:00',
      },
  ];

  for (const p of MOCK_PHLEBOTOMISTS) {
    insertUser.run(
      p.id, p.name, p.phone, p.email, p.username, p.password, p.role, p.status, p.labId, 
      p.isAvailable ? 1 : 0, p.grade, p.monthlyEarnings, p.completedCalls, p.rejectedCalls, 
      p.shiftStart, p.shiftEnd
    );
  }

  insertUser.finalize();
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Close the database connection.');
});
