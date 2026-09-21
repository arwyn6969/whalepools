// Exploratory whale-tactics-v1; see TACTICS.md and RC-005. Never edits the frozen engine.
export function buildTacticSignals(model, mode, {patternStart = -Infinity} = {}) {
  if (!['breakout', 'magnet'].includes(mode)) throw Error('Unknown experimental tactic.');
  const {bars, states} = model, signals = [];
  let continuousFrom = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], previous = bars[i - 1], state = states[i];
    if (previous && b.t !== previous.T + 1) continuousFrom = i;
    const lookback = mode === 'breakout' ? 20 : 100;
    if (i < 200 || i - continuousFrom < lookback || b.t < patternStart ||
        !state || state.contextStale || !['uptrend', 'mixed'].includes(state.bias) ||
        !Number.isFinite(b.atr) || b.atr <= 0 || !b.up) continue;
    let stop, target;
    if (mode === 'breakout') {
      if (state.bias !== 'uptrend' || !b.vector || b.h <= b.l ||
          b.c <= Math.max(...bars.slice(i - 20, i).map(x => x.h)) ||
          b.c < b.l + .75 * (b.h - b.l)) continue;
      stop = Math.min(b.l, previous.l) - .2 * b.atr;
      if (b.c - stop <= 0 || b.c - stop > 3 * b.atr) continue;
      target = b.c + 2 * (b.c - stop);
    } else {
      if (b.c <= previous.h || b.c <= b.e50) continue;
      const untouched = [];
      for (let j = i - 100; j < i; j++) {
        const source = bars[j], mid = (source.o + source.c) / 2;
        if (source.t < patternStart || !source.vector || source.c >= source.o || mid <= b.c) continue;
        if (bars.slice(j + 1, i + 1).every(x => x.h < mid)) untouched.push(mid);
      }
      if (!untouched.length) continue;
      target = Math.min(...untouched);
      stop = Math.min(...bars.slice(i - 2, i + 1).map(x => x.l)) - .2 * b.atr;
      if (b.c - stop <= 0 || b.c - stop > 4 * b.atr) continue;
    }
    signals.push({i, t: b.T + 1, kind: mode, entry: b.c, stop, target, bias: state.bias});
  }
  return signals;
}
