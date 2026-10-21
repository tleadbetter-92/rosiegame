const fs = require("fs");
const path = require("path");
const { getDb } = require("./db");

const REGION = 1;
const CANON_CAP = 48;
const FACT_MAX = 420;
const CANON_FILE = path.join(__dirname, "..", "data", "npc-canon.json");

function canonKey(kind, npc) {
    if (kind === "world") return "region" + REGION + ":world";
    return "region" + REGION + ":" + String(npc || "");
}

function cleanFact(text) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, FACT_MAX);
}

function mergeFacts(existing, added) {
    const out = (existing || []).slice();
    for (const raw of added || []) {
        const fact = cleanFact(raw);
        if (!fact || fact.length < 8) continue;
        const dup = out.some((item) => item.toLowerCase() === fact.toLowerCase());
        if (dup) continue;
        out.push(fact);
    }
    return out.slice(-CANON_CAP);
}

function readCanonFile() {
    try {
        if (!fs.existsSync(CANON_FILE)) return {};
        const parsed = JSON.parse(fs.readFileSync(CANON_FILE, "utf8"));
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function writeCanonFile(store) {
    try {
        fs.mkdirSync(path.dirname(CANON_FILE), { recursive: true });
        fs.writeFileSync(CANON_FILE, JSON.stringify(store, null, 2));
    } catch (err) {
        console.error("npc-canon file write failed", err);
    }
}

async function readDoc(key) {
    try {
        const db = await getDb();
        const doc = await db.collection("npcCanon").findOne({ key });
        return doc && Array.isArray(doc.facts) ? doc.facts : [];
    } catch {
        const file = readCanonFile();
        return Array.isArray(file[key]) ? file[key] : [];
    }
}

async function writeDoc(key, facts) {
    const next = mergeFacts([], facts);
    try {
        const db = await getDb();
        await db.collection("npcCanon").updateOne(
            { key },
            { $set: { key, region: REGION, facts: next, updatedAt: new Date() } },
            { upsert: true }
        );
    } catch {
        const file = readCanonFile();
        file[key] = next;
        writeCanonFile(file);
    }
    return next;
}

async function loadCanon(npc) {
    const world = await readDoc(canonKey("world"));
    const npcFacts = await readDoc(canonKey("npc", npc));
    return { world, npc: npcFacts };
}

async function appendCanon(npc, worldFacts, npcFacts) {
    const worldKey = canonKey("world");
    const npcKey = canonKey("npc", npc);
    const world = mergeFacts(await readDoc(worldKey), worldFacts);
    const npcOnly = mergeFacts(await readDoc(npcKey), npcFacts);
    await writeDoc(worldKey, world);
    await writeDoc(npcKey, npcOnly);
    return { world, npc: npcOnly, added: (worldFacts || []).length + (npcFacts || []).length };
}

async function extractCanonFacts(userMessage, assistantReply, npcTitle) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return { world: [], npc: [] };
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const prompt =
        "You judge what became permanent story canon from one RPG conversation turn.\n" +
        "Baseline lore files already exist; only extract NEW facts the NPC clearly stated or agreed to in this turn.\n" +
        "Do not restate vague mood. Do not include secrets the NPC should not know.\n" +
        "Return ONLY valid JSON: {\"world\": string[], \"npc\": string[]}\n" +
        "world = facts true for everyone in the region. npc = facts specific to " + npcTitle + ".\n" +
        "Use 0–2 items per array. Empty arrays if nothing new became canon.\n\n" +
        "Player: " + userMessage.slice(0, 600) + "\n\n" +
        npcTitle + ": " + assistantReply.slice(0, 800);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + key,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 220,
            temperature: 0.2
        })
    });
    if (!res.ok) return { world: [], npc: [] };
    const data = await res.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) return { world: [], npc: [] };
    try {
        const json = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, "").trim());
        return {
            world: Array.isArray(json.world) ? json.world : [],
            npc: Array.isArray(json.npc) ? json.npc : []
        };
    } catch {
        return { world: [], npc: [] };
    }
}

module.exports = {
    loadCanon,
    appendCanon,
    extractCanonFacts,
    canonKey,
    CANON_CAP
};
