// Fix D (2026-09-26): a do-nothing PostgREST stand-in for CI.
//
// ci.yml's `next build` + `next start` route scan used the PRODUCTION
// Supabase keys, so every PR push prerendered and rendered every static route
// against the live database -- hundreds of API requests per run, each writing
// a ~2.5 KB gateway log line (log ingest is over the Free quota). CI only
// needs the build to succeed and the rendered HTML to be scannable (email
// leak, <title>/description defects), not real data, so the job points
// NEXT_PUBLIC_SUPABASE_URL here instead.
//
// Behaves like PostgREST with zero matching rows:
//   GET/HEAD /rest/v1/<table>  -> 200 []  (Content-Range */0)
//   ...with Accept: application/vnd.pgrst.object+json (.single())
//                              -> 406 PGRST116, exactly what the real API returns
//   POST /rest/v1/rpc/<fn>     -> 200 null
//   anything else              -> 200 []
// No data, no network beyond 127.0.0.1.
import http from 'node:http';

const PORT = Number(process.env.SUPABASE_STUB_PORT ?? 54321);
let hits = 0;

http.createServer((req, res) => {
  hits++;
  const accept = String(req.headers.accept ?? '');
  const json = (status, body, extra = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Range': '*/0', ...extra });
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
  };
  req.resume();
  if (req.url?.startsWith('/rest/v1/rpc/')) return json(200, null);
  if (accept.includes('application/vnd.pgrst.object+json')) {
    return json(406, { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
  }
  return json(200, []);
}).listen(PORT, '127.0.0.1', () => console.log(`[supabase-stub] listening on 127.0.0.1:${PORT}`));

process.on('SIGTERM', () => { console.log(`[supabase-stub] served ${hits} request(s)`); process.exit(0); });
