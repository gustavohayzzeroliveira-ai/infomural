// api/news.js — GET /api/news
// Agrega notícias de feeds RSS públicos e gratuitos de veículos brasileiros de economia.
const { parseRSS } = require("../lib/rss");
const { fetchWithTimeout } = require("../lib/fetch-timeout");

// Se algum desses feeds mudar de endereço no futuro, é só trocar a URL aqui.
const FEEDS = [
  { url: "https://www.infomoney.com.br/feed/", name: "InfoMoney" },
  { url: "https://www.moneytimes.com.br/feed/", name: "Money Times" },
  { url: "https://www.cnnbrasil.com.br/economia/feed/", name: "CNN Brasil" },
  { url: "https://g1.globo.com/rss/g1/economia/", name: "G1 Economia" },
  { url: "https://rss.uol.com.br/feed/economia.xml", name: "UOL Economia" },
];

const KEYWORDS = [
  ["CÂMBIO", [/d[óo]lar/i, /câmbio/i, /cambio/i, /\beuro\b/i]],
  ["JUROS", [/selic/i, /\bjuros\b/i, /copom/i]],
  ["INFLAÇÃO", [/inflaç[ãa]o/i, /\bipca\b/i]],
  ["MERCADOS", [/ibovespa/i, /\bbolsa\b/i, /\bb3\b/i, /a[çc][õo]es/i]],
  ["COMMODITIES", [/petr[óo]leo/i, /min[ée]rio/i, /commodities/i, /\bgr[ãa]os\b/i]],
  ["EMPRESAS", [/lucro/i, /balan[çc]o/i, /empresa/i, /a[çc][ãa]o da/i]],
];

function guessCategory(title) {
  for (const [cat, patterns] of KEYWORDS) {
    if (patterns.some((re) => re.test(title))) return cat;
  }
  return "ECONOMIA";
}

module.exports = async (req, res) => {
  // Cache de 15min na CDN do Vercel.
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=300");

  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const r = await fetchWithTimeout(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MuralEconomicoBot/1.0; +https://vercel.com)" },
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const xml = await r.text();
      const parsed = parseRSS(xml, feed.name);
      if (!parsed.length) throw new Error("feed vazio ou formato inesperado");
      return parsed;
    })
  );

  let items = [];
  const warnings = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items = items.concat(r.value);
    else warnings.push(`${FEEDS[i].name}: ${r.reason.message}`);
  });

  // remove duplicados (mesma URL)
  const seen = new Set();
  items = items.filter((it) => {
    const key = it.url || it.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  items = items
    .map((it) => ({ ...it, category: guessCategory(it.title) }))
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 80);

  if (!items.length) {
    res.status(502).json({ error: "Nenhum feed de notícias respondeu no momento.", warnings });
    return;
  }

  res.status(200).json({ items, warnings });
};
