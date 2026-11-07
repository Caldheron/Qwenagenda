// Stockage local : tout l'état dans une clé IndexedDB (hors ligne, aucune donnée sur GitHub)
const open=()=>new Promise((res,rej)=>{const r=indexedDB.open('qwenagenda',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
export async function load(){const db=await open();return new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get('state');q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null)})}
export async function save(s){const db=await open();db.transaction('kv','readwrite').objectStore('kv').put(JSON.parse(JSON.stringify(s)),'state')}
