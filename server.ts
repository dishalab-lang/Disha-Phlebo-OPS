import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { GoogleGenAI } from '@google/genai';



let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY environment variable is not set.');
      return null;
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
  try {
  const db = new sqlite3.Database("disha.db");

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
    `);
  });
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Middleware for logging actions
  const logger = (req: any, res: any, next: any) => {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const action = `${req.method} ${req.path}`;
    db.run("INSERT INTO logs (timestamp, userId, action, details, ip) VALUES (?, ?, ?, ?, ?)", 
      [Date.now(), userId, action, JSON.stringify(req.body), req.ip], 
      (err) => {
        if (err) {
          console.error('Failed to log action:', err);
        }
        next();
      });
  };

  app.use("/api", logger);

  // Auth API
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
      if (err) {
        res.status(500).json({ success: false, message: "Database error" });
      } else if (user) {
        res.json({ success: true, user });
      } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    });
  });

  // Calls API
  app.get("/api/calls", (req, res) => {
    db.all("SELECT * FROM calls ORDER BY placedAt DESC", [], (err, calls) => {
      if (err) {
        res.status(500).json({ success: false, message: "Database error" });
      } else {
        res.json(calls.map((c: any) => ({
          ...c,
          destination: { lat: c.destLat, lng: c.destLng, address: c.destAddress },
          billing: JSON.parse(c.billingJson),
          isPriority: !!c.isPriority,
          isOtpLocked: !!c.isOtpLocked
        })));
      }
    });
  });

  app.post("/api/calls", (req, res) => {
    const call = req.body;
    const stmt = db.prepare(`
      INSERT INTO calls (
        id, patientName, patientPhone, verificationCode, otpGeneratedAt, otpExpiresAt, 
        type, destLat, destLng, destAddress, placedAt, status, labId, estimatedTatMinutes, 
        isPriority, billingJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      call.id, call.patientName, call.patientPhone, call.verificationCode, call.otpGeneratedAt, 
      call.otpExpiresAt, call.type, call.destination.lat, call.destination.lng, 
      call.destination.address, call.placedAt, call.status, call.labId, 
      call.estimatedTatMinutes, call.isPriority ? 1 : 0, JSON.stringify(call.billing)
    , (err) => {
      if (err) {
        res.status(500).json({ success: false, message: "Database error" });
      } else {
        res.json({ success: true });
      }
    });
  });

  app.patch("/api/calls/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(", ");
    const values = Object.values(updates);
    db.run(`UPDATE calls SET ${fields} WHERE id = ?`, [...values, id], (err) => {
      if (err) {
        res.status(500).json({ success: false, message: "Database error" });
      } else {
        res.json({ success: true });
      }
    });
  });

  // Users API
  app.get("/api/users", (req, res) => {
    db.all("SELECT * FROM users", [], (err, users) => {
      if (err) {
        res.status(500).json({ success: false, message: "Database error" });
      } else {
        res.json(users);
      }
    });
  });

  app.patch("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    if (updates.currentLocation) {
        updates.lastActive = Date.now();
        const loc = updates.currentLocation;
        delete updates.currentLocation;
        // In a real app we'd store lat/lng separately, but for this demo we'll just update lastActive
    }
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(", ");
    const values = Object.values(updates);
    db.run(`UPDATE users SET ${fields} WHERE id = ?`, [...values, id], (err) => {
      if (err) {
        res.status(500).json({ success: false, message: "Database error" });
      } else {
        res.json({ success: true });
      }
    });
  });

  app.post("/api/analyze-performance", async (req, res) => {
    const { phlebotomist, history } = req.body;
    const aiClient = getAI();

    if (!aiClient) {
      return res.status(500).json({
        grade: 'C',
        feedback: 'AI service is not configured. Missing API key.'
      });
    }

    const prompt = `
      Analyze the performance of the phlebotomist named ${phlebotomist.name}.

      Here is their recent collection history:
      ${JSON.stringify(history, null, 2)}

      Based on this data, provide a performance grade (A, B, C, or D) and concise feedback.
      Consider factors like total collections, on-time performance (totalTat vs targetTat), and any priority calls.

      Return the result as a JSON object with the keys \"grade\" and \"feedback\".
    `;

    try {
      const response = await aiClient.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      const text = response.text;
      if (!text) {
          throw new Error('No text in response');
      }
      const report = JSON.parse(text);
      res.json(report);
    } catch (error) {
      console.error("Error analyzing performance:", error);
      res.status(500).json({
        grade: 'C',
        feedback: 'Could not automatically analyze performance. Please review manually.'
      });
    }
  });

  app.get("/api/users/:id/report-data", (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Database error" });
      }
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      db.all("SELECT * FROM calls WHERE assignedPhleboId = ? ORDER BY collectedAt DESC", [id], (err, calls) => {
        if (err) {
          return res.status(500).json({ success: false, message: "Database error" });
        }
        res.json({ success: true, user, calls });
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(join(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
