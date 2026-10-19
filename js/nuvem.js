// ---------- Nuvem (Firebase): envio das gravações locais e recebimento em tempo real ----------
// ==== #JS-ACESSO-SYNC: START ====
// Depois do login, o sistema lê o cadastro usuarios/{email}. Com o cadastro ativo, escuta só o que o papel e as concessões
// permitem (planoEscuta), em consultas que as regras do Firestore aceitam. Cada documento local sabe por quais escutas chegou;
// quando nenhuma o mantém, sai da cópia local. Notas fechadas com projetos de terceiros chegam só pelas projeções (js/escopo.js).
const Nuvem={estado:'local',user:null,perfil:null,unsubs:[],docs:{},escutas:new Map(),prontas:new Set(),falhas:new Set(),planoChave:'',docNotas:new Map(),reconciliado:false,enviados:new Set(),enviadosAuto:0,removidosAuto:0,fila:Promise.resolve(),pendentes:0,erro:'',aviso:'',iniciada:false,unsubPerfil:null,acessoMarcado:false};
let refreshTimer=null;function refreshSoon(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh().catch(e=>console.error(e)),150)}
function nuvemConectada(){return !!Nuvem.user&&!!Nuvem.perfil&&(Nuvem.estado==='online'||Nuvem.estado==='conectando')}
const PAPEL_LABEL={admin:'Administrador',escritorio:'Escritório',obra:'Obra'};
const ADMINS_INICIAIS=(window.TCS_ADMINS_INICIAIS||[]).map(e=>String(e).toLowerCase());
const dataDe=v=>v?.toDate?v.toDate():v?new Date(v):null;
function acessoVale(a){if(!a||!a.n)return false;const ate=dataDe(a.ate);return !ate||ate>new Date()}
// Concessões vigentes: projetos, clientes e o nível de cada chave ('p:<id>' ou 'c:<id>').
function perfilConcessoes(p){const pl=[],cl=[],nivel={};for(const [k,a] of Object.entries(p?.acessos||{})){if(!acessoVale(a))continue;nivel[k]=a.n;(k.startsWith('p:')?pl:cl).push(k.slice(2))}return {pl:pl.sort(),cl:cl.sort(),nivel}}
function escritorVigente(p){if(!p)return false;if(p.papel==='admin')return true;const ate=dataDe(p.escAte);return p.papel==='escritorio'&&p.esc===true&&(!ate||ate>new Date())}
const ehAdmin=()=>!Nuvem.perfil||Nuvem.perfil.papel==='admin';
// Sem nuvem (modo local), tudo é permitido, como antes.
function podeLerProjeto(pid){const p=Nuvem.perfil;if(!p||p.papel==='admin')return true;const {nivel}=perfilConcessoes(p);return !!(nivel['p:'+pid]||nivel['c:'+projectById(pid)?.clientId])}
function podeGravarProjeto(pid){const p=Nuvem.perfil;if(!p||p.papel==='admin')return true;if(p.papel!=='escritorio')return false;const {nivel}=perfilConcessoes(p);return nivel['p:'+pid]==='E'||nivel['c:'+projectById(pid)?.clientId]==='E'}
function podeGravarCliente(cid){const p=Nuvem.perfil;if(!p||p.papel==='admin')return true;return p.papel==='escritorio'&&perfilConcessoes(p).nivel['c:'+cid]==='E'}
const podeEscrever=()=>!Nuvem.perfil||escritorVigente(Nuvem.perfil);
const fatias=(l,n=30)=>{const r=[];for(let i=0;i<l.length;i+=n)r.push(l.slice(i,i+n));return r};
function planoEscuta(p,email){const P=[];const add=(store,filtros)=>P.push({k:store+'|'+JSON.stringify(filtros||[]),store,filtros:filtros||null});
 if(p.papel==='admin'){STORES.forEach(s=>add(s));return P}
 const {pl,cl}=perfilConcessoes(p);const porProj=(s,extra=[])=>{fatias(pl).forEach(f=>add(s,[...extra,['projectId','in',f]]));fatias(cl).forEach(f=>add(s,[...extra,['clientId','in',f]]))};
 fatias(pl).forEach(f=>add('projects',[['__id__','in',f]]));fatias(cl).forEach(f=>add('projects',[['clientId','in',f]]));
 if(p.papel!=='escritorio')return P;
 fatias(p.clv||[]).forEach(f=>add('clients',[['__id__','in',f]]));
 porProj('allocations');porProj('notas_projeto');porProj('movements',[['type','==','SAIDA']]);porProj('quotes');add('quotes',[['criadoPor','==',email]]);add('products');
 if(escritorVigente(p)){add('invoices',[['escopo','==','aberta']]);add('allocations',[['escopo','==','aberta']]);add('movements',[['type','==','ENTRADA'],['escopo','==','aberta']])}
 return P}
function nuvemEnviar(ops){const email=Nuvem.user?.email||'',agora=new Date().toISOString();const lista=ops.filter(o=>o.op!=='clear').map(o=>o.op==='delete'?{op:'delete',store:o.store,id:String(o.id)}:{op:'set',store:o.store,id:String(o.id),data:{...o.obj,_atualizadoEm:agora,_atualizadoPor:email}});if(!lista.length)return Promise.resolve();
 const marcas=lista.map(o=>o.store+'|'+o.id);marcas.forEach(m=>Nuvem.enviados.add(m));Nuvem.pendentes+=lista.length;nuvemRender();
 return window.__fb.commit(lista).then(()=>{Nuvem.pendentes-=lista.length;marcas.forEach(m=>Nuvem.enviados.delete(m));nuvemRender()},e=>{Nuvem.pendentes-=lista.length;marcas.forEach(m=>Nuvem.enviados.delete(m));return nuvemRecusada(lista,e)})}
// Gravação recusada (regras de acesso, nota repetida ou falha): os registros novos saem da cópia local e a base é relida do servidor.
async function nuvemRecusada(lista,e){console.error('Gravação recusada pela nuvem:',e);
 Nuvem.aviso=e.code==='permission-denied'?'Uma alteração não foi aceita: ela envolve um cliente ou projeto sem permissão de escrita para você, ou a nota já foi lançada por outra pessoa. Nada foi gravado na nuvem, e a tela voltou a mostrar os dados atuais.':'Não foi possível gravar na nuvem agora ('+(e.message||e)+'). A tela voltou a mostrar os dados atuais; tente de novo.';
 const novos=lista.filter(o=>o.op==='set'&&!Nuvem.docs[o.store]?.has(o.id));for(const s of new Set(novos.map(o=>o.store)))await txWrite(s,os=>novos.filter(o=>o.store===s).forEach(o=>os[s].delete(o.id)),{local:true}).catch(()=>{});
 if(Nuvem.perfil)nuvemEscutar(true);refreshSoon();nuvemRender()}
// Alterações feitas sem sessão na nuvem (modo offline) ficam numa fila neste navegador e sobem sozinhas no próximo login, antes de a nuvem ser lida.
const FILA_KEY='tcs-pendentes-nuvem';
function filaLer(){try{return JSON.parse(localStorage.getItem(FILA_KEY)||'[]')}catch(e){return []}}
function filaGravar(l){try{l.length?localStorage.setItem(FILA_KEY,JSON.stringify(l)):localStorage.removeItem(FILA_KEY)}catch(e){}}
onLocalCommit=ops=>{if(nuvemConectada())nuvemEnviar(ops);else if(window.TCS_FIREBASE_CONFIG)filaGravar(filaLer().concat(ops.filter(o=>o.op!=='clear').map(o=>({op:o.op,store:o.store,id:String(o.id)}))))};
async function nuvemEnviarFila(){const fila=filaLer();if(!fila.length)return;const ult=new Map();fila.forEach(o=>ult.set(o.store+'|'+o.id,o));const ops=[];for(const o of ult.values()){if(!STORES.includes(o.store))continue;const r=(await all(o.store)).find(x=>String(x.id)===o.id);ops.push(o.op==='delete'||!r?{op:'delete',store:o.store,id:o.id}:{op:'set',store:o.store,id:o.id,obj:r})}filaGravar([]);Nuvem.enviadosAuto+=ops.length;nuvemEnviar(ops)}
// Depois da primeira leitura completa do servidor: o que nenhuma escuta trouxe sai da cópia local (excluído por outra pessoa
// ou fora do acesso). Exceção: para administradores, registro que nunca passou pela nuvem (sem _atualizadoEm) sobe sozinho.
async function nuvemReconciliar(){let env=0,rem=0;const admin=Nuvem.perfil?.papel==='admin';for(const s of STORES){const m=Nuvem.docs[s]||new Map();const faltam=(await all(s)).filter(r=>!m.has(String(r.id))&&!Nuvem.enviados.has(s+'|'+r.id));const enviar=admin?faltam.filter(r=>!r._atualizadoEm):[];const apagar=faltam.filter(r=>!enviar.includes(r));if(apagar.length){await txWrite(s,os=>apagar.forEach(r=>os[s].delete(r.id)),{local:true});rem+=apagar.length}if(enviar.length){nuvemEnviar(enviar.map(r=>({op:'set',store:s,id:r.id,obj:r})));env+=enviar.length}}Nuvem.enviadosAuto+=env;Nuvem.removidosAuto+=rem;refreshSoon();nuvemRender()}
function nuvemParar(){Nuvem.unsubs.forEach(u=>{try{u()}catch(e){}});Nuvem.unsubs=[];Nuvem.docNotas.forEach(u=>{try{u()}catch(e){}});Nuvem.docNotas=new Map();Nuvem.escutas=new Map();Nuvem.prontas=new Set();Nuvem.falhas=new Set();Nuvem.reconciliado=false;Nuvem.docs={};Nuvem.planoChave=''}
// Aplica na cópia local as mudanças de uma escuta (k). Um documento só sai quando nenhuma escuta o mantém.
function escutaAplicar(store,k,ch){const m=Nuvem.docs[store]||(Nuvem.docs[store]=new Map());const put=[],del=[];
 for(const c of ch){let s=m.get(c.id);if(c.type==='removed'){if(s){s.delete(k);if(!s.size){m.delete(c.id);if(!c.pending)del.push(c.id)}}}else{if(!s)m.set(c.id,s=new Set());s.add(k);if(!c.pending)put.push({...c.data,id:c.data.id??c.id})}}
 if(put.length||del.length)Nuvem.fila=Nuvem.fila.then(()=>txWrite(store,os=>{put.forEach(o=>os[store].put(o));del.forEach(id=>os[store].delete(id))},{local:true})).then(refreshSoon,e=>console.error('Falha ao aplicar dados da nuvem:',e))}
function escutaPronta(k,servidor){if(servidor)Nuvem.prontas.add(k);
 if(!Nuvem.reconciliado&&Nuvem.escutas.size&&[...Nuvem.escutas.keys()].every(x=>Nuvem.prontas.has(x)||Nuvem.falhas.has(x))){Nuvem.reconciliado=true;if(Nuvem.estado==='conectando')Nuvem.estado='online';Nuvem.fila=Nuvem.fila.then(nuvemReconciliar).catch(e=>console.error('Falha ao conferir registros locais:',e));nuvemMarcarAcesso()}
 nuvemRender()}
function nuvemEscutar(forcar){const p=Nuvem.perfil;if(!p)return;const plano=planoEscuta(p,Nuvem.user.email);const chave=plano.map(x=>x.k).sort().join('\n');if(!forcar&&chave===Nuvem.planoChave)return;
 nuvemParar();Nuvem.planoChave=chave;Nuvem.estado='conectando';
 if(!plano.length){Nuvem.reconciliado=true;Nuvem.estado='online';Nuvem.fila=Nuvem.fila.then(nuvemReconciliar);nuvemMarcarAcesso();nuvemRender();return}
 for(const e of plano){Nuvem.escutas.set(e.k,e);Nuvem.unsubs.push(window.__fb.listen(e.store,e.filtros||[],(ch,meta={})=>{escutaAplicar(e.store,e.k,ch);if(e.store==='notas_projeto')nuvemNotasInteiras();escutaPronta(e.k,!meta.fromCache)},err=>{console.error('Escuta recusada ('+e.k+'):',err);Nuvem.falhas.add(e.k);escutaAplicar(e.store,e.k,[...(Nuvem.docs[e.store]||new Map()).entries()].filter(([,s])=>s.has(e.k)).map(([id])=>({type:'removed',id})));escutaPronta(e.k,false)}))}
 nuvemRender()}
// Notas fechadas que aparecem pelas projeções: se as regras deixarem ler a nota inteira (todos os projetos dela concedidos), ela é escutada inteira.
function nuvemNotasInteiras(){if(!Nuvem.perfil||Nuvem.perfil.papel==='admin')return;const ids=new Set([...(Nuvem.docs.notas_projeto||new Map()).keys()].map(id=>id.split('__')[0]));
 for(const id of ids){if(Nuvem.docNotas.has(id))continue;const k='doc:'+id;Nuvem.docNotas.set(id,window.__fb.listenDoc('invoices',id,(d,meta)=>{escutaAplicar('invoices',k,d?[{type:'added',id,data:d,pending:meta.pending}]:[{type:'removed',id}])},()=>{escutaAplicar('invoices',k,[{type:'removed',id}])}))}}
// Registra a data do último acesso no próprio cadastro (uma vez por sessão).
function nuvemMarcarAcesso(){if(Nuvem.acessoMarcado||!Nuvem.user)return;Nuvem.acessoMarcado=true;window.__fb.commit([{op:'update',store:'usuarios',id:Nuvem.user.email,data:{ultimoAcesso:new Date().toISOString()}}]).catch(e=>console.warn('Último acesso não registrado:',e.message))}
// Cópia local de outra conta (computador compartilhado) ou de acesso suspenso: apagada antes de qualquer leitura.
const USUARIO_LOCAL_KEY='tcs-usuario-local';
async function nuvemLimparLocal(){for(const s of STORES)await clearStore(s,{local:true});filaGravar([]);await refresh()}
async function nuvemPerfil(d){const u=Nuvem.user;if(!u)return;
 if(!d){Nuvem.perfil=null;nuvemParar();
  if(ADMINS_INICIAIS.includes(u.email)){Nuvem.estado='implantando';nuvemRender();try{const adm=await window.__fb.get('config','admins').catch(()=>null);await window.__fb.commit([{op:'set',store:'usuarios',id:u.email,data:{email:u.email,nome:u.nome,papel:'admin',ativo:true,acessos:{},criadoEm:new Date().toISOString(),criadoPor:'implantação'}},{op:'set',store:'config',id:'admins',data:{lista:[...new Set([...(adm?.lista||[]),u.email])]}}])}catch(e){Nuvem.estado='negado';Nuvem.erro=e.message;nuvemRender()}return}
  Nuvem.estado='aguardando';nuvemRender();window.__fb.commit([{op:'set',store:'solicitacoes',id:u.email,data:{email:u.email,nome:u.nome||u.email,pedidoEm:new Date().toISOString()}}]).catch(e=>console.warn('Solicitação de acesso não registrada:',e.message));return}
 if(d.ativo!==true){const tinha=!!Nuvem.perfil;Nuvem.perfil=null;nuvemParar();Nuvem.estado='suspenso';nuvemRender();await nuvemLimparLocal();try{localStorage.removeItem(USUARIO_LOCAL_KEY)}catch(e){}if(tinha)await window.__fb.limparCache();return}
 let local='';try{local=localStorage.getItem(USUARIO_LOCAL_KEY)||''}catch(e){}if(local&&local!==u.email)await nuvemLimparLocal();try{localStorage.setItem(USUARIO_LOCAL_KEY,u.email)}catch(e){}
 const antes=Nuvem.perfil?perfilConcessoes(Nuvem.perfil):null,agora=perfilConcessoes(d);
 const perdeu=antes&&(Nuvem.perfil.papel!==d.papel||antes.pl.some(x=>!agora.pl.includes(x))||antes.cl.some(x=>!agora.cl.includes(x))||(escritorVigente(Nuvem.perfil)&&!escritorVigente(d)));
 Nuvem.perfil=d;document.body.dataset.papel=d.papel;document.body.dataset.escritor=escritorVigente(d)?'sim':'nao';
 // Acesso reduzido: a cópia local e o cache do Firestore são apagados e a página recarrega com o acesso novo.
 if(perdeu){Nuvem.estado='revogado';nuvemRender();nuvemParar();await nuvemLimparLocal();await window.__fb.limparCache();location.reload();return}
 if(d.papel==='obra'){Nuvem.estado='obra';nuvemRender();return}
 if(!Nuvem.planoChave)await nuvemEnviarFila().catch(e=>console.error('Falha ao enviar alterações offline:',e));
 nuvemEscutar();render()}
function nuvemIniciar(){if(Nuvem.iniciada||!window.__fb||!db)return;Nuvem.iniciada=true;window.__fb.onAuth(u=>{gateAuthVisto=true;// troca de conta: as escutas da conta anterior (administração e fila da obra) param na hora
  admDesligar();Adm.msg='';filaDesligar();Fila.msg='';Nuvem.user=u;Nuvem.erro='';Nuvem.aviso='';Nuvem.acessoMarcado=false;if(Nuvem.unsubPerfil){Nuvem.unsubPerfil();Nuvem.unsubPerfil=null}
  if(u){Nuvem.estado='perfil';Nuvem.unsubPerfil=window.__fb.listenDoc('usuarios',u.email,(d,meta)=>{if((meta.fromCache&&!d)||meta.pending)return;nuvemPerfil(d).catch(e=>console.error(e))},e=>{Nuvem.estado='negado';Nuvem.erro=e.message;nuvemParar();nuvemRender()})}
  else{nuvemParar();Nuvem.perfil=null;delete document.body.dataset.papel;delete document.body.dataset.escritor;Nuvem.estado='local'}nuvemRender()})}
window.addEventListener('tcs-fb',()=>{nuvemIniciar();nuvemRender()});
// ==== #JS-ACESSO-SYNC: END ====
// Um clique a mais durante o login abre outro pedido e cancela o primeiro (auth/cancelled-popup-request): enquanto a janela do Google estiver aberta, novos cliques só a trazem para a frente.
let loginAberto=false;
async function nuvemLogin(){if(loginAberto){Nuvem.aviso='A janela de login do Google já está aberta. Conclua o login nela (ela pode estar atrás desta janela).';nuvemRender();return}loginAberto=true;Nuvem.erro='';Nuvem.aviso='Janela de login do Google aberta. Escolha a conta e conclua o login nela.';nuvemRender();try{await window.__fb.login()}catch(e){Nuvem.erro=location.protocol==='file:'?'O login com Google não funciona com o arquivo aberto direto do disco. Use o site publicado (marceloclr.gitlab.io/tcs) ou um servidor local.':e.code==='auth/popup-blocked'?'O navegador bloqueou a janela de login. Libere pop-ups para este site e tente de novo.':(e.code==='auth/popup-closed-by-user'||e.code==='auth/cancelled-popup-request')?'':e.code==='auth/unauthorized-domain'?`O endereço ${location.hostname} ainda não está autorizado no Firebase. No console: Authentication › Configurações › Domínios autorizados › Adicionar domínio › ${location.hostname}.`:'Não foi possível entrar: '+e.message}finally{loginAberto=false;Nuvem.aviso='';nuvemRender()}}
// Carimbo de versão no canto inferior esquerdo, lido do título (V-DDMMAAAA-HHMM, atualizado a cada commit), como nos outros projetos.
document.getElementById('versaoCanto').textContent=(document.title.match(/V-\d{8}-\d{4}/)||[''])[0];
// ---------- Tela de login ----------
// O sistema só abre depois do login com uma conta liberada. Exceção: se o serviço de login não carregar (sem internet), dá para abrir com os dados deste navegador.
const GOOGLE_G='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
let gateOffline=false, gateAuthVisto=false, gateTimeout=false;
setTimeout(()=>{gateTimeout=true;gateRender()},12000);
function gateRender(){const g=$('#loginGate'),b=$('#gateBody');if(!g)return;const fb=!!window.__fb;
 if(!window.TCS_FIREBASE_CONFIG||gateOffline||(Nuvem.user&&Nuvem.perfil&&Nuvem.estado==='online')){g.hidden=true;return}
 g.hidden=false;let h;const quem=Nuvem.user?`<div class="gate-user">${esc(Nuvem.user.email)}</div>`:'';
 const trocar=`<button class="btn" data-gate-switch title="Encerra esta sessão e abre a escolha de outra conta Google">Entrar com outra conta</button>`;
 if(!fb&&(window.__fbErro||gateTimeout))h=`<div class="notice danger">Não foi possível falar com o serviço de login do Google${window.__fbErro?'':' (demorou demais)'}. Confira a conexão com a internet.</div><button class="btn primary" data-gate-retry title="Recarrega a página e tenta o login de novo">Tentar de novo</button><button class="btn" data-gate-offline title="Abre o sistema com a cópia guardada neste navegador, sem a nuvem">Abrir com os dados deste navegador</button><p class="hint" style="margin-top:10px">No modo offline, as alterações ficam só neste navegador até você entrar de novo e enviá-las.</p>`;
 else if(!fb||!gateAuthVisto)h='<div class="gate-wait"><span class="spin"></span>Verificando a sessão…</div>';
 else if(!Nuvem.user)h=`<button class="btn gate-google" data-cloud-login${loginAberto?' disabled':''} title="Abre a janela do Google para escolher a conta">${GOOGLE_G}<span>${loginAberto?'Aguardando o login…':'Entrar com Google'}</span></button>${Nuvem.aviso?`<div class="notice">${esc(Nuvem.aviso)}</div>`:''}${Nuvem.erro?`<div class="notice danger">${esc(Nuvem.erro)}</div>`:''}`;
 else if(Nuvem.estado==='perfil')h=quem+'<div class="gate-wait"><span class="spin"></span>Verificando o seu cadastro…</div>';
 else if(Nuvem.estado==='implantando')h=quem+'<div class="gate-wait"><span class="spin"></span>Preparando o primeiro acesso de administrador…</div>';
 else if(Nuvem.estado==='revogado')h=quem+'<div class="gate-wait"><span class="spin"></span>Seus acessos mudaram. Atualizando a cópia deste navegador…</div>';
 else if(Nuvem.estado==='aguardando')h=`${quem}<div class="gate-estado"><strong>Acesso aguardando autorização</strong><p>Seu pedido de acesso foi registrado. Assim que um administrador definir o seu papel e os clientes e projetos liberados, o sistema abrirá aqui automaticamente.</p></div><button class="btn primary" data-gate-retry title="Recarrega a página para conferir se o acesso já foi liberado">Verificar de novo</button>${trocar}`;
 else if(Nuvem.estado==='suspenso')h=`${quem}<div class="gate-estado suspenso"><strong>Acesso suspenso</strong><p>Esta conta está desativada no sistema. Por segurança, a cópia dos dados guardada neste navegador foi apagada. Se for um engano, fale com o administrador.</p></div>${trocar}`;
 else if(Nuvem.estado==='obra')h=`${quem}<div class="gate-estado"><strong>Envio de notas da obra</strong><p>Sua conta é para fotografar e enviar as notas recebidas na obra.</p></div><a class="btn primary" href="captura.html" title="Abre a tela simples de fotografar e enviar notas">Abrir a tela de envio de notas</a>${trocar}`;
 else if(Nuvem.estado==='negado')h=`${quem}<div class="notice danger">Não foi possível verificar o seu cadastro na nuvem. Se o problema continuar, avise o administrador: as regras de acesso do Firestore podem não estar publicadas.</div><details class="hint"><summary>Detalhes técnicos</summary>${esc(Nuvem.erro)}</details><button class="btn primary" data-gate-retry title="Recarrega a página e tenta de novo">Tentar de novo</button>${trocar}`;
 else if(Nuvem.estado==='erro')h=`${quem}<div class="notice danger">Erro ao abrir a base na nuvem.</div><details class="hint"><summary>Detalhes técnicos</summary>${esc(Nuvem.erro)}</details><button class="btn primary" data-gate-retry title="Recarrega a página e tenta de novo">Tentar de novo</button>${trocar}`;
 else h=`${quem}<div class="gate-wait"><span class="spin"></span>Carregando os dados da nuvem…</div>`;
 if(b.innerHTML!==h)b.innerHTML=h}
document.addEventListener('click',e=>{if(e.target.closest('[data-gate-retry]'))location.reload();if(e.target.closest('[data-gate-offline]')){gateOffline=true;gateRender()}if(e.target.closest('[data-gate-switch]'))window.__fb.logout().then(()=>nuvemLogin())});
function nuvemRender(){gateRender();const st=$('#dbStatus'),bt=$('#cloudBtn'),pn=$('#cloudPanel');if(!st)return;const fb=!!window.__fb;const p=Nuvem.perfil;
 const quem=(Nuvem.user?.email||'')+(p?' · '+(PAPEL_LABEL[p.papel]||p.papel):'');
 const txt={local:fb?'Modo local (não conectado à nuvem)':(window.__fbErro?'Nuvem indisponível (sem internet?) · modo local':'Armazenamento local'),perfil:'Verificando o cadastro…',implantando:'Preparando o primeiro acesso…',revogado:'Atualizando os acessos…',aguardando:'Acesso aguardando autorização: '+quem,suspenso:'Acesso suspenso: '+quem,obra:'Conta da obra: '+quem,conectando:'Conectando à nuvem…',online:'Nuvem: '+quem+(Nuvem.pendentes?` · ${Nuvem.pendentes} alteração(ões) aguardando envio`:' · sincronizado'),negado:'Sem acesso à nuvem: '+quem,erro:'Erro na nuvem · alterações ficam neste navegador'}[Nuvem.estado]||Nuvem.estado;
 const cor={online:Nuvem.pendentes?'#fbbf24':'#34d399',conectando:'#fbbf24',perfil:'#fbbf24',negado:'#f87171',erro:'#f87171',suspenso:'#f87171',local:'#94a3b8'}[Nuvem.estado]||'#fbbf24';
 st.innerHTML=`<span class="status-dot" style="background:${cor}"></span>${esc(txt)}`;
 bt.hidden=!fb;bt.textContent=Nuvem.user?'Sair':loginAberto?'Aguardando login…':'Entrar com Google';bt.disabled=!Nuvem.user&&loginAberto;bt.title=Nuvem.user?'Encerra a sessão nesta janela; a cópia local continua neste navegador':'Abre a janela do Google para entrar';
 const avisoBox=$('#avisoNuvem');if(avisoBox)avisoBox.innerHTML=Nuvem.aviso&&Nuvem.user?`<div class="notice danger aviso-nuvem">${esc(Nuvem.aviso)} <button class="btn sm" data-aviso-fechar title="Fecha este aviso">Entendi</button></div>`:'';
 const falhas=Nuvem.falhas.size?`<p class="hint">${Nuvem.falhas.size} consulta(s) recusada(s) pelas regras: parte dos dados pode não aparecer. Avise o administrador.</p>`:'';
 if(pn)pn.innerHTML=!fb?`<p>${window.__fbErro?'O Firebase não carregou (sem internet ou bloqueado). Os dados continuam neste navegador.':'Nuvem não configurada: os dados ficam só neste navegador.'}</p>`:!Nuvem.user?`<p>Entre com a sua conta Google para usar a base compartilhada. Só contas cadastradas em Usuários e acessos têm acesso.</p><button class="btn primary" data-cloud-login${loginAberto?' disabled':''} title="Abre a janela do Google para entrar">${loginAberto?'Aguardando login…':'Entrar com Google'}</button>${Nuvem.erro?`<div class="notice danger">${esc(Nuvem.erro)}</div>`:''}`:
  `<p><strong>${esc(Nuvem.user.nome)}</strong><br><span class="hint">${esc(Nuvem.user.email)}${p?' · '+esc(PAPEL_LABEL[p.papel]||p.papel):''}</span></p><p>${esc(txt)}</p>${Nuvem.estado==='online'?`<p class="hint">Salvamento automático: cada alteração vai para a nuvem na hora, e as dos outros usuários aparecem aqui ao vivo. Este navegador guarda só os clientes e projetos liberados para você.${Nuvem.enviadosAuto?` ${Nuvem.enviadosAuto} registro(s) deste navegador foram enviados automaticamente.`:''}${Nuvem.removidosAuto?` ${Nuvem.removidosAuto} registro(s) excluídos na nuvem ou fora do seu acesso foram retirados daqui.`:''}</p>${falhas}${Nuvem.pendentes?'':'<span class="tag-muted">Tudo sincronizado com a nuvem</span>'}`:''}`}
document.addEventListener('click',e=>{if(e.target.closest('[data-aviso-fechar]')){Nuvem.aviso='';nuvemRender()}});
function put(store,obj){return txWrite(store,os=>os[store].put(obj))}
function del(store,id){return txWrite(store,os=>os[store].delete(id))}
function clearStore(store,opts){return txWrite(store,os=>os[store].clear(),opts)}
async function refresh(){for(const s of STORES)state[s]=await all(s);
 // notas que este usuário não lê inteiras: montadas a partir das projeções dos projetos dele (js/escopo.js)
 state.invoices=state.invoices.concat(notasDasProjecoes(state.notas_projeto,new Set(state.invoices.map(i=>i.id))));
 await linkItemProducts();render()}
// Cada item de nota guarda o productId do produto em que entrou. Notas da v1 não tinham esse vínculo: ele é deduzido pela chave do produto ou pela movimentação de entrada da nota.
async function linkItemProducts(){const byKey=new Map(state.products.map(p=>[p.key,p]));for(const inv of state.invoices){if(isServico(inv)||inv._parcial)continue;let mudou=false;(inv.items||[]).forEach((it,j)=>{if(it.productId&&state.products.some(p=>p.id===it.productId))return;const m=state.movements.find(m=>m.type==='ENTRADA'&&m.invoiceId===inv.id&&(m.itemIndex===j||(m.itemIndex==null&&m.description===it.description)));const p=(m&&state.products.find(p=>p.id===m.productId))||byKey.get(productKey(it));if(p){it.productId=p.id;mudou=true}});if(mudou)await put('invoices',inv)}}
// Valor pago por item: valor bruto − desconto, mais o rateio de frete, seguro, outras despesas e impostos, de modo que a soma dos itens feche com o total da nota.
function itemNet(it){return Math.max(0,Number(it.lineTotal||0)-Number(it.discount||0))}
// Nota parcial (montada das projeções): cada item já traz o custo unitário pago (_custoUnit), calculado sobre a nota inteira.
function itemPaid(inv,j){if(inv._parcial){const it=inv.items[j];return Number(it?.quantity||0)*Number(it?._custoUnit||0)}const items=inv.items||[],soma=items.reduce((a,it)=>a+itemNet(it),0),total=Number(inv.total)||soma;return soma>0?itemNet(items[j])*total/soma:0}
function itemUnitCost(inv,j){const q=Number(inv.items[j]?.quantity||0);return q>0?itemPaid(inv,j)/q:0}
function allocatedQty(invId,j,ignorar){return state.allocations.filter(a=>a.invoiceId===invId&&a.itemIndex===j&&a!==ignorar).reduce((s,a)=>s+Number(a.quantity||0),0)}
function invoiceStatus(inv){const items=inv.items||[];const tot=items.reduce((a,it)=>a+Number(it.quantity||0),0),alo=items.reduce((a,it,j)=>a+allocatedQty(inv.id,j),0);if(alo<=1e-9)return 'a_vincular';return alo+1e-9>=tot?'vinculada':'parcial'}
const STATUS_LABEL={a_vincular:'A vincular',parcial:'Em distribuição',vinculada:'Vinculada'};
