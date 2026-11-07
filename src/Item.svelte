<script>import {createEventDispatcher} from 'svelte';import {st} from './lib.js';export let o,T;const dp=createEventDispatcher();$:s=st(o,T)</script>
<button class="it" class:fait={s==='fait'} class:manque={s==='manqué'} on:click={()=>dp('open')}><span class="t">{o.e.h}</span><b>{o.e.t}{o.e.rec?' ↻':''}</b><span class="chip {s==='à faire'?'todo':s}">{s}</span></button>
