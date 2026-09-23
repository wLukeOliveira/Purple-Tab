# Purple Tab 0.2 — investimentos, moedas e fontes

## Implementado

- Carteira local com lotes/aportes, quantidade decimal, custo unitário, custos de aquisição, moeda, conta de custódia, projeto, preço manual, lista de acompanhamento (quantidade zero) e encerramento integral com preço líquido informado.
- Classes: renda fixa/caixinha, cripto, ação, ETF, FII, fundo, título, commodity e outros. A pesquisa online cobre os ativos disponibilizados pelo provedor; qualquer ativo pode ser cadastrado manualmente.
- Banco Central SGS: CDI diário (12), Selic efetiva diária (11), meta Selic (432). Consulta limitada até a data local atual. Histórico diário para os aportes de renda fixa, até dez anos; dias sem fator histórico usam a taxa mais recente e são identificados como estimados.
- Coinbase Exchange: pesquisa de pares, preços, histórico horário/diário/semanal e WebSocket de negociações. Transmissão enquanto dashboard/carteira estiver visível, até 50 pares únicos. Reconexão automática; demais pares mantêm consulta periódica.
- brapi: pesquisa brasileira, cotações e histórico. PETR4, VALE3, ITUB4 e MGLU3 são exemplos públicos sem token; acesso ampliado depende de chave/plano.
- Twelve Data: pesquisa global, cotações e histórico com chave pessoal. Consulta periódica; cobertura, atraso e limites do plano continuam valendo.
- Frankfurter: câmbio diário de referência de bancos centrais, com 32 moedas selecionáveis. Preserva a data de cada moeda no cache. Não inclui spread/IOF/tarifas de remessa.
- Gráficos de área, linha e velas, leitura por ponto/data/hora, zoom, arraste e expansão. Preços pequenos têm até oito casas decimais. Atualizações preservam a navegação do gráfico.
- SQLite com cache de taxas, preços e históricos. Offline mantém o último dado e seu horário. Chaves protegidas pelo Windows fora do banco e dos backups.

## Matemática das caixinhas

Cada aporte é um lote com sua própria data. O modelo suporta CDB/RDB remunerado por percentual do CDI, percentual da Selic efetiva ou taxa anual prefixada; não presume que todo produto chamado caixinha tenha o mesmo regime.

Para 120% do CDI: fator diário = 1 + (CDI diário / 100) × 1,20. Multiplicam-se os fatores dos dias remunerados. A equivalência anual da taxa atual usa 252 dias úteis. Prefixado: fator diário = (1 + taxa anual / 100)^(1/252).

O intervalo inclui a data de aplicação e exclui a data de resgate. Calendário nacional estimado, incluindo feriados móveis; fatores históricos publicados prevalecem. Não inclui regras de liquidação específicas da instituição. Quando falta histórico ou o período está no futuro, mantém a última taxa disponível e informa quantos dias foram estimados.

Tributos incidem somente sobre rendimento positivo. IOF regressivo até o 29º dia, zero a partir do 30º. IR após deduzir IOF: 22,5% até 180 dias; 20% de 181 a 360; 17,5% de 361 a 720; 15% acima de 720. O usuário pode escolher alíquota própria ou isenção. Administração anual opcional reduz o saldo pelo fator diário equivalente. Resultados e impostos são arredondados para centavos.

Não cobre come-cotas, cupons, limites promocionais, carência, resgate parcial automático, marcação a mercado ou apuração fiscal de renda variável. São estimativas, não rendimentos garantidos.

## Multimoeda e totais

Uma instituição pode ter várias carteiras: Nomad USD, Nomad EUR etc. Dinheiro físico também tem moeda. Lançamentos usam a moeda da conta. Depois de utilizada, a moeda da conta fica protegida; crie outra carteira para outra denominação.

Transferências entre moedas armazenam débito e crédito efetivos. O câmbio indicativo não altera a operação.

Dashboard, histórico, comparação e relatórios convertem pela referência atual salva, inclusive registros antigos: visualização em outra moeda, não resultado cambial histórico. Valores sem preço/câmbio são identificados e o total é parcial. Metas continuam em BRL.

A carteira soma ativos separados do caixa bancário. Custo convertido usa o câmbio atual; variação não inclui ganho cambial histórico, dividendos ou eventos corporativos. Para evitar dupla contagem, não inclua ativos também no saldo de caixa da instituição.

## Personalização

Seis layouts, incluindo blocos pessoais reordenáveis. Ícones e cores dos projetos aparecem nas abas. Presets brasileiros/internacionais, dinheiro físico, logos locais e 483 ícones de cripto. Empresas B3 usam imagens da brapi quando disponíveis. Imagens importadas viram PNG de 128×128 e acompanham o backup.

## Validação e fontes

Testes: npm test, npm run test:investments, npm run test:desktop. Verificação online explícita e sem dados do usuário: npm run test:markets:online.

- [Banco Central: CDI diário, série 12](https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?hdOidSeriesSelecionadas=12&method=consultarGraficoPorId)
- [Lei 11.033 — IR regressivo](https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11033.htm)
- [Decreto 6.306 — IOF](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306.htm)
- [Lei 8.981 — base de IR líquida de IOF](https://www.planalto.gov.br/ccivil_03/leis/l8981.htm)
- [Frankfurter](https://frankfurter.dev/)
- [Coinbase WebSocket](https://docs.cdp.coinbase.com/exchange/websocket-feed/channels)
- [brapi](https://brapi.dev/docs)
- [Twelve Data](https://twelvedata.com/docs)
- [Lightweight Charts / TradingView](https://tradingview.github.io/lightweight-charts/)
- [Cryptocurrency Icons — CC0](https://github.com/spothq/cryptocurrency-icons)
- [Nunito Sans — SIL OFL](https://fontsource.org/fonts/nunito-sans)

As licenças da fonte, ícones de cripto e gráficos acompanham o pacote na pasta licenses. Logos identificam seus respectivos titulares.
