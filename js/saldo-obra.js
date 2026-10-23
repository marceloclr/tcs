// ---------- Estoque disponível por obra, para o pedido do mestre ----------
// ==== #JS-SALDO-OBRA: START ====
// saldos_obra/{projetoId}: por material da tabela, o disponível no estoque da obra (saldo menos o requisitado, como no
// Atender de js/requisicoes.js), com nome e unidade, sem valores: o mestre não lê rateios, movimentos nem produtos.
// Produtos sem material ficam de fora (Estoque › Vincular itens). Quem grava é o escritório com escrita no projeto, depois
// da leitura completa da nuvem e só quando o disponível mudou. Na primeira vez da sessão, o documento da nuvem é lido e
// comparado, para não regravar o que já está igual.
const SaldoObra={enviado:new Map(),timer:null,rodando:false,deNovo:false};
const saldoObraPode=()=>!!window.__fb&&!!Nuvem.user&&!!Nuvem.perfil&&Nuvem.estado==='online'&&Nuvem.reconciliado&&escritorVigente(Nuvem.perfil);
function saldoObraItens(x){const por=new Map();
 for(const l of x?.itens||[]){if(!(l.disp>1e-9))continue;const m=materialDoProduto(l.produto);if(!m||m.ativo===false)continue;
  const y=por.get(m.id)||{materialId:m.id,nome:m.nome,unidade:m.unidade||'UN',categoria:m.categoria||'',disponivel:0};y.disponivel=r4(y.disponivel+l.disp);por.set(m.id,y)}
 return [...por.values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))}
const saldoObraAssinatura=d=>JSON.stringify([d.clientId,d.projetoNome,d.itens]);
function saldosObraAgendar(){clearTimeout(SaldoObra.timer);if(saldoObraPode())SaldoObra.timer=setTimeout(saldosObraSincronizar,1500)}
async function saldosObraSincronizar(){if(!saldoObraPode())return;if(SaldoObra.rodando){SaldoObra.deNovo=true;return}SaldoObra.rodando=true;
 try{const porProj=new Map(stockTree().clientes.flatMap(c=>c.projetos).map(x=>[x.p.id,x]));const ops=[],marcas=[];
  for(const p of state.projects){if(!podeGravarProjeto(p.id))continue;
   const d={id:p.id,projectId:p.id,clientId:p.clientId||'',projetoNome:p.name||'',itens:saldoObraItens(porProj.get(p.id))};const h=saldoObraAssinatura(d);
   if(SaldoObra.enviado.get(p.id)===h)continue;
   if(!SaldoObra.enviado.has(p.id)){const atual=await window.__fb.get('saldos_obra',p.id).catch(()=>null);if(atual&&saldoObraAssinatura(atual)===h){SaldoObra.enviado.set(p.id,h);continue}}
   ops.push({op:'set',store:'saldos_obra',id:p.id,data:{...d,atualizadoEm:new Date().toISOString(),atualizadoPor:Nuvem.user.email}});marcas.push([p.id,h])}
  if(ops.length){await window.__fb.commit(ops);marcas.forEach(([id,h])=>SaldoObra.enviado.set(id,h))}}
 catch(e){console.warn('Estoque da obra não atualizado para o mestre:',e.message)}
 finally{SaldoObra.rodando=false;if(SaldoObra.deNovo){SaldoObra.deNovo=false;saldosObraAgendar()}}}
// ==== #JS-SALDO-OBRA: END ====
