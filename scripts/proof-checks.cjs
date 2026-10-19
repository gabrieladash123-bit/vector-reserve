const fs=require('node:fs'),path=require('node:path');
const {root,assert,equal,digest}=require('./transport.cjs');
const cases=JSON.parse(fs.readFileSync(path.join(root,'config/scenarios.json'))),modes=['calm','surge','offline'],instruments=['calm-claim','other-claim'];
function record(name,revision){const bytes=fs.readFileSync(path.join(root,'records',name+'.json'));return {url:`https://raw.githubusercontent.com/gabrieladash123-bit/vector-reserve/${revision}/records/${name}.json`,sha256:digest(bytes),source:JSON.parse(bytes)};}
function sources(c,revision){return {terms:record(c.terms,revision),reports:c.reports.map(n=>record(n,revision))};}
function args(c,d){return ['gabrieladash123-bit/vector-reserve',c.series,d.callers.slice(0,2),c.endowment,d.sources.terms.url,d.sources.terms.sha256,d.sources.reports.map(r=>r.url),d.sources.reports.map(r=>r.sha256)];}
function initial(c,d){const strip=r=>({url:r.url,sha256:r.sha256});return {configuration:{repository:'gabrieladash123-bit/vector-reserve',series:c.series,accounts:d.callers.slice(0,2),endowment:c.endowment,terms:strip(d.sources.terms),reports:d.sources.reports.map(strip)},compiled:{},phase:'UNCOMPILED',report_cursor:0,book:{credits:[c.endowment,c.endowment],positions:[[0,0],[0,0]],quotes:[],history:[],settlement:{}},risk:[]};}
// Independent reserve oracle: search initial credits that keep every terminal balance nonnegative.
function risk(positions,payouts,credits){
 const terminal=modes.map((_,s)=>payouts.reduce((value,row,j)=>value+positions[j]*row[s],0));
 const requiredFor=q=>{for(let cash=0;cash<=108;cash++){if(modes.every((_,s)=>cash+payouts.reduce((sum,row,j)=>sum+q[j]*row[s],0)>=0))return cash;}throw Error('Oracle exceeds bounded loss');};
 const required=requiredFor(positions),standalone=positions.reduce((sum,quantity,j)=>sum+requiredFor(positions.map((_,k)=>k===j?quantity:0)),0);
 return {pnl:terminal,required,standalone,headroom:credits-required};
}
function anchors(a,source){assert(Array.isArray(a)&&a.length>=1&&a.length<=3&&a.every(i=>Number.isInteger(i)&&i>=0&&i<source.clauses.length)&&equal(a,[...new Set(a)].sort((x,y)=>x-y)),'Material source anchor indices');}
function checkEvidence(e,descriptor,kind,c){
 assert(e&&equal(Object.keys(e).sort(),['decision','sha256','source','url'])&&e.url===descriptor.url&&e.sha256===descriptor.sha256&&equal(e.source,descriptor.source),'Exact fetched source binding');
 if(kind==='TERMS'){
  assert(Array.isArray(e.decision)&&e.decision.length===2,'Complete payoff rows');
  e.decision.forEach((row,j)=>{assert(equal(Object.keys(row).sort(),['cells','instrument'])&&row.instrument===instruments[j]&&row.cells.length===3,'Ordered instruments');row.cells.forEach((cell,s)=>{assert(equal(Object.keys(cell).sort(),['anchors','mode','value'])&&cell.mode===modes[s]&&cell.value===c.payouts[j][s]&&Number.isInteger(cell.value),'Exact expected payoff and uncertainty');anchors(cell.anchors,e.source);});});
 }else{
  assert(equal(Object.keys(e.decision).sort(),['anchors','finality','mode']),'Outcome schema');
  const pending=descriptor.url.endsWith('/report-draft.json');
  assert(e.decision.finality===(pending?'PENDING':'FINAL')&&e.decision.mode===(pending?'UNKNOWN':'surge'),'Finality and actual selected mode');anchors(e.decision.anchors,e.source);
 }
}
function replay(before,item,after,c,d){
 if(item.error){assert(equal(before,after),'Rejected operation changed state');return;}
 const s=structuredClone(before),b=s.book;
 if(item.method==='compile_terms'){
  assert(s.phase==='UNCOMPILED','Initial compile');checkEvidence(after.compiled,d.sources.terms,'TERMS',c);s.compiled=after.compiled;
  s.phase=c.payouts.flat().includes(-1)?'REVIEW':'OPEN';
 }else{
  assert(s.phase==='OPEN','Open book operation');
  if(item.method==='quote'){
   const index=b.quotes.length;b.quotes.push({maker:item.caller,quantities:item.args[0],premium:item.args[1],status:'OPEN'});
   b.history.push({operation:'QUOTE',index,caller:item.caller});
  }else if(item.method==='take'){
   const index=item.args[0],offer=b.quotes[index],maker=offer.maker,taker=item.caller;assert(maker!==taker&&offer.status==='OPEN','Counterparty accepts an open quote');
   b.credits[maker]+=offer.premium;b.credits[taker]-=offer.premium;
   offer.quantities.forEach((q,j)=>{b.positions[maker][j]-=q;b.positions[taker][j]+=q;});
   assert(b.credits.every(c=>c>=0)&&b.positions.flat().every(q=>Math.abs(q)<=6),'Credit and position bounds');
   assert([0,1].every(i=>modes.every((_,s)=>b.credits[i]+c.payouts.reduce((sum,row,j)=>sum+b.positions[i][j]*row[s],0)>=0)),'Every terminal state solvent');
   offer.status='TAKEN';b.history.push({operation:'TAKE',index,caller:taker,credits:[...b.credits],positions:b.positions.map(r=>[...r]),risk:[0,1].map(i=>risk(b.positions[i],c.payouts,b.credits[i]))});
  }else if(item.method==='cancel'){
   const index=item.args[0];assert(b.quotes[index].maker===item.caller&&b.quotes[index].status==='OPEN','Only maker cancellation');b.quotes[index].status='CANCELLED';b.history.push({operation:'CANCEL',index,caller:item.caller});
  }else{
   assert(item.method==='resolve','Known operation');const cursor=s.report_cursor,e=after.book.history.at(-1).evidence;
   checkEvidence(e,d.sources.reports[cursor],'OUTCOME',c);
   const definitive=e.decision.finality==='FINAL'&&modes.includes(e.decision.mode);
   s.phase=definitive?'SETTLED':cursor+1===d.sources.reports.length?'BLOCKED':'OPEN';
   if(definitive){const mode=modes.indexOf(e.decision.mode),adjustments=b.positions.map(row=>row.reduce((sum,q,j)=>sum+q*c.payouts[j][mode],0)),final=b.credits.map((v,i)=>v+adjustments[i]);
    assert(final.every(v=>v>=0)&&final.reduce((x,y)=>x+y,0)===2*c.endowment,'Settled conservation');
    b.settlement={mode:e.decision.mode,positions:b.positions,credits_before:b.credits,adjustments,credits_after:final};b.credits=final;b.positions=[[0,0],[0,0]];}
   if(['SETTLED','BLOCKED'].includes(s.phase))b.quotes.forEach(q=>{if(q.status==='OPEN')q.status='VOID';});
   b.history.push({operation:'RESOLVE',report_index:cursor,evidence:e,phase:s.phase,credits:[...b.credits]});s.report_cursor++;
  }
 }
 s.risk=!Object.keys(s.compiled).length||s.phase==='REVIEW'?[]:[0,1].map(i=>risk(b.positions[i],c.payouts,b.credits[i]));
 assert(b.credits.reduce((x,y)=>x+y,0)===2*c.endowment&&[0,1].every(j=>b.positions[0][j]+b.positions[1][j]===0),'Conserved credits and zero-sum instruments');
 assert(equal(s,after),'Complete portfolio ledger replay: '+item.label);
}
function plan(c){
 if(c.id==='uncertain-terms')return [{label:c.id+'-compile',method:'compile_terms',args:[],caller:0},{label:c.id+'-blocked-quote',method:'quote',args:[[1,1],1],caller:0,error:'[EXPECTED] Book not open'}];
 const rows=[
  ['compile','compile_terms',[],0],
  ['outsider-quote','quote',[[1,1],1],2,'[EXPECTED] Participant only'],
  ['basket-quote','quote',[[1,1],1],0],
  ['self-take','take',[0],0,'[EXPECTED] Counterparty acceptance required'],
  ['basket-take','take',[0],1],
  ['boundary-quote','quote',[[1,0],1],0],
  ['boundary-take','take',[1],1],
  ['excess-quote','quote',[[1,0],0],0],
  ['excess-rejected','take',[2],1,'[EXPECTED] Insufficient scenario reserve'],
  ['wrong-cancel','cancel',[2],1,'[EXPECTED] Maker only'],
  ['cancel-excess','cancel',[2],0],
  ['cover-quote','quote',[[1,0],1],1],
  ['cover-take','take',[3],0],
  ['draft-pending','resolve',[],0],
  ['other-quote','quote',[[0,1],2],0],
  ['other-take','take',[4],1],
  ['resting-quote','quote',[[1,0],0],0],
  ['final-settlement','resolve',[],1],
  ['closed-quote','quote',[[1,0],0],0,'[EXPECTED] Book not open']
 ];
 return rows.map(([label,method,args,caller,error])=>({label:c.id+'-'+label,method,args,caller,...(error?{error}:{})}));
}
function final(c,s){assert(s.phase===c.final_phase&&equal(s.book.credits,c.final_credits),'Expected final phase and real credit balances');if(c.id==='clearing'){assert(equal(s.book.settlement.adjustments,[-12,12])&&equal(s.book.settlement.positions,[[-1,-2],[1,2]])&&s.book.quotes[5].status==='VOID','Mode-dependent settlement and invalidated resting quote');}}
module.exports={cases,modes,instruments,record,sources,args,initial,risk,checkEvidence,replay,plan,final};
