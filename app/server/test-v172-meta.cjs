'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const assert=require('assert');
const {MetaService,tierForElo,meetsThreshold,DEFAULT_START_BALANCE}=require('./meta-service.cjs');

let pass=0,fail=0;
function test(name,fn){
  try{fn();console.log('PASS - '+name);pass++}
  catch(e){console.log('FAIL - '+name+' :: '+(e&&e.message||e));fail++}
}
function tmpPath(tag){return path.join(os.tmpdir(),'g17-meta-test-'+tag+'-'+process.pid+'-'+Date.now()+'-'+Math.random().toString(16).slice(2)+'.json')}
function fresh(file){return new MetaService({enabled:true,file:file||tmpPath('scratch')})}

test('profil olustur - yeni hesap varsayilan degerlerle olusur',()=>{
  const m=fresh();
  const p=m.getProfile('acc-1',{displayName:'zeynep'});
  assert.strictEqual(p.accountId,'acc-1');
  assert.strictEqual(p.displayName,'zeynep');
  assert.strictEqual(p.avatar.initial,'Z');
  assert.ok(typeof p.avatar.color==='string'&&p.avatar.color.startsWith('#'));
  assert.strictEqual(p.elo,1000);
});

test('profil oku - ayni hesap tekrar cagrildiginda ayni kayit korunur',()=>{
  const m=fresh();
  const p1=m.getProfile('acc-2',{displayName:'Ali'});
  const p2=m.getProfile('acc-2',{displayName:'Ali'});
  assert.strictEqual(p1.createdAt,p2.createdAt);
  assert.strictEqual(p2.displayName,'Ali');
});

test('cuzdan baslangic bakiyesi sabit ve pozitif',()=>{
  const m=fresh();
  m.getProfile('acc-3',{displayName:'X'});
  assert.strictEqual(m.getWallet('acc-3').balance,DEFAULT_START_BALANCE);
});

test('cuzdan islemi bakiyeyi dogru arttirir',()=>{
  const m=fresh();
  m.getProfile('acc-4',{displayName:'X'});
  const before=m.getWallet('acc-4').balance;
  const r=m.applyWalletTx('acc-4',{txId:'tx-1',amount:500,reason:'test'});
  assert.strictEqual(r.ok,true);
  assert.strictEqual(r.balance,before+500);
});

test('ayni txId iki kez uygulanirsa bakiye TEK KEZ degisir',()=>{
  const m=fresh();
  m.getProfile('acc-5',{displayName:'X'});
  const before=m.getWallet('acc-5').balance;
  const r1=m.applyWalletTx('acc-5',{txId:'tx-dup',amount:300});
  const r2=m.applyWalletTx('acc-5',{txId:'tx-dup',amount:300});
  assert.strictEqual(r1.idempotent,false);
  assert.strictEqual(r2.idempotent,true);
  assert.strictEqual(m.getWallet('acc-5').balance,before+300);
});

test('yetersiz bakiye reddedilir',()=>{
  const m=fresh();
  m.getProfile('acc-6',{displayName:'X'});
  const before=m.getWallet('acc-6').balance;
  const r=m.applyWalletTx('acc-6',{txId:'tx-big-debit',amount:-(before+1000)});
  assert.strictEqual(r.ok,false);
  assert.strictEqual(r.err,'INSUFFICIENT_BALANCE');
});

test('bakiye asla negatif olamaz',()=>{
  const m=fresh();
  m.getProfile('acc-7',{displayName:'X'});
  const before=m.getWallet('acc-7').balance;
  m.applyWalletTx('acc-7',{txId:'tx-neg',amount:-(before+1)});
  const bal=m.getWallet('acc-7').balance;
  assert.ok(bal>=0);
  assert.strictEqual(bal,before);
});

test('islem defteri tutulur',()=>{
  const m=fresh();
  m.getProfile('acc-8',{displayName:'X'});
  m.applyWalletTx('acc-8',{txId:'tx-a',amount:10});
  m.applyWalletTx('acc-8',{txId:'tx-b',amount:20});
  assert.strictEqual(m.state.ledgers['acc-8'].length,2);
});

test('Elo->lig esik sinir degerleri dogru haritalanir',()=>{
  assert.strictEqual(tierForElo(0).key,'ACEMI');
  assert.strictEqual(tierForElo(999).key,'ACEMI');
  assert.strictEqual(tierForElo(1000).key,'BRONZ');
  assert.strictEqual(tierForElo(1199).key,'BRONZ');
  assert.strictEqual(tierForElo(1200).key,'GUMUS');
  assert.strictEqual(tierForElo(1449).key,'GUMUS');
  assert.strictEqual(tierForElo(1450).key,'ALTIN');
  assert.strictEqual(tierForElo(1699).key,'ALTIN');
  assert.strictEqual(tierForElo(1700).key,'ELMAS');
  assert.strictEqual(tierForElo(1999).key,'ELMAS');
  assert.strictEqual(tierForElo(2000).key,'SARAY');
  assert.strictEqual(tierForElo(9999).key,'SARAY');
});

test('salon giris esigi kontrolu dogru calisir',()=>{
  assert.strictEqual(meetsThreshold(1199,'GUMUS'),false);
  assert.strictEqual(meetsThreshold(1200,'GUMUS'),true);
  assert.strictEqual(meetsThreshold(2000,'SARAY'),true);
  assert.strictEqual(meetsThreshold(1999,'SARAY'),false);
});

test('turnuva bos durumda sahte veri uretmeden BOS liste doner',()=>{
  const m=fresh();
  assert.deepStrictEqual(m.listTournaments(),[]);
});

test('turnuva kayit+listeleme iskeleti calisir',()=>{
  const m=fresh();
  const t=m.createTournament({name:'Test Kupasi'});
  const r=m.registerForTournament(t.id,'acc-9');
  assert.strictEqual(r.ok,true);
  const list=m.listTournaments();
  assert.strictEqual(list.length,1);
  assert.strictEqual(list[0].participantCount,1);
  assert.strictEqual(list[0].name,'Test Kupasi');
});

test('yeniden yukleme sonrasi kalicilik korunur',()=>{
  const file=tmpPath('persist');
  try{
    const m1=fresh(file);
    m1.getProfile('acc-persist',{displayName:'Kalici'});
    const before=m1.getWallet('acc-persist').balance;
    m1.applyWalletTx('acc-persist',{txId:'tx-p1',amount:250});
    m1.createTournament({name:'Kalici Kupa'});

    const m2=fresh(file);
    const p=m2.getProfile('acc-persist');
    assert.strictEqual(p.displayName,'Kalici');
    assert.strictEqual(m2.getWallet('acc-persist').balance,before+250);
    const list=m2.listTournaments();
    assert.strictEqual(list.length,1);
    assert.strictEqual(list[0].name,'Kalici Kupa');
  }finally{
    try{fs.unlinkSync(file)}catch(_){}
  }
});

console.log('\nTOPLAM: '+pass+' PASS, '+fail+' FAIL');
if(fail>0)process.exit(1);
