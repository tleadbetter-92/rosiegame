const Hero = require("../hero");

const BRUTE_CULL_ID = "bruteCull";
const BRUTE_KILLS_NEEDED = 3;
const BRUTE_REWARD_GOLD = 50;
const REWARD_ARMOR_ID = "southwest_padded_coat";
const REWARD_ARMOR_NAME = "Padded coat (starter armour)";

function defaultBruteCull() {
    return { phase: "idle", kills: 0, acceptedAt: 0 };
}

function ensureQuests(state) {
    if (!state.quests || typeof state.quests !== "object") state.quests = {};
    if (!state.quests.bruteCull || typeof state.quests.bruteCull !== "object") {
        state.quests.bruteCull = defaultBruteCull();
        return true;
    }
    const q = state.quests.bruteCull;
    if (!q.phase) q.phase = "idle";
    if (!Number.isFinite(q.kills)) q.kills = 0;
    return false;
}

function resetQuests(state) {
    state.quests = { bruteCull: defaultBruteCull() };
}

function present(state) {
    ensureQuests(state);
    const q = state.quests.bruteCull;
    return {
        bruteCull: {
            phase: q.phase,
            kills: q.kills,
            need: BRUTE_KILLS_NEEDED,
            rewardGold: BRUTE_REWARD_GOLD,
            rewardArmor: REWARD_ARMOR_NAME
        }
    };
}

function acceptBruteCull(state, now) {
    ensureQuests(state);
    const q = state.quests.bruteCull;
    if (q.phase === "rewarded") return { ok: false, error: "Already paid for that work." };
    if (q.phase === "active") return { ok: true, quest: q };
    q.phase = "active";
    q.kills = 0;
    q.acceptedAt = now;
    return { ok: true, quest: q };
}

function noteBruteKill(state) {
    ensureQuests(state);
    const q = state.quests.bruteCull;
    if (q.phase !== "active") return { ok: false };
    q.kills = Math.min(BRUTE_KILLS_NEEDED + 9, q.kills + 1);
    if (q.kills >= BRUTE_KILLS_NEEDED) q.phase = "ready";
    return { ok: true, quest: q };
}

function turnInBruteCull(state) {
    ensureQuests(state);
    const q = state.quests.bruteCull;
    if (q.phase === "rewarded") return { ok: false, error: "Already rewarded." };
    if (q.phase !== "ready" && !(q.phase === "active" && q.kills >= BRUTE_KILLS_NEEDED)) {
        return { ok: false, error: "You have not cleared enough brutes yet." };
    }
    state.hero = Hero.normalize(state.hero);
    state.hero.pack.gold = (state.hero.pack.gold || 0) + BRUTE_REWARD_GOLD;
    state.hero.armor = Hero.normalizeArmor({
        id: REWARD_ARMOR_ID,
        name: REWARD_ARMOR_NAME
    });
    q.phase = "rewarded";
    return { ok: true, quest: q, hero: state.hero };
}

module.exports = {
    BRUTE_CULL_ID,
    BRUTE_KILLS_NEEDED,
    ensureQuests,
    resetQuests,
    present,
    acceptBruteCull,
    noteBruteKill,
    turnInBruteCull
};
