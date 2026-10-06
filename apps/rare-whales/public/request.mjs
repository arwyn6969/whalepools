export const API_TIMEOUT_MS = 20000;

export async function boundedRequest(operation, {timeoutMs = API_TIMEOUT_MS, signal} = {}) {
  const controller = new AbortController();
  let timer, onAbort;
  const cancelled = new Promise((_, reject) => {
    onAbort = () => { controller.abort(); reject(Object.assign(new Error('This request was cancelled.'), {name: 'AbortError'})); };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, {once: true});
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error('The service took too long. Please try again.'), {name: 'TimeoutError', uncertain: true}));
    }, timeoutMs);
  });
  try { return await Promise.race([cancelled, Promise.resolve().then(() => {
    if (controller.signal.aborted) throw Object.assign(new Error('This request was cancelled.'), {name: 'AbortError'});
    return operation(controller.signal);
  })]); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
}

export function requestJSON(url, options = {}, limits = {}) {
  return boundedRequest(async signal => {
    let response;
    try { response = await fetch(url, {...options, signal}); }
    catch (error) { error.uncertain = true; throw error; }
    let result;
    try { result = await response.json(); }
    catch { throw Object.assign(new Error('The service returned an unreadable response. Please try again.'), {uncertain: true}); }
    if (!response.ok) throw Object.assign(new Error(result.error || 'The pool could not complete that action.'), {status: response.status});
    return result;
  }, limits);
}
