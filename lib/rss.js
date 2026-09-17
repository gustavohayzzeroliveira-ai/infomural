// lib/rss.js — parser mínimo de RSS, sem dependências externas.

function decodeEntities(str) {
  return String(str)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripTags(html) {
  return decodeEntities(String(html).replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  let val = m[1].trim();
  const cdataMatch = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdataMatch) val = cdataMatch[1];
  return val.trim();
}

// Extrai o link tanto de <link>texto</link> (RSS padrão) quanto de <link href="..."/> (Atom).
function extractLink(block) {
  const plain = extractTag(block, "link");
  if (plain && !/^</.test(plain)) return stripTags(plain);
  const hrefMatch = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return hrefMatch ? hrefMatch[1] : "";
}

function parseRSS(xml, sourceName) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const block of blocks) {
    const rawTitle = extractTag(block, "title");
    const link = extractLink(block);
    const rawDate =
      extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "dc:date") || extractTag(block, "updated");
    const rawDesc = extractTag(block, "description") || extractTag(block, "content:encoded") || extractTag(block, "summary");

    const title = stripTags(rawTitle);
    const pubDate = rawDate ? new Date(rawDate) : null;
    let summary = stripTags(rawDesc);
    if (summary.length > 160) summary = summary.slice(0, 157).trim() + "…";

    if (!title || !pubDate || isNaN(pubDate.getTime())) continue;

    items.push({
      title,
      url: link,
      summary,
      source: sourceName,
      pubDate: pubDate.toISOString(),
    });
  }
  return items;
}

module.exports = { parseRSS };
