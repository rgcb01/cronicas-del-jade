/* Crónicas del Jade — mobile-first UI/state for the first playable vertical slice. */
(function(){
  'use strict';
  const E=window.JadeEngine;
  const app=document.getElementById('app');
  const fmt=n=>Math.round(n).toLocaleString('es-MX');
  const iconRole={guardian:'🛡',duelist:'⚔',ranger:'🏹',assassin:'✦',mystic:'✧',strategist:'☯'};
  const factionShort={shogun:'Carmesí',celestial:'Cuatro Cielos',moon:'Luna Blanca'};
  const factionSymbols={shogun:'日',celestial:'龍',moon:'月'};
  const sample=['toru','hae','wei','kage','lin'];
  let playback=null;
  let lastBattle=null;
  let currentFrame=0;
  let speed=2;
  let rngState=42;
  function rnd(){rngState=(Math.imul(rngState,1664525)+1013904223)>>>0;return rngState/4294967296;}
  const randomChoice=arr=>arr[Math.floor(rnd()*arr.length)];
  const cap=()=>Math.min(9,3+Math.floor((state.round-1)/2));
  const owned=()=>[...state.bench,...state.board];
  let state={};
  function fresh(){
    rngState=20261124;
    state={version:1,round:1,gold:14,life:100,streak:0,shop:sample.slice(),shopLocked:false,
      bench:[],board:[],nextUid:1,enemy:[],selected:null,order:'defend',phase:'prep',result:null,battle:null,
      lastNotice:'Compra personajes en la tienda, colócalos en el tablero y comienza el combate.',log:[],wins:0,losses:0};
    state.enemy=makeEnemy();save();render();
  }
  function save(){
    try{let safe={...state,battle:null,selected:null};localStorage.setItem('cronicas-jade-v03',JSON.stringify({state:safe,rngState}));}catch(e){}
  }
  function restore(){
    try {const raw=localStorage.getItem('cronicas-jade-v03');if(!raw)return false;
      const obj=JSON.parse(raw);if(obj?.state?.version!==1||!Array.isArray(obj.state.board))return false;
      state=obj.state;rngState=obj.rngState>>>0;
      if(state.phase==='battle')state.phase='prep';state.battle=null;state.selected=null;return true;
    }catch(e){return false;}
  }
  function pickCatalog(){
    const weights=state.round<3?[58,32,10,0,0]:state.round<6?[42,32,18,7,1]:state.round<10?[25,33,25,14,3]:[16,26,28,21,9];
    const n=rnd()*100;let p=0,cost=1;
    for(let i=0;i<5;i++){p+=weights[i];if(n<p){cost=i+1;break;}}
    return randomChoice(E.units.filter(u=>u.cost===cost)).id;
  }
  function fillShop(){state.shop=Array.from({length:5},pickCatalog);}
  function makeEnemy(){
    const count=Math.min(9,Math.max(2,2+Math.floor((state.round+1)/2)));
    const pool=E.units.filter(u=>u.cost<=Math.min(5,2+Math.floor(state.round/3)));
    const faction=['shogun','celestial','moon'][(state.round-1)%3];
    const result=[],used=new Set();
    const candidates=[...pool.filter(x=>x.faction===faction),...pool.filter(x=>x.faction!==faction)];
    for(let i=0;i<count;i++){
      const preferred=candidates.filter(x=>!used.has(x.id));
      const candidate=randomChoice(preferred.length?preferred:candidates);used.add(candidate.id);
      const row=['guardian','duelist','assassin'].includes(candidate.role)?2:0;
      const places=[];
      for(let y=0;y<4;y++)for(let x=0;x<7;x++)if(!result.some(u=>u.x===x&&u.y===y)){
        places.push({x,y,score:Math.abs(x-3)*.7+Math.abs(y-row)*3+rnd()*.15});
      }
      places.sort((a,b)=>a.score-b.score);
      result.push({id:candidate.id,star:state.round>=8&&i<Math.floor(state.round/5)?2:1,x:places[0].x,y:places[0].y,uid:'e'+state.round+'-'+i});
    }
    return result;
  }
  function notify(text){state.lastNotice=text;save();render();}
  function stock(p){const t=E.byId[p.id];return t.cost*(p.star===3?9:p.star===2?3:1);}
  function removeUid(uid){
    const a=state.bench.findIndex(p=>p.uid===uid);if(a!==-1)return state.bench.splice(a,1)[0];
    const b=state.board.findIndex(p=>p.uid===uid);if(b!==-1)return state.board.splice(b,1)[0];
    return null;
  }
  function merge(){
    let changed=true;
    while(changed){changed=false;
      for(const type of E.units){
        for(const star of [1,2]){
          const copies=owned().filter(p=>p.id===type.id&&p.star===star);
          if(copies.length<3)continue;
          const keep=copies.find(p=>state.board.includes(p))||copies[0];
          const position=keep.x!=null?{x:keep.x,y:keep.y}:{};
          for(const p of copies.slice(0,3))removeUid(p.uid);
          const upgraded={id:type.id,star:star+1,uid:'p'+state.nextUid++,...position};
          if(position.x!==undefined)state.board.push(upgraded);else state.bench.push(upgraded);
          state.lastNotice=`¡${type.name} ascendió a ${star+1} estrellas!`;
          state.selected=null;changed=true;break;
        }
        if(changed)break;
      }
    }
  }
  function purchase(index){
    if(state.phase!=='prep')return;
    const id=state.shop[index],u=E.byId[id];if(!u)return;
    if(state.gold<u.cost)return notify('No tienes suficiente oro.');
    if(state.bench.length>=9)return notify('La reserva está llena: despliega, combina o vende una unidad.');
    state.gold-=u.cost;state.shop[index]=null;
    state.bench.push({id,uid:'p'+state.nextUid++,star:1});
    state.lastNotice=`${u.name} se une a tu ejército.`;
    merge();save();render();
  }
  function reroll(){
    if(state.phase!=='prep')return;
    if(state.gold<2)return notify('Necesitas 2 monedas para actualizar la tienda.');
    state.gold-=2;fillShop();state.lastNotice='La tienda ofrece nuevos personajes.';save();render();
  }
  function sell(){
    if(state.phase!=='prep'||!state.selected)return;
    const p=owned().find(x=>x.uid===state.selected);if(!p)return;
    state.gold+=stock(p);removeUid(p.uid);state.selected=null;
    state.lastNotice=`Vendiste a ${E.byId[p.id].name} por ${stock(p)} monedas.`;
    save();render();
  }
  function cellClick(x,y){
    if(state.phase!=='prep'||y<4)return;
    const occupant=state.board.find(p=>p.x===x&&p.y===y);
    if(!state.selected){if(occupant)state.selected=occupant.uid;save();render();return;}
    const selected=owned().find(p=>p.uid===state.selected);
    if(!selected){state.selected=null;render();return;}
    if(occupant?.uid===selected.uid){state.selected=null;render();return;}
    if(state.bench.includes(selected) && state.board.length>=cap() && !occupant){return notify(`Límite actual: ${cap()} unidades desplegadas.`);}
    const wasBoard=state.board.includes(selected);
    if(occupant){
      if(wasBoard){const old={x:selected.x,y:selected.y};occupant.x=old.x;occupant.y=old.y;selected.x=x;selected.y=y;}
      else {removeUid(occupant.uid);delete occupant.x;delete occupant.y;state.bench.push(occupant);
        removeUid(selected.uid);selected.x=x;selected.y=y;state.board.push(selected);}
    }else{
      if(!wasBoard){removeUid(selected.uid);selected.x=x;selected.y=y;state.board.push(selected);}
      else{selected.x=x;selected.y=y;}
    }
    state.selected=null;state.lastNotice=`Formación actualizada.`;save();render();
  }
  function benchClick(uid){
    if(state.phase!=='prep')return;
    state.selected=state.selected===uid?null:uid;save();render();
  }
  function retire(){
    if(state.phase!=='prep'||!state.selected)return;
    const p=state.board.find(x=>x.uid===state.selected);
    if(!p)return;
    if(state.bench.length>=9)return notify('No hay espacio en la reserva.');
    removeUid(p.uid);delete p.x;delete p.y;state.bench.push(p);state.selected=null;
    save();render();
  }
  function autoPlace(){
    if(state.phase!=='prep')return;
    const rolePriority={guardian:0,duelist:1,assassin:2,ranger:3,mystic:4,strategist:5};
    const pool=state.bench.slice();
    const counts={};for(const p of state.board){const role=E.byId[p.id].role;counts[role]=(counts[role]||0)+1;}
    let slots=cap()-state.board.length,n=0;
    while(slots>0&&pool.length){
      pool.sort((a,b)=>{
        const ua=E.byId[a.id],ub=E.byId[b.id];
        return (counts[ua.role]||0)-(counts[ub.role]||0)||rolePriority[ua.role]-rolePriority[ub.role]||ub.cost-ua.cost;
      });
      const p=pool.shift(),unit=E.byId[p.id],role=unit.role;
      const preferred=['guardian','duelist','assassin'].includes(role)?5:7;
      const candidates=[];
      for(let y=4;y<8;y++)for(let x=0;x<7;x++)if(!state.board.some(o=>o.x===x&&o.y===y)){
        candidates.push({x,y,score:Math.abs(y-preferred)*4+Math.abs(x-(3+((n%2)?-1:1)*Math.ceil(n/2)))+.03*rnd()});
      }
      candidates.sort((a,b)=>a.score-b.score);if(!candidates.length)break;
      removeUid(p.uid);p.x=candidates[0].x;p.y=candidates[0].y;state.board.push(p);n++;slots--;
      counts[role]=(counts[role]||0)+1;
    }
    state.selected=null;state.lastNotice=n?`Se desplegaron ${n} unidades.`:'No hay unidades nuevas para desplegar.';
    save();render();
  }
  function beginCombat(){
    if(state.phase!=='prep'||!state.board.length)return notify('Despliega al menos una unidad para comenzar.');
    state.selected=null;
    try{state.battle=E.simulateBattle(state.board,state.enemy,{order:state.order,seed:(state.round*4891+2026)>>>0});}
    catch(e){return notify('No se pudo resolver el combate: '+e.message);}
    lastBattle=state.battle;
    state.phase='battle';currentFrame=0;speed=2;
    if(playback)clearInterval(playback);
    playback=setInterval(()=>{currentFrame+=speed/2;
      if(currentFrame>=state.battle.frames.length-1){currentFrame=state.battle.frames.length-1;endCombat();return;}
      render();
    },100);
    render();
  }
  function endCombat(){
    if(state.phase!=='battle'&&state.phase!=='replay')return;
    if(playback){clearInterval(playback);playback=null;}
    if(state.phase==='replay'){state.phase='result';state.battle=null;render();return;}
    const b=state.battle;
    state.phase='result';state.result={winner:b.winner,time:b.time,stats:b.stats,survivors:b.survivors};
    if(b.winner===0){state.wins++;state.streak=Math.max(1,state.streak+1);}
    else if(b.winner===1){state.losses++;state.streak=Math.min(-1,state.streak-1);const count=b.survivors.filter(a=>a.owner===1).length;state.life=Math.max(0,state.life-(5+2*count));}
    else state.streak=0;
    const interest=Math.min(3,Math.floor(state.gold/10));
    const streakBonus=Math.abs(state.streak)>=3?2:Math.abs(state.streak)>=2?1:0;
    const income=5+interest+streakBonus+(b.winner===0?1:0);
    state.gold+=income;state.result.income=income;
    state.lastNotice=b.winner===0?'Victoria. Tu ejército resistió.':b.winner===1?'Derrota. Prepara una formación mejor para la siguiente ronda.':'Empate. Los dos ejércitos han caído.';
    state.battle=null;save();render();
  }
  function replay(){
    if(state.phase!=='result'||!lastBattle)return;
    state.battle=lastBattle;state.phase='replay';currentFrame=0;speed=2;
    if(playback)clearInterval(playback);
    playback=setInterval(()=>{currentFrame+=speed/2;if(currentFrame>=state.battle.frames.length-1){currentFrame=state.battle.frames.length-1;endCombat();return;}render();},100);
    render();
  }
  function nextRound(){
    if(state.phase!=='result')return;
    lastBattle=null;
    if(state.life<=0){state.phase='gameover';save();render();return;}
    state.round++;
    if(!state.shopLocked)fillShop();
    state.enemy=makeEnemy();state.result=null;state.phase='prep';state.selected=null;
    state.lastNotice=`Ronda ${state.round}: el ejército rival ha cambiado.`;
    save();render();
  }
  function unitChip(p,selected=false,enemy=false){
    const u=E.byId[p.id],st=p.star||1;
    return `<span class="miniature faction-${u.faction} ${selected?'selected':''} ${enemy?'foe':''}" title="${u.name} · ${E.roleNames[u.role]}" aria-label="${u.name}, ${st} estrella${st>1?'s':''}"><span class="mini-glyph">${u.icon}</span><span class="mini-star">${'✦'.repeat(st)}</span></span>`;
  }
  function battleChip(actor){
    const u=E.byId[actor.uid.startsWith('decoy-')?'duri':E.units.find(x=>x.name===actor.name)?.id]||E.byId[actor.uid.split('-').at(-1)]||E.byId.toru;
    const hpPct=Math.max(0,Math.round(actor.hp/actor.maxHp*100));
    const manaPct=Math.min(100,Math.round(actor.mana));
    return `<span class="battle-piece faction-${u.faction} ${actor.owner?'foe':''} ${actor.summon?'decoy':''}" title="${actor.name}: ${actor.hp}/${actor.maxHp} PV"><span class="battle-glyph">${actor.icon}</span><span class="piece-hp"><i style="width:${hpPct}%"></i></span><span class="piece-mana"><i style="width:${manaPct}%"></i></span></span>`;
  }
  function displayTeam(){
    const battle=state.phase==='battle'||state.phase==='replay',frame=battle?state.battle.frames[Math.min(Math.floor(currentFrame),state.battle.frames.length-1)]:null;
    const occupied=Array.from({length:56},()=>null);
    if(battle){for(const a of frame.actors)occupied[a.y*7+a.x]={mode:'battle',p:a};}
    else{for(const p of [...state.board,...state.enemy])occupied[p.y*7+p.x]={mode:'prep',p};}
    let html='';
    for(let y=0;y<8;y++)for(let x=0;x<7;x++){
      const cell=occupied[y*7+x],isPlayer=y>=4,selected=cell?.p?.uid===state.selected;
      html+=`<button class="square ${isPlayer?'square-own':'square-enemy'} ${(x+y)%2?'alt':''} ${selected?'active':''}" ${!battle&&isPlayer?`data-act="cell" data-x="${x}" data-y="${y}"`:''} type="button" aria-label="Casilla ${x+1},${y+1}${cell?', '+(cell.mode==='battle'?cell.p.name:E.byId[cell.p.id].name):''}">${cell?(cell.mode==='battle'?battleChip(cell.p):unitChip(cell.p,selected,!isPlayer)):''}</button>`;
    }
    return `<div class="board-wrap"><div class="battlefield"><div class="field-top">ENEMIGO</div><div class="board">${html}</div><div class="field-bottom">TU EJÉRCITO</div></div></div>`;
  }
  function shopCard(id,index){
    if(id==null)return `<div class="shop-card empty"><span>Adquirido</span></div>`;
    const u=E.byId[id],disabled=state.gold<u.cost;
    return `<button type="button" class="shop-card faction-${u.faction}" data-act="buy" data-idx="${index}" ${disabled?'disabled':''}>
      <span class="shop-portrait">${u.icon}<small>${factionSymbols[u.faction]}</small></span>
      <span class="shop-title">${u.name}</span><span class="shop-role">${E.roleNames[u.role]}</span>
      <span class="shop-cost"><span>◈</span> ${u.cost}</span>
    </button>`;
  }
  function benches(){
    let html='';for(let i=0;i<9;i++){
      const p=state.bench[i];html+=`<button type="button" class="bench-slot ${p?.uid===state.selected?'active':''}" ${p?`data-act="select" data-id="${p.uid}"`:''} aria-label="${p?E.byId[p.id].name:'Hueco vacío'}">${p?unitChip(p,p.uid===state.selected):'<span class="slot-empty">+</span>'}</button>`;
    }
    return html;
  }
  function synergies(){
    const placed=state.board.map(p=>({...p,...E.byId[p.id],catalog:p.id}));
    const b=E.teamBonuses(placed,0);
    const factionItems=Object.entries(E.factionNames).map(([id,name])=>{
      const n=b.factions[id]||0,need=n>=4?4:n>=2?2:0;
      return `<div class="synergy ${need?'on':''}"><span class="syn-icon faction-text-${id}">${factionSymbols[id]}</span><span class="syn-name">${name}</span><span class="syn-count">${n} / ${n<2?2:n<4?4:4} ${need?'✦':''}</span></div>`;
    }).join('');
    const roleItems=Object.entries(E.roleNames).filter(([id])=>(b.roles[id]||0)>0).map(([id,name])=>{
      const n=b.roles[id]||0;
      return `<div class="synergy ${n>=2?'on':''}"><span class="syn-icon">${iconRole[id]}</span><span class="syn-name">${name}</span><span class="syn-count">${n} / 2 ${n>=2?'✦':''}</span></div>`;
    }).join('');
    return factionItems+(roleItems?'<div class="mini-divider"></div>'+roleItems:'');
  }
  function selectedInfo(){
    const p=owned().find(p=>p.uid===state.selected);
    if(!p)return `<div class="help-box"><p><strong>Cómo jugar</strong></p><p>1. Compra unidades en la tienda.</p><p>2. Toca una unidad en la reserva y después una casilla verde.</p><p>3. Elige una orden y comienza el combate.</p><p>4. Combina tres copias iguales para subir una estrella.</p></div>`;
    const u=E.byId[p.id],hp=Math.round(u.hp*[1,1.8,3][p.star-1]),attack=Math.round(u.atk*[1,1.5,2.25][p.star-1]);
    return `<div class="unit-profile"><div class="profile-icon faction-${u.faction}">${u.icon}</div><div><div class="profile-name">${u.name} <span>${'✦'.repeat(p.star)}</span></div><div class="subtext">${u.subtitle}</div><div class="subtext">${factionShort[u.faction]} · ${E.roleNames[u.role]}</div></div></div>
      <div class="stats"><span>♥ ${fmt(hp)} PV</span><span>⚔ ${attack} ATQ</span><span>⬡ ${u.armor} ARM</span><span>✧ ${u.res} RES</span><span>◎ ${u.range} rango</span><span>↗ ${u.rate}/s</span></div>
      <div class="skill-desc"><strong>${u.skill}</strong><span>${skillExplain(u.id)}</span></div>
      <div class="profile-actions"><button type="button" class="secondary-btn" data-act="retire" ${state.board.some(x=>x.uid===p.uid)?'':'disabled'}>Retirar</button><button type="button" class="secondary-btn danger-text" data-act="sell">Vender +${stock(p)} ◈</button></div>`;
  }
  function skillExplain(id){return ({toru:'Golpea y obtiene un escudo temporal.',kage:'Se desliza hacia un enemigo vulnerable de la retaguardia.',akira:'Corte poderoso seguido de una postura de contraataque.',natsumi:'Sello mágico que silencia a los enemigos cercanos.',wei:'Lanza al enemigo hacia atrás cuando es posible.',lin:'Dispara tres flechas seguidas.',jian:'Golpe espiritual y escudo personal.',mei:'Invoca una lluvia de estrellas en área.',hae:'Dispara una flecha que ralentiza.',seo:'Atraviesa al enemigo y reduce su velocidad de ataque.',duri:'Invoca un señuelo que provoca enemigos.',yun:'Cura, escuda y purifica a tres aliados.'})[id];}
  function battleLog(){
    const b=state.battle;
    if(!b)return '';
    const frame=b.frames[Math.min(Math.floor(currentFrame),b.frames.length-1)],visible=b.events.filter(ev=>ev.t<=frame.t);
    return `<div class="combat-log">${visible.slice(-6).reverse().map(ev=>`<div><span>${ev.t.toFixed(1)}s</span> ${ev.text}</div>`).join('')||'<div>Los ejércitos se acercan...</div>'}</div>`;
  }
  function result(){
    const r=state.result,w=r?.winner;
    if(!r)return '';
    return `<section class="result-panel ${w===0?'win':w===1?'loss':'draw'}"><div class="result-symbol">${w===0?'✦':w===1?'⚔':'◌'}</div><h2>${w===0?'Victoria':w===1?'Derrota':'Empate'}</h2><p>${w===0?'Tus formaciones prevalecieron.':w===1?'Tu ejército ha caído.':'Ningún ejército sobrevivió.'}</p>
      <div class="result-grid"><div><strong>${r.time.toFixed(1)}s</strong><span>Duración</span></div><div><strong>${fmt(r.stats.damage[0])}</strong><span>Daño infligido</span></div><div><strong>${fmt(r.stats.damage[1])}</strong><span>Daño recibido</span></div><div><strong>+${r.income} ◈</strong><span>Ingreso</span></div></div>
      <div class="result-buttons">${lastBattle?'<button class="secondary-btn" type="button" data-act="replay">↻ Repetición</button>':''}<button class="primary-btn" type="button" data-act="next">${state.life<=0?'Ver resultado final':'Siguiente ronda →'}</button></div></section>`;
  }
  function render(){
    if(!app)return;
    const battle=state.phase==='battle'||state.phase==='replay', prep=state.phase==='prep', gameover=state.phase==='gameover';
    const frame=battle?state.battle.frames[Math.min(Math.floor(currentFrame),state.battle.frames.length-1)]:null;
    app.innerHTML=`<div class="shell">
      <header class="masthead"><div class="brand"><div class="brand-seal">玉</div><div><div class="eyebrow">EL CIELO FRAGMENTADO</div><h1>Crónicas <em>del Jade</em></h1></div></div><div class="build-tag">PROTOTIPO 0.3.0 · COMBATE TÁCTICO</div></header>
      <div class="hud"><div class="hud-unit"><span>RONDA</span><strong>${state.round}</strong></div><div class="hud-unit life"><span>VIDA</span><strong>♥ ${state.life}</strong></div><div class="hud-unit money"><span>ORO</span><strong>◈ ${state.gold}</strong></div><div class="hud-unit"><span>DESPLIEGUE</span><strong>${state.board.length} / ${cap()}</strong></div><div class="hud-unit"><span>RÉCORD</span><strong>${state.wins}V · ${state.losses}D</strong></div></div>
      <main class="layout"><section class="main-panel">
        <div class="panel-heading"><div><div class="eyebrow">CAMPO DEL ASTROLABIO</div><h2>${battle?'Combate en curso':prep?'Preparación':gameover?'El Concilio ha terminado':'Resultado de la ronda'}</h2></div>${battle?`<div class="time-tag">${frame.t.toFixed(1)} s</div>`:`<span class="phase-indicator">${prep?'ESTRATEGIA':state.phase==='result'?'DESCANSO':'BATALLA'}</span>`}</div>
        ${displayTeam()}
        <div class="board-actions">${battle?`<div class="battle-controls"><span>Velocidad</span><button type="button" class="secondary-btn ${speed===1?'is-on':''}" data-act="speed" data-val="1">1×</button><button type="button" class="secondary-btn ${speed===2?'is-on':''}" data-act="speed" data-val="2">2×</button><button type="button" class="secondary-btn ${speed===4?'is-on':''}" data-act="speed" data-val="4">4×</button><button type="button" class="secondary-btn" data-act="skip">Saltar</button></div>`:prep?`<div class="order-control"><span>ESTANDARTE</span><div class="order-options">${[['defend','🛡 Defender'],['focus','◎ Concentrar'],['flank','↗ Flanquear']].map(([id,label])=>`<button type="button" class="order-btn ${state.order===id?'chosen':''}" data-act="order" data-val="${id}">${label}</button>`).join('')}</div></div><button class="primary-btn" type="button" data-act="fight" ${state.board.length===0?'disabled':''}>⚔ Iniciar combate</button>`:''}</div>
        ${battle?battleLog():''}${state.phase==='result'?result():''}${gameover?`<div class="gameover"><h2>Fin del recorrido</h2><p>Superaste ${state.round} rondas · ${state.wins} victorias</p><button type="button" class="primary-btn" data-act="new">Nueva partida</button></div>`:''}
      </section>
      <section class="shop-panel panel"><div class="panel-heading"><div><div class="eyebrow">RECLUTAMIENTO</div><h2>Tienda</h2></div><button type="button" class="secondary-btn" data-act="reroll" ${!prep||state.gold<2?'disabled':''}>↻ Renovar · 2 ◈</button></div>
        <div class="shop-grid">${state.shop.map((s,i)=>shopCard(s,i)).join('')}</div>
        <div class="section-heading"><h3>Reserva</h3><span>${state.bench.length} / 9</span></div><div class="bench">${benches()}</div>
        <div class="hint">Toca una figura y después una casilla verde para colocarla. Puedes intercambiar posiciones.</div>
        <button type="button" class="secondary-btn full" data-act="auto" ${!prep?'disabled':''}>↥ Colocar automáticamente</button>
        <div class="section-heading"><h3>Unidad seleccionada</h3></div>${selectedInfo()}
      </section>
      <section class="side-panel panel"><div class="panel-heading"><div><div class="eyebrow">TU EJÉRCITO</div><h2>Sinergias</h2></div></div>
        <div class="synergy-list">${synergies()}</div>
        <div class="section-heading"><h3>Rival de la ronda</h3><span>${state.enemy.length} unidades</span></div><p class="subtext">${E.factionNames[['shogun','celestial','moon'][(state.round-1)%3]]} lidera el ejército contrario.</p>
        <div class="section-heading"><h3>Crónica de batalla</h3></div><p class="subtext">${state.lastNotice}</p>
        <details class="rules"><summary>Ver reglas rápidas</summary><p>La tienda cuesta de 1 a 5 monedas por figura. Tres copias de la misma unidad y estrella se fusionan; las estrellas aumentan vida, ataque y daño de habilidades. Las facciones y disciplinas otorgan sinergias, y las órdenes modifican el combate. Cada derrota reduce tu vida.</p><p>El tablero y el combate funcionan sin conexión. El arte 3D y el juego en línea todavía no están implementados.</p></details>
        <button type="button" class="restart-btn" data-act="new">↺ Reiniciar partida</button>
      </section></main>
      <footer>CRÓNICAS DEL JADE · Prototipo técnico independiente · Sin compras ni conexión requeridas</footer>
    </div>`;
  }
  app.addEventListener('click',ev=>{
    const el=ev.target.closest('[data-act]');if(!el||el.disabled)return;
    const act=el.dataset.act;
    switch(act){
      case 'buy':purchase(Number(el.dataset.idx));break;
      case 'reroll':reroll();break;
      case 'select':benchClick(el.dataset.id);break;
      case 'cell':cellClick(Number(el.dataset.x),Number(el.dataset.y));break;
      case 'auto':autoPlace();break;
      case 'sell':sell();break;
      case 'retire':retire();break;
      case 'order':state.order=el.dataset.val;save();render();break;
      case 'fight':beginCombat();break;
      case 'speed':speed=Number(el.dataset.val);render();break;
      case 'skip':endCombat();break;
      case 'replay':replay();break;
      case 'next':nextRound();break;
      case 'new':if(confirm('¿Comenzar una partida nueva? Se perderá el progreso actual.')){if(playback)clearInterval(playback);lastBattle=null;fresh();}break;
    }
  });
  if(!restore())fresh();else render();
  window.__jadeDebug={state:()=>state,engine:E,newGame:fresh,startBattle:beginCombat,endBattle:endCombat};
})();
