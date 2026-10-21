// Playable Region 1 — design and dialogue live in Rosiegame_AI_World_Bible/Region 1/
// (README, 01_REGION/REGION_CONTEXT.md, 02_CHARACTERS/, Attacks_in_the_Woods.md).
// Map boundaries are not marked in the world yet; scope is Southwest town (village 2)
// and the four nearby hamlets on the campaign map until we draw borders later.
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
            }
        }
    };
})(typeof window !== "undefined" ? window : globalThis);
