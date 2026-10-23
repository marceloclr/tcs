// Na obra: prestação de contas numa tabela só, com um registro. Pede o 1-admin.js e o 19 (parte esc1) antes.
// window.PARTE (pelo INIT do cdp.mjs):
//  'prep'    (index.html?emulador=1, 8767, administrador): tubo (12 BR) e areia (10 M3) na Obra 1 por ajuste de sobra, custo zero;
//  'pedido'  (captura.html?emulador=1, 8768, mestre): pede 4 SC de cimento, 2 BR de tubo e 3 M3 de areia, com destino;
//  'atende'  (8767): atende tudo;
//  'contas'  (8768): cimento "Usei 4" (usou tudo), tubo "Devolvo 1" (usou 1), areia em branco; resumo; um registro só;
//            termina na tabela com a areia (para a captura de tela);
//  'recebe'  (8767): uma devolução só, com o tubo; confirma e confere as posições.
(async()=>{try{window.confirm=()=>true;window.alert=m=>{window.__alerta=m;console.log('ALERTA',m)};const r={};
const espera=(f,ms=30000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},150)});
const P=window.PARTE;const CIM='Cimento CP II 50 kg',TUBO='Tubo PVC 100 mm',AREIA='Areia média';
const texto=el=>el?.innerText.replace(/\s+/g,' ').trim();
if(['prep','atende','recebe'].includes(P)){await espera(()=>window.__fb&&Nuvem.iniciada);if(!Nuvem.user)await window.__fb.loginTeste('marceloclr@gmail.com');await espera(()=>Nuvem.perfil&&Nuvem.estado==='online'&&Nuvem.reconciliado);await espera(()=>Req.ligada)}
const pos=nome=>{const x=stockTree().clientes.flatMap(c=>c.projetos).find(x=>x.p.id==='P1');const ls=x.itens.filter(l=>materialDoProduto(l.produto)?.nome===nome);return {estoque:r4(ls.reduce((s,l)=>s+l.disp,0)),requisitado:r4(ls.reduce((s,l)=>s+l.req,0)),consumido:r4(ls.reduce((s,l)=>s+l.saida,0))}};
if(P==='prep'){const agora=new Date().toISOString();
 for(const [nome,un,q] of [[TUBO,'BR',12],[AREIA,'M3',10]]){await materialSalvar({nome,unidade:un});await refresh();const m=state.materiais.find(x=>x.nome===nome);
  const p={id:'prod-'+uid(),key:'MAN:'+norm(nome)+'|'+norm(un),code:'',barcode:'',name:nome.toUpperCase(),unit:un,stock:q,origin:'manual',materialId:m.id,createdAt:agora};
  await txWrite(['products','movements'],os=>{os.products.put(p);os.movements.put({id:'aj-'+uid(),type:'SAIDA',ajuste:true,productId:p.id,projectId:'P1',clientId:'CA',quantity:-q,unitCost:0,ajusteValor:0,saldoAntes:0,saldoDepois:q,custoAntes:0,custoDepois:0,date:agora.slice(0,10),note:'Estoque de teste',description:p.name,createdAt:agora,...baixaResponsavel()})})}
 await refresh();await espera(()=>Nuvem.pendentes===0);
 const t0=Date.now();let s;do{await new Promise(x=>setTimeout(x,700));s=await window.__fb.get('saldos_obra','P1')}while(Date.now()-t0<20000&&!(s?.itens?.length===3));
 r.saldoObra=s.itens.map(i=>i.nome+' '+i.disponivel+' '+i.unidade);}
if(P==='pedido'){await espera(()=>window.__fb);if(!Cap.user)await window.__fb.loginTeste('mestre@x.com');await espera(()=>Cap.perfil&&Cap.projetos.length);
 $('#pedirMaterial').click();await espera(()=>document.querySelectorAll('#pedirTabela [data-mt-qtd]').length===3);
 const dig=(n,v)=>{const i=[...document.querySelectorAll('#pedirTabela tbody tr')].find(t=>t.textContent.includes(n)).querySelector('[data-mt-qtd]');i.value=v;i.dispatchEvent(new Event('change',{bubbles:true}))};
 dig(CIM,'4');dig(TUBO,'2');dig(AREIA,'3');$('#pedirRevisar').click();
 ['Alvenaria','Laje','Hidráulico'].forEach((d,i)=>{const s=document.querySelectorAll('#pedirRevisao select')[i];s.value=d;s.dispatchEvent(new Event('change',{bubbles:true}))});r.enviarAtivo=!$('#pedirEnviar').disabled;
 $('#pedirEnviar').click();await espera(()=>/Pedido enviado/.test($('#prontoTexto').innerText));await espera(()=>mtLista().some(x=>x.itens.length===3&&!x._pendente));r.pedido=mtLista()[0].itens.map(i=>i.nome+' '+i.pedida+' → '+i.destino)}
if(P==='atende'){await espera(()=>reqLista().some(x=>x.status==='pendente'&&x.itens.length===3));const q=reqLista().find(x=>x.status==='pendente'&&x.itens.length===3);
 await reqAtender(q,q.itens.map(i=>i.pedida),'');await espera(()=>Req.itens.get(q.id)?.status==='atendida');r.atendida=Req.itens.get(q.id).itens.map(i=>i.nome+' '+i.atendida)}
if(P==='contas'){await espera(()=>window.__fb&&Cap.perfil);await espera(()=>mtNaObra('').length===3);
 $('#naObra').click();await espera(()=>$('#telaNaObra').classList.contains('ativa'));
 r.tabela=[...document.querySelectorAll('#naObraLista tbody tr')].map(texto);r.registrarAntes=$('#naObraRegistrar').disabled;
 const linha=n=>[...document.querySelectorAll('#naObraLista tr[data-mt-grupo]')].find(t=>t.textContent.includes(n));
 const conta=(n,modo,v)=>{const tr=linha(n);tr.querySelector('[data-mt-modo]').value=modo;const i=tr.querySelector('[data-mt-conta]');i.value=v;i.dispatchEvent(new Event('change',{bubbles:true}));return tr.querySelector('[data-mt-res]').textContent};
 r.acimaDoQueTem=(conta(CIM,'usei','9'),linha(CIM).querySelector('[data-mt-conta]').value);
 r.resultados={cimento:conta(CIM,'usei','4'),tubo:conta(TUBO,'devolvo','1'),areia:linha(AREIA).querySelector('[data-mt-res]').textContent};
 r.botao=$('#naObraRegistrar').textContent;$('#naObraRegistrar').click();r.resumo=texto($('#naObraLista'));r.botaoResumo=$('#naObraRegistrar').textContent;
 // voltar do resumo mantém as quantidades
 $('#naObraVoltar').click();r.voltouComValores=linha(TUBO).querySelector('[data-mt-conta]').value;$('#naObraRegistrar').click();
 $('#naObraRegistrar').click();await espera(()=>/Registrado/.test($('#prontoTexto').innerText));r.pronto=texto($('#prontoTexto'));
 await espera(()=>mtLista().some(x=>x.tipo==='devolucao'&&!x._pendente)&&mtNaObra('').length===1);
 const dev=mtLista().filter(x=>x.tipo==='devolucao');r.devolucoes=dev.length;r.devolucao=dev[0].itens.map(i=>i.nome+' '+i.pedida);
 r.comAObra=mtNaObra('').map(g=>g.nome+' '+g.total);$('#naObra').click();r.tabelaDepois=[...document.querySelectorAll('#naObraLista tbody tr')].map(texto)}
if(P==='recebe'){await espera(()=>reqLista().some(x=>x.tipo==='devolucao'&&x.status==='pendente'));await espera(()=>state.movements.filter(m=>m.type==='SAIDA'&&m.requisicaoId).length>=2);
 const d=reqLista().filter(x=>x.tipo==='devolucao'&&x.status==='pendente');r.pendentes=d.length;
 await reqReceberDevolucao(d[0],d[0].itens.map(i=>i.pedida));await espera(()=>Req.itens.get(d[0].id)?.status==='recebida');await espera(()=>state.movements.some(m=>m.type==='REQUISICAO'&&m.quantity<0&&m.devolucaoId===d[0].id));
 r.posicoes={cimento:pos(CIM),tubo:pos(TUBO),areia:pos(AREIA)};
 r.baixas=state.movements.filter(m=>m.type==='SAIDA'&&m.requisicaoId).map(m=>m.description+' '+m.quantity+' · '+m.note)}
return r}catch(e){return 'FALHOU: '+e.message+'\n'+e.stack}})()
