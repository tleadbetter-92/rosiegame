const STORY_MOODS = ["scary", "mysterious", "own"];

function normalizeMood(raw) {
    const m = String(raw || "").trim().toLowerCase();
    return STORY_MOODS.includes(m) ? m : null;
}

function storyInstructions(mood, npcTitle) {
    const moodLine =
        mood === "scary"
            ? "Tell a SCARY local tale — something that would make a listener uneasy (woods, roads, old sins, things seen at night). Keep it believable for a frontier inn or garrison town."
            : mood === "mysterious"
                ? "Tell a MYSTERIOUS local tale — odd happenings, unanswered questions, strange coincidences. Do not explain everything."
                : "Tell whatever LOCAL story " + npcTitle + " most wants to share right now — the one that has been on their mind.";
    return (
        "\n[STORY MODE — the player asked you to tell a story out loud.]\n" +
        moodLine + "\n" +
        "- Speak in first person as the storyteller (\"I heard…\", \"When I was…\", \"There's a place…\").\n" +
        "- 150–280 words. One clear story with a beginning, middle, and end.\n" +
        "- Use hidden bible + campaign context + optional terrain sketch (if provided below).\n" +
        "- You are NOT limited to mapped features: invent a cave, sinkhole, ruin, thicket, or brook if the story needs it — even when no cave is on the map.\n" +
        "- Prefer directions locals use (\"southwest of town\", \"past the lumber track\", \"toward the old camp\") over raw coordinates.\n" +
        "- This is NOT secret DM text — you are performing for the traveler.\n" +
        "- Do not mention game mechanics, prompts, or being an AI.\n" +
        "- Once told, the game treats what you say as real local history/rumour for THIS campaign (the human designer may later turn tales into quests or map pins).\n"
    );
}

function storyUserMessage(mood) {
    if (mood === "scary") return "[The player asks you to tell a scary local story.]";
    if (mood === "mysterious") return "[The player asks you to tell a mysterious local story.]";
    return "[The player asks you to tell whatever story you most want to share about this place.]";
}

async function extractStoryLore(storyText, npcTitle, mood) {
    const key = process.env.OPENAI_API_KEY;
    if (!key || !storyText) {
        return { title: "Local tale", summary: "", worldPublic: [], worldSpread: [], npc: [], places: [] };
    }
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const prompt =
        "An NPC in a fantasy RPG just told a spoken story. Extract what becomes TRUE in this campaign from now on.\n" +
        "Return ONLY JSON:\n" +
        '{"title": string, "summary": string, "worldPublic": string[], "worldSpread": string[], "npc": string[], "places": [{"name": string, "kind": string, "direction": string, "note": string}]}\n' +
        "title = short name for the tale (5–8 words).\n" +
        "summary = 2–3 sentences: what locals would repeat about this story.\n" +
        "worldPublic = 2–4 plain facts now true in the region (events, places, names, curses, rumours as facts this campaign treats as real).\n" +
        "worldSpread = up to 2 extra facts that should spread to other NPCs after ~1 day (optional gossip).\n" +
        "npc = 1–2 facts " + npcTitle + " personally remembers about telling this story.\n" +
        "places = up to 3 invented or mentioned locations for the human designer (kind: cave, woods, road, ruin, hamlet, water, other; direction: e.g. southwest of Southwest town; note: one line).\n" +
        "Mood tag: " + mood + "\n\nStory:\n" + storyText.slice(0, 3500);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + key,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 420,
            temperature: 0.2
        })
    });
    if (!res.ok) {
        return {
            title: "Local tale",
            summary: storyText.slice(0, 280),
            worldPublic: ["In this campaign, " + npcTitle + " told a story that locals now repeat."],
            worldSpread: [],
            npc: [],
            places: []
        };
    }
    const data = await res.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) {
        return { title: "Local tale", summary: "", worldPublic: [], worldSpread: [], npc: [], places: [] };
    }
    try {
        const json = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, "").trim());
        let places = [];
        if (Array.isArray(json.places)) {
            places = json.places.slice(0, 3).map((p) => ({
                name: String(p.name || "").slice(0, 80),
                kind: String(p.kind || "other").slice(0, 32),
                direction: String(p.direction || "").slice(0, 120),
                note: String(p.note || "").slice(0, 200)
            })).filter((p) => p.name);
        }
        return {
            title: String(json.title || "Local tale").slice(0, 80),
            summary: String(json.summary || "").slice(0, 520),
            worldPublic: Array.isArray(json.worldPublic) ? json.worldPublic : [],
            worldSpread: Array.isArray(json.worldSpread) ? json.worldSpread : [],
            npc: Array.isArray(json.npc) ? json.npc : [],
            places
        };
    } catch {
        return {
            title: "Local tale",
            summary: storyText.slice(0, 280),
            worldPublic: [],
            worldSpread: [],
            npc: [],
            places: []
        };
    }
}

module.exports = {
    STORY_MOODS,
    normalizeMood,
    storyInstructions,
    storyUserMessage,
    extractStoryLore
};
