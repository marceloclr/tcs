# Gestão de Materiais — versão 2.0

Contabilidade gerencial de custos por clientes e projetos.

Sistema em um único `index.html` para os custos de **materiais** (NF-e, com estoque) e de **serviços** (NFS-e, custo direto), organizados por **cliente → projeto**, com compras e contratações coletivas, saídas de estoque e pedidos de orçamento. Os dados ficam na nuvem (Firebase), com uma cópia no navegador. Publicado em https://marceloclr.gitlab.io/tcs/.

A versão aparece no canto inferior esquerdo, no formato `V-DDMMAAAA-HHMM`. Ela vem do título da página e é atualizada a cada commit.

## Telas
| Menu | O que faz |
|---|---|
| Visão geral | Indicadores e gráficos, com filtro por cliente.<br>• Indicadores: custo total, materiais, serviços, valor em estoque, clientes e projetos.<br>• Custo por cliente e por projeto (materiais em estoque, materiais consumidos e serviços).<br>• Composição do custo e linha do tempo de entradas e saídas em R$.<br>• Resumo cliente → projeto. |
| Clientes | Cadastro de clientes, com materiais, serviços, custo total e valor em estoque de cada um. |
| Projetos | Projetos de cada cliente, com uma cor, uma situação (ativo ou encerrado) e os mesmos totais. |
| Fornecedores | Busca por fornecedor ou prestador, com notas e itens. |
| Estoque › Saldo | Grid hierárquica cliente → projeto → produto. Só materiais. |
| Estoque › Notas fiscais | Notas a vincular, em distribuição e vinculadas, com filtro Materiais/Serviços. |
| Estoque › Importar notas | Duas caixas:<br>• **materiais:** XML de NF-e ou PDF do DANFE;<br>• **serviços:** XML de NFS-e, PDF ou digitação. |
| Solicitar orçamento | Pedido de orçamento, histórico dos pedidos e catálogo de produtos. |
| Dados e segurança | Nuvem, backup, restauração e limpeza da cópia local. |

## Notas de serviço
- **Formatos aceitos:**
  - **XML:** padrão nacional (`infNFSe`, chave de 50 dígitos) e ABRASF das prefeituras (`InfNfse`, v1 e v2).
  - **PDF:** é lido (texto ou OCR) e preenche o formulário para conferência, porque os layouts mudam de prefeitura para prefeitura.
  - **Digitação:** prestador, número, data, descrição, valor, desconto incondicionado e retenções.
- **Tipo:** na conferência, cada nota mostra a escolha **Materiais** ou **Serviços**, já marcada conforme a caixa de origem. A NFS-e é sempre serviço. Uma NF-e pode ser marcada como serviço; nesse caso, não entra no estoque.
- **Custo:** segue as mesmas regras dos materiais. O total da NFS-e é o valor dos serviços menos o desconto incondicionado. As retenções (ISS retido, IR, INSS, PIS, COFINS e CSLL) e o valor líquido ao prestador ficam registrados como informação.
- **Vínculo:** a nota de serviço também começa "a vincular".
  - **Uma nota para um projeto:** o vínculo simples manda a nota inteira para um projeto.
  - **Contratação coletiva:** divide o valor **em R$** entre projetos, de um ou mais clientes. A soma não passa do total, e os valores fecham no centavo.

## Regras dos materiais
- **Nota importada.** Fica "a vincular" e não soma em cliente nem em projeto até ser vinculada.
- **Compra coletiva.** A matriz item × projeto recebe as unidades de cada projeto. A soma por item nunca passa da quantidade da nota. A distribuição pode ser salva parcial.
- **Valor pago por item.** É o valor bruto menos o desconto, mais o rateio de frete, seguro, outras despesas e impostos. A soma dos itens fecha com o total da nota (vNF).
- **Saída.** Fica em Estoque › Saldo, no botão "Registrar saída", e é limitada ao saldo do produto no projeto.
- **Integridade.** Desvincular ou redistribuir uma nota fica bloqueado se o projeto ficar com menos entrada do que já consumiu.

## Linha do tempo (Visão geral)
- **Séries:** um gráfico de linhas em R$, com um único eixo:
  - **Entradas de materiais** e **Serviços contratados**, pela data da nota e só com o que está vinculado;
  - **Saídas de materiais**, pela data da saída (quantidade × custo médio).
- **Período:** por mês, ou por dia quando o intervalo é de até 45 dias. Respeita o filtro por cliente.
- **Leitura:** passar o mouse mostra os valores do período, e "Ver os valores em tabela" abre a tabela.

## Pedido de orçamento
- **Fornecedor:** sugerido pelo histórico de notas, com o CNPJ preenchido sozinho.
- **Itens:** vêm do catálogo (com o último custo pago) ou são digitados.
- **Gerar pedido:** grava `ORC-AAAA-NNN` e abre a impressão, que também salva em PDF. A marca da Engenharia aparece no topo. Também há CSV, reimpressão e "Usar como modelo".

## Nuvem
- **Acesso:** o sistema abre numa tela de login Google. Só entram os e-mails liberados em [firestore.rules](firestore.rules).
- **Sincronização:** cada alteração vai para o Firestore do projeto `thiago-17d18` na hora, e as dos outros usuários aparecem ao vivo. O que é feito offline sobe sozinho no próximo login.
- **Configuração e limitações:** [docs/nuvem-firebase.md](docs/nuvem-firebase.md).

## Dados
- **Base local:** IndexedDB `estoque_nfe_erp_v1`, versão 3. As stores são `products`, `invoices` (com `tipo`: `material` ou `servico`), `movements`, `clients`, `projects`, `allocations` e `quotes`.
- **Notas antigas:** as notas sem `tipo` valem como materiais.
- **Backup:** o backup JSON usa `schema: 3`. A restauração também aceita backups da 1.5.

## Testes feitos (16/10/2026, Edge headless, com um Firebase simulado)
- **Materiais:**
  - migração da base da 1.5 e restauração de um backup da 1.5;
  - importação, com notas duplicadas e XML inválido recusados;
  - vínculo, compra coletiva com bloqueio de excesso e saídas;
  - totais conferidos: R$ 831,91 pagos = soma das notas;
  - pedido de orçamento e backup.
- **Serviços:**
  - **XML:** NFS-e no padrão nacional (R$ 3.000, com IR) e no ABRASF v2 (R$ 1.250 com desconto de R$ 50 e ISS e INSS retidos), com número, data, prestador, total e líquido conferidos.
  - **PDF e digitação:** um PDF de NFS-e preencheu todos os campos do formulário; uma nota digitada calculou as retenções; a edição de uma nota da conferência funcionou.
  - **Gravação:** a NFS-e entra sem criar produto nem movimentação de estoque.
  - **Divisão em R$:** R$ 1.234,56 + R$ 1.765,44 = R$ 3.000,00. O excesso foi bloqueado, e a divisão igual deu R$ 600 + R$ 600.
- **Visão geral:** custo total, materiais, serviços, estoque e cada mês da linha do tempo conferidos com valores calculados à mão.

Não foram testados o OCR de PDF digitalizado nem PDFs reais de NFS-e de cada prefeitura. A leitura de PDF é aproximada e sempre passa pelo formulário.
