const fs = require("fs");
const path = require("path");
const region1 = require("./region1-npcs");

const regionRoot = path.join(__dirname, "..", region1.loreRoot);
const bibleRoot = path.join(__dirname, "..", "Rosiegame_AI_World_Bible");

function readLore(relative) {
    try {
        const file = path.join(regionRoot, relative);
        if (!fs.existsSync(file)) return "";
        return fs.readFileSync(file, "utf8").slice(0, 14000);
    } catch {
        return "";
    }
}

function readGlobalRules() {
    try {
        const file = path.join(bibleRoot, "00_AI_RULES", "AI_WORLD_RULES.md");
        if (!fs.existsSync(file)) return "";
        return fs.readFileSync(file, "utf8").slice(0, 8000);
    } catch {
        return "";
    }
}

function readRoleplayRules() {
    try {
        const file = path.join(bibleRoot, "00_AI_RULES", "AI_NPC_ROLEPLAY.md");
        if (!fs.existsSync(file)) return "";
        return fs.readFileSync(file, "utf8").slice(0, 8000);
    } catch {
        return "";
    }
}

function formatCanonList(facts) {
    return facts.map((fact) => "- " + fact).join("\n");
}

function formatOpinion(opinion) {
    if (!opinion || typeof opinion !== "object") return "";
    const lines = [];
    if (opinion.disposition) lines.push("- Disposition toward this player: " + opinion.disposition);
    if (opinion.summary) lines.push("- Your private read on them: " + opinion.summary);
    if (Array.isArray(opinion.playerTraits) && opinion.playerTraits.length) {
        lines.push("- Labels you would use (in your head): " + opinion.playerTraits.join(", "));
    }
    return lines.length ? lines.join("\n") : "";
}

function buildSystem(npcId, canon) {
    const profile = region1.npcs[npcId];
    if (!profile) return null;
    const globalRules = readGlobalRules();
    const roleplayRules = readRoleplayRules();
    const shared = region1.sharedLore.map(readLore).filter(Boolean).join("\n\n---\n\n");
    const character = profile.sources.map(readLore).filter(Boolean).join("\n\n---\n\n");
    const personality = (profile.personality || []).map(readLore).filter(Boolean).join("\n\n---\n\n");
    const worldFacts = (canon && canon.world) || [];
    const npcFacts = (canon && canon.npc) || [];
    const opinion = canon && canon.opinionOfPlayer;
    const opinionBlock = formatOpinion(opinion);
    return [
        roleplayRules ? "NPC roleplay (this conversation):\n" + roleplayRules + "\n" : "",
        globalRules ? "World and campaign story rules:\n" + globalRules + "\n" : "",
        "You are " + profile.title + ", " + profile.role + ", in Region 1 (Southwest frontier town and nearby hamlets).",
        "Embody this person completely. Never mention being an AI, a model, prompts, policies, or game UI.",
        "The player is a traveler speaking to you face to face. Respond only as " + profile.title + ".",
        "Knowledge split: you read everything below to stay coherent and to grow this campaign’s story as they explore — but " +
            profile.title + " only *speaks* what that person would plausibly know (job, town, gossip, memory). Do not lecture from hidden lore.",
        "When you invent plausible local detail in dialogue, treat it as real for this campaign once said; the game remembers it for later visits.",
        "Character knowledge boundaries (what this person is unlikely to know or should not spill):",
        ...profile.rules.map((rule) => "- " + rule),
        personality ? "\nPersonality (how you act and feel — player-edited):\n" + personality : "",
        shared
            ? "\n[HIDDEN CONTEXT — world bible. Use for coherence; do not dump unless " + profile.title + " would know it:]\n" + shared
            : "",
        character
            ? "\n[HIDDEN CONTEXT — this NPC’s file (what they may know vs must not reveal):]\n" + character
            : "",
        opinionBlock
            ? "\n[HIDDEN — your opinion of THIS player in THIS campaign; shape tone, do not read aloud unless natural:]\n" + opinionBlock
            : "",
        worldFacts.length
            ? "\n[THIS CAMPAIGN — town gossip and events you could have heard by now (not same-day secrets from other buildings):]\n" + formatCanonList(worldFacts)
            : "",
        npcFacts.length
            ? "\n[THIS CAMPAIGN — established about you from earlier talks:]\n" + formatCanonList(npcFacts)
            : ""
    ].join("\n");
}

function listNpcs() {
    return Object.keys(region1.npcs);
}

function npcTitle(npcId) {
    const profile = region1.npcs[npcId];
    return profile ? profile.title : npcId;
}

module.exports = { buildSystem, listNpcs, npcTitle, regionRoot };
