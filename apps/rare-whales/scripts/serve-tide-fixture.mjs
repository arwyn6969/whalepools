import {startFixtureServer} from './serve-fixture.mjs';
import {seedTideOutcomes} from '../tests/fixtures/tide-rounds.mjs';
const fixture=await startFixtureServer({port:Number(process.env.RW_FIXTURE_PORT||48394),paperEnabled:true});
const ids=await seedTideOutcomes(fixture);
console.log('Disposable Tide presentation preview: '+fixture.origin+'/tide/'+ids.partial);
console.log('Seeded presentation snapshots only; complete execution is verified separately.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await fixture.close();process.exit(0);});
