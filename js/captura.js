// ==== #JS-CAPTURA: START ====
// Tela "Notas da obra" (captura.html), para o papel Obra (e administradores, para teste).
// Fluxo: Ler código da nota (QR, código de barras ou os 44 números) ou Fotografar nota → Qual obra? → Enviar.
// Só com o código, o job buscar-nfce do GitLab CI busca os dados da NFC-e na SEFAZ (servidor/buscar-nfce.mjs); a foto vira opcional. A foto é comprimida no celular (JPEG, lado maior 2400 px, qualidade 0,85),
// o código de barras ou o QR é lido em silêncio, e a nota vai para a fila "capturas" do escritório.
// Sem internet, a nota fica guardada neste celular (IndexedDB 'tcs-captura') e é enviada sozinha quando a conexão voltar.
const Cap={user:null,perfil:null,projetos:[],fotos:[],codigo:null,obras:[],faltou:false,avariado:false,ocupado:false,unsubs:[],enviando:false};
const CAP_PROJ_KEY='tcs-captura-projetos';
const Visor={stream:null,timer:0,det:null,zxing:null,ocupado:false};
const telas=['telaCarregando','telaEntrar','telaAviso','telaFoto','telaCodigo','telaConferir','telaPronto','telaPedir','telaNaObra','telaPedidos'];
function mostrar(id){if(id!=='telaCodigo')visorParar();telas.forEach(t=>$('#'+t).classList.toggle('ativa',t===id));window.scrollTo(0,0)}
$('#versao').textContent=(document.title.match(/V-\d{8}-\d{4}/)||[''])[0];
// Tema claro/escuro (design system Papel e Tinta): sem escolha, segue o celular; o botão do topo fixa e guarda neste aparelho.
function temaAtual(){const t=document.documentElement.dataset.tema;return t||(matchMedia('(prefers-color-scheme: dark)').matches?'escuro':'claro')}
function temaCorBarra(){const c=temaAtual()==='escuro'?'#020617':'#0f172a';document.querySelectorAll('meta[name="theme-color"]').forEach(m=>{m.content=c;m.removeAttribute('media')})}
$('#tema').addEventListener('click',()=>{const t=temaAtual()==='escuro'?'claro':'escuro';document.documentElement.dataset.tema=t;try{localStorage.setItem('tcs-captura-tema',t)}catch(e){}temaCorBarra()});
if(document.documentElement.dataset.tema)temaCorBarra();matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(!document.documentElement.dataset.tema)temaCorBarra()});

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
 Cap.ocupado=false;if(!Cap.fotos.length){mostrar(Cap.codigo?'telaConferir':'telaFoto');return}if(Cap.projetos.length===1)Cap.obras=[Cap.projetos[0].id];conferirRender();mostrar('telaConferir')}
function conferirRender(){const k=Cap.codigo&&chaveDecompor(Cap.codigo.chave);
 $('#codigoLido').innerHTML=Cap.codigo?`<div class="codigo-lido"><span class="icone" aria-hidden="true">✅</span><div><strong>${Cap.codigo.origem==='digitado'?'Números da nota conferidos':'Código da nota lido'}</strong>${k?`<p>Nota nº ${esc(k.numero)}, série ${esc(k.serie)}${k.modelo===65?' (cupom NFC-e)':''}</p>`:''}<p>O escritório busca os dados da nota. A foto é opcional.</p></div><button class="botao secundario" id="codigoOutro" title="Lê o código de novo, se for de outra nota">Ler de novo</button></div>`:'';
 $('#maisFotoTexto').textContent=Cap.codigo&&!Cap.fotos.length?'Fotografar a nota também (opcional)':'Mais uma foto desta nota';
 $('#fotos').innerHTML=Cap.fotos.map((f,i)=>`<div><div class="foto"><img src="${f.url}" alt="Foto ${i+1} da nota"><div class="moldura"></div><button class="botao secundario tirar" data-tirar="${i}" title="Apaga esta foto">Apagar</button></div>
  ${f.aceita?'':`<div class="alerta-foto">${f.pequena?'A foto veio pequena (do WhatsApp?) e o escritório não vai conseguir ler. Fotografe a nota aqui pelo Notas TCS.':f.escura?'A foto ficou escura.':'A foto ficou tremida.'}<div class="botoes"><label class="botao principal" title="Abre a câmera para fotografar de novo">Tirar de novo<input type="file" accept="image/*" capture="environment" data-refazer="${i}" hidden></label><button class="botao secundario" data-usar="${i}" title="Envia esta foto mesmo assim">Usar assim mesmo</button></div></div>`}</div>`).join('');
 $('#obras').innerHTML=Cap.projetos.length?Cap.projetos.map(p=>`<button class="botao obra" data-obra="${esc(p.id)}" aria-pressed="${Cap.obras.includes(p.id)}" title="Marca ou desmarca esta obra; pode marcar mais de uma">${esc(p.name)}</button>`).join(''):'<p class="erro">Nenhuma obra liberada para você. Fale com o escritório.</p>';
 $('#faltou').setAttribute('aria-pressed',Cap.faltou);$('#avariado').setAttribute('aria-pressed',Cap.avariado);
 $('#obrasDica').hidden=Cap.obras.length<2;$('#enviar').disabled=!Cap.obras.length||!(Cap.fotos.length||Cap.codigo)||Cap.fotos.some(f=>!f.aceita)}
function limparCaptura(){Cap.fotos.forEach(f=>URL.revokeObjectURL(f.url));Cap.fotos=[];Cap.codigo=null;Cap.obras=[];Cap.faltou=false;Cap.avariado=false}

// ---------- Código da nota: câmera ao vivo ou os 44 números ----------
// O QR da NFC-e traz o link da consulta (com a chave); o código de barras do DANFE traz a chave. Boleto e PIX são recusados.
function visorParar(){clearTimeout(Visor.timer);Visor.timer=0;if(Visor.stream){Visor.stream.getTracks().forEach(t=>t.stop());Visor.stream=null}$('#visor').srcObject=null}
// Um quadro do vídeo da câmera (ou um canvas, nos testes) → códigos lidos, no formato de codigosLer.
async function quadroLer(video){const achados=[];
 if(!Visor.det&&!Visor.zxing){if('BarcodeDetector' in window){try{const fmts=await BarcodeDetector.getSupportedFormats();const quer=['qr_code','code_128','itf'].filter(f=>fmts.includes(f));if(quer.length)Visor.det=new BarcodeDetector({formats:quer})}catch(e){}}
  if(!Visor.det){const Z=await loadLibrary(...LIB_ZXING);const hints=new Map();hints.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.QR_CODE,Z.BarcodeFormat.CODE_128,Z.BarcodeFormat.ITF]);const leitor=new Z.MultiFormatReader();leitor.setHints(hints);Visor.zxing={Z,leitor}}}
 if(Visor.det){for(const r of await Visor.det.detect(video))achados.push({formato:r.format.replace(/[^a-z0-9]/gi,'').toLowerCase(),texto:r.rawValue});return achados}
 const {Z,leitor}=Visor.zxing;const c=document.createElement('canvas');const vw=video.videoWidth||video.width,vh=video.videoHeight||video.height;const k=Math.min(1,1280/Math.max(vw,vh));c.width=Math.round(vw*k);c.height=Math.round(vh*k);c.getContext('2d').drawImage(video,0,0,c.width,c.height);
 try{const r=leitor.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(c))));achados.push({formato:String(Z.BarcodeFormat[r.getBarcodeFormat()]).replace(/[^a-z0-9]/gi,'').toLowerCase(),texto:r.getText()})}catch(e){}finally{leitor.reset?.()}
 return achados}
async function visorAbrir(){mostrar('telaCodigo');$('#digitarCaixa').hidden=true;$('#digitarErro').textContent='';$('#visorCaixa').hidden=false;$('#codigoStatus').textContent='Abrindo a câmera…';
 if(!navigator.mediaDevices?.getUserMedia){digitarAbrir('Este celular não abre a câmera aqui. Digite os números.');return}
 try{Visor.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});const v=$('#visor');v.srcObject=Visor.stream;await v.play()}
 catch(e){visorParar();if(e.name==='AbortError')return;digitarAbrir(/NotAllowed|Permission/i.test(e.name)?'A câmera não foi liberada. Digite os números, ou libere a câmera nas configurações do Chrome.':'Não deu para abrir a câmera. Digite os números.');return}
 $('#codigoStatus').textContent='Procurando o código…';const passo=async()=>{if(!Visor.stream)return;const v=$('#visor');
  if(v.readyState>=2&&!Visor.ocupado){Visor.ocupado=true;try{const r=codigosResumo(await quadroLer(v));
   if(r.chave){codigoAceitar({chave:r.chave,url:r.url||'',origem:'codigo'});return}
   if(r.descartes.length)$('#codigoStatus').textContent='Esse é '+(/pix/i.test(r.descartes[0])?'o QR do PIX':'o código do boleto')+', não o da nota. Procure o código da nota fiscal.';
   else if(r.lidos)$('#codigoStatus').textContent='Esse código não é da nota fiscal. Procure o QR Code ou o código de barras da nota.'}catch(e){console.warn('Leitura do código:',e)}finally{Visor.ocupado=false}}
  Visor.timer=setTimeout(passo,250)};passo()}
function digitarAbrir(motivo){visorParar();$('#visorCaixa').hidden=true;$('#digitarCaixa').hidden=false;$('#codigoStatus').textContent=motivo||'';$('#digitar').focus()}
function digitarConta(){const d=$('#digitar').value.replace(/\D/g,'');$('#digitarConta').textContent=`${d.length} de 44 números`;$('#digitarErro').textContent='';return d}
function digitarUsar(){const d=digitarConta();if(d.length!==44){$('#digitarErro').textContent=d.length<44?`Faltam ${44-d.length} números.`:`Tem ${d.length-44} números a mais.`;return}
 if(!chaveValida(d)){$('#digitarErro').textContent='Algum número está errado. Confira com a nota e corrija.';return}codigoAceitar({chave:d,url:'',origem:'digitado'})}
function codigoAceitar(c){visorParar();navigator.vibrate?.(120);Cap.codigo=c;if(Cap.projetos.length===1&&!Cap.obras.length)Cap.obras=[Cap.projetos[0].id];conferirRender();mostrar('telaConferir')}

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
 const chave=item.codigo?.chave||item.fotos.map(f=>f.chave).find(Boolean)||'',url=item.codigo?.url||item.fotos.map(f=>f.consultaUrl).find(Boolean)||'';
 await window.__fb.commit([{op:'set',store:'capturas',id:item.id,data:{id:item.id,autor:item.autor,autorNome:item.autorNome,projectId:item.projectId,clientId:item.clientId,projetoNome:item.projetoNome,obras:item.obras||[{projectId:item.projectId,clientId:item.clientId,nome:item.projetoNome}],status:'pendente',capturadoEm:item.criadoEm,enviadoEm:new Date().toISOString(),faltouMaterial:!!item.faltou,veioAvariado:!!item.avariado,observacoes:obs,chave,consultaUrl:url,origem:item.origem,fotos:item.fotos.map((f,i)=>({ordem:i,largura:f.largura,altura:f.altura,bytes:f.blob.size,partes:Math.ceil(Math.ceil(f.blob.size/3)*4/PARTE)}))}},
  // log de atividades (js/atividades.js): o envio pela obra entra no mesmo lote, com id derivado da captura
  {op:'set',store:'atividades',id:'cap-'+item.id,data:{id:'cap-'+item.id,em:new Date().toISOString(),emServidor:window.__fb.agora(),por:item.autor,nome:item.autorNome||item.autor,papel:Cap.perfil?.papel||'obra',cat:'obra',acao:'obra_envio',texto:`Enviou pela obra ${item.codigo?'o código'+(item.fotos.length?` e ${item.fotos.length} foto(s)`:''):item.fotos.length+' foto(s)'} de nota fiscal para ${(item.obras||[]).map(o=>o.nome).join(' e ')||item.projetoNome||'o projeto'}${obs.length?'. '+obs.join(', '):''}`,projetoId:item.projectId,clienteId:item.clientId,ref:'capturas/'+item.id,valor:null,aparelho:'tela da obra',offline:Date.now()-new Date(item.criadoEm).getTime()>120000}}]);buscaDisparar(chave,url)}
// Busca na SEFAZ logo depois do envio: dispara o pipeline do GitLab (o mesmo do "Buscar agora" do escritório), sem esperar
// a rodada de hora em hora. Só para NFC-e com link do QR ou do Ceará pela chave; no máximo uma vez a cada 2 minutos por celular
// (o job busca todas as notas pendentes de uma vez). Sem token configurado, a rodada de hora em hora continua valendo.
async function buscaDisparar(chave,url){const k=chaveDecompor(chave);if(!url&&!(k?.valida&&k.uf===23&&k.modelo===65))return;
 try{const ult=+localStorage.getItem('tcs-busca-disparo')||0;if(Date.now()-ult<120000)return}catch(e){}
 try{const g=await window.__fb.get('config','busca');if(!g?.gatilhoToken)return;const f=new FormData();f.append('token',g.gatilhoToken);f.append('ref',g.ref||'main');
  const r=await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(g.projeto||'87585318')}/trigger/pipeline`,{method:'POST',body:f});if(r.ok)try{localStorage.setItem('tcs-busca-disparo',String(Date.now()))}catch(e){}}
 catch(e){console.warn('Busca na SEFAZ não disparada (a rodada de hora em hora continua):',e.message)}}
async function filaProcessar(){if(Cap.enviando||!navigator.onLine||!Cap.perfil||!window.__fb)return;const itens=(await filaTodos()).filter(i=>i.autor===Cap.user.email).sort((a,b)=>a.criadoEm.localeCompare(b.criadoEm));if(!itens.length){filaFaixa();return}
 Cap.enviando=true;filaFaixa();try{for(const it of itens){await capturaEnviar(it);await filaTirar(it.id)}}catch(e){console.error('Envio da nota adiado:',e)}finally{Cap.enviando=false;filaFaixa()}}
window.addEventListener('online',()=>{filaFaixa();filaProcessar()});window.addEventListener('offline',filaFaixa);setInterval(filaProcessar,30000);
async function enviar(){const obras=Cap.obras.map(id=>Cap.projetos.find(x=>x.id===id)).filter(Boolean).slice(0,5);const p=obras[0];if(!p)return;$('#enviar').disabled=true;
 // a primeira obra marcada é a principal; com mais de uma, o escritório separa os produtos entre elas na conferência
 const item={id:uid(),autor:Cap.user.email,autorNome:Cap.user.nome||'',projectId:p.id,clientId:p.clientId||'',projetoNome:p.name,obras:obras.map(o=>({projectId:o.id,clientId:o.clientId||'',nome:o.name})),criadoEm:new Date().toISOString(),faltou:Cap.faltou,avariado:Cap.avariado,origem:Cap.codigo?Cap.codigo.origem:Cap.fotos.some(f=>f.origem==='compartilhado')?'compartilhado':'camera',codigo:Cap.codigo,fotos:Cap.fotos.map(f=>({blob:f.blob,largura:f.largura,altura:f.altura,chave:f.chave,consultaUrl:f.consultaUrl}))};
 await filaPor(item);limparCaptura();
 let enviado=false;if(navigator.onLine){$('#prontoTexto').innerHTML='<span class="roda"></span><p>Enviando…</p>';mostrar('telaPronto');try{Cap.enviando=true;await capturaEnviar(item);await filaTirar(item.id);enviado=true}catch(e){console.error('Envio adiado:',e)}finally{Cap.enviando=false}}
 $('#prontoTexto').innerHTML=enviado?'<span class="icone">✅</span>Nota enviada!<p>O escritório vai conferir.</p>':'<span class="icone">📦</span>Nota guardada no celular.<p>Ela vai ser enviada sozinha quando tiver internet. Pode fotografar a próxima.</p>';mostrar('telaPronto');filaFaixa()}

// ---------- Fotos compartilhadas (menu Compartilhar do Android) ----------
async function compartilhadasReceber(){const lista=await capOp('compartilhados','readonly',s=>s.getAll());if(!lista?.length)return false;await capOp('compartilhados','readwrite',s=>s.clear());
 history.replaceState(null,'',location.pathname);await fotosReceber(lista.map(x=>new File([x.blob],x.nome,{type:x.tipo})),'compartilhado');return true}

// ---------- Login, papel e obras ----------
function aviso(html){$('#avisoTexto').innerHTML=html;mostrar('telaAviso')}
function obrasEscutar(p){Cap.unsubs.forEach(u=>u());Cap.unsubs=[];const mapa=new Map();const atualizar=()=>{Cap.projetos=[...mapa.values()].filter(x=>x.status!=='encerrado').sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'));try{localStorage.setItem(CAP_PROJ_KEY,JSON.stringify(Cap.projetos))}catch(e){}if(Cap.projetos.length===1&&!Cap.obras.length)Cap.obras=[Cap.projetos[0].id];Cap.obras=Cap.obras.filter(id=>Cap.projetos.some(x=>x.id===id));if($('#telaConferir').classList.contains('ativa'))conferirRender();materialTelas()};
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
   const primeira=!Cap.perfil;Cap.perfil=d;obrasEscutar(d);if(primeira)materialEscutar();
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
 if(b.dataset.obra){const id=b.dataset.obra;Cap.obras=Cap.obras.includes(id)?Cap.obras.filter(x=>x!==id):[...Cap.obras,id].slice(0,5);conferirRender();return}
 if(b.dataset.tirar){const i=+b.dataset.tirar;URL.revokeObjectURL(Cap.fotos[i].url);Cap.fotos.splice(i,1);if(!Cap.fotos.length){limparCaptura();mostrar('telaFoto');return}conferirRender();return}
 if(b.dataset.usar){Cap.fotos[+b.dataset.usar].aceita=true;conferirRender()}});
$('#faltou').addEventListener('click',()=>{Cap.faltou=!Cap.faltou;conferirRender()});
$('#avariado').addEventListener('click',()=>{Cap.avariado=!Cap.avariado;conferirRender()});
$('#enviar').addEventListener('click',enviar);
$('#cancelar').addEventListener('click',()=>{if((Cap.fotos.length||Cap.codigo)&&!confirm(Cap.fotos.length?'Apagar estas fotos sem enviar?':'Cancelar esta nota sem enviar?'))return;limparCaptura();mostrar('telaFoto')});
$('#outra').addEventListener('click',()=>mostrar('telaFoto'));
$('#lerCodigo').addEventListener('click',visorAbrir);
$('#digitarAbrir').addEventListener('click',()=>digitarAbrir(''));
$('#digitar').addEventListener('input',digitarConta);
$('#digitar').addEventListener('keydown',e=>{if(e.key==='Enter')digitarUsar()});
$('#digitarOk').addEventListener('click',digitarUsar);
$('#codigoVoltar').addEventListener('click',()=>mostrar(Cap.fotos.length?'telaConferir':'telaFoto'));
document.addEventListener('click',e=>{if(e.target.closest('#codigoOutro')){Cap.codigo=null;visorAbrir()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&Visor.stream){visorParar();$('#codigoStatus').textContent='Câmera pausada.'}else if(!document.hidden&&$('#telaCodigo').classList.contains('ativa')&&$('#digitarCaixa').hidden)visorAbrir()});

// ---------- Material da obra: pedir, confirmar o uso e devolver ----------
// Três posições (escritório: js/requisicoes.js): ESTOQUE → REQUISITADO (o escritório atende o pedido e entrega) → CONSUMIDO
// (o mestre confirma aqui o que usou). O que sobrar volta ao estoque pela devolução, confirmada pelo escritório.
// Gravação direta no Firestore, com a cópia local dele: sem internet, o pedido fica guardado no celular e sobe sozinho.
const Mt={materiais:[],reqs:new Map(),obra:'',contas:new Map(),naPasso:1,qtd:new Map(),destino:new Map(),passo:1,busca:'',saldo:null,saldoUnsub:null,destinos:null,unsubs:[],guardados:new Set()};// guardados: pedidos ainda não confirmados pelo servidor
const MT_KEY='tcs-captura-materiais',MT_SALDO_KEY='tcs-captura-saldo-',MT_DEST_KEY='tcs-captura-destinos';
const r4c=n=>Math.round(Number(n||0)*1e4)/1e4;
const numc=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
// número digitado: com vírgula, o ponto é milhar (1.250,5); sem vírgula, o ponto é decimal (2.5)
const numDig=v=>{v=String(v||'').trim();return Number(v.includes(',')?v.replace(/\./g,'').replace(',','.'):v)||0};
const normc=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function materialEscutar(){Mt.unsubs.forEach(u=>u());Mt.unsubs=[];try{Mt.materiais=JSON.parse(localStorage.getItem(MT_KEY)||'[]')}catch(e){}
 const mapa=new Map();Mt.unsubs.push(window.__fb.listen('materiais',[['ativo','==',true]],ch=>{ch.forEach(c=>c.type==='removed'?mapa.delete(c.id):mapa.set(c.id,{...c.data,id:c.id}));Mt.materiais=[...mapa.values()].filter(m=>!m.juntadoEm).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));try{localStorage.setItem(MT_KEY,JSON.stringify(Mt.materiais))}catch(e){}materialTelas()},e=>console.warn('Materiais:',e.message)));
 try{Mt.destinos=JSON.parse(localStorage.getItem(MT_DEST_KEY)||'null')}catch(e){}
 Mt.unsubs.push(window.__fb.listenDoc('config','geral',d=>{if(Array.isArray(d?.destinos)&&d.destinos.length){Mt.destinos=d.destinos;try{localStorage.setItem(MT_DEST_KEY,JSON.stringify(d.destinos))}catch(e){}}if($('#telaPedir').classList.contains('ativa'))pedirRender()},()=>{}));
 Mt.unsubs.push(window.__fb.listen('requisicoes',[['autor','==',Cap.user.email]],ch=>{ch.forEach(c=>c.type==='removed'?Mt.reqs.delete(c.id):Mt.reqs.set(c.id,{...c.data,id:c.id}));materialTelas()},e=>console.warn('Pedidos:',e.message)))}
const mtLista=()=>[...Mt.reqs.values()].map(r=>({...r,_pendente:Mt.guardados.has(r.id)})).sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm)));
const mtChave=(i,p)=>i+'_'+p;
function mtDevPendente(rid,i,p){let q=0;for(const d of Mt.reqs.values())if(d.tipo==='devolucao'&&d.status==='pendente')(d.itens||[]).forEach(it=>(it.partes||[]).forEach(x=>{if(x.requisicaoId===rid&&x.i===i&&x.p===p)q+=Number(x.qtd)||0}));return q}
function mtEmMaos(r,i,p){const x=r.itens?.[i]?.partes?.[p];if(!x)return 0;const k=mtChave(i,p);return r4c((Number(x.qtd)||0)-(Number(r.consumo?.[k])||0)-(Number(r.devolvido?.[k])||0)-mtDevPendente(r.id,i,p))}
// material com a obra: por obra e material, as partes (requisição, item, produto) com o que ainda está em mãos
function mtNaObra(pid){const g=new Map();for(const r of mtLista().reverse()){if(r.tipo!=='requisicao'||r.status!=='atendida'||(pid&&r.projectId!==pid))continue;
  (r.itens||[]).forEach((it,i)=>(it.partes||[]).forEach((x,p)=>{const m=mtEmMaos(r,i,p);if(m<=1e-9)return;const k=r.projectId+'|'+it.materialId;
   if(!g.has(k))g.set(k,{chave:k,pid:r.projectId,materialId:it.materialId,nome:it.nome,unidade:it.unidade,total:0,partes:[]});const y=g.get(k);y.total=r4c(y.total+m);y.partes.push({r,i,p,x,emMaos:m})}))}
 return [...g.values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))}
function mtObraAtual(){if(!Cap.projetos.some(p=>p.id===Mt.obra))Mt.obra=Cap.projetos[0]?.id||'';return Cap.projetos.find(p=>p.id===Mt.obra)}
function mtObraChips(el){const ps=Cap.projetos;mtObraAtual();el.hidden=ps.length<2;el.innerHTML=ps.map(p=>`<button class="chip${p.id===Mt.obra?' ativo':''}" data-mt-obra="${esc(p.id)}" aria-pressed="${p.id===Mt.obra}">${esc(p.name)}</button>`).join('')}
function mtAtividade(acao,texto,pid,cid,ref){return {op:'set',store:'atividades',id:'mt-'+uid(),data:null,_a:{acao,texto,pid,cid,ref}}}
function mtAtv(o){const id=o.id;return {op:'set',store:'atividades',id,data:{id,em:new Date().toISOString(),emServidor:window.__fb.agora(),por:Cap.user.email,nome:Cap.user.nome||Cap.user.email,papel:Cap.perfil?.papel||'obra',cat:'obra',acao:o._a.acao,texto:o._a.texto,projetoId:o._a.pid,clienteId:o._a.cid||'',ref:o._a.ref,valor:null,aparelho:'tela da obra',offline:!navigator.onLine}}}
// Envia ao Firestore. Sem internet, a gravação fica na fila do próprio Firestore neste celular e sobe sozinha depois.
async function mtGravar(ops){const lista=ops.map(o=>o._a?mtAtv(o):o);const ids=lista.filter(o=>o.store==='requisicoes'&&o.op==='set').map(o=>o.id);ids.forEach(id=>Mt.guardados.add(id));
 const envio=window.__fb.commit(lista);envio.finally(()=>{ids.forEach(id=>Mt.guardados.delete(id));materialTelas()}).catch(()=>{});
 envio.catch(e=>{console.error('Gravação recusada:',e);alert('O escritório não recebeu a última gravação ('+(e.code==='permission-denied'?'sem permissão para esta obra':e.message)+'). Confira em Meus pedidos.')});
 const ok=await Promise.race([envio.then(()=>true,()=>false),new Promise(r=>setTimeout(()=>r(null),navigator.onLine?6000:300))]);
 return ok===null?'fila':ok?'ok':'erro'}
function mtCodigo(pref){const d=new Date(),z=n=>String(n).padStart(2,'0');return `${pref}-${d.getFullYear()}${z(d.getMonth()+1)}${z(d.getDate())}-${Math.random().toString(36).slice(2,6).toUpperCase()}`}
function mtPronto(icone,titulo,texto){$('#prontoTexto').innerHTML=`<span class="icone">${icone}</span>${titulo}<p>${texto}</p>`;mostrar('telaPronto')}

// ---------- Pedir: tabela do estoque da obra → revisão com o destino → envio ----------
// O estoque vem de saldos_obra/{obra} (js/saldo-obra.js): o disponível por material, sem valores, gravado pelo escritório.
// Sem internet, vale a última cópia guardada neste celular. Quantidade só positiva e até o disponível.
const OUTRO='Outro';
const mtDestinos=()=>[...(Mt.destinos||window.TCS_DESTINOS_PADRAO||[]).filter(d=>d&&d!==OUTRO),OUTRO];
function mtSaldoEscutar(pid){if(Mt.saldo?.pid===pid&&Mt.saldoUnsub)return;Mt.saldoUnsub?.();Mt.saldoUnsub=null;
 let guardado=null;try{guardado=JSON.parse(localStorage.getItem(MT_SALDO_KEY+pid)||'null')}catch(e){}
 Mt.saldo={pid,itens:guardado?.itens||[],atualizadoEm:guardado?.atualizadoEm||'',chegou:!!guardado};if(!pid||!window.__fb)return;
 Mt.saldoUnsub=window.__fb.listenDoc('saldos_obra',pid,(d,meta)=>{if(Mt.saldo?.pid!==pid||(meta.fromCache&&!d))return;
  Mt.saldo={pid,itens:d?.itens||[],atualizadoEm:d?.atualizadoEm||'',chegou:true};try{localStorage.setItem(MT_SALDO_KEY+pid,JSON.stringify({itens:Mt.saldo.itens,atualizadoEm:Mt.saldo.atualizadoEm}))}catch(e){}
  for(const [mid,q] of Mt.qtd){const s=Mt.saldo.itens.find(x=>x.materialId===mid);if(!s)Mt.qtd.delete(mid);else if(q>s.disponivel)Mt.qtd.set(mid,r4c(s.disponivel))}
  if($('#telaPedir').classList.contains('ativa'))pedirRender()},e=>{console.warn('Estoque da obra:',e.message);if(Mt.saldo?.pid===pid){Mt.saldo.chegou=true;Mt.saldo.erro=true;pedirRender()}})}
const mtNoPedido=()=>(Mt.saldo?.itens||[]).filter(s=>(Mt.qtd.get(s.materialId)||0)>0).map(s=>({...s,qtd:Mt.qtd.get(s.materialId)}));
function mtDestinoTexto(mid){const d=Mt.destino.get(mid)||{};return d.sel===OUTRO?String(d.outro||'').trim():d.sel||''}
function pedirRender(){mtObraChips($('#pedirObra'));const p=mtObraAtual();if(p)mtSaldoEscutar(p.id);const dois=Mt.passo===2,lista=mtNoPedido();
 $('#pedirPasso1').hidden=dois;$('#pedirPasso2').hidden=!dois;$('#pedirRevisar').hidden=dois;$('#pedirEnviar').hidden=!dois;
 $('#pedirTitulo').textContent=dois?'Revisar pedido':'Pedir material';$('#pedirObra').classList.toggle('travado',dois);
 if(!dois){const q=normc(Mt.busca).trim(),itens=(Mt.saldo?.itens||[]).filter(s=>!q||normc(s.nome+' '+(s.categoria||'')).includes(q));
  $('#pedirTabela').innerHTML=!Mt.saldo?.chegou?'<div class="espera"><span class="roda"></span><p>Buscando o estoque da obra…</p></div>'
   :!Mt.saldo.itens.length?`<div class="vazio"><span class="icone">📦</span><p>${Mt.saldo.erro?'Não deu para abrir o estoque desta obra.':'Nenhum material no estoque desta obra.'}</p><p class="dica-obras">${Mt.saldo.erro?'Confira a internet. Se continuar, avise o escritório.':'Fale com o escritório.'}</p></div>`
   :`<table class="mat-tabela"><thead><tr><th>Material</th><th class="num">No estoque</th><th class="num">Quantidade</th></tr></thead><tbody>${itens.map(s=>{const v=Mt.qtd.get(s.materialId)||0;
     return `<tr class="${v>0?'com-qtd':''}"><td><span class="mt-nome">${esc(s.nome)}</span>${s.categoria?`<small>${esc(s.categoria)}</small>`:''}</td><td class="num disp">${numc(s.disponivel)} <small>${esc(s.unidade)}</small></td><td class="num"><input class="qtd" inputmode="decimal" enterkeyhint="next" autocomplete="off" value="${v>0?numc(v):''}" placeholder="0" data-mt-qtd="${esc(s.materialId)}" aria-label="Quantidade de ${esc(s.nome)} (no estoque ${numc(s.disponivel)} ${esc(s.unidade)})"></td></tr>`}).join('')||'<tr><td colspan="3" class="dica-obras">Nenhum material com esse nome no estoque da obra.</td></tr>'}</tbody></table>`
   +(Mt.saldo.atualizadoEm?`<p class="mat-atualizado">Estoque atualizado pelo escritório em ${new Date(Mt.saldo.atualizadoEm).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}${navigator.onLine?'':' · sem internet: última cópia'}</p>`:'');
  const n=lista.length;$('#pedirRevisar').disabled=!n||!p;$('#pedirRevisar').textContent=n?`Revisar pedido (${n} ${n===1?'material':'materiais'})`:'Revisar pedido';return}
 const opc=mtDestinos();
 $('#pedirRevisao').innerHTML=`<table class="mat-tabela revisao"><thead><tr><th>Material</th><th class="num">Quantidade</th><th>Destino</th></tr></thead><tbody>${lista.map(s=>{const d=Mt.destino.get(s.materialId)||{};
   return `<tr><td><span class="mt-nome">${esc(s.nome)}</span></td><td class="num"><b>${numc(s.qtd)}</b> <small>${esc(s.unidade)}</small></td><td><select class="destino${d.sel?'':' vazio'}" data-mt-dest="${esc(s.materialId)}" aria-label="Destino de ${esc(s.nome)}"><option value="">Escolha…</option>${opc.map(o=>`<option${o===d.sel?' selected':''}>${esc(o)}</option>`).join('')}</select>${d.sel===OUTRO?`<input class="destino-outro" data-mt-dest-outro="${esc(s.materialId)}" value="${esc(d.outro||'')}" placeholder="Onde?" maxlength="60" aria-label="Outro destino de ${esc(s.nome)}">`:''}</td></tr>`}).join('')}</tbody></table>`;
 $('#pedirEnviar').disabled=!lista.length||lista.some(s=>mtDestinoTexto(s.materialId).length<2)}
function pedirLimpar(){Mt.qtd.clear();Mt.destino.clear();Mt.passo=1;Mt.busca='';$('#pedirBusca').value='';$('#pedirObs').value=''}
async function pedirEnviar(){const p=mtObraAtual(),lista=mtNoPedido();if(!p||!lista.length||lista.some(s=>mtDestinoTexto(s.materialId).length<2))return;$('#pedirEnviar').disabled=true;const id=uid(),codigo=mtCodigo('REQ');
 const itens=lista.map(s=>({materialId:s.materialId,nome:s.nome,unidade:s.unidade,pedida:r4c(s.qtd),destino:mtDestinoTexto(s.materialId)}));
 const doc={id,codigo,tipo:'requisicao',projectId:p.id,clientId:p.clientId||'',projetoNome:p.name,autor:Cap.user.email,autorNome:Cap.user.nome||'',criadoEm:new Date().toISOString(),status:'pendente',obs:$('#pedirObs').value.trim(),itens};
 const r=await mtGravar([{op:'set',store:'requisicoes',id,data:doc},mtAtividade('obra_requisicao',`Pediu material para ${p.name} (${codigo}): ${itens.map(i=>numc(i.pedida)+' '+i.unidade+' de '+i.nome+' ('+i.destino+')').join('; ')}`,p.id,p.clientId,'requisicoes/'+id)]);
 if(r==='erro'){$('#pedirEnviar').disabled=false;return}
 pedirLimpar();
 mtPronto(r==='ok'?'📦':'📶',r==='ok'?'Pedido enviado!':'Pedido guardado no celular.',r==='ok'?`${codigo}. O escritório vai separar o material. Acompanhe em Meus pedidos.`:`${codigo}. Ele vai sozinho quando tiver internet.`)}
// quantidade digitada: só positiva e até o que há no estoque da obra
function mtQtdLer(i){const s=(Mt.saldo?.itens||[]).find(x=>x.materialId===i.dataset.mtQtd);if(!s)return;let v=r4c(Math.max(0,numDig(i.value)));const tr=i.closest('tr');
 if(v>s.disponivel+1e-9){v=r4c(s.disponivel);i.value=numc(v);tr.dataset.aviso=`Máximo ${numc(v)} ${s.unidade}`;setTimeout(()=>delete tr.dataset.aviso,2500)}
 v>0?Mt.qtd.set(s.materialId,v):Mt.qtd.delete(s.materialId);tr.classList.toggle('com-qtd',v>0);const n=mtNoPedido().length;$('#pedirRevisar').disabled=!n;$('#pedirRevisar').textContent=n?`Revisar pedido (${n} ${n===1?'material':'materiais'})`:'Revisar pedido'}

// ---------- Na obra: prestação de contas do material entregue ----------
// Uma tabela por obra com o que está com a obra. Em cada material o mestre informa UM dos dois: o que usou ou o que vai devolver;
// o outro é a diferença, e o material fecha (com a obra = 0). Linha em branco: o material continua com a obra.
// Um botão grava tudo num lote só: as baixas do que foi usado (gasto da obra) e UMA devolução com todos os itens,
// que o escritório confirma quando receber. O uso sai das entregas mais antigas; a devolução, do que sobrar delas.
function mtConta(g){const c=Mt.contas.get(g.chave);if(!c||c.qtd==null)return null;const q=Math.min(g.total,Math.max(0,c.qtd));
 return c.modo==='devolvo'?{usou:r4c(g.total-q),devolve:r4c(q)}:{usou:r4c(q),devolve:r4c(g.total-q)}}
const mtContasDaObra=()=>mtNaObra(Mt.obra).map(g=>({g,c:mtConta(g)})).filter(x=>x.c);
function mtResultado(g){const c=mtConta(g);if(!c)return 'continua com a obra';
 return [c.usou>0?`usou ${numc(c.usou)}`:'',c.devolve>0?`devolve ${numc(c.devolve)}`:''].filter(Boolean).join(' · ')+' '+g.unidade}
function naObraRender(){mtObraChips($('#naObraObra'));const l=mtNaObra(Mt.obra),n=mtContasDaObra().length,resumo=Mt.naPasso===2&&n>0;if(!resumo)Mt.naPasso=1;
 $('#naObraObra').classList.toggle('travado',resumo);
 $('#naObraDica').innerHTML=!l.length?'':resumo?'Confira antes de gravar.':'Para cada material, escolha se vai informar o que <strong>usou</strong> ou o que vai <strong>devolver</strong>, e digite a quantidade. O resto é calculado. Deixe em branco o que ainda está em uso.';
 const btn=$('#naObraRegistrar');btn.hidden=!l.length;btn.disabled=!n;btn.textContent=resumo?'Confirmar e registrar':n?`Registrar (${n} ${n===1?'material':'materiais'})`:'Registrar';
 if(!l.length){$('#naObraLista').innerHTML='<div class="vazio"><span class="icone">🧱</span><p>Nenhum material com a obra agora.</p><p class="dica-obras">Quando o escritório entregar um pedido seu, ele aparece aqui para você prestar contas.</p></div>';return}
 if(resumo){const xs=mtContasDaObra(),usos=xs.filter(x=>x.c.usou>0),devs=xs.filter(x=>x.c.devolve>0);
  const bloco=(tit,dica,lista,k)=>lista.length?`<div class="resumo-bloco"><h3>${tit}</h3><p class="dica-obras">${dica}</p><ul>${lista.map(x=>`<li><span>${esc(x.g.nome)}</span><b>${numc(x.c[k])} ${esc(x.g.unidade)}</b></li>`).join('')}</ul></div>`:'';
  $('#naObraLista').innerHTML=bloco('✔ Usado na obra','Vira gasto da obra.',usos,'usou')+bloco('↩ Devolver ao estoque','Uma devolução só. Leve o material ao estoque: o escritório confirma quando receber.',devs,'devolve');return}
 $('#naObraLista').innerHTML=`<table class="mat-tabela contas"><thead><tr><th>Material</th><th>Informo</th><th class="num">Qtd</th></tr></thead><tbody>${l.map(g=>{const c=Mt.contas.get(g.chave)||{modo:'usei',qtd:null};
  return `<tr data-mt-grupo="${esc(g.chave)}" class="${c.qtd!=null?'com-qtd':''}"><td><span class="mt-nome">${esc(g.nome)}</span><small>com a obra: <b>${numc(g.total)} ${esc(g.unidade)}</b></small><small class="resultado" data-mt-res>${esc(mtResultado(g))}</small></td>
   <td><select class="destino" data-mt-modo aria-label="O que vai informar de ${esc(g.nome)}"><option value="usei"${c.modo==='usei'?' selected':''}>Usei</option><option value="devolvo"${c.modo==='devolvo'?' selected':''}>Devolvo</option></select></td>
   <td class="num"><input class="qtd" inputmode="decimal" autocomplete="off" placeholder="—" value="${c.qtd!=null?numc(c.qtd):''}" data-mt-conta aria-label="Quantidade de ${esc(g.nome)} (com a obra ${numc(g.total)} ${esc(g.unidade)})"></td></tr>`}).join('')}</tbody></table>`}
// lê a linha da tabela: quantidade de 0 até o que está com a obra; em branco, o material fica de fora
function mtContaLer(tr){const g=mtNaObra(Mt.obra).find(x=>x.chave===tr.dataset.mtGrupo);if(!g)return;const modo=tr.querySelector('[data-mt-modo]').value,i=tr.querySelector('[data-mt-conta]');const txt=i.value.trim();
 let qtd=txt===''?null:r4c(Math.max(0,numDig(txt)));if(qtd!=null&&qtd>g.total){qtd=g.total;i.value=numc(qtd);tr.dataset.aviso=`Máximo ${numc(g.total)} ${g.unidade}`;setTimeout(()=>delete tr.dataset.aviso,2500)}
 Mt.contas.set(g.chave,{modo,qtd});tr.classList.toggle('com-qtd',qtd!=null);tr.querySelector('[data-mt-res]').textContent=mtResultado(g);
 const n=mtContasDaObra().length,btn=$('#naObraRegistrar');btn.disabled=!n;btn.textContent=n?`Registrar (${n} ${n===1?'material':'materiais'})`:'Registrar'}
async function naObraGravar(){const xs=mtContasDaObra();if(!xs.length)return;const p=Cap.projetos.find(x=>x.id===Mt.obra)||{id:Mt.obra,name:''};
 const ops=[],consumo=new Map(),hoje=new Date().toISOString(),itensDev=[];let cid='';
 for(const {g,c} of xs){let falta=c.usou;const resto=[];cid=cid||g.partes[0].r.clientId;
  for(const y of g.partes){const t=r4c(Math.min(falta,y.emMaos));falta=r4c(falta-t);if(y.emMaos-t>1e-9)resto.push({y,q:r4c(y.emMaos-t)});if(t<=1e-9)continue;
   const k=mtChave(y.i,y.p),mapa=consumo.get(y.r.id)||{...(y.r.consumo||{})};mapa[k]=r4c((Number(mapa[k])||0)+t);consumo.set(y.r.id,mapa);const dest=y.r.itens?.[y.i]?.destino;
   const mid='con-'+uid();ops.push({op:'set',store:'movements',id:mid,data:{id:mid,type:'SAIDA',requisicaoId:y.r.id,productId:y.x.productId,projectId:y.r.projectId,clientId:y.r.clientId,quantity:t,unitCost:Number(y.x.unitCost)||0,date:hoje.slice(0,10),note:`Uso confirmado pela obra · ${y.r.codigo}${dest?' · Destino: '+dest:''}`,description:g.nome,createdAt:hoje,criadoPor:Cap.user.email,criadoPorNome:Cap.user.nome||'',origem:'obra',_atualizadoEm:hoje,_atualizadoPor:Cap.user.email}})}
  let dev=c.devolve;const partes=[];for(const {y,q} of resto){if(dev<=1e-9)break;const t=r4c(Math.min(dev,q));dev=r4c(dev-t);partes.push({requisicaoId:y.r.id,i:y.i,p:y.p,productId:y.x.productId,qtd:t})}
  if(partes.length)itensDev.push({materialId:g.materialId,nome:g.nome,unidade:g.unidade,pedida:c.devolve,partes})}
 for(const [rid,mapa] of consumo)ops.push({op:'update',store:'requisicoes',id:rid,data:{consumo:mapa,consumoEm:hoje,_atualizadoEm:hoje,_atualizadoPor:Cap.user.email}});
 let codigo='',devId='';if(itensDev.length){const id=devId=uid();codigo=mtCodigo('DEV');ops.push({op:'set',store:'requisicoes',id,data:{id,codigo,tipo:'devolucao',projectId:p.id,clientId:p.clientId||cid,projetoNome:p.name,autor:Cap.user.email,autorNome:Cap.user.nome||'',criadoEm:hoje,status:'pendente',obs:'',itens:itensDev}})}
 const usos=xs.filter(x=>x.c.usou>0),devs=xs.filter(x=>x.c.devolve>0);
 ops.push(mtAtividade('obra_prestacao',`Prestou contas do material de ${p.name}: ${[usos.length?'usou '+usos.map(x=>numc(x.c.usou)+' '+x.g.unidade+' de '+x.g.nome).join(', '):'',devs.length?`devolve (${codigo}) `+devs.map(x=>numc(x.c.devolve)+' '+x.g.unidade+' de '+x.g.nome).join(', '):''].filter(Boolean).join('; ')}`,p.id,p.clientId||cid,devId?'requisicoes/'+devId:'movements'));
 return {r:await mtGravar(ops),usos,devs,codigo}}

// ---------- Meus pedidos ----------
const MT_SIT={pendente:['Aguardando o escritório','espera'],atendida:['Entregue','ok'],recusada:['Recusado','risco'],cancelada:['Cancelado','neutro'],recebida:['Recebida no estoque','ok']};
function pedidosRender(){const l=mtLista();
 $('#pedidosLista').innerHTML=l.length?l.map(r=>{const dev=r.tipo==='devolucao',[sit,cls]=MT_SIT[r.status]||[r.status,'neutro'],obra=Cap.projetos.find(p=>p.id===r.projectId)?.name||r.projetoNome||'';
  const itens=(r.itens||[]).map((it,i)=>{let det='';if(!dev&&r.status==='atendida'){let ent=0,con=0,devv=0,mao=0;(it.partes||[]).forEach((x,p)=>{const k=mtChave(i,p);ent+=Number(x.qtd)||0;con+=Number(r.consumo?.[k])||0;devv+=Number(r.devolvido?.[k])||0;mao+=mtEmMaos(r,i,p)});det=`<small>entregue ${numc(ent)} · usado ${numc(con)}${devv?` · devolvido ${numc(devv)}`:''}${mao>1e-9?` · <b>com a obra ${numc(mao)}</b>`:''}</small>`}
   else if(dev&&r.status==='recebida')det=`<small>recebido ${numc(it.recebida)}</small>`;
   return `<li><span>${esc(it.nome)}${it.destino?`<small class="pedido-destino">${esc(it.destino)}</small>`:''}${det}</span><b>${numc(it.pedida)} ${esc(it.unidade)}</b></li>`}).join('');
  return `<div class="pedido ${cls}"><div class="pedido-cab"><span class="pedido-tipo">${dev?'↩ Devolução':'📦 Pedido'}</span><span class="pedido-sit">${r._pendente?'📶 Guardado no celular':sit}</span></div><div class="pedido-sub">${esc(r.codigo||'')} · ${esc(obra)} · ${new Date(r.criadoEm).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div><ul>${itens}</ul>${r.motivoRecusa?`<p class="pedido-motivo">Motivo: ${esc(r.motivoRecusa)}</p>`:''}${r.status==='pendente'&&!r._pendente?`<button class="botao texto" data-mt-cancelar="${esc(r.id)}">Cancelar ${dev?'devolução':'pedido'}</button>`:''}</div>`}).join('')
  :'<div class="vazio"><span class="icone">📋</span><p>Nenhum pedido ainda.</p></div>'}
function materialTelas(){if(!Cap.user)return;const na=mtNaObra('').length,pend=mtLista().filter(r=>r.status==='pendente').length;
 const sel=(id,n)=>{const e=$(id);if(e){e.hidden=!n;e.textContent=n}};sel('#naObraConta',na);sel('#pedidosConta',pend);
 if($('#telaPedir').classList.contains('ativa'))pedirRender();if($('#telaNaObra').classList.contains('ativa'))naObraRender();if($('#telaPedidos').classList.contains('ativa'))pedidosRender()}

$('#pedirMaterial').addEventListener('click',()=>{mtObraAtual();Mt.passo=1;pedirRender();mostrar('telaPedir')});
$('#naObra').addEventListener('click',()=>{mtObraAtual();if(!mtNaObra(Mt.obra).length){const c=mtNaObra('')[0];if(c)Mt.obra=c.pid}Mt.contas.clear();Mt.naPasso=1;naObraRender();mostrar('telaNaObra')});
$('#meusPedidos').addEventListener('click',()=>{pedidosRender();mostrar('telaPedidos')});
$('#pedidosVoltar').addEventListener('click',()=>mostrar('telaFoto'));
// Na obra: do resumo volta à tabela (as quantidades ficam); da tabela, à tela inicial
$('#naObraVoltar').addEventListener('click',()=>{if(Mt.naPasso===2){Mt.naPasso=1;naObraRender();return}if(mtContasDaObra().length&&!confirm('Sair sem registrar? As quantidades digitadas serão apagadas.'))return;Mt.contas.clear();mostrar('telaFoto')});
$('#naObraRegistrar').addEventListener('click',async()=>{document.activeElement?.blur?.();document.querySelectorAll('#naObraLista tr[data-mt-grupo]').forEach(mtContaLer);if(!mtContasDaObra().length)return;
 if(Mt.naPasso!==2){Mt.naPasso=2;naObraRender();window.scrollTo(0,0);return}
 const b=$('#naObraRegistrar');b.disabled=true;const x=await naObraGravar();if(x.r==='erro'){b.disabled=false;return}navigator.vibrate?.(120);Mt.contas.clear();Mt.naPasso=1;
 mtPronto(x.devs.length?'↩️':'✅','Registrado!',[x.usos.length?`${x.usos.length===1?'1 material lançado':x.usos.length+' materiais lançados'} como gasto da obra.`:'',x.devs.length?`Devolução ${x.codigo}: leve ${x.devs.map(y=>numc(y.c.devolve)+' '+y.g.unidade+' de '+y.g.nome).join(', ')} ao estoque. O escritório confirma quando receber.`:''].filter(Boolean).join(' ')+(x.r==='fila'?' Sem internet agora: vai sozinho depois.':''))});
// Voltar: da revisão volta à tabela (as quantidades ficam); da tabela, à tela inicial
$('#pedirVoltar').addEventListener('click',()=>{if(Mt.passo===2){Mt.passo=1;pedirRender();window.scrollTo(0,0);return}if(Mt.qtd.size&&!confirm('Sair sem enviar o pedido? As quantidades digitadas serão apagadas.'))return;pedirLimpar();mostrar('telaFoto')});
$('#pedirRevisar').addEventListener('click',()=>{document.activeElement?.blur?.();document.querySelectorAll('[data-mt-qtd]').forEach(mtQtdLer);if(!mtNoPedido().length)return;Mt.passo=2;pedirRender();window.scrollTo(0,0)});
$('#pedirBusca').addEventListener('input',e=>{Mt.busca=e.target.value;pedirRender()});
$('#pedirEnviar').addEventListener('click',pedirEnviar);
document.addEventListener('click',async e=>{const b=e.target.closest('[data-mt-obra],[data-mt-cancelar]');if(!b)return;const d=b.dataset;
 if(d.mtObra){if($('#telaPedir').classList.contains('ativa')){if(Mt.passo===2||d.mtObra===Mt.obra)return;if(Mt.qtd.size&&!confirm('Trocar de obra? As quantidades digitadas serão apagadas.'))return;Mt.qtd.clear();Mt.destino.clear();Mt.obra=d.mtObra;pedirRender()}else{if(Mt.naPasso===2||d.mtObra===Mt.obra)return;if(mtContasDaObra().length&&!confirm('Trocar de obra? As quantidades digitadas serão apagadas.'))return;Mt.contas.clear();Mt.obra=d.mtObra;naObraRender()}return}
 if(d.mtCancelar){const r=Mt.reqs.get(d.mtCancelar);if(!r||!confirm(`Cancelar ${r.tipo==='devolucao'?'a devolução':'o pedido'} ${r.codigo}?`))return;const agora=new Date().toISOString();
  await mtGravar([{op:'update',store:'requisicoes',id:r.id,data:{status:'cancelada',canceladoEm:agora,_atualizadoEm:agora,_atualizadoPor:Cap.user.email}},mtAtividade('obra_cancelamento',`Cancelou ${r.tipo==='devolucao'?'a devolução':'o pedido'} ${r.codigo}`,r.projectId,r.clientId,'requisicoes/'+r.id)]);pedidosRender()}});
document.addEventListener('change',e=>{const i=e.target.closest?.('[data-mt-qtd]');if(i){mtQtdLer(i);return}
 const tr=e.target.closest?.('#naObraLista tr[data-mt-grupo]');if(tr){mtContaLer(tr);return}
 const s=e.target.closest?.('[data-mt-dest]');if(s){const d={...(Mt.destino.get(s.dataset.mtDest)||{}),sel:s.value};Mt.destino.set(s.dataset.mtDest,d);pedirRender();if(d.sel===OUTRO)document.querySelector(`[data-mt-dest-outro="${CSS.escape(s.dataset.mtDest)}"]`)?.focus()}});
// Enter no campo de quantidade passa para o próximo, como no teclado de uma planilha
document.addEventListener('keydown',e=>{const i=e.target.closest?.('[data-mt-qtd]');if(!i||e.key!=='Enter')return;e.preventDefault();mtQtdLer(i);const l=[...document.querySelectorAll('[data-mt-qtd]')];const prox=l[l.indexOf(i)+1];prox?prox.focus():i.blur()});
document.addEventListener('input',e=>{const o=e.target.closest?.('[data-mt-dest-outro]');if(!o)return;Mt.destino.set(o.dataset.mtDestOutro,{...(Mt.destino.get(o.dataset.mtDestOutro)||{}),sel:OUTRO,outro:o.value});const l=mtNoPedido();$('#pedirEnviar').disabled=!l.length||l.some(s=>mtDestinoTexto(s.materialId).length<2)});
// Sessão: o Firebase guarda o login no celular; a pessoa entra uma vez só.
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(e=>console.warn('Service worker não registrado:',e.message));
// ==== #JS-CAPTURA: END ====
