export type DedupeSourceInput = {
  id?: string;
  document_id?: string;
  slug?: string;
  title: string;
  snippet?: string;
  source?: string;
  source_url?: string;
  updatedAt?: string;
  updated_at?: string;
  category?: string;
  matchedChunksCount?: number;
};

export type DedupedSource = DedupeSourceInput & {
  matchedChunksCount: number;
};

function getSourceKey(source: DedupeSourceInput) {
  return (
    source.document_id ??
    source.slug ??
    `${source.title}-${source.source ?? ""}`
  );
}

export function dedupeSources<TSource extends DedupeSourceInput>(
  sources: TSource[]
): Array<TSource & DedupedSource> {
  const map = new Map<string, TSource & DedupedSource>();

  for (const source of sources) {
    const key = getSourceKey(source);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...source,
        matchedChunksCount: 1,
      });
      continue;
    }

    existing.matchedChunksCount = (existing.matchedChunksCount ?? 1) + 1;
  }

  return Array.from(map.values());
}
