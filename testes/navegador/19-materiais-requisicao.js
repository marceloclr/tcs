// Materiais padronizados e requisição da obra (estoque → requisitado → consumido), em cinco partes alternadas. Pede o 1-admin.js antes.
// window.PARTE (pelo INIT do cdp.mjs):
//  'esc1' (index.html?emulador=1, 8767, administrador): duas notas de cimento de fornecedores diferentes na Obra 1, um material,
//         sugestão e vínculo dos dois produtos, saldo somado por material;
//  'obra1' (captura.html?emulador=1, 8768, mestre): pede 5 SC; sem internet, pede 1 SC (fica guardado) e cancela depois de subir;
//  'esc2': atende 5 (FIFO: sai da nota mais antiga), estoque −5 e requisitado +5, sem custo apropriado;
//  'obra2': confirma o uso de 3 e devolve 2;
//  'esc3': recebe a devolução: requisitado 0, consumido 3, estoque 13, apropriado = 3 × custo, log de atividades.
(async()=>{try{window.confirm=()=>true;window.alert=m=>{window.__alerta=m;console.log('ALERTA',m)};const r={};
const espera=(f,ms=30000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},150)});
const P=window.PARTE;const MAT='Cimento CP II 50 kg';
const linhaP1=()=>stockTree().clientes.flatMap(c=>c.projetos).find(x=>x.p.id==='P1');
const grupoCim=()=>agruparPorMaterial(linhaP1().itens).find(g=>g.nome===MAT);
const resumo=g=>g&&{entrada:r4(g.entrada),estoque:r4(g.entrada-g.saida-g.linhas.reduce((s,l)=>s+l.req,0)),requisitado:r4(g.linhas.reduce((s,l)=>s+l.req,0)),consumido:r4(g.saida),apropriado:Math.round(materiaisBaixados(g)*100)/100,custodia:Math.round(g.estoque*100)/100,pago:Math.round(g.pago*100)/100};
if(P&&P.startsWith('esc')){await espera(()=>window.__fb&&Nuvem.perfil&&Nuvem.estado==='online');await espera(()=>Req.ligada);}
if(P==='esc1'){
 const nota=(id,issuer,doc,date,desc,code,q,pu)=>({id,key:id,number:id.slice(-6),series:'1',date,operation:'VENDA',issuer,issuerDoc:doc,recipient:'TCS',totalProducts:q*pu,discount:0,total:q*pu,source:'teste',format:'XML',tipo:'material',items:[{code,barcode:'',description:desc,ncm:'25232910',cfop:'5102',unit:'SC',quantity:q,unitPrice:pu,lineTotal:q*pu,discount:0}],postedAt:new Date().toISOString()});
 const nA=nota('23261011111111000111550010000000011000000011','DEPOSITO SOL','11111111000111','2026-10-01','CIMENTO CP II 50KG','C1',10,40);
 const nB=nota('23261022222222000122550010000000021000000022','CASA DO CONSTRUTOR','22222222000122','2026-10-10','CIM CPII-32 SC 50','X9',6,42);
 const prods=[nA,nB].map(n=>({id:'prod-'+n.items[0].code,key:productKey(n.items[0]),code:n.items[0].code,barcode:'',name:n.items[0].description,unit:'SC',stock:n.items[0].quantity,createdAt:new Date().toISOString()}));
 [nA,nB].forEach((n,i)=>n.items[0].productId=prods[i].id);
 const ex=escopoNormalizar(structuredClone({products:prods,invoices:[nA,nB],movements:[nA,nB].map((n,i)=>({id:'ent-'+i,productId:prods[i].id,invoiceId:n.id,invoiceKey:n.key,itemIndex:0,date:n.date,type:'ENTRADA',escopo:'aberta',quantity:n.items[0].quantity,unitCost:n.items[0].unitPrice,description:n.items[0].description,createdAt:new Date().toISOString()}))}));
 await txWrite(['products','invoices','movements','chaves'],os=>{for(const k of ['products','invoices','movements','chaves'])for(const it of ex[k]||[])os[k].put(it)});await refresh();
 for(const n of [nA,nB]){const inv=state.invoices.find(i=>i.id===n.id);await saveInvoiceAllocations(inv,[makeAlloc(inv,0,'P1',n.items[0].quantity)])}
 await espera(()=>Nuvem.pendentes===0);if(Nuvem.aviso)throw new Error('notas recusadas: '+Nuvem.aviso);
 r.semMaterialAntes=produtosSemMaterial().filter(p=>p.id.startsWith('prod-')).map(p=>p.name);
 r.saldoPorProdutoAntes=linhaP1().itens.filter(l=>l.productId.startsWith('prod-')).map(l=>l.nome+': '+l.disp);
 go('materiais');const f=document.querySelector('#materiaisBody [data-mat-form=""]');f.querySelector('[data-mf="nome"]').value=MAT;f.querySelector('[data-mf="unidade"]').value='sc';f.querySelector('[data-mat-salvar=""]').click();
 await espera(()=>state.materiais.some(m=>m.nome===MAT));const m=state.materiais.find(m=>m.nome===MAT);r.material={nome:m.nome,unidade:m.unidade};
 // nome repetido com a mesma unidade é recusado
 try{await materialSalvar({nome:' cimento cp ii 50 KG ',unidade:'SC'});r.duplicado='aceito (ERRO)'}catch(e){r.duplicado='recusado: '+e.message}
 r.sugestoes=prods.map(p=>p.name+' → '+(sugestoesMaterial(p.name,1).map(s=>s.m.nome+' '+Math.round(s.s*100)+'%')[0]||'nenhuma'));
 go('vincular');r.subnavVincular=[...document.querySelectorAll('[data-view-sub="vincular"] .count')].map(x=>x.textContent)[0]||'0';
 // primeiro um a um pela tela, o segundo pelo lote ("aceitar as sugestões")
 const sel=document.querySelector(`[data-vin-mat="${prods[0].id}"]`);sel.value=m.id;document.querySelector(`[data-vin-ok="${prods[0].id}"]`).click();
 await espera(()=>state.products.find(p=>p.id===prods[0].id)?.materialId===m.id);
 Mat.sel=new Set([prods[1].id]);renderVincular();document.querySelector('[data-vin-sugestoes]').click();
 await espera(()=>state.products.find(p=>p.id===prods[1].id)?.materialId===m.id).catch(()=>{});
 if(state.products.find(p=>p.id===prods[1].id)?.materialId!==m.id){await materialVincular([prods[1].id],m.id);await refresh();r.loteSugestao='sugestão abaixo de 50%: vinculado à mão'}else r.loteSugestao='vinculado pela sugestão';
 await espera(()=>Nuvem.pendentes===0);
 r.semMaterialDepois=produtosSemMaterial().filter(p=>p.id.startsWith('prod-')).length;
 r.porMaterial=resumo(grupoCim());r.produtosNoMaterial=produtosDoMaterial(m.id).map(p=>p.name);
 stockModo='material';openProjects.add('P1');go('stock');renderStock();r.linhaMaterialNaTela=!!document.querySelector('.lv-material')&&/Cimento CP II 50 kg/.test(document.querySelector('.lv-material').textContent);
 r.colunas=[...document.querySelectorAll('#stockTable thead th')].map(t=>t.textContent).filter(Boolean);
 go('materiais');Mat.abrir=m.id;renderMateriais();r.telaMateriais=document.querySelector('#materiaisBody tbody tr')?.textContent.replace(/\s+/g,' ').trim().slice(0,120);
}
if(P==='obra1'){
 await espera(()=>window.__fb);if(!Cap.user)await window.__fb.loginTeste('mestre@x.com');
 await espera(()=>Cap.perfil&&Cap.projetos.length&&Mt.materiais.some(m=>m.nome===MAT));
 r.home={pedir:!!$('#pedirMaterial'),naObra:$('#naObraConta').hidden?0:$('#naObraConta').textContent};
 $('#pedirMaterial').click();await espera(()=>$('#telaPedir').classList.contains('ativa'));
 $('#pedirBusca').value='cimento';$('#pedirBusca').dispatchEvent(new Event('input',{bubbles:true}));
 r.busca=[...document.querySelectorAll('#pedirLista .mat-item')].map(b=>b.textContent.replace(/\s+/g,' ').trim());
 document.querySelector('#pedirLista .mat-item').click();const q=document.querySelector('[data-mt-qtd="0"]');q.value='5';q.dispatchEvent(new Event('change',{bubbles:true}));
 $('#pedirObs').value='laje do 2º pavimento';r.carrinho=Mt.carrinho.map(c=>c.nome+' '+c.qtd+' '+c.unidade);r.enviarAtivo=!$('#pedirEnviar').disabled;
 $('#pedirEnviar').click();await espera(()=>/Pedido enviado/.test($('#prontoTexto').innerText));r.pronto=$('#prontoTexto').innerText.replace(/\s+/g,' ');
 await espera(()=>mtLista().some(x=>x.status==='pendente'&&x.itens[0].pedida===5&&!x._pendente));
 // sem internet: o pedido fica guardado no celular e sobe sozinho; depois é cancelado
 console.log('__cdp_offline__');await new Promise(r=>setTimeout(r,800));
 Mt.carrinho=[{materialId:Mt.materiais.find(m=>m.nome===MAT).id,nome:MAT,unidade:'SC',qtd:1}];mostrar('telaPedir');pedirRender();await pedirEnviar();
 r.offline={pronto:$('#prontoTexto').innerText.replace(/\s+/g,' '),guardado:mtLista().some(x=>x.itens[0].pedida===1&&x._pendente)};
 console.log('__cdp_online__');await espera(()=>mtLista().some(x=>x.itens[0].pedida===1&&!x._pendente),40000);r.offline.subiu=true;
 const um=mtLista().find(x=>x.itens[0].pedida===1);$('#meusPedidos').click();pedidosRender();document.querySelector(`[data-mt-cancelar="${um.id}"]`).click();
 await espera(()=>Mt.reqs.get(um.id)?.status==='cancelada');r.cancelado=true;
 r.meusPedidos=[...document.querySelectorAll('.pedido')].map(p=>p.querySelector('.pedido-sit').textContent+' · '+p.querySelector('li')?.textContent.replace(/\s+/g,' '));
}
if(P==='esc2'){
 await espera(()=>reqLista().some(x=>x.status==='pendente'&&x.tipo==='requisicao'));const req=reqLista().find(x=>x.status==='pendente'&&x.tipo==='requisicao');
 r.cancelado=reqLista().filter(x=>x.status==='cancelada').length;r.contagem=reqContagem();
 go('requisicoes');Req.aba='pendentes';reqRender();const card=document.querySelector(`[data-req-cartao="${req.id}"]`);
 r.cartao=card.textContent.replace(/\s+/g,' ').slice(0,200);r.sugerido=card.querySelector('[data-req-q]').value;
 // entregar mais que o estoque é recusado
 try{await reqAtender(req,[999]);r.excesso='aceito (ERRO)'}catch(e){r.excesso='recusado: '+e.message}
 card.querySelector('[data-req-obs]').value='entregue ao encarregado';card.querySelector('[data-req-ok]').click();
 await espera(()=>Req.itens.get(req.id)?.status==='atendida');await espera(()=>state.movements.filter(m=>m.type==='REQUISICAO').length>=1);
 const at=Req.itens.get(req.id);r.partes=at.itens[0].partes.map(p=>state.products.find(x=>x.id===p.productId)?.name+' '+p.qtd+' a '+p.unitCost);
 r.depoisDeAtender=resumo(grupoCim());
 r.porProduto=linhaP1().itens.filter(l=>l.productId.startsWith('prod-')).map(l=>`${l.nome}: estoque ${l.disp}, requisitado ${l.req}, consumido ${l.saida}`);
 r.saidaDiretaLimitada=saldoProjeto('P1',at.itens[0].partes[0].productId);
}
if(P==='obra2'){
 await espera(()=>window.__fb&&Cap.perfil);await espera(()=>mtNaObra('').length);
 r.home={naObra:$('#naObraConta').textContent};$('#naObra').click();await espera(()=>$('#telaNaObra').classList.contains('ativa'));
 const card=document.querySelector('[data-mt-grupo]');r.cartao=card.textContent.replace(/\s+/g,' ').trim();
 card.querySelector('[data-mt-g-qtd]').value='3';card.querySelector('[data-mt-usei]').click();
 await espera(()=>/Uso confirmado/.test($('#prontoTexto').innerText));await espera(()=>mtNaObra('')[0]?.total===2);
 r.depoisDeUsar={comAObra:mtNaObra('')[0].total};
 $('#naObra').click();const c2=document.querySelector('[data-mt-grupo]');c2.querySelector('[data-mt-g-qtd]').value='2';c2.querySelector('[data-mt-devolver]').click();
 await espera(()=>/Devolução registrada/.test($('#prontoTexto').innerText));await espera(()=>mtLista().some(x=>x.tipo==='devolucao'&&x.status==='pendente'&&!x._pendente));
 r.depoisDeDevolver={comAObra:mtNaObra('').reduce((s,g)=>s+g.total,0),devolucaoPendente:mtLista().find(x=>x.tipo==='devolucao').itens[0].pedida};
 // nada mais com a obra: Usei/Devolver não aparecem
 $('#naObra').click();r.naObraVazio=!!document.querySelector('#naObraLista .vazio');
 $('#meusPedidos').click();r.meusPedidos=[...document.querySelectorAll('.pedido')].map(p=>p.querySelector('.pedido-tipo').textContent+' '+p.querySelector('.pedido-sit').textContent+' · '+[...p.querySelectorAll('li')].map(l=>l.textContent.replace(/\s+/g,' ')).join(' | '));
}
if(P==='esc3'){
 await espera(()=>reqLista().some(x=>x.tipo==='devolucao'&&x.status==='pendente'));await espera(()=>state.movements.some(m=>m.type==='SAIDA'&&m.requisicaoId));
 r.antesDeReceber=resumo(grupoCim());
 const d=reqLista().find(x=>x.tipo==='devolucao'&&x.status==='pendente');
 try{await reqReceberDevolucao(d,[3]);r.excesso='aceito (ERRO)'}catch(e){r.excesso='recusado: '+e.message}
 go('requisicoes');Req.aba='pendentes';reqRender();document.querySelector(`[data-req-cartao="${d.id}"] [data-req-ok]`).click();
 await espera(()=>Req.itens.get(d.id)?.status==='recebida');await espera(()=>state.movements.some(m=>m.type==='REQUISICAO'&&m.quantity<0));
 r.depoisDeReceber=resumo(grupoCim());
 const t=linhaP1().tot;r.fechamentoObra1={pago:Math.round(t.pago*100)/100,custodia:Math.round(t.estoque*100)/100,apropriado:Math.round(materiaisBaixados(t)*100)/100,confere:Math.abs(t.pago-t.estoque-materiaisBaixados(t))<0.01};
 Req.aba='obra';reqRender();r.abaComAObra=$('#requisicoesBody').textContent.includes('Nenhum material requisitado');
 go('baixas');r.baixaDoMestre=baixasLinhas().filter(l=>l.m.requisicaoId).map(l=>`${l.m.quantity} · ${l.quem.nome} · ${l.m.note}`);
 await new Promise(r=>setTimeout(r,2500));
 const j=await (await fetch('http://127.0.0.1:8089/v1/projects/demo-tcs/databases/(default)/documents/atividades?pageSize=300',{headers:{Authorization:'Bearer owner'}})).json();
 r.log=(j.documents||[]).map(x=>x.fields).filter(f=>/^(obra_requisicao|obra_consumo|obra_devolucao|obra_cancelamento|requisicao_|material_)/.test(f.acao.stringValue)).map(f=>f.acao.stringValue+': '+f.texto.stringValue.slice(0,110));
}
return r}catch(e){return 'FALHOU: '+e.message+'\n'+e.stack}})()
