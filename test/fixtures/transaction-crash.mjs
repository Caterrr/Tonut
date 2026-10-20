import {deployTransaction} from '../../lib/transaction.mjs';
import {join} from 'node:path';
const root=process.argv[2],point=process.argv[3];
await deployTransaction({dest:join(root,'Tonut'),stage:join(root,'Tonut.stage-test'),service:{snapshot:async()=>({active:true,value:'old-service'}),stop:async()=>{},restore:async()=>{},start:async()=>{}},validate:async()=>{},health:async()=>true,checkpoint:async step=>{if(step===point)process.exit(43);}});
