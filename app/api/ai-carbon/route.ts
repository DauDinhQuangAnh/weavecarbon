import { NextRequest, NextResponse } from "next/server";

const RAG_BASE_URL = (process.env.RAG_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query: string };
    if (!body.query?.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const ragRes = await fetch(`${RAG_BASE_URL}/chat/gemini`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: body.query }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!ragRes.ok) {
      const text = await ragRes.text().catch(() => "");
      return NextResponse.json(
        { error: `RAG API error ${ragRes.status}`, detail: text },
        { status: 502 }
      );
    }

    const data = await ragRes.json() as { query: string; answer: string };
    return NextResponse.json({ answer: data.answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isTimeout = message.includes("timeout") || message.includes("abort");
    return NextResponse.json(
      { error: isTimeout ? "RAG API timeout" : message },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
