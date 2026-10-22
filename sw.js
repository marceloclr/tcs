// ==== #SW: START ====
// Service worker do TCS (escopo: a pasta do site, /tcs/ no GitLab Pages).
// - Páginas e scripts do próprio site: rede primeiro (versão sempre atual); sem internet, a cópia guardada.
// - Bibliotecas de CDN com versão fixa (Firebase, ZXing, heic2any): cache primeiro.
// - Compartilhar com "Notas TCS" (Web Share Target): o Android envia as fotos por POST para mestre?compartilhado=1 (ou captura.html, nos atalhos antigos);
//   este service worker guarda as fotos no IndexedDB 'tcs-captura' e redireciona para a tela de captura, que as recebe.
const VERSAO='tcs-V-22102026-1151';
const CASCA=['captura.html','mestre','index.html','manifest.webmanifest','css/tcs.css','css/captura.css','icones/notas-tcs.svg','icones/notas-tcs-192.png','icones/notas-tcs-512.png',
 'js/config.js','js/nuvem-firebase.js','js/base.js','js/importacao.js','js/imagens.js','js/captura.js','js/nuvem.js','js/cadastros.js','js/paineis.js','js/escopo.js','js/acessos.js','js/atividades.js','js/consulta.js','js/fila.js','js/orcamento.js','js/inicio.js'];
const CDN=/^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdn\.jsdelivr\.net\/npm\/|cdnjs\.cloudflare\.com\/ajax\/libs\/)/;
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSAO).then(c=>Promise.all(CASCA.map(u=>c.add(u).catch(()=>{}))))
 .then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('tcs-')&&k!==VERSAO).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('tcs-captura',1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('fila'))d.createObjectStore('fila',{keyPath:'id'});if(!d.objectStoreNames.contains('compartilhados'))d.createObjectStore('compartilhados',{keyPath:'id',autoIncrement:true})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function receberCompartilhado(req){try{const f=await req.formData();const fotos=f.getAll('fotos').filter(x=>x&&typeof x==='object'&&x.size);const d=await idb();
  await new Promise((res,rej)=>{const t=d.transaction('compartilhados','readwrite');const s=t.objectStore('compartilhados');fotos.forEach(x=>s.add({blob:x,nome:x.name||'foto.jpg',tipo:x.type||'image/jpeg',recebidoEm:new Date().toISOString(),texto:String(f.get('texto')||'')}));t.oncomplete=res;t.onerror=()=>rej(t.error)})}
 catch(e){console.error('Falha ao receber fotos compartilhadas:',e)}
 return Response.redirect(new URL(new URL(req.url).pathname+'?compartilhado=1',self.registration.scope).href,303)}
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
 if(r.method==='POST'&&u.origin===location.origin&&/(captura\.html|\/mestre)$/.test(u.pathname)&&u.searchParams.has('compartilhado')){e.respondWith(receberCompartilhado(r));return}
 if(r.method!=='GET')return;
 if(CDN.test(r.url)){e.respondWith(caches.open(VERSAO).then(async c=>{const h=await c.match(r);if(h)return h;const n=await fetch(r);if(n.ok)c.put(r,n.clone());return n}));return}
 if(u.origin!==location.origin)return;
 e.respondWith((async()=>{const c=await caches.open(VERSAO);try{const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),5000);const n=await fetch(r,{signal:ctl.signal});clearTimeout(t);if(n.ok&&!u.search.includes('emulador'))c.put(r,n.clone());return n}
  catch(err){const h=await c.match(r,{ignoreSearch:true});if(h)return h;throw err}})())});
// ==== #SW: END ====
