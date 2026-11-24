const assert=require('node:assert/strict');
const E=require('../src/engine.js');
const unit=(id,x,y,owner=0,star=1,index=0)=>({id,x,y,star,uid:`${owner}-${id}-${index}`});
const test=(name,fn)=>{try{fn();console.log('✓ '+name);}catch(e){console.error('✗ '+name);throw e;}};

test('12 units; 3 factions; 6 roles',()=>{
  assert.equal(E.units.length,12);
  assert.deepEqual(new Set(E.units.map(u=>u.faction)).size,3);
  assert.deepEqual(new Set(E.units.map(u=>u.role)).size,6);
  assert.ok(E.units.every(u=>u.cost>=1&&u.cost<=5));
});
test('reject invalid deployment, duplicated squares and oversized armies',()=>{
  assert.throws(()=>E.simulateBattle([unit('akira',3,2)],[unit('jian',3,6,1)]));
  assert.throws(()=>E.simulateBattle([unit('akira',3,5),unit('wei',3,5)],[unit('jian',3,2,1)]));
  assert.throws(()=>E.simulateBattle(Array.from({length:10},(_,i)=>unit('toru',i%7,4+Math.floor(i/7),0,1,i)),[unit('jian',3,2,1)]));
  assert.throws(()=>E.simulateBattle([unit('akira',3,5)],[unit('jian',3,2,1)],{order:'invalid'}));
});
test('single-sided armies are resolved',()=>{
  assert.equal(E.simulateBattle([unit('akira',3,5)],[],{seed:1}).winner,0);
  assert.equal(E.simulateBattle([],[unit('jian',3,2,1)],{seed:1}).winner,1);
});
test('distinct catalog units trigger faction synergies',()=>{
  const t=[{owner:0,catalog:'toru',faction:'shogun',role:'guardian'}, {owner:0,catalog:'toru',faction:'shogun',role:'guardian'}, {owner:0,catalog:'kage',faction:'shogun',role:'assassin'}];
  const b=E.teamBonuses(t,0);
  assert.equal(b.factions.shogun,2);
  assert.equal(b.roles.guardian,1);
});
test('deterministic snapshots and logs for identical inputs and seed',()=>{
  const p=[unit('toru',3,5),unit('lin',4,7),unit('kage',2,5)];
  const e=[unit('wei',3,2,1),unit('hae',3,0,1),unit('seo',2,2,1)];
  const a=E.simulateBattle(p,e,{seed:727,order:'flank'});
  const b=E.simulateBattle(p,e,{seed:727,order:'flank'});
  assert.equal(JSON.stringify(a),JSON.stringify(b));
  assert.ok(a.frames.length>=5);
  assert.ok(a.events.some(ev=>ev.kind==='skill'));
});
test('every skill can resolve at least once in a sufficiently long engagement',()=>{
  const misses=[];
  for(const u of E.units){
    const r=E.simulateBattle([unit(u.id,3,5,0,1)], [unit('toru',3,2,1,3)],{seed:3,order:'defend'});
    if(!r.events.some(ev=>ev.kind==='skill'&&ev.uid===`0-${u.id}-0`))misses.push(u.id);
  }
  assert.deepEqual(misses,[],'Skills never used: '+misses.join(','));
});
test('sampled combat snapshots remain finite, bounded and collision-free',()=>{
  const ids=E.units.map(x=>x.id);
  for(let k=0;k<64;k++){
    const size=1+k%7;
    const p=Array.from({length:size},(_,i)=>unit(ids[(k+i*3)%ids.length],i%7,5+Math.floor(i/7),0,1,i));
    const e=Array.from({length:size},(_,i)=>unit(ids[(k+i*5+2)%ids.length],i%7,2-Math.floor(i/7),1,1,i));
    const r=E.simulateBattle(p,e,{seed:100+k,order:['defend','focus','flank'][k%3]});
    assert.ok(r.time>0&&r.time<=48.0);
    assert.ok([-1,0,1].includes(r.winner));
    assert.ok(r.frames.length>=1);
    for(const f of r.frames){
      const cells=new Set();
      for(const a of f.actors){
        assert.ok(a.x>=0&&a.x<7&&a.y>=0&&a.y<8,'out of bounds');
        assert.ok(Number.isFinite(a.hp)&&a.hp>=0&&a.hp<=a.maxHp,'invalid HP');
        const pos=a.x+','+a.y;
        assert.ok(!cells.has(pos),'two actors overlap: '+pos);
        cells.add(pos);
      }
    }
  }
});
console.log('ALL ENGINE TESTS PASSED');
