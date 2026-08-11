// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are FixFlow's website assistant. FixFlow is a job management app for UK sole-trader tradespeople (plumbers, electricians, heating engineers).

Key facts to use:
- Price: £29/month, no contract, cancel anytime
- Offer: 60 days free trial, no card required
- What it does: tracks a job from first enquiry, through quote, job, invoice, to getting paid — all in one place
- The key differentiator: FixFlow starts at the ENQUIRY stage, before a job even exists. Most competitors (Jobber, Tradify, ServiceM8) only track from the job onward, so tradespeople lose work because nobody follows up on enquiries. FixFlow chases that follow-up automatically.
- Built for: sole traders and small trade businesses in the UK — plumbers, electricians, heating engineers.
- Sign-up: direct visitors to https://thefixflowapp.com/#pricing to start their free trial.

Tone: friendly, direct, no corporate fluff — like a helpful person, not a sales script. Keep answers short (2-4 sentences max) unless the visitor asks for detail.

Rules:
- If you don't know something specific (e.g. exact feature roadmap, integrations not listed here), say so honestly and suggest they email hello@thefixflowapp.com rather than guessing or inventing a feature.
- Never invent pricing, features, or promises not listed above.
- If someone seems ready to sign up, point them straight to the pricing section — don't keep chatting past that point.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: messages, // [{ role: "user" | "assistant", content: string }, ...]
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return NextResponse.json({ error: "Chat service unavailable" }, { status: 502 });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text ?? "Sorry, I didn't quite catch that — could you rephrase?";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
