const fs = require("fs");
const path = require("path");

const TURN_MS = 10 * 60 * 1000;
const file = path.join(__dirname, "..", "data", "campaign.json");

const factions = [
    { id: "northwest", name: "Northwest", color: "#c45c3a" },
    { id: "northeast", name: "Northeast", color: "#3d6b8a" },
    { id: "southwest", name: "Southwest", color: "#6a7a3a" },
    { id: "southeast", name: "Southeast", color: "#8a5a7a" }
];

function readState() {
    try {
        const saved = JSON.parse(fs.readFileSync(file, "utf8"));
        if (saved && Number.isFinite(saved.startedAt)) {
            return {
                startedAt: saved.startedAt,
                pausedAt: Number.isFinite(saved.pausedAt) ? saved.pausedAt : null,
                health: saved.health && typeof saved.health === "object" ? saved.health : {}
            };
        }
    } catch {
        /* first run */
    }
    const state = { startedAt: Date.now(), pausedAt: null, health: {} };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state));
    return state;
}

function writeState(state) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state));
}

const MAX_HP = 3;

function campaignState(now, saved) {
    const state = saved || readState();
    const paused = Number.isFinite(state.pausedAt);
    const clock = paused ? state.pausedAt : now;
    const elapsed = Math.max(0, clock - state.startedAt);
    const turn = Math.floor(elapsed / TURN_MS);
    const nextIn = TURN_MS - (elapsed % TURN_MS);
    return {
        turn,
        paused,
        turnMs: TURN_MS,
        nextTurnAt: paused ? null : now + nextIn,
        maxHealth: MAX_HP,
        factions: factions.map((faction, index) => {
            const units = [];
            let alive = 0;
            for (let i = 0; i < turn; i++) {
                const stored = state.health[index + ":" + i];
                const health = stored == null ? MAX_HP : stored;
                if (health > 0) alive += 1;
                units.push({ index: i, health });
            }
            return {
                id: faction.id,
                name: faction.name,
                color: faction.color,
                village: index,
                soldiers: turn,
                alive,
                units
            };
        })
    };
}

function hit(village, index) {
    const state = readState();
    const now = Date.now();
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    const turn = Math.floor(Math.max(0, clock - state.startedAt) / TURN_MS);
    if (village >= 0 && village <= 3 && index >= 0 && index < turn) {
        const key = village + ":" + index;
        const current = state.health[key] == null ? MAX_HP : state.health[key];
        state.health[key] = Math.max(0, current - 1);
        writeState(state);
    }
    return campaignState(now, state);
}

module.exports = function handler(req, res) {
    if (req.method === "POST") {
        const village = Number(req.body && req.body.village);
        const index = Number(req.body && req.body.index);
        res.status(200).json(hit(village, index));
        return;
    }
    if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    res.status(200).json(campaignState(Date.now()));
};

module.exports.campaignState = campaignState;
module.exports.TURN_MS = TURN_MS;
