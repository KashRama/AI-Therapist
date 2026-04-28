/**
 * Local RAG ingestion script
 * Usage: node scripts/ingest.mjs
 *
 * Reads all .txt files from the knowledge-base/ folder,
 * chunks them, generates Voyage AI embeddings, and stores
 * them in Supabase pgvector.
 *
 * Run this whenever you add or update knowledge base documents.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join, extname, basename } from "path";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !VOYAGE_API_KEY) {
  console.error("Missing env vars. Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or anon key), and VOYAGE_API_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const KNOWLEDGE_BASE_DIR = "./knowledge-base";

function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) chunks.push(chunk);
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

async function generateEmbeddings(texts) {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "voyage-3", input: texts }),
  });

  if (!response.ok) {
    throw new Error(`Voyage AI error: ${await response.text()}`);
  }

  const json = await response.json();
  return json.data.map((d) => d.embedding);
}

async function ingestFile(filePath) {
  const source = basename(filePath);
  const text = readFileSync(filePath, "utf-8");
  const chunks = chunkText(text);

  console.log(`  ${source}: ${chunks.length} chunks`);

  // Generate embeddings in batches of 50
  const allEmbeddings = [];
  for (let i = 0; i < chunks.length; i += 50) {
    const batch = chunks.slice(i, i + 50);
    const embeddings = await generateEmbeddings(batch);
    allEmbeddings.push(...embeddings);
  }

  // Delete existing chunks for this file so re-runs don't duplicate
  await supabase.from("document_chunks").delete().eq("source", source);

  const rows = chunks.map((content, i) => ({
    content,
    embedding: allEmbeddings[i],
    source,
    metadata: { chunk_index: i, total_chunks: chunks.length },
  }));

  const { error } = await supabase.from("document_chunks").insert(rows);
  if (error) throw error;

  console.log(`  ✓ ${source} ingested`);
}

async function main() {
  const files = readdirSync(KNOWLEDGE_BASE_DIR)
    .filter((f) => extname(f) === ".txt")
    .map((f) => join(KNOWLEDGE_BASE_DIR, f));

  if (files.length === 0) {
    console.log("No .txt files found in knowledge-base/. Add some documents and re-run.");
    return;
  }

  console.log(`Ingesting ${files.length} file(s)...\n`);

  for (const file of files) {
    await ingestFile(file);
  }

  console.log("\nDone. RAG knowledge base is ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
