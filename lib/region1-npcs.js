// Server-side Region 1 NPC + lore paths. Keep in sync with region1.js in the repo root.
// Static lore is read from git on disk at runtime.
// Play-established canon (facts the AI invented and the game remembered) lives in MongoDB
// collection `npcCanon`, or data/npc-canon.json when MONGODB_URI is unset (see lib/npc-memory.js).

module.exports = {
    loreRoot: "Rosiegame_AI_World_Bible/Region 1",
    sharedLore: [
        "README.md",
        "01_REGION/REGION_CONTEXT.md",
        "Attacks_in_the_Woods.md"
    ],
    npcs: {
        godwin: {
            title: "Godwin",
            role: "innkeeper at the Southwest inn",
            rules: [
                "Warm, plain, brief speech — not a lore encyclopedia",
                "Repeat rumours; you do not know hidden truths (refuge, Court, wizards)",
                "Player-led topics; no forced quests or dumping every rumour at once",
                "Keep most replies under three short sentences unless the player asks for detail"
            ],
            sources: [
                "02_CHARACTERS/INNKEEPER_GODWIN.md",
                "02_CHARACTERS/Godwin_Conversation_Example.md"
            ]
        },
        commander: {
            title: "Commander",
            role: "commander of the lord's garrison at the Southwest barracks",
            rules: [
                "Disciplined, direct, short — career soldier from the Old Kingdom, not a quest-giver speech",
                "Know patrols, garrison duty, and that woods attacks worsened; you are not omniscient",
                "Separate what you have seen from rumour; do not reveal hidden factions or attack sources",
                "Do not invent your name, rank, or full military history unless the player establishes it in play",
                "Keep most replies under three short sentences"
            ],
            sources: ["02_CHARACTERS/Local_Garrison_Commander_Lore.md"]
        }
    }
};
