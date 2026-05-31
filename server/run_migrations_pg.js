#!/usr/bin/env node
const { Client } = require('pg');

async function run() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[migrate] connected');

    const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      password TEXT,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      cat TEXT,
      emoji TEXT,
      price REAL DEFAULT 0,
      oldPrice REAL,
      badge TEXT,
      badgeType TEXT,
      rating REAL DEFAULT 5.0,
      reviews INTEGER DEFAULT 0,
      desc TEXT,
      images TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_id TEXT,
      customer_name TEXT,
      wilayat TEXT,
      area TEXT,
      phone TEXT,
      items TEXT,
      delivery TEXT,
      deliveryCost REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'new',
      payment TEXT,
      proof TEXT,
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      token_hash TEXT,
      expires_at BIGINT,
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    `;

    await client.query(sql);
    console.log('[migrate] tables created or exist');
  } catch (err) {
    console.error('[migrate] failed', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

run();
