import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { GoogleGenAI } from '@google/genai';
import { createServer } from "http";
import { Server } from "socket.io";



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

      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        callId TEXT,
        phleboId TEXT,
        phleboName TEXT,
        patientName TEXT,
        totalTat INTEGER,
        targetTat INTEGER,
        distance REAL,
        incentive REAL,
        revenue REAL,
        paymentMode TEXT,
        timestamp INTEGER,
        isPremiumIncentive INTEGER,
        voiceNote TEXT,
        status TEXT
      );
    `);
  });
  const app = express();
  const PORT = 3000;
  const server = createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Middleware for logging actions
  const logger = (req: any, res: any, next: any) => {
    if (!req.path.startsWith('/api')) return next();
    const userId = req.headers['x-user-id'] || 'anonymous';
    const action = `${req.method} ${req.path}`;
    
    // Use a try-catch for JSON.stringify and ensure next() is called even on DB error
    let details = "";
    try {
      details = JSON.stringify(req.body);
    } catch (e) {
      details = "[Unserializable Body]";
    }

    db.run("INSERT INTO logs (timestamp, userId, action, details, ip) VALUES (?, ?, ?, ?, ?)", 
      [Date.now(), userId, action, details, req.ip], 
      (err) => {
        if (err) {
          console.error('Failed to log action:', err);
        }
      });
    next();
  };

  app.use(logger);

  // API 404 handler - must be after all API routes but before Vite
  const api404 = (req: any, res: any, next: any) => {
    if (req.path.startsWith('/api')) {
      console.log(`API 404: ${req.method} ${req.path}`);
      return res.status(404).json({ success: false, message: `API route not found: ${req.method} ${req.path}` });
    }
    next();
  };

  app.get("/api/test", (req, res) => {
    res.json({ success: true, message: "API is reachable" });
  });

  app.get("/api/config", (req, res) => {
    db.get("SELECT value FROM config WHERE key = 'system_config'", [], (err, row: any) => {
      if (err) {
        res.status(500).json({ success: false, message: "Database error" });
      } else if (row) {
        res.json(JSON.parse(row.value));
      } else {
        res.json(null);
      }
    });
  });

  app.post("/api/config", (req, res) => {
    const config = req.body;
    db.run("INSERT OR REPLACE INTO config (key, value) VALUES ('system_config', ?)", [JSON.stringify(config)], (err) => {
      if (err) {
        res.status(500).json({ success: false, message: "Database error" });
      } else {
        res.json({ success: true });
      }
    });
  });

  app.get("/api/metrics", (req, res) => {
    db.all("SELECT * FROM metrics ORDER BY timestamp DESC", [], (err, rows) => {
      if (err) {
        res.status(500).json({ success: false, message: "Database error" });
      } else {
        res.json((rows as any[]).map(row => ({
          ...row,
          isPremiumIncentive: !!row.isPremiumIncentive
        })));
      }
    });
  });

  app.post("/api/metrics", (req, res) => {
    const m = req.body;
    const stmt = db.prepare(`
      INSERT INTO metrics (
        callId, phleboId, phleboName, patientName, totalTat, targetTat, 
        distance, incentive, revenue, paymentMode, timestamp, 
        isPremiumIncentive, voiceNote, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      m.callId, m.phleboId, m.phleboName, m.patientName, m.totalTat, m.targetTat,
      m.distance, m.incentive, m.revenue, m.paymentMode, m.timestamp,
      m.isPremiumIncentive ? 1 : 0, m.voiceNote, m.status,
      (err) => {
        if (err) {
          res.status(500).json({ success: false, message: "Database error" });
        } else {
          io.emit('metrics_updated', m);
          res.json({ success: true });
        }
      }
    );
  });

  // Auth API
  app.post("/api/login", (req, res) => {
    console.log("Login endpoint hit with body:", req.body);
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
      if (err) {
        console.error("Login DB Error:", err);
        res.status(500).json({ success: false, message: "Database error 123", error: String(err) });
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
        console.error("Calls DB Error:", err);
        res.status(500).json({ success: false, message: "Database error", error: String(err) });
      } else {
        try {
          res.json(calls.map((c: any) => {
            let parsedBilling = null;
            try {
              parsedBilling = c.billingJson ? JSON.parse(c.billingJson) : null;
            } catch (e) {
              console.error("Error parsing billingJson for call", c.id, e);
            }
            return {
              ...c,
              destination: { lat: c.destLat, lng: c.destLng, address: c.destAddress },
              billing: parsedBilling,
              isPriority: !!c.isPriority,
              isOtpLocked: !!c.isOtpLocked
            };
          }));
        } catch (e) {
          console.error("Error mapping calls:", e);
          res.status(500).json({ success: false, message: "Error mapping calls", error: String(e) });
        }
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
        io.emit('call_created', call);
        res.json({ success: true });
      }
    });
  });

  app.post("/api/calls/verify", (req, res, next) => {
    try {
      console.log("Verify OTP endpoint hit with body:", req.body);
      const { callId, otp } = req.body;
      if (!callId || !otp) {
        console.log("Verify OTP: Missing callId or otp");
        return res.status(400).json({ success: false, message: "Missing callId or otp" });
      }
      db.get("SELECT * FROM calls WHERE id = ?", [callId], (err, call: any) => {
        if (err) {
          console.error("Verify OTP DB Error:", err);
          return res.status(500).json({ success: false, message: "Database error" });
        }
        if (!call) {
          console.log("Verify OTP: Call not found", callId);
          return res.status(404).json({ success: false, message: "Call not found" });
        }
        console.log("Verify OTP: Found call", call.id, "Status:", call.status);
        if (call.isOtpLocked) {
          console.log("Verify OTP: Call is locked");
          return res.status(403).json({ success: false, message: "OTP locked due to too many failed attempts" });
        }
        if (Date.now() > call.otpExpiresAt) {
          console.log("Verify OTP: OTP expired");
          return res.status(400).json({ success: false, message: "OTP expired" });
        }
        if (call.verificationCode !== otp) {
          console.log("Verify OTP: Invalid OTP. Expected:", call.verificationCode, "Got:", otp);
          const newRetryCount = (call.otpRetryCount || 0) + 1;
          const isLocked = newRetryCount >= 3;
          db.run("UPDATE calls SET otpRetryCount = ?, isOtpLocked = ? WHERE id = ?", [newRetryCount, isLocked ? 1 : 0, callId]);
          return res.status(400).json({ success: false, message: "Invalid OTP" });
        }
        
        console.log("Verify OTP: Success. Updating status to IN_PROGRESS");
        db.run("UPDATE calls SET status = 'IN_PROGRESS' WHERE id = ?", [callId], (err) => {
          if (err) {
            console.error("Verify OTP Update Status Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
          }
          io.emit('call_updated', { id: callId, status: 'IN_PROGRESS' });
          res.json({ success: true });
        });
      });
    } catch (e) {
      next(e);
    }
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
        io.emit('call_updated', { id, ...updates });
        
        // Automated Events
        if (updates.status === 'ACCEPTED') {
          io.emit('notification', { message: `SMS Sent: Phlebotomist assigned to call ${id}`, type: 'success' });
        } else if (updates.status === 'VISITING') {
          db.get("SELECT verificationCode FROM calls WHERE id = ?", [id], (err, row: any) => {
            if (!err && row) {
              io.emit('notification', { message: `Phlebotomist arrived for call ${id}. Patient PIN: ${row.verificationCode}`, type: 'success' });
            }
          });
        } else if (updates.status === 'COMPLETED') {
          io.emit('notification', { message: `Email Sent: Invoice and report ready for call ${id}`, type: 'success' });
        }

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

  app.post("/api/users", (req, res) => {
    const user = req.body;
    const stmt = db.prepare(`
      INSERT INTO users (
        id, name, phone, email, username, password, role, status, labId, isAvailable, grade, monthlyEarnings, completedCalls, rejectedCalls, shiftStart, shiftEnd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.id, user.name, user.phone, user.email, user.username, user.password, user.role, user.status, user.labId, 
      user.isAvailable ? 1 : 0, user.grade, user.monthlyEarnings, user.completedCalls, user.rejectedCalls, 
      user.shiftStart, user.shiftEnd,
      (err) => {
        if (err) {
          res.status(500).json({ success: false, message: "Database error" });
        } else {
          res.json({ success: true, user });
        }
      }
    );
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
        io.emit('user_updated', { id, ...updates });
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

      db.all("SELECT c.*, m.distance, m.totalTat as tripTime FROM calls c LEFT JOIN metrics m ON c.id = m.callId WHERE c.assignedPhleboId = ? ORDER BY c.collectedAt DESC", [id], (err, calls) => {
        if (err) {
          return res.status(500).json({ success: false, message: "Database error" });
        }
        res.json({ success: true, user, calls });
      });
    });
  });

  app.use(api404);

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled Error:", err);
    if (req.path.startsWith('/api')) {
      return res.status(500).json({ success: false, message: "Internal Server Error", error: String(err) });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(join(__dirname, "dist")));
    app.use((req, res) => {
      res.sendFile(join(__dirname, "dist/index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
