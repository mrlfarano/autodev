// server/index.js — autodev HTTP server: static files + REST API

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './api.js';
import { openBrowser } from './open-browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, '..', 'web', 'out');

const VERSION = '0.2.0';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Read the full request body and parse it as JSON.
 * Returns null if the body is empty or not valid JSON.
 */
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

/**
 * Serve a static file from STATIC_DIR.
 * Returns true if the file was served, false if not found.
 */
function serveStatic(res, urlPath) {
  // Normalize the URL path
  let filePath = urlPath === '/' ? '/index.html' : urlPath;

  // Security: prevent directory traversal
  const normalized = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(STATIC_DIR, normalized);

  // Ensure it's within STATIC_DIR
  if (!fullPath.startsWith(STATIC_DIR)) {
    return false;
  }

  try {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Try index.html inside directory
      const indexPath = path.join(fullPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath);
        res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'text/html', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
        res.end(content);
        return true;
      }
      return false;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(fullPath);

    // Hashed assets (_next/static/chunks/) are immutable — cache forever.
    // HTML and other files — never cache so the browser always gets fresh content.
    const isHashedAsset = urlPath.includes('/_next/static/');
    const cacheHeader = isHashedAsset
      ? 'public, max-age=31536000, immutable'
      : 'no-cache, no-store, must-revalidate';

    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': contentType, 'Cache-Control': cacheHeader });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Serve the SPA fallback (index.html) for client-side routing.
 */
function serveFallback(res) {
  const indexPath = path.join(STATIC_DIR, 'index.html');
  try {
    const content = fs.readFileSync(indexPath);
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'text/html', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    res.end(content);
  } catch {
    res.writeHead(404, { ...CORS_HEADERS, 'Content-Type': 'text/plain' });
    res.end('Not Found — web UI has not been built yet. Run: cd web && npm run build');
  }
}

/**
 * Start the autodev HTTP server.
 *
 * @param {number} port  Port to listen on (0 = random available port)
 */
export function startServer(port) {
  const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    // Apply CORS headers to all responses
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      res.setHeader(key, value);
    }

    const urlPath = req.url.split('?')[0];

    // API routes
    if (urlPath.startsWith('/api/')) {
      let body = null;
      if (req.method === 'POST' || req.method === 'PUT') {
        body = await readBody(req);
      }
      await handleApiRequest(req, res, body);
      return;
    }

    // Static files
    if (serveStatic(res, urlPath)) {
      return;
    }

    // SPA fallback
    serveFallback(res);
  });

  server.listen(port, () => {
    const assignedPort = server.address().port;
    const url = `http://localhost:${assignedPort}`;

    console.log('');
    console.log(`  \u26A1 autodev v${VERSION}`);
    console.log('');
    console.log(`  Web UI:  ${url}`);
    console.log('');
    console.log('  Press Ctrl+C to stop');
    console.log('');

    openBrowser(url);
  });

  server.on('error', (err) => {
    console.error(`Server error: ${err.message}`);
    process.exit(1);
  });

  // Graceful shutdown
  function shutdown() {
    console.log('\n  Shutting down...');
    server.close(() => {
      process.exit(0);
    });
    // Force exit after 3 seconds if server doesn't close cleanly
    setTimeout(() => process.exit(0), 3000);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}
