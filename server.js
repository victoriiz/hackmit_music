// server.js
require("dotenv").config();              // loads .env
const express = require("express");
const cors = require("cors");

// Node 18+ has global fetch; if you're on older Node, install node-fetch and require it.
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SUNO_API_KEY = process.env.SUNO_API_KEY;
const SUNO_BASE = "https://api.sunoapi.org/api/v1";

// Quick sanity check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// 1) Kick off a music generation job
app.post("/api/suno/generate", async (req, res) => {
  try {
    if (!SUNO_API_KEY) {
      return res.status(500).json({ error: "Missing SUNO_API_KEY on server" });
    }

    const { prompt, instrumental = false, model = "V3_5", customMode = false, title, style } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Please provide a non-empty 'prompt' string." });
    }

    const body = {
      prompt,
      instrumental: !!instrumental,
      model,                 // e.g., "V3_5" (common), "V4", etc.
      customMode: !!customMode,
      ...(customMode ? { title: title || "", style: style || "" } : {})
    };

    const r = await fetch(`${SUNO_BASE}/generate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUNO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.code !== 200) {
      return res.status(r.status || 400).json({ error: j?.msg || "Generate failed", raw: j });
    }

    const taskId = j?.data?.taskId;
    if (!taskId) {
      return res.status(502).json({ error: "No taskId returned from Suno", raw: j });
    }
    res.json({ taskId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// 2) Check job status to get the audio URL when ready
app.get("/api/suno/status", async (req, res) => {
  try {
    if (!SUNO_API_KEY) {
      return res.status(500).json({ error: "Missing SUNO_API_KEY on server" });
    }
    const { taskId } = req.query;
    if (!taskId) return res.status(400).json({ error: "Missing taskId query param" });

    const r = await fetch(`${SUNO_BASE}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
      headers: { "Authorization": `Bearer ${SUNO_API_KEY}` }
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json(j);

    // Typical shape:
    // j.data.status === "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED"
    // If SUCCESS: j.data.response.data[0].audio_url
    return res.json(j);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
