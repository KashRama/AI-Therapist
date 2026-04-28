import { createServerSupabaseClient } from "./supabase-server";

type DocumentChunk = {
  id: string;
  content: string;
  source: string;
  similarity: number;
};

// Voyage AI: Anthropic's recommended embedding partner (1024 dimensions)
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "voyage-3",
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Voyage AI embeddings API error: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data[0].embedding as number[];
}

// Returns relevant document context to inject into the system prompt.
// Returns empty string if no relevant chunks are found (safe to always call).
export async function getRelevantContext(userMessage: string): Promise<string> {
  try {
    const embedding = await generateEmbedding(userMessage);
    const supabase = await createServerSupabaseClient();

    const { data: chunks, error } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5,
    });

    if (error || !chunks?.length) return "";

    const context = (chunks as DocumentChunk[])
      .map((c) => c.content)
      .join("\n\n---\n\n");

    return context;
  } catch (err) {
    // RAG is best-effort — a failure here should never break the chat
    console.error("RAG retrieval failed:", err);
    return "";
  }
}
