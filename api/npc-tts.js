const MAX_CHARS = 4096;

module.exports = async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    try {
        if (req.method === "GET") {
            const configured = Boolean(process.env.OPENAI_API_KEY);
            res.status(200).json({
                configured,
                model: configured ? (process.env.OPENAI_TTS_MODEL || "tts-1") : null,
                voice: configured ? (process.env.OPENAI_TTS_VOICE || "alloy") : null
            });
            return;
        }
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed." });
            return;
        }
        const key = process.env.OPENAI_API_KEY;
        if (!key) {
            res.status(503).json({ error: "TTS not configured.", fallback: "browser" });
            return;
        }
        const text = String(req.body && req.body.text || "").trim().slice(0, MAX_CHARS);
        if (!text) {
            res.status(400).json({ error: "Text is required." });
            return;
        }
        const model = process.env.OPENAI_TTS_MODEL || "tts-1";
        const voice = process.env.OPENAI_TTS_VOICE || "alloy";
        const apiRes = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
                Authorization: "Bearer " + key,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ model, voice, input: text })
        });
        if (!apiRes.ok) {
            const detail = await apiRes.text().catch(() => "");
            res.status(502).json({
                error: "Speech service failed.",
                fallback: "browser",
                detail: detail.slice(0, 200)
            });
            return;
        }
        const audio = Buffer.from(await apiRes.arrayBuffer());
        res.status(200);
        res.setHeader("Content-Type", "audio/mpeg");
        res.send(audio);
    } catch (err) {
        res.status(500).json({ error: err.message || "TTS error.", fallback: "browser" });
    }
};
