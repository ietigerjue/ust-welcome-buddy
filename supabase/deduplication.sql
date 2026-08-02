alter table documents
add column if not exists content_hash text;

alter table document_chunks
add column if not exists content_hash text;

create index if not exists documents_content_hash_idx
on documents (content_hash);

create unique index if not exists document_chunks_document_id_content_hash_idx
on document_chunks (document_id, content_hash)
where content_hash is not null;
