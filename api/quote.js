// api/quote.js — GET /api/quote?symbols=PETR4.SA,AAPL,VALE3.SA
// Cotação detalhada para a lista de ações acompanhadas (watchlist), via Yahoo Finance.
const { fetchWithTimeout } = require("../lib/fetch-timeout");

async function fetchQuote(symbol) {
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

  return {
    symbol: meta.symbol || symbol,
    name: meta.longName || meta.shortName || symbol,
    currency: meta.currency || "",
    price,
    change_pct: changePct,
    week52_high: typeof meta.fiftyTwoWeekHigh === "number" ? meta.fiftyTwoWeekHigh : null,
    week52_low: typeof meta.fiftyTwoWeekLow === "number" ? meta.fiftyTwoWeekLow : null,
    volume: typeof meta.regularMarketVolume === "number" ? meta.regularMarketVolume : null,
  };
}

module.exports = async (req, res) => {
  const raw = (req.query.symbols || "").toString().trim();
  if (!raw) {
    res.status(400).json({ error: "Parâmetro 'symbols' é obrigatório (separados por vírgula)." });
    return;
  }
  const symbols = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 30);

  // Cache curto: cotação de watchlist deve ficar mais fresca que o painel geral.
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=120");

  const results = await Promise.allSettled(symbols.map(fetchQuote));

  const quotes = {};
  const warnings = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") quotes[symbols[i]] = r.value;
    else warnings.push(`${symbols[i]}: ${r.reason.message}`);
  });

  res.status(200).json({ quotes, warnings });
};
