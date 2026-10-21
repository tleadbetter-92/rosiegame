# AI Dungeon Master — DESIGN PRINCIPLES ESTABLISHED

Separate three cooperating layers:

1. **Game engine / authoritative state:** owns actual characters, locations, inventories, resources, combat, quests, factions, rules and save files.
2. **World simulation / director:** tracks faction behaviour, resources, schedules, events, relationships and consequences.
3. **AI Dungeon Master:** conducts conversations, narrates, proposes quests and adapts stories using established lore and current state.

The AI should not be the sole authority on mechanical truth.

Persist separate records for world facts; regional facts; NPC goals, relationships, secrets and knowledge; player behaviour; actual events; clues and unresolved threads; and generated material accepted as persistent canon.

A story can become fixed once it enters the world. Preserve its facts and consequences. Stories may be unrelated; some are short, some long-running, and some unresolved.

Existing game actions have included stealing, fighting, raiding, joining a battle, assassinating a target and destroying a building. The AI can interpret intent and narrate, but the game validates possibility and applies the actual result.
