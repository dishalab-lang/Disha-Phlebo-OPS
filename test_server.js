import express from "express";
import sqlite3 from "sqlite3";

const db = new sqlite3.Database("disha.db");
const app = express();
app.use(express.json());

app.get("/api/calls", (req, res) => {
  db.all("SELECT * FROM calls ORDER BY placedAt DESC", [], (err, calls) => {
    if (err) {
      console.error("Calls DB Error:", err);
      res.status(500).json({ success: false, message: "Database error", error: String(err) });
    } else {
      res.json(calls);
    }
  });
});

app.listen(3001, () => console.log("Test server running on 3001"));
