# Mural Econômico — Brasil (versão 100% gratuita)

Site que mostra, em formato de mural, as principais notícias do dia sobre a economia
brasileira e a bolsa (B3/Ibovespa), com um resumo dos últimos dias úteis. **Não usa
nenhuma API paga nem chave de acesso** — só fontes públicas e gratuitas.

## Fontes de dados

| Dado | Fonte | Observação |
|---|---|---|
| Ibovespa, Dólar, Euro | [Yahoo Finance](https://finance.yahoo.com) (endpoint público) | Não-oficial, mas amplamente usado e gratuito, sem chave |
| Selic, IPCA | [Banco Central do Brasil — SGS](https://www3.bcb.gov.br/sgspub) | API oficial, pública e gratuita |
| Notícias | RSS de InfoMoney, Money Times, CNN Brasil, G1 Economia e UOL Economia | Feeds públicos dos próprios veículos |

Nenhuma dessas fontes exige cadastro, chave de API ou pagamento.

## Estrutura do projeto

- `public/index.html` — o site (front-end), sem build.
- `api/market.js` — função serverless: busca Ibovespa/dólar/euro no Yahoo Finance e
  Selic/IPCA no Banco Central.
- `api/news.js` — função serverless: busca e combina os feeds RSS, remove duplicados,
  categoriza por palavra-chave e ordena por data.
- `lib/rss.js` — parser simples de RSS (sem dependências externas).
- `lib/fetch-timeout.js` — helper para não travar se alguma fonte demorar.

O "Resumo da semana" é montado **sem nenhuma chamada extra**: o `/api/news` já traz até
80 notícias recentes, e o front-end agrupa essas notícias pelo dia em que foram
publicadas para montar as abas. Ou seja, quanto mais os feeds publicarem ao longo dos
dias, mais completo fica o resumo semanal.

## Deploy — passo a passo

Como não precisa de chave nem variável de ambiente, o deploy é ainda mais simples que o
normal.

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
não sobrecarregar as fontes gratuitas). Isso já cobre bem o uso de "mural que atualiza
todo dia" — sempre que alguém abre, os dados são recentes.

## Limitações a saber (por ser tudo gratuito e sem chave)

- **Yahoo Finance** é um endpoint público não-oficial: funciona bem na prática, mas a
  Yahoo pode mudar o formato ou bloquear tráfego automatizado sem aviso. Se um dia parar
  de funcionar, o site continua no ar — só aquele indicador específico some do mural (o
  código já foi feito para degradar com elegância nesse caso).
- **RSS não tem busca por data**: diferente de uma busca "o que aconteceu terça-feira",
  os feeds só trazem o que os próprios veículos publicaram recentemente. Por isso o
  "Resumo da semana" mostra os dias que **realmente têm notícias nos feeds** no momento
  da visita, não necessariamente todos os 5 dias úteis.
- Se algum feed RSS mudar de endereço, é só atualizar a URL em `api/news.js` (lista `FEEDS`).

## Quer mais robustez / mais indicadores?

Dá para trocar peças isoladamente sem afetar o resto:
- Trocar o Yahoo Finance por uma API paga de cotações (ex: Alpha Vantage, Brapi) se
  quiser algo com SLA garantido.
- Adicionar mais feeds RSS à lista `FEEDS` em `api/news.js`.
- Voltar a usar IA para gerar resumos mais elaborados das notícias (isso volta a exigir
  uma chave de API paga) — posso montar essa versão híbrida se você quiser.
