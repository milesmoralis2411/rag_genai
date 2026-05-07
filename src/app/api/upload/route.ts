import { NextRequest, NextResponse } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const openaiKey = formData.get("openaiKey") as string;
    const qdrantUrl = formData.get("qdrantUrl") as string;
    const qdrantKey = formData.get("qdrantKey") as string;

    if (!file || !openaiKey || !qdrantUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let docs: Document[] = [];
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse the file
    if (file.name.endsWith(".pdf")) {
      const blob = new Blob([buffer], { type: "application/pdf" });
      const loader = new PDFLoader(blob);
      docs = await loader.load();
    } else if (file.name.endsWith(".txt")) {
      const text = buffer.toString("utf-8");
      docs = [new Document({ pageContent: text })];
    } else {
      return NextResponse.json({ error: "Unsupported file format" }, { status: 400 });
    }

    // Chunking strategy
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    const splitDocs = await textSplitter.splitDocuments(docs);

    // Initialize Embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: openaiKey,
      modelName: "text-embedding-3-small", // or large, but small is cheaper
    });

    // Store in Qdrant
    await QdrantVectorStore.fromDocuments(splitDocs, embeddings, {
      url: qdrantUrl,
      apiKey: qdrantKey || undefined,
      collectionName: "notebooklm_docs",
    });

    return NextResponse.json({ success: true, chunks: splitDocs.length });
  } catch (err: any) {
    console.error("Upload Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
