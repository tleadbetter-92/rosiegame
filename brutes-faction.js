(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.BrutesFaction = api;
})(typeof self !== "undefined" ? self : this, function () {
    const FACTION_ID = 11;
    const NAME = "The Brutes";
    const COLOR = "#8b3a2a";

    /** Wild lair — how many stand at the marked camp. */
    const LAIR_COUNT = 20;
    const LAIR_RADIUS = 52;

    /** In-world melee unit (village view). */
    const UNIT = {
        name: "Brute",
        hp: 4,
        melee: 4,
        speedGuard: 1.6,
        speedChase: 3.15,
        sight: 38,
        leash: 110,
        /** Brutes keep simulating when the player is farther than normal wilds. */
        playerWakeRadius: 420,
        attackIntervalMin: 1.25,
        attackIntervalMax: 1.75
    };

    /** Strategy map raids on Southwest (campaign). */
    const RAID = {
        targetVillage: 2,
        min: 6,
        max: 14,
        speed: 5.2,
        /** Base interval; scaled down when the lair is close to Southwest. */
        everyMs: 18 * 60 * 1000,
        rounds: 72,
        hp: 4,
        hitSoldierChance: 0.22,
        hitRaiderChance: 0.08
    };

    const LOOT = [
        { type: "gold", amount: 10 },
        { type: "weapon", id: "brute_hammer", name: "Brute hammer" }
    ];

    function raidIntervalMs(distanceToGate) {
        const dist = Math.max(80, Number(distanceToGate) || 400);
        const closeness = Math.max(0.45, Math.min(1.35, dist / 420));
        const base = RAID.everyMs;
        return Math.round(base * closeness * (0.65 + Math.random() * 0.7));
    }

    return {
        FACTION_ID,
        NAME,
        COLOR,
        LAIR_COUNT,
        LAIR_RADIUS,
        UNIT,
        RAID,
        LOOT,
        raidIntervalMs
    };
});
