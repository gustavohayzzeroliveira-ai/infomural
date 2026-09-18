// api/search.js — GET /api/search?q=termo
// Busca ações (B3 + EUA e outras bolsas) via Yahoo Finance (endpoint público, sem chave).
const { fetchWithTimeout } = require("../lib/fetch-timeout");

module.exports = async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) {
    res.status(400).json({ error: "Parâmetro 'q' é obrigatório." });
    return;
  }

  // Cache de 1h: resultado de busca por texto muda pouco.
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
    const r = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const json = await r.json();

    const results = (json.quotes || [])
      .filter((it) => it && it.symbol && (it.quoteType === "EQUITY" || it.quoteType === "ETF"))
      .map((it) => ({
        symbol: it.symbol,
        name: it.shortname || it.longname || it.symbol,
        exchange: it.exchange || it.fullExchangeName || "",
      }))
      .slice(0, 10);

    res.status(200).json({ results });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Não foi possível buscar ações agora: " + (err.message || "") });
  }
};
