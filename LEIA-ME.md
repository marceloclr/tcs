# Gestão de Materiais — versão 2.0

Contabilidade de custos por clientes e projetos.

Sistema em um único `index.html`: estoque de produtos comprados com NF-e, organizado por **cliente → projeto → produto**, com compras coletivas, saídas e pedidos de orçamento. Os dados ficam no IndexedDB do navegador. Publicado em https://marceloclr.gitlab.io/tcs/.

## Telas
| Menu | O que faz |
|---|---|
| Visão geral | Clientes, valor em estoque, notas a vincular e uma barra por cliente com a parte de cada projeto. |
| Clientes | Cadastro de clientes, com o valor pago e o valor em estoque de cada um. |
| Projetos | Projetos de cada cliente. Cada projeto tem uma cor e uma situação (ativo ou encerrado). |
| Fornecedores | Busca por fornecedor, com notas e itens (igual à 1.5). |
| Estoque › Saldo | Grid hierárquica: cliente → projeto → produto. |
| Estoque › Notas fiscais | Notas a vincular, notas em distribuição e notas vinculadas. |
| Estoque › Importar notas | XML de NF-e, PDF textual e OCR (igual à 1.5). |
| Solicitar orçamento | Pedido de orçamento, histórico dos pedidos e catálogo de produtos. |
| Dados e segurança | Backup, restauração e limpeza da base. |

## Regras
- **Nota importada.** Fica "a vincular" e não soma em cliente nem em projeto até ser vinculada.
- **Vínculo simples.** No painel da nota, escolha cliente · projeto e clique em "Vincular". A nota inteira, ou o que restar dela, vai para o projeto.
- **Compra coletiva.** No mesmo painel, a matriz item × projeto recebe as unidades de cada projeto, que podem ser de clientes diferentes.
  - A soma por item nunca pode passar da quantidade da nota: o item fica em vermelho e o salvamento é bloqueado.
  - A barra colorida mostra a parte de cada projeto e a parte livre, que fica hachurada.
  - A distribuição pode ser salva parcial. O restante continua "a vincular".
- **Valor pago por item.** É o valor bruto menos o desconto, mais o rateio de frete, seguro, outras despesas e impostos, proporcional ao valor líquido do item. Assim, a soma dos itens fecha com o total da nota (vNF).
- **Saída.** Fica em Estoque › Saldo, no botão "Registrar saída" da linha do produto. A quantidade é limitada ao saldo do produto naquele projeto.
- **Integridade.** Desvincular ou redistribuir uma nota fica bloqueado se o projeto ficar com menos entrada do que já consumiu. Projeto com notas não pode ser excluído; use a situação "Encerrado".

## Grid do estoque
- **Colunas:** quantidade de entrada, quantidade de saída, saldo, valor pago e valor em estoque. O valor em estoque é o saldo × o custo médio pago no projeto.
- **Abertura:** clientes e projetos carregam abertos; os produtos começam recolhidos. Clique no cliente para recolher ou abrir os projetos, e no projeto para abrir os produtos.
- **Totais:** a linha "Total do estoque" soma tudo o que está vinculado. A linha "Aguardando vínculo" aparece separada, fora do total.
- **Exportação:** o CSV segue a mesma hierarquia.

## Pedido de orçamento
- **Fornecedor:** sugerido pelo histórico de notas; o CNPJ é preenchido sozinho.
- **Itens:** vêm do catálogo (com o último custo pago) ou são digitados, com especificação e quantidade. Os itens digitados podem entrar no catálogo com a origem "Digitado".
- **Gerar pedido:** grava o pedido como `ORC-AAAA-NNN` e abre a impressão, onde é possível "Salvar como PDF". Também há exportação em CSV, reimpressão e a opção "Usar como modelo".

## Nuvem
- Com login Google, os dados são sincronizados com o Firestore do projeto `thiago-17d18`, um documento por registro e em tempo real entre os usuários liberados.
- Sem login, o sistema funciona só no navegador.
- Configuração, liberação de e-mails e limitações: [docs/nuvem-firebase.md](docs/nuvem-firebase.md).
- Regras de acesso: [firestore.rules](firestore.rules).

## Dados
- **Base.** IndexedDB `estoque_nfe_erp_v1`, versão 3. As stores são `products`, `invoices`, `movements`, `clients`, `projects`, `allocations` e `quotes`.
- **Migração.** A base da 1.5 é aberta sem perda: as notas existentes ficam "a vincular".
- **Backup.** O backup JSON usa `schema: 3`. A restauração também aceita backups da 1.5, que não têm clientes, projetos nem pedidos.

## Testes feitos (16/10/2026, Edge headless)
- **Migração.** A base da 1.5 com a NF de exemplo foi aberta na 2.0, e os produtos foram ligados aos itens.
- **Restauração.** Um backup da 1.5 foi restaurado numa base vazia.
- **Importação.** Um XML válido foi aceito. Foram rejeitados um XML duplicado, um XML sem NF-e e um PDF inválido.
- **Vínculo e distribuição.** Uma nota foi vinculada inteira. Uma nota com frete foi distribuída entre dois clientes. A tentativa de passar da quantidade da nota foi bloqueada.
- **Saída.** Foi registrada uma saída e bloqueada outra acima do saldo. Também foi bloqueado desvincular uma nota de um projeto que já tinha saída.
- **Conferência dos totais.** O valor pago vinculado (R$ 831,91) é igual à soma das notas. O valor em estoque cai exatamente o valor das saídas.
- **Orçamento.** Foi gerado um pedido com um item do catálogo e um item digitado. O documento de impressão foi conferido em captura.
- **Backup.** O backup em `schema 3` contém as sete stores.

O OCR de PDF digitalizado não foi testado nesta versão, e o código dele não mudou desde a 1.5.
