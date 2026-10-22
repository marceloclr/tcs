# Acessos e captura de notas

Guia do controle de acesso por cliente e projeto, da captura de notas pelo celular da obra, da fila do escritório e do aproveitamento das consultas das notas.

- Sistema: https://marceloclr.gitlab.io/tcs/
- Tela da obra: https://marceloclr.gitlab.io/tcs/mestre (o endereço antigo, `captura.html`, continua funcionando)

## 1. Implantação (uma vez)

1. Publique o site (o GitLab Pages faz isso sozinho a cada push na `main`).
2. **Logo em seguida**, publique as regras: console do Firebase › projeto `thiago-17d18` › Firestore Database › **Regras** › cole o conteúdo de [`firestore.rules`](firestore.rules) › **Publicar**. Toda vez que o arquivo mudar, publique de novo. Enquanto as regras antigas estiverem no ar, o sistema novo mostra "Não foi possível verificar o seu cadastro".
3. Implantação automática de administradores: retirada em 19/10/2026 (listas vazias em `js/config.js` e na função `implantacao()` de `firestore.rules`). Para reabri-la, por exemplo se o único administrador perder o acesso, inclua o e-mail nas duas listas, faça o push e publique as regras de novo.
4. Em **Dados e segurança › Acessos por projeto: preparação da base**:
   1. clique em **Baixar backup antes de preparar** e guarde o arquivo;
   2. clique em **Preparar e conferir totais**. O sistema calcula, para as notas antigas, em quais projetos cada uma está, a cópia restrita de cada projeto e o índice de chaves, e compara os totais de cada cliente e projeto antes e depois. A conferência precisa terminar com "os totais batem".
   Para desfazer, restaure o backup em **Importação de backup**. Só é necessário se houver notas importadas antes de 19/10/2026 e alguém que não seja administrador usar o sistema.

## 2. Administrar usuários e acessos

A aba **Usuários e acessos** aparece só para administradores.

- **Pessoas:** lista com nome, e-mail, papel, situação, projetos concedidos (nomes separados por ";") e último acesso, com busca e filtros por papel e situação.
- **Cadastrar pessoa:** informe o e-mail da conta Google (pode ser antes do primeiro login), o nome, o telefone, o papel e a situação, e marque os acessos. O nome, o e-mail e o telefone saem nos pedidos de orçamento da pessoa.
- **Papéis:**
  - **Administrador:** tudo, inclusive esta área, backup e restauração.
  - **Escritório:** lê, ou lê e altera, os clientes e projetos concedidos. Quem tem escrita em algum projeto também importa notas, vê as notas ainda não vinculadas e confere as notas da obra desses projetos.
  - **Obra:** só vê o nome dos projetos concedidos e envia fotos de notas para eles.
- **Matriz de acessos:** cada cliente e cada projeto tem o seletor "Sem acesso / Leitura / Leitura e escrita" e uma validade opcional.
  - O acesso marcado no **cliente** vale para todos os projetos dele, inclusive os criados depois.
  - Quando há acesso no cliente e no projeto, vale o mais amplo. A coluna **Efetivo** mostra o resultado.
- **Solicitações pendentes:** quem entra com Google sem cadastro vê "Acesso aguardando autorização", e o pedido aparece aqui, com contador. **Aprovar** abre o cadastro já com o e-mail; **Recusar** apaga o pedido.
- **Acesso por projeto:** escolha um projeto para ver quem tem acesso, com qual nível, por qual origem e até quando.
- **Trilha de auditoria:** cada mudança fica registrada (quem alterou, quando, valores antes e depois). É somente leitura e pode ser exportada em CSV.
- **Configuração:** define como aparece a nota de compra coletiva para quem tem acesso a só parte dos projetos dela. O padrão mostra só o rateio dos projetos da pessoa.
- **Proteções:**
  - o último administrador ativo não pode ser rebaixado, desativado nem excluído (vale na tela e nas regras);
  - reduzir um acesso pede confirmação.

### O que acontece para a pessoa
- **Cadastro ativo:** ela vê só os clientes e projetos concedidos. Totais, gráficos, estoque, fornecedores e exportações consideram só esses projetos, e um aviso no topo lembra disso.
- **Acesso reduzido ou retirado:** na hora, a página recarrega e a cópia local deste navegador perde o que saiu do acesso.
- **Desativada:** tela "Acesso suspenso", e a cópia local é apagada.
- **Nota de compra coletiva:** quem não tem todos os projetos da nota vê o cabeçalho e só os itens e valores rateados aos seus projetos, sem poder alterar a distribuição.
- **Computador compartilhado:** ao entrar com outra conta, a cópia local da conta anterior é apagada antes de carregar os dados.

---

## 3. Guia do mestre de obras (para imprimir)

> **Notas TCS — como mandar a nota da obra para o escritório**
>
> **Uma vez só: colocar o ícone no celular**
> 1. No celular, abra o **Chrome** e entre em: **marceloclr.gitlab.io/tcs/mestre**
> 2. Toque em **Entrar com Google** e escolha a sua conta.
> 3. Toque nos **três pontinhos ⋮** (no alto, à direita) e depois em **Instalar app** ou **Adicionar à tela inicial**.
> 4. Pronto: aparece o ícone **Notas TCS** na tela do celular.
>
> **Toda vez que chegar uma nota**
> 1. Toque no ícone **Notas TCS**.
> 2. Toque em **🔍 Ler código da nota** e aponte a câmera para o **QR Code** (cupom) ou para o **código de barras** (nota grande). Quando o celular ler, aparece **"Código da nota lido"**.
>    - Não leu? Toque em **⌨️ Digitar os números** e digite os 44 números que ficam embaixo do código de barras.
> 3. Se puder, toque em **📷 Fotografar a nota também** (é o comprovante de que a nota chegou).
> 4. Toque no nome da **obra** (se for uma só, ela já vem marcada).
> 5. Toque em **Enviar**. Vai aparecer: **"Nota enviada! O escritório vai conferir."**
>
> **Sem código na nota?** Toque em **📷 Fotografar nota**, pegue a **nota inteira**, em **lugar claro**, e siga do passo 4.
>
> **Se precisar**
> - **Nota comprida ou com verso:** antes de enviar, toque em **➕ Mais uma foto desta nota**.
> - **Faltou material** ou **veio quebrado:** antes de enviar, toque em **Faltou material** ou **Veio avariado**.
> - **Foto escura ou tremida:** o celular avisa. Toque em **Tirar de novo**.
> - **Sem internet:** pode enviar assim mesmo. A nota fica guardada no celular e vai sozinha quando a internet voltar. Aparece a faixa amarela **"Aguardando internet para enviar"**.
> - **O melhor é sempre fotografar pelo Notas TCS.** O WhatsApp diminui a foto e o escritório não consegue ler.
> - **Recebeu a foto pelo WhatsApp:** peça para mandarem **como documento** ou em **HD**. Depois abra a foto, toque em **Compartilhar** e escolha **Notas TCS**. Se o celular avisar "foto pequena", fotografe a nota de novo pelo Notas TCS.
>
> Dúvida? Ligue para o escritório.

---

## 4. Fila "Notas recebidas da obra" (escritório)

Em **Estoque › Recebidas da obra** (o número ao lado mostra quantas aguardam). Aparece para administradores e para quem tem escrita no projeto da nota.

- **A conferir:** notas pendentes ou em conferência, com obra, quem enviou, fotos, observações (faltou material, veio avariado) e o tempo de espera. Acima de 48 horas, a linha fica destacada.
- **Só código:** a obra mandou só o código da nota, sem foto (coluna Fotos).
- **Busca na SEFAZ:** situação da busca automática da NFC-e. Os selos são **na fila**, **Dados da SEFAZ prontos** e **Busca falhou** (com o motivo). A NF-e aparece como **sem busca automática**. No topo da fila, o quadro **Busca automática na SEFAZ** mostra:
  - a frequência: de hora em hora, das 7h às 18h, de segunda a sábado;
  - um **relógio ao vivo** com o tempo até a próxima busca, em MM:SS, ou em HH:MM:SS quando falta mais de uma hora. Durante a busca, ele mostra "buscando";
  - o botão **Buscar agora**, que dispara a busca na hora. O administrador grava o token em **Configurar token**. Detalhes em [`docs/busca-nfce.md`](docs/busca-nfce.md).
- **Ver fotos:** mostra as fotos enviadas, quando houver.
- **Conferir:** usa os dados trazidos da SEFAZ, quando a busca já rodou, e baixa as fotos (código de barras, QR Code e texto). Só com a chave e sem busca, abre a nota com número, série e CNPJ da chave, para completar pela consulta ou à mão. Em todos os casos, abre a conferência com o **projeto indicado pela obra** (pode trocar, entre os projetos em que você tem escrita) e o aviso do que a obra informou. Nada é gravado antes de você confirmar.
- **Confirmar entrada das notas:** a nota é lançada e vinculada ao projeto; a captura passa a **Lançada**, ligada à nota. As fotos ficam como **comprovante de recebimento**: na nota, botão **Fotos da obra**.
- **Descartar:** pede o motivo (por exemplo: foto repetida, não é nota, nota de outra obra).
- **Nota repetida:** se a chave já foi lançada, o sistema avisa e oferece **Descartar como repetida**.
- **XML que chega depois:** ao importar o XML de uma nota já lançada pela foto, pela consulta ou pelo PDF, o sistema oferece **Substituir os dados pelos do XML**. Fotos, captura e projeto são mantidos e as entradas no estoque são refeitas. Fica bloqueado se a nota estiver dividida entre vários projetos ou se já houver saídas desses produtos.

## 5. Importar notas: XML, PDF e foto

Em **Estoque › Importar notas**, nas caixas de **Materiais** e **Serviços**.

- **XML:** continua sendo a fonte mais confiável.
- **PDF do DANFE (NF-e)** e **PDF da NFC-e** (cupom de consumidor): leitura do texto; PDF digitalizado passa por OCR.
- **Foto** (JPG, PNG, WEBP, HEIC): o sistema endireita a foto, lê o **código de barras** do DANFE ou o **QR Code** e o texto. A chave é conferida pelo dígito verificador; número, série e CNPJ saem dela e prevalecem sobre o OCR. Código de **boleto** e QR de **PIX** são ignorados; chaves diferentes no código de barras e no QR geram aviso.
- **Boleto bancário** enviado no lugar da nota é identificado e recusado com explicação.
- **Conferência:** a foto fica ao lado dos campos, com zoom. Cada campo tem um selo: **exato** (da chave), **OCR** (com a confiança), **OCR baixo** (amarelo, confira), **preencher** (vermelho), **consulta** ou **PDF**. Itens podem ser editados, incluídos e retirados.
- **Nota repetida** é bloqueada pela chave em toda a base, mesmo de projetos a que você não tem acesso (sem mostrar a nota).

## 6. Aproveitar o link de consulta (QR Code)

No painel **A partir do link de consulta**, em Importar notas, ou pelo botão **Aproveitar a consulta** na conferência de uma foto.

- O link é classificado: NFC-e na SEFAZ estadual (com a UF), NFS-e no Portal Nacional ou em portal municipal, CT-e, NF-e na SEFAZ, portal de fornecedor ou origem desconhecida. **Abrir consulta** abre a página do órgão em nova aba. O sistema não baixa a página sozinho nem contorna captcha.
- **Importar página salva:** na página de consulta, Imprimir › Destino "Salvar como PDF" › Salvar; depois escolha o arquivo.
- **Colar conteúdo da consulta:** na página de consulta, **Ctrl+A** (selecionar tudo) e **Ctrl+C** (copiar); no TCS, clique na caixa, **Ctrl+V** e **Ler conteúdo colado**. Copie a página inteira: só o rodapé (protocolo, tributos) não basta.
- O texto passa por um leitor próprio da **NFC-e da SEFAZ-CE** (padrão de consulta da SVRS) ou pela leitura genérica, cada um com a confiança. Se a foto da mesma nota já estiver na conferência, a consulta a completa.
- **Portal de fornecedor:** se ele oferecer o XML para baixar, prefira o XML.

## 7. Visão geral: estoque sob custódia e custo apropriado

- **Valor em estoque (sob custódia):** material recebido e ainda não baixado. Não é custo.
- **Custo apropriado:** o material vira custo do cliente e do projeto na **baixa** (saída), pelo custo médio. O serviço vira custo quando a nota é **vinculada**.
- **Total adquirido** = estoque + custo apropriado. Material de notas ainda sem projeto aparece à parte, como **aguardando vínculo**.
- Gráficos: **idade do estoque** (valor por tempo sem movimento: até 30, 31 a 60, 61 a 90 e mais de 90 dias), **composição da custódia** (projetos ativos, encerrados e aguardando vínculo), estoque e custo por cliente e por projeto, e a linha do tempo de entradas, baixas e serviços. Toda barra tem dica com o valor, e cada gráfico tem a tabela de apoio.

## 8. Pedido de orçamento

- Nome, e-mail e telefone do solicitante vêm do cadastro. Sem telefone cadastrado, use **Informar meu telefone**.
- O fornecedor é opcional: sem ele, o PDF sai com o espaço para o fornecedor se identificar.
- No PDF, o quadro **Responder para** destaca os contatos do solicitante.

## 9. Validação (19/10/2026)

- `node testes/verificar.mjs`: sintaxe de todo o JavaScript e balanceamento das tags dos HTML.
- `cd testes && npm test`: 14 testes das regras do Firestore no emulador (acesso por projeto e por cliente, leitura e escrita negadas, nota coletiva, duplicidade, papel Obra, solicitação, auditoria, último administrador, validade, capturas e fotos, pedidos de orçamento).
- Ponta a ponta no navegador, contra os emuladores (roteiro em [`testes/LEIA-ME.md`](testes/LEIA-ME.md)): um usuário de cada papel; Escritório com leitura não grava; sem acesso a um cliente não lê nem pela interface nem pelo console; Obra não lê valores; revogação e desativação limpam a cópia local; último administrador protegido; conta sem cadastro vira solicitação; captura com e sem internet, foto escura e foto compartilhada; fila, lançamento, comprovante, descarte e XML posterior; fotos sintéticas (Code 128, QR de NFC-e, boleto e PIX descartados) e duplicidade; texto de consulta colado; estoque × custo apropriado; orçamento.
- Telas conferidas em 360 × 800 e no computador; a tela da obra nos temas claro e escuro (o sistema principal tem só o tema claro).

## 10. Riscos que continuam

- **Fotos do WhatsApp:** o WhatsApp reduz a foto para cerca de 720 × 1280; numa folha A4 inteira a leitura automática não funciona (teste de 19/10 com a NF 20.643: confiança de 44%, sem chave). O sistema avisa no celular e na conferência; o caminho é fotografar pelo Notas TCS (2400 px) ou enviar como documento.
- **Fotos reais:** os testes usaram imagens geradas pelo sistema. Fotos amassadas, com sombra ou de impressora térmica gasta vão ter leitura pior; os selos de confiança orientam a conferência.
- **Celular real:** instalação do atalho, câmera e menu Compartilhar não foram testados num Android de verdade (o compartilhamento foi simulado com a mesma requisição).
- **Leitor da consulta da SEFAZ-CE:** escrito sobre o padrão da SVRS; precisa ser confirmado com uma consulta real copiada inteira.
- **Cota do Firestore:** cada foto ocupa de 40 a 600 KB; o plano gratuito tem 1 GiB (alguns milhares de fotos).
- **Acessos mistos:** quem tem parte dos projetos de uma nota pelo cliente e parte pelo projeto vê só a parte de cada projeto.
- **Validade vencida:** o acesso aos dados cai na hora, mas nomes de clientes e a lista de notas abertas continuam visíveis até um administrador regravar o cadastro da pessoa.
- **Catálogo:** o saldo geral de cada produto continua visível a todo o Escritório.

## 11. Próximos passos (fora do escopo desta entrega)

- **Busca automática de outros estados:** a NFC-e do Ceará já é buscada pelo job do GitLab CI (22/10/2026, [`docs/busca-nfce.md`](docs/busca-nfce.md)). Outros estados entram quando houver uma nota real para escrever o leitor.
- **E-mail dedicado** (ex.: notas@empresa) monitorado por Google Apps Script, alimentando a fila `capturas` com fotos, PDFs e principalmente os XMLs enviados pelos fornecedores.
- **WhatsApp Business (API oficial)** com robô que recebe a foto, pergunta a obra com botões e encaminha para a fila.
- **Distribuição DF-e da SEFAZ** com certificado digital A1, para baixar sozinho os XMLs das NF-e emitidas contra o CNPJ, usando a foto da obra só como comprovante de recebimento.
- **Visual:** migrar o sistema principal para o design system Papel e Tinta (IBM Plex, tema escuro, dicas com fórmula no padrão do `dicas.js`).
- **Fornecedores como cadastro próprio**, em vez de derivados das notas visíveis.
