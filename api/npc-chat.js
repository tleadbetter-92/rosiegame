const region1Config = require("../lib/region1-npcs");
const { buildSystem, listNpcs, npcTitle } = require("../lib/npc-prompt");
const {
    loadCanon,
    appendCanon,
    appendStory,
    extractTurnMemory,
    defaultOpinionFor,
    currentCampaignId,
    currentPlayMs,
    readWorldRecord,
    GOSSIP_DELAY_MS
} = require("../lib/npc-memory");
const {
    normalizeMood,
    storyInstructions,
    storyUserMessage,
    extractStoryLore
} = require("../lib/npc-story");
const { buildTerrainHintForStories } = require("../lib/story-terrain-context");

const OPENING_USER = "[The player walks up to speak with you. Give a brief in-character greeting or question—one or two short sentences. Do not describe game UI.]";

function cleanHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
        if (!item || typeof item.content !== "string") continue;
        const role = item.role === "assistant" ? "assistant" : "user";
        const content = item.content.trim().slice(0, 1200);
        if (!content) continue;
        out.push({ role, content });
        if (out.length >= 12) break;
    }
    return out;
}

async function openAiReply(system, history, userMessage, opts) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        const error = new Error("OPENAI_API_KEY is not set.");
        error.status = 503;
        throw error;
    }
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const maxTokens = (opts && opts.maxTokens) || 420;
    const temperature = (opts && opts.temperature) != null ? opts.temperature : 0.86;
    const messages = [{ role: "system", content: system }]
        .concat(history)
        .concat([{ role: "user", content: userMessage }]);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: "Bearer " + key,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature
        })
    });
    if (!res.ok) {
        let detail = "";
        try {
            detail = (await res.text()).slice(0, 300);
        } catch (err) { /* ignore */ }
        const error = new Error(detail || "OpenAI request failed.");
        error.status = 502;
        if (/insufficient_quota|credit_balance_exhausted/i.test(detail)) {
            error.status = 402;
            error.message = "OpenAI billing has no credits left. Add credits at platform.openai.com, then try again.";
        }
        throw error;
    }
    const data = await res.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text || !String(text).trim()) {
        const error = new Error("Empty reply from model.");
        error.status = 502;
        throw error;
    }
    return String(text).trim();
}

async function rememberTurn(campaignId, npc, userMessage, assistantReply, priorOpinion, playMs) {
    if (!userMessage || !assistantReply) return null;
    try {
        const title = npcTitle(npc);
        const extracted = await extractTurnMemory(userMessage, assistantReply, title, priorOpinion);
        const hasFacts =
            (extracted.worldPublic && extracted.worldPublic.length) ||
            (extracted.worldSpread && extracted.worldSpread.length) ||
            (extracted.npc && extracted.npc.length);
        const hasOpinion = !!extracted.opinionOfPlayer;
        if (!hasFacts && !hasOpinion) return null;
        return appendCanon(
            campaignId,
            npc,
            extracted.worldPublic,
            extracted.worldSpread,
            extracted.npc,
            extracted.opinionOfPlayer || priorOpinion,
            playMs
        );
    } catch (err) {
        console.error("npc canon extract", err);
        return null;
    }
}

async function tellStory(campaignId, npc, mood, history, canon, playMs) {
    const title = npcTitle(npc);
    const system =
        buildSystem(npc, canon) +
        "\n" +
        buildTerrainHintForStories() +
        storyInstructions(mood, title);
    const userMessage = storyUserMessage(mood);
    const reply = await openAiReply(system, history, userMessage, {
        maxTokens: 720,
        temperature: 0.92
    });
    const lore = await extractStoryLore(reply, title, mood);
    const canonUpdate = await appendStory(campaignId, npc, mood, reply, lore, playMs);
    return { reply, canonUpdate, storyTitle: lore.title };
}

module.exports = async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    try {
        const campaignId = await currentCampaignId();
        const playMs = await currentPlayMs();
        if (req.method === "GET") {
            const configured = Boolean(process.env.OPENAI_API_KEY);
            let canon = { world: 0, npc: {}, opinion: {}, stories: 0 };
            const worldRow = await readWorldRecord(campaignId);
            const gossipPending = (worldRow.gossip || []).filter(
                (row) => Number(row.spreadPlayMs) > playMs
            ).length;
            canon.stories = (worldRow.stories || []).length;
            const ids = listNpcs();
            if (ids.length) {
                const loaded = await loadCanon(campaignId, ids[0], playMs);
                canon.world = loaded.world.length;
                for (const id of ids) {
                    const row = await loadCanon(campaignId, id, playMs);
                    canon.npc[id] = row.npc.length;
                    canon.opinion[id] = row.opinionOfPlayer || null;
                }
            }
            const tales = (worldRow.stories || []).map((t) => ({
                id: t.id,
                npc: t.npc,
                mood: t.mood,
                title: t.title,
                summary: t.summary,
                places: t.places || [],
                toldAtPlayMs: t.toldAtPlayMs,
                hasText: !!(t.text && t.text.length)
            }));
            res.status(200).json({
                configured,
                model: configured ? (process.env.OPENAI_MODEL || "gpt-4o-mini") : null,
                npcs: listNpcs(),
                loreRoot: region1Config.loreRoot,
                campaignId,
                playMs,
                gossipDelayMs: GOSSIP_DELAY_MS,
                gossipPending,
                storyMoods: ["scary", "mysterious", "own"],
                memory: "Per campaign: facts, gossip, tales (full text in world.json for designer review), NPC opinion.",
                tales,
                talesFile: "data/campaigns/<campaignId>/world.json → stories[]",
                canon
            });
            return;
        }
        if (req.method !== "POST") {
            res.status(405).json({ error: "Use GET or POST" });
            return;
        }
        const npc = String(req.body && req.body.npc || "").trim();
        const opening = !!(req.body && req.body.opening);
        const storyMood = normalizeMood(req.body && req.body.storyMood);
        let message = String(req.body && req.body.message || "").trim().slice(0, 800);
        if (!npc || !listNpcs().includes(npc)) {
            res.status(400).json({ error: "Unknown NPC." });
            return;
        }
        if (opening) message = OPENING_USER;
        if (!opening && !storyMood && !message) {
            res.status(400).json({ error: "Message is required." });
            return;
        }
        let canon = await loadCanon(campaignId, npc, playMs);
        if (!canon.opinionOfPlayer && !opening && !storyMood) {
            canon = {
                ...canon,
                opinionOfPlayer: defaultOpinionFor(npcTitle(npc))
            };
        }
        const history = opening ? [] : cleanHistory(req.body && req.body.history);

        if (storyMood) {
            const storyResult = await tellStory(campaignId, npc, storyMood, history, canon, playMs);
            res.status(200).json({
                reply: storyResult.reply,
                npc,
                title: npcTitle(npc),
                story: true,
                storyMood,
                storyTitle: storyResult.storyTitle,
                campaignId,
                canonAdded: storyResult.canonUpdate ? {
                    story: true,
                    title: storyResult.storyTitle,
                    facts: storyResult.canonUpdate.added || 0,
                    places: (storyResult.canonUpdate.story && storyResult.canonUpdate.story.places) || []
                } : null
            });
            return;
        }

        const system = buildSystem(npc, canon);
        const reply = await openAiReply(system, history, message);
        let canonUpdate = null;
        if (!opening) {
            canonUpdate = await rememberTurn(
                campaignId,
                npc,
                message,
                reply,
                canon.opinionOfPlayer,
                playMs
            );
        }
        res.status(200).json({
            reply,
            npc,
            title: npcTitle(npc),
            opening,
            campaignId,
            opinionOfPlayer: (canonUpdate && canonUpdate.opinionOfPlayer) || canon.opinionOfPlayer || null,
            canonAdded: canonUpdate ? {
                world: (canonUpdate.world || []).length,
                npc: (canonUpdate.npc || []).length,
                opinionUpdated: !!canonUpdate.opinionOfPlayer
            } : null
        });
    } catch (error) {
        console.error("npc-chat", error);
        const msg = error.status === 503
            ? "AI chat is not configured on the server."
            : error.status === 402
                ? error.message
                : "Could not get a reply.";
        res.status(error.status || 500).json({
            error: msg,
            detail: error.status === 502 && error.message ? error.message.slice(0, 200) : undefined
        });
    }
};
