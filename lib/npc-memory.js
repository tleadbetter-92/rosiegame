const fs = require("fs");
const path = require("path");
const Clock = require("../clock");
const { getDb } = require("./db");
const { currentCampaignId, currentPlayMs } = require("./campaign-key");

const REGION = 1;
const CANON_CAP = 40;
const GOSSIP_CAP = 48;
const STORIES_CAP = 32;
const FACT_MAX = 420;
const OPINION_SUMMARY_MAX = 520;
const GOSSIP_DELAY_MS = Clock.DAY_MS;
const CAMPAIGNS_DIR = path.join(__dirname, "..", "data", "campaigns");

function storageKey(campaignId, kind, npc) {
    if (kind === "world") return "c:" + campaignId + ":world";
    return "c:" + campaignId + ":" + String(npc || "");
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

function mergeGossip(existing, added, sourceNpc, playMs) {
    const spreadPlayMs = playMs + GOSSIP_DELAY_MS;
    const out = (existing || []).slice();
    for (const raw of added || []) {
        const fact = cleanFact(raw);
        if (!fact || fact.length < 8) continue;
        const dup = out.some((item) => item.fact && item.fact.toLowerCase() === fact.toLowerCase());
        if (dup) continue;
        out.push({
            fact,
            sourceNpc: String(sourceNpc || ""),
            createdPlayMs: playMs,
            spreadPlayMs
        });
    }
    return out.slice(-GOSSIP_CAP);
}

function normalizeOpinion(raw) {
    if (!raw || typeof raw !== "object") return null;
    const disposition = String(raw.disposition || "").replace(/\s+/g, " ").trim().slice(0, 80);
    const summary = String(raw.summary || "").replace(/\s+/g, " ").trim().slice(0, OPINION_SUMMARY_MAX);
    let playerTraits = [];
    if (Array.isArray(raw.playerTraits)) {
        playerTraits = raw.playerTraits
            .map((t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 64))
            .filter(Boolean)
            .slice(0, 8);
    }
    if (!disposition && !summary && !playerTraits.length) return null;
    return {
        disposition: disposition || "neutral",
        summary: summary || "",
        playerTraits,
        updatedAt: new Date().toISOString()
    };
}

function campaignDir(campaignId) {
    return path.join(CAMPAIGNS_DIR, String(campaignId));
}

function npcFilePath(campaignId, npc) {
    return path.join(campaignDir(campaignId), npc + ".json");
}

function worldFilePath(campaignId) {
    return path.join(campaignDir(campaignId), "world.json");
}

function readJsonFile(file) {
    try {
        if (!fs.existsSync(file)) return null;
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return null;
    }
}

function writeNpcMemoryFile(campaignId, npc, body) {
    const file = npcFilePath(campaignId, npc);
    const payload = {
        campaignId: String(campaignId),
        region: REGION,
        npc,
        facts: body.facts || [],
        opinionOfPlayer: body.opinionOfPlayer || null,
        updatedAt: new Date().toISOString()
    };
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    } catch (err) {
        console.error("npc memory file write failed", file, err);
    }
}

function writeWorldMemoryFile(campaignId, body) {
    const file = worldFilePath(campaignId);
    const payload = {
        campaignId: String(campaignId),
        region: REGION,
        npc: "world",
        facts: body.facts || [],
        gossip: body.gossip || [],
        stories: body.stories || [],
        gossipDelayMs: GOSSIP_DELAY_MS,
        updatedAt: new Date().toISOString()
    };
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    } catch (err) {
        console.error("world memory file write failed", file, err);
    }
}

async function readWorldRecord(campaignId) {
    const key = storageKey(campaignId, "world");
    try {
        const db = await getDb();
        const doc = await db.collection("npcCanon").findOne({ key });
        if (doc) {
            return {
                facts: Array.isArray(doc.facts) ? doc.facts : [],
                gossip: Array.isArray(doc.gossip) ? doc.gossip : [],
                stories: Array.isArray(doc.stories) ? doc.stories : []
            };
        }
    } catch {
        /* file fallback */
    }
    const doc = readJsonFile(worldFilePath(campaignId));
    return {
        facts: doc && Array.isArray(doc.facts) ? doc.facts : [],
        gossip: doc && Array.isArray(doc.gossip) ? doc.gossip : [],
        stories: doc && Array.isArray(doc.stories) ? doc.stories : []
    };
}

function worldFactsForNpc(worldRecord, playMs) {
    const immediate = worldRecord.facts || [];
    const fromGossip = (worldRecord.gossip || [])
        .filter((row) => Number(row.spreadPlayMs) <= playMs)
        .map((row) => row.fact);
    return mergeFacts(immediate, fromGossip);
}

async function readNpcRecord(campaignId, npc) {
    const key = storageKey(campaignId, "npc", npc);
    try {
        const db = await getDb();
        const doc = await db.collection("npcCanon").findOne({ key });
        if (doc) {
            return {
                facts: Array.isArray(doc.facts) ? doc.facts : [],
                opinionOfPlayer: doc.opinionOfPlayer || null
            };
        }
    } catch {
        /* file fallback */
    }
    const doc = readJsonFile(npcFilePath(campaignId, npc));
    return {
        facts: doc && Array.isArray(doc.facts) ? doc.facts : [],
        opinionOfPlayer: (doc && doc.opinionOfPlayer) || null
    };
}

async function writeNpcRecord(campaignId, npc, facts, opinionOfPlayer) {
    const key = storageKey(campaignId, "npc", npc);
    const nextFacts = mergeFacts([], facts);
    const nextOpinion = opinionOfPlayer || null;
    try {
        const db = await getDb();
        await db.collection("npcCanon").updateOne(
            { key },
            {
                $set: {
                    key,
                    campaignId: String(campaignId),
                    region: REGION,
                    npc,
                    facts: nextFacts,
                    opinionOfPlayer: nextOpinion,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
    } catch {
        writeNpcMemoryFile(campaignId, npc, { facts: nextFacts, opinionOfPlayer: nextOpinion });
    }
    return { facts: nextFacts, opinionOfPlayer: nextOpinion };
}

async function writeWorldRecord(campaignId, facts, gossip, stories) {
    const key = storageKey(campaignId, "world");
    const nextFacts = mergeFacts([], facts);
    const nextGossip = (gossip || []).slice(-GOSSIP_CAP);
    const nextStories = (stories || []).slice(-STORIES_CAP);
    try {
        const db = await getDb();
        await db.collection("npcCanon").updateOne(
            { key },
            {
                $set: {
                    key,
                    campaignId: String(campaignId),
                    region: REGION,
                    npc: "world",
                    facts: nextFacts,
                    gossip: nextGossip,
                    stories: nextStories,
                    gossipDelayMs: GOSSIP_DELAY_MS,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
    } catch {
        writeWorldMemoryFile(campaignId, { facts: nextFacts, gossip: nextGossip, stories: nextStories });
    }
    return { facts: nextFacts, gossip: nextGossip, stories: nextStories };
}

async function loadCanon(campaignId, npc, playMs) {
    const clock = Number.isFinite(playMs) ? playMs : await currentPlayMs();
    const worldRecord = await readWorldRecord(campaignId);
    const world = worldFactsForNpc(worldRecord, clock);
    const record = await readNpcRecord(campaignId, npc);
    return {
        world,
        npc: record.facts,
        stories: worldRecord.stories || [],
        opinionOfPlayer: record.opinionOfPlayer,
        campaignId: String(campaignId),
        playMs: clock
    };
}

async function loadCanonForNpc(npc, playMs) {
    const campaignId = await currentCampaignId();
    return loadCanon(campaignId, npc, playMs);
}

async function appendCanon(campaignId, npc, worldPublic, worldSpread, npcFacts, opinionOfPlayer, playMs) {
    const clock = Number.isFinite(playMs) ? playMs : await currentPlayMs();
    const worldRecord = await readWorldRecord(campaignId);
    const facts = mergeFacts(worldRecord.facts, worldPublic);
    const gossip = mergeGossip(worldRecord.gossip, worldSpread, npc, clock);
    const record = await readNpcRecord(campaignId, npc);
    const npcOnly = mergeFacts(record.facts, npcFacts);
    const opinion = opinionOfPlayer != null ? normalizeOpinion(opinionOfPlayer) : record.opinionOfPlayer;
    await writeWorldRecord(campaignId, facts, gossip, worldRecord.stories || []);
    await writeNpcRecord(campaignId, npc, npcOnly, opinion);
    return {
        campaignId: String(campaignId),
        world: worldFactsForNpc({ facts, gossip }, clock),
        npc: npcOnly,
        opinionOfPlayer: opinion,
        added:
            (worldPublic || []).length +
            (worldSpread || []).length +
            (npcFacts || []).length
    };
}

function defaultOpinionFor(npcTitle) {
    return {
        disposition: "neutral",
        summary: npcTitle + " has not formed a strong view of this traveler yet.",
        playerTraits: [],
        updatedAt: new Date().toISOString()
    };
}

async function appendStory(campaignId, npc, mood, storyText, loreExtract, playMs) {
    const clock = Number.isFinite(playMs) ? playMs : await currentPlayMs();
    const worldRecord = await readWorldRecord(campaignId);
    const record = await readNpcRecord(campaignId, npc);
    const extract = loreExtract || {};
    const title = String(extract.title || "Local tale").slice(0, 80);
    const summary = String(extract.summary || "").slice(0, 520);
    const stories = (worldRecord.stories || []).slice();
    stories.push({
        id: "tale-" + clock + "-" + stories.length,
        npc: String(npc),
        mood: String(mood || "own"),
        title,
        summary,
        text: String(storyText || "").slice(0, 4000),
        places: Array.isArray(extract.places) ? extract.places : [],
        toldAtPlayMs: clock
    });
    const worldPublic = (extract.worldPublic || []).slice();
    if (summary.length > 20) {
        worldPublic.push("Local tale (“" + title + "”): " + summary);
    }
    const facts = mergeFacts(worldRecord.facts, worldPublic);
    const gossip = mergeGossip(worldRecord.gossip, extract.worldSpread || [], npc, clock);
    const npcOnly = mergeFacts(record.facts, extract.npc || []);
    await writeWorldRecord(campaignId, facts, gossip, stories);
    await writeNpcRecord(campaignId, npc, npcOnly, record.opinionOfPlayer);
    return {
        campaignId: String(campaignId),
        story: stories[stories.length - 1],
        world: worldFactsForNpc({ facts, gossip }, clock),
        added: worldPublic.length + (extract.worldSpread || []).length + (extract.npc || []).length
    };
}

async function extractTurnMemory(userMessage, assistantReply, npcTitle, priorOpinion) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        return { worldPublic: [], worldSpread: [], npc: [], opinionOfPlayer: null };
    }
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const prior = priorOpinion
        ? JSON.stringify({
            disposition: priorOpinion.disposition,
            summary: priorOpinion.summary,
            playerTraits: priorOpinion.playerTraits
        })
        : "none yet";
    const prompt =
        "From one RPG conversation turn, extract memory for THIS campaign only (unique per player/restart).\n" +
        "Return ONLY JSON:\n" +
        '{"worldPublic": string[], "worldSpread": string[], "npc": string[], "opinionOfPlayer": {"disposition": string, "summary": string, "playerTraits": string[]}}\n' +
        "worldPublic = up to 1 fact everyone in town would already know (witnessed in the street, shouted in the common room). Usually [].\n" +
        "worldSpread = up to 3 facts for town gossip queue: what was learned in this chat that OTHER locals will hear after ~1 game day (not instantly). Names, promises, rumours, clues, personal claims about the player.\n" +
        "npc = up to 2 facts " + npcTitle + " knows immediately from this talk (private memory, not yet town gossip).\n" +
        "opinionOfPlayer = how " + npcTitle + " NOW feels about this player (disposition; summary 1-2 sentences; playerTraits up to 4 tags).\n" +
        "No mechanics (loot, combat). Update opinion from prior + this turn. Use [] when nothing new.\n\n" +
        "Prior opinion JSON: " + prior + "\n\n" +
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
            max_tokens: 360,
            temperature: 0.25
        })
    });
    if (!res.ok) {
        return { worldPublic: [], worldSpread: [], npc: [], opinionOfPlayer: null };
    }
    const data = await res.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) {
        return { worldPublic: [], worldSpread: [], npc: [], opinionOfPlayer: null };
    }
    try {
        const json = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, "").trim());
        const legacyWorld = Array.isArray(json.world) ? json.world : [];
        return {
            worldPublic: Array.isArray(json.worldPublic) ? json.worldPublic : [],
            worldSpread: Array.isArray(json.worldSpread)
                ? json.worldSpread
                : legacyWorld,
            npc: Array.isArray(json.npc) ? json.npc : [],
            opinionOfPlayer: normalizeOpinion(json.opinionOfPlayer)
        };
    } catch {
        return { worldPublic: [], worldSpread: [], npc: [], opinionOfPlayer: null };
    }
}

/** @deprecated use extractTurnMemory */
async function extractCanonFacts(userMessage, assistantReply, npcTitle) {
    const row = await extractTurnMemory(userMessage, assistantReply, npcTitle, null);
    return { world: row.worldSpread.concat(row.worldPublic), npc: row.npc };
}

module.exports = {
    loadCanon,
    loadCanonForNpc,
    appendCanon,
    appendStory,
    extractCanonFacts,
    extractTurnMemory,
    defaultOpinionFor,
    normalizeOpinion,
    currentCampaignId,
    currentPlayMs,
    readWorldRecord,
    worldFactsForNpc,
    GOSSIP_DELAY_MS,
    CAMPAIGNS_DIR,
    CANON_CAP
};
