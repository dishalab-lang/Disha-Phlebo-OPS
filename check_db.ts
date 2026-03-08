import sqlite3 from "sqlite3";

const db = new sqlite3.Database("disha.db");

db.get("PRAGMA integrity_check;", (err, row: any) => {
  if (err) {
    console.error("Integrity check failed with error:", err);
  } else {
    console.log("Integrity check result:", row.integrity_check);
  }
  db.close();
});
