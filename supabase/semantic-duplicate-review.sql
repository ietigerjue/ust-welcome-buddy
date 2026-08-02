create or replace function match_duplicate_chunks(
  query_embedding vector(1024),
  match_count int default 10,
  similarity_threshold float default 0.82
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    document_chunks.id as chunk_id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where
    document_chunks.embedding is not null
    and 1 - (document_chunks.embedding <=> query_embedding) >= similarity_threshold
  order by similarity desc
  limit match_count;
$$;
