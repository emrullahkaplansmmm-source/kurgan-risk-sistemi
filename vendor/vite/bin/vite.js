#!/usr/bin/env node
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, cpSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const projectRoot = process.cwd();
let serveRoot = projectRoot;
const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('-')) || 'dev';
const host = args.includes('--host') ? args[args.indexOf('--host') + 1] || '0.0.0.0' : '127.0.0.1';
const port = Number(args[args.indexOf('--port') + 1]) || 5173;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const resolved = normalize(join(serveRoot, clean));
  if (!resolved.startsWith(serveRoot)) return null;
  return resolved;
}

function build() {
  const dist = join(projectRoot, 'dist');
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  cpSync(join(projectRoot, 'index.html'), join(dist, 'index.html'));
  cpSync(join(projectRoot, 'src'), join(dist, 'src'), { recursive: true });
  mkdirSync(join(dist, 'node_modules'), { recursive: true });
  cpSync(join(projectRoot, 'vendor', 'react'), join(dist, 'node_modules', 'react'), { recursive: true });
  cpSync(join(projectRoot, 'vendor', 'react-dom'), join(dist, 'node_modules', 'react-dom'), { recursive: true });
  cpSync(join(projectRoot, 'vendor', 'vite'), join(dist, 'node_modules', 'vite'), { recursive: true });
  console.log('vite v6.0.0-local building for production...');
  console.log('✓ built in dist/');
}

if (command === 'build') {
  build();
  process.exit(0);
}

if (command === 'preview') {
  serveRoot = existsSync(join(projectRoot, 'dist')) ? join(projectRoot, 'dist') : projectRoot;
}

const server = createServer((request, response) => {
  const filePath = safePath(request.url || '/');
  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    const fallback = join(serveRoot, 'index.html');
    response.writeHead(existsSync(fallback) ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
    response.end(existsSync(fallback) ? readFileSync(fallback) : 'Not found');
    return;
  }
  response.writeHead(200, { 'content-type': types[extname(filePath)] || 'application/octet-stream' });
  response.end(readFileSync(filePath));
});

server.listen(port, host, () => {
  const label = command === 'preview' ? 'preview' : 'dev';
  console.log(`  VITE v6.0.0-local  ready in 0 ms`);
  console.log(`  ➜  Local:   http://localhost:${port}/`);
  console.log(`  ➜  Network: http://${host}:${port}/ (${label})`);
});
