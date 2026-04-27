# AWS Infrastructure Setup

## Architecture Overview

```
[You upload a .txt/.md file]
         │
         ▼
    S3 Bucket (ai-therapist-docs)
         │  ObjectCreated event (automatic trigger)
         ▼
    Lambda Function (ingest-documents)
         │  downloads file, chunks text
         ▼
    OpenAI API (text-embedding-3-small)
         │  returns 1536-dim vector per chunk
         ▼
    Supabase pgvector (document_chunks table)
         │
         ▼
    Next.js chat API reads relevant chunks
    and injects them into GPT-4o system prompt
```

**Key architectural concept:** The ingestion pipeline (S3 → Lambda → Supabase) is completely
decoupled from the query pipeline (Next.js → Supabase → GPT-4o). This is a core pattern in
production systems — write-path and read-path scale independently.

---

## Step 1 — Create the S3 Bucket

1. Go to **AWS Console → S3 → Create bucket**
2. Bucket name: `ai-therapist-docs` (must be globally unique — add your initials if needed)
3. Region: pick one close to you (e.g. `us-east-1`)
4. Block all public access: **ON** (documents are private; Lambda reads them with IAM)
5. Create bucket

**Concept learned:** S3 is object storage — not a file system. Objects have a key (path-like
string) and a value (the file bytes). Buckets are the top-level namespace.

---

## Step 2 — Create an IAM Role for Lambda

IAM (Identity and Access Management) controls what AWS services can do. Lambda needs permission
to read from S3. This is "least privilege" — only grant what's needed.

1. Go to **AWS Console → IAM → Roles → Create role**
2. Trusted entity: **AWS service → Lambda**
3. Attach these policies:
   - `AWSLambdaBasicExecutionRole` (lets Lambda write logs to CloudWatch)
   - Create a custom inline policy for S3 access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::ai-therapist-docs/*"
    }
  ]
}
```

4. Name the role: `ai-therapist-lambda-role`

**Concept learned:** IAM roles are attached to services (not users). The role's trust policy says
"Lambda can assume this role." The permission policy says "this role can GetObject from S3."
These are two separate concerns — trust vs. permissions.

---

## Step 3 — Deploy the Lambda Function

### Package the function

```bash
cd aws/lambda/ingest-documents
npm install
zip -r ../ingest-documents.zip .
```

### Create the Lambda

1. Go to **AWS Console → Lambda → Create function**
2. Author from scratch
3. Function name: `ai-therapist-ingest-documents`
4. Runtime: **Node.js 20.x**
5. Architecture: x86_64
6. Execution role: **Use existing role → ai-therapist-lambda-role**
7. Create function

### Upload the code

1. In the Lambda console → **Upload from → .zip file**
2. Upload `aws/lambda/ingest-documents.zip`
3. Handler: `index.handler`

### Set environment variables

In the Lambda console → **Configuration → Environment variables → Edit:**

| Key | Value |
|-----|-------|
| `VOYAGE_API_KEY` | your Voyage AI API key (voyageai.com) |
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service role key |

**Important:** Never hardcode secrets in Lambda code. Environment variables are encrypted at rest
by AWS KMS. For production, use AWS Secrets Manager instead.

### Set timeout and memory

Configuration → General configuration → Edit:
- Memory: **256 MB** (enough for text processing)
- Timeout: **2 minutes** (embedding batches can be slow for large docs)

---

## Step 4 — Wire S3 → Lambda via Event Notification

This is the event-driven part. S3 will automatically invoke your Lambda whenever a file is uploaded.

1. Go to your S3 bucket → **Properties → Event notifications → Create event notification**
2. Name: `ingest-on-upload`
3. Event types: check **s3:ObjectCreated:All**
4. Prefix filter: *(leave blank — trigger on any upload)*
5. Destination: **Lambda function → ai-therapist-ingest-documents**
6. Save

**Concept learned:** This is pub/sub (publish/subscribe). S3 "publishes" an event when an object
is created. Lambda "subscribes" to that event. They don't know about each other — S3 just fires
the event, Lambda just handles it. This decoupling is what makes the system scalable and resilient.

---

## Step 5 — Run the Supabase Migration

In your Supabase project dashboard:
1. Go to **SQL Editor**
2. Paste and run `supabase/migrations/002_add_pgvector_rag.sql`

Or via the Supabase CLI:
```bash
supabase db push
```

---

## Step 6 — Test the Pipeline

Upload a test document to S3:

```bash
# Create a sample therapy knowledge base document
cat > /tmp/cbt-techniques.txt << 'EOF'
Cognitive Behavioral Therapy (CBT) Techniques

Thought Records: Help patients identify and challenge negative automatic thoughts.
Ask: What is the evidence for and against this thought?

Behavioral Activation: Encourage engagement in activities that bring pleasure or
a sense of achievement, countering depression's pull toward withdrawal.

Grounding Techniques: For anxiety, the 5-4-3-2-1 method: name 5 things you see,
4 you can touch, 3 you hear, 2 you smell, 1 you taste. Brings focus to the present.

Progressive Muscle Relaxation: Systematically tense and release muscle groups to
reduce physical tension associated with anxiety.
EOF

aws s3 cp /tmp/cbt-techniques.txt s3://ai-therapist-docs/
```

Check Lambda logs in **CloudWatch → Log groups → /aws/lambda/ai-therapist-ingest-documents**
to confirm it ran. Then query Supabase to verify chunks were stored:

```sql
select source, count(*) from document_chunks group by source;
```

---

## Step 7 — Deploy Next.js to Vercel

```bash
npm install -g vercel
vercel deploy
```

Add these environment variables in the Vercel dashboard (Project → Settings → Environment Variables):
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `VOYAGE_API_KEY`

---

## Cost Estimates (at low volume)

| Service | Free tier | Paid |
|---------|-----------|------|
| S3 | 5GB storage, 20k requests/month | ~$0.023/GB |
| Lambda | 1M requests/month, 400k GB-seconds | ~$0.20/1M requests |
| OpenAI embeddings | — | $0.02 per 1M tokens |
| Vercel | Hobby: free | Pro: $20/month |
| Supabase | Free tier generous | Pro: $25/month |

**Realistic cost for a personal/learning project: $0–5/month.**

---

## Architecture Concepts Covered

| Concept | Where you see it |
|---------|-----------------|
| Object storage | S3 bucket |
| Serverless compute | Lambda (no servers to manage) |
| Event-driven architecture | S3 ObjectCreated → Lambda trigger |
| Least-privilege IAM | Lambda role only has `s3:GetObject` |
| Decoupled pipelines | Ingestion and query paths are independent |
| Vector similarity search | pgvector `<=>` cosine distance operator |
| RAG pattern | Retrieval-Augmented Generation in chat route |
| Environment-based secrets | Lambda env vars, Vercel env vars |
