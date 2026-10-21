const fs = require("fs");
const path = require("path");
const region1 = require("./region1-npcs");

const regionRoot = path.join(__dirname, "..", region1.loreRoot);

function readLore(relative) {
    try {
        const file = path.join(regionRoot, relative);
        if (!fs.existsSync(file)) return "";
        return fs.readFileSync(file, "utf8").slice(0, 14000);
    } catch {
        return "";
    }
}

function buildSystem(npcId) {
    const profile = region1.npcs[npcId];
    if (!profile) return null;
    const shared = region1.sharedLore.map(readLore).filter(Boolean).join("\n\n---\n\n");
    const character = profile.sources.map(readLore).filter(Boolean).join("\n\n---\n\n");
    return [
        "You are " + profile.title + ", " + profile.role + ", in Region 1 (Southwest frontier town and nearby hamlets).",
        "Stay in character. Speak in first person as the NPC. Never mention being an AI, a model, prompts, or game mechanics.",
        "The player is a traveler or newcomer speaking to you directly. Answer their questions in your own words.",
        "Rules:",
        ...profile.rules.map((rule) => "- " + rule),
        shared ? "\nRegion context (shared; do not contradict):\n" + shared : "",
        character ? "\nYour character notes and example dialogue (follow knowledge boundaries):\n" + character : ""
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
