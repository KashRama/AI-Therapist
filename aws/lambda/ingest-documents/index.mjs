/**
 * AWS Lambda: Document Ingestion Pipeline
 *
 * Trigger:  S3 ObjectCreated event (configured via S3 bucket notification)
 * Flow:     S3 upload → Lambda → chunk text → OpenAI embeddings → Supabase pgvector
 *
 * This is the "write" side of RAG. The Next.js app is the "read" side.
 * Keeping them separate is intentional — ingestion can be slow/async while
 * the chat API stays fast.
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const s3 = new S3Client({});

// Environment variables set in Lambda console or via IaC (CDK/Terraform/SAM)
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CHUNK_SIZE = 500;       // characters per chunk
const CHUNK_OVERLAP = 50;     // overlap between chunks to preserve context

// ---------------------------------------------------------------------------
// Text chunking
// ---------------------------------------------------------------------------

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 20) {  // skip tiny leftover fragments
      chunks.push(chunk);
    }

    start += chunkSize - overlap;
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// OpenAI embeddings (text-embedding-3-small = 1536 dimensions, cheap + fast)
// ---------------------------------------------------------------------------

async function generateEmbeddings(texts) {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "voyage-3",
      input: texts,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Voyage AI embeddings error: ${err}`);
  }

  const json = await response.json();
  return json.data.map((d) => d.embedding);
}

// ---------------------------------------------------------------------------
// Supabase upsert
// ---------------------------------------------------------------------------

async function storeChunks(supabase, chunks, embeddings, source) {
  const rows = chunks.map((content, i) => ({
    content,
    embedding: embeddings[i],
    source,
    metadata: { chunk_index: i, total_chunks: chunks.length },
  }));

  // Delete old chunks for this source so re-uploads don't duplicate
  await supabase.from("document_chunks").delete().eq("source", source);

  const { error } = await supabase.from("document_chunks").insert(rows);
  if (error) throw error;

  console.log(`Stored ${rows.length} chunks for source: ${source}`);
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

export const handler = async (event) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // S3 can batch multiple records in one invocation
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    console.log(`Processing s3://${bucket}/${key}`);

    // 1. Download the file from S3
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await Body.transformToString("utf-8");

    if (!text.trim()) {
      console.warn(`Empty file, skipping: ${key}`);
      continue;
    }

    // 2. Split into overlapping chunks
    const chunks = chunkText(text);
    console.log(`Split into ${chunks.length} chunks`);

    // 3. Generate embeddings in batches of 100 (OpenAI API limit)
    const BATCH_SIZE = 100;
    const allEmbeddings = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await generateEmbeddings(batch);
      allEmbeddings.push(...embeddings);
    }

    // 4. Store in Supabase pgvector
    await storeChunks(supabase, chunks, allEmbeddings, key);
  }

  return { statusCode: 200, body: "OK" };
};
