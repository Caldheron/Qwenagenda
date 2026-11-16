import test from 'node:test';
import assert from 'node:assert/strict';
import { runSync, status, outgoing, newMeta } from '../src/sync.js';

const ev = (id, o = {}) => ({ id, t: 'Action ' + id, d: '2026-11-16', h: '10:00', note: '', rec: '', end: '', skip: [], sts: {}, mod: 1000, rev: 1, ...o });
const fresh = (items = []) => ({ S: { items, daily: [], checks: {}, dailyMod: 0, checksMod: {} }, M: { ...newMeta(), url: 'https://pc.ts.net', key: 'secret' } });
const reply = (extra = {}, code = 200) => async () => ({ ok: code < 400, status: code, json: async () => ({ app: 'celeste', rev: 5, items: [], daily: null, checks: {}, conflicts: [], ...extra }) });
const spy = (extra) => { const calls = []; const f = async (u, o) => { calls.push({ u, o, body: JSON.parse(o.body) }); return reply(extra)(); }; f.calls = calls; return f; };

test('statut : non configuré (braise), en attente de la première synchro, en attente de changements (doré), synchronisé (vert)', async () => {
  const { S, M } = fresh([ev('a')]);
  assert.equal(status(S, newMeta()).state, 'off');
  assert.equal(status(S, { ...M, key: '' }).text, 'Clé de synchro manquante');
  assert.equal(status(S, M).state, 'wait');
  await runSync(S, M, { fetchImpl: spy() });
  assert.equal(status(S, M).state, 'sync');
  S.items.push(ev('b', { mod: 2000 }));
  const st = status(S, M); assert.equal(st.state, 'wait'); assert.equal(st.pending, 1);
});

test('première synchro : tout est envoyé avec la clé ; ensuite seuls les éléments modifiés partent ; les éléments reçus ne sont jamais renvoyés', async () => {
  const { S, M } = fresh([ev('a'), ev('b')]);
  const f = spy({ rev: 3, items: [ev('c', { mod: 900 })] });
  const r = await runSync(S, M, { fetchImpl: f });
  assert.equal(f.calls[0].u, 'https://pc.ts.net/sync/v1/agenda');
  assert.equal(f.calls[0].o.headers.Authorization, 'Bearer secret');
  assert.deepEqual(f.calls[0].body.items.map((e) => e.id), ['a', 'b']); assert.equal(f.calls[0].body.since, 0);
  assert.deepEqual([r.sent, r.received], [2, 1]); assert.equal(M.rev, 3); assert.equal(S.items.length, 3);
  const f2 = spy({ rev: 3 }); await runSync(S, M, { fetchImpl: f2 });
  assert.equal(f2.calls[0].body.items.length, 0); assert.equal(f2.calls[0].body.since, 3);
  S.items.find((e) => e.id === 'a').mod = 5000;
  const f3 = spy(); await runSync(S, M, { fetchImpl: f3 });
  assert.deepEqual(f3.calls[0].body.items.map((e) => e.id), ['a']);
});

test('liste quotidienne et cases cochées : envoyées seulement si modifiées (une liste vide jamais touchée n’est pas envoyée)', async () => {
  const { S, M } = fresh();
  const f = spy(); await runSync(S, M, { fetchImpl: f });
  assert.equal(f.calls[0].body.daily, null); assert.deepEqual(f.calls[0].body.checks, {});
  S.daily = [{ id: 'q1', t: 'Écrire 100 mots' }]; S.dailyMod = 50; S.checks['2026-11-15'] = ['q1']; S.checksMod = { '2026-11-15': 60 };
  const f2 = spy(); await runSync(S, M, { fetchImpl: f2 });
  assert.equal(f2.calls[0].body.daily.mod, 50); assert.deepEqual(f2.calls[0].body.checks['2026-11-15'], { ids: ['q1'], mod: 60 });
  const f3 = spy(); await runSync(S, M, { fetchImpl: f3 });
  assert.equal(f3.calls[0].body.daily, null); assert.deepEqual(f3.calls[0].body.checks, {});
});

test('éléments, liste et cases reçus de Céleste sont appliqués', async () => {
  const { S, M } = fresh([ev('a', { t: 'Ancienne', mod: 10 })]); M.map = { a: 10 };
  await runSync(S, M, { fetchImpl: spy({ items: [ev('a', { t: 'Du PC', mod: 99 })], daily: { list: [{ id: 'q9', t: 'Langue' }], mod: 77 }, checks: { '2026-11-15': { ids: ['q9'], mod: 78 } } }) });
  assert.equal(S.items[0].t, 'Du PC'); assert.equal(S.daily[0].t, 'Langue'); assert.equal(S.dailyMod, 77); assert.deepEqual(S.checks['2026-11-15'], ['q9']);
  assert.equal(status(S, M).state, 'sync');
});

test('une action modifiée ici pendant la synchro n’est pas écrasée', async () => {
  const { S, M } = fresh([ev('a', { t: 'v1', mod: 10 })]); M.map = { a: 10 };
  const f = async () => { await new Promise((r) => setTimeout(r, 5)); S.items[0].t = 'v2 tapée pendant la synchro'; S.items[0].mod = Date.now(); return reply({ items: [ev('a', { t: 'Du PC', mod: 99 })] })(); };
  await runSync(S, M, { fetchImpl: f });
  assert.equal(S.items[0].t, 'v2 tapée pendant la synchro');
  assert.equal(status(S, M).state, 'wait');                         // elle repartira à la prochaine synchro
});

test('conflits conservés avec le détail de la version remplacée', async () => {
  const { S, M } = fresh([ev('a')]);
  await runSync(S, M, { fetchImpl: spy({ conflicts: [{ id: 'a', title: 'Dentiste', kept: 'celeste', domain: 'agenda', detail: { perdu: { t: 'Dentiste 10h', d: '2026-11-16', h: '10:00' }, garde: { t: 'Dentiste 11h' } } }] }) });
  assert.equal(M.conflicts.length, 1); assert.equal(M.conflicts[0].detail.perdu.t, 'Dentiste 10h');
});

test('erreurs : injoignable, clé refusée, erreur serveur, réponse inattendue → braise, rien n’est perdu ; reprise ensuite', async () => {
  const { S, M } = fresh([ev('a')]);
  for (const [f, re] of [[async () => { throw new TypeError('x'); }, /injoignable/], [reply({}, 401), /clé refusée/], [reply({}, 500), /erreur 500/], [async () => ({ ok: true, status: 200, json: async () => ({ x: 1 }) }), /inattendue/]]) {
    const r = await runSync(S, M, { fetchImpl: f }); assert.equal(r.ok, false); assert.match(r.message, re);
    assert.equal(status(S, M).state, 'off'); assert.ok(status(S, M).detail);
  }
  assert.equal(S.items.length, 1); assert.equal(M.lastSyncAt, 0);
  assert.equal((await runSync(S, M, { fetchImpl: spy() })).ok, true); assert.equal(status(S, M).state, 'sync');
});

test('sans adresse ou sans clé : aucun appel réseau', async () => {
  const f = spy(); assert.equal((await runSync({ items: [], daily: [], checks: {} }, newMeta(), { fetchImpl: f })).ok, false); assert.equal(f.calls.length, 0);
});

test('outgoing : un élément sans date de modification part avec mod = 0 (valeur valide)', () => {
  const { S, M } = fresh([{ id: 'x', t: 'Ancien', d: '2026-01-01', h: '09:00', skip: [], sts: {} }]);
  assert.equal(outgoing(S, M).items[0].mod, 0);
});
