import sqlite3 from "sqlite3";
const db = new sqlite3.Database("disha.db");
db.all("SELECT * FROM calls ORDER BY placedAt DESC", [], (err, calls) => {
  if (err) {
    console.error("DB Error:", err);
  } else {
    console.log("Calls:", calls.length);
  }
});
