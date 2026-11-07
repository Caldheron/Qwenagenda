// Dates (Europe/Paris = fuseau local du téléphone), récurrence, statuts, import/export
export const MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
export const JOURS=['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
const p=n=>String(n).padStart(2,'0');
export const iso=d=>d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
export const D=s=>new Date(s+'T12:00:00');
export const add=(s,n)=>{const x=D(s);x.setDate(x.getDate()+n);return iso(x)};
export const TODAY=()=>iso(new Date());
export const cap=s=>s[0].toUpperCase()+s.slice(1);
export const lab=s=>{const d=D(s);return JOURS[(d.getDay()+6)%7]+' '+d.getDate()+' '+MOIS[d.getMonth()]};
export const uid=()=>crypto.randomUUID();
// Occurrences d'un jour : action ponctuelle ou répétition « chaque semaine » (hors exceptions)
export const occ=(items,day)=>items.filter(e=>!e.del&&(e.d===day||(e.rec&&day>e.d&&!e.skip.includes(day)&&Math.round((D(day)-D(e.d))/864e5)%7===0))).map(e=>({e,d:day})).sort((a,b)=>a.e.h<b.e.h?-1:1);
// Statut : « manqué » est calculé automatiquement
export const st=(o,T)=>o.e.sts[o.d]==='done'?'fait':o.d<T?'manqué':'à faire';
export const late=(items,T)=>{const r=[];for(let i=1;i<=30;i++)r.push(...occ(items,add(T,-i)).filter(o=>st(o,T)==='manqué'));return r};
export const dot=(items,day,T)=>{const l=occ(items,day);if(!l.length)return null;const s=l.map(o=>st(o,T));return s.includes('manqué')?'m':s.includes('à faire')?'t':'f'};
export const search=(items,q,s,per,T)=>items.filter(e=>!e.del&&(!q||(e.t+' '+(e.note||'')).toLowerCase().includes(q.toLowerCase()))&&(s==='Tous'||st({e,d:e.d},T)===s.toLowerCase())&&(per==='Tout'||(per==='7 jours'?e.d>=T&&e.d<=add(T,7):e.d.slice(0,7)===T.slice(0,7))));
// --- Export / import ---
const esc=s=>(s||'').replace(/[\\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n'),unesc=s=>s.replace(/\\n/gi,'\n').replace(/\\([\\;,])/g,'$1');
const dt=(d,h)=>d.replace(/-/g,'')+'T'+h.replace(':','')+'00';
export const toICS=items=>['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Qwenagenda//FR',...items.filter(e=>!e.del).flatMap(e=>['BEGIN:VEVENT','UID:'+e.id,'DTSTAMP:'+new Date().toISOString().replace(/[-:]|\.\d+/g,''),'DTSTART;TZID=Europe/Paris:'+dt(e.d,e.h),'SUMMARY:'+esc(e.t),...(e.note?['DESCRIPTION:'+esc(e.note)]:[]),...(e.rec?['RRULE:FREQ=WEEKLY']:[]),...e.skip.map(d=>'EXDATE;TZID=Europe/Paris:'+dt(d,e.h)),'END:VEVENT']),'END:VCALENDAR'].join('\r\n');
export function fromICS(txt,items){const out=[...items];let n=0,bad=0,c=null;
for(const l of txt.replace(/\r?\n[ \t]/g,'').split(/\r?\n/)){
 if(l==='BEGIN:VEVENT')c={};
 else if(l==='END:VEVENT'&&c){c.id=c.id||uid();if(c.t&&c.d&&!out.some(e=>e.id===c.id)){out.push({id:c.id,t:c.t,d:c.d,h:c.h||'09:00',note:c.note||'',rec:c.rec||'',skip:[],sts:{},mod:Date.now(),rev:1});n++}if(c.bad)bad++;c=null}
 else if(c){const i=l.indexOf(':'),k=l.slice(0,i).split(';')[0],v=l.slice(i+1);
  if(k==='UID')c.id=v;else if(k==='SUMMARY')c.t=unesc(v);else if(k==='DESCRIPTION')c.note=unesc(v);
  else if(k==='DTSTART'){const m=v.match(/(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d))?/);if(m){c.d=m[1]+'-'+m[2]+'-'+m[3];if(m[4])c.h=m[4]+':'+m[5]}}
  else if(k==='RRULE'){if(/FREQ=WEEKLY/.test(v)&&!/INTERVAL=([2-9]|\d\d)/.test(v)&&!/BYDAY=.*,/.test(v))c.rec='Chaque semaine';else c.bad=1}}}
return{items:out,n,bad}}
// JSON versionné (version 1) : refuse une version inconnue
export function fromJSON(txt,S){const j=JSON.parse(txt);if(j.app!=='qwenagenda')throw new Error('ce n’est pas un export Qwenagenda');if(j.version>1)throw new Error('version '+j.version+' inconnue');
const m=new Map(S.items.map(e=>[e.id,e]));let n=0;for(const e of j.items){const o=m.get(e.id);if(!o||(e.mod||0)>(o.mod||0)){m.set(e.id,e);n++}}
return{items:[...m.values()],daily:S.daily.length?S.daily:j.daily,checks:{...j.checks,...S.checks},n,bad:0}}
