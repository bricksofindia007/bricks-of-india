import { readFileSync } from 'fs';
const html = readFileSync('admin/dashboard.html', 'utf8');
const m = html.match(/<script id="boi-data" type="application\/json">([\s\S]*?)<\/script>/);
if (!m) { console.error('boi-data block not found'); process.exit(1); }
try { JSON.parse(m[1]); console.log('JSON OK'); } catch (e) { console.error('JSON INVALID:', e.message); process.exit(1); }
