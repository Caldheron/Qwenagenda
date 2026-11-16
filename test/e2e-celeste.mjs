// Test de bout en bout : deux « téléphones » Clepsydre contre un vrai service Céleste.
// Usage : CELESTE_URL=http://127.0.0.1:7860 CELESTE_KEY=<clé de data/sync_key.txt> node test/e2e-celeste.mjs
import assert from 'node:assert/strict';
import { runSync, status, newMeta } from '../src/sync.js';
const phone = () => ({ S: { items: [], daily: [], checks: {}, dailyMod: 0, checksMod: {} }, M: { ...newMeta(), url: process.env.CELESTE_URL, key: process.env.CELESTE_KEY } });
const sync = (p) => runSync(p.S, p.M); const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (id, o = {}) => ({ id, t: 'Action ' + id, d: '2026-11-16', h: '10:00', note: '', rec: '', end: '', skip: [], sts: {}, mod: Date.now(), rev: 1, ...o });
const A = phone(), B = phone();
A.S.items.push(ev('x', { t: 'Dentiste' }), ev('y', { t: 'Réunion', rec: 'Chaque semaine', skip: ['2026-11-23'] }));
A.S.daily = [{ id: 'q1', t: 'Écrire 100 mots' }]; A.S.dailyMod = Date.now(); A.S.checks['2026-11-15'] = ['q1']; A.S.checksMod = { '2026-11-15': Date.now() };
let r = await sync(A); assert.equal(r.ok, true); assert.equal(r.sent, 2);
r = await sync(B); assert.equal(B.S.items.length, 2); assert.equal(B.S.daily[0].t, 'Écrire 100 mots'); assert.deepEqual(B.S.checks['2026-11-15'], ['q1']);
assert.deepEqual(B.S.items.find((e) => e.id === 'y').skip, ['2026-11-23']);
assert.equal(status(B.S, B.M).state, 'sync'); assert.equal((await sync(B)).sent, 0);          // rien n'est renvoyé

// conflit 1 : B modifie plus tard que A mais synchronise après → la version de B gagne, le détail de A est conservé
await wait(5); A.S.items.find((e) => e.id === 'x').t = 'Dentiste 9h'; A.S.items.find((e) => e.id === 'x').mod = Date.now();
await wait(5); B.S.items.find((e) => e.id === 'x').t = 'Dentiste 11h'; B.S.items.find((e) => e.id === 'x').mod = Date.now();
r = await sync(A); assert.equal(r.conflicts.length, 0);
r = await sync(B); assert.equal(r.conflicts.length, 1); assert.equal(r.conflicts[0].kept, 'telephone'); assert.equal(B.M.conflicts[0].detail.perdu.t, 'Dentiste 9h');
await sync(A); assert.equal(A.S.items.find((e) => e.id === 'x').t, 'Dentiste 11h');

// conflit 2 : B modifie d'abord, A ensuite et synchronise en premier → A gagne, B apprend la version de A
await wait(5); B.S.items.find((e) => e.id === 'x').t = 'B ancienne'; B.S.items.find((e) => e.id === 'x').mod = Date.now();
await wait(5); A.S.items.find((e) => e.id === 'x').t = 'A récente'; A.S.items.find((e) => e.id === 'x').mod = Date.now();
await sync(A); r = await sync(B);
assert.equal(r.conflicts[0].kept, 'celeste'); assert.equal(B.S.items.find((e) => e.id === 'x').t, 'A récente'); assert.equal(B.M.conflicts[1].detail.perdu.t, 'B ancienne');

// suppression douce, case décochée, liste modifiée : propagées
const ay = A.S.items.find((e) => e.id === 'y'); ay.del = 1; ay.delAt = Date.now(); ay.mod = Date.now();
A.S.checks['2026-11-15'] = []; A.S.checksMod = { '2026-11-15': Date.now() };
A.S.daily = [{ id: 'q1', t: 'Écrire 100 mots' }, { id: 'q2', t: 'Leçon de langue' }]; A.S.dailyMod = Date.now();
await sync(A); await sync(B);
assert.equal(B.S.items.find((e) => e.id === 'y').del, 1); assert.deepEqual(B.S.checks['2026-11-15'], []); assert.equal(B.S.daily.length, 2);

// convergence
await sync(A); await sync(B);
const key = (S) => JSON.stringify([S.items.map((e) => [e.id, e.t, e.del || 0]).sort(), S.daily.map((d) => d.t), S.checks]);
assert.equal(key(A.S), key(B.S));
assert.equal(status(A.S, A.M).state, 'sync');
// mauvaise clé
A.M.key = 'mauvaise'; r = await sync(A); assert.equal(r.ok, false); assert.equal(status(A.S, A.M).state, 'off'); assert.equal(A.S.items.length, 2);
console.log('E2E Clepsydre ok : synchro, deux conflits, suppression, cases, liste, convergence, clé refusée');
