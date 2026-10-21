// ==== #JS-CAPTURA: START ====
// Tela "Notas da obra" (captura.html), para o papel Obra (e administradores, para teste).
// Fluxo: Fotografar nota → Qual obra? → Enviar. A foto é comprimida no celular (JPEG, lado maior 2400 px, qualidade 0,85),
// o código de barras ou o QR é lido em silêncio, e a nota vai para a fila "capturas" do escritório.
// Sem internet, a nota fica guardada neste celular (IndexedDB 'tcs-captura') e é enviada sozinha quando a conexão voltar.
const Cap={user:null,perfil:null,projetos:[],fotos:[],obra:'',faltou:false,avariado:false,ocupado:false,unsubs:[],enviando:false};
const CAP_PROJ_KEY='tcs-captura-projetos';
const telas=['telaCarregando','telaEntrar','telaAviso','telaFoto','telaConferir','telaPronto'];
function mostrar(id){telas.forEach(t=>$('#'+t).classList.toggle('ativa',t===id));window.scrollTo(0,0)}
$('#versao').textContent=(document.title.match(/V-\d{8}-\d{4}/)||[''])[0];

// ---------- Fila local (IndexedDB) ----------
function capDb(){return new Promise((res,rej)=>{const r=indexedDB.open('tcs-captura',1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('fila'))d.createObjectStore('fila',{keyPath:'id'});if(!d.objectStoreNames.contains('compartilhados'))d.createObjectStore('compartilhados',{keyPath:'id',autoIncrement:true})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function capOp(store,modo,fn){const d=await capDb();return new Promise((res,rej)=>{const t=d.transaction(store,modo);const s=t.objectStore(store);let out;const r=fn(s);if(r)r.onsuccess=()=>{out=r.result};t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error)})}
const filaTodos=()=>capOp('fila','readonly',s=>s.getAll());
const filaPor=item=>capOp('fila','readwrite',s=>s.put(item));
const filaTirar=id=>capOp('fila','readwrite',s=>s.delete(id));
async function filaFaixa(){const n=(await filaTodos()).filter(i=>i.autor===Cap.user?.email).length;const f=$('#fila');f.hidden=!n;f.classList.toggle('enviando',Cap.enviando&&navigator.onLine);
 f.textContent=!n?'':Cap.enviando&&navigator.onLine?`Enviando ${n===1?'1 nota':n+' notas'}…`:navigator.onLine?`${n===1?'1 nota esperando':n+' notas esperando'} para enviar. Vai sozinho.`:`Aguardando internet para enviar (${n===1?'1 nota':n+' notas'}).`}

// ---------- Foto: abrir, conferir qualidade, comprimir ----------
function comprimir(canvas,max=1800,q=0.8){const k=Math.min(1,max/Math.max(canvas.width,canvas.height));const c=document.createElement('canvas');c.width=Math.round(canvas.width*k);c.height=Math.round(canvas.height*k);const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(canvas,0,0,c.width,c.height);
 return new Promise(res=>c.toBlob(b=>res({blob:b,largura:c.width,altura:c.height}),'image/jpeg',q))}
const comPrazo=(p,ms,padrao)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(padrao),ms))]);
async function fotoPreparar(file,origem){const img=await imagemCarregar(file,3000);const q=fotoQualidade(img.canvas);
 let cod=codigosResumo(await comPrazo(codigosAltaResolucao(file),6000,[]));if(!cod.chave)cod=codigosResumo(await comPrazo(codigosLer(img.canvas),8000,[]));let jpg=await comprimir(img.canvas,2400,0.85);if(jpg.blob.size>1600000)jpg=await comprimir(img.canvas,2000,0.8);URL.revokeObjectURL(img.url);
 return {id:uid(),blob:jpg.blob,largura:jpg.largura,altura:jpg.altura,url:URL.createObjectURL(jpg.blob),escura:q.escura,borrada:q.borrada,pequena:q.pequena,aceita:!(q.escura||q.borrada||q.pequena),chave:cod.chave||'',consultaUrl:cod.url||'',origem}}
async function fotosReceber(files,origem){if(!files.length)return;Cap.ocupado=true;mostrar('telaCarregando');$('#telaCarregando p').textContent=files.length>1?'Preparando as fotos…':'Preparando a foto…';
 for(const f of files){try{Cap.fotos.push(await fotoPreparar(f,origem))}catch(e){alert(e.message||'Não deu para abrir esta foto. Tente de novo.')}}
 Cap.ocupado=false;if(!Cap.fotos.length){mostrar('telaFoto');return}if(Cap.projetos.length===1)Cap.obra=Cap.projetos[0].id;conferirRender();mostrar('telaConferir')}
function conferirRender(){$('#fotos').innerHTML=Cap.fotos.map((f,i)=>`<div><div class="foto"><img src="${f.url}" alt="Foto ${i+1} da nota"><div class="moldura"></div><button class="botao secundario tirar" data-tirar="${i}" title="Apaga esta foto">Apagar</button></div>
  ${f.aceita?'':`<div class="alerta-foto">${f.pequena?'A foto veio pequena (do WhatsApp?) e o escritório não vai conseguir ler. Fotografe a nota aqui pelo Notas TCS.':f.escura?'A foto ficou escura.':'A foto ficou tremida.'}<div class="botoes"><label class="botao principal" title="Abre a câmera para fotografar de novo">Tirar de novo<input type="file" accept="image/*" capture="environment" data-refazer="${i}" hidden></label><button class="botao secundario" data-usar="${i}" title="Envia esta foto mesmo assim">Usar assim mesmo</button></div></div>`}</div>`).join('');
 $('#obras').innerHTML=Cap.projetos.length?Cap.projetos.map(p=>`<button class="botao obra" data-obra="${esc(p.id)}" aria-pressed="${Cap.obra===p.id}" title="Escolhe esta obra">${esc(p.name)}</button>`).join(''):'<p class="erro">Nenhuma obra liberada para você. Fale com o escritório.</p>';
 $('#faltou').setAttribute('aria-pressed',Cap.faltou);$('#avariado').setAttribute('aria-pressed',Cap.avariado);
 $('#enviar').disabled=!Cap.obra||!Cap.fotos.length||Cap.fotos.some(f=>!f.aceita)}
function limparCaptura(){Cap.fotos.forEach(f=>URL.revokeObjectURL(f.url));Cap.fotos=[];Cap.obra='';Cap.faltou=false;Cap.avariado=false}

// ---------- Envio ----------
function base64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=()=>rej(r.error);r.readAsDataURL(blob)})}
const PARTE=700000;
// Fotos primeiro (uma por lote, cabem no limite de 10 MB por envio), a captura por último: o escritório só vê a nota quando tudo chegou.
async function capturaEnviar(item){for(const [i,f] of item.fotos.entries()){const dados=await base64(f.blob);const partes=Math.ceil(dados.length/PARTE);const ops=[];
  for(let p=0;p<partes;p++)ops.push({op:'set',store:'capturas_fotos',id:`${item.id}_${i}_${p}`,data:{id:`${item.id}_${i}_${p}`,capturaId:item.id,autor:item.autor,projectId:item.projectId,clientId:item.clientId,ordem:i,parte:p,partes,tipo:'image/jpeg',dados:dados.slice(p*PARTE,(p+1)*PARTE)}});
  await window.__fb.commit(ops)}
 // reenvio depois de uma queda: se a captura já chegou, não grava de novo
 if(await window.__fb.get('capturas',item.id).catch(()=>null))return;
 const obs=[item.faltou?'Faltou material':'',item.avariado?'Veio avariado':''].filter(Boolean);
 const chave=item.fotos.map(f=>f.chave).find(Boolean)||'',url=item.fotos.map(f=>f.consultaUrl).find(Boolean)||'';
 await window.__fb.commit([{op:'set',store:'capturas',id:item.id,data:{id:item.id,autor:item.autor,autorNome:item.autorNome,projectId:item.projectId,clientId:item.clientId,projetoNome:item.projetoNome,status:'pendente',capturadoEm:item.criadoEm,enviadoEm:new Date().toISOString(),faltouMaterial:!!item.faltou,veioAvariado:!!item.avariado,observacoes:obs,chave,consultaUrl:url,origem:item.origem,fotos:item.fotos.map((f,i)=>({ordem:i,largura:f.largura,altura:f.altura,bytes:f.blob.size,partes:Math.ceil(Math.ceil(f.blob.size/3)*4/PARTE)}))}},
  // log de atividades (js/atividades.js): o envio pela obra entra no mesmo lote, com id derivado da captura
  {op:'set',store:'atividades',id:'cap-'+item.id,data:{id:'cap-'+item.id,em:new Date().toISOString(),emServidor:window.__fb.agora(),por:item.autor,nome:item.autorNome||item.autor,papel:Cap.perfil?.papel||'obra',cat:'obra',acao:'obra_envio',texto:`Enviou pela obra ${item.fotos.length} foto(s) de nota fiscal para ${item.projetoNome||'o projeto'}${obs.length?'. '+obs.join(', '):''}`,projetoId:item.projectId,clienteId:item.clientId,ref:'capturas/'+item.id,valor:null,aparelho:'tela da obra',offline:Date.now()-new Date(item.criadoEm).getTime()>120000}}])}
async function filaProcessar(){if(Cap.enviando||!navigator.onLine||!Cap.perfil||!window.__fb)return;const itens=(await filaTodos()).filter(i=>i.autor===Cap.user.email).sort((a,b)=>a.criadoEm.localeCompare(b.criadoEm));if(!itens.length){filaFaixa();return}
 Cap.enviando=true;filaFaixa();try{for(const it of itens){await capturaEnviar(it);await filaTirar(it.id)}}catch(e){console.error('Envio da nota adiado:',e)}finally{Cap.enviando=false;filaFaixa()}}
window.addEventListener('online',()=>{filaFaixa();filaProcessar()});window.addEventListener('offline',filaFaixa);setInterval(filaProcessar,30000);
async function enviar(){const p=Cap.projetos.find(x=>x.id===Cap.obra);if(!p)return;$('#enviar').disabled=true;
 const item={id:uid(),autor:Cap.user.email,autorNome:Cap.user.nome||'',projectId:p.id,clientId:p.clientId||'',projetoNome:p.name,criadoEm:new Date().toISOString(),faltou:Cap.faltou,avariado:Cap.avariado,origem:Cap.fotos.some(f=>f.origem==='compartilhado')?'compartilhado':'camera',fotos:Cap.fotos.map(f=>({blob:f.blob,largura:f.largura,altura:f.altura,chave:f.chave,consultaUrl:f.consultaUrl}))};
 await filaPor(item);limparCaptura();
 let enviado=false;if(navigator.onLine){$('#prontoTexto').innerHTML='<span class="roda"></span><p>Enviando…</p>';mostrar('telaPronto');try{Cap.enviando=true;await capturaEnviar(item);await filaTirar(item.id);enviado=true}catch(e){console.error('Envio adiado:',e)}finally{Cap.enviando=false}}
 $('#prontoTexto').innerHTML=enviado?'<span class="icone">✅</span>Nota enviada!<p>O escritório vai conferir.</p>':'<span class="icone">📦</span>Nota guardada no celular.<p>Ela vai ser enviada sozinha quando tiver internet. Pode fotografar a próxima.</p>';mostrar('telaPronto');filaFaixa()}

// ---------- Fotos compartilhadas (menu Compartilhar do Android) ----------
async function compartilhadasReceber(){const lista=await capOp('compartilhados','readonly',s=>s.getAll());if(!lista?.length)return false;await capOp('compartilhados','readwrite',s=>s.clear());
 history.replaceState(null,'','captura.html');await fotosReceber(lista.map(x=>new File([x.blob],x.nome,{type:x.tipo})),'compartilhado');return true}

// ---------- Login, papel e obras ----------
function aviso(html){$('#avisoTexto').innerHTML=html;mostrar('telaAviso')}
function obrasEscutar(p){Cap.unsubs.forEach(u=>u());Cap.unsubs=[];const mapa=new Map();const atualizar=()=>{Cap.projetos=[...mapa.values()].filter(x=>x.status!=='encerrado').sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'));try{localStorage.setItem(CAP_PROJ_KEY,JSON.stringify(Cap.projetos))}catch(e){}if(Cap.projetos.length===1&&!Cap.obra)Cap.obra=Cap.projetos[0].id;if($('#telaConferir').classList.contains('ativa'))conferirRender()};
 const ouvir=(f)=>Cap.unsubs.push(window.__fb.listen('projects',f,ch=>{ch.forEach(c=>c.type==='removed'?mapa.delete(c.id):mapa.set(c.id,{...c.data,id:c.id}));atualizar()},e=>console.error('Obras:',e)));
 if(p.papel==='admin'){ouvir([]);return}const {pl,cl}=perfilConcessoes(p);fatias(pl).forEach(f=>ouvir([['__id__','in',f]]));fatias(cl).forEach(f=>ouvir([['clientId','in',f]]));if(!pl.length&&!cl.length)atualizar()}
// Funções de acesso iguais às do sistema principal (js/nuvem.js), só o necessário aqui.
const dataDe=v=>v?.toDate?v.toDate():v?new Date(v):null;
function acessoVale(a){if(!a||!a.n)return false;const ate=dataDe(a.ate);return !ate||ate>new Date()}
function perfilConcessoes(p){const pl=[],cl=[];for(const [k,a] of Object.entries(p?.acessos||{})){if(!acessoVale(a))continue;(k.startsWith('p:')?pl:cl).push(k.slice(2))}return {pl,cl}}
const fatias=(l,n=30)=>{const r=[];for(let i=0;i<l.length;i+=n)r.push(l.slice(i,i+n));return r};
let perfilUnsub=null;
function iniciar(){if(!window.__fb){if(window.__fbErro){aviso('<strong>Sem conexão</strong>Não deu para abrir agora. Confira a internet e abra de novo.')}return}
 window.__fb.onAuth(u=>{Cap.user=u;$('#quem').textContent=u?u.email:'';if(perfilUnsub){perfilUnsub();perfilUnsub=null}
  if(!u){Cap.perfil=null;mostrar('telaEntrar');return}
  try{Cap.projetos=JSON.parse(localStorage.getItem(CAP_PROJ_KEY)||'[]')}catch(e){}
  perfilUnsub=window.__fb.listenDoc('usuarios',u.email,async(d,meta)=>{if((meta.fromCache&&!d)||meta.pending)return;
   if(!d){Cap.perfil=null;window.__fb.commit([{op:'set',store:'solicitacoes',id:u.email,data:{email:u.email,nome:u.nome||u.email,pedidoEm:new Date().toISOString()}}]).catch(()=>{});aviso('<strong>Aguardando liberação</strong>Seu pedido foi enviado ao escritório. Quando liberarem, esta tela abre sozinha.');return}
   if(d.ativo!==true){Cap.perfil=null;aviso('<strong>Acesso suspenso</strong>Fale com o escritório.');return}
   if(d.papel==='escritorio'){location.replace('index.html');return}
   const primeira=!Cap.perfil;Cap.perfil=d;obrasEscutar(d);
   if(primeira){if(!(await compartilhadasReceber())&&!Cap.ocupado&&!Cap.fotos.length)mostrar('telaFoto');filaProcessar()}filaFaixa()},
   e=>{aviso('<strong>Não deu para abrir</strong>Tente de novo daqui a pouco. Se continuar, avise o escritório.');console.error(e)})})}
window.addEventListener('tcs-fb',iniciar);if(window.__fb||window.__fbErro)iniciar();
setTimeout(()=>{if(!window.__fb&&$('#telaCarregando').classList.contains('ativa'))aviso('<strong>Sem conexão</strong>Para entrar pela primeira vez, o celular precisa de internet.')},15000);

// ---------- Botões ----------
$('#entrar').addEventListener('click',async()=>{$('#entrarErro').textContent='';try{await window.__fb.login()}catch(e){if(!/popup-closed|cancelled/.test(e.code||''))$('#entrarErro').textContent='Não deu para entrar. Tente de novo.'}});
$('#trocarConta').addEventListener('click',()=>window.__fb.logout());
$('#camera').addEventListener('change',e=>{fotosReceber([...e.target.files],'camera');e.target.value=''});
$('#galeria').addEventListener('change',e=>{fotosReceber([...e.target.files],'galeria');e.target.value=''});
$('#cameraMais').addEventListener('change',e=>{fotosReceber([...e.target.files],'camera');e.target.value=''});
document.addEventListener('change',async e=>{const r=e.target.closest('[data-refazer]');if(!r||!r.files[0])return;const i=+r.dataset.refazer;try{const f=await fotoPreparar(r.files[0],'camera');URL.revokeObjectURL(Cap.fotos[i].url);Cap.fotos[i]=f}catch(err){alert(err.message)}conferirRender()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-obra],[data-tirar],[data-usar]');if(!b)return;
 if(b.dataset.obra){Cap.obra=b.dataset.obra;conferirRender();return}
 if(b.dataset.tirar){const i=+b.dataset.tirar;URL.revokeObjectURL(Cap.fotos[i].url);Cap.fotos.splice(i,1);if(!Cap.fotos.length){limparCaptura();mostrar('telaFoto');return}conferirRender();return}
 if(b.dataset.usar){Cap.fotos[+b.dataset.usar].aceita=true;conferirRender()}});
$('#faltou').addEventListener('click',()=>{Cap.faltou=!Cap.faltou;conferirRender()});
$('#avariado').addEventListener('click',()=>{Cap.avariado=!Cap.avariado;conferirRender()});
$('#enviar').addEventListener('click',enviar);
$('#cancelar').addEventListener('click',()=>{if(Cap.fotos.length&&!confirm('Apagar estas fotos sem enviar?'))return;limparCaptura();mostrar('telaFoto')});
$('#outra').addEventListener('click',()=>{mostrar('telaFoto');$('#camera').click()});
// Sessão: o Firebase guarda o login no celular; a pessoa entra uma vez só.
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(e=>console.warn('Service worker não registrado:',e.message));
// ==== #JS-CAPTURA: END ====
