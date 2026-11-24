/* Crónicas del Jade — deterministic, dependency-free tactical combat core. */
(function (root) {
  'use strict';
  const WIDTH = 7, HEIGHT = 8, DT = 0.1, MAX_TICKS = 480;
  const factionNames = { shogun:'Shogunato Carmesí', celestial:'Cuatro Cielos', moon:'Luna Blanca' };
  const roleNames = { guardian:'Guardián', duelist:'Duelista', ranger:'Tirador', assassin:'Acechador', mystic:'Místico', strategist:'Estratega' };
  const units = [
    {id:'toru',name:'Toru',subtitle:'Lancero del Clan',faction:'shogun',role:'guardian',cost:1,hp:850,atk:43,armor:35,res:15,rate:.65,range:1,skill:'Lanza de Hierro',icon:'槍'},
    {id:'kage',name:'Kage',subtitle:'Sombra de la Bruma',faction:'shogun',role:'assassin',cost:2,hp:620,atk:62,armor:15,res:15,rate:1.05,range:1,skill:'Paso Sombrío',icon:'影'},
    {id:'akira',name:'Akira',subtitle:'Espada del Ocaso',faction:'shogun',role:'duelist',cost:3,hp:900,atk:65,armor:30,res:20,rate:.85,range:1,skill:'Corte del Ocaso',icon:'刀'},
    {id:'natsumi',name:'Natsumi',subtitle:'Tejedora de Sellos',faction:'shogun',role:'strategist',cost:4,hp:780,atk:55,armor:20,res:45,rate:.75,range:3,skill:'Sello de Silencio',icon:'符'},
    {id:'wei',name:'Wei',subtitle:'Piquero Imperial',faction:'celestial',role:'guardian',cost:1,hp:850,atk:44,armor:30,res:20,rate:.70,range:1,skill:'Empuje Imperial',icon:'衛'},
    {id:'lin',name:'Lin',subtitle:'Arquera de Jade',faction:'celestial',role:'ranger',cost:2,hp:570,atk:68,armor:10,res:20,rate:.95,range:4,skill:'Tres Flechas',icon:'弓'},
    {id:'jian',name:'Jian',subtitle:'Puño de la Montaña',faction:'celestial',role:'duelist',cost:3,hp:960,atk:58,armor:25,res:30,rate:.90,range:1,skill:'Palma Celestial',icon:'拳'},
    {id:'mei',name:'Mei',subtitle:'Astróloga de Jade',faction:'celestial',role:'mystic',cost:4,hp:650,atk:47,armor:15,res:40,rate:.65,range:4,skill:'Lluvia Celestial',icon:'星'},
    {id:'hae',name:'Hae',subtitle:'Arquera del Alba',faction:'moon',role:'ranger',cost:1,hp:550,atk:56,armor:10,res:25,rate:1.0,range:4,skill:'Flecha Lunar',icon:'弦'},
    {id:'seo',name:'Seo',subtitle:'Sombra del Palacio',faction:'moon',role:'assassin',cost:2,hp:640,atk:59,armor:15,res:25,rate:1.0,range:1,skill:'Eclipse Fugaz',icon:'月'},
    {id:'duri',name:'Duri',subtitle:'Bromista del Palacio',faction:'moon',role:'strategist',cost:3,hp:720,atk:52,armor:15,res:40,rate:.75,range:3,skill:'Travesura del Dokkaebi',icon:'鬼'},
    {id:'yun',name:'Yun',subtitle:'Voz de la Luna',faction:'moon',role:'mystic',cost:5,hp:850,atk:55,armor:20,res:55,rate:.70,range:4,skill:'Ritual de la Luna',icon:'祈'}
  ];
  const byId = Object.fromEntries(units.map(u => [u.id,u]));
  const gradeHP = [1,1.8,3], gradeAtk = [1,1.5,2.25];
  function rand(seed) {
    let x = (Number(seed) >>> 0) || 0xC0FFEE;
    return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) / 4294967296); };
  }
  const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  const adjacent=(a,b)=>dist(a,b)===1;
  const alive=a=>a && a.hp>0;
  const inBounds=(x,y)=>x>=0&&x<WIDTH&&y>=0&&y<HEIGHT;
  function teamBonuses(actors,owner) {
    const arr=actors.filter(a=>a.owner===owner&&!a.summon);
    const factions={},roles={};
    for(const a of arr){(factions[a.faction]??=new Set()).add(a.catalog);(roles[a.role]??=new Set()).add(a.catalog);}
    return {factions:Object.fromEntries(Object.entries(factions).map(([k,v])=>[k,v.size])),roles:Object.fromEntries(Object.entries(roles).map(([k,v])=>[k,v.size]))};
  }
  function createActor(u,owner,x,y,index) {
    const t=byId[u.id];
    if(!t||!Number.isInteger(x)||!Number.isInteger(y)||!inBounds(x,y)) throw Error('Invalid unit or square.');
    if(owner===0 && y<4 || owner===1 && y>3) throw Error('Unit must be deployed in its own half.');
    const star=Math.max(1,Math.min(3,Math.round(u.star||1)));
    const maxHp=Math.round(t.hp*gradeHP[star-1]);
    return {uid:u.uid||`${owner}-${index}-${t.id}`,catalog:t.id,owner,x,y,star,name:t.name,icon:t.icon,faction:t.faction,role:t.role,cost:t.cost,
      maxHp,hp:maxHp,atk:Math.round(t.atk*gradeAtk[star-1]),armor:t.armor,res:t.res,rate:t.rate,range:t.range,mana:0,
      shield:0,shieldParts:[],attackCd:0,moveCd:0,attackCount:0,duelTarget:null,duelHits:0,lastManaHit:-99,
      disabled:{},tauntId:null,tauntUntil:0,counterUntil:0,counterCd:0,healUsed:false,summon:false,expires:Infinity};
  }
  function statusLeft(a,type,time){return (a.disabled[type]||0)>time;}
  function getShield(a){return a.shieldParts.reduce((s,x)=>s+x.amount,0);}
  function addShield(a,amount,expires){if(amount>0)a.shieldParts.push({amount:Math.round(amount),expires});a.shield=getShield(a);}
  function removeExpiredShields(a,t){a.shieldParts=a.shieldParts.filter(s=>s.amount>0 && s.expires>t);a.shield=getShield(a);}
  function consumeShield(a,damage){let remain=damage;for(const sh of a.shieldParts){const take=Math.min(remain,sh.amount);sh.amount-=take;remain-=take;if(remain<=0)break;}a.shield=getShield(a);return remain;}
  function findNearestOpen(x,y,actors,owner,ignoreUid){
    const spots=[];
    for(let yy=0;yy<HEIGHT;yy++)for(let xx=0;xx<WIDTH;xx++){
      if(actors.some(a=>alive(a)&&a.uid!==ignoreUid&&a.x===xx&&a.y===yy))continue;
      spots.push({x:xx,y:yy,d:Math.abs(x-xx)+Math.abs(y-yy),rear:owner===0?yy:7-yy});
    }
    spots.sort((a,b)=>a.d-b.d||a.rear-b.rear||a.y-b.y||a.x-b.x);return spots[0]||null;
  }
  function formationBonuses(actors,owner){
    const team=actors.filter(a=>a.owner===owner&&!a.summon);
    const wall=new Set(),triad=new Set(),pinza=new Set();
    for(const a of team){
      if(a.role==='guardian'){const guards=team.filter(b=>b.role==='guardian'&&b.y===a.y);for(const g of guards){const triple=guards.filter(b=>Math.abs(b.x-g.x)<=1);if(triple.length>=3)for(const piece of triple)wall.add(piece.uid);}}
      const back=team.filter(b=>b.y===a.y+(owner===0?1:-1)&&Math.abs(b.x-a.x)===1);
      if(back.length===2){triad.add(back[0].uid);triad.add(back[1].uid);}
    }
    const mobiles=team.filter(a=>a.role==='assassin'||a.role==='ranger');
    if(mobiles.some(a=>a.x===0)&&mobiles.some(a=>a.x===6))for(const a of mobiles)if(a.x===0||a.x===6)pinza.add(a.uid);
    return {wall,triad,pinza};
  }
  function simulateBattle(playerUnits,enemyUnits,opts={}){
    const seed=Number(opts.seed??12345)>>>0, random=rand(seed), order=opts.order||'defend';
    if(!['defend','focus','flank'].includes(order))throw Error('Invalid order');
    if(!Array.isArray(playerUnits)||!Array.isArray(enemyUnits)||playerUnits.length>9||enemyUnits.length>9)throw Error('Invalid army size');
    const actors=[...playerUnits.map((u,i)=>createActor(u,0,u.x,u.y,i)),...enemyUnits.map((u,i)=>createActor(u,1,u.x,u.y,i))];
    if(new Set(actors.map(a=>a.x+','+a.y)).size!==actors.length)throw Error('Overlapping units');
    const initial=actors.map(a=>({uid:a.uid,catalog:a.catalog,owner:a.owner,x:a.x,y:a.y,star:a.star}));
    const bonus=[teamBonuses(actors,0),teamBonuses(actors,1)],formation=[formationBonuses(actors,0),formationBonuses(actors,1)];
    const events=[],frames=[],stats={damage:{0:0,1:0},healing:{0:0,1:0},skills:{0:0,1:0},kills:{0:0,1:0}};
    let nextId=0,time=0;
    function log(kind,text,uid=null,target=null){if(events.length<700)events.push({t:+time.toFixed(1),kind,text,uid,target});}
    function record(){
      frames.push({t:+time.toFixed(1),actors:actors.filter(a=>alive(a)).map(a=>({uid:a.uid,name:a.name,owner:a.owner,icon:a.icon,x:a.x,y:a.y,hp:Math.max(0,Math.round(a.hp)),maxHp:a.maxHp,shield:Math.round(a.shield),mana:Math.round(a.mana),star:a.star,summon:a.summon}))});
    }
    for(const a of actors){
      if(bonus[a.owner].roles.mystic>=2&&a.role==='mystic')a.mana=20;
      if(bonus[a.owner].factions.moon>=2&&a.faction==='moon')addShield(a,a.maxHp*.05,Infinity);
      if(a.owner===0&&order==='defend')addShield(a,a.maxHp*.10,5);
    }
    const focusTarget=order==='focus'?actors.filter(a=>a.owner===1).sort((a,b)=>a.maxHp-b.maxHp||a.uid.localeCompare(b.uid))[0]?.uid:null;
    if(focusTarget)log('order','Concentrar fuego: objetivo prioritario marcado.');
    if(order==='defend')log('order','Defender: escudos iniciales aplicados.');
    if(order==='flank')log('order','Flanquear: movilidad reforzada.');
    record();
    function teamHas(owner,role){return (bonus[owner].roles[role]||0)>=2;}
    function factionTier(owner,faction){const n=bonus[owner].factions[faction]||0;return n>=4?4:n>=2?2:0;}
    function factorSkill(a){return gradeAtk[a.star-1]*(a.faction==='celestial'&&factionTier(a.owner,'celestial')===4?1.1:1);}
    function queueDamage(queue,src,tgt,base,type='physical',basic=false){
      if(!tgt||!alive(tgt))return;
      let amount=base, boosted=false;
      if(src.owner===0&&focusTarget===tgt.uid&&time<=5){amount*=1.08;boosted=true;}
      if(basic&&src.faction==='shogun'&&factionTier(src.owner,'shogun')){
        src.attackCount++;
        if(src.attackCount%4===0)amount+=factionTier(src.owner,'shogun')===4?80:40;
      }
      if(basic&&src.role==='duelist'&&teamHas(src.owner,'duelist')){
        if(src.duelTarget===tgt.uid)src.duelHits++;else {src.duelTarget=tgt.uid;src.duelHits=1;}
        if(src.duelHits>=4){amount*=1.25;src.duelHits=0;}
      }
      queue.push({kind:'damage',src:src.uid,target:tgt.uid,base:amount,type,basic,boosted});
    }
    function queueHeal(queue,src,tgt,value){queue.push({kind:'heal',src:src.uid,target:tgt.uid,value});}
    function occupied(x,y,ignore){return actors.some(a=>alive(a)&&a.uid!==ignore&&a.x===x&&a.y===y);}
    function putStatus(target,type,duration){target.disabled[type]=Math.max(target.disabled[type]||0,time+duration);}
    function chooseTarget(a,enemy){
      if(a.tauntId&&a.tauntUntil>time){const taunt=enemy.find(b=>b.uid===a.tauntId&&alive(b));if(taunt)return taunt;}
      const sorted=enemy.filter(alive).map(t=>{
        const d=dist(a,t);let score=d*12+t.hp/t.maxHp*8+random()*.05;
        if(a.role==='assassin'){const rear=t.owner===0?t.y:7-t.y;score-=rear*3.5;if(t.role==='ranger'||t.role==='mystic'||t.role==='strategist')score-=8;}
        else if(a.role==='ranger')score+=t.role==='guardian'?3:0;
        else if(a.role==='guardian')score+=t.role==='assassin'?-5:0;
        if(a.owner===0&&focusTarget===t.uid&&time<=5)score-=15;
        return {t,score};
      }).sort((x,y)=>x.score-y.score||x.t.uid.localeCompare(y.t.uid));
      return sorted[0]?.t;
    }
    function moveToward(a,target){
      const dirs=[[0,-1],[-1,0],[1,0],[0,1]], visited=new Set([a.x+','+a.y]);
      const q=[{x:a.x,y:a.y,first:null,d:0}];
      for(let i=0;i<q.length;i++){
        const c=q[i];
        if(c.d>0&&Math.abs(c.x-target.x)+Math.abs(c.y-target.y)<=a.range)return c.first;
        for(const [dx,dy] of dirs){const x=c.x+dx,y=c.y+dy,k=x+','+y;
          if(!inBounds(x,y)||visited.has(k)||occupied(x,y,a.uid))continue;
          visited.add(k);q.push({x,y,first:c.first||{x,y},d:c.d+1});
        }
      }
      return null;
    }
    function useSkill(a,target,queue){
      if(!target||statusLeft(a,'silence',time)||statusLeft(a,'stun',time))return false;
      const scale=factorSkill(a), effects=teamHas(a.owner,'strategist')&&a.role==='strategist'?1.2:1;
      const enemies=actors.filter(t=>t.owner!==a.owner&&alive(t));
      const friends=actors.filter(t=>t.owner===a.owner&&alive(t));
      const dmg=(t,n,type='physical')=>queueDamage(queue,a,t,n*scale,type,false);
      switch(a.catalog){
        case 'toru':dmg(target,110);addShield(a,140*scale, time+4);break;
        case 'kage':{
          const rear=enemies.slice().sort((p,q)=>((a.owner===0?p.y:7-p.y)-(a.owner===0?q.y:7-q.y))||p.hp/p.maxHp-q.hp/q.maxHp)[0]||target;
          const spot=findNearestOpen(rear.x,rear.y,actors,a.owner,a.uid);
          if(spot&&dist(spot,rear)<=2){a.x=spot.x;a.y=spot.y;}
          dmg(rear,130);target=rear;break;
        }
        case 'akira':dmg(target,180);a.counterUntil=time+3;break;
        case 'natsumi':dmg(target,130,'magic');for(const e of enemies)if(dist(target,e)<=1)putStatus(e,'silence',1.5);break;
        case 'wei':{
          dmg(target,100);
          let dx= Math.sign(target.x-a.x),dy=Math.sign(target.y-a.y);
          if(Math.abs(target.x-a.x)>=Math.abs(target.y-a.y))dy=0;else dx=0;
          const nx=target.x+dx,ny=target.y+dy;
          if(inBounds(nx,ny)&&!occupied(nx,ny,target.uid)){target.x=nx;target.y=ny;}
          break;
        }
        case 'lin':for(let i=0;i<3;i++)dmg(target,60);break;
        case 'jian':dmg(target,150,'magic');addShield(a,90*scale,time+4);break;
        case 'mei':for(const e of enemies)if(dist(e,target)<=1)dmg(e,170,'magic');break;
        case 'hae':dmg(target,110);putStatus(target,'slow',3);break;
        case 'seo':{
          dmg(target,140);
          putStatus(target,'weaken',3);
          const dx=Math.sign(target.x-a.x),dy=Math.sign(target.y-a.y),nx=target.x+dx,ny=target.y+dy;
          if(inBounds(nx,ny)&&!occupied(nx,ny,a.uid)){a.x=nx;a.y=ny;}
          break;
        }
        case 'duri':{
          const front=enemies.slice().sort((u,v)=>dist(u,a)-dist(v,a)||u.uid.localeCompare(v.uid)).slice(0,2);
          const spot=findNearestOpen(a.x,a.y,actors,a.owner,null);
          if(spot){const hp=Math.round(220*scale*effects),uid='decoy-'+nextId++;
            const decoy={...a,uid,name:'Señuelo',icon:'◇',x:spot.x,y:spot.y,hp,maxHp:hp,atk:0,rate:0,mana:0,range:0,shield:0,shieldParts:[],summon:true,expires:time+3,attackCd:99,disabled:{},tauntId:null,tauntUntil:0};
            actors.push(decoy);for(const e of front){e.tauntId=uid;e.tauntUntil=time+3;}
          }
          break;
        }
        case 'yun':{
          const allies=friends.slice().sort((u,v)=>u.hp/u.maxHp-v.hp/v.maxHp||u.uid.localeCompare(v.uid)).slice(0,3);
          for(const f of allies){queueHeal(queue,a,f,230*scale);addShield(f,130*scale,time+5);f.disabled={};f.tauntUntil=0;}
          break;
        }
      }
      stats.skills[a.owner]++;
      a.mana=0;
      log('skill',`${a.name} usa ${byId[a.catalog].skill}.`,a.uid,target.uid);
      return true;
    }
    function processQueue(queue) {
      // Resolve individual strikes from the same frame against the pre-strike survivors.
      const hits=[];
      for(const e of queue){
        const target=actors.find(a=>a.uid===e.target),source=actors.find(a=>a.uid===e.src);
        if(!target||!source||!alive(target)||!alive(source))continue;
        if(e.kind==='heal') {hits.push({...e,value:Math.round(e.value)});continue;}
        let reduction= e.type==='true'?1:100/(100+Math.max(0,e.type==='magic'?target.res:target.armor));
        if(time<=5 && teamHas(target.owner,'guardian') && actors.some(g=>alive(g)&&g.owner===target.owner&&g.role==='guardian'&&g.uid!==target.uid&&adjacent(g,target)))reduction*=.92;
        if(formation[target.owner].wall.has(target.uid) && actors.filter(g=>alive(g)&&formation[target.owner].wall.has(g.uid)&&g.y===target.y).length>=3)reduction*=.90;
        hits.push({...e,value:Math.max(1,Math.ceil(e.base*reduction))});
      }
      // Both armies' actions for a tick go through even if their source dies during this resolution.
      const prevHp = new Map(actors.map(a=>[a.uid,a.hp]));
      for(const e of hits){
        const target=actors.find(a=>a.uid===e.target),source=actors.find(a=>a.uid===e.src);
        if(!target||!source)continue;
        if(e.kind==='heal'){
          const gained=Math.min(target.maxHp-target.hp,e.value);target.hp+=gained;stats.healing[source.owner]+=gained;continue;
        }
        const remaining=consumeShield(target,e.value),taken=Math.min(target.hp,remaining);target.hp-=taken;
        stats.damage[source.owner]+=Math.max(0,taken)+Math.max(0,e.value-remaining);
        if(time-target.lastManaHit>=.8){target.mana=Math.min(100,target.mana+6);target.lastManaHit=time;}
        if(e.basic){source.mana=Math.min(100,source.mana+12+(source.faction==='celestial'&&factionTier(source.owner,'celestial')>=2?3:0));}
        if(target.counterUntil>time&&e.basic&&target.uid!==source.uid&&time>=target.counterCd&&alive(target)){
          target.counterCd=time+.6;queueDamage(queue,target,source,45*gradeAtk[target.star-1]);
        }
      }
      // Retributions are not resolved recursively in the same tick.
      const casualties=actors.filter(a=>!alive(a)&&prevHp.get(a.uid)>0);
      for(const a of casualties){
        if(!a.summon){stats.kills[1-a.owner]++;log('kill',`${a.name} cae en combate.`,a.uid);}
      }
    }
    for(let tick=1;tick<=MAX_TICKS;tick++){
      time=Math.round(tick*DT*10)/10;
      for(const a of actors){if(!alive(a))continue;
        removeExpiredShields(a,time);
        if(a.summon&&a.expires<=time){a.hp=0;for(const e of actors)if(e.tauntId===a.uid)e.tauntUntil=0;}
      }
      const pAlive=actors.filter(a=>a.owner===0&&alive(a)&&!a.summon);
      const eAlive=actors.filter(a=>a.owner===1&&alive(a)&&!a.summon);
      if(!pAlive.length||!eAlive.length)break;
      const queue=[];
      // Alternating side priority for moves and actions limits positional first-mover advantage.
      const turn=actors.filter(a=>alive(a)&&!a.summon).sort((a,b)=>((a.owner+(tick%2))%2)-((b.owner+(tick%2))%2)||a.uid.localeCompare(b.uid));
      for(const a of turn){
        a.attackCd=Math.max(0,a.attackCd-DT);a.moveCd=Math.max(0,a.moveCd-DT);
        if(statusLeft(a,'stun',time))continue;
        const enemy=actors.filter(b=>b.owner!==a.owner&&alive(b));
        const target=chooseTarget(a,enemy);
        if(!target)continue;
        if(a.mana>=100&&!statusLeft(a,'silence',time)){
          if(useSkill(a,target,queue)){a.attackCd=Math.max(a.attackCd,.25);continue;}
        }
        if(dist(a,target)<=a.range){
          if(a.attackCd<=0.00001){
            queueDamage(queue,a,target,a.atk,'physical',true);
            let rate=a.rate;
            if(a.role==='ranger'&&teamHas(a.owner,'ranger'))rate*=1.15;
            if(formation[a.owner].triad.has(a.uid))rate*=1.08;
            if(statusLeft(a,'weaken',time))rate*=.8;
            a.attackCd=1/Math.max(.1,rate);
          }
        }else if(a.moveCd<=0.00001&&!statusLeft(a,'root',time)){
          const spot=moveToward(a,target);
          if(spot){a.x=spot.x;a.y=spot.y;
            let speed=1;
            if(statusLeft(a,'slow',time))speed*=.7;
            if(time<=5&&a.role==='assassin'&&teamHas(a.owner,'assassin'))speed*=1.2;
            if(time<=5&&a.owner===0&&order==='flank'&&(a.role==='assassin'||a.role==='ranger'))speed*=1.2;
            if(formation[a.owner].pinza.has(a.uid)&&time<=5)speed*=1.15;
            a.moveCd=.55/speed;
          }
        }
      }
      processQueue(queue);
      for(const a of actors){
        if(!alive(a)||a.summon)continue;
        if(a.faction==='moon'&&factionTier(a.owner,'moon')===4&&!a.healUsed&&a.hp/a.maxHp<.4){
          a.hp=Math.min(a.maxHp,a.hp+a.maxHp*.08);a.healUsed=true;log('heal',`${a.name} recibe la bendición lunar.`,a.uid);
        }
      }
      if(tick>=300){
        const damage=Math.ceil((tick-299)*.6);
        for(const a of actors)if(alive(a)&&!a.summon){a.hp=Math.max(0,a.hp-damage);}
      }
      if(tick%2===0)record();
    }
    const survivors=actors.filter(a=>alive(a)&&!a.summon);
    const playerLeft=survivors.filter(a=>a.owner===0),enemyLeft=survivors.filter(a=>a.owner===1);
    const winner=playerLeft.length&& !enemyLeft.length?0:enemyLeft.length&&!playerLeft.length?1:-1;
    record();
    log('end',winner===0?'¡Victoria del Portador!':winner===1?'El ejército rival ha vencido.':'El combate termina en empate.');
    return {seed,order,winner,time,initial,frames,events,stats,bonuses:bonus,formations:formation.map(f=>({wall:f.wall.size,triad:f.triad.size,pinza:f.pinza.size})),survivors:survivors.map(a=>({uid:a.uid,owner:a.owner,name:a.name,hp:Math.round(a.hp),maxHp:a.maxHp}))};
  }
  const API={WIDTH,HEIGHT,DT,units,byId,factionNames,roleNames,rand,simulateBattle,teamBonuses};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  root.JadeEngine=API;
})(typeof window!=='undefined'?window:globalThis);
