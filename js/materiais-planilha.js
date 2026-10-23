// ==== #JS-MATERIAIS-PLANILHA: START ====
// Planilha (.xlsx) da tabela de materiais: o administrador baixa o modelo (vazio ou com a tabela atual), preenche no Excel
// ou no LibreOffice e envia de volta para povoar o banco. Colunas iguais ao cadastro: ID do sistema | Nome padronizado |
// Unidade | Categoria | Situação. Linha com ID altera aquele material; sem ID, casa pelo nome + unidade ou cria um novo.
// Nada é gravado antes da prévia: o administrador confere novos, alterados e erros e confirma.
// A biblioteca ExcelJS é carregada só quando usada (./libs/exceljs, ou a CDN).
const LIB_EXCELJS=['./libs/exceljs/exceljs.min.js','https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js','ExcelJS'];
const MATP_UNIDADES=[['UN','Unidade'],['SC','Saco'],['KG','Quilograma'],['T','Tonelada'],['M','Metro'],['M2','Metro quadrado'],['M3','Metro cúbico'],['L','Litro'],['GL','Galão'],['LT','Lata'],['BD','Balde'],['CX','Caixa'],['PC','Peça'],['PCT','Pacote'],['RL','Rolo'],['BR','Barra'],['TB','Tubo'],['CJ','Conjunto'],['PAR','Par'],['MIL','Milheiro'],['FD','Fardo'],['VB','Verba']];
const MATP_CATEGORIAS=['Cimento e argamassa','Agregados (areia, brita)','Alvenaria e blocos','Aço e ferragens','Madeira e formas','Hidráulica','Elétrica','Impermeabilização','Revestimentos e pisos','Tintas e acabamento','Louças e metais','Esquadrias e vidros','Ferramentas e EPI','Diversos'];
const MATP_COLS=['ID do sistema','Nome padronizado','Unidade','Categoria','Situação'];
const MATP_LINHA_CAB=3,MATP_LINHAS=1000;
const MatP={previa:null,arquivo:'',msg:''};

// Monta o modelo. Função pura (sem DOM): também gera o arquivo do repositório pelo Node (testes/gerar-modelo-materiais.mjs).
function matPlanilhaGerar(ExcelJS,{materiais=[],categorias=[],versao=''}={}){
 const wb=new ExcelJS.Workbook();wb.creator='TCS — Gestão de Materiais';wb.created=new Date();
 const F='IBM Plex Sans',TINTA='FF1C1F23',TINTA3='FF737A83',PAPEL='FFF3F1EC',CARTA2='FFFAF8F4',LINHA='FFD9D4CB',GRAFITE='FF3F4750',LATAO='FF8D7130';
 const borda={bottom:{style:'thin',color:{argb:LINHA}}};
 const cats=[...new Set([...categorias,...MATP_CATEGORIAS].map(c=>String(c||'').trim()).filter(Boolean))];
 // aba Materiais
 const ws=wb.addWorksheet('Materiais',{views:[{state:'frozen',ySplit:MATP_LINHA_CAB,showGridLines:false}],properties:{tabColor:{argb:GRAFITE}}});
 ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'3:3'};ws.columns=[{key:'id',width:24},{key:'nome',width:46},{key:'unidade',width:11},{key:'categoria',width:30},{key:'situacao',width:14}];
 ws.mergeCells('A1:E1');ws.getCell('A1').value='Tabela de materiais padronizados';ws.getCell('A1').font={name:'IBM Plex Serif',size:15,bold:true,color:{argb:TINTA}};ws.getRow(1).height=24;
 ws.mergeCells('A2:E2');ws.getCell('A2').value=`Preencha a partir da linha ${MATP_LINHA_CAB+1}. Obrigatórios: Nome padronizado e Unidade. Deixe o ID do sistema em branco para material novo. Veja a aba Instruções.${versao?'  ·  '+versao:''}`;
 ws.getCell('A2').font={name:F,size:9,italic:true,color:{argb:TINTA3}};ws.getCell('A2').alignment={wrapText:true,vertical:'top'};ws.getRow(2).height=28;
 const cab=ws.getRow(MATP_LINHA_CAB);cab.values=MATP_COLS.map((c,i)=>i===1||i===2?c+' *':c);cab.height=22;
 cab.eachCell((c,i)=>{c.font={name:F,size:10,bold:true,color:{argb:'FFFFFEFC'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:i===1?TINTA3:GRAFITE}};c.alignment={vertical:'middle'}});
 ws.getCell(MATP_LINHA_CAB,1).note='Preenchido pelo sistema quando a planilha sai com a tabela atual. Não altere. Em branco = material novo.';
 ws.getCell(MATP_LINHA_CAB,2).note='Nome como a obra e o escritório vão ver. Ex.: Cimento CP II 50 kg. Nome + unidade não pode repetir.';
 ws.getCell(MATP_LINHA_CAB,3).note='Sigla da unidade de controle (veja a aba Listas). A quantidade das notas entra 1 para 1.';
 ws.getCell(MATP_LINHA_CAB,4).note='Opcional. Escolha da lista ou digite uma nova.';
 ws.getCell(MATP_LINHA_CAB,5).note='Ativo (padrão, aparece para o mestre) ou Desativado.';
 ws.autoFilter={from:{row:MATP_LINHA_CAB,column:1},to:{row:MATP_LINHA_CAB,column:5}};
 const ativos=materiais.filter(m=>!m.juntadoEm).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));
 ativos.forEach((m,i)=>{ws.getRow(MATP_LINHA_CAB+1+i).values=[m.id,m.nome,m.unidade,m.categoria||'',m.ativo===false?'Desativado':'Ativo']});
 const fim=MATP_LINHA_CAB+Math.max(MATP_LINHAS,ativos.length+200);
 for(let r=MATP_LINHA_CAB+1;r<=fim;r++){const row=ws.getRow(r);
  for(let c=1;c<=5;c++){const cel=row.getCell(c);cel.font={name:F,size:10,color:{argb:c===1?TINTA3:TINTA}};cel.border=borda;cel.numFmt='@';if(c===1)cel.fill={type:'pattern',pattern:'solid',fgColor:{argb:CARTA2}}}
  row.getCell(3).dataValidation={type:'list',allowBlank:true,formulae:[`Listas!$A$2:$A$${MATP_UNIDADES.length+1}`],showErrorMessage:true,errorStyle:'warning',errorTitle:'Unidade fora da lista',error:'Esta sigla não está na aba Listas. Pode continuar se a unidade for essa mesmo.'};
  row.getCell(4).dataValidation={type:'list',allowBlank:true,formulae:[`Listas!$D$2:$D$${cats.length+1}`],showErrorMessage:true,errorStyle:'information',errorTitle:'Categoria nova',error:'Categoria fora da lista: ela será criada.'};
  row.getCell(5).dataValidation={type:'list',allowBlank:true,formulae:['"Ativo,Desativado"'],showErrorMessage:true,errorStyle:'stop',errorTitle:'Situação',error:'Use Ativo ou Desativado (em branco = Ativo).'}}
 // aba Instruções
 const wi=wb.addWorksheet('Instruções',{views:[{showGridLines:false}],properties:{tabColor:{argb:LATAO}}});wi.columns=[{width:4},{width:96}];
 const txt=[['t','Como preencher a tabela de materiais'],['',''],['h','Colunas da aba Materiais'],
  ['•','ID do sistema — preenchido pelo sistema na planilha baixada com a tabela atual. Não altere nem copie para outra linha. Em branco = material novo.'],
  ['•','Nome padronizado * — nome único que a obra vai pedir e o estoque vai somar. Inclua o que diferencia o material: tipo, medida, embalagem. Ex.: Cimento CP II 50 kg; Vergalhão CA-50 10 mm; Tubo PVC soldável 25 mm.'],
  ['•','Unidade * — sigla da unidade de controle (aba Listas): SC, M3, KG, UN… A quantidade de cada nota entra 1 para 1, sem conversão. Escolha a unidade em que o material chega nas notas.'],
  ['•','Categoria — opcional, para agrupar e buscar. Escolha da lista ou digite uma nova.'],
  ['•','Situação — Ativo (padrão) aparece para o mestre pedir; Desativado some da lista do mestre e dos vínculos, mas o histórico continua.'],
  ['',''],['h','O que acontece ao enviar'],
  ['•','Linha com ID: altera aquele material (nome, unidade, categoria, situação).'],
  ['•','Linha sem ID: se já existir um material com o mesmo nome e a mesma unidade, atualiza a categoria e a situação; senão, cadastra um material novo.'],
  ['•','Linhas em branco são ignoradas. Nome + unidade repetido na planilha, unidade vazia ou ID desconhecido viram erro e ficam de fora.'],
  ['•','Antes de gravar, o sistema mostra a prévia: novos, alterados, sem mudança e com erro. Nada é gravado sem a confirmação.'],
  ['•','A planilha não exclui materiais: para tirar um da lista, marque Desativado.'],
  ['•','O vínculo com os produtos das notas continua em Estoque › Vincular itens.'],
  ['',''],['h','Exemplos'],['•','Cimento CP II 50 kg | SC | Cimento e argamassa | Ativo'],['•','Areia média | M3 | Agregados (areia, brita) | Ativo'],['•','Vergalhão CA-50 10 mm | BR | Aço e ferragens | Ativo'],['•','Tubo PVC soldável 25 mm | BR | Hidráulica | Ativo']];
 txt.forEach(([k,v],i)=>{const r=wi.getRow(i+1);r.getCell(1).value=k==='•'?'•':'';r.getCell(2).value=v;r.getCell(2).alignment={wrapText:true,vertical:'top'};
  r.getCell(2).font=k==='t'?{name:'IBM Plex Serif',size:15,bold:true,color:{argb:TINTA}}:k==='h'?{name:F,size:11,bold:true,color:{argb:GRAFITE}}:{name:F,size:10,color:{argb:TINTA}};r.getCell(1).font={name:F,size:10,color:{argb:LATAO}}});
 // aba Listas (origem das listas suspensas)
 const wl=wb.addWorksheet('Listas',{views:[{state:'frozen',ySplit:1,showGridLines:false}],properties:{tabColor:{argb:TINTA3}}});wl.columns=[{width:10},{width:22},{width:3},{width:32}];
 wl.getRow(1).values=['Unidade','Significado','','Categoria'];[1,2,4].forEach(c=>{const x=wl.getCell(1,c);x.font={name:F,size:10,bold:true,color:{argb:'FFFFFEFC'}};x.fill={type:'pattern',pattern:'solid',fgColor:{argb:GRAFITE}}});
 MATP_UNIDADES.forEach(([s,d],i)=>{wl.getCell(i+2,1).value=s;wl.getCell(i+2,2).value=d});cats.forEach((c,i)=>{wl.getCell(i+2,4).value=c});
 wl.eachRow((r,n)=>{if(n>1)r.eachCell(c=>{c.font={name:F,size:10,color:{argb:TINTA}};c.border=borda})});
 wb.views=[{activeTab:0}];return wb}

// Lê a aba Materiais (ou a primeira) e devolve as linhas brutas [{linha, id, nome, unidade, categoria, situacao}]
function matPlanilhaLinhas(wb){const ws=wb.getWorksheet('Materiais')||wb.worksheets[0];if(!ws)throw new Error('A planilha está vazia.');
 const txt=v=>{if(v==null)return '';if(typeof v==='object'){if(v.richText)return v.richText.map(t=>t.text).join('');if('result' in v)return String(v.result??'');if(v.text)return String(v.text)}return String(v)};
 let cabN=0,col={};for(let r=1;r<=Math.min(15,ws.rowCount);r++){const vals=[];ws.getRow(r).eachCell({includeEmpty:true},(c,i)=>{vals[i]=norm(txt(c.value).replace('*',''))});
  const ach=k=>vals.findIndex(v=>v&&v.startsWith(k));if(ach('nome')>0){cabN=r;col={id:ach('id'),nome:ach('nome'),unidade:ach('unidade'),categoria:ach('categoria'),situacao:ach('situacao')};break}}
 if(!cabN)throw new Error('Não achei o cabeçalho "Nome padronizado". Use o modelo baixado do sistema.');
 if(col.unidade<1)throw new Error('Falta a coluna "Unidade". Use o modelo baixado do sistema.');
 const out=[];for(let r=cabN+1;r<=ws.rowCount;r++){const row=ws.getRow(r),g=k=>col[k]>0?txt(row.getCell(col[k]).value).trim():'';
  const l={linha:r,id:g('id'),nome:g('nome').replace(/\s+/g,' '),unidade:g('unidade').toUpperCase().replace(/\s+/g,''),categoria:g('categoria').replace(/\s+/g,' '),situacao:g('situacao')};
  if(l.id||l.nome||l.unidade||l.categoria)out.push(l)}
 return out}

// Confere as linhas contra a tabela atual: cada uma sai com acao 'novo' | 'alterar' | 'igual' | 'erro' e o registro a gravar
function matPlanilhaConferir(linhas,materiais){const vistos=new Map(),porId=new Map(materiais.map(m=>[m.id,m]));const chave=(n,u)=>norm(n)+'|'+norm(u||'UN');
 const porChave=new Map(materiais.filter(m=>!m.juntadoEm).map(m=>[chave(m.nome,m.unidade),m]));
 return linhas.map(l=>{const r={...l,acao:'erro',erro:'',mudou:[]};const sit=norm(l.situacao);
  const ativo=!sit||['ativo','ativa','sim','s','1'].includes(sit)?true:['desativado','desativada','inativo','inativa','nao','n','0'].includes(sit)?false:null;
  if(l.nome.length<2){r.erro='Nome padronizado vazio.';return r}
  if(!l.unidade){r.erro='Unidade vazia.';return r}
  if(l.unidade.length>8){r.erro='Unidade longa demais: use a sigla (SC, M3, KG…).';return r}
  if(ativo===null){r.erro=`Situação "${l.situacao}" inválida: use Ativo ou Desativado.`;return r}
  const k=chave(l.nome,l.unidade);if(vistos.has(k)){r.erro=`Repete o material da linha ${vistos.get(k)}.`;return r}vistos.set(k,l.linha);
  let atual=null;if(l.id){atual=porId.get(l.id);if(!atual){r.erro='ID do sistema desconhecido: apague o ID para cadastrar como novo.';return r}
   if(atual.juntadoEm){r.erro=`Este material foi juntado em "${porId.get(atual.juntadoEm)?.nome||atual.juntadoEm}". Use o material que ficou.`;return r}
   const outro=porChave.get(k);if(outro&&outro.id!==atual.id){r.erro=`Já existe outro material com esse nome e unidade ("${outro.nome}").`;return r}}
  else atual=porChave.get(k)||null;
  const novo={nome:l.nome,unidade:l.unidade,categoria:l.categoria,ativo};
  if(!atual){r.acao='novo';r.reg={id:uid(),...novo,criadoEm:new Date().toISOString(),criadoPor:Nuvem.user?.email||'',criadoPorNome:Nuvem.perfil?.nome||Nuvem.user?.nome||'',origem:'planilha'};return r}
  // sem ID, casou pelo nome + unidade: mantém a grafia do cadastro, e a categoria em branco não apaga a que já existe
  if(!l.id){novo.nome=atual.nome;novo.unidade=atual.unidade;if(!l.categoria)novo.categoria=atual.categoria||''}
  r.mudou=[['nome','Nome'],['unidade','Unidade'],['categoria','Categoria'],['ativo','Situação']].filter(([c])=>String(atual[c]??(c==='ativo'?true:''))!==String(novo[c])).map(([,t])=>t);
  r.atual=atual;r.acao=r.mudou.length?'alterar':'igual';if(r.mudou.length)r.reg={...atual,...novo};return r})}

async function matPlanilhaBaixar(comTabela){const ExcelJS=await loadLibrary(...LIB_EXCELJS);
 const wb=matPlanilhaGerar(ExcelJS,{materiais:comTabela?state.materiais:[],categorias:state.materiais.map(m=>m.categoria),versao:(document.title.match(/V-\d{8}-\d{4}/)||[''])[0]});
 const buf=await wb.xlsx.writeBuffer(),nome=comTabela?`materiais-tabela-${new Date().toISOString().slice(0,10)}.xlsx`:'materiais-modelo.xlsx';
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 registrarAtividade({cat:'exportacao',acao:'xlsx',texto:comTabela?`Baixou a tabela de materiais em planilha (${state.materiais.filter(m=>!m.juntadoEm).length} material(is))`:'Baixou o modelo de planilha de materiais'})}
async function matPlanilhaLer(arq){if(!/\.xlsx$/i.test(arq.name))throw new Error('Envie o arquivo .xlsx (o modelo baixado do sistema). Planilhas .xls ou .ods: salve como .xlsx antes.');
 const ExcelJS=await loadLibrary(...LIB_EXCELJS);const wb=new ExcelJS.Workbook();
 try{await wb.xlsx.load(await arq.arrayBuffer())}catch(e){throw new Error('Não consegui abrir a planilha. Confira se é um .xlsx válido.')}
 const linhas=matPlanilhaLinhas(wb);if(!linhas.length)throw new Error('A planilha não tem materiais preenchidos.');
 MatP.previa=matPlanilhaConferir(linhas,state.materiais);MatP.arquivo=arq.name;MatP.msg=''}
async function matPlanilhaImportar(){const ok=(MatP.previa||[]).filter(r=>r.acao==='novo'||r.acao==='alterar');if(!ok.length)throw new Error('Nada a gravar: não há materiais novos nem alterados.');
 const novos=ok.filter(r=>r.acao==='novo').length,alterados=ok.length-novos;
 await txWrite('materiais',os=>ok.forEach(r=>os.materiais.put(r.reg)),{importacao:{arquivo:MatP.arquivo,novos,alterados}});
 return {novos,alterados}}

// Painel em Estoque › Materiais (só administrador)
function matPlanilhaHtml(){if(!ehAdmin()||!podeEscrever())return '';const p=MatP.previa;
 const rot={novo:'<span class="pill">Novo</span>',alterar:'<span class="pill warn">Alterar</span>',igual:'<span class="pill gray">Sem mudança</span>',erro:'<span class="pill red">Erro</span>'};
 const conta=k=>(p||[]).filter(r=>r.acao===k).length,gravar=conta('novo')+conta('alterar');
 const ordem={erro:0,novo:1,alterar:2,igual:3};
 const tabela=p?`<div class="notice">Prévia de <strong>${esc(MatP.arquivo)}</strong>: <strong>${conta('novo')}</strong> novo(s), <strong>${conta('alterar')}</strong> a alterar, ${conta('igual')} sem mudança${conta('erro')?`, <strong class="erro-txt">${conta('erro')} com erro</strong> (ficam de fora; corrija na planilha e envie de novo)`:''}.</div>
  <div class="tablewrap" style="max-height:420px;overflow:auto"><table class="no-sort"><thead><tr><th class="num">Linha</th><th>Situação</th><th>Nome padronizado</th><th>Unid.</th><th>Categoria</th><th>Ativo</th><th>Observação</th></tr></thead><tbody>${[...p].sort((a,b)=>ordem[a.acao]-ordem[b.acao]||a.linha-b.linha).map(r=>`<tr><td class="num">${r.linha}</td><td>${rot[r.acao]}</td><td>${esc(r.reg?.nome??r.nome)}</td><td>${esc(r.reg?.unidade??r.unidade)}</td><td>${esc(r.reg?.categoria??r.categoria)}</td><td>${r.reg?(r.reg.ativo?'Sim':'Não'):r.atual?(r.atual.ativo!==false?'Sim':'Não'):esc(r.situacao)}</td><td class="hint">${r.acao==='erro'?`<span class="erro-txt">${esc(r.erro)}</span>`:r.acao==='alterar'?esc('Muda: '+r.mudou.join(', ')+(r.atual.nome!==r.nome?` (era "${r.atual.nome}")`:'')):r.acao==='igual'?'Igual à tabela':''}</td></tr>`).join('')}</tbody></table></div>
  <div class="row" style="margin-top:12px"><button class="btn primary" data-matp="gravar"${gravar?'':' disabled'} title="Grava os materiais novos e as alterações; as linhas com erro ficam de fora">Importar ${gravar} material(is)</button><button class="btn" data-matp="descartar">Descartar a prévia</button></div>`:'';
 return `<details class="panel" id="matpPainel" style="margin-bottom:14px"${p||MatP.msg||MatP.aberto?' open':''}><summary><strong>Importar planilha (.xlsx)</strong> <span class="hint">— povoar ou atualizar a tabela de uma vez (administrador)</span></summary>
  <p class="hint" style="margin-top:10px">Baixe o modelo, preencha no Excel, LibreOffice ou Google Planilhas (salve como .xlsx) e envie. As colunas são as do cadastro: <strong>ID do sistema</strong> (em branco para material novo), <strong>Nome padronizado</strong>*, <strong>Unidade</strong>*, <strong>Categoria</strong> e <strong>Situação</strong>. Antes de gravar, o sistema mostra a prévia.</p>
  <div class="row"><button class="btn" data-matp="modelo" title="Planilha vazia, com as listas de unidade, categoria e situação e as instruções">Baixar modelo vazio</button><button class="btn" data-matp="tabela" title="A mesma planilha já preenchida com a tabela atual (com o ID), para editar e enviar de volta">Baixar tabela atual (.xlsx)</button><label class="btn primary" title="Lê a planilha e mostra a prévia; nada é gravado ainda">Enviar planilha…<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-matp="arquivo" hidden></label></div>
  ${MatP.msg}${tabela}</details>`}
document.addEventListener('toggle',e=>{if(e.target.id==='matpPainel')MatP.aberto=e.target.open},true);
function matpMsg(h,t){MatP.msg=h?`<div class="notice ${t||''}" style="margin-top:12px">${h}</div>`:'';renderMateriais()}
document.addEventListener('change',async e=>{const f=e.target.closest?.('[data-matp="arquivo"]');if(!f||!f.files?.[0])return;const arq=f.files[0];f.value='';
 try{matpMsg('Lendo a planilha…');await matPlanilhaLer(arq);renderMateriais()}catch(err){MatP.previa=null;matpMsg(esc(err.message),'danger')}});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-matp]');if(!b||b.tagName==='INPUT')return;const k=b.dataset.matp;if(k==='arquivo')return;
 try{if(k==='modelo'||k==='tabela'){b.disabled=true;await matPlanilhaBaixar(k==='tabela');b.disabled=false;return}
  if(k==='descartar'){MatP.previa=null;matpMsg('');return}
  if(k==='gravar'){b.disabled=true;const {novos,alterados}=await matPlanilhaImportar();MatP.previa=null;await refresh();matpMsg(`Planilha importada: <strong>${novos}</strong> material(is) novo(s) e <strong>${alterados}</strong> alterado(s).`,'success')}}
 catch(err){b.disabled=false;matpMsg(esc(err.message),'danger')}});
// ==== #JS-MATERIAIS-PLANILHA: END ====
