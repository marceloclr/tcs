# Acessos e captura de notas

Guia de uso do controle de acesso por cliente e projeto e, nas próximas etapas, da captura de notas pelo celular da obra.

## 1. Implantação (uma vez)

1. Publique o site (o GitLab Pages faz isso sozinho a cada push na `main`).
2. **Logo em seguida**, publique as regras: console do Firebase › projeto `thiago-17d18` › Firestore Database › **Regras** › cole o conteúdo de [`firestore.rules`](firestore.rules) › **Publicar**. Enquanto as regras antigas estiverem publicadas, o sistema novo mostra "Não foi possível verificar o seu cadastro".
3. Entre com `marceloclr@gmail.com` e, depois, com `thiagocsampaio@gmail.com`. No primeiro login, cada uma vira **administradora** automaticamente.
4. Em **Dados e segurança › Acessos por projeto: preparação da base**:
   1. clique em **Baixar backup antes de preparar** e guarde o arquivo;
   2. clique em **Preparar e conferir totais**. O sistema calcula, para as notas existentes, o escopo, as projeções por projeto e o índice de chaves, e mostra os totais de cada cliente e projeto antes e depois. A conferência precisa terminar com "os totais batem".
   Para desfazer, restaure o backup em **Importação de backup**.
5. Cadastre as demais pessoas em **Usuários e acessos** (seção 2).
6. Quando os dois administradores já tiverem entrado, retire a implantação automática: esvazie a lista em `js/config.js` (`TCS_ADMINS_INICIAIS=[]`) e na função `implantacao()` de `firestore.rules`, faça o push e publique as regras de novo.

## 2. Administrar usuários e acessos

A aba **Usuários e acessos** aparece só para administradores.

- **Pessoas:** lista com nome, e-mail, papel, situação, quantidade de projetos concedidos e último acesso. Tem busca e filtros por papel e situação.
- **Cadastrar pessoa:** informe o e-mail da conta Google (pode ser antes do primeiro login), o nome, o papel e a situação, e marque os acessos.
- **Papéis:**
  - **Administrador:** tudo, inclusive esta área, backup e restauração.
  - **Escritório:** lê, ou lê e altera, os clientes e projetos concedidos. Quem tem escrita em algum projeto também importa notas e vê as notas ainda não vinculadas.
  - **Obra:** só vê o nome dos projetos concedidos e envia fotos de notas para eles.
- **Matriz de acessos:** cada cliente e cada projeto tem um seletor "Sem acesso / Leitura / Leitura e escrita" e uma validade opcional.
  - O acesso marcado no **cliente** vale para todos os projetos dele, inclusive os criados depois.
  - Quando há acesso no cliente e no projeto, vale o mais amplo. A coluna **Efetivo** mostra o resultado.
- **Solicitações pendentes:** quem entra com Google sem cadastro vê "Acesso aguardando autorização", e o pedido aparece aqui, com contador na aba. **Aprovar** abre o cadastro já com o e-mail; **Recusar** apaga o pedido.
- **Acesso por projeto:** escolha um projeto para ver quem tem acesso a ele, com qual nível, por qual origem e até quando.
- **Trilha de auditoria:** cada mudança fica registrada (quem alterou, quando, valores antes e depois). É somente leitura e pode ser exportada em CSV.
- **Configuração:** define como aparece a nota de compra coletiva para quem tem acesso a só parte dos projetos dela. O padrão mostra só o rateio dos projetos da pessoa.
- **Proteções:**
  - o último administrador ativo não pode ser rebaixado, desativado nem excluído;
  - reduzir um acesso pede confirmação.

### O que acontece para a pessoa
- **Cadastro ativo:** ela vê só os clientes e projetos concedidos. Totais, gráficos, estoque, fornecedores e exportações consideram só esses projetos, e um aviso no topo lembra disso.
- **Acesso reduzido ou retirado:** na hora, a página recarrega e a cópia local deste navegador perde o que saiu do acesso.
- **Desativada:** tela "Acesso suspenso", e a cópia local é apagada.
- **Notas de compra coletiva:** quem não tem todos os projetos da nota vê o cabeçalho e só os itens e valores rateados aos seus projetos, sem poder alterar a distribuição.
- **Computador compartilhado:** ao entrar com outra conta, a cópia local da conta anterior é apagada antes de carregar os dados.

> Capítulos seguintes (captura pela obra, fila do escritório, colar conteúdo da consulta) entram nas Etapas 2 a 6.
