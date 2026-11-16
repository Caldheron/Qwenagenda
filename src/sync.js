// Synchronisation de l'agenda avec Céleste (via Tailscale, en HTTPS). Céleste garde la copie de référence.
// Un seul appel : POST {adresse}/sync/v1/agenda, clé secrète en « Authorization: Bearer ».
//   envoi   : { format, client, since, items, daily, checks }  (seulement ce qui a changé depuis la dernière synchro)
//   réponse : { app: 'celeste', rev, items, daily, checks, conflicts }
// Conflit (action modifiée des deux côtés depuis la dernière synchro) : la plus récente gagne, l'autre version est
// décrite à l'utilisateur. Suivi par élément (`map`) : aucune dépendance aux horloges, pas de renvoi d'éléments tout juste reçus.
export const FORMAT=1, CLIENT='clepsydre';
const ms=v=>Number.isFinite(v)?v:0;
export const newMeta=()=>({url:'',key:'',rev:0,lastSyncAt:0,err:null,map:{},dailyMap:null,checksMap:{},conflicts:[]});

export function outgoing(S,M){
  const items=S.items.filter(e=>M.map[e.id]!==ms(e.mod)).map(e=>({...e,mod:ms(e.mod)}));
  const dm=ms(S.dailyMod);
  const daily=((S.daily.length||dm>0)&&dm!==M.dailyMap)?{list:S.daily,mod:dm}:null;
  const checks={};
  for(const [d,m] of Object.entries(S.checksMod||{}))if(M.checksMap[d]!==m)checks[d]={ids:S.checks[d]||[],mod:m};
  return {items,daily,checks};
}

export function status(S,M){
  if(!M.url||!M.key)return{state:'off',ready:false,text:!M.url&&!M.key?'Synchro non configurée':!M.url?'Adresse de Céleste manquante':'Clé de synchro manquante'};
  if(M.err)return{state:'off',ready:true,text:'Non connecté à Céleste',detail:M.err};
  if(!M.lastSyncAt)return{state:'wait',ready:true,text:'En attente de la première synchro'};
  const o=outgoing(S,M),n=o.items.length+(o.daily?1:0)+Object.keys(o.checks).length;
  if(n)return{state:'wait',ready:true,pending:n,text:n+' changement'+(n>1?'s':'')+' en attente'};
  return{state:'sync',ready:true,pending:0,text:'Synchronisé avec Céleste'};
}

const fail=(M,why)=>{M.err=why;return{ok:false,message:'Synchro impossible : '+why}};

// Modifie S et M en place. Une action modifiée ici pendant la synchro (après son début) n'est pas écrasée.
export async function runSync(S,M,{fetchImpl=globalThis.fetch,now=Date.now,timeoutMs=15000}={}){
  if(!M.url||!M.key)return{ok:false,message:!M.url?'Adresse de Céleste manquante':'Clé de synchro manquante'};
  const t0=now(),out=outgoing(S,M),sent=out.items.map(e=>[e.id,e.mod]),sentDaily=out.daily&&out.daily.mod,sentChecks=Object.entries(out.checks).map(([d,c])=>[d,c.mod]);
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);let res;
  try{
    res=await fetchImpl(M.url.replace(/\/+$/,'')+'/sync/v1/agenda',{method:'POST',signal:ctl.signal,
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+M.key},
      body:JSON.stringify({format:FORMAT,client:CLIENT,since:M.rev||0,items:out.items,daily:out.daily,checks:out.checks})});
  }catch{return fail(M,'Céleste injoignable (PC éteint ou Tailscale coupé ?)')}finally{clearTimeout(timer)}
  if(res.status===401||res.status===403)return fail(M,'clé refusée');
  if(!res.ok)return fail(M,'erreur '+res.status);
  let d;try{d=await res.json()}catch{return fail(M,'réponse illisible')}
  if(!d||d.app!=='celeste'||!Array.isArray(d.items)||!Number.isFinite(d.rev))return fail(M,'réponse inattendue');
  sent.forEach(([id,m])=>{M.map[id]=m});
  if(sentDaily!=null)M.dailyMap=sentDaily;
  sentChecks.forEach(([dd,m])=>{M.checksMap[dd]=m});
  let received=0;
  for(const r of d.items){
    const i=S.items.findIndex(x=>x.id===r.id);
    if(i>=0&&ms(S.items[i].mod)>t0)continue;
    if(i>=0)S.items[i]=r;else S.items.push(r);
    M.map[r.id]=ms(r.mod);received++;
  }
  if(d.daily&&Array.isArray(d.daily.list)&&ms(S.dailyMod)<=t0){S.daily=d.daily.list;S.dailyMod=ms(d.daily.mod);M.dailyMap=S.dailyMod;received++}
  for(const [dd,c] of Object.entries(d.checks||{})){
    if(ms((S.checksMod||{})[dd])>t0)continue;
    S.checks[dd]=c.ids;S.checksMod={...(S.checksMod||{}),[dd]:ms(c.mod)};M.checksMap[dd]=ms(c.mod);received++;
  }
  const cf=Array.isArray(d.conflicts)?d.conflicts:[];
  if(cf.length)M.conflicts=M.conflicts.concat(cf.map(c=>({id:c.id,title:String(c.title||''),kept:c.kept,domain:c.domain,detail:c.detail||{},at:t0})));
  M.rev=d.rev;M.lastSyncAt=t0;M.err=null;
  return{ok:true,sent:out.items.length,received,conflicts:cf};
}
