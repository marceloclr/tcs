// Gera modelos/materiais-modelo.xlsx com o mesmo código da tela (js/materiais-planilha.js) e confere a leitura de volta.
// Uso: cd testes && node gerar-modelo-materiais.mjs
import fs from 'node:fs';import ExcelJS from 'exceljs';
const ctx={document:{addEventListener(){}},norm:s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),
 uid:()=>Math.random().toString(36).slice(2),Nuvem:{user:{email:'teste@x'}},console};
// new Function (e não node:vm): a ExcelJS só reconhece arrays do mesmo realm
ctx.API=new Function(...Object.keys(ctx),fs.readFileSync(new URL('../js/materiais-planilha.js',import.meta.url),'utf8')+';return {matPlanilhaGerar,matPlanilhaLinhas,matPlanilhaConferir}')(...Object.values(ctx));
const {matPlanilhaGerar,matPlanilhaLinhas,matPlanilhaConferir}=ctx.API;
const versao=process.env.VERSAO||'';const saida=new URL('../modelos/materiais-modelo.xlsx',import.meta.url);
await matPlanilhaGerar(ExcelJS,{versao}).xlsx.writeFile(saida.pathname);console.log('gravado',saida.pathname,fs.statSync(saida).size,'bytes');
// ida e volta: tabela atual + linhas editadas
const tabela=[{id:'m1',nome:'Cimento CP II 50 kg',unidade:'SC',categoria:'Cimento e argamassa',ativo:true},{id:'m2',nome:'Areia média',unidade:'M3',categoria:'',ativo:true},{id:'m3',nome:'Velho',unidade:'UN',juntadoEm:'m1'}];
// a planilha sai só com a areia (linha 4); o cimento entra sem ID e casa pelo nome + unidade
const wb=matPlanilhaGerar(ExcelJS,{materiais:tabela.filter(m=>m.id!=='m1')});const ws=wb.getWorksheet('Materiais');
ws.getRow(4).getCell(4).value='Agregados (areia, brita)';           // altera m2
ws.getRow(6).values=['','Brita 1','m3','Agregados (areia, brita)',''];  // novo
ws.getRow(7).values=['','cimento cp ii 50 kg','SC','','Desativado']; // sem ID, casa com m1 → alterar
ws.getRow(8).values=['','Brita 1','M3','',''];                     // repetido → erro
ws.getRow(9).values=['x9','Tijolo','UN','',''];                    // ID desconhecido → erro
ws.getRow(10).values=['','Prego','','',''];                        // sem unidade → erro
ws.getRow(11).values=['','Cal','SC','','talvez'];                  // situação inválida → erro
const wb2=new ExcelJS.Workbook();await wb2.xlsx.load(await wb.xlsx.writeBuffer());
const r=matPlanilhaConferir(matPlanilhaLinhas(wb2),tabela).map(x=>[x.linha,x.acao,x.nome,x.erro||x.mudou.join(',')]);console.table(r);
const esperado=['alterar','novo','alterar','erro','erro','erro','erro'];const ok=JSON.stringify(r.map(x=>x[1]))===JSON.stringify(esperado);
console.log(ok?'OK: leitura de volta confere':'FALHOU: '+JSON.stringify(r.map(x=>x[1])));process.exit(ok?0:1);
