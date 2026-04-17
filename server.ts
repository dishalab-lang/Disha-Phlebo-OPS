import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { GoogleGenAI } from '@google/genai';
import { createServer } from "http";
import { Server } from "socket.io";
import { INITIAL_CONFIG, MOCK_TESTS, MOCK_LABS, MOCK_HOSPITALS } from './mockData.ts';
import { dbHelper } from './dbHelper.ts';
import { sendEmail } from './emailService.ts';
import { sendSMS } from './smsService.ts';

// --- In-Memory Data Store (Backed by SQLite) ---
const db = {
  users: dbHelper.getUsers(),
  calls: dbHelper.getCalls(),
  metrics: dbHelper.getMetrics(),
  config: { system_config: dbHelper.getConfig() || JSON.stringify(INITIAL_CONFIG) },
  labs: dbHelper.getLabs(),
  hospitals: dbHelper.getHospitals(),
  logs: dbHelper.getLogs()
};

// Initialize with mock data if empty
if (db.labs.size === 0) {
  MOCK_LABS.forEach(l => {
    db.labs.set(l.id, l);
    dbHelper.setLab(l.id, l);
  });
}

if (db.hospitals.size === 0) {
  MOCK_HOSPITALS.forEach(h => {
    const data = {
      id: h.id,
      name: h.name,
      address: h.address || null,
      lat: h.lat || 0,
      lng: h.lng || 0
    };
    db.hospitals.set(h.id, data);
    dbHelper.setHospital(h.id, data);
  });
}

if (db.users.size === 0) {
  // Default Admin User
  const defaultAdmin = {
    id: 'ADMIN-1',
    name: 'System Admin',
    username: 'admin',
    password: '123',
    role: 'ADMIN',
    status: 'ACTIVE',
    isAvailable: true,
    completedCalls: 0,
    rejectedCalls: 0,
    monthlyEarnings: 0
  };
  db.users.set(defaultAdmin.id, defaultAdmin);
  dbHelper.setUser(defaultAdmin.id, defaultAdmin);

  // Default Phlebotomist
  const defaultPhlebo = {
    id: 'P-1',
    name: 'John Phlebo',
    username: 'phlebo',
    password: '123',
    role: 'PHLEBOTOMIST',
    status: 'ACTIVE',
    isAvailable: true,
    completedCalls: 0,
    rejectedCalls: 0,
    monthlyEarnings: 0,
    labId: 'LAB01'
  };
  db.users.set(defaultPhlebo.id, defaultPhlebo);
  dbHelper.setUser(defaultPhlebo.id, defaultPhlebo);
}

// Ensure config is saved
if (!dbHelper.getConfig()) {
  dbHelper.setConfig(db.config.system_config);
}
// --- End In-Memory Data Store ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let aiClient: any = null;
function getAI() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({ apiKey: key });
    }
  }
  return aiClient;
}

async function startServer() {
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

  // --- LIS Integration API Layer ---
  
  // Middleware to secure LIS Webhooks
  const requireLisApiKey = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const expectedKey = process.env.LIS_API_KEY || 'default-insecure-lis-key';
    if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
      return res.status(401).json({ success: false, message: "Unauthorized LIS access" });
    }
    next();
  };

  // Outbound Sync Function
  const syncToCentralLIS = async (callId: string, status: string, additionalData: any = {}) => {
    const lisEndpoint = process.env.LIS_WEBHOOK_URL;
    if (!lisEndpoint) {
      console.log(`[LIS Sync Stub] Would sync call ${callId} status ${status} to LIS. Set LIS_WEBHOOK_URL to enable real sync.`);
      return;
    }
    try {
      console.log(`[LIS Sync] Syncing call ${callId} to ${lisEndpoint}`);
    } catch (err) {
      console.error(`[LIS Sync Error] Failed to sync call ${callId}:`, err);
    }
  };

  // Inbound Webhook: Central LIS pushes new tasks to the app
  app.post("/api/webhooks/lis/tasks", requireLisApiKey, (req, res) => {
    const { externalId, patientName, patientPhone, testCodes, address, lat, lng, scheduledAt, labId, isPriority } = req.body;

    if (!externalId || !patientName || !patientPhone) {
      return res.status(400).json({ success: false, message: "Missing required fields (externalId, patientName, patientPhone)" });
    }

    const callId = `CALL-${externalId}`;
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const handoverCode = Math.floor(1000 + Math.random() * 9000).toString();
    const otpGeneratedAt = Date.now();
    const otpExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const placedAt = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();
    const status = 'PENDING';
    const type = 'HOME_COLLECTION';
    const estimatedTatMinutes = 60;
    const billing = { tests: testCodes || [], totalAmount: 0, isPaid: false };

    const callData = {
      id: callId,
      patientName,
      patientPhone,
      verificationCode,
      handoverCode,
      otpGeneratedAt,
      otpExpiresAt,
      type,
      destLat: lat || 0,
      destLng: lng || 0,
      destAddress: address || 'Unknown Address',
      placedAt,
      status,
      labId: labId || 'LAB-1',
      estimatedTatMinutes,
      isPriority: isPriority ? true : false,
      billingJson: JSON.stringify(billing)
    };

    db.calls.set(callId, callData);
    dbHelper.setCall(callId, callData);
    const call = {
      ...callData,
      billing,
      destination: { lat: callData.destLat, lng: callData.destLng, address: callData.destAddress }
    };
    io.emit('call_created', call);
    io.emit('notification', { message: `New task received from Central LIS: ${callId}`, type: 'info' });
    res.json({ success: true, message: "Task synced successfully", callId });
  });

  // --- End LIS Integration API Layer ---

  // Middleware for logging actions
  const logger = (req: any, res: any, next: any) => {
    if (!req.path.startsWith('/api')) return next();
    const userId = req.headers['x-user-id'] || 'anonymous';
    const action = `${req.method} ${req.path}`;
    
    let details = "";
    try {
      details = JSON.stringify(req.body) || "";
    } catch (e) {
      details = "[Unserializable Body]";
    }

    const logEntry = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
      userId,
      action,
      details,
      ip: req.ip
    };
    db.logs.push(logEntry);
    dbHelper.addLog(logEntry.id, logEntry);
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

  app.post("/api/log-error", (req, res) => {
    console.error("CLIENT ERROR:", req.body);
    res.json({ success: true });
  });

  app.get("/api/test", (req, res) => {
    res.json({ success: true, message: "API is reachable" });
  });

  app.post("/api/test-notifications", async (req, res) => {
    const { email, phone } = req.body;
    const results: any = { email: null, sms: null };

    if (email) {
      try {
        results.email = await sendEmail(
          email,
          "Test Notification - Disha Diagnostics",
          "This is a test email from Disha Diagnostics Phlebotomy Suite.",
          "<h3>Test Notification</h3><p>This is a test email from <b>Disha Diagnostics Phlebotomy Suite</b>.</p>"
        );
      } catch (error) {
        results.email = { error: error instanceof Error ? error.message : String(error) };
      }
    }

    if (phone) {
      try {
        results.sms = await sendSMS(
          phone,
          "Test SMS from Disha Diagnostics. If you receive this, your SMS integration is working correctly."
        );
      } catch (error) {
        results.sms = { error: error instanceof Error ? error.message : String(error) };
      }
    }

    res.json({ success: true, results });
  });

  app.get("/api/config", async (req, res) => {
    const data = db.config.system_config;
    res.json(data ? JSON.parse(data) : null);
  });

  app.post("/api/config", async (req, res) => {
    const config = req.body;
    db.config.system_config = JSON.stringify(config);
    dbHelper.setConfig(db.config.system_config);
    res.json({ success: true });
  });

  app.get("/api/labs", async (req, res) => {
    res.json(Array.from(db.labs.values()));
  });

  app.post("/api/labs", async (req, res) => {
    const labs = req.body;
    db.labs.clear();
    dbHelper.clearLabs();
    labs.forEach((l: any) => {
      if (!l.location) {
        l.location = { lat: l.lat || 0, lng: l.lng || 0 };
        delete l.lat; delete l.lng;
      }
      db.labs.set(l.id, l);
      dbHelper.setLab(l.id, l);
    });
    res.json({ success: true });
  });

  app.get("/api/hospitals", async (req, res) => {
    res.json(Array.from(db.hospitals.values()));
  });

  app.post("/api/hospitals", async (req, res) => {
    const hospitals = req.body;
    db.hospitals.clear();
    dbHelper.clearHospitals();
    hospitals.forEach((h: any) => {
      db.hospitals.set(h.id, h);
      dbHelper.setHospital(h.id, h);
    });
    res.json({ success: true });
  });

  app.get("/api/metrics", async (req, res) => {
    const metrics = Array.from(db.metrics.values())
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .map((row: any) => ({
        ...row,
        isPremiumIncentive: !!row.isPremiumIncentive
      }));
    res.json(metrics);
  });

  app.post("/api/metrics", async (req, res) => {
    const m = req.body;
    const id = `METRIC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const metricData = {
      id,
      callId: m.callId,
      phleboId: m.phleboId,
      phleboName: m.phleboName,
      patientName: m.patientName,
      totalTat: m.totalTat,
      targetTat: m.targetTat,
      distance: m.distance,
      incentive: m.incentive,
      revenue: m.revenue,
      paymentMode: m.paymentMode,
      timestamp: m.timestamp,
      isPremiumIncentive: m.isPremiumIncentive ? true : false,
      voiceNote: m.voiceNote,
      status: m.status
    };
    db.metrics.set(id, metricData);
    dbHelper.setMetric(id, metricData);
    io.emit('metrics_updated', m);
    res.json({ success: true });
  });

  // In-memory OTP store (expires in 5 mins)
  const loginOtps = new Map<string, { otp: string, expires: number }>();

  // Auth API
  app.post("/api/public/login-otp/request", async (req, res) => {
    const { username } = req.body;
    const user = Array.from(db.users.values()).find((u: any) => 
      u.username === username || u.email === username || u.phone === username
    ) as any;

    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }
    
    if (!user.phone && !user.email) {
      return res.json({ success: false, message: 'No phone number or email associated with this account for verification.' });
    }

    if (user.status === 'LOCKED') {
      return res.status(403).json({ success: false, message: "Access Restricted: Node Locked" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    loginOtps.set(user.id, { otp, expires: Date.now() + 5 * 60 * 1000 });

    try {
      let methods = [];
      if (user.phone) {
        await sendSMS(user.phone, `Your Disha Phlebo Login OTP is: ${otp}. Valid for 5 minutes.`).catch(e => console.error("SMS error:", e));
        methods.push('SMS');
      }
      if (user.email) {
        await sendEmail(user.email, "Login OTP - Disha Phlebo", `Your Login OTP is: ${otp}\nValid for 5 minutes.`).catch(e => console.error("Email error:", e));
        methods.push('Email');
      }
      
      if (methods.length === 0) throw new Error('All sending methods failed.');

      res.json({ success: true, message: `OTP sent successfully via ${methods.join(' and ')}.` });
    } catch (error) {
      console.error('Failed to send OTP:', error);
      res.json({ success: false, message: 'Failed to send OTP.' });
    }
  });

  app.post("/api/public/login-otp/verify", async (req, res) => {
    const { username, otp } = req.body;
    const user = Array.from(db.users.values()).find((u: any) => 
      u.username === username || u.email === username || u.phone === username
    ) as any;

    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    const storedOtp = loginOtps.get(user.id);
    if (!storedOtp) {
      return res.json({ success: false, message: 'OTP not requested or expired' });
    }

    if (Date.now() > storedOtp.expires) {
      loginOtps.delete(user.id);
      return res.json({ success: false, message: 'OTP expired' });
    }

    if (storedOtp.otp !== otp) {
      return res.json({ success: false, message: 'Invalid OTP' });
    }

    // Success
    loginOtps.delete(user.id);
    res.json({ success: true, user });
  });

  app.post("/api/public/forgot-password", async (req, res) => {
    const { username } = req.body;
    const user = Array.from(db.users.values()).find((u: any) => 
      u.username === username || u.email === username
    ) as any;

    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    // Generate temp password
    const tempPassword = Math.random().toString(36).slice(-6).toUpperCase();
    user.password = tempPassword;
    db.users.set(user.id, user);
    dbHelper.setUser(user.id, user);

    let msg = [];
    if (user.email) {
      await sendEmail(user.email, "Password Reset", `Your new temporary password is: ${tempPassword}\nPlease login and change it immediately.`).catch(console.error);
      msg.push('email');
    }
    if (user.phone) {
      await sendSMS(user.phone, `Your Disha Phlebo password reset code is: ${tempPassword}`).catch(console.error);
      msg.push('SMS');
    }

    if (msg.length === 0) {
      return res.json({ success: false, message: 'Could not send recovery message - no contact details found' });
    }

    res.json({ success: true, message: `Password reset sent via ${msg.join(' and ')}` });
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = Array.from(db.users.values()).find((u: any) => 
      (u.username === username || u.email === username) && u.password === password
    );

    if (user) {
      if (user.status === 'LOCKED') {
        return res.status(403).json({ success: false, message: "Access Restricted: Node Locked" });
      }
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  // Calls API
  // Public Tracking Endpoint
  app.get("/api/public/track/:id", (req, res) => {
    const id = req.params.id;
    const callData = db.calls.get(id);
    if (!callData) return res.status(404).json({ success: false, message: "Call not found" });
    
    const phlebo = callData.assignedPhleboId ? db.users.get(callData.assignedPhleboId) : null;
    
    res.json({
      success: true,
      call: {
        id: callData.id,
        status: callData.status,
        patientName: callData.patientName,
        destination: { lat: callData.destLat, lng: callData.destLng, address: callData.destAddress }
      },
      phlebo: phlebo ? {
        name: phlebo.name,
        currentLocation: phlebo.currentLocation,
        lastActive: phlebo.lastActive
      } : null
    });
  });

  app.get("/api/calls", async (req, res) => {
    const calls = Array.from(db.calls.values())
      .sort((a: any, b: any) => b.placedAt - a.placedAt);
    res.json(calls);
  });

  app.post("/api/calls", async (req, res) => {
    const call = req.body;
    
    // Ensure vital PINs exist natively even if the client misses them
    if (!call.verificationCode) call.verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    if (!call.handoverCode) call.handoverCode = Math.floor(1000 + Math.random() * 9000).toString();

    db.calls.set(call.id, call);
    dbHelper.setCall(call.id, call);
    io.emit('call_created', call);

    // Send notification email to patient
    if (call.patientEmail) {
      sendEmail(
        call.patientEmail,
        `Booking Confirmed - Disha Phlebo`,
        `Dear ${call.patientName}, your booking (ID: ${call.id}) has been confirmed. A phlebotomist will be assigned shortly.`,
        `<h3>Booking Confirmed</h3>
         <p>Dear ${call.patientName},</p>
         <p>Your booking (ID: <b>${call.id}</b>) has been successfully placed.</p>
         <p>A phlebotomist will be assigned to your location shortly.</p>
         <p>Thank you for choosing Disha Phlebo.</p>`
      ).catch(err => console.error("Failed to send booking email:", err));
    }

    // Send SMS to patient
    if (call.patientPhone) {
      const trackingLink = `https://ais-dev-xsqmrnjmjw76oxcwczkpoc-21178001441.asia-east1.run.app/track/${call.id}`;
      sendSMS(
        call.patientPhone,
        `Dear ${call.patientName}, your booking (ID: ${call.id}) is confirmed. Track your phlebotomist here: ${trackingLink} - Disha Phlebo`
      ).catch(err => console.error("Failed to send booking SMS:", err));
    }

    // Send email to Hospital if applicable
    if (call.hospitalId) {
      const hospital = Array.from(db.hospitals.values()).find((h: any) => h.id === call.hospitalId);
      if (hospital && hospital.email) {
        sendEmail(
          hospital.email,
          `New Booking Notification - ${call.id}`,
          `A new booking has been placed for patient ${call.patientName} at ${hospital.name}.`,
          `<h3>New Booking Notification</h3>
           <p>A new booking has been placed for patient <b>${call.patientName}</b>.</p>
           <p>Booking ID: <b>${call.id}</b></p>
           <p>Hospital: <b>${hospital.name}</b></p>`
        ).catch(err => console.error("Failed to send hospital email:", err));
      }
    }

    // Send email to Hub (Lab)
    if (call.labId) {
      const lab = Array.from(db.labs.values()).find((l: any) => l.id === call.labId);
      if (lab && lab.email) {
        sendEmail(
          lab.email,
          `New Hub Booking - ${call.id}`,
          `A new booking has been assigned to your hub: ${call.id}.`,
          `<h3>New Hub Booking</h3>
           <p>A new booking has been assigned to your hub.</p>
           <p>Booking ID: <b>${call.id}</b></p>
           <p>Patient: <b>${call.patientName}</b></p>`
        ).catch(err => console.error("Failed to send hub email:", err));
      }
    }

    res.json({ success: true });
  });

  app.post("/api/calls/verify", async (req, res, next) => {
    const { callId, otp } = req.body;
    if (!callId || !otp) {
      return res.status(400).json({ success: false, message: "Missing callId or otp" });
    }
    
    const call = db.calls.get(callId);
    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }
    
    if (call.isOtpLocked) {
      return res.status(403).json({ success: false, message: "OTP locked due to too many failed attempts" });
    }
    if (Date.now() > call.otpExpiresAt) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }
    if (call.verificationCode !== otp) {
      const newRetryCount = (call.otpRetryCount || 0) + 1;
      const isLocked = newRetryCount >= 3;
      const updatedCall = {
        ...call,
        otpRetryCount: newRetryCount,
        isOtpLocked: isLocked ? true : false
      };
      db.calls.set(callId, updatedCall);
      dbHelper.setCall(callId, updatedCall);
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
    
    const updatedCall = { ...call, status: 'IN_PROGRESS' };
    db.calls.set(callId, updatedCall);
    dbHelper.setCall(callId, updatedCall);
    io.emit('call_updated', { id: callId, status: 'IN_PROGRESS' });
    syncToCentralLIS(callId, 'IN_PROGRESS');
    res.json({ success: true });
  });

  app.patch("/api/calls/:id", async (req, res) => {
    const { id } = req.params;
    const updates = { ...req.body };
    const call = db.calls.get(id);
    
    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    if (updates.isOtpLocked !== undefined) {
      updates.isOtpLocked = updates.isOtpLocked ? true : false;
    }
    if (updates.isPriority !== undefined) {
      updates.isPriority = updates.isPriority ? true : false;
    }

    // Merge nested billing
    if (updates.billing && call.billing) {
      updates.billing = { ...call.billing, ...updates.billing };
    }

    const updatedCall = { ...call, ...updates };
    db.calls.set(id, updatedCall);
    dbHelper.setCall(id, updatedCall);
    
    io.emit('call_updated', { id, ...updates });
    
    if (updates.status) {
      syncToCentralLIS(id, updates.status, updates);
    }

    if (updates.status === 'ACCEPTED') {
      io.emit('notification', { message: `Notification Sent: Phlebotomist assigned to call ${id}`, type: 'success' });
      
      const phlebo = db.users.get(updatedCall.assignedPhleboId);
      const phleboName = phlebo ? phlebo.name : 'A phlebotomist';
      const phleboPhone = phlebo ? phlebo.phone : 'N/A';
      const trackingLink = `https://ais-dev-xsqmrnjmjw76oxcwczkpoc-21178001441.asia-east1.run.app/track/${id}`;

      // Send SMS to patient about phlebotomist assignment with tracking link
      if (updatedCall.patientPhone) {
        sendSMS(
          updatedCall.patientPhone,
          `Dear ${updatedCall.patientName}, ${phleboName} (${phleboPhone}) is assigned to your booking ${id}. Track here: ${trackingLink} - Disha Phlebo`
        ).catch(err => console.error("Failed to send assignment SMS:", err));
      }

      // Send Email to patient
      if (updatedCall.patientEmail) {
        sendEmail(
          updatedCall.patientEmail,
          `Phlebotomist Assigned - Booking ${id}`,
          `Dear ${updatedCall.patientName}, ${phleboName} (${phleboPhone}) is assigned to your booking. Track here: ${trackingLink}`,
          `<h3>Phlebotomist Assigned</h3>
           <p>Dear ${updatedCall.patientName},</p>
           <p><b>${phleboName}</b> (Phone: ${phleboPhone}) has been assigned to your booking.</p>
           <p><a href="${trackingLink}">Click here to track your phlebotomist in real-time</a></p>`
        ).catch(err => console.error("Failed to send assignment EN:" + err));
      }
    } else if (updates.status === 'VISITING') {
      io.emit('notification', { message: `Phlebotomist arrived for call ${id}. Patient PIN: ${updatedCall.verificationCode}`, type: 'success' });
      
      const trackingLink = `https://ais-dev-xsqmrnjmjw76oxcwczkpoc-21178001441.asia-east1.run.app/track/${id}`;
      // Send SMS with verification PIN and tracking link
      if (updatedCall.patientPhone) {
        sendSMS(
          updatedCall.patientPhone,
          `Dear ${updatedCall.patientName}, the phlebotomist has arrived. PIN: ${updatedCall.verificationCode}. Track: ${trackingLink} - Disha Phlebo`
        ).catch(err => console.error("Failed to send arrival SMS:", err));
      }

      // Send Email with verification PIN
      if (updatedCall.patientEmail) {
        sendEmail(
          updatedCall.patientEmail,
          `Phlebotomist Arrived - Booking ${id}`,
          `Dear ${updatedCall.patientName}, the phlebotomist has arrived. Your verification PIN is: ${updatedCall.verificationCode}. Track: ${trackingLink}`,
          `<h3>Phlebotomist Arrived</h3>
           <p>Dear ${updatedCall.patientName},</p>
           <p>Your phlebotomist has arrived.</p>
           <p>Your Verification PIN is: <b style="font-size: 24px; letter-spacing: 2px;">${updatedCall.verificationCode}</b></p>
           <p><a href="${trackingLink}">Track visit status here</a></p>`
        ).catch(err => console.error("Failed to send arrival EN:" + err));
      }
    } else if (updates.status === 'COLLECTED') {
      io.emit('notification', { message: `Samples collected for call ${id}. Handover PIN: ${updatedCall.handoverCode}`, type: 'success' });
      
      const trackingLink = `https://ais-dev-xsqmrnjmjw76oxcwczkpoc-21178001441.asia-east1.run.app/track/${id}`;
      // Send SMS with handover PIN and tracking link
      if (updatedCall.patientPhone) {
        sendSMS(
          updatedCall.patientPhone,
          `Dear ${updatedCall.patientName}, samples collected (${updatedCall.sampleType || 'Standard'}). Handover PIN: ${updatedCall.handoverCode}. Track: ${trackingLink} - Disha Phlebo`
        ).catch(err => console.error("Failed to send collection SMS:", err));
      }

      // Send Email with handover PIN
      if (updatedCall.patientEmail) {
        sendEmail(
          updatedCall.patientEmail,
          `Samples Collected - Booking ${id}`,
          `Dear ${updatedCall.patientName}, your samples have been collected. Handover PIN: ${updatedCall.handoverCode}. Track: ${trackingLink}`,
          `<h3>Samples Collected</h3>
           <p>Dear ${updatedCall.patientName},</p>
           <p>Your samples have been successfully collected.</p>
           <p>Your Lab Handover PIN is: <b style="font-size: 24px; letter-spacing: 2px;">${updatedCall.handoverCode}</b></p>
           <p><a href="${trackingLink}">Track lab transit status here</a></p>`
        ).catch(err => console.error("Failed to send collection EN:" + err));
      }
    } else if (updates.status === 'IN_TRANSIT') {
      io.emit('notification', { message: `Samples for call ${id} are now in transit to the lab.`, type: 'info' });
      
      const trackingLink = `https://ais-dev-xsqmrnjmjw76oxcwczkpoc-21178001441.asia-east1.run.app/track/${id}`;
      if (updatedCall.patientPhone) {
        sendSMS(
          updatedCall.patientPhone,
          `Dear ${updatedCall.patientName}, your samples are in transit to the lab. Track: ${trackingLink} - Disha Phlebo`
        ).catch(err => console.error("Failed to send transit SMS:", err));
      }

      if (updatedCall.patientEmail) {
        sendEmail(
          updatedCall.patientEmail,
          `Samples in Transit - Booking ${id}`,
          `Dear ${updatedCall.patientName}, your samples are in transit to the lab. Track: ${trackingLink}`,
          `<h3>Samples in Transit</h3>
           <p>Dear ${updatedCall.patientName},</p>
           <p>Your samples are securely in transit to the diagnostic hub.</p>
           <p><a href="${trackingLink}">Track lab status here</a></p>`
        ).catch(err => console.error("Failed to send transit EN:" + err));
      }
    } else if (updates.status === 'RECEIVED_AT_LAB') {
      io.emit('notification', { message: `Samples for call ${id} received at the lab hub.`, type: 'success' });
      
      const trackingLink = `https://ais-dev-xsqmrnjmjw76oxcwczkpoc-21178001441.asia-east1.run.app/track/${id}`;
      if (updatedCall.patientPhone) {
        sendSMS(
          updatedCall.patientPhone,
          `Dear ${updatedCall.patientName}, your samples have been received at the lab hub. Track: ${trackingLink} - Disha Phlebo`
        ).catch(err => console.error("Failed to send received SMS:", err));
      }

      if (updatedCall.patientEmail) {
        sendEmail(
          updatedCall.patientEmail,
          `Samples Received at Hub - Booking ${id}`,
          `Dear ${updatedCall.patientName}, your samples have been safely received at the lab hub. Track: ${trackingLink}`,
          `<h3>Samples Received at Lab</h3>
           <p>Dear ${updatedCall.patientName},</p>
           <p>Your samples have been safely received at the diagnostic hub and are being processed.</p>
           <p><a href="${trackingLink}">Track lab processing here</a></p>`
        ).catch(err => console.error("Failed to send received EN:" + err));
      }
    } else if (updates.status === 'COMPLETED') {
      io.emit('notification', { message: `Email Sent: Invoice and report ready for call ${id}`, type: 'success' });
      
      // Send completion email to patient
      if (updatedCall.patientEmail) {
        sendEmail(
          updatedCall.patientEmail,
          `Diagnostic Report Ready - Call ${id}`,
          `Dear ${updatedCall.patientName}, your diagnostic report and invoice for call ${id} are now ready.`,
          `<h3>Diagnostic Report Ready</h3>
           <p>Dear ${updatedCall.patientName},</p>
           <p>Your diagnostic report and invoice for booking <b>${id}</b> are now ready and processed.</p>
           <p>You can view them in your dashboard.</p>
           <p>Thank you for choosing Disha Phlebo.</p>`
        ).catch(err => console.error("Failed to send completion email:", err));
      }
    }

    res.json({ success: true });
  });

  // Users API
  app.get("/api/users", async (req, res) => {
    res.json(Array.from(db.users.values()));
  });

  app.post("/api/users", async (req, res) => {
    const user = req.body;
    const userData = {
      ...user,
      isAvailable: user.isAvailable ? true : false,
      completedCalls: user.completedCalls || 0,
      rejectedCalls: user.rejectedCalls || 0,
      monthlyEarnings: user.monthlyEarnings || 0
    };
    db.users.set(user.id, userData);
    dbHelper.setUser(user.id, userData);
    res.json({ success: true, user });
  });

  app.patch("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const user = db.users.get(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (updates.currentLocation) {
        updates.lastActive = Date.now();
    }
    if (updates.isAvailable !== undefined) {
      updates.isAvailable = updates.isAvailable ? true : false;
    }

    const updatedUser = { ...user, ...updates };
    db.users.set(id, updatedUser);
    dbHelper.setUser(id, updatedUser);
    io.emit('user_updated', { id, ...updates });
    res.json({ success: true });
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

  app.get("/api/users/:id/report-data", async (req, res) => {
    const { id } = req.params;
    const user = db.users.get(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const calls = Array.from(db.calls.values())
      .filter((c: any) => c.assignedPhleboId === id)
      .sort((a: any, b: any) => (b.collectedAt || 0) - (a.collectedAt || 0))
      .map((c: any) => {
        const m = Array.from(db.metrics.values()).find((metric: any) => metric.callId === c.id);
        return {
          ...c,
          distance: m ? m.distance : null,
          tripTime: m ? m.totalTat : null
        };
      });

    res.json({ success: true, user, calls });
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
    
    // Return 404 for missing assets
    app.use('/assets', (req, res) => {
      res.status(404).send('Not Found');
    });

    app.get('*', (req, res) => {
      res.sendFile(join(__dirname, "dist/index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
