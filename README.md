# Purple Tab

O Purple Tab é um aplicativo desktop para organizar a vida financeira em um só lugar. A proposta combina o controle do dia a dia — contas, entradas, despesas e cartões — com o acompanhamento de projetos, investimentos e patrimônio.

O aplicativo é pensado para uso individual, com dados guardados localmente no computador. As informações financeiras são registradas pelo usuário; cotações e indicadores de mercado podem ser consultados pela internet quando disponíveis.

## O que você pode fazer

### Organizar por projetos

- Separar atividades financeiras em projetos, apresentados como abas de trabalho.
- Personalizar projetos com cores e ícones, além de arquivar e reabrir projetos sem perder o histórico.
- Alternar entre um projeto específico e uma visão consolidada das finanças.

### Registrar e acompanhar o dinheiro

- Criar receitas e despesas, editar, duplicar, excluir ou marcar lançamentos pendentes como recebidos ou pagos.
- Classificar movimentações por categoria e subcategoria, conta, projeto, data e situação.
- Cadastrar categorias, contas ou projetos diretamente durante o preenchimento de um lançamento.
- Programar despesas e receitas recorrentes ou dividir compras em parcelas.
- Transferir valores entre contas sem contabilizar a transferência como receita ou despesa.
- Consultar o histórico, comparar períodos e projetos, acompanhar metas e exportar relatórios em CSV ou PDF.

### Gerenciar contas, moedas e cartões

- Manter contas bancárias, carteiras e dinheiro em espécie, com saldo inicial e moeda próprios.
- Consultar valores em diferentes moedas. A moeda de exibição converte os totais sem modificar os registros originais.
- Filtrar a análise pelas contas selecionadas.
- Cadastrar cartões com moeda, limite, conta de pagamento, dia de fechamento e vencimento configuráveis.
- Registrar compras à vista ou parceladas, acompanhar limite usado e disponível e lançar pagamentos de fatura.

### Planejar compromissos e patrimônio

- Manter contas a pagar avulsas ou recorrentes, inclusive compromissos cujo valor varia a cada mês.
- Registrar pagamentos parciais ou completos, selecionando a conta, a data e eventuais juros, multas, taxas ou descontos.
- Organizar empréstimos e financiamentos com saldo devedor e cronograma de parcelas.
- Cadastrar bens como imóveis e veículos, incluindo valor de aquisição, avaliações ao longo do tempo, participação e documentos relacionados.
- Acompanhar uma estimativa consolidada de patrimônio, considerando saldos, investimentos, bens e dívidas cadastrados.

### Acompanhar investimentos e mercados

- Registrar ativos e aportes em diferentes classes, incluindo ações e criptoativos.
- Consultar gráficos interativos com navegação e zoom para explorar a evolução dos ativos e dos valores registrados.
- Acompanhar indicadores econômicos e câmbio, além de consultar cotações online para ativos compatíveis com as fontes configuradas.
- Simular aplicações de renda fixa com parâmetros como percentual do CDI, prazo, impostos e taxas.
- Personalizar a identidade de projetos, contas e ativos com ícones disponíveis ou imagens próprias.

Cotações e indicadores dependem de conexão com a internet e da disponibilidade das fontes utilizadas. Algumas consultas de mercado podem exigir uma chave de serviço configurada pelo usuário. Os valores exibidos servem para acompanhamento e não executam ordens de compra ou venda.

### Personalizar a área de trabalho

- Escolher entre diferentes layouts do dashboard, como visões voltadas a contas, investimentos, gráficos ou moedas internacionais.
- Montar um layout próprio escolhendo e ordenando os blocos exibidos.
- Usar gráficos, cartões e indicadores com animações suaves e suporte à preferência do sistema por movimento reduzido.

## Dados e privacidade

O Purple Tab usa SQLite para armazenar os registros no computador. O aplicativo também oferece backup manual e cópias automáticas locais. Backups podem ser usados para restaurar os dados em outra instalação.

O aplicativo não se conecta ao banco do usuário por Open Finance, não importa extratos automaticamente e não realiza pagamentos. Contas, transações, compras e avaliações patrimoniais são mantidas pelo usuário. As integrações online destinam-se a dados de mercado, câmbio e indicadores econômicos.

## Executar no Windows

Uma versão empacotada pode ser iniciada pelo arquivo **Purple Tab.exe** dentro da pasta de distribuição. Mantenha os arquivos dessa pasta juntos. O aplicativo usa sua própria base local, separada dos arquivos do executável.

Para trabalhar no código, instale Node.js 24 ou superior e execute:

```powershell
npm ci
npm run electron-dev
```

Para compilar e empacotar uma versão para Windows x64:

```powershell
npm run build
npm run package:win
```

`npm run dev` inicia apenas a interface web de desenvolvimento. Os recursos de persistência financeira dependem do aplicativo Electron.

## Estrutura do projeto

- `src/features/` contém as telas, formulários, gráficos e módulos do aplicativo.
- `src/lib/` reúne os tipos e cálculos compartilhados pela interface.
- `electron/` contém o processo desktop, o armazenamento SQLite e integrações de dados.
- `preload.cjs` expõe à interface uma API restrita para acessar os recursos do desktop.
- `tests/` contém testes das regras financeiras e dos fluxos do aplicativo.

O projeto está em desenvolvimento. Para conhecer decisões e planos em andamento, consulte [Plano de ação](PLANO_DE_ACAO.md) e [Mercados e investimentos](MERCADOS_PLANO.md).
