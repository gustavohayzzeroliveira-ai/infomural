// api/market.js — GET /api/market
// Cotações via Yahoo Finance (endpoint público não-oficial, sem chave) e
// Selic/IPCA via API oficial e gratuita do Banco Central do Brasil (SGS).
const { fetchWithTimeout } = require("../lib/fetch-timeout");

const YAHOO_SYMBOLS = {
  ibovespa: "^BVSP",
  dolar: "BRL=X",
  euro: "EURBRL=X",
};

// Séries do SGS/BCB: https://www3.bcb.gov.br/sgspub
const BCB_SERIES = {
  selic: 432,   // Meta Selic definida pelo Copom (% a.a.)
  ipca: 13522,  // IPCA acumulado em 12 meses (%)
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
const fmtCurrency = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

module.exports = async (req, res) => {
  // Cache de 15min na CDN do Vercel.
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const [ibov, usd, eur, selic, ipca] = await Promise.allSettled([
    fetchYahoo(YAHOO_SYMBOLS.ibovespa),
    fetchYahoo(YAHOO_SYMBOLS.dolar),
    fetchYahoo(YAHOO_SYMBOLS.euro),
    fetchBcbSeries(BCB_SERIES.selic),
    fetchBcbSeries(BCB_SERIES.ipca),
  ]);

  const data = {};
  const warnings = [];

  if (ibov.status === "fulfilled") data.ibovespa = { value: fmtIndex(ibov.value.price), change_pct: ibov.value.changePct };
  else warnings.push("Ibovespa: " + ibov.reason.message);

  if (usd.status === "fulfilled") data.dolar = { value: fmtCurrency(usd.value.price), change_pct: usd.value.changePct };
  else warnings.push("Dólar: " + usd.reason.message);

  if (eur.status === "fulfilled") data.euro = { value: fmtCurrency(eur.value.price), change_pct: eur.value.changePct };
  else warnings.push("Euro: " + eur.reason.message);

  if (selic.status === "fulfilled") data.selic = { value: fmtPct(selic.value) };
  else warnings.push("Selic: " + selic.reason.message);

  if (ipca.status === "fulfilled") data.ipca = { value: fmtPct(ipca.value) };
  else warnings.push("IPCA: " + ipca.reason.message);

  if (!Object.keys(data).length) {
    res.status(502).json({ error: "Nenhuma fonte de cotações respondeu no momento.", warnings });
    return;
  }

  data.warnings = warnings;
  res.status(200).json(data);
};
