// Importação da tabela de materiais por planilha .xlsx (administrador), em index.html?emulador=1 (8767), depois do 1-admin.js
// (e de preferência do 19-materiais-requisicao.js, que deixa o "Cimento CP II 50 kg" cadastrado):
// painel na tela, modelo vazio e tabela atual gerados, prévia (novo, alterar, sem mudança, erros), nada gravado antes de confirmar,
// gravação na nuvem com uma só linha no log, e tabela atual baixada de novo com os IDs.
(async()=>{try{const r={};
const espera=(f,ms=30000)=>new Promise((res,rej)=>{const t0=Date.now();const i=setInterval(()=>{let v;try{v=f()}catch(e){}if(v){clearInterval(i);res(v)}else if(Date.now()-t0>ms){clearInterval(i);rej(new Error('tempo esgotado: '+f))}},150)});
await espera(()=>window.__fb);if(!Nuvem.user)await __fb.loginTeste('marceloclr@gmail.com');await espera(()=>Nuvem.perfil&&Nuvem.estado==='online');
const log=[];const orig=window.registrarAtividade;window.registrarAtividade=a=>{log.push(a);return orig(a)};
go('materiais');r.painel=!!document.querySelector('#matpPainel');
const ExcelJS=await loadLibrary(...LIB_EXCELJS);r.excel=!!ExcelJS;
// modelo vazio pela tela (download)
document.querySelector('[data-matp="modelo"]').click();await espera(()=>log.some(a=>a.acao==='xlsx'));
const antes=state.materiais.length,cim=state.materiais.find(m=>m.nome==='Cimento CP II 50 kg'&&!m.juntadoEm);
// tabela atual + edições
// a tabela sai sem o cimento: a linha dele entra sem ID e casa pelo nome + unidade. Nomes com marca, para o roteiro repetir.
const T=Date.now().toString(36).slice(-4);const wb=matPlanilhaGerar(ExcelJS,{materiais:state.materiais.filter(m=>m.id!==cim.id)});const ws=wb.getWorksheet('Materiais');let n=MATP_LINHA_CAB+1;while(ws.getRow(n).getCell(2).value)n++;
r.linhasTabela=n-MATP_LINHA_CAB-1;
const add=v=>{ws.getRow(n++).values=v};
add(['','Areia média '+T,'m3','Agregados (areia, brita)','']);add(['','Brita 1 '+T,'M3','Agregados (areia, brita)','Ativo']);add(['','Vergalhão CA-50 10 mm '+T,'BR','Aço e ferragens','']);
add(['','CIMENTO CP II 50 KG','SC','Cimento e argamassa '+T,'']); // casa com o existente: muda só a categoria
add(['','Areia média '+T,'M3','','']);                              // repetida → erro
add(['','Prego 17x27','','','']);                                // sem unidade → erro
const arq=new File([await wb.xlsx.writeBuffer()],'materiais-teste.xlsx');
await matPlanilhaLer(arq);renderMateriais();
const p=MatP.previa;r.previa=p.reduce((o,x)=>(o[x.acao]=(o[x.acao]||0)+1,o),{});r.erros=p.filter(x=>x.acao==='erro').map(x=>x.linha+': '+x.erro);
r.cimento=p.filter(x=>x.atual?.id===cim?.id).map(x=>x.acao+' '+x.mudou.join(','));
r.nadaGravadoAntes=state.materiais.length===antes;
r.botao=document.querySelector('[data-matp="gravar"]').textContent;
window.__shot=true;await new Promise(s=>setTimeout(s,300));
document.querySelector('[data-matp="gravar"]').click();
await espera(()=>/Planilha importada/.test(document.querySelector('#materiaisBody').textContent));await espera(()=>Nuvem.pendentes===0);
r.aviso=Nuvem.aviso||'';r.depois=state.materiais.length-antes;
r.nuvem=['Areia média','Brita 1','Vergalhão CA-50 10 mm'].map(x=>x+' '+T).map(nm=>{const m=state.materiais.find(x=>x.nome===nm);return nm+': '+(m&&Nuvem.docs.materiais?.has(m.id)?'na nuvem':'FALTA')});
r.cimentoCategoria=materialById(cim.id)?.categoria;
r.log=log.filter(a=>a.cat==='catalogo').map(a=>a.acao+': '+a.texto);
// arquivo errado
try{await matPlanilhaLer(new File(['x'],'tabela.csv'));r.csv='aceitou'}catch(e){r.csv=e.message}
// ida e volta: a tabela atual baixada de novo, sem mudança, dá tudo "sem mudança"
const wb2=matPlanilhaGerar(ExcelJS,{materiais:state.materiais});await matPlanilhaLer(new File([await wb2.xlsx.writeBuffer()],'volta.xlsx'));r.idaEVolta=MatP.previa.every(x=>x.acao==='igual')?'tudo igual ('+MatP.previa.length+')':JSON.stringify(MatP.previa.filter(x=>x.acao!=='igual'));
MatP.previa=null;renderMateriais();
return r}catch(e){return 'ERRO: '+e.message+'\n'+e.stack}})()
