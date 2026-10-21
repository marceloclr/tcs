// Baixas de estoque e log de atividades (administrador, porta 8767, depois do 1-admin.js): baixa pela tela com motivo obrigatório,
// responsável na baixa, estorno com motivo, relatório de baixas e aba "Log de atividades" com as atividades vindas da nuvem.
(async()=>{try{window.confirm=()=>true;window.alert=m=>console.log('ALERTA',m);
const espera=(f,ms=20000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},100)});
const r={};
await espera(()=>Nuvem.perfil&&Nuvem.estado==='online',30000);
await espera(()=>state.allocations.some(a=>a.projectId==='P1'));
const prod=state.allocations.find(a=>a.projectId==='P1').productId,key='P1|'+prod,saldo0=saldoProjeto('P1',prod);
r.saldoInicial=saldo0;
// 1) baixa pela tela: sem motivo é recusada; com motivo, grava em nome do administrador
go('stock');openProjects.add('P1');renderStock();aplicarPermissoes();
document.querySelector(`[data-saida="${CSS.escape(key)}"]`).click();
const tr=await espera(()=>document.querySelector('.saida-form'));
tr.querySelector('[data-sf="qtd"]').value='1';
tr.querySelector('[data-saida-ok]').click();await new Promise(x=>setTimeout(x,300));
r.semMotivo=tr.querySelector('[data-sf="msg"]').innerText;
tr.querySelector('[data-sf="obs"]').value='aplicado no 2º pavimento';
tr.querySelector('[data-saida-ok]').click();
const b=await espera(()=>state.movements.find(m=>m.type==='SAIDA'&&m.projectId==='P1'&&m.note==='aplicado no 2º pavimento'));
await espera(()=>Nuvem.pendentes===0);
r.baixa={criadoPor:b.criadoPor,criadoPorNome:b.criadoPorNome,saldo:saldoProjeto('P1',prod),recusada:Nuvem.aviso||''};
// 2) relatório de baixas e estorno
go('baixas');
const linha=await espera(()=>document.querySelector(`[data-bx-linha="${b.id}"]`));
r.relatorio=linha.innerText.replace(/\s+/g,' ');
linha.querySelector('[data-bx-estornar]').click();
const conf=await espera(()=>document.querySelector('[data-bx-confirmar]'));
conf.click();await new Promise(x=>setTimeout(x,300));
r.estornoSemMotivo=document.querySelector('[data-bx-msg]').innerText;
document.querySelector('[data-bx-motivo]').value='baixa lançada em duplicidade';
document.querySelector('[data-bx-confirmar]').click();
const e=await espera(()=>state.movements.find(m=>m.estornoDe===b.id));
await espera(()=>Nuvem.pendentes===0);
r.estorno={id:e.id,quantidade:e.quantity,criadoPor:e.criadoPor,saldo:saldoProjeto('P1',prod),saldoVoltou:Math.abs(saldoProjeto('P1',prod)-saldo0)<1e-9,recusado:Nuvem.aviso||''};
r.situacao=(await espera(()=>document.querySelector(`[data-bx-linha="${b.id}"]`))).innerText.replace(/\s+/g,' ');
r.semBotaoEstornar=!document.querySelector(`[data-bx-linha="${b.id}"] [data-bx-estornar]`);
document.querySelector('#baixasCsv').click();
// 3) o estorno não pode ser repetido (trava local e regras)
try{await estornarBaixa(b.id,'de novo');r.estornoRepetido='PERMITIDO'}catch(x){r.estornoRepetido='negado: '+x.message}
// 4) log de atividades: fila do navegador vazia e registros na nuvem
await espera(()=>!atvFila().length,20000);
go('usuarios');Adm.aba='atividades';renderUsuarios();
await espera(()=>['entrada','baixa','estorno','csv'].every(a=>AtvAdm.itens.some(x=>x.acao===a)),20000);
const pega=a=>AtvAdm.itens.find(x=>x.acao===a);
r.log={total:AtvAdm.itens.length,acoes:[...new Set(AtvAdm.itens.map(x=>x.acao))].sort(),baixa:pega('baixa').texto,estorno:pega('estorno').texto,csv:pega('csv').texto,
 por:pega('baixa').por,servidor:!!pega('baixa').emServidor,linhasNaTela:document.querySelectorAll('.atv-tabela tbody tr').length};
// filtro por tipo
document.querySelector('[data-atv-cat]').value='estoque';document.querySelector('[data-atv-cat]').dispatchEvent(new Event('change',{bubbles:true}));
r.filtroEstoque=[...document.querySelectorAll('.atv-tabela tbody tr')].map(t=>t.cells[3]?.innerText.slice(0,40));
window.scrollTo(0,0);
return r}catch(e){return 'ERRO: '+e.message+'\n'+e.stack}})()
