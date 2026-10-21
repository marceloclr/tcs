// Produtos e ajustes (administrador, porta 8767, depois do 1-admin.js): formulário do produto fora do Solicitar orçamento,
// edição do nome com registro no log, ajuste de sobra com novo custo médio, ajuste de falta, histórico, fechamento
// estoque + custo apropriado = total adquirido, e ajustes fora do relatório de baixas.
(async()=>{try{window.confirm=()=>true;window.alert=m=>console.log('ALERTA',m);
const espera=(f,ms=20000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},100)});
const r={};
await espera(()=>Nuvem.perfil&&Nuvem.estado==='online',30000);
await espera(()=>state.allocations.some(a=>a.projectId==='P1'));
r.formNoEstoque=!!document.querySelector('#ajustes #editName')&&!document.querySelector('#products #editName');
go('products');r.semEditarNoOrcamento=!document.querySelector('#productTable [data-edit-product]')&&!!document.querySelector('#productTable [data-quote-add]');
// 1) nome do produto
go('ajustes');
const prod=state.allocations.find(a=>a.projectId==='P1').productId,k='P1|'+prod;
document.querySelector(`[data-edit-product="${CSS.escape(prod)}"]`).click();
$('#editName').value='Produto renomeado no teste';$('#saveProduct').click();
await espera(()=>state.products.find(p=>p.id===prod)?.name==='Produto renomeado no teste');
// 2) ajuste: sobra de 2 e custo médio +10%
const linha=()=>stockTree().clientes.flatMap(c=>c.projetos).find(x=>x.p.id==='P1').itens.find(l=>l.productId===prod);
const l0=linha();r.antes={saldo:l0.saldo,custo:l0.custo,estoque:l0.estoque};
const custoNovo=Math.round(l0.custo*1.1*100)/100;
document.querySelector(`[data-aj-abrir="${CSS.escape(k)}"]`).click();
let f=await espera(()=>document.querySelector('[data-aj-form]'));
f.querySelector('[data-ajf="qtd"]').value=String(l0.saldo+2);f.querySelector('[data-ajf="custo"]').value=String(custoNovo);
f.querySelector('[data-ajf="qtd"]').dispatchEvent(new Event('input',{bubbles:true}));
r.previa=f.querySelector('[data-aj-previa]').innerText;
f.querySelector('[data-aj-confirmar]').click();await new Promise(x=>setTimeout(x,300));
r.semMotivo=f.querySelector('[data-aj-msg]').innerText;
f.querySelector('[data-ajf="motivo"]').value='inventário de 21/10 e preço corrigido';
f.querySelector('[data-aj-confirmar]').click();
await espera(()=>state.movements.some(m=>m.ajuste&&m.quantity<0));
await espera(()=>Nuvem.pendentes===0);
const l1=linha();r.depoisSobra={saldo:l1.saldo,custo:Math.round(l1.custo*100)/100,custoPedido:custoNovo,recusado:Nuvem.aviso||''};
// 3) ajuste: falta de 1, custo mantido
document.querySelector(`[data-aj-abrir="${CSS.escape(k)}"]`).click();
f=await espera(()=>document.querySelector('[data-aj-form]'));
f.querySelector('[data-ajf="qtd"]').value=String(l1.saldo-1);f.querySelector('[data-ajf="motivo"]').value='quebra na obra';
f.querySelector('[data-aj-confirmar]').click();
await espera(()=>state.movements.some(m=>m.ajuste&&m.quantity>0));
await espera(()=>Nuvem.pendentes===0);
const l2=linha(),{total}=stockTree();
r.depoisFalta={saldo:l2.saldo,custo:Math.round(l2.custo*100)/100,recusado:Nuvem.aviso||''};
r.fecha=Math.abs(total.estoque+custoApropriado(total)-totalAdquirido(total))<0.01;
r.historico=[...document.querySelectorAll('#ajustesBody .panel:last-child tbody tr')].map(t=>t.innerText.replace(/\s+/g,' ').slice(0,150));
go('baixas');r.ajustesForaDasBaixas=!baixasLinhas().some(x=>x.m.ajuste);
go('dashboard');r.recentes=[...document.querySelectorAll('#recent tbody tr')].filter(t=>/AJUSTE/.test(t.textContent)).map(t=>t.textContent.replace(/\s+/g,' '));
// 4) log de atividades
await espera(()=>!atvFila().length,20000);
go('usuarios');Adm.aba='atividades';renderUsuarios();
await espera(()=>AtvAdm.itens.filter(a=>a.acao==='ajuste').length>=2&&AtvAdm.itens.some(a=>a.acao==='produto_alterado'),20000);
r.log=AtvAdm.itens.filter(a=>a.acao==='ajuste'||a.acao==='produto_alterado').map(a=>a.texto);
go('ajustes');window.scrollTo(0,0);
return r}catch(e){return 'ERRO: '+e.message+'\n'+e.stack}})()
