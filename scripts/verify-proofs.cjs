const fs=require('node:fs'),path=require('node:path');
const {root,assert,equal,digest,rpc,read,receiptSummary,save}=require('./transport.cjs');
const {decodeReceipt}=require('./receipt-calldata.cjs');
const {cases,sources,args,initial,replay,plan,final}=require('./proof-checks.cjs');
const load=n=>JSON.parse(fs.readFileSync(path.join(root,'proofs',n+'.json')));
async function main(){
 const offline=process.argv.includes('--offline'),suite=load('suite'),code=fs.readFileSync(path.join(root,'contracts/vector_reserve.py')),journal=load('transactions');
 const revision=fs.readFileSync(path.join(root,'config/fixture-revision.txt'),'utf8').trim();
 assert(suite.length===cases.length&&journal.source_sha256===digest(code),'Complete source-bound proof suite');if(!offline)assert(await rpc('eth_chainId',[])==='0xf22f','StudioNet chain');
 const hashes=new Set(),summary={mode:offline?'offline-artifact':'fresh-rpc-and-state',verified_at:new Date().toISOString(),source_sha256:digest(code),instances:[],transactions:[]};
 async function verify(label,hash,success,caller,d,expected){
  assert(!hashes.has(hash)&&journal.hashes[label]===hash,'Unique journal receipt');hashes.add(hash);
  const saved=load(label+'-receipt'),r=offline?saved:await rpc('eth_getTransactionByHash',[hash]),s=receiptSummary(r);
  assert(s.hash===hash&&s.status==='FINALIZED'&&s.result==='MAJORITY_AGREE'&&s.agree>(s.agree+s.disagree+s.idle)/2,'Finalized strict majority');
  assert((r.to_address||r.recipient).toLowerCase()===d.contract.toLowerCase()&&(r.from_address||r.sender).toLowerCase()===d.callers[caller],'Actual target and signer');
  assert(equal(saved.consensus_data.votes,r.consensus_data.votes)&&equal(saved.data,r.data)&&equal(await decodeReceipt(r),expected),'Decoded actual call and raw votes');
  assert(success?['SUCCESS','FINISHED_WITH_RETURN'].includes(s.execution):s.execution==='ERROR','Expected execution result');
  if(label.endsWith('-deployment'))assert(code.equals(Buffer.from(r.data.contract_code,'base64')),'Deployment receipt source bytes');summary.transactions.push({label,...s});
 }
 for(let i=0;i<cases.length;i++){
  const c=cases[i],d=suite[i];assert(equal(d,load(c.id+'-deployment'))&&d.id===c.id&&d.chain_id===61999&&d.network==='studionet'&&d.source_sha256===digest(code),'Deployment identity and source');
  assert(d.fixture_revision===revision&&equal(d.sources,sources(c,revision))&&d.callers.length===3&&new Set(d.callers).size===3&&equal(d.args,args(c,d)),'Fixed accounts, terms and ordered reports');
  await verify(c.id+'-deployment',d.transaction,true,0,d,{args:d.args});let previous=load(c.id+'-initial-state');assert(equal(previous,initial(c,d)),'Fresh configuration and exact initial supply');
  const items=plan(c),trace=load(c.id+'-trace');assert(trace.length===items.length,'Complete transaction plan');
  for(let j=0;j<items.length;j++){
   const item=items[j],p=trace[j];assert(equal(p,load(item.label))&&Object.keys(item).every(k=>equal(p[k],item[k]))&&p.contract===d.contract&&p.sender===d.callers[item.caller]&&equal(p.state_before,previous),'Exact snapshot and call chain');
   await verify(item.label,p.transaction,!item.error,item.caller,d,{method:item.method,args:item.args});replay(previous,item,p.state,c,d);
   if(item.error)assert(JSON.stringify(load(item.label+'-decoded-receipt')).includes(item.error),'Exact business rejection');previous=p.state;
  }
  final(c,previous);assert(equal(previous,load(c.id+'-final-state')),'Exact final ledger');
  if(!offline){assert(code.equals(Buffer.from(await rpc('gen_getContractCode',[d.contract]),'base64')),'Live source bytes');assert(equal(previous,await read(c.id+'-fresh-final',['call',d.contract,'get_state'])),'Fresh final credit balances and positions');}
  summary.instances.push({id:c.id,contract:d.contract,phase:previous.phase,credits:previous.book.credits,settlement:previous.book.settlement});
 }
 assert(hashes.size===23&&Object.keys(journal.hashes).length===23,'Exactly 23 distinct planned receipts');summary.transaction_calldata_checked=true;
 if(!offline){summary.live_state_match=true;save('verification',summary);}console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
