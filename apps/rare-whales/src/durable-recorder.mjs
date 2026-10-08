import {DurableObject} from 'cloudflare:workers';
import {createRecorderCoordinator} from './recorder-coordinator.mjs';
import {launchTick} from './launch-worker.mjs';

export class PaperRecorder extends DurableObject{
 #coordinator;
 constructor(ctx,env){
  super(ctx,env);
  this.#coordinator=createRecorderCoordinator({storage:ctx.storage,env,tick:launchTick});
 }
 async run(scheduledTime){return this.#coordinator.run(scheduledTime);}
 async status(){return this.#coordinator.status();}
}
