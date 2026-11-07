import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {VitePWA} from 'vite-plugin-pwa';
// base './' : fonctionne sur GitHub Pages quel que soit le nom du dépôt
export default defineConfig({base:'./',plugins:[svelte(),VitePWA({registerType:'prompt',
manifest:{name:'Qwenagenda',short_name:'Qwenagenda',lang:'fr',start_url:'./',scope:'./',display:'standalone',background_color:'#15100C',theme_color:'#15100C',
icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},
workbox:{globPatterns:['**/*.{js,css,html,png,woff,woff2}']}})]});
