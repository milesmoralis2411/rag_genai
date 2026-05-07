import { NextRequest, NextResponse } from "next/server";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";

export async function POST(req: NextRequest) {
  try {
    const { query, openaiKey, qdrantUrl, qdrantKey } = await req.json();

    if (!query || !openaiKey || !qdrantUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: openaiKey,
      modelName: "text-embedding-3-small",
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: qdrantUrl,
      apiKey: qdrantKey || undefined,
      collectionName: "notebooklm_docs",
    });

    const retriever = vectorStore.asRetriever({
      k: 4,
    });

    const searchedChunks = await retriever.invoke(query);

    const client = new ChatOpenAI({
      openAIApiKey: openaiKey,
      modelName: "gpt-4o-mini", // fast and cheap
    });

    const systemPrompt = `You are a helpful AI Assistant that answers user queries based strictly on the provided document context.

    RULES:
    - ONLY answer based on the provided context below.
    - If the answer is not in the context, explicitly state "I cannot find the answer to this in the document."
    - DO NOT use outside knowledge.
    - Be concise and clear.

    CONTEXT:
    ${searchedChunks.map(doc => doc.pageContent).join("\n\n---\n\n")}
    `;

    const response = await client.invoke([
      ["system", systemPrompt],
      ["user", query],
    ]);

    return NextResponse.json({ answer: response.content });
  } catch (err: any) {
    console.error("Chat Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
