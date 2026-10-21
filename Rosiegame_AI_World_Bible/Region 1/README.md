# Region and Innkeeper
Working draft for the first playable region. ESTABLISHED = agreed foundation; PROVISIONAL = may change; OPEN = undecided. Do not treat provisional details as immutable canon. Godwin is the current innkeeper name; no surname has been assigned. Naming customs and religion are intentionally not fully defined yet.

## How AI lore works (git + this campaign)
1. **World bible (git)** — Shared seed: region, factions, character sheets. The **AI reads all of it** so the world stays coherent; **NPCs in chat only speak what their character would know** (innkeeper gossip, not secret history). See `00_AI_RULES/AI_WORLD_RULES.md` and `AI_NPC_ROLEPLAY.md`.
2. **This campaign’s memory** — What became **true in this playthrough** as the player explores: facts, rumours, promises, plus each NPC’s **opinion of the player**. **Restart** = new campaign id = a different story branch. Stored under `data/campaigns/<campaignId>/` or Mongo `npcCanon`.
3. **Personality (git)** — `02_CHARACTERS/*_PERSONALITY.md` — how they act; edit anytime.

Same NPC can follow a different path in another campaign because memory and opinion are per campaign, not global.

**Gossip delay:** What you tell one NPC is remembered by them immediately. Other NPCs only get it via `world.json` **gossip** after **one in-game day** (`playMs` + 40 min real-time per day). Public scenes can still land in immediate `facts`.
