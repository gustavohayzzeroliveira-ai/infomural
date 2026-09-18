# Mural Econômico — Brasil & Mundo (versão 100% gratuita)

Painel no estilo "o que um investidor confere de manhã": estado geral da economia
brasileira **e** mundial, em formato de mural laranja/preto (estética de terminal
financeiro). **Não usa nenhuma API paga nem chave de acesso** — só fontes públicas e
gratuitas.

## O que o painel mostra

- **Brasil**: Ibovespa, dólar, euro, Selic, IPCA (12m), IGP-M
- **Bolsas globais**: S&P 500, Nasdaq, Dow Jones, DAX (Alemanha), Nikkei 225 (Japão),
  Hang Seng (Hong Kong)
- **Câmbio & juros internacionais**: Treasury de 10 anos dos EUA, Índice do Dólar (DXY)
- **Commodities & cripto**: Petróleo Brent, Petróleo WTI, Ouro, Bitcoin
- **Manchetes do dia** e **resumo da semana**, combinando veículos brasileiros e
  internacionais

## Fontes de dados

| Dado | Fonte | Observação |
|---|---|---|
| Ibovespa, câmbio, bolsas globais, commodities, cripto | [Yahoo Finance](https://finance.yahoo.com) (endpoint público) | Não-oficial, mas amplamente usado e gratuito, sem chave |
| Selic, IPCA, IGP-M | [Banco Central do Brasil — SGS](https://www3.bcb.gov.br/sgspub) | API oficial, pública e gratuita |
| Notícias Brasil | RSS de InfoMoney, Money Times, CNN Brasil, G1 Economia, UOL Economia | Feeds públicos dos próprios veículos |
| Notícias mundo | RSS de CNBC World Markets e MarketWatch | Em inglês — o card sempre mostra a fonte, então fica claro quando é internacional |

Nenhuma dessas fontes exige cadastro, chave de API ou pagamento.

## Estrutura do projeto

- `public/index.html` — o site (front-end), sem build.
- `api/market.js` — função serverless: busca todos os indicadores (Brasil, bolsas
  globais, câmbio/juros internacionais, commodities e cripto).
- `api/news.js` — função serverless: busca e combina os feeds RSS (BR + mundo), remove
  duplicados, categoriza por palavra-chave e ordena por data.
- `lib/rss.js` — parser simples de RSS/Atom (sem dependências externas).
- `lib/fetch-timeout.js` — helper para não travar se alguma fonte demorar.

O "Resumo da semana" é montado **sem nenhuma chamada extra**: o `/api/news` já traz até
100 notícias recentes, e o front-end agrupa essas notícias pelo dia em que foram
publicadas para montar as abas.

## Deploy — passo a passo

Como não precisa de chave nem variável de ambiente, o deploy é simples.

### Opção A: pelo site da Vercel (sem terminal)

1. Suba esta pasta para um repositório no GitHub.
2. Em [vercel.com/new](https://vercel.com/new), clique em **Import Project** e selecione
   o repositório.
3. Clique em **Deploy**. Em cerca de 1 minuto o site estará no ar em
   `https://seu-projeto.vercel.app`. Não precisa configurar nada além disso.

### Opção B: pela CLI da Vercel

```bash
npm i -g vercel     # instala a CLI (uma vez só)
cd mural-vercel
vercel               # primeiro deploy (assistente)
vercel --prod        # deploy em produção
```

## Testar localmente (opcional)

```bash
vercel dev            # sobe o site em http://localhost:3000
```

## Atualização automática

O site busca dados novos a cada visita (com cache de 15 minutos na CDN do Vercel, para
não sobrecarregar as fontes gratuitas). Isso cobre bem o uso de "mural que atualiza todo
dia" — sempre que alguém abre, os dados são recentes.

## Limitações a saber (por ser tudo gratuito e sem chave)

- **Yahoo Finance** é um endpoint público não-oficial: funciona bem na prática, mas pode
  mudar de formato ou bloquear tráfego automatizado sem aviso. Se isso acontecer, o site
  continua no ar — só aquele indicador específico some do mural (o código já degrada com
  elegância nesse caso, indicador por indicador).
- **^TNX (Treasury 10 anos)** no Yahoo retorna o rendimento multiplicado por 10 (ex.:
  42,5 = 4,25%); o código já faz essa conversão.
- **RSS não tem busca por data**: o "Resumo da semana" mostra os dias que realmente têm
  notícias nos feeds no momento da visita, não necessariamente 5 dias úteis completos.
- **Manchetes internacionais vêm em inglês** (CNBC, MarketWatch) — é assim porque não há
  tradução automática gratuita sem uma API de IA paga. Cada card mostra a fonte, então
  fica claro qual é qual.
- Se algum feed RSS mudar de endereço, é só atualizar a URL em `api/news.js` (lista
  `FEEDS`). Se algum ticker do Yahoo mudar, é em `api/market.js` (`YAHOO_SYMBOLS`).

## Quer mais robustez / mais indicadores?

Dá para trocar peças isoladamente sem afetar o resto:
- Trocar o Yahoo Finance por uma API paga de cotações (ex: Alpha Vantage, Brapi) se
  quiser algo com SLA garantido.
- Adicionar mais feeds RSS ou mais tickers globais.
- Voltar a usar IA para traduzir/resumir as notícias internacionais e gerar análises mais
  elaboradas — isso volta a exigir uma chave de API paga. Posso montar essa versão
  híbrida se você quiser.

