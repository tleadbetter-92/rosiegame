# Campaign tales — designer notes (you)

When players ask NPCs for **stories** in AI chat, the game saves each tale in **this campaign’s** memory:

- **File (local):** `data/campaigns/<restartedAt>/world.json` → `stories[]`
- **Mongo (live):** `npcCanon` world doc → `stories[]`

Each entry includes:

| Field | Use |
|--------|-----|
| `title`, `summary` | Quick scan for quest ideas |
| `text` | Full spoken story (review, edit, promote to git bible) |
| `places[]` | AI-suggested locations (`kind`: cave, woods, ruin, …; `direction` from town) — **hints for map pins or quests, not auto-placed** |
| `npc`, `mood`, `toldAtPlayMs` | Who told it and when in play time |

**API:** `GET /api/npc-chat` lists `tales` (metadata); open `world.json` for full `text`.

## Your workflow

1. Play and collect tales you like.
2. Read `stories[]` — pick ones to turn into **quests**, **map markers**, or **ESTABLISHED** markdown in this bible.
3. Invented caves/woods in stories are **campaign-true** for that save; promoting to git bible makes them shared seed lore for all campaigns.

The AI sees a **terrain sketch** (towns, hamlets, brute ring, goblin camp) but is **not limited** to it — it may invent geography; you decide what goes on the real map.
