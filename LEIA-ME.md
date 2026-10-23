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
| Estoque › Saldo | Grid hierárquica cliente → projeto → **material** (ou produto do fornecedor), com as posições **Estoque**, **Requisitado** e **Consumido**. Só materiais. |
| Estoque › Materiais | Tabela de materiais padronizados (nome, unidade, categoria), com os produtos de fornecedor vinculados e o saldo por obra; editar, juntar e desativar. O administrador também importa a tabela por planilha .xlsx: modelo em `modelos/materiais-modelo.xlsx` (ou baixado pela tela, vazio ou com a tabela atual), prévia antes de gravar (`js/materiais-planilha.js`, biblioteca ExcelJS carregada sob demanda). |
| Estoque › Vincular itens | Produtos das notas ainda sem material, com sugestão pelo nome; vínculo um a um, em lote ou criando o material. |
| Estoque › Requisições da obra | Pedidos e devoluções do mestre: atender (estoque → requisitado), recusar, confirmar devolução (requisitado → estoque); abas Pendentes, Com a obra e Histórico; CSV. |
| Estoque › Produtos e ajustes | Dados do produto (nome, EAN e unidade) e, por projeto, recebido, saldo, custo médio e valor em estoque. Administradores ajustam a quantidade (pela contagem) e o custo médio, com motivo; histórico dos ajustes. |
| Estoque › Baixas de estoque | Cada baixa com data, produto, projeto, quantidade, valor, motivo, responsável e situação (ativa ou estornada). Filtros por período, projeto, responsável e situação; estorno com motivo; CSV. |
| Estoque › Notas fiscais | Notas a vincular, em distribuição e vinculadas, com filtro Materiais/Serviços. |
| Estoque › Importar notas | Duas caixas:<br>• **materiais:** XML de NF-e ou PDF do DANFE;<br>• **serviços:** XML de NFS-e, PDF ou digitação. |
| Solicitar orçamento | Pedido de orçamento, histórico dos pedidos e catálogo de produtos (só para escolher itens; a edição fica em Estoque › Produtos e ajustes). |
| Dados e segurança | Nuvem, backup, restauração e limpeza da cópia local. |
| Usuários e acessos › Log de atividades | Só administradores. Tudo o que cada pessoa faz no sistema, com filtros por período, pessoa e tipo, busca e CSV. |

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
- **Saída (baixa).** Fica em Estoque › Saldo, no botão "Registrar saída", e é limitada ao saldo do produto no projeto. O motivo ou destino é obrigatório, e a baixa guarda quem a registrou.
- **Estorno.** Uma baixa não se altera nem se apaga. Para corrigir, Estoque › Baixas de estoque › Estornar: o estorno devolve a quantidade ao projeto, com o motivo e o nome de quem estornou. Cada baixa só pode ser estornada uma vez.
- **Ajuste (só administradores).** Em Estoque › Produtos e ajustes, informe a quantidade contada e, se for o caso, o custo médio correto, com o motivo. Falta sai como baixa e vira custo do projeto; sobra entra como recebimento sem nota, ao custo médio; o custo corrigido vale para o saldo e para o já baixado. As notas não mudam, e estoque + custo apropriado continua igual ao total adquirido. Ajuste não se estorna: corrige-se com outro ajuste.
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

## Acessos, captura pela obra e estoque sob custódia (19/10/2026)
- **Acesso por usuário, cliente e projeto**, administrado na aba Usuários e acessos e garantido pelas regras do Firestore ([`firestore.rules`](firestore.rules)).
- **Importação de fotos, PDF de NFC-e, código de barras e QR Code**, com chave validada e bloqueio de nota repetida; aproveitamento do link de consulta (página salva ou texto colado).
- **Tela da obra** (https://marceloclr.gitlab.io/tcs/mestre, arquivo [`captura.html`](captura.html), app "Notas TCS"; manual com figuras em https://marceloclr.gitlab.io/tcs/manual, arquivo [`manual-mestre.html`](manual-mestre.html)): fotografar, escolher a obra e enviar, também sem internet e pelo menu Compartilhar; **fila "Recebidas da obra"** no escritório.
- **Visão geral** separa o valor em estoque sob custódia do custo apropriado (baixas e serviços).
- Guia completo, inclusive o passo a passo para o mestre de obras: [`ACESSOS-E-CAPTURA.md`](ACESSOS-E-CAPTURA.md). Testes: [`testes/LEIA-ME.md`](testes/LEIA-ME.md). Plano: [`docs/planos/acessos-e-captura.md`](docs/planos/acessos-e-captura.md).


## Log de atividades e baixas de estoque (21/10/2026)
- **O que entra no log:** entrada e saída do sistema, abertura no modo offline, notas importadas, alteradas e excluídas, vínculos e distribuições (com o valor por projeto, antes e depois), **baixas e estornos de estoque**, clientes, projetos, catálogo, pedidos de orçamento, mudanças de acesso, notas da obra (envio, conferência, lançamento e descarte), exportações em CSV, backup, restauração, impressão do pedido e limpeza da cópia local.
- **Cada registro guarda** quem (nome, e-mail e papel), quando (hora do aparelho e hora do servidor), o tipo, a descrição, o projeto, o valor em R$ e o aparelho.
- **Quem vê:** só administradores, na aba Usuários e acessos › Log de atividades. Ninguém altera nem apaga um registro, nem o administrador.
- **Sem internet:** os registros esperam neste navegador e sobem no próximo login, marcados como *offline*. O que foi feito no modo offline, sem login, fica em nome de quem entrar depois neste navegador.
- **Como funciona:** [`js/atividades.js`](js/atividades.js). Toda gravação passa por `txWrite`; o log descreve as operações comparando com os dados anteriores, então uma tela nova já entra no log sem código extra. As regras ficam na coleção `atividades` de [`firestore.rules`](firestore.rules).
- **Baixas antigas,** anteriores a 21/10/2026, não têm o responsável gravado: o relatório mostra o e-mail de quem as enviou à nuvem, quando houver.
- **Publicação:** as regras novas precisam ser publicadas no console do Firebase (Firestore Database › Regras). Até lá, as atividades ficam guardadas em cada navegador e sobem assim que as regras forem publicadas.

## Código da nota pelo celular e busca automática da NFC-e (22/10/2026)
- **Tela da obra:** botão **🔍 Ler código da nota**.
  - A câmera ao vivo lê o QR Code ou o código de barras.
  - Ou toque em **Digitar os números**: o celular confere o dígito verificador da chave antes de aceitar.
  - A foto da nota passa a ser opcional; quando tirada, vira o comprovante de recebimento.
- **Busca automática:** o job `buscar-nfce` do GitLab CI ([`servidor/buscar-nfce.mjs`](servidor/buscar-nfce.mjs)) roda de hora em hora, das 7 às 18 h, e consulta a NFC-e na SEFAZ-CE (pelo link do QR ou só pela chave).
  - A fila mostra **Dados da SEFAZ prontos**, e **Conferir** abre a nota com emitente, data, itens e total.
  - A NF-e (modelo 55) não tem busca automática: segue pela foto ou pelo XML.
- **Buscar agora:** botão na fila que dispara o job sem esperar a rodada, depois de o administrador gravar o token de trigger.
- **Implantação** (conta de serviço, variável `FIREBASE_SA`, agendamento, token e cota de minutos): [`docs/busca-nfce.md`](docs/busca-nfce.md). As regras do Firestore mudaram (captura só com o código e `config/busca`): publique de novo no console.

## Manuais (22/10/2026)
- **Mestre de obras:** https://marceloclr.gitlab.io/tcs/manual ([`manual-mestre.html`](manual-mestre.html)), com ilustrações das telas. **Cartaz de uma folha** para colar na sala da obra, com QR Code que abre o Notas TCS: [`manuais/manual-mestre.pdf`](manuais/manual-mestre.pdf).
- **Escritório:** https://marceloclr.gitlab.io/tcs/manual-escritorio ([`manual-escritorio.html`](manual-escritorio.html)), aberto pelo botão **Manual** no topo do sistema. Guia rápido em PDF: [`manuais/manual-escritorio.pdf`](manuais/manual-escritorio.pdf).
- **Formato:** menu à esquerda, que marca a seção atual (no celular, gaveta pelo botão **Índice**), e "Voltar ao índice" em cada seção. Estilo e comportamento em [`css/manual.css`](css/manual.css) e [`js/manual.js`](js/manual.js), no padrão Papel e Tinta.
- **Para refazer os PDFs** depois de mudar o texto, edite `manuais/cartaz-mestre.html` ou `manuais/guia-escritorio.html` e rode [`manuais/gerar-pdf.mjs`](manuais/gerar-pdf.mjs) (instruções no topo do arquivo).

## Espelho no GitHub Pages (22/10/2026)
- O sistema também abre em https://marceloclr.github.io/tcs/, como reserva do GitLab Pages, publicado da raiz da branch `main` do espelho.
- O GitHub não lê o `_redirects`. As pastas `mestre/`, `manual/` e `manual-escritorio/` encaminham para `captura.html`, `manual-mestre.html` e `manual-escritorio.html`. Elas não vão para o GitLab Pages, onde vale a reescrita.
- `.nojekyll` faz o GitHub publicar os arquivos sem processá-los.
- O login com Google funciona porque `marceloclr.github.io` está entre os domínios autorizados do Firebase (Authentication › Configurações).
- O job de busca na SEFAZ roda só no GitLab.

## App Android do mestre (APK)
A tela do mestre também existe como app Android (TWA): https://marceloclr.gitlab.io/tcs/apk/notas-tcs.apk. Ele abre a mesma página `/tcs/mestre`, então as mudanças na tela chegam sozinhas. Como gerar de novo e onde fica a chave: `android/LEIA-ME.md`.

## Materiais padronizados e requisição da obra (22/10/2026)
- **Tabela de materiais** (coleção `materiais`, [`js/materiais.js`](js/materiais.js)): cada produto de fornecedor aponta para um material em `products.materialId` (de-para). Vinculado uma vez, vale para as próximas notas do mesmo produto. A conferência das notas mostra o material de cada item. A unidade é 1 para 1: unidade diferente só gera aviso.
- **Três posições** por obra e material ([`js/paineis.js`](js/paineis.js), `stockTree`):
  - **Estoque** = entrada − baixas diretas − requisitado;
  - **Requisitado** = entregue à obra (movimentos `REQUISICAO`, menos as devoluções) − uso confirmado pelo mestre;
  - **Consumido** = todas as baixas (`SAIDA`), inclusive o uso confirmado. Só o consumido é custo apropriado; estoque e requisitado ficam sob custódia.
- **Fluxo** ([`js/requisicoes.js`](js/requisicoes.js) no escritório; [`js/captura.js`](js/captura.js) no celular):
  1. o mestre pede (**📦 Pedir material**);
  2. o escritório atende: `REQUISICAO` +, por produto, em ordem de entrada (FIFO);
  3. o mestre confirma o uso (**Na obra › ✔ Usei**): `SAIDA` com `requisicaoId`, gravada por ele;
  4. o que sobrar ele devolve (**↩ Devolver**), e o escritório confirma o recebimento: `REQUISICAO` −.
- **Coleção `requisicoes`:** guarda o que foi entregue de cada produto (`itens[i].partes`), o consumo (`consumo`, gravado pelo mestre) e o devolvido (`devolvido`, gravado pelo escritório). Requisição e movimentos vão à nuvem num só lote, e as regras conferem a ligação entre eles.
- **Sem internet**, o pedido do mestre fica na fila do próprio Firestore no celular e sobe sozinho.
- **Regras novas** (`materiais`, `requisicoes`, `REQUISICAO` e consumo da obra em `movements`): publicadas com `cd testes && npx firebase deploy --only firestore:rules --project thiago-17d18 --config ../firebase.json`.
- **Testes:** 26 regras (`testes/regras.test.mjs`) e o ciclo completo no navegador (`testes/navegador/19-materiais-requisicao.js`).

## Pedido pela tabela do estoque, com destino (23/10/2026)
Plano: [`docs/planos/pedido-material.md`](docs/planos/pedido-material.md).
- **Estoque da obra para o mestre** ([`js/saldo-obra.js`](js/saldo-obra.js)): `saldos_obra/{projetoId}` traz, por material, o disponível (saldo − requisitado), o nome e a unidade, **sem valores**. Quem grava é o escritório com escrita no projeto, depois da leitura completa da nuvem e só quando muda. Produto sem material não entra.
- **Tela do mestre:** **Pedir material** → tabela Material · No estoque · Quantidade (até o disponível) → **Revisar pedido** (só os itens com quantidade, cada um com o **destino**: lista + Outro) → Enviar. O item da requisição grava `destino`; a baixa de uso leva o destino na observação.
- **Destinos:** lista inicial em `TCS_DESTINOS_PADRAO` ([`js/config.js`](js/config.js)); o administrador troca em Usuários e acessos › Configurações (`config/geral.destinos`).
- **Paleta:** as telas do mestre usam as cores do escritório (azul `#2563eb`, tons slate, topo `#0f172a`, fonte do sistema), com tema escuro em slate.
- **Regras novas:** `saldos_obra` (27 testes de regras).
