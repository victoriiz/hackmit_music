import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Log environment variable
    console.log("[DEBUG] SUNO_API_KEY:", process.env.SUNO_API_KEY);

    // Log request body
    const body = await request.text();
    console.log("[DEBUG] Incoming request body:", body);
    const { prompt, tags, makeInstrumental } = JSON.parse(body);

    if (!prompt || prompt.trim().length === 0) {
      console.log("[DEBUG] Missing prompt");
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      console.error("[DEBUG] SUNO_API_KEY not found in environment variables");
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    // Log outgoing request to Suno API
    const outgoingPayload = {
      topic: prompt,
      tags: tags || undefined,
      make_instrumental: makeInstrumental || false,
    };
    console.log("[DEBUG] Outgoing payload to Suno API:", outgoingPayload);

    // Generate song using Suno HackMIT API
    const generateResponse = await fetch(
      "https://studio-api.prod.suno.com/api/v2/external/hackmit/generate",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(outgoingPayload),
      }
    );

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error("[DEBUG] Suno API generation error:", errorText);
      return NextResponse.json(
        { error: "Failed to start song generation" },
        { status: generateResponse.status }
      );
    }

    const clip = await generateResponse.json();
    console.log("[DEBUG] Suno API response:", JSON.stringify(clip, null, 2));

    // The Suno HackMIT generate endpoint returns a single clip object
    if (!clip || !clip.id) {
      console.error("[DEBUG] Invalid response format:", clip);
      return NextResponse.json(
        { error: "Invalid response from Suno API" },
        { status: 500 }
      );
    }

    // Return the clip for polling (as an array for consistency with frontend)
    return NextResponse.json({
      success: true,
      clips: [
        {
          id: clip.id,
          status: clip.status,
          created_at: clip.created_at,
        },
      ],
    });
  } catch (error) {
    console.error("[DEBUG] Generate music error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
