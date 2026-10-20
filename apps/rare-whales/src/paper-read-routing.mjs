export function paperReadPath(path, base = '/whalepools') {
  const route = path.slice(base.length);
  return path.startsWith(base + '/api/') && (route === '/api/paper' || route === '/api/paper/history' ||
    route === '/api/paper/coverage' || route.startsWith('/api/paper/run/') || route.startsWith('/api/paper/recap/'));
}

// There are always at most sixteen stateless read executors. The shard name
// contains neither the session cookie nor a wallet/address. No data is cached.
export async function paperReadShard(request) {
  const cookie = (request.headers.get('cookie') ?? '').split(';').map(v => v.trim()).find(v => v.startsWith('wp_arcade_session=')) ?? '';
  const seed = cookie || request.headers.get('cf-ray') || 'anonymous';
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed)));
  return 'paper-reads-v1:' + (hash[0] & 15);
}

export async function forwardPaperRead(request, env, base) {
  if (request.method !== 'GET' || !paperReadPath(new URL(request.url).pathname, base)) return null;
  const mode = env.PAPER_READ_MODE ?? 'direct';
  if (mode === 'direct') return null;
  if (mode !== 'durable-object' || !env.PAPER_READS) return Response.json({error: 'Paper reads are temporarily unavailable. Saved watches are kept.'},
    {status: 503, headers: {'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}});
  // Request/Response bodies are streamed across RPC. Parsing, projection and
  // serialization run in the read executor's CPU budget, not this HTTP Worker.
  return env.PAPER_READS.getByName(await paperReadShard(request)).read(request);
}
