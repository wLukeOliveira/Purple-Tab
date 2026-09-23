# Purple Tab — plano da primeira versão funcional

Status: aprovado pelo usuário e implementado em 22/09/2026. Primeira versão local 0.1.0 entregue como aplicativo portátil Windows x64.

## Resultado da execução

- Etapas 1 a 7 implementadas, com SQLite local e as sete telas conectadas aos mesmos registros.
- Compilação TypeScript/Vite e lint aprovados; 18 testes automatizados de banco e regras financeiras aprovados.
- Teste completo no Electron de desenvolvimento e no executável empacotado aprovado: formulários, abas, sete telas, metas, relatórios CSV/PDF, backup/restauração e persistência após reiniciar offline.
- O cenário financeiro terminou com saldo de R$ 2.150,00, sem duplicar receitas/despesas nas transferências. Parcelamento e ajuste de datas também cobertos pelos testes.
- Executável: `release/Purple Tab-win32-x64/Purple Tab.exe`. Instruções de primeiro uso e limitações em [README.md](README.md).
- Dados de teste isolados da base do usuário; evidências locais em `tests/artifacts/`. Não houve publicação no GitHub.

## Objetivo da entrega

Transformar a interface atual em um aplicativo financeiro desktop para Windows, com banco de dados local, criação e edição de lançamentos, projetos em abas e todas as sete telas da barra lateral funcionais. A entrega deve abrir por clique, funcionar offline e preservar os dados após fechar o aplicativo.

## Premissas aprovadas

- Manter React, TypeScript, Vite, Electron e a identidade visual roxa/escura, corrigindo problemas de organização e uso da interface conforme necessário.
- Primeira versão para um usuário local, em português do Brasil e reais (BRL).
- Usar SQLite como fonte única dos registros. O banco fica na pasta de dados do aplicativo, fora do repositório e do diretório de instalação.
- Cada lançamento pertence a um projeto e a uma conta. As contas podem ser utilizadas por diferentes projetos.
- “Geral” é uma visão consolidada; não duplica registros nem recebe lançamentos diretamente. Um projeto “Pessoal” permite começar a usar o programa.
- “Empresa” e “Investimentos” podem ser projetos criados pelo usuário e usam o mesmo mecanismo de lançamentos nesta versão.
- Iniciar com valores financeiros zerados; permitir categorias iniciais editáveis. Dados de demonstração ficam apenas nos testes.
- Fechar uma aba apenas a oculta. Arquivar um projeto preserva seus lançamentos e seu histórico na consolidação.
- Conquistas será uma área de metas e marcos reais, com critérios explícitos. Proposta: metas de resultado líquido/economia por período e projeto, além de marcos como primeiro projeto e primeiro lançamento.

## 1. Estabilizar a execução e preparar a estrutura

- Criar uma branch de trabalho local e verificar alterações existentes antes da implementação.
- Corrigir os erros de TypeScript e lint encontrados, os botões aninhados e os problemas relevantes de efeitos/animações.
- Padronizar instalação e comandos de desenvolvimento com versões travadas, resolvendo a dependência atual de um comando npm indisponível no ambiente.
- Separar inicialização de desenvolvimento e produção: Vite no desenvolvimento; arquivos empacotados na versão desktop.
- Separar o componente MainContent em telas, formulários e serviços reutilizáveis.
- Definir tipos e regras financeiras compartilhados pela interface e pelo Electron.
- Validar cedo o acesso SQLite e sua compatibilidade com o Electron, inclusive em um pacote Windows mínimo, antes de construir as demais telas.

Aceite: ambiente reproduzível, compilação e verificação de código aprovadas, janela desktop abrindo com arquivos locais e banco de teste acessível no aplicativo empacotado.

## 2. Implementar banco local e persistência

- Criar estruturas para projetos, contas, categorias/subcategorias, lançamentos, séries de parcelas/recorrências, transferências, metas e preferências.
- Implementar migrações versionadas para que atualizações futuras preservem os registros.
- Acessar o banco no processo principal do Electron. A interface usa operações específicas por meio do preload, com validação de entrada; não recebe acesso genérico a SQL ou arquivos.
- Usar valores inteiros em centavos, datas financeiras sem conversão indevida de fuso e consultas com parâmetros.
- Garantir gravações atômicas para séries e transferências, vínculos válidos entre os registros e mensagens claras em caso de erro.
- Salvar preferências de navegação, abas abertas e sua ordem.

Aceite: criar, consultar e editar registros; fechar e reabrir o aplicativo; confirmar que os dados e preferências permanecem corretos.

## 3. Tornar cadastros e abas utilizáveis

- Projetos: criar, renomear, escolher cor, abrir, fechar aba, reabrir, ordenar, arquivar e desarquivar.
- Contas: nome, instituição, tipo, saldo inicial e data de início; edição e arquivamento.
- Categorias: criar, editar e arquivar categorias de receitas/despesas e suas subcategorias.
- Impedir exclusão definitiva de cadastros usados por lançamentos; oferecer arquivamento e preservar referências históricas.
- Fazer a aba selecionada definir o contexto de todas as telas laterais.
- Tratar “Geral” como a visão de todos os projetos; preservar os registros de projetos arquivados no histórico.

Aceite: criar dois projetos, alternar entre eles e a visão Geral, fechar/reabrir abas e reiniciar o programa sem perder projetos ou cadastros.

## 4. Implementar o fluxo financeiro completo

- Receitas e despesas: criar, visualizar, editar, duplicar e excluir com confirmação.
- Campos: descrição, valor, projeto, conta, categoria/subcategoria, vencimento, situação e observação opcional.
- Separar pendente de pago/recebido, registrando também a data da efetivação.
- Usar o mesmo formulário na tela Criação, no atalho da Home e na edição pelo Histórico.
- Implementar parcelas mensais a partir de um valor total; a soma das parcelas deve fechar exatamente o valor informado.
- Implementar recorrências mensais finitas, usando o campo de quantidade de meses existente. Cada mês repete o valor integral.
- Oferecer edição/exclusão de uma ocorrência ou desta e das próximas pendentes. Ocorrências já realizadas precisam de edição explícita.
- Tratar vencimentos no fim do mês, meses curtos e anos bissextos.
- Implementar transferências entre contas como uma operação única e atômica, sem inflar receitas ou despesas.
- Atualizar todas as telas após uma gravação bem-sucedida e evitar registros duplicados por cliques repetidos.

Aceite: um lançamento criado aparece no histórico, no projeto e em Geral; editar, efetivar ou excluir atualiza todos os totais; parcelas e transferências mantêm consistência.

## 5. Ligar as sete telas aos dados reais

| Tela | Entrega funcional |
| --- | --- |
| Home | Receitas, despesas, saldo ou resultado do projeto, valores a pagar/receber, previsão, gráfico e histórico recente. Filtros por período, conta, categoria e subcategoria aplicados a todos os componentes. Clique em lançamento permite edição. |
| Histórico | Busca, filtros, ordenação e paginação; detalhes, edição, duplicação, exclusão e pagamento/recebimento. Mostrar conta, projeto, categoria, datas e situação. |
| Comparação | Comparar dois períodos no mesmo contexto ou dois projetos no mesmo período. Mostrar receitas, despesas, resultado, diferença em reais e percentual quando a base permitir. |
| Relatórios | Resumos por período, projeto, conta e categoria, com detalhamento dos registros. Exportação CSV e versão para impressão/salvar PDF, refletindo os filtros selecionados. |
| Criação | Central para cadastrar receitas, despesas, transferências, projetos, contas, categorias e subcategorias; formulários reutilizados nos atalhos. |
| Conquistas | Criar e editar metas por período/projeto, visualizar progresso e conclusão, além de marcos derivados de registros reais. Meta de economia usa o resultado líquido realizado no período e explicita esse critério. |
| Configurações | Perfil local, preferências de interface, acesso aos cadastros, informação sobre localização dos dados, backup/restauração e versão do aplicativo. |

Regras de cálculo e apresentação:

- Saldo de uma conta = saldo inicial + entradas realizadas - saídas realizadas + transferências recebidas - transferências enviadas.
- Resultado de um projeto = receitas realizadas - despesas realizadas atribuídas ao projeto; não representa uma conta bancária separada.
- Resultado do período e saldo acumulado terão rótulos distintos. Datas de vencimento orientam pendências; datas de efetivação orientam fluxo realizado.
- Previsão combina saldo realizado e lançamentos pendentes dentro do horizonte indicado. Será apresentada como previsão baseada nos registros, sem promessa de previsão inteligente.
- Substituir os cartões ambíguos “Perdas Totais” e “Projeção de Perdas” por indicadores definidos, como “A pagar” e “Saldo previsto”.
- Remover números fixos e dados aleatórios. Uma mesma seleção de filtros deve produzir os mesmos totais nas telas e exportações.
- Se não houver base válida para comparação percentual, mostrar “sem base de comparação”, sem infinito nem percentual inventado.
- Corrigir formatação de moeda, casas decimais e porcentagens, incluindo o problema atual de interpretação da vírgula decimal.

## 6. Completar a experiência de uso e proteger os dados

- Implementar estados vazios com atalhos úteis, validação de formulários, carregamento e feedback de sucesso/erro.
- Ajustar sobreposições, rolagem, tamanho da janela, acessibilidade dos controles e navegação por teclado.
- Substituir o perfil fictício pelo perfil local configurável. Fazer tela cheia e indicadores superiores funcionarem de forma coerente.
- Como a primeira versão é PT-BR/BRL, retirar seletores que hoje apenas trocam bandeira e símbolo. Tradução completa e conversão de moedas ficam para evolução posterior.
- Disponibilizar backup manual e backup automático diário ao usar o app, com retenção limitada e data da última cópia.
- Usar snapshot consistente do SQLite para backup. Restaurar somente após validar o arquivo e criar cópia preventiva dos dados atuais; informar que a restauração substitui a base local.
- Preservar o banco ao atualizar ou reinstalar o executável. Não enviar dados financeiros ao GitHub.

Aceite: erro de gravação não gera confirmação falsa; backup e restauração reproduzem registros e totais; funcionamento local não depende de internet.

## 7. Verificar e entregar a versão desktop

- Testar regras financeiras, persistência, migrações e operações atômicas com dados de teste separados dos dados do usuário.
- Testar o fluxo completo na janela Electron e na versão empacotada, incluindo formulários, abas, filtros e as sete telas.
- Conferir compilação e lint após a implementação.
- Gerar um pacote/executável Windows para abrir por clique, sem Vite ou terminal, e verificar os recursos estáticos e o banco nesse pacote.
- Atualizar o README com instalação, execução, localização dos dados, backup e limitações da primeira versão.
- Entregar o executável local, instruções curtas e um resumo dos testes realizados.

## Cenário obrigatório de aceite

1. Abrir o aplicativo com base vazia e cadastrar uma conta com saldo inicial de R$ 1.000,00.
2. Usar o projeto inicial Pessoal e criar Empresa; lançar uma receita recebida de R$ 2.000,00 em Empresa e uma despesa paga de R$ 300,00 em Pessoal.
3. Confirmar saldo global de R$ 2.700,00 e resultados dos projetos de R$ 2.000,00 e -R$ 300,00.
4. Editar a despesa para R$ 350,00 e confirmar saldo global de R$ 2.650,00 em todas as visões equivalentes.
5. Cadastrar R$ 500,00 a pagar e conferir que o saldo realizado segue em R$ 2.650,00 e a previsão, incluindo esse vencimento, é R$ 2.150,00.
6. Efetivar o pagamento e conferir saldo realizado de R$ 2.150,00, sem duplicar a despesa.
7. Transferir R$ 100,00 para uma segunda conta: os saldos individuais mudam, o saldo consolidado permanece em R$ 2.150,00 e receitas/despesas não aumentam.
8. Testar parcelamento de R$ 100,00 em três parcelas e vencimento no dia 31: soma exata de R$ 100,00 e datas válidas.
9. Fechar/reabrir uma aba e depois o aplicativo; verificar registros, projetos, preferências e totais.
10. Exportar relatório com filtros, fazer backup e restaurá-lo em base de teste; conferir os mesmos dados e totais.
11. Repetir a abertura do executável com o servidor de desenvolvimento desligado e sem conexão com a internet.

## Evoluções fora desta primeira entrega

Sincronização em nuvem, múltiplos usuários, login online, conexão automática com bancos, importação de extratos bancários, faturas completas de cartão, cotações/carteira de investimentos, câmbio e interface em vários idiomas. Exportação de relatórios e backup/restauração estão incluídos nesta entrega.

Esses limites delimitam o escopo aprovado; não alteram o pedido de tornar todas as telas laterais funcionais.

## Referências técnicas consultadas

- [SQLite — usos adequados, incluindo aplicações desktop](https://www.sqlite.org/whentouse.html)
- [Electron — isolamento de contexto e APIs via preload](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [SQLite — API de backup consistente](https://www.sqlite.org/backup.html)
- [Electron — distribuição de aplicações](https://www.electronjs.org/docs/latest/tutorial/distribution-overview)
