// api/market.js — GET /api/market
// Painel completo para o investidor: Brasil + mundo, via fontes públicas e gratuitas.
// Cotações: Yahoo Finance (endpoint público não-oficial, sem chave).
// Selic / IPCA / IGP-M: API oficial e gratuita do Banco Central (SGS).
const { fetchWithTimeout } = require("../lib/fetch-timeout");

const YAHOO_SYMBOLS = {
  // Brasil
  ibovespa: "^BVSP",
  dolar: "BRL=X",
  euro: "EURBRL=X",
  // Bolsas globais
  sp500: "^GSPC",
  nasdaq: "^IXIC",
  dow: "^DJI",
  dax: "^GDAXI",
  nikkei: "^N225",
  hangseng: "^HSI",
  // Câmbio & juros internacionais
  treasury10y: "^TNX", // Yahoo retorna o rendimento x10 (ex.: 42.5 = 4,25%)
  dxy: "DX-Y.NYB",
  // Commodities & cripto
  brent: "BZ=F",
  wti: "CL=F",
  ouro: "GC=F",
  bitcoin: "BTC-USD",
};

// Séries do SGS/BCB: https://www3.bcb.gov.br/sgspub
const BCB_SERIES = {
  selic: 432,  // Meta Selic definida pelo Copom (% a.a.)
  ipca: 13522, // IPCA acumulado em 12 meses (%)
  igpm: 189,   // IGP-M, FGV, variação % no mês
};

async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const r = await fetchWithTimeout(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!r.ok) throw new Error(`status ${r.status}`);
  const json = await r.json();
  const meta = json && json.chart && json.chart.result && json.chart.result[0] && json.chart.result[0].meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") throw new Error("dado ausente na resposta");
  const price = meta.regularMarketPrice;
  const prevClose = meta.previousClose != null ? meta.previousClose : meta.chartPreviousClose;
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
  return { price, changePct };
}

async function fetchBcbSeries(code) {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`;
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const arr = await r.json();
  const last = Array.isArray(arr) ? arr[arr.length - 1] : null;
  if (!last || last.valor === undefined) throw new Error("dado ausente na resposta");
  const n = parseFloat(String(last.valor).replace(",", "."));
  if (Number.isNaN(n)) throw new Error("valor inválido");
  return n;
}

const fmtIndex = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtNum2 = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCurrencyUSD = (n) => "US$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSDInt = (n) => "US$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtPct = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

module.exports = async (req, res) => {
  // Cache de 15min na CDN do Vercel.
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const symbolKeys = Object.keys(YAHOO_SYMBOLS);
  const bcbKeys = Object.keys(BCB_SERIES);

  const [yahooResults, bcbResults] = await Promise.all([
    Promise.allSettled(symbolKeys.map((k) => fetchYahoo(YAHOO_SYMBOLS[k]))),
    Promise.allSettled(bcbKeys.map((k) => fetchBcbSeries(BCB_SERIES[k]))),
  ]);

  const raw = {};
  const warnings = [];

  yahooResults.forEach((r, i) => {
    const key = symbolKeys[i];
    if (r.status === "fulfilled") raw[key] = r.value;
    else warnings.push(`${key}: ${r.reason.message}`);
  });

  bcbResults.forEach((r, i) => {
    const key = bcbKeys[i];
    if (r.status === "fulfilled") raw[key] = { price: r.value };
    else warnings.push(`${key}: ${r.reason.message}`);
  });

  const ind = (key, fmt) =>
    raw[key] ? { value: fmt(raw[key].price), change_pct: raw[key].changePct != null ? raw[key].changePct : null } : null;

  const data = {
    brasil: {
      ibovespa: ind("ibovespa", fmtIndex),
      dolar: ind("dolar", fmtNum2),
      euro: ind("euro", fmtNum2),
      selic: raw.selic ? { value: fmtPct(raw.selic.price) } : null,
      ipca: raw.ipca ? { value: fmtPct(raw.ipca.price) } : null,
      igpm: raw.igpm ? { value: fmtPct(raw.igpm.price) } : null,
    },
    global: {
      sp500: ind("sp500", fmtIndex),
      nasdaq: ind("nasdaq", fmtIndex),
      dow: ind("dow", fmtIndex),
      dax: ind("dax", fmtIndex),
      nikkei: ind("nikkei", fmtIndex),
      hangseng: ind("hangseng", fmtIndex),
    },
    cambio_juros: {
      treasury10y: raw.treasury10y
        ? { value: fmtPct(raw.treasury10y.price / 10), change_pct: raw.treasury10y.changePct }
        : null,
      dxy: ind("dxy", fmtNum2),
    },
    commodities: {
      brent: ind("brent", fmtCurrencyUSD),
      wti: ind("wti", fmtCurrencyUSD),
      ouro: ind("ouro", fmtCurrencyUSD),
      bitcoin: ind("bitcoin", fmtUSDInt),
    },
    warnings,
  };

  const hasAny = Object.values(data.brasil).concat(Object.values(data.global), Object.values(data.cambio_juros), Object.values(data.commodities)).some(Boolean);

  if (!hasAny) {
    res.status(502).json({ error: "Nenhuma fonte de cotações respondeu no momento.", warnings });
    return;
  }

  res.status(200).json(data);
};
