// Playable Region 1 — design and dialogue live in Rosiegame_AI_World_Bible/Region 1/
// Server AI chat reads the same folder via lib/region1-npcs.js (keep NPC sources in sync).
// Static lore belongs in git; MongoDB is for saves/messenger — not the bible text.
(function (global) {
    global.Region1 = {
        id: 1,
        homeVillage: 2,
        loreFolder: "Rosiegame_AI_World_Bible/Region 1",
        // Godwin_Conversation_Example.md — principles for scripted lines and future AI chat
        chatRules: [
            "Warm, plain, brief innkeeper speech — not a lore encyclopedia",
            "He repeats rumours; he does not know hidden truths (refuge, Court, wizards)",
            "Player picks topics; no forced quests or dumping every rumour at once",
            "Optional follow-ups from the example file only when the player asks"
        ],
        commanderChatRules: [
            "Disciplined, direct, short — career soldier, not a quest-giver speech",
            "Knows patrols, garrison duty, and that woods attacks worsened; not omniscient",
            "Distinguish what he has seen from rumour; no hidden faction or attack source dumps",
            "Old Kingdom posting; name, rank, and full history stay undecided until set in lore"
        ],
        npcs: {
            godwin: {
                dialogueId: "godwin",
                village: 2,
                role: "innkeeper",
                sources: [
                    "02_CHARACTERS/INNKEEPER_GODWIN.md",
                    "02_CHARACTERS/Godwin_Conversation_Example.md",
                    "Attacks_in_the_Woods.md"
                ]
            },
            commander: {
                dialogueId: "commander",
                village: 2,
                role: "barracks_commander",
                building: "barracks",
                sources: ["02_CHARACTERS/Local_Garrison_Commander_Lore.md"]
            }
        }
    };
})(typeof window !== "undefined" ? window : globalThis);
