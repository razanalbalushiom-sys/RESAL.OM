import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import * as cookieParser from "cookie-parser";
import * as cors from "cors";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const { initializeAPI } = _require("../api.cjs");
const { initDB } = _require("../db-wrapper.cjs");
const bcrypt = _require("bcrypt");

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Initialize database first
  const dbWrapper = await initDB();
  
  // Initialize schema
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      name TEXT,
      password TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      token_hash TEXT,
      expires_at INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  
  // Seed admin
  const admin = dbWrapper.get('SELECT id FROM users WHERE email=?', ['admin@resal.om']);
  if (!admin) {
    const hash = bcrypt.hashSync('resal2025', 10);
    dbWrapper.run('INSERT INTO users (email,name,password,role) VALUES (?,?,?,?)',
      ['admin@resal.om', 'المدير الرئيسي', hash, 'admin']
    );
    console.log('[Resal] Seeded admin: admin@resal.om / resal2025');
  }
  
  // Seed products
  const productCount = dbWrapper.all('SELECT COUNT(*) as c FROM products');
  if (productCount.length === 0 || productCount[0].c === 0) {
    const products = [
      ['سوني WH-1000XM6', 'headphones', '🎧', 89.900, 109.900, 'جديد', 'badge-new', 4.9, 2341, 'إلغاء ضوضاء صناعي بمستوى لا مثيل له مع 30 ساعة عمر للبطارية.'],
      ['آبل AirPods Pro 2', 'headphones', '🍎', 69.900, null, null, '', 4.8, 5423, 'صوت متكيف يمزج بسلاسة بين إلغاء الضوضاء ووضع الشفافية.'],
      ['سامسونج أوديسي G9 49"', 'screens', '🖥️', 499.900, 649.900, 'ساخن', 'badge-hot', 4.7, 891, 'شاشة ألعاب مقوسة 49 بوصة مع معدل تحديث 240Hz وزمن استجابة 1ms.'],
      ['Shure SM7B مايكروفون', 'microphone', '🎤', 119.900, null, null, '', 5.0, 3102, 'المايكروفون الأسطوري للبث الاحترافي.'],
      ['SecretLab TITAN Evo كرسي', 'chairs', '🪑', 249.900, 299.900, 'خصم', 'badge-sale', 4.9, 1243, 'الكرسي الأول في العالم للألعاب بمواد فاخرة.'],
      ['Razer DeathAdder V3 ماوس', 'accessories', '🖱️', 32.900, null, null, '', 4.8, 4201, 'ماوس ألعاب مريح بمستشعر بصري 30,000 DPI.'],
      ['Elgato Stream Deck MK.2', 'accessories', '🎛️', 49.900, 59.900, 'خصم', 'badge-sale', 4.7, 2870, '15 مفتاح LCD قابل للتخصيص للبث والإنتاج.'],
      ['Logitech MX Keys S كيبورد', 'accessories', '⌨️', 44.900, null, 'جديد', 'badge-new', 4.8, 1932, 'كيبورد لاسلكي مضاء متقدم.'],
      ['Blue Yeti USB مايكروفون', 'microphone', '🎙️', 55.900, 69.900, 'خصم', 'badge-sale', 4.6, 8203, 'مايكروفون USB احترافي بأربعة أنماط التقاط.'],
      ['فيليبس Evnia 27 بوصة', 'screens', '📺', 179.900, null, 'جديد', 'badge-new', 4.7, 441, 'شاشة ألعاب QHD 27 بوصة بلوحة IPS ومعدل تحديث 180Hz.'],
      ['طاولة ألعاب Gaming XL Pro', 'chairs', '🗂️', 149.900, 189.900, 'خصم', 'badge-sale', 4.8, 672, 'طاولة ألعاب بسطح كربون مع إضاءة RGB وإدارة كابلات.'],
      ['بايردينامك DT 770 PRO', 'headphones', '🎵', 79.900, null, null, '', 4.9, 12431, 'سماعات استوديو مغلقة بمعيار الصناعة للمزج والإتقان.'],
    ];
    products.forEach(p => {
      dbWrapper.run('INSERT INTO products (name,cat,emoji,price,oldPrice,badge,badgeType,rating,reviews,desc,images) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [...p, '[]']
      );
    });
    console.log('[Resal] Seeded 12 sample products');
  }
  
  const app = express();
  const server = createServer(app);

  // FIX #1: Trust Render's reverse proxy so req.protocol === 'https' in production
  // This is required for secure session cookies to work on Render
  app.set('trust proxy', 1);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use((cookieParser as any)());
  app.use((cors as any)({ origin: process.env.CORS_ORIGIN || true, credentials: true }));

  // Serve uploaded files
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'public/uploads');
  app.use('/uploads', express.static(uploadDir));

  // Mount the custom Resal REST API (with session fix applied inside)
  const resalApiRouter = await initializeAPI(dbWrapper);
  app.use('/api', resalApiRouter);

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Serve the static HTML files (index.html, admin.html, reset-password.html)
  const staticDir = path.resolve(process.cwd(), 'public');
  
  // Direct route for root path
  app.get('/', (req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'public/index.html'));
  });
  
  app.use(express.static(staticDir));
  
  // Save DB on exit
  process.on('exit', () => dbWrapper.saveDB());

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    // In production, just serve static files (no Vite)
    // Static files are already set up above
  }

  // Fallback route to serve index.html for SPA (for client-side routing)
  app.get('*', (req, res) => {
    const indexPath = path.resolve(process.cwd(), 'public/index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Not found');
    }
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`[Resal] API ready at /api`);
    console.log(`[Resal] Static files served from /public`);
  });
}

startServer().catch((err) => {
  console.error('[Resal] Server startup failed:', err);
  process.exit(1);
});
