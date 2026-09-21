export const CHAIN_ID = 4663;
export const RPC_URL = 'https://rpc.mainnet.chain.robinhood.com';
export const COLLECTIONS = Object.freeze({
  rarewhales: { name: 'Rare Whales', address: '0xcafa6d08ac4ed305c15f8d41d155499118c5f605', url: 'https://opensea.io/collection/rarewhales' },
  whalestreet: { name: 'WhaleStreet', address: '0x01f33271d74a9dcc91798c7232d3d788da93a1f6', url: 'https://opensea.io/collection/whalestreet' }
});
export const STRATEGIES = Object.freeze({
  trend: { name: 'Ride the current', kind: 'Trend retest', description: 'Wait for an upward trend, a high-volume breakout and a confirmed pullback.' },
  recovery: { name: 'Watch the deep', kind: 'Sweep & recovery', description: 'Wait for a downward volume spike, a reclaim and a confirmed recovery setup.' }
});
export function validateSeason(season) {
  if (!season || !/^[a-z0-9-]{1,80}$/.test(season.id) || !['draft', 'registration', 'running', 'completed'].includes(season.status)) throw Error('Invalid season configuration.');
  const a = season.access;
  if (!a || !Array.isArray(a.balanceCollections) || !Array.isArray(a.promoTokenIds) || !Array.isArray(a.founderWallets) || typeof a.confirmed !== 'boolean') throw Error('Invalid seat policy.');
  if (!Number.isSafeInteger(a.minimumBalance) || a.minimumBalance < 1 || a.minimumBalance > 10000 || a.balanceCollections.some(x => !COLLECTIONS[x]) || new Set(a.balanceCollections).size !== a.balanceCollections.length) throw Error('Invalid holding requirement.');
  if (a.promoTokenIds.some(x => !Number.isSafeInteger(x) || x < 0 || x > 1000000) || new Set(a.promoTokenIds).size !== a.promoTokenIds.length || a.promoTokenIds.length > 32) throw Error('Invalid promotional tokens.');
  if (a.founderWallets.some(x => !/^0x[0-9a-fA-F]{40}$/.test(x))) throw Error('Invalid founder wallet.');
  if (season.initialEquity !== 1000 || season.settings?.equity !== 1000 || JSON.stringify(season.strategies) !== '["trend","recovery"]') throw Error('Unrecognized season rules.');
  if (season.modifierVersion !== 'whale-dna-v1' || season.pool?.budget !== 1000 || season.pool?.allocation !== 'equal' || season.pool?.maxAgents !== 12) throw Error('Unrecognized pool or DNA rules.');
  if (season.status !== 'draft') {
    const times = [season.registrationClosesAt, season.startsAt, season.endsAt].map(Date.parse);
    if (!a.confirmed || !a.balanceCollections.length || !a.promoTokenIds.length || !a.founderWallets.length || times.some(t => !Number.isFinite(t)) || times[0] > times[1] || times[1] >= times[2]) throw Error('Confirm access and publish valid season dates before opening registration.');
  }
  return season;
}
