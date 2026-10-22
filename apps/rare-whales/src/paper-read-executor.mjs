import {DurableObject} from 'cloudflare:workers';
import {launchFetch} from './launch-worker.mjs';
import {paperReadPath} from './paper-read-routing.mjs';

// A stateless CPU executor. D1 remains the source of truth; this object stores
// no sessions, wallet data, response cache, alarms or strategy state.
export class PaperReadExecutor extends DurableObject {
  async read(request) {
    if (request.method !== 'GET' || !paperReadPath(new URL(request.url).pathname, this.env.BASE_PATH ?? '/whalepools')) {
      return new Response('Read endpoint unavailable', {status: 405});
    }
    // The unchanged API still verifies origin, cross-site policy and the D1
    // session on every call. Explicit direct mode prevents forwarding loops.
    return launchFetch(request, {...this.env, PAPER_READ_MODE: 'direct'});
  }
}
