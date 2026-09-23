# Purple Tab

Aplicativo financeiro desktop para Windows, com projetos em abas, receitas/despesas, contas multimoeda, investimentos, contas a pagar, financiamentos, patrimônio e banco SQLite local. Versão 0.4.3, para um usuário, em português do Brasil.

## Abrir o aplicativo

O novo pacote local fica em `release/Purple Tab-0.4.3-win32-x64/`. Feche a versão anterior e abra **Purple Tab.exe** com dois cliques. Mantenha os demais arquivos dessa pasta juntos: eles fazem parte do aplicativo. O pacote anterior foi preservado, mas não deve abrir a base depois da migração para v4. A moeda de visualização aparece como uma bandeira discreta no canto superior direito; clique nela para buscar e escolher outra moeda.

O executável não precisa de Node, servidor Vite, terminal ou internet. Esta entrega é portátil; para transferir o aplicativo para outro computador, copie a pasta inteira. Transfira seus dados separadamente usando backup/restauração.

## Primeiro uso

O ícone discreto no canto superior direito da Visão geral abre layouts e personalização dos blocos. Não há mais um seletor grande no meio do dashboard.

### Criar sem sair do formulário

Nos campos de conta, projeto, categoria e subcategoria, **Criar… aqui** abre uma camada compacta sobre o formulário, sem deslocar seus campos. Ao confirmar, o item é salvo e selecionado; descrição, valor, datas e outras escolhas permanecem como estavam. O cadastro é explícito: digitar o nome não cria o item até clicar em **Criar e selecionar** ou pressionar Enter no campo de nome. Se já existir um cadastro ativo com o mesmo nome e contexto, ele é selecionado sem duplicação.

O atalho funciona no novo lançamento de entrada/despesa, compra no crédito, contas a pagar, financiamento, transferência, investimento, patrimônio e em outros campos de conta/projeto. Uma compra no crédito também permite criar o cartão e a conta usada para pagar sua fatura. Para configurar outros detalhes do cadastro, use a área Criação/Cartões depois. Os testes de interface usam bancos temporários: `node tests/inline-create.e2e.mjs` e `node tests/inline-card.e2e.mjs`.

### Débito, crédito e cartões

- **Novo lançamento:** despesas identificam débito, crédito, Pix, dinheiro, boleto ou outro. Débito começa como realizado; você pode ajustar a data e a situação. Registros antigos ficam como “não informado”, sem presumir a forma de pagamento.
- **Cartões:** cadastro com nome, instituição, ícone, moeda, quatro últimos dígitos opcionais, limite e conta padrão para quitar faturas. Não armazene número completo, CVV ou senha. Há limites total, usado e disponível por cartão e consolidados na moeda de visualização.
- **Calendário:** personalize fechamento, vencimento no mesmo mês ou no seguinte e a regra para compras no próprio dia do fechamento. Meses curtos usam o último dia válido. Confira as datas com o banco: feriados e horários de processamento não são inferidos. Uma fatura pode ter suas datas ajustadas antes de registrar pagamentos; alterações no cadastro do cartão só valem para faturas ainda não criadas.
- **Compras:** à vista ou em até 120 parcelas, com divisão exata dos centavos e primeira competência ajustável. O valor total compromete o limite imediatamente, mas não sai do saldo bancário. O histórico das compras fica separado das despesas realizadas.
- **Faturas:** baixa total, parcial ou antecipada, conta da mesma moeda e data personalizadas. O pagamento é distribuído pelas compras mais antigas primeiro e libera o valor aplicado do limite. É possível desfazer a baixa. Contas a pagar mostra cada parcela e permite baixas individuais; não se cria uma segunda despesa para a fatura.
- **Resultado:** regime de caixa — as despesas realizadas aparecem quando a fatura é paga, preservando projeto e categoria de cada compra. Patrimônio líquido desconta a dívida do cartão; pagar reduz caixa e dívida uma única vez.
- **Limitações:** controle manual, sem conexão com emissor, cálculo de rotativo ou estorno bancário de compra já paga. Encargos cobrados podem ser cadastrados como compra separada na competência correspondente. Um cadastro representa um limite independente; reúna cartões adicionais com limite compartilhado no mesmo cadastro. Arquivar preserva a dívida, mas retira o limite disponível dos totais.
- **Segurança:** migração v3 → v4 com cópia preventiva `pre-v4-*.sqlite`; restaura também backups v1, v2 e v3. A versão antiga não deve abrir a base depois da migração. Testes usam bases isoladas.

Testes de cartões: `npm test` e, após o build, `npm run test:cards`.

### Contas a pagar, financiamentos e patrimônio

- **Contas a pagar:** contas avulsas, calendário, filtros, conta padrão, compromissos mensais fixos ou variáveis. Uma fatura sem valor aparece como “Aguardando valor”; a previsão manual, última fatura ou média das últimas três fica separada dos valores confirmados. As ocorrências são materializadas até dois meses à frente a cada atualização, sem prazo final obrigatório. Pausar mantém ocorrências já criadas; cadastros arquivados suspendem a geração.
- **Baixas:** uma ação registra hoje o valor restante na conta prevista. A opção personalizada permite outra conta da mesma moeda, data, baixa parcial, juros adicionais, multa, taxas, desconto e total personalizado. Diferenças não discriminadas ficam como ajuste não classificado. Pagamentos podem ser desfeitos do mais recente para o mais antigo. Não há execução de pagamento bancário.
- **Lançamentos antigos:** despesas pendentes aparecem numa seção própria e podem ser vinculadas sem duplicação. Após o vínculo, alterações e baixas são feitas em Contas a pagar; o Histórico preserva a rastreabilidade.
- **Financiamentos:** saldo principal numa data de referência, valor contratado, credor, condições e cronograma manual de até 600 parcelas, com principal e encargos discriminados. O assistente divide o principal; não simula Price/SAC/CET. O crédito opcional de empréstimo afeta caixa, não receitas. Baixas amortizam a dívida; apenas encargos afetam o resultado econômico. Antecipação é a baixa de uma parcela futura, podendo descontar encargos; não recalcula automaticamente as parcelas seguintes. Cronogramas com movimentações ficam protegidos contra reescrita.
- **Patrimônio:** categorias personalizadas, ícones/foto importada, moeda, projeto, aquisição, participação, avaliações datadas com fonte, histórico, financiamento vinculado e arquivamento. Preços informados são do bem inteiro; o patrimônio considera apenas sua participação. O contrato deve representar somente a sua dívida. Não registra automaticamente a compra no caixa.
- **Consolidado:** contas + investimentos abertos + sua participação nos bens − principal devido dos contratos − compras pendentes de cartão (incluindo parcelas futuras). Um contrato vinculado a um bem é descontado uma vez. Contas de consumo e juros futuros não entram neste indicador de principal devedor. Uma visão de projeto exclui contas bancárias globais. Falta de cotação/câmbio produz total parcial sinalizado, nunca paridade inventada. Valores de investimentos devem estar fora dos saldos bancários para evitar duplicação.
- **Documentos:** PDF, PNG, JPG e WebP de até 5 MB, até 30 por conta, contrato ou bem; ficam no SQLite e nos backups, podem ser exportados ou removidos. Sem leitura automática de boleto/OCR. A importação de ícone continua separada (imagem normalizada).
- **Lembretes:** a lista sinaliza vencidas, hoje, próximos sete dias e valores pendentes. Não há notificação com o aplicativo fechado. Valores anteriores não são reescritos quando se edita um modelo de recorrência.
- **Migração:** antes de atualizar uma base existente, cria-se uma cópia `pre-v3-*.sqlite`. Backups v1 e v2 também podem ser restaurados e migrados. Os testes usam pastas temporárias, nunca o banco pessoal.

Teste das novas regras: `node --experimental-strip-types --test tests/planning.test.mjs tests/planning-finance.test.ts`. Teste real de interface Electron: `node tests/planning.e2e.mjs` após o build.

1. Abra **Criação → Contas** e cadastre uma conta, o saldo inicial e a data desse saldo.
2. Use o projeto Pessoal ou crie outros projetos em **Criação → Projetos**. O botão `+` ao lado das abas abre projetos existentes.
3. Clique em **Novo lançamento** para registrar receita, despesa, parcelas ou recorrência mensal.
4. Consulte **Histórico** para editar, duplicar, excluir ou efetivar um lançamento.
5. Faça uma cópia em **Configurações → Salvar backup**.

As telas Home, Histórico, Comparação, Relatórios, Criação, Conquistas e Configurações utilizam os mesmos registros. O programa inicia com categorias básicas e um projeto Pessoal, sem valores financeiros fictícios.

## Interface e movimento

A identidade visual retoma o vidro escuro azul-violeta do protótipo original: superfícies suaves, navegação lateral compacta, botão principal translúcido com luz em movimento e resposta própria ao hover/clique. O menu pode ser expandido em janelas maiores; rótulos aparecem ao passar o mouse ou navegar pelo teclado.

Os indicadores monetários interpolam entre valores, preservando os centavos exatos no destino. Cards respondem ao cursor, barras animam alterações e diálogos têm entrada e saída suaves. A preferência de movimento reduzido do Windows é respeitada. Nenhuma animação altera os cálculos ou o banco.

Período e conta ficam sempre acessíveis. O botão **Filtros** revela categoria, subcategoria, situação e busca; um contador indica filtros adicionais ativos mesmo quando recolhidos.

## Regras financeiras

- **Geral** consolida os projetos. Fechar uma aba não exclui o projeto; é possível reabri-lo pelo botão `+`. Projetos arquivados mantêm seu histórico.
- Cada receita/despesa pertence a uma conta, um projeto e uma categoria; subcategoria e observação são opcionais.
- **Realizados** usam a data de pagamento/recebimento. **Pendentes** usam o vencimento e não alteram o saldo disponível. Não é possível efetivar pagamentos ou transferências no futuro.
- **Saldo de conta** inclui saldo inicial, lançamentos realizados e transferências até a data indicada. **Resultado do projeto/período** é receitas realizadas menos despesas realizadas.
- **Previsão** inclui pendências até o horizonte escolhido, inclusive as vencidas. Ela depende do que foi registrado.
- O saldo bancário acumulado é limitado pela conta selecionada e pela data indicada; busca/categoria/situação afetam os lançamentos e resultados, não o saldo bancário.
- **Parcelamento** divide um valor total e distribui os centavos para fechar a soma. **Recorrência** repete o valor integral em cada mês. O formulário permite séries de 2 a 120 meses; vencimentos em meses curtos são ajustados ao último dia válido.
- Ao editar uma série, é possível alterar só uma ocorrência ou esta e as próximas pendentes. Ocorrências realizadas precisam de edição explícita. Alterar só a descrição preserva valores e datas individuais.
- Transferências movimentam duas contas na mesma operação e não são receitas/despesas. Aparecem no Histórico/Relatórios em Geral.
- Categorias, contas e projetos usados são arquivados, preservando o histórico.
- **Metas** medem o resultado líquido realizado em um período/projeto. Não representam dinheiro reservado em uma conta separada.
- Comparação usa somente realizados. Quando a base anterior é zero, o percentual é indicado como sem base de comparação.

## Relatórios

Relatórios respeitam os filtros e a moeda de visualização. CSV usa separador `;`, texto UTF-8 e identifica a moeda no cabeçalho. PDF inclui contexto, referência de conversão, totais e registros. A conversão utiliza a cotação atual salva, inclusive para movimentos antigos; não é contabilidade cambial histórica. Campos textuais no CSV são protegidos contra interpretação como fórmulas.

## Dados e backup

- Banco: `%APPDATA%\Purple Tab\purple-tab.sqlite`.
- Backups automáticos: pasta `backups` ao lado do banco. Uma cópia diária durante o uso, com retenção das últimas 14 cópias.
- O backup manual usa a extensão `.purpletab` e pode ser guardado onde você escolher.
- Restaurar um backup substitui os registros atuais. O aplicativo valida o arquivo e cria uma cópia preventiva antes da substituição.
- Atualizar ou trocar a pasta do executável não remove o banco. Não apague a pasta de dados para atualizar o aplicativo.
- Para copiar os dados, use o recurso de backup do aplicativo; não copie apenas o arquivo `.sqlite` enquanto ele estiver aberto, pois pode haver arquivos de diário associados.

O banco fica somente neste computador. Backup automático na mesma máquina não substitui uma cópia manual em outro dispositivo/local.

## Desenvolvimento

Requisitos: Windows x64, Node.js 24 ou superior e npm. Instalação reproduzível pelo `package-lock.json`:

```powershell
npm ci
npm run electron-dev
```

O comando de desenvolvimento inicia Vite na porta 5173 e abre o Electron. Ao fechar o aplicativo, o servidor é encerrado. `npm run dev` abre apenas a interface de desenvolvimento web; a persistência financeira está disponível na janela Electron.

```powershell
npm run build
npm run electron
npm run lint
npm test
npm run test:dev
npm run test:design
npm run test:desktop
npm run package:win
```

Neste ambiente do Codex, também é possível executar diretamente os scripts com o Node disponível:

```powershell
node scripts/dev.mjs
node scripts/tasks.mjs build
node scripts/tasks.mjs package
node --experimental-strip-types --test tests/store.test.mjs tests/finance.test.ts
node tests/dev.smoke.mjs
node tests/design.e2e.mjs
node tests/desktop.e2e.mjs
```

Para testar o pacote, defina `PURPLE_TAB_EXE` com o caminho absoluto de `release/Purple Tab-win32-x64/Purple Tab.exe` e execute `node tests/desktop.e2e.mjs`.

Os testes usam bases temporárias e não abrem dados reais. Evidências de testes desktop ficam em `tests/artifacts/`, ignoradas pelo Git. `PURPLE_TAB_DATA_DIR` é um override reservado para testes/desenvolvimento.

O teste de design verifica valores intermediários da animação real, valor final exato, resposta dos cards e botão, movimento reduzido, as sete telas e duas dimensões de janela. As imagens desse teste usam exclusivamente dados fictícios isolados.

## Bancos e gráficos

A barra **Suas contas**, presente nas telas financeiras, mostra as contas reais do cadastro. Abra a pilha para incluir ou retirar cada conta do filtro; o mesmo recorte altera lançamentos, saldos, previsão, gráficos e relatórios. Contas sem logo conhecido usam iniciais. **Selecionar todas** recupera a visão consolidada.

Na Visão geral, **Fluxo do período** usa os lançamentos realizados e permite área, linha e barras, agregação por dia/semana/mês, zoom com a roda do mouse, arraste horizontal e leitura de valores ao passar o cursor. O resultado acumulado começa em zero no início do período filtrado; ele não é uma cotação de investimento.

O módulo **Investimentos** inclui aportes, caixinhas, pesquisa de ativos, preços online e gráficos de área/linha/velas com zoom e expansão. CDI/Selic vêm do Banco Central; câmbio diário vem do Frankfurter; cripto usa Coinbase com transmissão ao vivo na carteira/dashboard. Brasil usa brapi e mercados globais usam Twelve Data; acesso ampliado exige chave em **Investimentos → Conexões**. As chaves são protegidas pelo Windows e não acompanham backups.

O **Simulador** separa capital, rendimento bruto, IR regressivo/personalizado/isento, IOF opcional e administração. Uma caixinha de 120% do CDI usa 1,2 vezes o CDI de cada dia, capitalizado diariamente. Premissas e dias estimados aparecem na tela. Novos aportes são lotes diferentes para preservar prazos tributários.

Em **Criação → Contas**, cada carteira tem uma moeda. Cadastre Nomad · USD e Nomad · EUR para representar saldos da mesma instituição. Transferências de câmbio guardam valores enviados e recebidos. O seletor do topo converte a visualização sem alterar registros. Sem câmbio, contas não conversíveis ficam fora do total com aviso de total parcial. Metas continuam em BRL.

O dashboard oferece **Visão completa**, **Contas e rotina**, **Investimentos**, **Mesa de gráficos**, **Visão internacional** e **Meu layout**, com escolha e ordenação dos blocos. A visão internacional seleciona USD. Números usam Nunito Sans 800, embutida para uso offline.

Há instituições sugeridas, logos locais de bancos, 483 ícones de cripto e importação de PNG/JPG/WebP para projetos, contas e ativos. Empresas B3 usam ícones disponíveis na brapi quando online. Imagens importadas acompanham o backup.

Premissas, fontes, cobertura e limites estão em [MERCADOS_PLANO.md](MERCADOS_PLANO.md).

## Estrutura

- `electron/store.mjs`: esquema versionado, validações, operações atômicas e backup SQLite.
- `electron/main.mjs` e `preload.cjs`: janela desktop, API isolada, diálogos e exportações.
- `src/lib/`: contratos e cálculos financeiros compartilhados pelas telas.
- `src/features/`: telas, filtros, formulários e cadastros.
- `src/DesktopApp.tsx`: navegação, abas, estado e atualização após gravação.
- `scripts/`: desenvolvimento, compilação e empacotamento Windows.
- `tests/`: regras financeiras, banco e fluxos reais no Electron.

O runtime Electron está fixado em 39.8.10; o acesso SQLite usa `node:sqlite` incluído nesse runtime e validado nos testes. A API é experimental nessa versão do Node do Electron, por isso mudanças de runtime devem repetir testes de banco e do pacote.

## Limites atuais

Não inclui nuvem, múltiplos usuários, Open Finance, importação de extratos, faturas completas de cartão ou envio de ordens. Cadastrar ativos não movimenta automaticamente o saldo bancário: mantenha nas contas somente o caixa disponível. Lotes podem ser encerrados integralmente com valor líquido informado; venda parcial exige separar lotes. Rentabilidade não incorpora dividendos, eventos corporativos ou efeito cambial histórico. Renda fixa é uma estimativa para condições de CDB/RDB, sem come-cotas, carência, marcação a mercado ou limites promocionais automáticos.

O plano aprovado e os critérios de aceite estão em [PLANO_DE_ACAO.md](PLANO_DE_ACAO.md).
