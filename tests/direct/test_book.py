import ast
import hashlib
import itertools
import json
import random
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'contracts/vector_reserve.py'
REPO = 'gabrieladash123-bit/vector-reserve'
PAYOUTS = [[6,0,0],[0,6,6]]
MODES = ['calm','surge','offline']
INSTRUMENTS = ['calm-claim','other-claim']


def record(name):
    body = (ROOT / 'records' / (name+'.json')).read_bytes()
    url = f'https://raw.githubusercontent.com/{REPO}/'+'a'*40+f'/records/{name}.json'
    return url, hashlib.sha256(body).hexdigest(), body


def arguments(accounts, terms='terms-complete', reports=('report-draft','report-final'), endowment=10):
    t = record(terms)
    rs = [record(r) for r in reports]
    return [REPO, 'harbor-credits', accounts[:2], endowment, *t[:2], [r[0] for r in rs], [r[1] for r in rs]]


def terms_decision(payouts=PAYOUTS):
    return {'rows':[{'instrument':name,'cells':[{'mode':mode,'value':payouts[j][s],'anchors':[j]} for s,mode in enumerate(MODES)]} for j,name in enumerate(INSTRUMENTS)]}


def mocks(vm, name='terms-complete', decision=None, audit=None, corrupt=False, raw=None, status=200):
    vm.clear_mocks()
    url, digest, body = record(name)
    vm.mock_web(re.escape(url), {'status':status,'body': raw if raw is not None else body+(b' ' if corrupt else b'')})
    if name.startswith('terms'):
        expected = terms_decision([[6,0,0],[0,6,-1]] if name=='terms-unknown' else PAYOUTS)
        marker = 'TERMS'
    else:
        expected = {'finality':'PENDING','mode':'UNKNOWN','anchors':[0]} if name=='report-draft' else {'finality':'FINAL','mode':'surge','anchors':[0]}
        marker = 'OUTCOME'
    vm.mock_llm(r'.*VECTORRESERVE-'+marker+r'\n.*', json.dumps(expected if decision is None else decision))
    vm.mock_llm(r'.*VECTORRESERVE-AUDIT-'+marker+r'.*', json.dumps({'decisions_correct':True,'anchors_support':True} if audit is None else audit))
    return url, digest


@pytest.fixture
def book(direct_deploy, direct_accounts, direct_vm):
    direct_vm.sender = direct_accounts[0]
    return direct_deploy(str(SOURCE), *arguments(direct_accounts))


def compile_book(book, vm):
    mocks(vm)
    book.compile_terms()
    assert vm.run_validator() is True


def trade(book, vm, accounts, quantities, premium, maker=0):
    vm.sender = accounts[maker]
    index = len(book.get_state()['book']['quotes'])
    book.quote(quantities,premium)
    vm.sender = accounts[1-maker]
    book.take(index)


def positions_before_settlement(book,vm,accounts):
    trade(book,vm,accounts,[1,1],1)
    trade(book,vm,accounts,[1,0],1)
    trade(book,vm,accounts,[1,0],1,maker=1)
    trade(book,vm,accounts,[0,1],2)


def test_atomic_basket_uses_portfolio_not_standalone_reserve(book,direct_vm,direct_accounts):
    compile_book(book,direct_vm)
    trade(book,direct_vm,direct_accounts,[1,1],1)
    state=book.get_state()
    assert state['book']['credits']==[11,9]
    assert state['book']['positions']==[[-1,-1],[1,1]]
    assert state['risk'][0]=={'pnl':[-6,-6,-6],'required':6,'standalone':12,'headroom':5}


def test_exact_boundary_and_rejected_excess_are_atomic(book,direct_vm,direct_accounts):
    compile_book(book,direct_vm)
    trade(book,direct_vm,direct_accounts,[1,1],1)
    trade(book,direct_vm,direct_accounts,[1,0],1)
    assert book.get_state()['risk'][0]['headroom']==0
    direct_vm.sender=direct_accounts[0]
    book.quote([1,0],0)
    before=book.get_state()
    direct_vm.sender=direct_accounts[1]
    with direct_vm.expect_revert('Insufficient scenario reserve'): book.take(2)
    assert book.get_state()==before
    assert before['book']['quotes'][2]['status']=='OPEN'


def test_reversing_trade_releases_headroom(book,direct_vm,direct_accounts):
    compile_book(book,direct_vm)
    trade(book,direct_vm,direct_accounts,[1,1],1)
    trade(book,direct_vm,direct_accounts,[1,0],1)
    trade(book,direct_vm,direct_accounts,[1,0],1,maker=1)
    assert book.get_state()['book']['positions']==[[-1,-1],[1,1]]
    assert book.get_state()['risk'][0]['headroom']==5


@pytest.mark.parametrize('mode,expected',[('calm',[7,13]),('surge',[1,19]),('offline',[1,19])])
def test_mode_consensus_causes_actual_credit_transfers(book,direct_vm,direct_accounts,mode,expected):
    compile_book(book,direct_vm)
    positions_before_settlement(book,direct_vm,direct_accounts)
    direct_vm.sender=direct_accounts[0]
    book.quote([1,0],0)
    mocks(direct_vm,'report-draft')
    before=book.get_state()['book']
    book.resolve()
    assert direct_vm.run_validator() is True
    assert book.get_state()['phase']=='OPEN'
    assert book.get_state()['book']['credits']==before['credits']
    assert book.get_state()['book']['positions']==before['positions']
    mocks(direct_vm,'report-final',decision={'finality':'FINAL','mode':mode,'anchors':[0]})
    book.resolve()
    assert direct_vm.run_validator() is True
    state=book.get_state()
    assert state['phase']=='SETTLED' and state['book']['credits']==expected
    assert state['book']['positions']==[[0,0],[0,0]]
    assert state['book']['quotes'][-1]['status']=='VOID'
    assert sum(state['book']['settlement']['adjustments'])==0
    with direct_vm.expect_revert('Book not open'): book.resolve()


def test_unknown_payoff_blocks_trading(direct_deploy,direct_vm,direct_accounts):
    contract=direct_deploy(str(SOURCE),*arguments(direct_accounts,terms='terms-unknown'))
    mocks(direct_vm,'terms-unknown')
    contract.compile_terms()
    assert direct_vm.run_validator() is True
    assert contract.get_state()['phase']=='REVIEW'
    with direct_vm.expect_revert('Book not open'): contract.quote([1,1],1)
    assert contract.get_state()['book']['credits']==[10,10]


def test_exhausted_pending_reports_block_without_settlement(direct_deploy,direct_vm,direct_accounts):
    contract=direct_deploy(str(SOURCE),*arguments(direct_accounts,reports=('report-draft',)))
    compile_book(contract,direct_vm)
    trade(contract,direct_vm,direct_accounts,[1,1],1)
    direct_vm.sender=direct_accounts[0]
    contract.quote([1,0],0)
    before=contract.get_state()['book']
    mocks(direct_vm,'report-draft');contract.resolve()
    assert direct_vm.run_validator() is True
    state=contract.get_state()
    assert state['phase']=='BLOCKED' and state['book']['settlement']=={}
    assert state['book']['credits']==before['credits'] and state['book']['positions']==before['positions']
    assert state['book']['quotes'][-1]['status']=='VOID'


def test_wallet_authority_self_take_and_cancellation(book,direct_vm,direct_accounts):
    compile_book(book,direct_vm)
    direct_vm.sender=direct_accounts[2]
    with direct_vm.expect_revert('Participant only'): book.quote([1,0],1)
    direct_vm.sender=direct_accounts[0];book.quote([1,0],1)
    with direct_vm.expect_revert('Counterparty acceptance'): book.take(0)
    direct_vm.sender=direct_accounts[1]
    with direct_vm.expect_revert('Maker only'): book.cancel(0)
    direct_vm.sender=direct_accounts[0];book.cancel(0)
    with direct_vm.expect_revert('Quote not open'): book.take(0)


@pytest.mark.parametrize('quantities,premium',[([0,0],0),([4,0],0),([1],0),([True,0],0),([1,0],11),([1,0],True)])
def test_invalid_quote(book,direct_vm,quantities,premium):
    compile_book(book,direct_vm)
    before=book.get_state()
    with direct_vm.expect_revert('Invalid basket'): book.quote(quantities,premium)
    assert book.get_state()==before


def test_quote_limit_and_compile_replay(book,direct_vm):
    compile_book(book,direct_vm)
    for _ in range(12): book.quote([1,0],0)
    with direct_vm.expect_revert('Quote limit'): book.quote([1,0],0)
    with direct_vm.expect_revert('already compiled'): book.compile_terms()


@pytest.mark.parametrize('j,s',list(itertools.product(range(2),range(3))))
def test_validator_independently_checks_every_payoff_cell(book,direct_vm,j,s):
    compile_book(book,direct_vm)
    changed=[row.copy() for row in PAYOUTS]
    changed[j][s]=-1 if changed[j][s]==0 else 5
    mocks(direct_vm,decision=terms_decision(changed))
    assert direct_vm.run_validator() is False


@pytest.mark.parametrize('field,value',[('mode','calm'),('mode','UNKNOWN'),('finality','UNKNOWN')])
def test_validator_independently_checks_outcome_and_finality(book,direct_vm,field,value):
    compile_book(book,direct_vm)
    mocks(direct_vm,'report-draft');book.resolve()
    mocks(direct_vm,'report-final');book.resolve()
    changed={'finality':'FINAL','mode':'surge','anchors':[0]};changed[field]=value
    if changed['finality']!='FINAL': changed['mode']='UNKNOWN'
    mocks(direct_vm,'report-final',decision=changed)
    assert direct_vm.run_validator() is False


@pytest.mark.parametrize('kind',['terms-complete','report-draft'])
@pytest.mark.parametrize('audit',[{'decisions_correct':False,'anchors_support':True},
    {'decisions_correct':True,'anchors_support':False},{'decisions_correct':1,'anchors_support':True},
    {'decisions_correct':True},[]])
def test_substantive_anchor_and_decision_audit_required(book,direct_vm,kind,audit):
    compile_book(book,direct_vm)
    if kind.startswith('report'):
        mocks(direct_vm,kind);book.resolve()
    mocks(direct_vm,kind,audit=audit)
    assert direct_vm.run_validator() is False


@pytest.mark.parametrize('status',[404,429,500,503])
def test_failed_fetch_cannot_compile(book,direct_vm,status):
    mocks(direct_vm,status=status)
    with direct_vm.expect_revert(): book.compile_terms()
    assert book.get_state()['phase']=='UNCOMPILED'
    compile_book(book,direct_vm)


def test_commitment_mismatch_and_validator_refetch(book,direct_vm):
    mocks(direct_vm,corrupt=True)
    with direct_vm.expect_revert('commitment mismatch'): book.compile_terms()
    compile_book(book,direct_vm)
    mocks(direct_vm,corrupt=True)
    assert direct_vm.run_validator() is False


@pytest.mark.parametrize('decision',[{},[],{'rows':[]},{'rows':[False,False]}])
def test_invalid_model_shape(book,direct_vm,decision):
    mocks(direct_vm,decision=decision)
    with direct_vm.expect_revert('LLM_ERROR'): book.compile_terms()
    assert book.get_state()['compiled']=={}


@pytest.mark.parametrize('kind',['few-wallets','duplicate-wallet','zero-wallet','zero-credit','too-much-credit','branch','foreign','repeated-report'])
def test_invalid_constructor(direct_deploy,direct_accounts,kind):
    args=arguments(direct_accounts)
    if kind=='few-wallets': args[2]=args[2][:1]
    if kind=='duplicate-wallet': args[2]=[args[2][0]]*2
    if kind=='zero-wallet': args[2]=[bytes(20),args[2][1]]
    if kind=='zero-credit': args[3]=0
    if kind=='too-much-credit': args[3]=51
    if kind=='branch': args[4]=args[4].replace('a'*40,'main')
    if kind=='foreign': args[4]=args[4].replace(REPO,'somebody/vector-reserve')
    if kind=='repeated-report': args[6][1]=args[6][0]
    with pytest.raises(Exception,match=r'\[EXPECTED\]'): direct_deploy(str(SOURCE),*args)


def test_native_genvm_addresses(direct_deploy,direct_accounts,monkeypatch):
    from gltest.direct import loader
    original=loader._calldata_roundtrip_args
    def typed(args,kwargs):
        args,kwargs=original(args,kwargs)
        if len(args)==8:
            from genlayer import Address
            args=(*args[:2],[Address(a) for a in args[2]],*args[3:])
        return args,kwargs
    monkeypatch.setattr(loader,'_calldata_roundtrip_args',typed)
    contract=direct_deploy(str(SOURCE),*arguments(direct_accounts))
    assert contract.get_state()['configuration']['accounts']==['0x'+a.hex() for a in direct_accounts[:2]]


def risk_function():
    function=next(n for n in ast.parse(SOURCE.read_text()).body if isinstance(n,ast.FunctionDef) and n.name=='risk')
    namespace={}
    exec(compile(ast.Module(body=[function],type_ignores=[]),'<risk>','exec'),namespace)
    return namespace['risk']


def test_1024_payoff_tables_all_49_position_vectors_and_terminal_solvency():
    rng,calculate=random.Random(911),risk_function()
    for _ in range(1024):
        payouts=[[rng.randrange(10) for s in range(3)] for j in range(2)]
        for positions in itertools.product(range(-3,4),repeat=2):
            r=calculate(positions,payouts,10)
            terminal=[10+positions[0]*payouts[0][s]+positions[1]*payouts[1][s] for s in range(3)]
            assert (r['headroom']>=0)==all(x>=0 for x in terminal)
            assert r['standalone']>=r['required']>=0
            for cash in (r['required'],max(0,r['required']-1)):
                states=[cash+positions[0]*payouts[0][s]+positions[1]*payouts[1][s] for s in range(3)]
                assert all(x>=0 for x in states)==(cash>=r['required'])


@pytest.mark.parametrize('seed',range(8))
def test_random_sequential_trades_against_terminal_balance_oracle(book,direct_vm,direct_accounts,seed):
    compile_book(book,direct_vm)
    rng=random.Random(seed)
    for index in range(12):
        maker=rng.randrange(2);taker=1-maker
        quantities=[rng.randrange(-3,4),rng.randrange(-3,4)]
        if quantities==[0,0]: quantities[0]=1
        premium=rng.randrange(-10,11)
        direct_vm.sender=direct_accounts[maker];book.quote(quantities,premium)
        before=book.get_state();expected=json.loads(json.dumps(before['book']))
        expected['credits'][maker]+=premium;expected['credits'][taker]-=premium
        for j in range(2):
            expected['positions'][maker][j]-=quantities[j]
            expected['positions'][taker][j]+=quantities[j]
        acceptable=all(c>=0 for c in expected['credits']) and all(abs(q)<=6 for row in expected['positions'] for q in row) and all(
            expected['credits'][i]+sum(expected['positions'][i][j]*PAYOUTS[j][s] for j in range(2))>=0 for i in range(2) for s in range(3))
        direct_vm.sender=direct_accounts[taker]
        if acceptable:
            book.take(index)
            after=book.get_state()['book']
            assert after['credits']==expected['credits'] and after['positions']==expected['positions']
        else:
            with direct_vm.expect_revert(): book.take(index)
            assert book.get_state()==before


@pytest.mark.parametrize('raw',[b'not-json',b'[]',b'\xff',b' '*16001,
    b'{"series":"harbor-credits","series":"other","clauses":["Untrusted repeated metadata."]}',
    b'{"series":"other-series","clauses":["Wrong issuer series in this document."]}',
    b'{"series":"harbor-credits","clauses":[]}',
    json.dumps({'series':'harbor-credits','clauses':['x'*801]}).encode()])
def test_malformed_committed_sources_cannot_open_book(direct_deploy,direct_vm,direct_accounts,raw):
    args=arguments(direct_accounts);args[5]=hashlib.sha256(raw).hexdigest()
    contract=direct_deploy(str(SOURCE),*args)
    mocks(direct_vm,raw=raw)
    with direct_vm.expect_revert(): contract.compile_terms()
    assert contract.get_state()['phase']=='UNCOMPILED'
    assert contract.get_state()['book']['credits']==[10,10]


def test_full_cli_proof_plan_replayed_against_real_direct_state(book,direct_vm,direct_accounts):
    case=json.loads((ROOT/'config/scenarios.json').read_text())[0]
    def descriptor(name):
        url,digest,body=record(name)
        return {'url':url,'sha256':digest,'source':json.loads(body)}
    deployment={'callers':['0x'+a.hex() for a in direct_accounts[:3]],
                'sources':{'terms':descriptor(case['terms']),'reports':[descriptor(n) for n in case['reports']]}}
    output=subprocess.run(['node','-e',"console.log(JSON.stringify(require('./scripts/proof-checks.cjs').plan(require('./config/scenarios.json')[0])))"],cwd=ROOT,text=True,capture_output=True,check=True)
    trace=[];cursor=0
    for item in json.loads(output.stdout):
        direct_vm.sender=direct_accounts[item['caller']]
        if item['method']=='compile_terms': mocks(direct_vm)
        if item['method']=='resolve':
            mocks(direct_vm,case['reports'][cursor]);cursor+=1
        before=book.get_state()
        if item.get('error'):
            with direct_vm.expect_revert(item['error']): getattr(book,item['method'])(*item['args'])
        else:
            getattr(book,item['method'])(*item['args'])
            if item['method'] in ('compile_terms','resolve'): assert direct_vm.run_validator() is True
        trace.append({'item':item,'before':before,'after':book.get_state()})
    payload={'deployment':deployment,'trace':trace}
    script="""
const fs=require('node:fs'),p=require('./scripts/proof-checks.cjs'),{assert,equal}=require('./scripts/transport.cjs');
const x=JSON.parse(fs.readFileSync(0,'utf8')),c=p.cases[0];
assert(equal(x.trace[0].before,p.initial(c,x.deployment)),'Direct initial book');
for(const row of x.trace)p.replay(row.before,row.item,row.after,c,x.deployment);
p.final(c,x.trace.at(-1).after);console.log('Full direct/JavaScript replay passed');
"""
    subprocess.run(['node','-e',script],cwd=ROOT,input=json.dumps(payload),text=True,capture_output=True,check=True)
