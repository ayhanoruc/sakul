import { Router } from 'express';
import { inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { sqlite } from '../db/index.js';

export const searchRouter = Router();

type Hit = { entity: 'not' | 'dosya' | 'proje'; entity_id: number; snippet: string; rank: number };

const stmt = () =>
  sqlite.prepare<[string], Hit>(
    `SELECT entity, entity_id, snippet(search_fts, 2, '<b>', '</b>', '…', 12) AS snippet, rank
       FROM search_fts
      WHERE search_fts MATCH ?
      ORDER BY rank
      LIMIT 30`,
  );

searchRouter.get('/', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 3) {
    res.status(400).json({ error: 'query_too_short', min: 3 }); // trigram tokenizer minimum
    return;
  }
  // quote the query so FTS operators (AND, OR, *) are treated as literal text
  const match = `"${q.replace(/"/g, '""')}"`;
  let hits: Hit[];
  try {
    hits = stmt().all(match);
  } catch {
    res.json({ notlar: [], dosyalar: [], projeler: [] });
    return;
  }

  const ids = (e: Hit['entity']) => hits.filter((h) => h.entity === e).map((h) => h.entity_id);
  const snippetOf = new Map(hits.map((h) => [`${h.entity}:${h.entity_id}`, h.snippet]));
  const orderOf = new Map(hits.map((h, i) => [`${h.entity}:${h.entity_id}`, i]));
  const sortByRank = <T extends { id: number }>(rows: T[], e: string) =>
    rows.sort((a, b) => (orderOf.get(`${e}:${a.id}`) ?? 99) - (orderOf.get(`${e}:${b.id}`) ?? 99));

  const notlar = ids('not').length
    ? sortByRank(db.select().from(schema.notlar).where(inArray(schema.notlar.id, ids('not'))).all(), 'not')
    : [];
  const dosyalar = ids('dosya').length
    ? sortByRank(db.select().from(schema.dosyalar).where(inArray(schema.dosyalar.id, ids('dosya'))).all(), 'dosya')
    : [];
  const projeler = ids('proje').length
    ? sortByRank(db.select().from(schema.projeler).where(inArray(schema.projeler.id, ids('proje'))).all(), 'proje')
    : [];

  res.json({
    notlar: notlar.map((r) => ({ ...r, snippet: snippetOf.get(`not:${r.id}`) })),
    dosyalar: dosyalar.map((r) => ({ ...r, snippet: snippetOf.get(`dosya:${r.id}`) })),
    projeler: projeler.map((r) => ({ ...r, snippet: snippetOf.get(`proje:${r.id}`) })),
  });
});
