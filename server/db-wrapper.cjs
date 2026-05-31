const fs = require('fs');
const path = require('path');

function convertPlaceholders(sql) {
  // Replace ? with $1..$n for Postgres
  let idx = 0;
  return sql.replace(/\?/g, () => {
    idx += 1;
    return '$' + idx;
  });
}

async function initDB() {
  const DATABASE_URL = process.env.DATABASE_URL || '';
  if (DATABASE_URL.startsWith('postgres')) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: DATABASE_URL });

    return {
      async get(sql, params = []) {
        const q = convertPlaceholders(sql);
        const res = await pool.query(q, params);
        return res.rows[0] || null;
      },
      async run(sql, params = []) {
        const q = convertPlaceholders(sql);
        return (await pool.query(q, params));
      },
      async all(sql, params = []) {
        const q = convertPlaceholders(sql);
        const res = await pool.query(q, params);
        return res.rows;
      },
      async exec(sql) {
        return await pool.query(sql);
      },
      saveDB() {
        // No-op for Postgres
      }
    };
  } else {
    const initSqlJs = require('sql.js');
    let SQL = await initSqlJs();
    let db;
    let dbPath;
    const DATA_DIR = path.resolve(process.cwd(), 'data');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    dbPath = process.env.DB_FILE || path.join(DATA_DIR, 'resal.db');

    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    function saveDB() {
      if (db && dbPath) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
      }
    }

    function run(sql, params = []) {
      try {
        db.run(sql, params);
        saveDB();
        return { lastID: null, changes: db.getRowsModified() };
      } catch (err) {
        throw err;
      }
    }

    function get(sql, params = []) {
      try {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        let result = undefined;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      } catch (err) {
        console.error('[DB] Error in get():', err.message, 'SQL:', sql);
        throw err;
      }
    }

    function all(sql, params = []) {
      try {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      } catch (err) {
        console.error('[DB] Error in all():', err.message, 'SQL:', sql);
        throw err;
      }
    }

    function exec(sql) {
      try {
        const statements = sql.split(';').filter(s => s.trim());
        statements.forEach(stmt => {
          if (stmt.trim()) db.run(stmt);
        });
        saveDB();
      } catch (err) {
        console.error('[DB] Error:', err.message);
        throw err;
      }
    }

    return { init: async () => {}, get, all, run, exec, saveDB };
  }
}

module.exports = { initDB };
