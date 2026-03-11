import sqlite3 from 'sqlite3';

const db = new sqlite3.Database("disha.db");

db.all("SELECT * FROM metrics", [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log("Metrics:", rows);
  }
});
