const fs=require('node:fs'),path=require('node:path');
const {root,assert,equal,sourceHash,save,invoke,read,rpc,receipt}=require('./transport.cjs');
const {cases,sources,args,initial,replay,plan,final}=require('./proof-checks.cjs');
async function main(){
 assert(await rpc('eth_chainId',[])==='0xf22f','Gasless StudioNet only');
 const accounts=JSON.parse(process.env.VECTOR_ACCOUNTS||'null');assert(accounts?.length===3,'Two parties and an outsider');
 const revision=fs.readFileSync(path.join(root,'config/fixture-revision.txt'),'utf8').trim();assert(/^[a-f0-9]{40}$/.test(revision),'Pinned source revision');
 const suite=[];
 for(const c of cases){
  const documents=sources(c,revision);
  for(const document of [documents.terms,...documents.reports]){const r=await fetch(document.url,{signal:AbortSignal.timeout(45000)});assert(r.ok&&require('node:crypto').createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex')===document.sha256,'Exact public source bytes');}
  process.env.VECTOR_ACCOUNT=accounts[0].name;
  const d={id:c.id,callers:accounts.map(a=>a.address),sources:documents,fixture_revision:revision,source_sha256:sourceHash,network:'studionet',chain_id:61999};d.args=args(c,d);
  const hash=await invoke(c.id+'-deployment',['deploy','--contract','contracts/vector_reserve.py','--args',...d.args.map(a=>typeof a==='string'?a:JSON.stringify(a))]);
  const r=await receipt(c.id+'-deployment',hash,true);d.contract=r.to_address||r.recipient;d.transaction=hash;
  assert(fs.readFileSync(path.join(root,'contracts/vector_reserve.py')).equals(Buffer.from(await rpc('gen_getContractCode',[d.contract]),'base64')),'Exact deployed source');
  save(c.id+'-deployment',d);suite.push(d);save('suite',suite);
  let state=await read(c.id+'-initial',['call',d.contract,'get_state']);assert(equal(state,initial(c,d)),'Exact fresh credit book');save(c.id+'-initial-state',state);
  const trace=[];
  for(const item of plan(c)){
   process.env.VECTOR_ACCOUNT=accounts[item.caller].name;
   const before=state,tx=await invoke(item.label,['write',d.contract,item.method,...(item.args.length?['--args',...item.args.map(a=>typeof a==='string'?a:JSON.stringify(a))]:[])]);
   const rr=await receipt(item.label,tx,!item.error);state=await read(item.label+'-state',['call',d.contract,'get_state']);
   assert((rr.from_address||rr.sender).toLowerCase()===d.callers[item.caller],'Actual party or outsider signer');replay(before,item,state,c,d);
   if(item.error){const decoded=await read(item.label+'-decoded',['receipt',tx,'--status','FINALIZED','--retries','2']);assert(JSON.stringify(decoded).includes(item.error),'Exact expected rejection');save(item.label+'-decoded-receipt',decoded);}
   const p={...item,contract:d.contract,transaction:tx,sender:d.callers[item.caller],state_before:before,state};trace.push(p);save(item.label,p);save(c.id+'-trace',trace);
   console.log('VERIFIED',item.label,state.phase,JSON.stringify(state.book.credits));
  }
  final(c,state);save(c.id+'-final-state',state);
 }
}
main().catch(e=>{console.error(e.stack,e.cause?.message||'');process.exitCode=1;});
