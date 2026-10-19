const {risk,cases,plan}=require('./proof-checks.cjs');
const {assert,equal}=require('./transport.cjs');
const payouts=cases[0].payouts;
assert(equal(risk([-1,-1],payouts,11),{pnl:[-6,-6,-6],required:6,standalone:12,headroom:5}),'Portfolio offset admitted below gross reserve');
assert(risk([-2,-1],payouts,12).headroom===0,'Exact reserve boundary');
assert(risk([-3,-1],payouts,12).headroom<0,'Excess margin rejected');
assert(equal(risk([-1,-2],payouts,13).pnl,[-6,-12,-12]),'Actual outcome affects transfer');
assert(cases.reduce((sum,c)=>sum+1+plan(c).length,0)===23,'Expected receipt plan');
console.log('Independent minimum-credit oracle and 23-receipt plan passed');
