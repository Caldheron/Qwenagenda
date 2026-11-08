<script>
import {onMount} from 'svelte';
import {registerSW} from 'virtual:pwa-register';
import {load,save} from './db.js';
import * as L from './lib.js';
import I from './icons.js';
import Item from './Item.svelte';
const {iso,D,add,lab,cap,occ,st,late,cell,search,MOIS,JOURS}=L;
const T=L.TODAY();
let S={items:[],daily:[],checks:{}},ok=false,view='today',cur=T,from='',mm=D(T),dOpen=true;
let sh=null,so=null,act='',form={},msg='',canUndo=false,undoS=[],needUp=false,upd;
let fq='',fs='Tous',fper='Tout',fileEl;
$:list=occ(S.items,cur);
$:lateL=late(S.items,T);
$:wk=[0,1,2,3,4,5,6].map(i=>add(cur,i-(D(cur).getDay()+6)%7));
$:grid=(()=>{const y=mm.getFullYear(),m=mm.getMonth();return{off:(new Date(y,m,1,12).getDay()+6)%7,days:[...Array(new Date(y,m+1,0).getDate())].map((_,j)=>iso(new Date(y,m,j+1,12)))}})();
$:res=search(S.items,fq,fs,fper,T);
$:checked=S.checks[T]||[];
$:dur=form.end&&form.end>form.d?'Durée : '+(Math.round((D(form.end)-D(form.d))/864e5)+1)+' jours':'Un seul jour';

onMount(async()=>{
  const s=await load();
  if(s){S=s;S.items=S.items.filter(e=>!(e.del&&Date.now()-e.delAt>30*864e5))} // purge après 30 jours
  ok=true;upd=registerSW({onNeedRefresh(){needUp=true}});
});
function flash(m,u=false){msg=m;canUndo=u;clearTimeout(flash.t);flash.t=setTimeout(()=>msg='',4000)}
// Toute modification passe par commit : annulation (20 niveaux), sauvegarde, tampon modifié_le/révision
function commit(fn,m){
  const snap=JSON.stringify(S);undoS=[...undoS.slice(-19),snap];fn();
  const prev=new Map(JSON.parse(snap).items.map(e=>[e.id,JSON.stringify(e)]));
  for(const e of S.items){const q=prev.get(e.id);if(q!==JSON.stringify(e)){e.mod=Date.now();e.rev=(q?JSON.parse(q).rev||0:0)+1}}
  S=S;save(S);sh=null;if(m)flash(m,true);
}
function undo(){if(!undoS.length)return flash('Rien à annuler');S=JSON.parse(undoS.at(-1));undoS=undoS.slice(0,-1);save(S);sh=null;flash('Dernière modification annulée')}
const mark=o=>commit(()=>{o.e.sts[L.multi(o.e)?o.e.d:o.d]='done'},'Marquée comme faite');
const move=o=>commit(()=>{if(o.e.rec){o.e.skip.push(o.d);S.items.push({...o.e,id:L.uid(),d:T,rec:'',skip:[],sts:{}})}else{const n=L.multi(o.e)?Math.round((D(o.e.end)-D(o.e.d))/864e5):0;o.e.d=T;if(n)o.e.end=add(T,n);delete o.e.sts[o.d]}},'Reportée à aujourd’hui');
const del=(o,scope)=>commit(()=>{if(o.e.rec&&scope==='one')o.e.skip.push(o.d);else{o.e.del=1;o.e.delAt=Date.now()}},scope==='one'?'Ce rdv supprimé':'Supprimée');
const restore=e=>commit(()=>{e.del=0;delete e.delAt},'Restaurée');
function openForm(e,d,scope,title){const ed=e&&!title;form={id:ed?e.id:'',t:title??e?.t??'',d:ed?d:cur,h:ed?e.h:'09:00',note:ed?e.note:'',rec:ed?e.rec:'',end:ed?e.end||'':'',scope,od:d};sh='form'}
function saveForm(){
  const f=form,t=f.t.trim()||'Sans titre',rec=f.scope==='one'?'':f.rec,end=(f.end&&f.end>f.d&&!rec)?f.end:'',e=f.id&&S.items.find(x=>x.id===f.id);
  if(!e)commit(()=>{S.items.push({id:L.uid(),t,d:f.d,h:f.h,note:f.note,rec,end,skip:[],sts:{}});cur=f.d},'Action ajoutée');
  else if(f.scope==='one')commit(()=>{e.skip.push(f.od);S.items.push({id:L.uid(),t,d:f.d,h:f.h,note:f.note,rec:'',end,skip:[],sts:{}})},'Ce rdv modifié, la série est intacte');
  else commit(()=>{Object.assign(e,{t,d:f.d,h:f.h,note:f.note,rec,end})},'Modification enregistrée');
}
function tog(id){S.checks[T]=checked.includes(id)?checked.filter(x=>x!==id):[...checked,id];S=S;save(S)}
const addDaily=()=>{const v=form.nd?.trim();if(v){S.daily=[...S.daily,{id:L.uid(),t:v}];form.nd='';save(S)}};
const rmDaily=i=>{S.daily=S.daily.filter((_,j)=>j!==i);save(S)};
function dl(name,type,txt){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type}));a.download=name;a.click()}
const exJSON=()=>dl('qwenagenda-'+T+'.json','application/json',JSON.stringify({app:'qwenagenda',version:1,exportedAt:new Date().toISOString(),items:S.items,daily:S.daily,checks:S.checks},null,1));
const exICS=()=>dl('qwenagenda-'+T+'.ics','text/calendar',L.toICS(S.items));
async function imp(ev){
  const f=ev.target.files[0];if(!f)return;let r;
  try{const txt=await f.text();r=f.name.toLowerCase().endsWith('.ics')?L.fromICS(txt,S.items):L.fromJSON(txt,S)}catch(e){flash('Import impossible : '+e.message);return}
  commit(()=>{S.items=r.items;if(r.daily)S.daily=r.daily;if(r.checks)S.checks=r.checks},r.n+' action(s) importée(s)'+(r.bad?' · '+r.bad+' répétition(s) non gérée(s), importée(s) sans répétition':''));
  ev.target.value='';
}
const ago=e=>Math.floor((Date.now()-e.delAt)/864e5);
const prevM=n=>mm=new Date(mm.getFullYear(),mm.getMonth()+n,1,12);
</script>

{#if ok}
<div class="app">
  <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="c" viewBox="0 0 26 26"><path d="M2 24V8Q2 2 8 2H24" fill="none" stroke="#C9A227" stroke-width="1.5"/><path d="M6 24V10Q6 6 10 6H24" fill="none" stroke="#C9A227" stroke-width=".7" opacity=".6"/><circle cx="4" cy="4" r="1.6" fill="#C9A227"/></symbol></defs></svg>
  {#each ['tl','tr','bl','br'] as c}<div class="fc fc-{c}"><svg width="26" height="26"><use href="#c"/></svg></div>{/each}
  <div class="top"><div class="pf"><div class="ring"></div><div class="fill">Q</div></div><div class="bt"><div class="brand">QWENAGENDA</div><div class="sub">L’agenda de Qwenaëlle, en poche</div></div>
    <div class="ic">
      <button aria-label="Rechercher" on:click={()=>sh='search'}>{@html I.bS}</button>
      <button aria-label="Annuler la dernière modification" on:click={undo}>{@html I.bU}</button>
      <button aria-label="Corbeille" on:click={()=>sh='trash'}>{@html I.bT}</button>
      <button aria-label="Réglages" on:click={()=>sh='set'}>{@html I.bG}</button>
    </div></div>
  <div class="rd"><span class="l"></span><span class="m">✦</span><span class="l"></span></div>
  <button class="sync off" on:click={()=>sh='set'}><i></i>Synchro non configurée</button>

  <main>
    {#if needUp}<div class="ban ok">Nouvelle version disponible <button class="sm gold" on:click={()=>upd(true)}>Mettre à jour</button></div>{/if}
    {#if view==='today'}
      {#if from==='week'}<button class="sm" on:click={()=>{view='week';from=''}}>‹ Retour à la semaine</button>{/if}
      <h2>{cap(lab(cur))}</h2>
      {#if cur===T}
        {#if lateL.length}
          <div class="ban late">{lateL.length===1?'Une action à reprendre':lateL.length+' actions à reprendre'}
            {#each lateL as o}<div class="late-row"><span>{o.e.t} <small>· {lab(o.d)}</small></span><button class="sm ok" on:click={()=>mark(o)}>Fait</button><button class="sm gold" on:click={()=>move(o)}>Reporter</button></div>{/each}
          </div>
        {:else}<div class="ban ok">À jour. Rien ne t’attend en retard.</div>{/if}
      {/if}
      {#each list as o}<Item {o} {T} on:open={()=>{so=o;sh='det'}}/>{:else}<div class="empty">Rien de prévu ce jour-là.</div>{/each}
      {#if cur===T}
        <div class="rd" style="padding:0;margin:16px 0 14px"><span class="l"></span><span class="m">✦</span><span class="l"></span></div>
        <button class="cat" class:open={dOpen} on:click={()=>dOpen=!dOpen}><span>Quotidien</span><span class="n">{S.daily.length}</span><span class="n">{dOpen?'▴':'▾'}</span></button>
        {#if dOpen}
          {#each S.daily as x}<button class="chk" class:on={checked.includes(x.id)} on:click={()=>tog(x.id)}><span>{checked.includes(x.id)?'✓':''}</span><b>{x.t}</b></button>
          {:else}<div class="mu" style="margin:0 0 8px">Aucune action quotidienne.</div>{/each}
          <div style="margin:0 0 8px"><button class="sm" on:click={()=>sh='daily'}>Modifier la liste</button></div>
        {/if}
      {:else if from!=='week'}<div class="btns"><button on:click={()=>cur=T}>Revenir à aujourd’hui</button></div>{/if}

    {:else if view==='week'}
      <h2>Semaine du {D(wk[0]).getDate()} {MOIS[D(wk[0]).getMonth()]}</h2>
      {#each wk as dd,i}
        <button class="wk" class:past={dd<T} class:td={dd===T} on:click={()=>{cur=dd;from='week';view='today'}}>
          <b>{cap(JOURS[i])} {D(dd).getDate()}</b>
          <div class:no={!occ(S.items,dd).length}>{#each occ(S.items,dd) as o}{o.e.h} {o.e.t}<br>{:else}—{/each}</div>
        </button>
      {/each}

    {:else}
      <div class="mh"><button aria-label="Mois précédent" on:click={()=>prevM(-1)}>‹</button><h2>{cap(MOIS[mm.getMonth()])} {mm.getFullYear()}</h2><button aria-label="Mois suivant" on:click={()=>prevM(1)}>›</button></div>
      <div class="grid">
        {#each ['L','M','M','J','V','S','D'] as j}<div class="h">{j}</div>{/each}
        {#each Array(grid.off) as _}<div></div>{/each}
        {#each grid.days as dd}
          {@const c=cell(S.items,dd,T)}
          <button class="d" class:today={dd===T} class:sel={dd===cur} on:click={()=>cur=dd}>{D(dd).getDate()}{#each c.bars as b,i}<b class="sp {b.c}" style="bottom:{14+i*5}px;background:{b.col}"></b>{/each}{#if c.pts.length}<span class="dots">{#each c.pts as k}<i class={k}></i>{/each}</span>{/if}</button>
        {/each}
      </div>
      <div class="h3">{lab(cur)}</div>
      {#each list as o}<Item {o} {T} on:open={()=>{so=o;sh='det'}}/>{:else}<div class="empty">Rien de prévu.</div>{/each}
    {/if}
  </main>

  <button class="fab" aria-label="Ajouter une action" on:click={()=>openForm(null,cur,'')}><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M11 3v16M3 11h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
  <nav>{#each [['today','Aujourd’hui'],['week','Semaine'],['month','Mois']] as [v,l]}<button aria-current={view===v} on:click={()=>{view=v;if(v==='today'){cur=T;from=''}}}>{l}</button>{/each}</nav>

  {#if msg}<div class="snack on"><span>{msg}</span>{#if canUndo}<button on:click={undo}>Annuler</button>{/if}</div>{/if}

  {#if sh}
  <div class="ov on" role="presentation" on:click|self={()=>sh=null}><div class="sh">
    {#if sh==='det'}
      <h2>{so.e.t}</h2><p>{cap(lab(so.d))} à {so.e.h}{so.e.end&&so.e.end!==so.e.d?' · jusqu’au '+lab(so.e.end):''}{so.e.rec?' · chaque semaine':''} · {st(so,T)}</p>{#if so.e.note}<p>{so.e.note}</p>{/if}
      <div class="btns"><div class="row2"><button class="ok" on:click={()=>mark(so)}>Fait</button><button class="gold" on:click={()=>move(so)}>Reporter</button></div>
        <button on:click={()=>{if(so.e.rec){act='edit';sh='scope'}else openForm(so.e,so.d,'all')}}>Modifier</button>
        <button on:click={()=>openForm(so.e,so.d,'',so.e.t)}>Dupliquer</button>
        <button class="dng" on:click={()=>{if(so.e.rec){act='rm';sh='scope'}else del(so,'all')}}>Supprimer</button></div>
    {:else if sh==='scope'}
      <h2>Cette action se répète</h2><p>Que veux-tu {act==='rm'?'supprimer':'modifier'} ?</p>
      <div class="btns"><button on:click={()=>act==='rm'?del(so,'one'):openForm(so.e,so.d,'one')}>{act==='rm'?'Supprimer':'Modifier'} ce rdv</button><button on:click={()=>act==='rm'?del(so,'all'):openForm(so.e,so.d,'all')}>{act==='rm'?'Supprimer':'Modifier'} la série</button></div>
    {:else if sh==='form'}
      <h2>{form.id?'Modifier':'Nouvelle action'}</h2>
      <label for="f1">Intitulé</label><input id="f1" bind:value={form.t}>
      <div class="row2"><div><label for="f2">Date</label><input id="f2" type="date" bind:value={form.d}></div><div><label for="f3">Heure</label><input id="f3" type="time" bind:value={form.h}></div></div>
      <label for="f6">Jusqu’au (facultatif)</label><input id="f6" type="date" min={form.d} bind:value={form.end}><div class="mu" style="margin-top:4px">{dur}</div>
      {#if form.scope!=='one'}<label for="f4">Répéter</label><select id="f4" bind:value={form.rec}><option value="">Jamais</option><option value="Chaque semaine">Chaque semaine</option></select>{/if}
      <label for="f5">Notes</label><input id="f5" placeholder="Facultatif" bind:value={form.note}>
      <div class="btns"><button class="gold" on:click={saveForm}>Enregistrer</button><button on:click={()=>sh=null}>Annuler</button></div>
    {:else if sh==='search'}
      <h2>Recherche</h2><input placeholder="Titre ou notes…" aria-label="Recherche" bind:value={fq}>
      <div class="chips">{#each ['Tous','À faire','Fait','Manqué'] as c}<button class:on={fs===c} on:click={()=>fs=c}>{c}</button>{/each}
        <select aria-label="Période" bind:value={fper}><option>Tout</option><option>7 jours</option><option>Ce mois</option></select></div>
      {#each res as e}<Item o={{e,d:e.d}} {T} on:open={()=>{so={e,d:e.d};sh='det'}}/>{:else}<div class="empty">Aucun résultat.</div>{/each}
    {:else if sh==='trash'}
      <h2>Corbeille</h2><p>Les actions supprimées sont conservées 30 jours.</p>
      {#each S.items.filter(e=>e.del) as e}<div class="it"><b style="font-size:15px">{e.t}<br><small style="color:var(--dim);font-weight:400">supprimé il y a {ago(e)} j</small></b><button class="sm" on:click={()=>restore(e)}>Restaurer</button></div>{:else}<div class="empty">La corbeille est vide.</div>{/each}
      <div class="btns"><button on:click={()=>sh=null}>Fermer</button></div>
    {:else if sh==='daily'}
      <h2>Actions quotidiennes</h2><p>Elles se remettent à zéro chaque jour.</p>
      {#each S.daily as x,i}<div class="row2 er"><input aria-label="Intitulé" bind:value={x.t} on:change={()=>save(S)}><button class="sm" aria-label="Retirer" on:click={()=>rmDaily(i)}>✕</button></div>{/each}
      <div class="row2 er"><input placeholder="Nouvelle action quotidienne" aria-label="Nouvelle action" bind:value={form.nd}><button class="sm ok" on:click={addDaily}>Ajouter</button></div>
      <div class="btns"><button class="gold" on:click={()=>{S=S;save(S);sh=null}}>Terminer</button></div>
    {:else if sh==='set'}
      <h2>Réglages</h2>
      <div class="h3" style="margin-top:4px">Import et export</div>
      <div class="btns" style="margin-top:0"><button on:click={exJSON}>Exporter tout (JSON)</button><button on:click={exICS}>Exporter en .ics</button><button on:click={()=>fileEl.click()}>Importer un fichier (.json ou .ics)</button></div>
      <input type="file" accept=".json,.ics" hidden bind:this={fileEl} on:change={imp}>
      <div class="h3">Synchronisation</div>
      <div class="kv"><span>État</span><span>Non configurée</span></div>
      <label for="sa">Adresse de Qwenaëlle</label><input id="sa" placeholder="https://….ts.net" disabled>
      <p>La synchronisation s’activera quand Qwenaëlle sera prête. En attendant, utilise l’export.</p>
      <div class="h3">Crédits</div>
      <div class="kv"><span>Qwenagenda</span><span>version 0.2</span></div><div class="kv"><span>Code</span><span>Codé par Caude</span></div><div class="kv"><span>Design</span><span>Clio</span></div>
      <div class="kv"><span>GitHub</span><span><a href="https://github.com/Caldheron" target="_blank" rel="noopener">Caldheron</a></span></div><div class="kv"><span>Polices</span><span>Cinzel et EB Garamond (SIL OFL)</span></div>
      <div class="btns"><button on:click={()=>sh=null}>Fermer</button></div>
    {/if}
  </div></div>
  {/if}
</div>
{/if}
