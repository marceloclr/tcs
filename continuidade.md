# PROMPT DEFINITIVO — INTEGRAÇÃO DO ERP DE ESTOQUE E NF-e AO GITLAB

## 1. Missão

Você é o agente de desenvolvimento responsável por dar continuidade a um sistema web de ERP e Supply Chain para importação de notas fiscais eletrônicas e controle de estoque.

Você está operando pelo Claude CLI, com acesso direto ao ambiente de desenvolvimento e ao GitLab.

**Repositório/projeto informado:** `marceloclr.gitlab.io/`  
**Branch principal informada:** `main`  
**Hospedagem pretendida:** GitLab Pages  
**Escopo desta etapa:** integrar o frontend existente à API e preparar a persistência centralizada de dados.  
**Banco de dados e ambiente de execução:** ainda precisam ser avaliados tecnicamente.

A URL fornecida pode ser a URL pública do GitLab Pages, e não a URL Git de clonagem. Descubra a URL correta do repositório utilizando as configurações Git disponíveis no diretório de trabalho e os metadados acessíveis pelo ambiente. Não invente URLs nem solicite credenciais secretas.

Seu objetivo não é apenas produzir código: é implementar a próxima etapa no projeto real, testar as alterações e documentar exatamente o que foi realizado.

## 2. Regras obrigatórias de trabalho

1. Inspecione o repositório antes de modificar qualquer arquivo.
2. Não reescreva o sistema do zero.
3. Preserve funcionalidades existentes que estejam funcionando.
4. Não substitua dados, configurações ou arquivos sem compreender sua finalidade.
5. Não presuma que arquivos gerados anteriormente já estão presentes no repositório.
6. Não afirme que testes, commits, push ou deploy foram concluídos sem executá-los e verificar o resultado.
7. Não coloque tokens, senhas, chaves privadas ou credenciais em código, logs, prompts, commits ou arquivos versionados.
8. Não faça deploy em produção, force push, reset destrutivo, exclusão de dados ou migração irreversível sem autorização explícita.
9. Trabalhe preferencialmente em uma branch de integração, preservando a branch `main`.
10. Quando houver uma decisão arquitetural relevante, explique as opções e escolha a alternativa mais simples que satisfaça os requisitos.
11. Não declare funcionalidades completas apenas porque existe uma tela, botão, endpoint ou arquivo.
12. Se uma etapa depender de infraestrutura ainda inexistente, implemente o que for possível com segurança e documente claramente o bloqueio.

## 3. Fase 1 — Diagnóstico obrigatório

Antes de codificar, examine:

- Diretório atual e estrutura de arquivos.
- Branch atual, estado do Git e alterações não commitadas.
- URL remota do repositório.
- Histórico recente de commits.
- `index.html` e os arquivos JavaScript e CSS relacionados.
- Arquivos `package.json`, arquivos de configuração, scripts de build e testes.
- Configuração `.gitlab-ci.yml`, caso exista.
- Configuração do GitLab Pages.
- Arquivos SQL, migrações, API, Docker e documentação.
- Arquivos de exemplo de variáveis de ambiente.
- Dependências e ferramentas instaladas no ambiente.
- Eventuais arquivos da etapa 2 que tenham sido incorporados ao projeto.

Não exiba segredos encontrados durante a inspeção. Se houver arquivos de configuração sensíveis, informe apenas o tipo de problema e a localização relativa, ocultando valores.

Produza um diagnóstico curto contendo:

1. O que existe e está funcional.
2. O que está incompleto ou é apenas protótipo.
3. O que já existe de backend e banco de dados.
4. Como o projeto é publicado atualmente.
5. Quais arquivos precisam ser alterados.
6. Quais decisões dependem de infraestrutura externa.

Se o repositório estiver limpo e o acesso estiver funcionando, prossiga para o planejamento técnico. Se houver alterações preexistentes do usuário, preserve-as.

## 4. Fase 2 — Estado funcional anterior à etapa 2

O ponto de partida é um protótipo web em arquivo HTML único chamado `index.html`.

A interface original contempla:

- Visão geral.
- Importar notas.
- Estoque.
- Notas fiscais.
- Produtos.
- Dados e segurança.

A versão inicial utiliza IndexedDB, isto é, armazenamento local no navegador. Esse armazenamento não oferece, por si só, banco de dados centralizado para múltiplos usuários ou dispositivos.

### Funcionalidades já previstas no protótipo

- Importação estruturada de XML de NF-e.
- Extração de dados do documento e dos itens.
- Cadastro e consulta de produtos.
- Consolidação de estoque por identificação do produto.
- Prevenção de duplicidade de NF-e.
- Consulta de notas fiscais e saldos.
- Exportação CSV.
- Backup e restauração JSON.
- Carregamento de dados de demonstração.

A interface também apresenta opção de seleção de PDF, mas a extração automática de PDF não estava implementada. Não afirmar que existe OCR funcional.

Antes de alterar a implementação, verifique o código real e confirme quais desses recursos continuam presentes e operacionais.

## 5. Fase 3 — Arquitetura prevista e artefatos anteriores

Em uma etapa posterior, foi criado separadamente um pacote de backend denominado `estoque-nfe-erp-etapa2.zip`. Ele foi disponibilizado no ambiente de trabalho da conversa, mas sua presença no repositório GitLab ainda precisa ser verificada.

O pacote foi projetado com:

- Node.js e Express.
- PostgreSQL 16.
- Docker Compose para desenvolvimento.
- Esquema SQL para produtos, notas fiscais, itens, movimentações de estoque e auditoria.
- Serviço de importação XML.
- Validação de dados da NF-e.
- Transação para importação de nota e atualização do estoque.
- Prevenção de duplicidade pela chave de acesso.
- Endpoints de consulta de estoque e notas fiscais.
- Endpoint de saída de estoque com validação do saldo.
- Documentação de configuração e execução.

O código dessa etapa teve a sintaxe JavaScript verificada, mas não se deve assumir que tenha sido testado integralmente contra um PostgreSQL em execução ou que esteja pronto para produção.

### Limitações conhecidas dessa arquitetura

- A integração com o frontend ainda não foi concluída.
- A extração de PDF/OCR não está implementada.
- Autenticação e autorização completas não estão implementadas.
- O cabeçalho `x-actor`, se existir, não deve ser considerado autenticação.
- Backups automáticos e testes de restauração precisam ser definidos.
- Cancelamentos de NF-e, devoluções e estornos precisam de regras próprias.
- Não há garantia de implantação funcional apenas por existir um Docker Compose.
- A publicação no GitLab Pages não executa diretamente o servidor Node.js nem fornece PostgreSQL.

Se o pacote ou os seus arquivos não estiverem no repositório, não invente que estão presentes. Avalie se podem ser recuperados do ambiente de trabalho atual. Caso não estejam disponíveis, informe a ausência e proponha a reconstrução mínima necessária.

## 6. Fase 4 — Decisão arquitetural para o GitLab Pages

O frontend deve permanecer compatível com GitLab Pages se essa for a estratégia de publicação confirmada.

Entretanto, se o sistema precisar de estoque compartilhado entre usuários, persistência centralizada e autenticação, será necessário um backend acessível pela web e um banco de dados.

Avalie estas opções:

**Opção A — Frontend no GitLab Pages, API Node.js e PostgreSQL hospedados separadamente.**

É a arquitetura de referência preferida caso o GitLab Pages seja mantido. A API deve possuir URL própria, HTTPS, autenticação e acesso controlado ao banco.

**Opção B — Hospedagem integral em um serviço que execute frontend, backend e banco ou ofereça integração gerenciada.**

Considere esta opção se reduzir significativamente a complexidade operacional e o custo total.

**Opção C — Permanecer temporariamente no armazenamento local.**

Utilize apenas como modo de demonstração ou desenvolvimento, identificando claramente as limitações. Não apresentar esse modo como ERP multiusuário centralizado.

Antes de contratar serviços ou publicar infraestrutura, faça um diagnóstico das alternativas, dos requisitos e dos custos. Não crie contas, contrate serviços ou publique recursos pagos sem autorização.

Não armazenar credenciais de banco de dados no frontend. O navegador deverá comunicar-se com a API, nunca diretamente com o PostgreSQL.

Se ainda não houver backend hospedado, preparar a integração de forma configurável e testar o frontend contra uma API local. Não simular que a integração de produção está concluída.

## 7. Fase 5 — Integração do frontend com a API

Preserve a aparência, as telas e os recursos úteis existentes.

Centralize a comunicação com a API em um módulo JavaScript, se compatível com a arquitetura encontrada, por exemplo, `api.js` ou `src/services/api.js`.

A URL base da API deverá ser configurável sem expor segredos. Não fixar localhost em produção nem criar URLs de produção fictícias.

Implemente a integração real para:

1. Verificar o estado da API.
2. Importar e validar XML.
3. Apresentar uma prévia da nota e dos itens.
4. Permitir confirmação explícita da importação.
5. Exibir erros de validação e duplicidade.
6. Consultar notas fiscais.
7. Consultar produtos.
8. Consultar saldos de estoque.
9. Atualizar as telas após operações concluídas.
10. Tratar indisponibilidade de rede e falhas da API.

Se a API não possuir um endpoint de prévia, avaliar a criação de uma operação de validação que não grava a nota nem movimenta o estoque.

A confirmação deve ser uma operação distinta da prévia. Nunca gravar estoque apenas porque o arquivo foi selecionado ou enviado para análise.

Não manter uma segunda fonte de verdade silenciosa no IndexedDB. Caso seja necessário preservar o armazenamento local para modo de demonstração ou contingência, identificar explicitamente o modo utilizado e evitar que o usuário confunda os dados locais com os dados centrais.

## 8. Fase 6 — Regras de negócio e integridade

### Importação de NF-e

- Validar XML e chave de acesso.
- Validar os dados fiscais disponíveis.
- Quando o XML incluir protocolo de autorização, validar a situação informada; não assumir autorização quando ela não estiver comprovada.
- Impedir duplicidade pela chave de acesso, com restrição única no banco.
- Tratar importações concorrentes sem duplicar o estoque.
- Registrar nota, itens, movimentações e auditoria transacionalmente.
- Em caso de erro, desfazer toda a operação.

A validação local do XML não substitui consulta à SEFAZ quando a confirmação oficial atual for necessária. Não alegar consulta em tempo real à SEFAZ sem implementar e verificar essa integração.

### Identificação dos produtos

- Priorizar GTIN/EAN válido.
- Não unir produtos somente por similaridade textual.
- Quando não houver GTIN, usar uma regra conservadora baseada em código do fornecedor, descrição normalizada e unidade.
- Se houver ambiguidade, solicitar associação manual.
- Preservar a descrição e o código originais informados em cada nota.

### Consolidação do estoque

O saldo deverá refletir entradas e saídas confirmadas.

Exemplo: 5 unidades existentes mais 3 unidades recebidas em uma nova nota válida devem resultar em 8 unidades.

Uma mesma nota importada duas vezes não pode gerar duas entradas.

Todas as saídas e ajustes devem ser rastreáveis. Saídas concorrentes precisam de transações ou mecanismos de bloqueio apropriados para evitar saldo inconsistente.

### Valores e quantidades

- Usar tipos numéricos adequados para moeda e quantidade.
- Evitar cálculos financeiros dependentes de ponto flutuante binário.
- Validar unidade, quantidade, preços e descontos.
- Preservar os dados originais e documentar os critérios de cálculo.

## 9. Fase 7 — Segurança e variáveis de ambiente

- Manter segredos exclusivamente no ambiente seguro ou nas variáveis protegidas do GitLab.
- Criar ou atualizar `.env.example` somente com nomes de variáveis e exemplos não sensíveis.
- Verificar se `.env`, dumps de banco, arquivos de credenciais e dados pessoais estão excluídos do versionamento.
- Não inserir tokens em URLs, logs ou mensagens de erro.
- Validar os arquivos recebidos no servidor, não apenas no navegador.
- Aplicar limites de tamanho, validação de conteúdo e tratamento de erros de upload.
- Implementar autenticação e autorização antes de disponibilizar operações sensíveis publicamente.
- Configurar CORS apenas para origens necessárias, sem tratá-lo como mecanismo de autenticação.
- Usar HTTPS na comunicação de produção.
- Restringir as permissões do usuário de banco de dados.
- Planejar backup e restauração.
- Não expor o PostgreSQL diretamente à internet sem uma necessidade devidamente justificada e controles adequados.

Se a autenticação ainda não existir, documente o bloqueio e não disponibilize operações de escrita em uma API pública desprotegida.

## 10. Fase 8 — Migração dos dados locais

Investigue se o IndexedDB contém dados reais que precisam ser preservados.

Se houver dados relevantes:

1. Defina um procedimento de exportação.
2. Preserve um backup antes da migração.
3. Valide a estrutura dos dados exportados.
4. Importe para o banco central com prevenção de duplicidade.
5. Compare contagens, quantidades e saldos.
6. Documente o resultado e eventuais divergências.

Não apagar nem sobrescrever dados locais sem autorização. Se houver apenas dados de demonstração, documentar isso e evitar importar exemplos automaticamente em produção.

## 11. Fase 9 — Testes obrigatórios

Executar os testes possíveis no ambiente e documentar o que não puder ser testado.

Casos mínimos:

1. XML válido.
2. XML malformado.
3. Chave de acesso inválida.
4. Documento sem dados suficientes para comprovar autorização.
5. NF-e já importada.
6. Importações simultâneas da mesma NF-e.
7. Duas notas diferentes com o mesmo produto.
8. Produto sem GTIN.
9. Produtos com descrições semelhantes, mas distintos.
10. Quantidade ou valor inválido.
11. Falha no meio da transação.
12. Saída superior ao saldo disponível.
13. Saídas concorrentes.
14. API indisponível.
15. Erro de conexão com o banco.
16. Frontend funcionando no caminho e domínio previstos para o GitLab Pages.
17. Variáveis de ambiente ausentes ou inválidas.
18. Autorização das operações de escrita, caso a autenticação esteja implementada.

Use testes automatizados quando viável. Para cada teste, informe se foi aprovado, reprovado ou não executado.

Não utilize dados de produção sem autorização. Utilize os dados de referência somente como fixtures de teste.

## 12. Fase 10 — CI/CD e GitLab Pages

Inspecione a configuração atual de build e publicação.

Se necessário, adapte o `.gitlab-ci.yml` para:

- Validar sintaxe e dependências.
- Executar testes automatizados.
- Construir o frontend, se houver etapa de build.
- Publicar apenas os arquivos necessários no Pages.
- Não incluir `.env`, dumps, segredos ou arquivos temporários.
- Separar testes e publicação.
- Evitar deploy automático de alterações não revisadas, conforme os recursos disponíveis.

Se a API estiver hospedada externamente, documentar a URL esperada e configurar a integração sem inserir segredos no bundle JavaScript.

O GitLab Pages pode publicar o frontend estático. Não assumir que hospedará a API Express ou o PostgreSQL.

## 13. Critérios de aceitação

Considerar a integração concluída somente quando:

- A aplicação real do repositório tiver sido inspecionada.
- As alterações estiverem na branch de trabalho correta.
- O frontend estiver conectado a endpoints reais da API.
- A API e o banco estiverem configurados em um ambiente executável de teste.
- A importação apresentar uma prévia antes da confirmação.
- A confirmação gravar nota, itens e estoque de forma consistente.
- A duplicidade da chave de acesso for impedida também no banco.
- Produtos iguais forem consolidados conforme regras explícitas.
- Produtos ambíguos não forem associados automaticamente.
- Notas, produtos e saldos puderem ser consultados.
- Os erros forem apresentados de forma compreensível.
- A aplicação não depender de credenciais no frontend.
- Os testes executados e suas limitações estiverem documentados.
- As instruções de configuração e publicação estiverem atualizadas.
- Nenhuma funcionalidade não testada for apresentada como concluída.

## 14. Entrega obrigatória

Ao terminar, apresente:

1. Diagnóstico do repositório.
2. Plano executado.
3. Arquivos criados e modificados.
4. Resumo das alterações.
5. Testes realizados e resultados.
6. Comandos para executar localmente.
7. Variáveis de ambiente necessárias, sem valores secretos.
8. Situação da integração com a API e o banco.
9. Situação da publicação no GitLab Pages.
10. Pendências de infraestrutura, autenticação, backups e migração.
11. Riscos ainda existentes.
12. Próximas ações recomendadas.

Não afirme que o código foi enviado ao GitLab, que o pipeline passou ou que o deploy está publicado sem confirmação verificável.

## 15. Ordem de execução

Siga esta sequência:

**A.** Inspecionar o repositório e verificar o estado do Git.

**B.** Comparar o frontend existente com a arquitetura da etapa 2.

**C.** Identificar dependências e bloqueios de ambiente.

**D.** Apresentar o diagnóstico e um plano curto de alterações.

**E.** Implementar a integração frontend/API e os ajustes estritamente necessários.

**F.** Executar testes e corrigir os erros encontrados.

**G.** Validar a configuração de publicação e o caminho de implantação.

**H.** Preparar commit e push na branch de trabalho, respeitando o estado existente e as permissões disponíveis.

**I.** Apresentar relatório final com resultados comprovados e pendências.

Comece pela inspeção. Não faça uma reescrita geral, não invente infraestrutura e não solicite credenciais secretas.



### Configuração confirmada do GitLab

- Repositório Git: `https://gitlab.com/marceloclr/tcs.git`
- Branch principal desejada: `main`
- Agente de desenvolvimento: Claude CLI, com acesso ao repositório.
- Publicação pretendida: GitLab Pages, sujeita à verificação da configuração existente.

Antes de executar comandos Git:

1. Execute `git status`, `git branch --show-current` e `git remote -v`.
2. Confirme que o diretório atual corresponde ao projeto correto.
3. Verifique se `origin` já existe. Se existir, confira seu endereço antes de alterá-lo.
4. Consulte o estado da branch remota `main` antes de fazer push.
5. Preserve alterações locais, commits e histórico remoto.
6. Não use `git push --force`, `git reset --hard` ou comandos destrutivos sem autorização explícita.
7. Se for necessário configurar o remoto, use `https://gitlab.com/marceloclr/tcs.git`, sem incluir tokens ou senhas na URL.
8. Faça o trabalho em uma branch de integração, se possível, e execute os testes antes de enviar alterações.
9. Só faça push após verificar que ele não sobrescreverá trabalho existente.
10. Informe o resultado real do push e do pipeline; não declare sucesso sem confirmação.