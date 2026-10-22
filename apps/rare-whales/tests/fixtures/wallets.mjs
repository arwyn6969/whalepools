// Public, disposable test keys. These accounts must never hold real assets.
export const FIXTURE_KEYS = Object.freeze({
  holder: '0x' + '1'.padStart(64, '0'),
  second: '0x' + '2'.padStart(64, '0'),
  empty: '0x' + '3'.padStart(64, '0'),
  rival: '0x' + '4'.padStart(64, '0')
});
export const FIXTURE_HOLDINGS = Object.freeze({
  holder: [{collection: 'rarewhales', tokenId: 245}, {collection: 'rarewhales', tokenId: 246}, {collection: 'whalestreet', tokenId: 1}],
  second: [{collection: 'rarewhales', tokenId: 777}, {collection: 'whalestreet', tokenId: 2}],
  empty: [],
  rival: [{collection: 'rarewhales', tokenId: 901}, {collection: 'whalestreet', tokenId: 3}]
});
