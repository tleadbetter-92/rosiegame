const fs = require("fs");
const path = require("path");
const { getDb } = require("../lib/db");
const World = require("../world");
const Town = require("../town");
const Clock = require("../clock");
const Hero = require("../hero");

const TURN_MS = 10 * 60 * 1000;
const BATTLE_MS = 2000;
const MARCH_SPEED = 4.5;
// Soldiers each faction starts with; after that only houses (popLimit) limit growth.
const CAP = 10;
const FIELD = CAP;
const file = path.join(__dirname, "..", "data", "campaign.json");

const factions = [
    { id: "northwest", name: "Northwest", color: "#c45c3a" },
    { id: "northeast", name: "Northeast", color: "#3d6b8a" },
    { id: "southwest", name: "Southwest", color: "#6a7a3a" },
    { id: "southeast", name: "Southeast", color: "#8a5a7a" }
];

// Rural communities: minor factions numbered from MINOR_BASE. They farm, keep no soldiers, and seek a protector.
const minors = [
    { name: "Ashby", color: "#b0883a" },
    { name: "Fernlow", color: "#7a9a4a", ally: 2 },
    { name: "Brackwick", color: "#9a7a4a", ally: 2 },
    { name: "Stoneacre", color: "#8a8a7a", ally: 2 },
    { name: "Hollins", color: "#6a8a6a", ally: 2 },
    { name: "Redmere", color: "#a0624a", ally: 2 },
    { name: "Westerby", color: "#7a6a9a", ally: 2 }
].map((minor, index) => Object.assign({}, World.hamlets[index], minor));
const MINOR_BASE = factions.length;
const FOLK_PER_HOUSE = 2;
// A hamlet's lord yields once enemy soldiers have stood in its farmhouse this long (real time, not game time).
const HOLD_MS = 10 * 60 * 1000;
const HOLD_PARTY = 2;
const HOLD_SPARE = 4;
const TRIBUTE_SHARE = 0.1;
const STORES = ["food", "wood", "stone", "gold"];

// The farm, five-house template and mine factions build, converted from Roblox models by tools/roblox-farm.js and tools/roblox-model.js.
// Without the files, farms and houses use the plain layouts and no mines are built.
// Each is required by its literal path so the hosted build bundles the file.
function robloxModel(load) {
    try {
        return load();
    } catch (err) {
        return null;
    }
}
const farmModel = robloxModel(() => require("../models/roblox/farm.json"));
const housesModel = robloxModel(() => require("../models/roblox/houses.json"));
const mineModel = robloxModel(() => require("../models/roblox/mine.json"));
const yardModel = robloxModel(() => require("../models/roblox/lumberyard.json"));

// How far up a hamlet's first farm's ground may be filled to make it level (kept so existing hamlets stay put).
const PAD_RISE = 6;
// Any other building fills as high as it needs; past this the bank would run beyond the reach of World.heightAt.
const FILL_MAX = 25;
// A new building stands within BUILD_REACH of its village and within BUILD_STEP of one of the village's buildings,
// so every building pushes the edge of where the next can go.
const BUILD_REACH = 500;
const BUILD_STEP = 200;

const places = World.places;

const MAX_HP = 3;
const FISHER_HP = 1;
const POP_BASE = 50;
// Houses mass about this many men before marching, unless the target is weak enough to take with fewer.
const MUSTER = 40;
const RAID_MIN = 12;
const HOUSE_POP = 2;
// A house build with the Roblox template puts up five houses at once.
const HOUSES_POP = 10;
const RECRUIT_MS = 5 * 60 * 1000;
const FISHER_COST = 50;
const SOLDIER_COST = 100;
const BUILD_WOOD = 100;
const MINE_WOOD = 100;
// Two minutes for now so building can be watched in play; was 2 * Clock.DAY_MS.
const BUILD_MS = 2 * 60 * 1000;
const fisherAim = [2, 4, 3, 3];
const FISH_MS = 30000;
const FISH_WALK = 2.2;
const FISH_FOOD = 10;
const FAR_MS = 3 * 60 * 1000;
const MANOR_CAP = 10;
const CART_LOAD = 100;
const CART_HP = 10;
const DRIVER_HP = 3;
const URGENT_FOOD = 50;
const WOOD_MS = 30000;
const WOOD_YIELD = 10;
// Miners walk from the store to the nearest ore placed on the map and bring back stone and gold, like woodcutters with wood.
const ORE_MS = 30000;
const ORE_STONE = 10;
const ORE_GOLD = 10;
const MINERS_PER_MINE = 2;
const REPAIR_MS = 30000;
const REPAIR_CHUNK = 10;
const FARM_PER_DAY = 18;
const FARM_RETRY_MS = Math.round(Clock.DAY_MS / 144);
const FARM_WOOD = BUILD_WOOD;
const FARM_CAP = 8;
// One more woodcutter for every this many people, so wood keeps up with the building.
const WOOD_PER_POP = 25;
const YARD_AT = { x: -2000, z: 478 };
const YARD_OWNER = 2;
const YARD_VILLAGE = 2;
const JACK_MS = 45000;
const storePlan = { x: -12, z: -16, w: 8, d: 5.5 };
const GATE_HP = 50;
const PLAYER_FACTION = 2;
// Goblin raids on Southwest from the den marked by the sphere on the editor map; move GOBLIN_DEN to change where they come from.
const GOBLIN_DEN = { x: -2861, z: 255 };
const GOBLIN_VILLAGE = 2;
const GOBLIN_SPEED = 6;
const GOBLIN_MIN = 7;
const GOBLIN_MAX = 14;
const GOBLIN_EVERY = Clock.DAY_MS / 2;
const GOBLIN_ROUNDS = 60;
// The goblin camp in the ring of cones on the editor map: WILD_START goblins when the campaign starts, WILD_DAILY more each day,
// and once there are WILD_MAX they all run at Southwest together; the camp then starts again from WILD_AFTER.
const WILD_MAX = 50;
const WILD_START = 45;
const WILD_DAILY = 5;
const WILD_AFTER = 20;
const START_WOOD = 200;
const WALL_HALF = 17;
const WALL_CX = -0.5;
const WALL_CZ = -4;

function palisadeBox(village) {
    const place = places[village];
    const cx = place.x + WALL_CX;
    const cz = place.z + WALL_CZ;
    return {
        cx,
        cz,
        minX: cx - WALL_HALF,
        maxX: cx + WALL_HALF,
        minZ: cz - WALL_HALF,
        maxZ: cz + WALL_HALF
    };
}

function gateSpot(village, side, out) {
    const box = palisadeBox(village);
    const nudge = out == null ? 1.6 : out;
    if (side === 0) return { x: box.cx, z: box.minZ - nudge };
    if (side === 1) return { x: box.maxX + nudge, z: box.cz };
    if (side === 2) return { x: box.cx, z: box.maxZ + nudge };
    return { x: box.minX - nudge, z: box.cz };
}

function sideFacing(village, point) {
    const box = palisadeBox(village);
    const dx = point.x - box.cx;
    const dz = point.z - box.cz;
    if (Math.abs(dx) > Math.abs(dz)) return dx >= 0 ? 1 : 3;
    return dz >= 0 ? 2 : 0;
}

function exitSide(village, from, to) {
    const box = palisadeBox(village);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    let best = Infinity;
    let side = 0;
    const consider = (next, time) => {
        if (time > 0.001 && time < best) {
            best = time;
            side = next;
        }
    };
    if (dx > 0) consider(1, (box.maxX - from.x) / dx);
    if (dx < 0) consider(3, (box.minX - from.x) / dx);
    if (dz > 0) consider(2, (box.maxZ - from.z) / dz);
    if (dz < 0) consider(0, (box.minZ - from.z) / dz);
    return side;
}

function freshGates() {
    return [0, 1, 2, 3].map(() => [GATE_HP, GATE_HP, GATE_HP, GATE_HP]);
}

function freshArchers() {
    return [0, 1, 2, 3].map(() => [MAX_HP, MAX_HP, MAX_HP, MAX_HP]);
}

function ensureArchers(state) {
    if (!Array.isArray(state.archers) || state.archers.length !== 4) {
        state.archers = freshArchers();
        return true;
    }
    let dirty = false;
    for (let village = 0; village < 4; village++) {
        const row = state.archers[village];
        if (!Array.isArray(row) || row.length !== 4) {
            state.archers[village] = [MAX_HP, MAX_HP, MAX_HP, MAX_HP];
            dirty = true;
        }
    }
    return dirty;
}

function ensureGates(state) {
    if (!Array.isArray(state.gates) || state.gates.length !== 4) {
        state.gates = freshGates();
        return true;
    }
    let dirty = false;
    for (let village = 0; village < 4; village++) {
        const row = state.gates[village];
        if (!Array.isArray(row) || row.length !== 4) {
            state.gates[village] = [GATE_HP, GATE_HP, GATE_HP, GATE_HP];
            dirty = true;
        }
    }
    return dirty;
}

function readFileState() {
    try {
        const saved = JSON.parse(fs.readFileSync(file, "utf8"));
        if (saved && Number.isFinite(saved.startedAt)) return saved;
    } catch {
        /* first run, or the host has no saved file */
    }
    const state = { startedAt: Date.now(), pausedAt: null, health: {} };
    writeFileState(state);
    return state;
}

function writeFileState(state) {
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(state));
    } catch (error) {
        console.error(error);
    }
}

function hosted() {
    return Boolean(process.env.VERCEL && process.env.MONGODB_URI);
}

function blankState() {
    const now = Date.now();
    const state = { startedAt: now, pausedAt: null, health: {} };
    restartCampaign(state, now);
    return state;
}

async function readState() {
    if (!hosted()) return readFileState();
    const db = await getDb();
    const doc = await db.collection("campaign").findOne({ _id: "world" });
    if (doc && doc.state && Number.isFinite(doc.state.startedAt)) return doc.state;
    const state = blankState();
    await writeState(state);
    return state;
}

async function writeState(state) {
    if (!hosted()) {
        writeFileState(state);
        return;
    }
    const db = await getDb();
    const clean = JSON.parse(JSON.stringify(state));
    await db.collection("campaign").updateOne(
        { _id: "world" },
        { $set: { state: clean } },
        { upsert: true }
    );
}

function turnOf(state, clock) {
    return Math.floor(Math.max(0, clock - state.startedAt) / TURN_MS);
}

function keyOf(faction, index) {
    return faction + ":" + index;
}

function healthOf(state, faction, index) {
    const stored = state.health[keyOf(faction, index)];
    return stored == null ? MAX_HP : stored;
}

function ownedBy(state, faction) {
    const list = [];
    for (let village = 0; village < 4; village++) {
        if (state.owners[village] === faction) list.push(village);
    }
    return list;
}

function note(state, text) {
    state.log.push(text);
    if (state.log.length > 8) state.log = state.log.slice(-8);
}

function nameOf(faction) {
    return faction < MINOR_BASE ? factions[faction].name : minors[faction - MINOR_BASE].name;
}

function pairKey(a, b) {
    return Math.min(a, b) + "-" + Math.max(a, b);
}

function relation(state, a, b) {
    if (a === b) return "ally";
    const set = state.relations && state.relations[pairKey(a, b)];
    if (set) return set;
    return a < MINOR_BASE && b < MINOR_BASE ? "war" : "peace";
}

function atWar(state, a, b) {
    return a !== b && relation(state, a, b) === "war";
}

function setRelation(state, a, b, kind) {
    if (a === b || relation(state, a, b) === kind) return false;
    if (!state.relations) state.relations = {};
    state.relations[pairKey(a, b)] = kind;
    if (kind === "war") note(state, nameOf(a) + " declares war on " + nameOf(b) + ".");
    else if (kind === "peace") note(state, nameOf(a) + " and " + nameOf(b) + " make peace.");
    else note(state, nameOf(a) + " and " + nameOf(b) + " become allies.");
    return true;
}

function hamletOwner(state, index) {
    const held = state.minors && state.minors[index] && state.minors[index].owner;
    return Number.isInteger(held) && held >= 0 ? held : MINOR_BASE + index;
}

function farmOwner(state, village) {
    return village < MINOR_BASE ? state.owners[village] : hamletOwner(state, village - MINOR_BASE);
}

function eachLiving(state, faction, visit) {
    const total = state.nextIndex[faction] || 0;
    for (let index = 0; index < total; index++) {
        const health = healthOf(state, faction, index);
        if (health > 0) visit(index, health);
    }
}

function busyIndexes(state, faction) {
    const busy = new Set();
    for (const attack of state.attacks) {
        if (attack.resolved || attack.faction !== faction) continue;
        attack.indexes.forEach((index) => busy.add(index));
    }
    for (const hold of state.holds || []) {
        if (hold.faction === faction) hold.indexes.forEach((index) => busy.add(index));
    }
    return busy;
}

function posted(state, faction, village, skip) {
    const list = [];
    eachLiving(state, faction, (index, health) => {
        if (skip && skip.has(index)) return;
        if (state.post[keyOf(faction, index)] !== village) return;
        list.push({ index, health });
    });
    return list;
}

function fielded(state, faction, village) {
    return posted(state, faction, village, busyIndexes(state, faction)).slice(0, 80);
}

function seedSoldiers(state) {
    state.health = {};
    state.post = {};
    state.nextIndex = [0, 0, 0, 0];
    for (let faction = 0; faction < 4; faction++) {
        for (let index = 0; index < CAP; index++) {
            state.health[keyOf(faction, index)] = MAX_HP;
            state.post[keyOf(faction, index)] = faction;
        }
        state.nextIndex[faction] = CAP;
    }
    state.armyCap = CAP;
}

function restartCampaign(state, now) {
    state.owners = [0, 1, 2, 3];
    state.food = [100, 100, 100, 100];
    state.wood = [START_WOOD, START_WOOD, START_WOOD, START_WOOD];
    state.stone = [0, 0, 0, 0];
    state.gold = [0, 0, 0, 0];
    seedSoldiers(state);
    state.attacks = [];
    state.training = [];
    state.fishermen = [];
    state.woodcutters = [];
    state.gates = freshGates();
    state.archers = freshArchers();
    state.restartedAt = now;
    state.log = ["Each village starts with ten soldiers and two farmers."];
    state.marchAfter = now + RECRUIT_MS;
    state.farms = [];
    state.farmPlay = null;
    state.farmJobs = [];
    state.builtFarms = [];
    state.farmSerial = 0;
    state.yard = null;
    state.yards = [];
    state.houses = [];
    state.mines = [];
    state.siteJobs = [];
    state.fedDay = [-1, -1, -1, -1];
    state.hamlet = 1;
    state.minors = [];
    state.relations = {};
    state.trails = [];
    state.holds = [];
    state.tributes = [];
    state.grudges = [];
    state.goblins = { nextAt: nextGoblinRaid(now), raid: null };
    state.wilds = null;
}

function freshMinors() {
    return minors.map(() => ({ food: 100, wood: START_WOOD, stone: 0, gold: 0, owner: -1, protector: -1, declined: [], fedDay: -1, tributeDay: -1 }));
}

function ensureHamlet(state, now) {
    if (state.hamlet === 1) return false;
    const startedAt = state.startedAt;
    const playMs = state.playMs;
    const pausedAt = state.pausedAt;
    const hero = state.hero;
    restartCampaign(state, now);
    state.startedAt = startedAt;
    state.playMs = playMs;
    state.pausedAt = pausedAt;
    state.hero = hero;
    state.restartedAt = state.restartedAt || now;
    return true;
}

function ensure(state, turn) {
    if (Array.isArray(state.owners) && Array.isArray(state.nextIndex) && state.post) return false;
    state.health = state.health && typeof state.health === "object" ? state.health : {};
    state.owners = [0, 1, 2, 3];
    state.nextIndex = [turn, turn, turn, turn];
    state.settledTurn = turn;
    state.attacks = [];
    state.log = [];
    state.post = {};
    for (let faction = 0; faction < 4; faction++) {
        for (let index = 0; index < turn; index++) {
            if (healthOf(state, faction, index) > 0) state.post[keyOf(faction, index)] = faction;
        }
    }
    return true;
}

function leastCrowded(state, faction) {
    const owned = ownedBy(state, faction);
    if (!owned.length) return -1;
    const order = owned.includes(faction) ? [faction].concat(owned.filter((village) => village !== faction)) : owned;
    let best = order[0];
    let bestCount = Infinity;
    for (const village of order) {
        const count = posted(state, faction, village).length;
        if (count < bestCount) {
            best = village;
            bestCount = count;
        }
    }
    return best;
}

function livingCount(state, faction) {
    let count = 0;
    eachLiving(state, faction, () => { count += 1; });
    return count;
}

function capArmies(state) {
    if (state.armyCap === CAP) return false;
    if (state.attacks && state.attacks.some((attack) => !attack.resolved)) return false;
    const health = {};
    const post = {};
    const nextIndex = [0, 0, 0, 0];
    for (let faction = 0; faction < 4; faction++) {
        const kept = [];
        eachLiving(state, faction, (index, hp) => {
            if (kept.length >= CAP) return;
            const village = state.post[keyOf(faction, index)];
            kept.push({ health: hp, post: village });
        });
        kept.forEach((unit, index) => {
            health[keyOf(faction, index)] = unit.health;
            const village = Number.isInteger(unit.post) && state.owners[unit.post] === faction ? unit.post : faction;
            post[keyOf(faction, index)] = village;
            nextIndex[faction] = index + 1;
        });
    }
    state.health = health;
    state.post = post;
    state.nextIndex = nextIndex;
    state.armyCap = CAP;
    return true;
}

function recruit(state, faction) {
    if (factionPop(state, faction) >= popLimit(state, faction)) return;
    const village = leastCrowded(state, faction);
    if (village < 0) return;
    const index = state.nextIndex[faction]++;
    state.health[keyOf(faction, index)] = MAX_HP;
    state.post[keyOf(faction, index)] = village;
    note(state, factions[faction].name + " recruits one soldier.");
}

function roadPoints(from, to) {
    const asPoint = (spot) => ({ x: spot[0], z: spot[1] });
    const direct = World.trackOf(from, to);
    if (direct.length) return direct.map(asPoint);
    for (const mid of World.links[from]) {
        if (!World.links[mid].includes(to)) continue;
        return World.trackOf(from, mid).map(asPoint)
            .concat([{ x: places[mid].x, z: places[mid].z }])
            .concat(World.trackOf(mid, to).map(asPoint));
    }
    return [];
}

function marchPath(from, to) {
    const start = places[from];
    const end = places[to];
    const mid = roadPoints(from, to);
    const next = mid[0] || end;
    const prev = mid.length ? mid[mid.length - 1] : start;
    const outSide = sideFacing(from, next);
    const gateSide = sideFacing(to, prev);
    const points = [start, gateSpot(from, outSide), ...mid, gateSpot(to, gateSide), end];
    return { points, gateSide, gateIndex: points.length - 2 };
}

function pathDist(points, index) {
    let length = 0;
    const last = Math.min(index, points.length - 1);
    for (let i = 1; i <= last; i++) {
        length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    }
    return length;
}

function pathLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    }
    return length;
}

function strongest(state, faction) {
    let best = -1;
    let bestCount = 0;
    for (const village of ownedBy(state, faction)) {
        const count = fielded(state, faction, village).length;
        if (count > bestCount) {
            best = village;
            bestCount = count;
        }
    }
    return best;
}

function attackTarget(state, from, faction, turn) {
    const enemies = [];
    for (let village = 0; village < 4; village++) {
        if (!atWar(state, faction, state.owners[village])) continue;
        if (state.attacks.some((attack) => !attack.resolved && attack.to === village)) continue;
        enemies.push({ village, neighbor: World.links[from].includes(village) });
    }
    const neighbors = enemies.filter((enemy) => enemy.neighbor);
    const pool = neighbors.length ? neighbors : enemies;
    if (!pool.length) return -1;
    return pool[(turn + faction) % pool.length].village;
}

function maybeAttack(state, faction, turn, now) {
    if (state.attacks.some((attack) => !attack.resolved && attack.faction === faction)) return false;
    const from = strongest(state, faction);
    if (from < 0) return;
    const company = fielded(state, faction, from);
    if (company.length < 6) return;
    const stay = Math.ceil(company.length * 0.1);
    const marching = company.slice(0, company.length - stay);
    if (!marching.length) return;
    const to = attackTarget(state, from, faction, turn);
    if (to < 0 || to === from) return;
    const defender = state.owners[to];
    const defenders = fielded(state, defender, to);
    const weak = !defenders.length || (marching.length >= RAID_MIN && marching.length >= defenders.length * 3);
    if (company.length < MUSTER && !weak) return;
    const route = marchPath(from, to);
    const gateHp = (state.gates[to] && state.gates[to][route.gateSide]) || 0;
    if (!defenders.length && gateHp <= 0) {
        state.owners[to] = faction;
        note(state, factions[faction].name + " occupies " + factions[to].name + ".");
        return true;
    }
    const points = route.points;
    const length = pathLength(points);
    const gateDist = pathDist(points, route.gateIndex);
    const remainMs = Math.round(((length - gateDist) / MARCH_SPEED) * 1000);
    state.attacks.push({
        id: turn + "-" + faction,
        from,
        to,
        faction,
        defender,
        indexes: marching.map((unit) => unit.index),
        defenders: defenders.map((unit) => unit.index),
        path: points,
        length,
        gateSide: route.gateSide,
        gateDist,
        gateAt: now + Math.round((gateDist / MARCH_SPEED) * 1000),
        remainMs,
        startedAt: now,
        arriveAt: now + Math.round((length / MARCH_SPEED) * 1000),
        ticks: 0,
        resolved: false
    });
    note(state, factions[faction].name + " marches on " + factions[to].name + ".");
    return true;
}

function storeExit(village) {
    const place = places[village];
    const x = place.x + storePlan.x;
    const z = place.z + storePlan.z;
    const midX = x + storePlan.w / 2;
    if (village === 2) return { x: midX, z: z + storePlan.d + 1.05 };
    return { x: midX, z: z - 1.05 };
}

function houseRects(village) {
    const place = places[village];
    const plan = [
        [-10, 3, 6, 5],
        [4, 3, 6, 5],
        [-11, -5.2, 6, 5],
        [5, -5.2, 5.5, 5],
        [-12, -16, 8, 5.5],
        [4, -16, 7, 5.5]
    ];
    return plan.map((house) => ({
        x: place.x + house[0],
        z: place.z + house[1],
        w: house[2],
        d: house[3]
    }));
}

function segmentHitsRect(ax, az, bx, bz, rect) {
    const pad = 0.35;
    const x0 = rect.x - pad;
    const z0 = rect.z - pad;
    const x1 = rect.x + rect.w + pad;
    const z1 = rect.z + rect.d + pad;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.35));
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        if (x > x0 && x < x1 && z > z0 && z < z1) return true;
    }
    return false;
}

function hitsHouse(a, b, rects) {
    return rects.some((rect) => segmentHitsRect(a.x, a.z, b.x, b.z, rect));
}

function gateMouth(village, side) {
    const box = palisadeBox(village);
    const inset = 2.4;
    if (side === 0) return { x: box.cx, z: box.minZ + inset };
    if (side === 1) return { x: box.maxX - inset, z: box.cz };
    if (side === 2) return { x: box.cx, z: box.maxZ - inset };
    return { x: box.minX + inset, z: box.cz };
}

function pushClear(points, next, rects, village) {
    const prev = points[points.length - 1];
    if (Math.hypot(next.x - prev.x, next.z - prev.z) < 0.4) return;
    if (!hitsHouse(prev, next, rects)) {
        points.push(next);
        return;
    }
    const place = places[village];
    const sides = [
        { x: place.x - 2.1, z: prev.z },
        { x: place.x - 15.2, z: prev.z }
    ];
    const side = sides.find((spot) => !hitsHouse(prev, spot, rects)) || sides[0];
    if (Math.hypot(side.x - prev.x, side.z - prev.z) > 0.4) points.push(side);
    const drop = { x: side.x, z: next.z };
    if (Math.hypot(drop.x - points[points.length - 1].x, drop.z - points[points.length - 1].z) > 0.4 && !hitsHouse(points[points.length - 1], drop, rects)) {
        points.push(drop);
    }
    points.push(next);
}

function villagerPath(village, dest) {
    const place = places[village];
    const rects = houseRects(village);
    const door = storeExit(village);
    const lane = { x: door.x, z: place.z - 7.85 };
    const side = exitSide(village, lane, dest);
    const mouth = gateMouth(village, side);
    const gate = gateSpot(village, side, 0);
    const points = [door];
    pushClear(points, lane, rects, village);
    pushClear(points, { x: mouth.x, z: lane.z }, rects, village);
    pushClear(points, mouth, rects, village);
    points.push(gate);
    points.push(dest);
    return points;
}

function repairRoute(village, side) {
    const place = places[village];
    const rects = houseRects(village);
    const door = storeExit(village);
    const lane = { x: door.x, z: place.z - 7.85 };
    const mouth = gateMouth(village, side);
    const points = [door];
    pushClear(points, lane, rects, village);
    pushClear(points, { x: mouth.x, z: lane.z }, rects, village);
    pushClear(points, mouth, rects, village);
    const length = pathLength(points);
    return {
        from: points[0],
        via: points[Math.min(1, points.length - 1)],
        to: points[points.length - 1],
        path: points,
        length,
        walkMs: Math.round((length / FISH_WALK) * 1000)
    };
}

function storeDoor(village) {
    return storeExit(village);
}

function fishRoute(village) {
    const trail = World.fishTrail[village].map((spot) => ({ x: spot[0], z: spot[1] }));
    const path = villagerPath(village, trail[0]);
    for (let i = 1; i < trail.length; i++) path.push(trail[i]);
    const to = trail[trail.length - 1];
    const length = pathLength(path);
    return { from: path[0], via: path[Math.min(1, path.length - 1)], to, path, length, walkMs: Math.round((length / FISH_WALK) * 1000) };
}

function fishPeriod(village) {
    return fishRoute(village).walkMs * 2 + FISH_MS;
}

function treeCenters() {
    return World.trees.filter((tree) => tree.kind === "pine" || tree.kind === "oak");
}

function stretchMarches(state, now) {
    if (!Array.isArray(state.attacks)) return false;
    let dirty = false;
    for (const attack of state.attacks) {
        if (attack.resolved || !(attack.length < 400)) continue;
        const oldLength = Math.max(1, attack.length || 1);
        const route = marchPath(attack.from, attack.to);
        const points = route.points;
        const length = pathLength(points);
        const gateDist = pathDist(points, route.gateIndex);
        const marched = Math.max(0, now - (attack.startedAt || now));
        const oldDuration = (oldLength / MARCH_SPEED) * 1000;
        let frac = Math.min(1, marched / oldDuration);
        if (attack.heldForGate) frac = gateDist / length;
        const duration = (length / MARCH_SPEED) * 1000;
        attack.path = points;
        attack.length = length;
        attack.gateSide = route.gateSide;
        attack.gateDist = gateDist;
        attack.remainMs = Math.round(((length - gateDist) / MARCH_SPEED) * 1000);
        attack.startedAt = now - frac * duration;
        attack.gateAt = attack.startedAt + (gateDist / MARCH_SPEED) * 1000;
        attack.arriveAt = attack.startedAt + duration;
        dirty = true;
    }
    return dirty;
}

const trees = treeCenters();

function nearestTree(from, slot) {
    let best = null;
    let bestDist = Infinity;
    const consider = (tree) => {
        const dist = Math.hypot(tree.x - from.x, tree.z - from.z);
        if (dist < bestDist) {
            best = tree;
            bestDist = dist;
        }
    };
    for (const tree of trees) consider(tree);
    const meadow = World.meadowNear(from.x, from.z, 240);
    for (let i = 0; i < meadow.length; i++) {
        if (meadow[i].kind === "pine" || meadow[i].kind === "oak") consider(meadow[i]);
    }
    if (!best) return { x: from.x, z: from.z };
    const dx = from.x - best.x;
    const dz = from.z - best.z;
    const len = Math.hypot(dx, dz) || 1;
    const side = (slot || 0) * 0.75;
    return {
        x: best.x + (dx / len) * 1.15 + (-dz / len) * side,
        z: best.z + (dz / len) * 1.15 + (dx / len) * side
    };
}

function nearestOre(from, slot) {
    let best = null;
    let bestDist = Infinity;
    for (const [x, z] of World.ores) {
        const dist = Math.hypot(x - from.x, z - from.z);
        if (dist < bestDist) {
            best = { x, z };
            bestDist = dist;
        }
    }
    if (!best) return null;
    const dx = from.x - best.x;
    const dz = from.z - best.z;
    const len = Math.hypot(dx, dz) || 1;
    const side = ((slot || 0) % 3 - 1) * 1.2;
    return {
        x: best.x + (dx / len) * 3 + (-dz / len) * side,
        z: best.z + (dz / len) * 3 + (dx / len) * side
    };
}

// Mines and lumberyards go wherever their ore or wood is, however far from the village.
function oreNear(village) {
    return !!nearestOre(places[village], 0);
}

function woodRoute(village, slot, ore) {
    const from = storeExit(village);
    const to = (ore && nearestOre(from, slot)) || nearestTree(from, slot);
    const path = villagerPath(village, to);
    const length = pathLength(path);
    return { from: path[0], via: path[Math.min(1, path.length - 1)], to, path, length, walkMs: Math.round((length / FISH_WALK) * 1000) };
}

function woodPeriod(village, slot, ore) {
    return woodRoute(village, slot, ore).walkMs * 2 + (ore ? ORE_MS : WOOD_MS);
}

function livingFisher(state, village) {
    return state.fishermen.find((man) => man.village === village && man.health > 0);
}

function addFisher(state, village, now) {
    state.fishermen.push({ village, health: FISHER_HP, cycleStart: now, delivered: 0 });
    const owner = state.owners[village];
    const who = factions[owner].name;
    const place = factions[village].name;
    note(state, owner === village ? who + " recruits a fisherman." : who + " recruits a fisherman in " + place + ".");
}

function addWoodcutter(state, village, now, ore) {
    const slot = state.woodcutters.filter((man) => man.village === village).length;
    const man = { village, slot, health: FISHER_HP, cycleStart: now, delivered: 0 };
    if (ore) man.ore = true;
    state.woodcutters.push(man);
    const owner = state.owners[village];
    const who = factions[owner].name;
    const place = factions[village].name;
    const what = ore ? "a miner" : "a woodcutter";
    note(state, owner === village ? who + " recruits " + what + "." : who + " recruits " + what + " in " + place + ".");
}

function jobWeight() {
    return 1;
}

function villageCounts(state, village) {
    const owner = state.owners[village];
    let soldiers = 0;
    eachLiving(state, owner, (index) => {
        if (state.post[keyOf(owner, index)] === village) soldiers += 1;
    });
    const fishers = state.fishermen.filter((man) => man.village === village && man.health > 0).length;
    const wood = (state.woodcutters || []).filter((man) => man.village === village && man.health > 0).length;
    const jacks = village === YARD_VILLAGE && owner === YARD_OWNER ? livingJacks(state).length : 0;
    const training = state.training.filter((job) => job.village === village);
    const trainingPop = training.reduce((sum, job) => sum + jobWeight(job.kind), 0);
    const living = soldiers + fishers + wood + jacks;
    return { soldiers, fishers, wood, training, living, pop: living + trainingPop };
}

function popLimit(state, faction) {
    let room = 0;
    for (const house of state.houses || []) {
        if (state.owners[house.village] === faction) room += house.model === "houses" ? HOUSES_POP : HOUSE_POP;
    }
    return POP_BASE + room;
}

function factionPop(state, faction) {
    let n = livingCount(state, faction);
    for (let village = 0; village < 4; village++) {
        if (state.owners[village] !== faction) continue;
        n += state.fishermen.filter((man) => man.village === village && man.health > 0).length;
        n += (state.woodcutters || []).filter((man) => man.village === village && man.health > 0).length;
        for (const farm of state.farms || []) {
            if (farm.village === village && farm.health > 0) n += farmCrew(farm);
        }
    }
    for (const yard of allYards(state)) {
        if (yard.owner !== faction) continue;
        n += (yard.jacks || []).filter((man) => man.health > 0).length;
    }
    for (const job of state.training || []) {
        if (state.owners[job.village] === faction) n += 1;
    }
    return n;
}

// Everyone alive eats 1 food a day; people still in training start eating once they are done.
function dailyFood(state, faction) {
    const trainees = (state.training || []).filter((job) => state.owners[job.village] === faction).length;
    let held = 0;
    minors.forEach((minor, index) => {
        if (state.minors && state.minors[index] && state.minors[index].owner === faction) held += hamletPop(index);
    });
    return factionPop(state, faction) - trainees + held;
}

function ensureEconomy(state, now) {
    let dirty = false;
    if (!Array.isArray(state.food) || state.food.length !== 4) {
        state.food = [100, 100, 100, 100];
        dirty = true;
    }
    if (!Array.isArray(state.wood) || state.wood.length !== 4) {
        state.wood = [0, 0, 0, 0];
        dirty = true;
    }
    // Stone and gold come from miners digging ore placed on the map.
    for (const key of ["stone", "gold"]) {
        if (!Array.isArray(state[key]) || state[key].length !== 4) {
            state[key] = [0, 0, 0, 0];
            dirty = true;
        }
    }
    if (!Array.isArray(state.fishermen)) {
        state.fishermen = [];
        dirty = true;
    }
    if (!Array.isArray(state.woodcutters)) {
        state.woodcutters = [];
        dirty = true;
    }
    if (!Array.isArray(state.training)) {
        state.training = [];
        dirty = true;
    }
    if (state.fisherHp !== FISHER_HP) {
        for (const man of state.fishermen) {
            if (man.health > FISHER_HP) man.health = FISHER_HP;
        }
        state.fisherHp = FISHER_HP;
        dirty = true;
    }
    if (!state.realtime) {
        state.realtime = true;
        state.marchAfter = now + RECRUIT_MS;
        dirty = true;
    }
    if (ensureGates(state)) dirty = true;
    if (ensureArchers(state)) dirty = true;
    if (ensureYard(state, now)) dirty = true;
    if (ensureFolk(state)) dirty = true;
    return dirty;
}

const GIVEN_NAMES = ["Jon", "Alice", "Will", "Joan", "Tom", "Agnes", "Rob", "Edith", "Hugh", "Meg", "Wat", "Cecily", "Ned", "Margery", "Hal", "Rose", "Piers", "Ellen", "Colin", "Matilda", "Hob", "Bess", "Giles", "Kate", "Martin", "Lucy", "Adam", "Nan", "Sim", "Isabel"];
const FAMILY_NAMES = ["Smith", "Carter", "Cooper", "Miller", "Wright", "Taylor", "Baker", "Weaver", "Potter", "Tanner", "Brewer", "Mason", "Fuller", "Wheeler", "Parker", "Cook", "Dyer", "Shepherd", "Green", "Brown", "Hill", "Brook", "Marsh", "Reed", "Stone", "Ward", "Clark", "Hayward", "Thatcher", "Sawyer"];

function nextFolkName(used) {
    const span = GIVEN_NAMES.length * FAMILY_NAMES.length;
    for (let n = 0; n < span; n++) {
        const name = GIVEN_NAMES[n % GIVEN_NAMES.length] + " " + FAMILY_NAMES[n % FAMILY_NAMES.length];
        if (!used.has(name)) return name;
    }
    return "Worker " + (used.size + 1);
}

function ensureFolk(state) {
    let dirty = false;
    const homes = seDwellings();
    const all = state.fishermen.concat(state.woodcutters || []);
    const people = all.filter((man) => man.village === 3 && man.health > 0);
    const used = new Set();
    for (const man of all) {
        if (man.name) used.add(man.name);
    }
    const taken = new Set();
    for (const man of people) {
        const slot = man.dwelling;
        if (Number.isInteger(slot) && slot >= 0 && slot < homes.length && !taken.has(slot)) taken.add(slot);
        else if (slot != null) {
            man.dwelling = null;
            dirty = true;
        }
    }
    for (const man of people) {
        if (Number.isInteger(man.dwelling)) continue;
        let slot = -1;
        for (let i = 0; i < homes.length; i++) {
            if (!taken.has(i)) {
                slot = i;
                break;
            }
        }
        if (slot < 0) continue;
        man.dwelling = slot;
        taken.add(slot);
        dirty = true;
    }
    for (const man of people) {
        if (man.name) continue;
        man.name = nextFolkName(used);
        used.add(man.name);
        dirty = true;
    }
    return dirty;
}

function livingJacks(state) {
    return (state.yard && state.yard.jacks || []).filter((man) => man.health > 0);
}

function ensureYard(state, now) {
    if (state.yard && Array.isArray(state.yard.jacks)) {
        if (state.yard.x == null) {
            state.yard.x = YARD_AT.x;
            state.yard.z = YARD_AT.z;
            state.yard.id = state.yard.id || "yard-home";
            return true;
        }
        return false;
    }
    state.yard = {
        owner: YARD_OWNER,
        village: YARD_VILLAGE,
        stock: 0,
        sentDay: -1,
        sentSlot: -1,
        retryAt: 0,
        haul: null,
        jacks: [],
        id: "yard-home",
        x: YARD_AT.x,
        z: YARD_AT.z
    };
    return true;
}

function allYards(state) {
    const list = [];
    if (state.yard && Array.isArray(state.yard.jacks)) list.push(state.yard);
    for (const yard of state.yards || []) list.push(yard);
    return list;
}

function yardsOf(state, faction) {
    return allYards(state).filter((yard) => yard.owner === faction);
}

function addJack(state, now, village) {
    const owner = state.owners[village];
    const yard = allYards(state).find((item) => item.village === village && item.owner === owner)
        || yardsOf(state, owner)[0];
    if (!yard) return;
    yard.jacks.push({ health: FISHER_HP, cycleStart: now, delivered: 0 });
    note(state, factions[owner].name + " recruits a lumberjack.");
}

function jackSlot(play) {
    const hour = Clock.hours(play);
    if (hour >= 9) return 1;
    if (hour >= 3) return 0;
    return -1;
}

function yardDue(yard, play) {
    const slot = jackSlot(play);
    if (slot < 0) return false;
    const day = Clock.day(play);
    if (yard.sentDay !== day) return true;
    return slot > (yard.sentSlot == null ? -1 : yard.sentSlot);
}

function yardPoint(yard) {
    return { x: yard.x == null ? YARD_AT.x : yard.x, z: yard.z == null ? YARD_AT.z : yard.z };
}

function creditJacks(state, yard, now) {
    const hauling = yard.haul && (yard.haul.phase === "out" || yard.haul.phase === "back");
    let dirty = false;
    (yard.jacks || []).forEach((man, index) => {
        if (man.health <= 0) return;
        if (hauling && index === 0) return;
        const done = Math.floor(Math.max(0, now - (man.cycleStart || now)) / JACK_MS);
        const paid = man.delivered || 0;
        if (done <= paid) return;
        yard.stock = (yard.stock || 0) + (done - paid) * WOOD_YIELD;
        man.delivered = done;
        dirty = true;
    });
    return dirty;
}

function stepOneYard(state, yard, now) {
    let dirty = creditJacks(state, yard, now);
    const spot = yardPoint(yard);
    const haul = yard.haul;
    if (haul && (haul.phase === "out" || haul.phase === "back") && now >= haul.arriveAt) {
        if (haul.phase === "out") {
            state.wood[yard.owner] = (state.wood[yard.owner] || 0) + (haul.cargo || 0);
            note(state, factions[yard.owner].name + " carts " + (haul.cargo || 0) + " wood to the storehouse.");
            const back = (haul.path || []).slice().reverse();
            const length = pathLength(back);
            yard.haul = {
                phase: "back",
                path: back,
                length: length,
                startedAt: now,
                arriveAt: now + (length / FISH_WALK) * 1000,
                cargo: 0,
                parkX: spot.x,
                parkZ: spot.z
            };
        } else yard.haul = null;
        dirty = true;
    }
    const play = playClock(state);
    const busy = yard.haul && (yard.haul.phase === "out" || yard.haul.phase === "back");
    const hands = (yard.jacks || []).filter((man) => man.health > 0).length;
    if (play != null && !busy && yardDue(yard, play) && play >= (yard.retryAt || 0)) {
        const path = villagerPath(yard.village, spot).slice().reverse();
        if (!hands || !(yard.stock > 0)) {
            yard.sentDay = Clock.day(play);
            yard.sentSlot = jackSlot(play);
            dirty = true;
        } else if (routeBlocked(state, yard.village, path, now)) {
            yard.retryAt = play + FARM_RETRY_MS;
            dirty = true;
        } else {
            const cargo = yard.stock;
            yard.stock = 0;
            yard.sentDay = Clock.day(play);
            yard.sentSlot = jackSlot(play);
            const length = pathLength(path);
            yard.haul = {
                phase: "out",
                path: path,
                length: length,
                startedAt: now,
                arriveAt: now + (length / FISH_WALK) * 1000,
                cargo: cargo,
                parkX: spot.x,
                parkZ: spot.z
            };
            note(state, factions[yard.owner].name + " sends a lumberjack with the wood cart.");
            dirty = true;
        }
    }
    return dirty;
}

function stepYard(state, now) {
    let dirty = false;
    for (const yard of allYards(state)) {
        if (stepOneYard(state, yard, now)) dirty = true;
    }
    return dirty;
}

function releaseGate(state, village, side, now) {
    for (const attack of state.attacks) {
        if (attack.resolved || attack.to !== village || attack.gateSide !== side) continue;
        if (attack.breachedAt || !attack.heldForGate) continue;
        attack.breachedAt = now;
        attack.arriveAt = now + (attack.remainMs || 0);
        attack.heldForGate = false;
    }
}

function besiege(state, now) {
    if (!state.gates) return false;
    let dirty = false;
    for (const attack of state.attacks) {
        if (attack.resolved || !Number.isFinite(attack.gateAt)) continue;
        const row = state.gates[attack.to];
        const side = attack.gateSide;
        if (!row || side < 0 || side > 3) continue;
        if (row[side] <= 0) {
            if (attack.heldForGate && !attack.breachedAt) {
                releaseGate(state, attack.to, side, now);
                dirty = true;
            }
            continue;
        }
        if (now < attack.gateAt) continue;
        const spacing = 800 / Math.max(1, attack.indexes.length);
        if (!attack.heldForGate) {
            attack.heldForGate = true;
            attack.nextGateHit = attack.gateAt;
            dirty = true;
        }
        let broke = false;
        while (attack.nextGateHit <= now && row[side] > 0) {
            row[side] -= 1;
            attack.nextGateHit += spacing;
            dirty = true;
            if (row[side] <= 0) broke = true;
        }
        if (broke) {
            row[side] = 0;
            attack.breachedAt = attack.nextGateHit;
            attack.arriveAt = attack.breachedAt + (attack.remainMs || 0);
            attack.heldForGate = false;
            note(state, factions[attack.faction].name + " breaks a gate at " + factions[attack.to].name + ".");
            dirty = true;
        } else {
            const want = now + row[side] * spacing + (attack.remainMs || 0);
            if (Math.abs((attack.arriveAt || 0) - want) > 500) {
                attack.arriveAt = want;
                dirty = true;
            }
        }
    }
    return dirty;
}

function finishTraining(state, now) {
    let dirty = false;
    const keep = [];
    for (const job of state.training) {
        if (now < job.readyAt) {
            keep.push(job);
            continue;
        }
        dirty = true;
        const owner = state.owners[job.village];
        if (factionPop(state, owner) > popLimit(state, owner)) {
            state.food[owner] += job.kind === "soldier" ? SOLDIER_COST : FISHER_COST;
            continue;
        }
        if (job.kind === "fisher") addFisher(state, job.village, now);
        else if (job.kind === "wood") addWoodcutter(state, job.village, now);
        else if (job.kind === "ore") addWoodcutter(state, job.village, now, true);
        else if (job.kind === "jack") addJack(state, now, job.village);
        else {
            const owner = state.owners[job.village];
            const index = state.nextIndex[owner]++;
            state.health[keyOf(owner, index)] = MAX_HP;
            state.post[keyOf(owner, index)] = job.village;
            note(state, factions[owner].name + " recruits one soldier.");
        }
    }
    state.training = keep;
    return dirty;
}

function homeVillage(state, faction) {
    if (state.owners[faction] === faction) return faction;
    for (let village = 0; village < 4; village++) {
        if (state.owners[village] === faction) return village;
    }
    return -1;
}

function workerCount(state, faction, list) {
    let n = 0;
    for (const man of list || []) {
        if (man.health > 0 && state.owners[man.village] === faction) n += 1;
    }
    return n;
}

function orderTraining(state, now) {
    let dirty = false;
    for (let faction = 0; faction < 4; faction++) {
        const village = homeVillage(state, faction);
        if (village < 0) continue;
        const has = (kind) => state.training.some((job) => state.owners[job.village] === faction && job.kind === kind);
        const pay = (cost) => {
            if ((state.food[faction] || 0) < cost + dailyFood(state, faction)) return false;
            state.food[faction] -= cost;
            return true;
        };
        const room = factionPop(state, faction) < popLimit(state, faction);
        if (!room) continue;
        const yards = yardsOf(state, faction);
        const jacks = yards.reduce((sum, yard) => sum + (yard.jacks || []).filter((man) => man.health > 0).length, 0);
        let kind = "";
        let at = village;
        // Soldiers are the point; workers only to keep the food and wood coming for more of them.
        const woodAim = 1 + Math.floor(factionPop(state, faction) / WOOD_PER_POP);
        const cutters = (state.woodcutters || []).filter((man) => !man.ore);
        const miners = (state.woodcutters || []).filter((man) => man.ore);
        const digs = (state.mines || []).filter((mine) => state.owners[mine.village] === faction && mine.village < MINOR_BASE && oreNear(mine.village));
        if (!has("wood") && workerCount(state, faction, cutters) < woodAim) kind = "wood";
        else if (!has("jack") && yards.length && jacks < 1) {
            kind = "jack";
            at = yards[0].village;
        } else if (!has("ore") && digs.length && workerCount(state, faction, miners) < digs.length * MINERS_PER_MINE) {
            kind = "ore";
            at = digs[0].village;
        } else if (!has("fisher") && workerCount(state, faction, state.fishermen) < 1 && producingFarms(state, faction) * FARM_PER_DAY < dailyFood(state, faction)) kind = "fisher";
        else kind = "soldier";
        const cost = kind === "soldier" ? SOLDIER_COST : FISHER_COST;
        if (!pay(cost)) continue;
        state.training.push({ village: at, kind: kind, readyAt: now + RECRUIT_MS });
        dirty = true;
    }
    return dirty;
}

function considerAttacks(state, now) {
    if (now < (state.marchAfter || 0)) return false;
    let dirty = false;
    const tick = Math.floor(now / 60000);
    for (let faction = 0; faction < 4; faction++) {
        if (maybeAttack(state, faction, tick, now)) dirty = true;
    }
    return dirty;
}

function workerRoster(state, village) {
    return state.fishermen.filter((man) => man.village === village && man.health > 0).concat(
        (state.woodcutters || []).filter((man) => man.village === village && man.health > 0)
    );
}

function playClock(state) {
    return Number.isFinite(state.playMs) ? state.playMs : null;
}

function buildReady(state) {
    const play = playClock(state);
    if (play == null) return null;
    return play + BUILD_MS;
}

function buildDue(state, job, now) {
    const play = playClock(state);
    if (Number.isFinite(job.readyPlay) && play != null && job.readyPlay > play + BUILD_MS) job.readyPlay = play + BUILD_MS;
    if (Number.isFinite(job.readyPlay)) return play != null && play >= job.readyPlay;
    return Number.isFinite(job.readyAt) && now >= job.readyAt;
}

function consumeFood(state) {
    const play = playClock(state);
    if (play == null) return false;
    if (!Array.isArray(state.fedDay) || state.fedDay.length !== 4) state.fedDay = [-1, -1, -1, -1];
    const today = Clock.day(play);
    let dirty = false;
    for (let faction = 0; faction < 4; faction++) {
        if (state.fedDay[faction] === today) continue;
        if (state.fedDay[faction] < 0) {
            state.fedDay[faction] = today;
            dirty = true;
            continue;
        }
        const have = state.food[faction] || 0;
        const need = dailyFood(state, faction);
        const meal = Math.min(need, have);
        state.food[faction] = have - meal;
        state.fedDay[faction] = today;
        if (meal < need) note(state, factions[faction].name + " cannot feed the settlement.");
        dirty = true;
    }
    (state.minors || []).forEach((minor, index) => {
        if (minor.owner >= 0 || minor.fedDay === today) return;
        if (minor.fedDay < 0) {
            minor.fedDay = today;
            dirty = true;
            return;
        }
        const need = hamletPop(index, state);
        const meal = Math.min(need, minor.food || 0);
        minor.food = (minor.food || 0) - meal;
        minor.fedDay = today;
        if (meal < need) note(state, minors[index].name + " cannot feed its people.");
        dirty = true;
    });
    return dirty;
}

function workerHeld(state, man) {
    if (!man || man.health <= 0 || man.repair) return false;
    if (state.attacks.some((attack) => !attack.resolved && attack.to === man.village)) return true;
    const played = playClock(state);
    if (played == null) return false;
    const roster = workerRoster(state, man.village);
    return Clock.workerAsleep(roster.indexOf(man), roster.length, played);
}

function notePlay(state, add, now) {
    if (!Number.isFinite(add) || add < 0) return false;
    const morning = Math.round(8 / 24 * Clock.DAY_MS);
    let changed = false;
    if (!Number.isFinite(state.playMs)) {
        state.playMs = morning;
        changed = true;
    }
    const addMs = Math.min(4000, Math.round(add));
    if (addMs > 0) {
        const seen = state.playSeen;
        const wall = Number.isFinite(seen) ? Math.max(0, now - seen) : addMs;
        const gained = Math.min(addMs, wall);
        if (gained > 0) {
            state.playMs += gained;
            changed = true;
        }
    }
    if (changed) state.playSeen = now;
    return changed;
}

function settleHold(man, now, held) {
    if (held) {
        if (man.heldSince) return false;
        man.heldSince = now;
        return true;
    }
    if (!man.heldSince) return false;
    man.cycleStart += Math.max(0, now - man.heldSince);
    man.heldSince = 0;
    return true;
}

function fishFar(village) {
    return fishRoute(village).walkMs > FAR_MS;
}

function poseAt(points, dist) {
    let left = Math.max(0, dist);
    for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const len = Math.hypot(dx, dz) || 0.0001;
        if (left <= len || i === points.length - 2) {
            const t = Math.min(1, left / len);
            return { x: start.x + dx * t, z: start.z + dz * t, yaw: Math.atan2(-dx, -dz) };
        }
        left -= len;
    }
    const last = points[points.length - 1] || { x: 0, z: 0 };
    return { x: last.x, z: last.z, yaw: 0 };
}

function freshCart(layout) {
    return {
        phase: "parked",
        cargo: 0,
        hp: CART_HP,
        driver: 0,
        parkX: layout.park.x,
        parkZ: layout.park.z,
        parkYaw: 0,
        path: null,
        length: 0,
        startedAt: 0,
        arriveAt: 0,
        goal: "village",
        stopX: layout.park.x,
        stopZ: layout.park.z,
        yaw: 0,
        resumeAt: 0,
        nextBlow: 0
    };
}

function ensureLodges(state) {
    if (!Array.isArray(state.lodges)) state.lodges = [];
    let dirty = false;
    for (let village = 0; village < 4; village++) {
        const working = state.fishermen.some((man) => man.village === village && man.health > 0);
        if (!working || !fishFar(village)) continue;
        if (state.lodges.some((lodge) => lodge.village === village && lodge.kind === "fish")) continue;
        const layout = World.cottageLayout(village);
        state.lodges.push({
            id: "fish-" + village,
            village,
            kind: "fish",
            x: layout.x,
            z: layout.z,
            w: layout.w,
            d: layout.d,
            facing: layout.facing,
            ground: layout.ground,
            cap: layout.cap,
            nap: layout.nap,
            stock: 0,
            cart: freshCart(layout)
        });
        note(state, factions[state.owners[village]].name + " raises a fishermen's cottage.");
        dirty = true;
    }
    return dirty;
}

function fishLodge(state, village) {
    return (state.lodges || []).find((lodge) => lodge.village === village && lodge.kind === "fish") || null;
}

function seDwellings() {
    return Town.buildings.filter((b) => b.village === 3 && (b.mesh === "house" || b.mesh === "tall") && b.role !== "farmhouse");
}

function dwellingFace(b) {
    const s = Math.sin(b.yaw || 0);
    const c = Math.cos(b.yaw || 0);
    const fx = -s;
    const fz = -c;
    const half = (Math.abs(fx) > Math.abs(fz) ? b.w : b.d) * 0.5;
    const side = b.doorSide == null ? 1 : b.doorSide;
    return {
        x: b.x + fx * (half - 0.06) - c * side,
        z: b.z + fz * (half - 0.06) + s * side,
        fx: fx,
        fz: fz,
        y: b.y || 0
    };
}

function dwellingNap(b) {
    const face = dwellingFace(b);
    const s = Math.sin(b.yaw || 0);
    const c = Math.cos(b.yaw || 0);
    const ax = -c;
    const az = s;
    return [
        { x: face.x + face.fx * 1.15, z: face.z + face.fz * 1.15, y: face.y },
        { x: face.x - face.fx * 0.75, z: face.z - face.fz * 0.75, y: face.y },
        { x: b.x - face.fx * 0.95 + ax * 0.15, z: b.z - face.fz * 0.95 + az * 0.15, y: face.y }
    ];
}

function folkPlate(man, homes) {
    if (man.village !== 3 || !man.name) return { name: "", plate: null };
    const home = homes[man.dwelling];
    if (!home) return { name: man.name, plate: null };
    const face = dwellingFace(home);
    return { name: man.name, plate: { x: face.x, z: face.z, fx: face.fx, fz: face.fz, y: face.y } };
}

function bedsOf(state) {
    const beds = new Map();
    const naps = new Map();
    const homes = seDwellings();
    for (let village = 0; village < 4; village++) {
        const fishers = state.fishermen.filter((man) => man.village === village && man.health > 0);
        const cutters = (state.woodcutters || []).filter((man) => man.village === village && man.health > 0);
        if (village === 3) {
            for (const man of fishers.concat(cutters)) {
                const home = homes[man.dwelling];
                if (!home) {
                    beds.set(man, "manor");
                    continue;
                }
                beds.set(man, "se-" + man.dwelling);
                naps.set(man, dwellingNap(home));
            }
            continue;
        }
        const lodge = fishLodge(state, village);
        let room = lodge && fishFar(village) ? lodge.cap : 0;
        for (const man of fishers) {
            if (room <= 0) break;
            beds.set(man, lodge.id);
            room -= 1;
        }
        for (const man of fishers.concat(cutters)) {
            if (beds.has(man)) continue;
            beds.set(man, "manor");
        }
    }
    return { beds, naps };
}

function cartPose(cart, now) {
    if (!cart) return { x: 0, z: 0, yaw: 0 };
    if (cart.phase === "stopped") return { x: cart.stopX, z: cart.stopZ, yaw: cart.yaw || 0 };
    if (cart.phase === "parked" || !cart.path || cart.path.length < 2) {
        return { x: cart.parkX, z: cart.parkZ, yaw: cart.parkYaw || 0 };
    }
    const travel = Math.max(1, cart.arriveAt - cart.startedAt);
    const along = Math.max(0, Math.min(1, (now - cart.startedAt) / travel));
    return poseAt(cart.path, along * (cart.length || 0));
}

function parkPoint(cart) {
    return { x: cart.parkX, z: cart.parkZ };
}

function startCart(cart, path, now, phase) {
    const length = pathLength(path);
    cart.phase = phase;
    cart.path = path;
    cart.length = length;
    cart.covered = 0;
    cart.startedAt = now;
    cart.arriveAt = now + (length / FISH_WALK) * 1000;
    cart.driver = cart.driver > 0 ? cart.driver : DRIVER_HP;
}

function moveCarts(state, now) {
    if (!Array.isArray(state.lodges)) return false;
    let dirty = false;
    for (const lodge of state.lodges) {
        const cart = lodge.cart;
        if (!cart) continue;
        const owner = state.owners[lodge.village];
        if (cart.hp <= 0) {
            note(state, "A cart is destroyed and its load is lost.");
            const layout = { park: { x: cart.parkX, z: cart.parkZ } };
            lodge.cart = freshCart(layout);
            dirty = true;
            continue;
        }
        if ((cart.phase === "out" || cart.phase === "back") && cart.driver <= 0) {
            const pose = cartPose(cart, now);
            const travel = Math.max(1, cart.arriveAt - cart.startedAt);
            const along = Math.max(0, Math.min(1, (now - cart.startedAt) / travel));
            cart.covered = along * (cart.length || 0);
            cart.phase = "stopped";
            cart.stopX = pose.x;
            cart.stopZ = pose.z;
            cart.yaw = pose.yaw;
            cart.resumeAt = now + 45000;
            cart.driver = 0;
            note(state, "A carter falls. The cart stops with its load.");
            dirty = true;
            continue;
        }
        if (cart.phase === "stopped" && now >= (cart.resumeAt || 0) && cart.path && cart.path.length > 1) {
            const covered = Math.max(0, Math.min(cart.length || 0, cart.covered || 0));
            const whole = Math.max(1, ((cart.length || 1) / FISH_WALK) * 1000);
            cart.driver = DRIVER_HP;
            cart.phase = cart.goal === "back" ? "back" : "out";
            cart.startedAt = now - (covered / Math.max(1, cart.length || 1)) * whole;
            cart.arriveAt = cart.startedAt + whole;
            dirty = true;
            continue;
        }
        if ((cart.phase === "out" || cart.phase === "back") && now >= cart.arriveAt) {
            if (cart.phase === "out") {
                state.food[owner] = (state.food[owner] || 0) + (cart.cargo || 0);
                note(state, factions[owner].name + " carts in " + (cart.cargo || 0) + " food.");
                cart.cargo = 0;
                cart.goal = "back";
                startCart(cart, villagerPath(lodge.village, parkPoint(cart)), now, "back");
            } else {
                cart.phase = "parked";
                cart.driver = 0;
                cart.path = null;
                cart.cargo = 0;
                cart.goal = "village";
            }
            dirty = true;
            continue;
        }
        if (cart.phase === "parked") {
            const stock = lodge.stock || 0;
            const urgent = (state.food[owner] || 0) < URGENT_FOOD;
            const load = stock >= CART_LOAD ? CART_LOAD : (urgent && stock >= FISH_FOOD ? stock : 0);
            if (load > 0) {
                lodge.stock = stock - load;
                cart.cargo = load;
                cart.goal = "village";
                startCart(cart, villagerPath(lodge.village, parkPoint(cart)).slice().reverse(), now, "out");
                dirty = true;
            }
        }
        if (cart.phase === "out" || cart.phase === "back" || cart.phase === "stopped") {
            const pose = cartPose(cart, now);
            for (const attack of state.attacks) {
                if (attack.resolved || attack.faction === owner || now < (attack.startedAt || 0)) continue;
                if (!attack.path || attack.path.length < 2) continue;
                const travel = Math.max(1, attack.arriveAt - attack.startedAt);
                const along = Math.max(0, Math.min(1, (now - attack.startedAt) / travel));
                const army = poseAt(attack.path, along * (attack.length || 0));
                if (Math.hypot(army.x - pose.x, army.z - pose.z) > 18) continue;
                if (now < (cart.nextBlow || 0)) continue;
                cart.nextBlow = now + 2000;
                if (cart.driver > 0) cart.driver -= 1;
                else cart.hp -= 1;
                dirty = true;
                break;
            }
        }
    }
    return dirty;
}

function creditFish(state, now) {
    let dirty = false;
    for (const man of state.fishermen) {
        if (man.health <= 0 || man.repair) continue;
        const held = workerHeld(state, man);
        if (settleHold(man, now, held)) dirty = true;
        if (held) continue;
        const done = Math.floor(Math.max(0, now - man.cycleStart) / fishPeriod(man.village));
        const paid = man.delivered || 0;
        if (done <= paid) continue;
        const trips = done - paid;
        const owner = state.owners[man.village];
        const lodge = fishLodge(state, man.village);
        if (lodge) {
            lodge.stock = (lodge.stock || 0) + trips * FISH_FOOD;
            note(state, factions[owner].name + " lands " + (trips * FISH_FOOD) + " fish at a cottage.");
        } else {
            state.food[owner] += trips * FISH_FOOD;
            note(state, factions[owner].name + " stores " + (trips * FISH_FOOD) + " food.");
        }
        man.delivered = done;
        dirty = true;
    }
    return dirty;
}

function gateUnderAttack(state, village, side) {
    return state.attacks.some((attack) => (
        !attack.resolved &&
        attack.to === village &&
        attack.gateSide === side &&
        attack.heldForGate &&
        !attack.breachedAt
    ));
}

function villageMending(state, village) {
    const people = state.fishermen.concat(state.woodcutters || []);
    return people.some((man) => man.village === village && man.health > 0 && man.repair);
}

function pickMender(state, village) {
    const free = (man) => man.village === village && man.health > 0 && !man.repair && !workerHeld(state, man);
    const cutter = (state.woodcutters || []).find(free);
    if (cutter) return cutter;
    return state.fishermen.find(free) || null;
}

function dropRepair(state, man) {
    if (!man || !man.repair || man.repair.applied) {
        if (man) man.repair = null;
        return false;
    }
    const owner = state.owners[man.village];
    state.wood[owner] = (state.wood[owner] || 0) + man.repair.cost;
    man.repair = null;
    return true;
}

function creditRepair(state, now) {
    let dirty = false;
    const people = state.fishermen.concat(state.woodcutters || []);
    for (const man of people) {
        if (!man.repair) continue;
        if (man.health <= 0) {
            if (dropRepair(state, man)) dirty = true;
            continue;
        }
        const job = man.repair;
        const workAt = job.startedAt + job.walkMs + REPAIR_MS;
        const homeAt = job.startedAt + job.walkMs * 2 + REPAIR_MS;
        if (!job.applied && now >= workAt) {
            const row = state.gates[man.village];
            if (row) row[job.side] = Math.min(GATE_HP, (row[job.side] || 0) + job.hp);
            job.applied = true;
            const owner = state.owners[man.village];
            const kind = job.broken ? "broken" : "damaged";
            note(state, factions[owner].name + " repairs a " + kind + " gate at " + factions[man.village].name + ".");
            dirty = true;
        }
        if (now >= homeAt) {
            man.repair = null;
            man.cycleStart = now;
            man.delivered = 0;
            dirty = true;
        }
    }
    return dirty;
}

function considerRepairs(state, now) {
    if (!state.gates) return false;
    let dirty = false;
    const jobs = [];
    for (let village = 0; village < 4; village++) {
        if (villageMending(state, village)) continue;
        if (!pickMender(state, village)) continue;
        const row = state.gates[village];
        for (let side = 0; side < 4; side++) {
            if (row[side] >= GATE_HP || gateUnderAttack(state, village, side)) continue;
            jobs.push({ village, side, hp: row[side] });
        }
    }
    jobs.sort((a, b) => a.hp - b.hp || a.village - b.village || a.side - b.side);
    const sent = new Set();
    for (const job of jobs) {
        if (sent.has(job.village)) continue;
        const owner = state.owners[job.village];
        const wood = state.wood[owner] || 0;
        const missing = GATE_HP - Math.max(0, job.hp);
        const broken = job.hp <= 0;
        if (!broken && (missing < REPAIR_CHUNK || wood < REPAIR_CHUNK)) continue;
        const chunk = broken ? Math.min(REPAIR_CHUNK, missing, wood) : Math.min(REPAIR_CHUNK, missing);
        if (chunk < 1 || wood < chunk) continue;
        const mender = pickMender(state, job.village);
        if (!mender) continue;
        const route = repairRoute(job.village, job.side);
        state.wood[owner] -= chunk;
        mender.repair = {
            side: job.side,
            startedAt: now,
            walkMs: route.walkMs,
            hp: chunk,
            cost: chunk,
            broken,
            applied: false
        };
        sent.add(job.village);
        note(state, factions[owner].name + " sends a villager to repair a gate at " + factions[job.village].name + ".");
        dirty = true;
    }
    return dirty;
}

function creditWood(state, now) {
    let dirty = false;
    for (const man of state.woodcutters) {
        if (man.health <= 0 || man.repair) continue;
        const held = workerHeld(state, man);
        if (settleHold(man, now, held)) dirty = true;
        if (held) continue;
        const done = Math.floor(Math.max(0, now - man.cycleStart) / woodPeriod(man.village, man.slot || 0, man.ore));
        const paid = man.delivered || 0;
        if (done <= paid) continue;
        const trips = done - paid;
        const owner = state.owners[man.village];
        man.delivered = done;
        dirty = true;
        if (man.ore) {
            addStore(state, owner, "stone", trips * ORE_STONE);
            addStore(state, owner, "gold", trips * ORE_GOLD);
            note(state, factions[owner].name + " stores " + (trips * ORE_STONE) + " stone and " + (trips * ORE_GOLD) + " gold.");
            continue;
        }
        state.wood[owner] += trips * WOOD_YIELD;
        note(state, factions[owner].name + " stores " + (trips * WOOD_YIELD) + " wood.");
    }
    return dirty;
}

function settle(state, turn, now) {
    if (state.settledTurn >= turn) return false;
    while (state.settledTurn < turn) {
        state.settledTurn += 1;
        for (let faction = 0; faction < 4; faction++) recruit(state, faction);
        recruitFishOnTurn(state, now);
        for (let faction = 0; faction < 4; faction++) maybeAttack(state, faction, state.settledTurn, now);
    }
    return true;
}

function livingSide(state, faction, indexes) {
    return indexes.filter((index) => healthOf(state, faction, index) > 0);
}

function wound(state, faction, indexes) {
    for (const index of indexes) {
        const key = keyOf(faction, index);
        const health = healthOf(state, faction, index);
        if (health <= 0) continue;
        state.health[key] = health - 1;
        return true;
    }
    return false;
}

function wipePost(state, faction, village) {
    eachLiving(state, faction, (index) => {
        if (state.post[keyOf(faction, index)] === village) state.health[keyOf(faction, index)] = 0;
    });
}

function finishAttack(state, attack, now) {
    const attackers = livingSide(state, attack.faction, attack.indexes);
    const defenders = livingSide(state, attack.defender, attack.defenders);
    if (attackers.length && defenders.length) return false;
    attack.resolved = true;
    const place = factions[attack.to].name;
    if (attackers.length && !defenders.length) {
        wipePost(state, attack.defender, attack.to);
        attackers.forEach((index) => {
            state.post[keyOf(attack.faction, index)] = attack.to;
        });
        state.owners[attack.to] = attack.faction;
        note(state, factions[attack.faction].name + " takes " + place + ".");
    } else {
        note(state, factions[attack.defender].name + " holds " + place + ".");
    }
    state.attacks = state.attacks.filter((item) => item !== attack);
    return true;
}

function fight(state, now) {
    let dirty = false;
    for (const attack of state.attacks.slice()) {
        if (attack.resolved || now < attack.arriveAt) continue;
        if (finishAttack(state, attack, now)) {
            dirty = true;
            continue;
        }
        while (attack.ticks < 40) {
            const due = attack.arriveAt + (attack.ticks + 1) * BATTLE_MS;
            if (due > now) break;
            attack.ticks += 1;
            dirty = true;
            const attackers = livingSide(state, attack.faction, attack.indexes);
            const defenders = livingSide(state, attack.defender, attack.defenders);
            wound(state, attack.defender, defenders);
            wound(state, attack.faction, attackers);
            if (attackers.length !== defenders.length) {
                if (attackers.length > defenders.length) wound(state, attack.defender, defenders);
                else wound(state, attack.faction, attackers);
            } else if ((attack.faction + attack.to) % 2 === 0) {
                wound(state, attack.defender, defenders);
            } else {
                wound(state, attack.faction, attackers);
            }
            if (finishAttack(state, attack, now)) break;
        }
    }
    return dirty;
}

function modeOf(state, faction, index, post, now) {
    if ((state.holds || []).some((hold) => hold.faction === faction && hold.indexes.includes(index))) return "march";
    for (const attack of state.attacks) {
        if (attack.faction === faction && attack.indexes.includes(index)) {
            return now >= attack.arriveAt ? "battle" : "march";
        }
        if (attack.defender === faction && attack.defenders.includes(index)) {
            return now + 8000 >= attack.arriveAt ? "battle" : "guard";
        }
    }
    const raid = state.goblins && state.goblins.raid;
    if (raid && post === GOBLIN_VILLAGE && faction === state.owners[GOBLIN_VILLAGE] && now + 8000 >= raid.arriveAt) return "battle";
    return "guard";
}

function nextGoblinRaid(now) {
    return now + Math.round(GOBLIN_EVERY * (0.6 + Math.random() * 0.8));
}

function endGoblinRaid(state, now, text) {
    state.goblins.raid = null;
    state.goblins.nextAt = nextGoblinRaid(now);
    note(state, text);
}

// Goblins have one hit point and land a blow far less often than a soldier, so a garrison usually wins.
function goblinRaids(state, now) {
    if (!state.goblins) {
        state.goblins = { nextAt: nextGoblinRaid(now), raid: null };
        return true;
    }
    const raid = state.goblins.raid;
    const place = factions[GOBLIN_VILLAGE].name;
    if (!raid) {
        if (state.goblins.nextAt > now + GOBLIN_EVERY * 1.4) state.goblins.nextAt = nextGoblinRaid(now);
        if (Number.isFinite(state.pausedAt) || now < state.goblins.nextAt) return false;
        const count = GOBLIN_MIN + Math.floor(Math.random() * (GOBLIN_MAX - GOBLIN_MIN + 1));
        const path = [{ x: GOBLIN_DEN.x, z: GOBLIN_DEN.z }, gateSpot(GOBLIN_VILLAGE, sideFacing(GOBLIN_VILLAGE, GOBLIN_DEN), 8)];
        const length = pathLength(path);
        state.goblins.raid = {
            id: "goblins-" + now,
            startedAt: now,
            arriveAt: now + Math.round(length / GOBLIN_SPEED * 1000),
            path,
            length,
            hp: new Array(count).fill(1),
            rounds: 0
        };
        note(state, count + " goblins run out of the hills toward " + place + ".");
        return true;
    }
    let dirty = false;
    while (now >= raid.arriveAt + (raid.rounds + 1) * BATTLE_MS) {
        raid.rounds += 1;
        dirty = true;
        const owner = state.owners[GOBLIN_VILLAGE];
        const guards = fielded(state, owner, GOBLIN_VILLAGE).map((unit) => unit.index);
        const left = raid.hp.filter((hp) => hp > 0).length;
        if (!left) {
            endGoblinRaid(state, now, place + " drives off the goblins.");
            break;
        }
        if (!guards.length || raid.rounds > GOBLIN_ROUNDS) {
            endGoblinRaid(state, now, "The goblins ransack " + place + " and slip away.");
            break;
        }
        for (let i = 0; i < guards.length; i++) {
            if (Math.random() >= 0.3) continue;
            const target = raid.hp.findIndex((hp) => hp > 0);
            if (target >= 0) raid.hp[target] = 0;
        }
        for (let i = 0; i < left; i++) {
            if (Math.random() < 0.1) wound(state, owner, guards);
        }
    }
    return dirty;
}

// The goblin camp: each slot is a spot in the ring, 1 while a goblin stands there. A day brings WILD_DAILY more into empty spots;
// a full camp runs at Southwest as one raid, once no other raid is on.
function stepWilds(state, now) {
    const camp = World.wildSpots(WILD_MAX);
    if (!camp.centre) return false;
    const play = playClock(state);
    if (play == null) return false;
    const day = Clock.day(play);
    if (!state.wilds || !Array.isArray(state.wilds.hp) || state.wilds.hp.length !== WILD_MAX) {
        state.wilds = { hp: new Array(WILD_MAX).fill(0).map((_, i) => (i < WILD_START ? 1 : 0)), day };
        return true;
    }
    const wilds = state.wilds;
    let dirty = false;
    if (day > wilds.day) {
        let add = (day - wilds.day) * WILD_DAILY;
        for (let i = 0; i < WILD_MAX && add > 0; i++) {
            if (wilds.hp[i] > 0) continue;
            wilds.hp[i] = 1;
            add -= 1;
        }
        wilds.day = day;
        dirty = true;
    }
    const alive = wilds.hp.filter((hp) => hp > 0).length;
    if (alive < WILD_MAX || state.goblins.raid || Number.isFinite(state.pausedAt)) return dirty;
    const gate = gateSpot(GOBLIN_VILLAGE, sideFacing(GOBLIN_VILLAGE, camp.centre), 8);
    const path = [camp.centre].concat(landRoute(camp.centre, gate).slice(1, -1), [gate]);
    const length = pathLength(path);
    state.goblins.raid = {
        id: "goblins-" + now,
        startedAt: now,
        arriveAt: now + Math.round(length / GOBLIN_SPEED * 1000),
        path,
        length,
        hp: new Array(alive).fill(1),
        rounds: 0
    };
    wilds.hp = wilds.hp.map((_, i) => (i < WILD_AFTER ? 1 : 0));
    note(state, "The goblin camp empties: " + alive + " goblins run at " + factions[GOBLIN_VILLAGE].name + ".");
    return true;
}

function shoreRoute(village) {
    const layout = World.cottageLayout(village);
    const shore = World.fishTrail[village][World.fishTrail[village].length - 1];
    const door = layout.nap[0];
    const path = [{ x: door.x, z: door.z }, { x: shore[0], z: shore[1] }];
    const length = pathLength(path);
    return {
        from: path[0],
        via: path[0],
        to: path[1],
        path,
        length,
        walkMs: Math.round((length / FISH_WALK) * 1000)
    };
}

function routeOf(state, man, cutting) {
    if (man.repair) {
        const route = repairRoute(man.village, man.repair.side);
        return {
            cycleStart: man.repair.startedAt,
            walkMs: man.repair.walkMs,
            from: route.from,
            via: route.via,
            to: route.to,
            path: route.path
        };
    }
    let route;
    if (!cutting && fishLodge(state, man.village)) route = shoreRoute(man.village);
    else route = cutting ? woodRoute(man.village, man.slot || 0, man.ore) : fishRoute(man.village);
    return {
        cycleStart: man.cycleStart,
        walkMs: route.walkMs,
        from: route.from,
        via: route.via,
        to: route.to,
        path: route.path
    };
}

// A worker's first round wears its route into the grass; the trail stays after the worker is gone.
const MAX_TRAILS = 160;

function wearTrail(state, path, worn) {
    if (!path || path.length < 2) return false;
    const points = path.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10]);
    const key = points.map((p) => Math.round(p[0]) + "," + Math.round(p[1])).join(";");
    if (worn.has(key)) return false;
    worn.add(key);
    state.trails.push(points);
    if (state.trails.length > MAX_TRAILS) state.trails.shift();
    return true;
}

function wearTrails(state) {
    if (!Array.isArray(state.trails)) state.trails = [];
    const worn = new Set(state.trails.map((points) => points.map((p) => Math.round(p[0]) + "," + Math.round(p[1])).join(";")));
    let dirty = false;
    for (const man of state.fishermen || []) {
        if (man.health > 0 && man.delivered > 0 && !man.repair && wearTrail(state, routeOf(state, man, false).path, worn)) dirty = true;
    }
    for (const man of state.woodcutters || []) {
        if (man.health > 0 && man.delivered > 0 && !man.repair && wearTrail(state, routeOf(state, man, true).path, worn)) dirty = true;
    }
    for (const farm of state.farms || []) {
        if (farm.health <= 0 || farm.phase !== "haul") continue;
        const site = farmSite(state, farm.id);
        if (site && wearTrail(state, pathToStore(site), worn)) dirty = true;
    }
    for (const cart of state.tributes || []) {
        if (wearTrail(state, cart.phase === "out" ? cart.path : cart.path.slice().reverse(), worn)) dirty = true;
    }
    return dirty;
}

function presentCart(cart, now) {
    const pose = cartPose(cart, now);
    return {
        phase: cart.phase,
        cargo: cart.cargo || 0,
        hp: cart.hp,
        driver: cart.driver || 0,
        parkX: cart.parkX,
        parkZ: cart.parkZ,
        parkYaw: cart.parkYaw || 0,
        x: pose.x,
        z: pose.z,
        yaw: pose.yaw,
        path: cart.path || null,
        length: cart.length || 0,
        startedAt: cart.startedAt || 0,
        arriveAt: cart.arriveAt || 0,
        stopX: cart.stopX,
        stopZ: cart.stopZ,
        goal: cart.goal || "village"
    };
}

function present(state, now, turn, paused) {
    const elapsed = Math.max(0, (paused ? state.pausedAt : now) - state.startedAt);
    const nextIn = TURN_MS - (elapsed % TURN_MS);
    const shown = factions.map((faction, index) => ({ faction, index, units: [] }));
    for (let faction = 0; faction < 4; faction++) {
        const slots = [0, 0, 0, 0];
        eachLiving(state, faction, (index, health) => {
            const post = state.post[keyOf(faction, index)];
            if (post == null) return;
            const mode = modeOf(state, faction, index, post, now);
            const attack = state.attacks.find((item) => (
                item.faction === faction && item.indexes.includes(index)
            ));
            const field = fielded(state, faction, post).some((unit) => unit.index === index);
            const defending = state.attacks.some((item) => item.defenders.includes(index) && item.defender === faction);
            const hold = (state.holds || []).find((item) => item.faction === faction && item.indexes.includes(index));
            if (!attack && !defending && !field && !hold) return;
            const slot = hold ? hold.indexes.indexOf(index) : slots[post]++;
            shown[faction].units.push({
                index,
                health,
                post,
                mode,
                slot,
                attack: attack ? attack.id : null,
                hold: hold ? hold.id : null
            });
        });
    }
    const assigned = bedsOf(state);
    const beds = assigned.beds;
    const naps = assigned.naps;
    const homes = seDwellings();
    return {
        turn,
        paused,
        turnMs: TURN_MS,
        nextTurnAt: paused ? null : now + nextIn,
        maxHealth: MAX_HP,
        restartedAt: state.restartedAt || 0,
        playMs: Number.isFinite(state.playMs) ? state.playMs : null,
        owners: state.owners.slice(),
        log: state.log.slice(),
        food: state.food.slice(),
        wood: state.wood.slice(),
        stone: (state.stone || [0, 0, 0, 0]).slice(),
        gold: (state.gold || [0, 0, 0, 0]).slice(),
        fishermen: state.fishermen.filter((man) => man.health > 0).map((man, index) => {
            const route = routeOf(state, man, false);
            const shelter = state.attacks.some((attack) => !attack.resolved && attack.to === man.village);
            return {
                village: man.village,
                slot: index,
                owner: state.owners[man.village],
                health: man.health,
                cycleStart: route.cycleStart,
                walkMs: route.walkMs,
                from: route.from,
                via: route.via,
                to: route.to,
                path: route.path,
                asleep: workerHeld(state, man) && !shelter,
                shelter,
                bed: beds.get(man) || "manor",
                home: naps.get(man) || null,
                name: folkPlate(man, homes).name,
                plate: folkPlate(man, homes).plate
            };
        }),
        woodcutters: state.woodcutters.filter((man) => man.health > 0).map((man) => {
            const route = routeOf(state, man, true);
            const shelter = state.attacks.some((attack) => !attack.resolved && attack.to === man.village);
            return {
                id: state.woodcutters.indexOf(man),
                village: man.village,
                slot: man.slot || 0,
                ore: !!man.ore,
                owner: state.owners[man.village],
                health: man.health,
                cycleStart: route.cycleStart,
                walkMs: route.walkMs,
                from: route.from,
                via: route.via,
                to: route.to,
                path: route.path,
                asleep: workerHeld(state, man) && !man.repair && !shelter,
                shelter,
                bed: beds.get(man) || "manor",
                home: naps.get(man) || null,
                name: folkPlate(man, homes).name,
                plate: folkPlate(man, homes).plate
            };
        }),
        farms: presentFarms(state),
        plots: (state.builtFarms || []).map((site) => ({
            id: site.id,
            village: site.village,
            kind: "farm",
            yaw: site.yaw,
            house: site.house,
            field: site.fields[0],
            hay: site.hay,
            door: site.door,
            model: site.model || null,
            at: site.at || null
        })).concat((state.houses || []).map((house) => ({
            id: house.id,
            village: house.village,
            kind: "house",
            yaw: house.yaw,
            house: house.house,
            model: house.model || null,
            at: house.at || null
        }))).concat((state.mines || []).map((mine) => ({
            id: mine.id,
            village: mine.village,
            kind: "mine",
            yaw: mine.yaw,
            model: mine.model,
            at: mine.at
        }))).concat((state.yards || []).map((yard) => ({
            id: yard.id,
            village: yard.village,
            kind: "yard",
            x: yard.x,
            z: yard.z,
            y: yard.y,
            yaw: yard.yaw,
            w: yard.w,
            d: yard.d,
            model: yard.model || null,
            at: yard.at || null
        }))).concat(hamletPlots()),
        raising: (state.farmJobs || []).map((job) => ({
            id: job.id,
            village: job.village,
            kind: "farm",
            x: job.site.bed.x,
            z: job.site.bed.z,
            y: job.site.y
        })).concat((state.siteJobs || []).map((job) => ({
            id: job.id,
            village: job.village,
            kind: job.kind,
            x: job.x,
            z: job.z,
            y: job.y
        }))),
        pads: syncPads(state),
        lodges: (state.lodges || []).map((lodge) => ({
            id: lodge.id,
            village: lodge.village,
            kind: lodge.kind,
            owner: state.owners[lodge.village],
            x: lodge.x,
            z: lodge.z,
            w: lodge.w,
            d: lodge.d,
            facing: lodge.facing,
            ground: lodge.ground,
            cap: lodge.cap,
            nap: lodge.nap,
            stock: lodge.stock || 0,
            cart: presentCart(lodge.cart, now)
        })),
        attacks: state.attacks.map((attack) => ({
            id: attack.id,
            from: attack.from,
            to: attack.to,
            faction: attack.faction,
            defender: attack.defender,
            indexes: attack.indexes,
            defenders: attack.defenders,
            path: attack.path,
            length: attack.length,
            startedAt: attack.startedAt,
            arriveAt: attack.arriveAt,
            gateSide: attack.gateSide,
            gateDist: attack.gateDist,
            gateAt: attack.gateAt,
            remainMs: attack.remainMs,
            breachedAt: attack.breachedAt || 0,
            heldForGate: !!attack.heldForGate
        })),
        holds: (state.holds || []).map((hold) => ({
            id: hold.id,
            faction: hold.faction,
            minor: MINOR_BASE + hold.minor,
            phase: hold.phase,
            path: hold.path,
            length: hold.length,
            startedAt: hold.startedAt,
            arriveAt: hold.arriveAt,
            heldMs: hold.heldMs || 0
        })),
        tributes: (state.tributes || []).map((cart) => ({
            id: cart.id,
            minor: MINOR_BASE + cart.minor,
            faction: cart.faction,
            phase: cart.phase,
            cargo: cart.cargo,
            path: cart.path,
            length: cart.length,
            startedAt: cart.startedAt,
            arriveAt: cart.arriveAt
        })),
        goblins: state.goblins && state.goblins.raid ? {
            id: state.goblins.raid.id,
            to: GOBLIN_VILLAGE,
            path: state.goblins.raid.path,
            length: state.goblins.raid.length,
            startedAt: state.goblins.raid.startedAt,
            arriveAt: state.goblins.raid.arriveAt,
            hp: state.goblins.raid.hp.slice()
        } : null,
        nextGoblinsAt: state.goblins ? state.goblins.nextAt : null,
        wilds: state.wilds ? state.wilds.hp.slice() : [],
        gates: (state.gates || freshGates()).map((row) => row.slice()),
        archers: (state.archers || freshArchers()).map((row) => row.slice()),
        villages: factions.map((place, index) => {
            const owner = state.owners[index];
            let alive = 0;
            eachLiving(state, owner, (unitIndex) => {
                if (state.post[keyOf(owner, unitIndex)] === index) alive += 1;
            });
            return {
                index,
                name: place.name,
                owner,
                ownerName: factions[owner].name,
                color: factions[owner].color,
                alive,
                attacked: state.attacks.some((attack) => attack.to === index),
                marching: state.attacks.some((attack) => attack.from === index),
                food: state.food[owner] || 0,
                wood: state.wood[owner] || 0,
                fishing: state.fishermen.some((man) => man.village === index && man.health > 0),
                fishers: state.fishermen.filter((man) => man.village === index && man.health > 0).length,
                farmers: (state.farms || []).filter((farm) => farm.village === index && farm.health > 0).reduce((sum, farm) => sum + farmCrew(farm), 0),
                chopping: state.woodcutters.some((man) => man.village === index && man.health > 0 && !man.ore),
                woodcutters: state.woodcutters.filter((man) => man.village === index && man.health > 0 && !man.ore).length,
                miners: state.woodcutters.filter((man) => man.village === index && man.health > 0 && man.ore).length,
                lumberjacks: allYards(state).filter((yard) => yard.village === index).reduce((sum, yard) => sum + (yard.jacks || []).filter((man) => man.health > 0).length, 0),
                yardWood: allYards(state).filter((yard) => yard.village === index).reduce((sum, yard) => sum + (yard.stock || 0), 0),
                hasYard: allYards(state).some((yard) => yard.village === index),
                pop: factionPop(state, owner),
                limit: popLimit(state, owner),
                works: (state.siteJobs || []).filter((job) => job.village === index).map((job) => job.kind).concat((state.farmJobs || []).filter((job) => job.village === index).map(() => "farm")),
                repairing: villageMending(state, index),
                training: state.training.filter((job) => job.village === index).map((job) => job.kind)
            };
        }),
        yard: state.yard ? {
            id: state.yard.id || "yard-home",
            owner: state.yard.owner,
            village: state.yard.village,
            x: YARD_AT.x,
            z: YARD_AT.z,
            stock: state.yard.stock || 0,
            haul: state.yard.haul || null
        } : null,
        yards: allYards(state).map((yard) => ({
            id: yard.id || "yard",
            owner: yard.owner,
            village: yard.village,
            x: yardPoint(yard).x,
            z: yardPoint(yard).z,
            stock: yard.stock || 0,
            haul: yard.haul || null
        })),
        lumberjacks: allYards(state).reduce((list, yard) => {
            const spot = yardPoint(yard);
            (yard.jacks || []).forEach((man, slot) => {
                if (man.health <= 0) return;
                const hauling = slot === 0 && yard.haul && (yard.haul.phase === "out" || yard.haul.phase === "back");
                const from = { x: spot.x + (slot - 1) * 2.4, z: spot.z + 3 };
                const to = { x: spot.x + 12 + slot, z: spot.z - 14 };
                list.push({
                    slot: list.length,
                    yardId: yard.id || "yard",
                    owner: yard.owner,
                    village: yard.village,
                    health: man.health,
                    hauling: hauling,
                    cycleStart: man.cycleStart || 0,
                    walkMs: 8000,
                    from: from,
                    to: to,
                    path: [from, to]
                });
            });
            return list;
        }, []),
        hero: Hero.normalize(state.hero),
        stance: factions.concat(minors).map((faction, index) => relation(state, PLAYER_FACTION, index)),
        grudges: (state.grudges || []).slice(),
        trails: state.trails || [],
        minors: minors.map((minor, index) => {
            const own = state.minors[index];
            const owner = hamletOwner(state, index);
            return {
                index: MINOR_BASE + index,
                name: minor.name,
                color: minor.color,
                owner,
                ownerName: nameOf(owner),
                ownerColor: owner < MINOR_BASE ? factions[owner].color : minor.color,
                protector: own.protector,
                protectorName: own.protector >= 0 ? nameOf(own.protector) : "",
                food: own.food || 0,
                wood: own.wood || 0,
                stone: own.stone || 0,
                gold: own.gold || 0,
                taking: (state.holds || []).filter((hold) => hold.minor === index && hold.phase === "hold").map((hold) => ({
                    name: nameOf(hold.faction),
                    heldMs: hold.heldMs || 0,
                    needMs: HOLD_MS
                })),
                pop: hamletPop(index, state),
                houses: hamletHouses(index, state),
                farmers: (state.farms || []).filter((item) => item.village === MINOR_BASE + index && item.health > 0).reduce((sum, item) => sum + farmCrew(item), 0),
                cutting: !!own.cutting,
                wants: hamletWants(state, index),
                building: (state.siteJobs || []).filter((job) => job.payer === MINOR_BASE + index).map((job) => job.kind)
                    .concat((state.farmJobs || []).filter((job) => job.payer === MINOR_BASE + index).map(() => "farm"))
            };
        }),
        factions: factions.map((faction, index) => {
            let alive = 0;
            eachLiving(state, index, () => { alive += 1; });
            const held = ownedBy(state, index);
            return {
                id: faction.id,
                name: faction.name,
                color: faction.color,
                village: index,
                soldiers: state.nextIndex[index],
                alive,
                food: state.food[index] || 0,
                units: shown[index].units,
                holds: held.map((village) => factions[village].name),
                pop: factionPop(state, index),
                limit: popLimit(state, index),
                upkeep: dailyFood(state, index),
                wood: state.wood[index] || 0,
                stone: (state.stone || [])[index] || 0,
                gold: (state.gold || [])[index] || 0,
                mines: (state.mines || []).filter((mine) => state.owners[mine.village] === index).length,
                houses: (state.houses || []).filter((house) => state.owners[house.village] === index).reduce((n, house) => n + (house.model === "houses" ? 5 : 1), 0)
                    + (starts ? starts.houses : []).filter((homes) => homes && state.owners[homes.village] === index).length * 5,
                farms: producingFarms(state, index),
                yards: yardsOf(state, index).length,
                building: (state.siteJobs || []).filter((job) => job.payer === index).map((job) => job.kind)
                    .concat((state.farmJobs || []).filter((job) => job.payer === index).map(() => "farm")),
                training: (state.training || []).filter((job) => state.owners[job.village] === index).map((job) => job.kind)
            };
        }),
        rules: campaignRules()
    };
}

// The numbers the campaign actually runs on, for the guide on the campaign page.
function campaignRules() {
    return {
        dayMs: Clock.DAY_MS,
        popBase: POP_BASE,
        housePop: HOUSE_POP,
        upkeep: 1,
        buildings: [
            housesModel
                ? { name: "Houses (five)", wood: BUILD_WOOD, ms: BUILD_MS, gives: "Room for " + HOUSES_POP + " more people", when: "Built first when room runs short, and whenever there is nothing else to build" }
                : { name: "House", wood: BUILD_WOOD, ms: BUILD_MS, gives: "Room for " + HOUSE_POP + " more people", when: "Built first when room runs short, and whenever there is nothing else to build" },
            { name: "Farm", wood: FARM_WOOD, ms: BUILD_MS, gives: FARM_PER_DAY + " food a day, worked by 2 farmers who live in the farmhouse", when: "Built whenever there is wood and room, up to " + FARM_CAP + " farms a village" },
            { name: "Lumberyard", wood: BUILD_WOOD, ms: BUILD_MS, gives: "Lumberjacks bring " + WOOD_YIELD + " wood every " + Math.round(JACK_MS / 1000) + " s", when: "Built once, when a faction has none" }
        ].concat(mineModel ? [
            { name: "Mine", wood: MINE_WOOD, ms: BUILD_MS, gives: "Lets a faction train " + MINERS_PER_MINE + " miners to dig the ore placed on the map", when: "Built once a faction has a lumberyard and no mine, if there is ore on the map; it goes up beside the nearest ore, however far away" }
        ] : []),
        fixed: [
            { name: "Village", gives: "Palisade, gates and a garrison post; holds " + POP_BASE + " people, counting its starting five Roblox houses. Starts with two farms (the old one and a Roblox one)" },
            { name: "Fishing cottage", gives: "One per village; fishermen land " + FISH_FOOD + " food a trip and carts carry it home" },
            { name: "Hamlet", gives: "Rural community: " + FOLK_PER_HOUSE + " people a house, its own farm, no soldiers. Keeps food, wood, stone and gold in its farmhouse and never declares war. Enemies of its protector take it by standing soldiers in the farmhouse for " + Math.round(HOLD_MS / 60000) + " minutes. It sends its protector " + Math.round(TRIBUTE_SHARE * 100) + "% of every store a day by cart. It builds one more farm, then five houses, then a mine, sending one of its workers to cut wood while it saves" }
        ],
        units: [
            { name: "Soldier", food: SOLDIER_COST, ms: RECRUIT_MS, does: "Guards and marches; " + MAX_HP + " hit points. Houses train as many as food and room allow" },
            { name: "Fisherman", food: FISHER_COST, ms: RECRUIT_MS, does: FISH_FOOD + " food a catch, about every " + Math.round(FISH_MS / 1000) + " s" },
            { name: "Woodcutter", food: FISHER_COST, ms: RECRUIT_MS, does: WOOD_YIELD + " wood a trip, about every " + Math.round(WOOD_MS / 1000) + " s. One more for every " + WOOD_PER_POP + " people" },
            { name: "Miner", food: FISHER_COST, ms: RECRUIT_MS, does: ORE_STONE + " stone and " + ORE_GOLD + " gold a trip to the nearest ore, digging about " + Math.round(ORE_MS / 1000) + " s" },
            { name: "Lumberjack", food: FISHER_COST, ms: RECRUIT_MS, does: "Works a lumberyard: " + WOOD_YIELD + " wood every " + Math.round(JACK_MS / 1000) + " s" }
        ],
        repair: { wood: REPAIR_CHUNK, ms: REPAIR_MS, gateHp: GATE_HP },
        goblins: {
            every: GOBLIN_EVERY,
            min: GOBLIN_MIN,
            max: GOBLIN_MAX,
            target: factions[GOBLIN_VILLAGE].name,
            camp: World.wildSpots(WILD_MAX).centre ? { daily: WILD_DAILY, max: WILD_MAX, after: WILD_AFTER } : null
        }
    };
}

const farmSiteList = Town.farmSites();

function hamletHouse(village, x, z, yaw, role) {
    const size = 4.7;
    return {
        x: x,
        z: z,
        y: Math.max(0, World.heightAt(x, z)),
        yaw: yaw,
        w: size,
        d: size,
        minX: x - size / 2,
        minZ: z - size / 2,
        mesh: "house",
        role: role,
        doorSide: 1,
        village: village
    };
}

function hamletLayout(minor, index) {
    const village = MINOR_BASE + index;
    const house = hamletHouse(village, minor.x + 8, minor.z, 0, "farmhouse");
    const field = { x: minor.x - 26, z: minor.z - 6, w: 18, d: 14 };
    const door = doorOf(house);
    const gate = Town.fieldGate(field, { x: house.x, z: house.z });
    const farm = {
        id: minor.id + "-farm",
        village: village,
        yaw: house.yaw,
        y: house.y,
        house: house,
        hay: [house.x - 5.5, house.z + 4],
        out: door.out,
        inn: door.inn,
        door: door.door,
        bed: { x: house.x, z: house.z, y: house.y },
        exits: [{ x: door.out.x, z: door.out.z }],
        fields: [field],
        haul: [{ x: gate.out.x, z: gate.out.z }, { x: door.out.x, z: door.out.z }]
    };
    const cottages = [
        hamletHouse(village, minor.x + 8, minor.z - 16, 0, "house"),
        hamletHouse(village, minor.x + 21, minor.z - 4, 0, "house")
    ];
    const outY = Math.max(0, World.heightAt(minor.x + 14, minor.z + 8));
    const outhouse = { x: minor.x + 14, z: minor.z + 8, y: outY, w: 1.3, d: 1.3 };
    const model = hamletModelFarm(minor, village, cottages, outhouse);
    if (model) model.id = farm.id;
    return { village, farm: model || farm, cottages, outhouse };
}

// The Roblox farm beside a hamlet's cottages, where there is level dry ground for it.
function hamletModelFarm(minor, village, cottages, outhouse) {
    if (!farmModel) return null;
    const blocked = cottages.map(rectOf).concat([{ minX: outhouse.x - 2, minZ: outhouse.z - 2, w: 4, d: 4 }]);
    const spots = [[-22, 0], [-22, -18], [-22, 18], [4, 30], [4, -38], [50, 0], [-50, 0], [20, 40], [20, -45]];
    for (const [dx, dz] of spots) {
        const site = layoutModelFarm({}, village, minor.x + dx, minor.z + dz, blocked, true);
        if (site) return site;
    }
    return null;
}

const hamlets = minors.map(hamletLayout);

function hamletHouses(index, state) {
    const built = state ? (state.houses || []).filter((house) => house.village === MINOR_BASE + index).length : 0;
    return 1 + hamlets[index].cottages.length + built * 5;
}

function hamletPop(index, state) {
    return hamletHouses(index, state) * FOLK_PER_HOUSE;
}

function hamletPlots() {
    const plots = [];
    hamlets.forEach((hamlet, index) => {
        const id = minors[index].id;
        const farm = hamlet.farm;
        plots.push({ id: farm.id, village: hamlet.village, kind: "farm", yaw: farm.yaw, house: farm.house, field: farm.fields[0], hay: farm.hay, door: farm.door, model: farm.model || null, at: farm.at || null });
        hamlet.cottages.forEach((house, n) => {
            plots.push({ id: id + "-house-" + n, village: hamlet.village, kind: "house", yaw: house.yaw, house: house });
        });
        const o = hamlet.outhouse;
        plots.push({ id: id + "-outhouse", village: hamlet.village, kind: "outhouse", x: o.x, z: o.z, y: o.y, w: o.w, d: o.d });
    });
    for (const farm of starts ? starts.farms : []) {
        if (farm) plots.push({ id: farm.id, village: farm.village, kind: "farm", yaw: farm.yaw, house: farm.house, field: farm.fields[0], hay: farm.hay, door: farm.door, model: farm.model, at: farm.at });
    }
    for (const site of (starts ? starts.houses : []).concat(shownMine())) {
        if (site) plots.push({ id: site.id, village: site.village, kind: site.kind, yaw: site.yaw, house: site.house, model: site.model, at: site.at });
    }
    return plots;
}

// Each village starts with a Roblox farm and five Roblox houses beside its original farm. They belong to whoever holds
// the village. They are placed once and kept in the save so they never move; Southwest's stand where the first test ones stood.
let starts = null;

function startSites() {
    return starts ? starts.farms.concat(starts.houses).filter(Boolean) : [];
}

function startFarm(id) {
    return starts ? starts.farms.find((farm) => farm && farm.id === id) || null : null;
}

function ensureStarts(state) {
    if (starts) return false;
    if (state.starts && Array.isArray(state.starts.farms) && Array.isArray(state.starts.houses)) {
        starts = state.starts;
        return false;
    }
    starts = { farms: [null, null, null, null], houses: [null, null, null, null] };
    for (let village = 0; village < 4; village++) {
        let farm = null;
        if (farmModel) farm = village === 2 ? layoutModelFarm({}, 2, -2407.2, 540.2, []) : pickFarmSite(state, village);
        if (farm) farm.id = "show-farm-" + village;
        starts.farms[village] = farm;
        let homes = null;
        if (housesModel && village === 2 && farm) {
            for (const spot of [[-2365, 540], [-2365, 505], [-2405, 495], [-2365, 575]]) {
                homes = layoutModelSite({}, 2, spot[0], spot[1], [farm.rect], "house");
                if (homes) break;
            }
        } else if (housesModel) {
            homes = pickModelSite(state, village, "house");
        }
        if (homes) homes.id = "show-houses-" + village;
        starts.houses[village] = homes;
    }
    state.starts = starts;
    return true;
}

// The Roblox mine stood outside Southwest to look at; it is not part of the campaign.
let showMine;
function shownMine() {
    if (showMine !== undefined) return showMine;
    const farm = starts && starts.farms[2];
    const homes = starts && starts.houses[2];
    if (!mineModel || !farm || !homes) return null;
    showMine = null;
    for (const spot of [[-2405, 505], [-2365, 535], [-2340, 600], [-2400, 590]]) {
        showMine = layoutModelSite({}, 2, spot[0], spot[1], [farm.rect, homes.rect], "mine");
        if (showMine) break;
    }
    if (showMine) showMine.id = "show-mine-2";
    return showMine;
}

function ensureMinors(state) {
    let dirty = false;
    if (!Array.isArray(state.minors)) state.minors = [];
    if (!state.relations || typeof state.relations !== "object") {
        state.relations = {};
        dirty = true;
    }
    if (state.minors.length > minors.length) {
        state.minors.length = minors.length;
        dirty = true;
    }
    const fresh = freshMinors();
    for (let index = state.minors.length; index < minors.length; index++) {
        state.minors.push(fresh[index]);
        const friend = Number.isInteger(minors[index].ally) ? state.owners[minors[index].ally] : -1;
        if (friend >= 0 && friend < MINOR_BASE && homeVillage(state, friend) >= 0) {
            setRelation(state, friend, MINOR_BASE + index, "ally");
            state.minors[index].protector = friend;
        }
        dirty = true;
    }
    state.minors.forEach((minor, index) => {
        for (const key of STORES.concat("tributeDay")) {
            if (Number.isFinite(minor[key])) continue;
            minor[key] = key === "tributeDay" ? -1 : 0;
            dirty = true;
        }
        if (minor.owner >= 0) {
            const holder = minor.owner;
            minor.owner = -1;
            minor.protector = holder;
            setRelation(state, holder, MINOR_BASE + index, "ally");
            dirty = true;
        }
    });
    if (!Array.isArray(state.holds)) {
        state.holds = [];
        dirty = true;
    }
    if (!Array.isArray(state.tributes)) {
        state.tributes = [];
        dirty = true;
    }
    return dirty;
}

function nearestMajor(state, minorIndex, accept) {
    const spot = minors[minorIndex];
    let best = -1;
    let bestD = Infinity;
    for (let faction = 0; faction < MINOR_BASE; faction++) {
        if (!accept(faction)) continue;
        for (const village of ownedBy(state, faction)) {
            const d = Math.hypot(places[village].x - spot.x, places[village].z - spot.z);
            if (d < bestD) {
                bestD = d;
                best = faction;
            }
        }
    }
    return best;
}

function considerMinors(state, now) {
    let dirty = false;
    state.minors.forEach((minor, index) => {
        const self = MINOR_BASE + index;
        const name = minors[index].name;
        const p = minor.protector;
        if (p >= 0 && (relation(state, p, self) !== "ally" || homeVillage(state, p) < 0)) {
            minor.protector = -1;
            dirty = true;
        }
        if (minor.protector < 0) {
            const ally = nearestMajor(state, index, (f) => relation(state, f, self) === "ally");
            const pick = ally >= 0 ? ally : nearestMajor(state, index, (f) => relation(state, f, self) === "peace" && !(minor.declined || []).includes(f));
            if (pick >= 0) {
                minor.protector = pick;
                note(state, name + " asks " + nameOf(pick) + " for protection.");
                setRelation(state, pick, self, "ally");
                dirty = true;
            }
        }
    });
    if (stepHolds(state, now)) dirty = true;
    if (sendHolds(state, now)) dirty = true;
    if (payTribute(state, now)) dirty = true;
    if (moveTribute(state, now)) dirty = true;
    return dirty;
}

// Hamlets never declare war. Only enemies of a hamlet's protector may move on it.
function canTake(state, faction, index) {
    const p = state.minors[index].protector;
    return faction !== p && (p < 0 || atWar(state, faction, p));
}

// Overland route between two points that keeps out of water, preferring roads (and so their bridges).
const ROUTE_CELL = 12;
const routeCells = new Map();
const routeCache = new Map();

function routeCell(i, j) {
    const key = i * 100000 + j;
    let cell = routeCells.get(key);
    if (cell === undefined) {
        const x = i * ROUTE_CELL;
        const z = j * ROUTE_CELL;
        cell = World.wet(x, z) ? 0 : World.roadDist(x, z) < 10 ? 0.5 : 1;
        routeCells.set(key, cell);
    }
    return cell;
}

function landRoute(a, b) {
    const cacheKey = Math.round(a.x) + "," + Math.round(a.z) + ">" + Math.round(b.x) + "," + Math.round(b.z);
    if (routeCache.has(cacheKey)) return routeCache.get(cacheKey);
    const si = Math.round(a.x / ROUTE_CELL);
    const sj = Math.round(a.z / ROUTE_CELL);
    const gi = Math.round(b.x / ROUTE_CELL);
    const gj = Math.round(b.z / ROUTE_CELL);
    const keyOfCell = (i, j) => i * 100000 + j;
    const guess = (i, j) => Math.hypot(i - gi, j - gj) * 0.5;
    const cost = new Map([[keyOfCell(si, sj), 0]]);
    const came = new Map();
    const heap = [[guess(si, sj), si, sj]];
    const push = (item) => {
        heap.push(item);
        let n = heap.length - 1;
        while (n > 0) {
            const up = (n - 1) >> 1;
            if (heap[up][0] <= heap[n][0]) break;
            [heap[up], heap[n]] = [heap[n], heap[up]];
            n = up;
        }
    };
    const pop = () => {
        const top = heap[0];
        const last = heap.pop();
        if (heap.length) {
            heap[0] = last;
            let n = 0;
            for (;;) {
                const l = n * 2 + 1;
                const r = l + 1;
                let m = n;
                if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                if (m === n) break;
                [heap[m], heap[n]] = [heap[n], heap[m]];
                n = m;
            }
        }
        return top;
    };
    let found = false;
    let spent = 0;
    while (heap.length && spent < 300000) {
        const [, i, j] = pop();
        const here = keyOfCell(i, j);
        if (i === gi && j === gj) {
            found = true;
            break;
        }
        spent += 1;
        const base = cost.get(here);
        for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                if (!di && !dj) continue;
                const ni = i + di;
                const nj = j + dj;
                const goal = ni === gi && nj === gj;
                const step = goal ? 1 : routeCell(ni, nj);
                if (!step) continue;
                const next = base + Math.hypot(di, dj) * step;
                const key = keyOfCell(ni, nj);
                if (cost.has(key) && cost.get(key) <= next) continue;
                cost.set(key, next);
                came.set(key, here);
                push([next + guess(ni, nj), ni, nj]);
            }
        }
    }
    let points = [a, b];
    if (found) {
        const cells = [];
        for (let key = keyOfCell(gi, gj); key !== undefined; key = came.get(key)) {
            const i = Math.round(key / 100000);
            cells.push({ x: i * ROUTE_CELL, z: (key - i * 100000) * ROUTE_CELL });
        }
        cells.reverse();
        cells[0] = a;
        cells[cells.length - 1] = b;
        points = [a];
        let at = 0;
        while (at < cells.length - 1) {
            let reach = at + 1;
            for (let k = Math.min(cells.length - 1, at + 40); k > at + 1; k--) {
                if (!pathWet([cells[at], cells[k]])) {
                    reach = k;
                    break;
                }
            }
            points.push(cells[reach]);
            at = reach;
        }
    }
    routeCache.set(cacheKey, points);
    return points;
}

// From a village storehouse out through the gate and overland to a hamlet's farmhouse door.
function hamletRoute(village, index) {
    const farm = hamlets[index].farm;
    const lane = villagerPath(village, farm.out);
    return lane.slice(0, -1).concat(landRoute(lane[lane.length - 2], farm.out).slice(1));
}

function holdPath(village, index) {
    const farm = hamlets[index].farm;
    return hamletRoute(village, index).concat([farm.door, farm.inn, { x: farm.bed.x, z: farm.bed.z }]);
}

function marchHome(hold, now) {
    hold.phase = "home";
    hold.path = hold.path.slice().reverse();
    hold.startedAt = now;
    hold.arriveAt = now + Math.round(hold.length / MARCH_SPEED * 1000);
}

function stepHolds(state, now) {
    let dirty = false;
    const keep = [];
    for (const hold of state.holds) {
        const name = minors[hold.minor].name;
        const living = hold.indexes.filter((index) => healthOf(state, hold.faction, index) > 0);
        if (living.length !== hold.indexes.length) {
            hold.indexes = living;
            dirty = true;
        }
        if (!living.length) {
            note(state, nameOf(hold.faction) + " loses its men at " + name + ".");
            dirty = true;
            continue;
        }
        if (hold.phase === "home") {
            if (now < hold.arriveAt) keep.push(hold);
            else dirty = true;
            continue;
        }
        if (!canTake(state, hold.faction, hold.minor)) {
            marchHome(hold, now);
            keep.push(hold);
            dirty = true;
            continue;
        }
        if (hold.phase === "march") {
            if (now >= hold.arriveAt) {
                hold.phase = "hold";
                hold.heldMs = 0;
                hold.seen = now;
                note(state, nameOf(hold.faction) + " soldiers stand in " + name + "'s farmhouse.");
                dirty = true;
            }
            keep.push(hold);
            continue;
        }
        const contested = state.holds.some((other) => other !== hold && other.minor === hold.minor && other.phase === "hold" && atWar(state, other.faction, hold.faction));
        if (!contested) hold.heldMs = (hold.heldMs || 0) + Math.max(0, now - (hold.seen || now));
        hold.seen = now;
        dirty = true;
        if (hold.heldMs >= HOLD_MS) {
            const minor = state.minors[hold.minor];
            const self = MINOR_BASE + hold.minor;
            const old = minor.protector;
            minor.protector = hold.faction;
            minor.declined = (minor.declined || []).filter((f) => f !== hold.faction);
            if (old >= 0) setRelation(state, old, self, "peace");
            setRelation(state, hold.faction, self, "ally");
            note(state, "The lord of " + name + " yields to " + nameOf(hold.faction) + ".");
            marchHome(hold, now);
        }
        keep.push(hold);
    }
    state.holds = keep;
    return dirty;
}

const holdThink = [0, 0, 0, 0];

function sendHolds(state, now) {
    if (now < (state.marchAfter || 0)) return false;
    let dirty = false;
    for (let faction = 0; faction < MINOR_BASE; faction++) {
        if (now < holdThink[faction]) continue;
        holdThink[faction] = now + 60000;
        if (state.holds.some((hold) => hold.faction === faction)) continue;
        const from = strongest(state, faction);
        if (from < 0) continue;
        const company = fielded(state, faction, from);
        const party = company.slice(0, Math.min(HOLD_PARTY, company.length - HOLD_SPARE));
        if (!party.length) continue;
        let best = -1;
        let bestD = Infinity;
        state.minors.forEach((minor, index) => {
            if (!canTake(state, faction, index)) return;
            const d = Math.hypot(minors[index].x - places[from].x, minors[index].z - places[from].z);
            if (d < bestD) {
                bestD = d;
                best = index;
            }
        });
        if (best < 0) continue;
        const path = holdPath(from, best);
        const length = pathLength(path);
        state.holds.push({
            id: "hold-" + faction + "-" + now,
            faction,
            minor: best,
            from,
            indexes: party.map((unit) => unit.index),
            phase: "march",
            path,
            length,
            startedAt: now,
            arriveAt: now + Math.round(length / MARCH_SPEED * 1000),
            heldMs: 0
        });
        note(state, nameOf(faction) + " sends soldiers to " + minors[best].name + ".");
        dirty = true;
    }
    return dirty;
}

// Once a game day an allied hamlet carts a tenth of each store to its protector's storehouse; the cart goes home and is gone.
function payTribute(state, now) {
    const play = playClock(state);
    if (play == null) return false;
    const today = Clock.day(play);
    let dirty = false;
    state.minors.forEach((minor, index) => {
        if (minor.tributeDay === today) return;
        const first = minor.tributeDay < 0;
        minor.tributeDay = today;
        dirty = true;
        const p = minor.protector;
        if (first || p < 0 || p >= MINOR_BASE) return;
        const home = homeVillage(state, p);
        if (home < 0) return;
        const cargo = {};
        let total = 0;
        for (const key of STORES) {
            const share = Math.floor((minor[key] || 0) * TRIBUTE_SHARE);
            minor[key] = (minor[key] || 0) - share;
            cargo[key] = share;
            total += share;
        }
        if (!total) return;
        const path = hamletRoute(home, index).slice().reverse();
        const length = pathLength(path);
        state.tributes.push({
            id: "tribute-" + index + "-" + today,
            minor: index,
            faction: p,
            cargo,
            phase: "out",
            path,
            length,
            startedAt: now,
            arriveAt: now + Math.round(length / FISH_WALK * 1000)
        });
        note(state, minors[index].name + " sends tribute to " + nameOf(p) + ".");
    });
    return dirty;
}

function moveTribute(state, now) {
    let dirty = false;
    const keep = [];
    for (const cart of state.tributes) {
        if (now < cart.arriveAt) {
            keep.push(cart);
            continue;
        }
        dirty = true;
        if (cart.phase !== "out") continue;
        const got = [];
        for (const key of STORES) {
            const amount = cart.cargo[key] || 0;
            if (!amount) continue;
            if (!Array.isArray(state[key])) state[key] = [0, 0, 0, 0];
            state[key][cart.faction] = (state[key][cart.faction] || 0) + amount;
            got.push(amount + " " + key);
        }
        note(state, minors[cart.minor].name + "'s tribute reaches " + nameOf(cart.faction) + ": " + got.join(", ") + ".");
        cart.phase = "back";
        cart.path = cart.path.slice().reverse();
        cart.startedAt = now;
        cart.arriveAt = now + Math.round(cart.length / FISH_WALK * 1000);
        keep.push(cart);
    }
    state.tributes = keep;
    return dirty;
}

function setStance(state, other, kind) {
    const self = PLAYER_FACTION;
    if (!Number.isInteger(other) || other < 0 || other >= MINOR_BASE + minors.length || other === self) return;
    if (!["war", "peace", "ally"].includes(kind)) return;
    if (other < MINOR_BASE && homeVillage(state, other) < 0) return;
    if (other >= MINOR_BASE && kind === "war" && !canTake(state, self, other - MINOR_BASE)) return;
    setRelation(state, self, other, kind);
    if (other < MINOR_BASE) return;
    const minor = state.minors[other - MINOR_BASE];
    if (!minor.declined) minor.declined = [];
    if (kind === "ally") {
        minor.declined = minor.declined.filter((f) => f !== self);
        if (minor.protector < 0) minor.protector = self;
    } else {
        if (!minor.declined.includes(self)) minor.declined.push(self);
        if (minor.protector === self) minor.protector = -1;
    }
}

function farmCrew(farm) {
    if (farm && Number.isInteger(farm.crew) && farm.crew > 0) return farm.crew;
    if (farm && farmSiteList.some((site) => site.id === farm.id)) return 2;
    return 1;
}

function farmSite(state, id) {
    const fixed = farmSiteList.find((site) => site.id === id);
    if (fixed) return fixed;
    const hamlet = hamlets.find((item) => item.farm.id === id);
    if (hamlet) return hamlet.farm;
    const start = startFarm(id);
    if (start) return start;
    return (state.builtFarms || []).find((site) => site.id === id) || null;
}

function rectOf(box) {
    return {
        minX: box.minX != null ? box.minX : box.x,
        minZ: box.minZ != null ? box.minZ : box.z,
        w: box.w,
        d: box.d
    };
}

function rectsHit(a, b, pad) {
    const p = pad || 0;
    return a.minX - p < b.minX + b.w && a.minX + a.w + p > b.minX && a.minZ - p < b.minZ + b.d && a.minZ + a.d + p > b.minZ;
}

function outsideWalls(village, rect) {
    const wall = palisadeBox(village);
    const pad = 8;
    if (rect.minX + rect.w < wall.minX - pad) return true;
    if (rect.minX > wall.maxX + pad) return true;
    if (rect.minZ + rect.d < wall.minZ - pad) return true;
    if (rect.minZ > wall.maxZ + pad) return true;
    return false;
}

function pathWet(path) {
    for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const steps = Math.max(1, Math.ceil(len / 8));
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            if (World.wet(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return true;
        }
    }
    return false;
}

function standingFarms(state, village) {
    let n = farmSiteList.filter((site) => site.village === village).length;
    n += (state.builtFarms || []).filter((site) => site.village === village).length;
    n += (state.farmJobs || []).filter((job) => job.village === village).length;
    return n;
}

function producingFarms(state, faction) {
    let n = 0;
    for (let village = 0; village < 4; village++) {
        if (state.owners[village] !== faction) continue;
        for (const farm of state.farms || []) {
            if (farm.village === village && farm.health > 0) n += 1;
        }
        for (const site of state.builtFarms || []) {
            if (site.village !== village) continue;
            if ((state.farms || []).some((farm) => farm.id === site.id)) continue;
            n += 1;
        }
        n += (state.farmJobs || []).filter((job) => job.village === village).length;
    }
    return n;
}

function farmVillage(state, faction) {
    let best = -1;
    let bestN = Infinity;
    for (let village = 0; village < 4; village++) {
        if (state.owners[village] !== faction) continue;
        const n = standingFarms(state, village);
        if (n >= FARM_CAP) continue;
        if (n < bestN) {
            bestN = n;
            best = village;
        }
    }
    return best;
}

// Builders clear trees and fill mounds and slopes, so only water, roads, streets and fields keep them off.
function landOpen(x, z) {
    if (World.wet(x, z) || World.inField(x, z) || Town.street(x, z)) return false;
    if (World.heightAt(x, z) < 0.45 || World.roadDist(x, z) < 18) return false;
    const box = World.peakBox;
    return !(x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ);
}

// Where a village or hamlet's buildings gather round.
function centreOf(village) {
    return village < MINOR_BASE ? places[village] : minors[village - MINOR_BASE];
}

function buildAnchors(state, village) {
    const points = [centreOf(village)];
    const add = (site) => {
        if (!site || site.village !== village) return;
        const at = site.at || site.house || site;
        if (Number.isFinite(at.x) && Number.isFinite(at.z)) points.push({ x: at.x, z: at.z });
    };
    startSites().forEach(add);
    (state.builtFarms || []).forEach(add);
    (state.farmJobs || []).forEach((job) => add(job.site));
    (state.houses || []).forEach(add);
    (state.siteJobs || []).forEach(add);
    (state.yards || []).forEach(add);
    (state.mines || []).forEach(add);
    if (village >= MINOR_BASE) add(hamlets[village - MINOR_BASE].farm);
    return points;
}

function inReach(anchors, x, z) {
    const centre = anchors[0];
    if (Math.hypot(x - centre.x, z - centre.z) > BUILD_REACH) return false;
    return anchors.some((point) => Math.hypot(x - point.x, z - point.z) <= BUILD_STEP);
}

// Spots to try around each of the village's buildings, nearest the village first.
function buildSpots(state, village, rings) {
    const anchors = buildAnchors(state, village);
    const centre = anchors[0];
    const spots = [];
    const seen = new Set();
    anchors.forEach((anchor, a) => {
        for (const dist of rings) {
            for (let i = 0; i < 12; i++) {
                const ang = (i / 12) * Math.PI * 2 + dist * 0.01 + a * 0.37;
                const x = anchor.x + Math.cos(ang) * dist;
                const z = anchor.z + Math.sin(ang) * dist;
                const key = Math.round(x / 15) + ":" + Math.round(z / 15);
                if (seen.has(key) || !inReach(anchors, x, z)) continue;
                seen.add(key);
                spots.push({ x, z, d: Math.hypot(x - centre.x, z - centre.z) });
            }
        }
    });
    return spots.sort((p, q) => p.d - q.d);
}

// Tries spots nearest first and keeps the best of the first few that work.
function bestSite(spots, layout, score) {
    let pick = null;
    let found = 0;
    for (let i = 0; i < spots.length && i < 260 && found < 6; i++) {
        const site = layout(spots[i].x, spots[i].z);
        if (!site) continue;
        found += 1;
        if (!pick || score(site) < score(pick)) pick = site;
    }
    return pick;
}

// Hamlets have no palisade; their own houses are kept clear as blocked rects instead.
function clearOfWalls(village, rect) {
    return village >= MINOR_BASE || outsideWalls(village, rect);
}

function takenRects(state) {
    const rects = [];
    for (const building of Town.buildings) rects.push(rectOf(building));
    for (const field of World.fields) rects.push({ minX: field.x, minZ: field.z, w: field.w, d: field.d });
    for (let village = 0; village < 4; village++) {
        const cot = World.cottageLayout(village);
        rects.push({ minX: cot.x, minZ: cot.z, w: cot.w, d: cot.d });
    }
    for (const plot of hamletPlots()) {
        if (plot.kind === "outhouse") rects.push({ minX: plot.x - plot.w / 2, minZ: plot.z - plot.d / 2, w: plot.w, d: plot.d });
    }
    for (const site of startSites()) rects.push(site.rect);
    if (shownMine()) rects.push(shownMine().rect);
    for (const mine of state.mines || []) rects.push(mine.rect);
    const sites = (state.builtFarms || []).concat((state.farmJobs || []).map((job) => job.site));
    for (const house of state.houses || []) rects.push(rectOf(house.house || house));
    for (const yard of state.yards || []) rects.push({ minX: yard.x - yard.w / 2, minZ: yard.z - yard.d / 2, w: yard.w, d: yard.d });
    for (const job of state.siteJobs || []) if (job.rect) rects.push(job.rect);
    for (const hamlet of hamlets) {
        if (hamlet.farm.rect) rects.push(hamlet.farm.rect);
        for (const house of [hamlet.farm.house].concat(hamlet.cottages)) rects.push(rectOf(house));
        const field = hamlet.farm.fields[0];
        rects.push({ minX: field.x, minZ: field.z, w: field.w, d: field.d });
    }
    for (const site of sites) {
        if (site.rect) rects.push(site.rect);
        rects.push(rectOf(site.house));
        const field = site.fields[0];
        if (field) rects.push({ minX: field.x, minZ: field.z, w: field.w, d: field.d });
    }
    return rects;
}

function snapYaw(dx, dz) {
    if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? -Math.PI / 2 : Math.PI / 2;
    return dz > 0 ? Math.PI : 0;
}

function doorOf(house) {
    const s = Math.sin(house.yaw);
    const c = Math.cos(house.yaw);
    const fx = -s;
    const fz = -c;
    const half = (Math.abs(fx) > Math.abs(fz) ? house.w : house.d) * 0.5;
    const side = house.doorSide == null ? 1 : house.doorSide;
    const x = house.x + fx * (half - 0.06) - c * side;
    const z = house.z + fz * (half - 0.06) + s * side;
    return {
        door: { x: x, z: z },
        out: { x: x + fx * 1.2, z: z + fz * 1.2 },
        inn: { x: x - fx * 0.9, z: z - fz * 0.9 },
        fx: fx,
        fz: fz
    };
}

// The level pad a site stands on: the highest ground under it, so the slope score is how much earth it takes.
// Without `land` only the height is checked (lumberyards stand beside trees on purpose).
function padFor(rect, land, rise = FILL_MAX) {
    let low = Infinity;
    let high = -Infinity;
    const nx = Math.max(1, Math.ceil(rect.w / 6));
    const nz = Math.max(1, Math.ceil(rect.d / 6));
    for (let i = 0; i <= nx; i++) {
        for (let j = 0; j <= nz; j++) {
            const x = rect.minX + (rect.w * i) / nx;
            const z = rect.minZ + (rect.d * j) / nz;
            if (land && !landOpen(x, z)) return null;
            const h = World.heightAt(x, z);
            low = Math.min(low, h);
            high = Math.max(high, h);
        }
    }
    if (high - low > rise) return null;
    return { minX: rect.minX, minZ: rect.minZ, w: rect.w, d: rect.d, y: high, slope: high - low };
}

// Pads of everything built or being built, shared with the world so walking, building and drawing all see level ground.
function syncPads(state) {
    const pads = [];
    const add = (site) => {
        if (site && site.pad) pads.push({ minX: site.pad.minX, minZ: site.pad.minZ, w: site.pad.w, d: site.pad.d, y: site.pad.y });
    };
    (state.builtFarms || []).forEach(add);
    (state.farmJobs || []).forEach((job) => add(job.site));
    (state.houses || []).forEach(add);
    (state.siteJobs || []).forEach(add);
    (state.yards || []).forEach(add);
    (state.mines || []).forEach(add);
    hamlets.forEach((hamlet) => add(hamlet.farm));
    startSites().forEach(add);
    add(shownMine());
    World.setPads(pads);
    return pads;
}

function quarterTurn(village, cx, cz) {
    const place = centreOf(village);
    const dx = place.x - cx;
    const dz = place.z - cz;
    const toward = Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx), z: 0 } : { x: 0, z: Math.sign(dz) };
    return Math.atan2(-toward.z, toward.x);
}

// A Roblox building site (the five houses or a mine) on a level pad outside the walls, turned to face the village.
function layoutModelSite(state, village, cx, cz, blocked, kind) {
    const name = kind === "mine" ? "mine" : "houses";
    const model = kind === "mine" ? mineModel : housesModel;
    const place = centreOf(village);
    const dist = Math.hypot(place.x - cx, place.z - cz);
    if (dist < (village >= MINOR_BASE ? 35 : 60) || (kind !== "mine" && dist > BUILD_REACH)) return null;
    const at = { x: cx, z: cz, theta: quarterTurn(village, cx, cz) };
    const whole = placeRect({ x: 0, z: 0, w: model.w, d: model.d }, at);
    const rect = { minX: whole.minX, minZ: whole.minZ, w: whole.w, d: whole.d };
    if (!clearOfWalls(village, rect)) return null;
    for (const other of blocked) {
        if (rectsHit(rect, other, 3)) return null;
    }
    const pad = padFor(rect, true);
    if (!pad) return null;
    at.y = pad.y;
    const yaw = snapYaw(place.x - cx, place.z - cz);
    return {
        village: village,
        kind: kind,
        x: cx,
        z: cz,
        y: pad.y,
        yaw: yaw,
        w: whole.w,
        d: whole.d,
        rect: rect,
        score: pad.slope,
        model: name,
        at: at,
        pad: pad,
        house: { x: cx, z: cz, y: pad.y, yaw: yaw, w: whole.w, d: whole.d, minX: rect.minX, minZ: rect.minZ, mesh: "house", role: kind, doorSide: 1, village: village }
    };
}

function pickModelSite(state, village, kind) {
    const blocked = takenRects(state);
    // A mine goes up beside its ore, wherever that is.
    const ore = kind === "mine" ? nearestOre(centreOf(village), 0) : null;
    if (ore) {
        const spots = [];
        for (const dist of [18, 26, 36, 48, 62]) {
            for (let i = 0; i < 12; i++) {
                const ang = (i / 12) * Math.PI * 2 + dist * 0.01;
                spots.push({ x: ore.x + Math.cos(ang) * dist, z: ore.z + Math.sin(ang) * dist });
            }
        }
        return bestSite(spots, (x, z) => layoutModelSite(state, village, x, z, blocked, kind), (site) => site.score + Math.hypot(site.x - ore.x, site.z - ore.z) / 10);
    }
    const spots = buildSpots(state, village, [45, 75, 110, 150, 195]);
    return bestSite(spots, (x, z) => layoutModelSite(state, village, x, z, blocked, kind), (site) => site.score);
}

// Model rects are centred and quarter-turned about the farm centre, so width and depth swap on a side turn.
function placeRect(r, at) {
    const c = Math.round(Math.cos(at.theta));
    const s = Math.round(Math.sin(at.theta));
    const x = at.x + r.x * c + r.z * s;
    const z = at.z - r.x * s + r.z * c;
    const w = s ? r.d : r.w;
    const d = s ? r.w : r.d;
    return { x, z, w, d, minX: x - w / 2, minZ: z - d / 2 };
}

// `home` is a hamlet's own starting farm: it stands right by the hamlet and its farmhouse is the hamlet's store.
function layoutModelFarm(state, village, cx, cz, blocked, home) {
    const place = centreOf(village);
    const hamlet = village >= MINOR_BASE;
    const at = { x: cx, z: cz, theta: quarterTurn(village, cx, cz) };
    const whole = placeRect({ x: 0, z: 0, w: farmModel.w, d: farmModel.d }, at);
    const dist = Math.hypot(place.x - cx, place.z - cz);
    if (dist < (home ? 0 : hamlet ? 35 : 60) || dist > (home ? 80 : BUILD_REACH)) return null;
    const wholeRect = { minX: whole.minX, minZ: whole.minZ, w: whole.w, d: whole.d };
    if (!clearOfWalls(village, wholeRect)) return null;
    for (const other of blocked) {
        if (rectsHit(wholeRect, other, 3)) return null;
    }
    if (home) {
        const r = wholeRect;
        const ring = [{ x: r.minX, z: r.minZ }, { x: r.minX + r.w, z: r.minZ }, { x: r.minX + r.w, z: r.minZ + r.d }, { x: r.minX, z: r.minZ + r.d }, { x: r.minX, z: r.minZ }];
        if (pathWet(ring) || pathWet([ring[0], ring[2]]) || pathWet([ring[1], ring[3]])) return null;
    }
    const pad = home ? padFor(wholeRect, false, PAD_RISE) : padFor(wholeRect, true);
    if (!pad) return null;
    const slope = pad.slope;
    const high = pad.y;
    at.y = high;
    const box = placeRect(farmModel.house, at);
    const c = Math.round(Math.cos(at.theta));
    const s = Math.round(Math.sin(at.theta));
    const house = {
        x: box.x,
        z: box.z,
        y: high,
        yaw: Math.atan2(c, -s),
        w: box.w,
        d: box.d,
        minX: box.minX,
        minZ: box.minZ,
        mesh: "house",
        role: "farmhouse",
        doorSide: 0,
        village: village
    };
    const fields = farmModel.fields.map((r) => {
        const f = placeRect(r, at);
        return { x: f.minX, z: f.minZ, w: f.w, d: f.d };
    });
    const door = doorOf(house);
    const site = {
        id: "raised-" + village + "-" + ((state.farmSerial || 0) + 1),
        village: village,
        yaw: house.yaw,
        y: high,
        house: house,
        hay: [door.out.x, door.out.z],
        out: door.out,
        inn: door.inn,
        door: door.door,
        bed: { x: house.x, z: house.z, y: high },
        exits: [{ x: door.out.x, z: door.out.z }].concat(fields.map((f) => ({ x: f.x + f.w / 2, z: f.z + f.d / 2 }))),
        fields: fields,
        slope: slope,
        model: "farm",
        at: at,
        rect: wholeRect,
        pad: pad
    };
    if (home) site.haul = [site.exits[1] || site.out, { x: door.out.x, z: door.out.z }];
    else if (hamlet) site.haul = [{ x: door.out.x, z: door.out.z }, hamlets[village - MINOR_BASE].farm.out];
    const path = pathToStore(site);
    if (!path || path.length < 2 || pathWet(path) || pathLength(path) > BUILD_REACH + 100) return null;
    return site;
}

function layoutFarm(state, village, cx, cz, blocked) {
    if (farmModel) return layoutModelFarm(state, village, cx, cz, blocked);
    const place = places[village];
    const dx = place.x - cx;
    const dz = place.z - cz;
    const len = Math.hypot(dx, dz) || 1;
    const hx = cx + (dx / len) * 15;
    const hz = cz + (dz / len) * 15;
    const yaw = snapYaw(dx, dz);
    const size = 4.7;
    const house = {
        x: hx,
        z: hz,
        y: Math.max(0, World.heightAt(hx, hz)),
        yaw: yaw,
        w: size,
        d: size,
        minX: hx - size / 2,
        minZ: hz - size / 2,
        mesh: "house",
        role: "farmhouse",
        doorSide: 1,
        village: village
    };
    const field = { x: cx - 8, z: cz - 6, w: 16, d: 12 };
    const houseRect = rectOf(house);
    const fieldRect = { minX: field.x, minZ: field.z, w: field.w, d: field.d };
    const houseDist = Math.hypot(hx - place.x, hz - place.z);
    const fieldDist = Math.hypot(cx - place.x, cz - place.z);
    if (houseDist < 44 || houseDist > BUILD_REACH) return null;
    if (fieldDist < 56 || fieldDist > BUILD_REACH) return null;
    if (!outsideWalls(village, houseRect) || !outsideWalls(village, fieldRect)) return null;
    if (rectsHit(houseRect, fieldRect, 0.4)) return null;
    const spots = [
        [hx, hz],
        [cx, cz],
        [field.x + 1, field.z + 1],
        [field.x + field.w - 1, field.z + 1],
        [field.x + 1, field.z + field.d - 1],
        [field.x + field.w - 1, field.z + field.d - 1]
    ];
    for (const spot of spots) {
        if (!landOpen(spot[0], spot[1])) return null;
    }
    const slope = 0;
    for (const rect of [houseRect, fieldRect]) {
        for (const other of blocked) {
            if (rectsHit(rect, other, 3)) return null;
        }
    }
    const door = doorOf(house);
    const sideX = -door.fz;
    const sideZ = door.fx;
    const site = {
        id: "raised-" + village + "-" + ((state.farmSerial || 0) + 1),
        village: village,
        yaw: yaw,
        y: house.y,
        house: house,
        hay: [hx - sideX * 2.4, hz - sideZ * 2.4],
        out: door.out,
        inn: door.inn,
        door: door.door,
        bed: { x: hx, z: hz, y: house.y },
        exits: [
            { x: door.out.x, z: door.out.z },
            { x: hx + sideX * 5.2, z: hz + sideZ * 5.2 },
            { x: cx, z: cz }
        ],
        fields: [field],
        slope: slope
    };
    const path = pathToStore(site);
    if (!path || path.length < 2 || pathWet(path) || pathLength(path) > BUILD_REACH + 100) return null;
    return site;
}

function pickFarmSite(state, village) {
    const blocked = takenRects(state);
    const spots = buildSpots(state, village, [45, 75, 110, 150, 195]);
    return bestSite(spots, (x, z) => layoutFarm(state, village, x, z, blocked), (site) => site.slope);
}

function layoutBuilding(state, village, x, z, blocked) {
    const place = places[village];
    const dist = Math.hypot(place.x - x, place.z - z);
    if (dist < 40 || dist > BUILD_REACH) return null;
    const w = 4.6;
    const d = 4.6;
    const rect = { minX: x - w / 2, minZ: z - d / 2, w: w, d: d };
    if (!outsideWalls(village, rect)) return null;
    for (const other of blocked) {
        if (rectsHit(rect, other, 2.5)) return null;
    }
    const yaw = snapYaw(place.x - x, place.z - z);
    const pad = padFor(rect, true);
    if (!pad) return null;
    const y = pad.y;
    return {
        village: village,
        kind: "house",
        x: x,
        z: z,
        y: y,
        yaw: yaw,
        w: w,
        d: d,
        rect: rect,
        pad: pad,
        score: pad.slope,
        house: {
            x: x,
            z: z,
            y: y,
            yaw: yaw,
            w: w,
            d: d,
            minX: rect.minX,
            minZ: rect.minZ,
            mesh: "house",
            role: "house",
            doorSide: 1,
            village: village
        }
    };
}

function treesAround(x, z, trees, radius) {
    let n = 0;
    const r2 = radius * radius;
    for (let i = 0; i < trees.length; i++) {
        const dx = trees[i].x - x;
        const dz = trees[i].z - z;
        if (dx * dx + dz * dz <= r2) n += 1;
    }
    return n;
}

function haulRisk(state, village, x, z, path) {
    const owner = state.owners[village];
    let risk = 0;
    for (let i = 0; i < 4; i++) {
        if (state.owners[i] === owner) continue;
        const place = places[i];
        if (Math.hypot(place.x - x, place.z - z) < 170) risk += 220;
        for (let p = 0; p < path.length; p++) {
            if (Math.hypot(place.x - path[p].x, place.z - path[p].z) < 55) {
                risk += 90;
                break;
            }
        }
    }
    return risk;
}

function layoutYard(state, village, x, z, blocked, trees) {
    if (World.wet(x, z) || Town.street(x, z)) return null;
    if (World.heightAt(x, z) < 0.4) return null;
    const timber = treesAround(x, z, trees, 34);
    if (timber < 3) return null;
    const at = yardModel ? { x: x, z: z, theta: quarterTurn(village, x, z) } : null;
    const whole = at ? placeRect({ x: 0, z: 0, w: yardModel.w, d: yardModel.d }, at) : null;
    const w = whole ? whole.w : 9;
    const d = whole ? whole.d : 5.6;
    const rect = { minX: x - w / 2, minZ: z - d / 2, w: w, d: d };
    if (!outsideWalls(village, rect)) return null;
    for (const other of blocked) {
        if (rectsHit(rect, other, 3)) return null;
    }
    const path = villagerPath(village, { x: x, z: z });
    if (!path || path.length < 2 || pathWet(path)) return null;
    const haul = pathLength(path);
    const place = places[village];
    const yaw = snapYaw(place.x - x, place.z - z);
    const pad = padFor(rect, null);
    if (!pad) return null;
    const y = pad.y;
    if (at) at.y = y;
    const risk = haulRisk(state, village, x, z, path);
    const worth = Math.min(timber, 14) * 22 - haul - risk;
    return {
        village: village,
        kind: "yard",
        x: x,
        z: z,
        y: y,
        yaw: yaw,
        w: w,
        d: d,
        rect: rect,
        pad: pad,
        model: at ? "lumberyard" : null,
        at: at,
        trees: timber,
        haul: haul,
        risk: risk,
        worth: worth,
        house: {
            x: x,
            z: z,
            y: y,
            yaw: yaw,
            w: w,
            d: d,
            minX: rect.minX,
            minZ: rect.minZ,
            mesh: "house",
            role: "lumber",
            doorSide: 1,
            village: village
        }
    };
}

function pickYard(state, village) {
    const place = places[village];
    const trees = [];
    const lists = [World.trees, World.groves];
    for (let list = 0; list < lists.length; list++) {
        const spots = lists[list];
        for (let i = 0; i < spots.length; i++) {
            const tree = spots[i];
            if (tree.kind === "bush" || tree.kind === "rock") continue;
            if (Math.abs(tree.x - place.x) > 560 || Math.abs(tree.z - place.z) > 560) continue;
            trees.push(tree);
        }
    }
    const blocked = takenRects(state);
    const seen = new Set();
    const found = [];
    for (let i = 0; i < trees.length; i++) {
        const tree = trees[i];
        const dx = place.x - tree.x;
        const dz = place.z - tree.z;
        const len = Math.hypot(dx, dz) || 1;
        const x = tree.x + (dx / len) * 16;
        const z = tree.z + (dz / len) * 16;
        const key = Math.round(x / 18) + ":" + Math.round(z / 18);
        if (seen.has(key)) continue;
        seen.add(key);
        const site = layoutYard(state, village, x, z, blocked, trees);
        if (site) found.push(site);
    }
    if (!found.length) return null;
    // A real stand beside the village is enough. Don't walk to a bigger wood, unless the near one sits in enemy ground.
    const close = found.filter((site) => site.haul < 200 && site.trees >= 6 && site.risk < 220);
    const pool = close.length ? close : found;
    let best = pool[0];
    for (let i = 1; i < pool.length; i++) {
        if (pool[i].worth > best.worth) best = pool[i];
    }
    return best;
}

function pickBuilding(state, village, kind) {
    if (kind === "yard") return pickYard(state, village);
    if (kind === "mine") return pickModelSite(state, village, "mine");
    if (housesModel) return pickModelSite(state, village, "house");
    const blocked = takenRects(state);
    const spots = buildSpots(state, village, [46, 80, 120, 160, 195]);
    return bestSite(spots, (x, z) => layoutBuilding(state, village, x, z, blocked), (site) => site.score);
}

function roomTight(state, faction) {
    return popLimit(state, faction) - factionPop(state, faction) <= (housesModel ? HOUSES_POP : HOUSE_POP) * 2;
}

function buildingBusy(state, faction) {
    if ((state.farmJobs || []).some((job) => job.payer === faction)) return true;
    return (state.siteJobs || []).some((job) => job.payer === faction);
}

function considerSites(state, now) {
    syncPads(state);
    let dirty = false;
    if (!Array.isArray(state.houses)) state.houses = [];
    if (!Array.isArray(state.yards)) state.yards = [];
    if (!Array.isArray(state.mines)) state.mines = [];
    if (!Array.isArray(state.siteJobs)) state.siteJobs = [];
    const keep = [];
    for (const job of state.siteJobs) {
        if (farmOwner(state, job.village) !== job.payer) {
            addStore(state, job.payer, "wood", job.cost || BUILD_WOOD);
            note(state, nameOf(job.payer) + " stops the " + job.kind + ".");
            dirty = true;
            continue;
        }
        if (!buildDue(state, job, now)) {
            keep.push(job);
            continue;
        }
        if (job.kind === "house") {
            state.houses.push({
                id: job.id,
                village: job.village,
                yaw: job.yaw,
                house: job.house,
                model: job.model,
                at: job.at,
                rect: job.rect,
                pad: job.pad
            });
            note(state, nameOf(job.payer) + (job.model === "houses" ? " finishes five houses." : " finishes a house."));
        } else if (job.kind === "mine") {
            state.mines.push({
                id: job.id,
                village: job.village,
                owner: job.payer,
                yaw: job.yaw,
                model: job.model,
                at: job.at,
                rect: job.rect,
                pad: job.pad
            });
            note(state, nameOf(job.payer) + " finishes a mine.");
        } else {
            state.yards.push({
                id: job.id,
                village: job.village,
                owner: job.payer,
                x: job.x,
                z: job.z,
                y: job.y,
                yaw: job.yaw,
                w: job.w,
                d: job.d,
                pad: job.pad,
                model: job.model || null,
                at: job.at || null,
                stock: 0,
                jacks: [],
                haul: null,
                sentDay: -1,
                sentSlot: -1,
                retryAt: 0
            });
            note(state, factions[job.payer].name + " finishes a lumberyard.");
        }
        dirty = true;
    }
    state.siteJobs = keep;
    for (let faction = 0; faction < 4; faction++) {
        if (buildingBusy(state, faction)) continue;
        const village = homeVillage(state, faction);
        if (village < 0) continue;
        // Room for more soldiers first, then a lumberyard and mine, then more room. Farms get their turn in considerFarms, which runs first.
        const tight = roomTight(state, faction);
        const hasYard = yardsOf(state, faction).length > 0;
        const hasMine = state.mines.some((mine) => state.owners[mine.village] === faction);
        const kind = tight ? "house" : !hasYard ? "yard" : mineModel && !hasMine && oreNear(village) ? "mine" : "house";
        const cost = kind === "mine" ? MINE_WOOD : BUILD_WOOD;
        if ((state.wood[faction] || 0) < cost) continue;
        const site = pickBuilding(state, village, kind);
        if (!site) continue;
        const readyPlay = buildReady(state);
        if (readyPlay == null) continue;
        state.buildSerial = (state.buildSerial || 0) + 1;
        state.wood[faction] -= cost;
        state.siteJobs.push({
            id: kind + "-" + village + "-" + state.buildSerial,
            village: village,
            payer: faction,
            kind: kind,
            cost: cost,
            readyPlay: readyPlay,
            x: site.x,
            z: site.z,
            y: site.y,
            yaw: site.yaw,
            w: site.w,
            d: site.d,
            rect: site.rect,
            house: site.house,
            model: site.model,
            at: site.at,
            pad: site.pad
        });
        const what = kind === "yard" ? "a lumberyard" : kind === "mine" ? "a mine" : site.model === "houses" ? "five houses" : "a house";
        note(state, factions[faction].name + " starts " + what + ".");
        dirty = true;
    }
    return dirty;
}

const farmThink = [0, 0, 0, 0];

function considerFarms(state, now) {
    syncPads(state);
    let dirty = false;
    if (!Array.isArray(state.farmJobs)) {
        state.farmJobs = [];
        dirty = true;
    }
    if (!Array.isArray(state.builtFarms)) {
        state.builtFarms = [];
        dirty = true;
    }
    const keep = [];
    for (const job of state.farmJobs) {
        if (farmOwner(state, job.village) !== job.payer) {
            addStore(state, job.payer, "wood", FARM_WOOD);
            note(state, nameOf(job.payer) + " stops the farm.");
            dirty = true;
            continue;
        }
        if (!buildDue(state, job, now)) {
            keep.push(job);
            continue;
        }
        state.builtFarms.push(job.site);
        note(state, nameOf(job.payer) + " finishes a farm.");
        dirty = true;
    }
    state.farmJobs = keep;
    for (let faction = 0; faction < 4; faction++) {
        if (buildingBusy(state, faction)) continue;
        if (now < farmThink[faction]) continue;
        if ((state.wood[faction] || 0) < FARM_WOOD || roomTight(state, faction)) {
            farmThink[faction] = now + 20000;
            continue;
        }
        const village = farmVillage(state, faction);
        const site = village < 0 ? null : pickFarmSite(state, village);
        if (!site) {
            farmThink[faction] = now + 60000;
            continue;
        }
        state.farmSerial = (state.farmSerial || 0) + 1;
        site.id = "raised-" + village + "-" + state.farmSerial;
        const readyPlay = buildReady(state);
        if (readyPlay == null) {
            farmThink[faction] = now + 20000;
            continue;
        }
        state.wood[faction] -= FARM_WOOD;
        state.farmJobs.push({
            id: site.id,
            village: village,
            payer: faction,
            readyPlay: readyPlay,
            site: site
        });
        note(state, factions[faction].name + " starts a farm.");
        farmThink[faction] = now + 20000;
        dirty = true;
    }
    return dirty;
}

function addStore(state, who, key, amount) {
    if (who >= MINOR_BASE) {
        const minor = state.minors[who - MINOR_BASE];
        minor[key] = (minor[key] || 0) + amount;
        return;
    }
    if (!Array.isArray(state[key])) state[key] = [0, 0, 0, 0];
    state[key][who] = (state[key][who] || 0) + amount;
}

// What a hamlet builds next: one more farm, then five houses, then a mine. Each costs 100 wood.
function hamletWants(state, index) {
    const village = MINOR_BASE + index;
    const here = (item) => item.village === village;
    if (farmModel && !(state.builtFarms || []).some(here) && !(state.farmJobs || []).some(here)) return "farm";
    if (housesModel && !(state.houses || []).some(here) && !(state.siteJobs || []).some((job) => here(job) && job.kind === "house")) return "house";
    if (mineModel && !(state.mines || []).some(here) && !(state.siteJobs || []).some((job) => here(job) && job.kind === "mine")) return "mine";
    return "";
}

const hamletThink = minors.map(() => 0);

// While a hamlet saves for a building, one of its two workers leaves the fields to cut wood.
function considerHamlets(state, now) {
    const play = playClock(state);
    if (play == null) return false;
    let dirty = false;
    state.minors.forEach((minor, index) => {
        const self = MINOR_BASE + index;
        const want = hamletWants(state, index);
        const busy = (state.farmJobs || []).some((job) => job.payer === self) || (state.siteJobs || []).some((job) => job.payer === self);
        const cost = want === "farm" ? FARM_WOOD : want === "mine" ? MINE_WOOD : BUILD_WOOD;
        const cutting = !!want && !busy && (minor.wood || 0) < cost;
        if (cutting !== !!minor.cutting) {
            minor.cutting = cutting;
            minor.cutPlay = play;
            dirty = true;
        }
        if (cutting) {
            const trips = Math.floor((play - (minor.cutPlay || play)) / WOOD_MS);
            if (trips > 0) {
                minor.wood = (minor.wood || 0) + trips * WOOD_YIELD;
                minor.cutPlay += trips * WOOD_MS;
                dirty = true;
            }
            return;
        }
        if (!want || busy || now < hamletThink[index]) return;
        hamletThink[index] = now + 60000;
        const readyPlay = buildReady(state);
        if (readyPlay == null) return;
        const name = minors[index].name;
        if (want === "farm") {
            const site = pickFarmSite(state, self);
            if (!site) return;
            state.farmSerial = (state.farmSerial || 0) + 1;
            site.id = "raised-" + self + "-" + state.farmSerial;
            minor.wood -= cost;
            state.farmJobs.push({ id: site.id, village: self, payer: self, readyPlay: readyPlay, site: site });
            note(state, name + " starts a farm.");
            dirty = true;
            return;
        }
        const site = pickModelSite(state, self, want);
        if (!site) return;
        state.buildSerial = (state.buildSerial || 0) + 1;
        minor.wood -= cost;
        state.siteJobs.push({
            id: want + "-" + self + "-" + state.buildSerial,
            village: self,
            payer: self,
            kind: want,
            cost: cost,
            readyPlay: readyPlay,
            x: site.x,
            z: site.z,
            y: site.y,
            yaw: site.yaw,
            w: site.w,
            d: site.d,
            rect: site.rect,
            house: site.house,
            model: site.model,
            at: site.at,
            pad: site.pad
        });
        note(state, name + " starts " + (want === "mine" ? "a mine." : "five houses."));
        dirty = true;
    });
    return dirty;
}

function farmAsleep(play) {
    const hour = Clock.hours(play);
    return hour >= 1 && hour < 5;
}

function farmSlot(play) {
    const hour = Clock.hours(play);
    if (hour < 5) return -1;
    if (hour >= 19) return 2;
    if (hour >= 14) return 1;
    if (hour >= 9) return 0;
    return -1;
}

function deliveryDue(farm, play) {
    const slot = farmSlot(play);
    if (slot < 0) return false;
    const day = Clock.day(play);
    if (farm.sentDay !== day) return true;
    return slot > (farm.sentSlot == null ? -1 : farm.sentSlot);
}

function markDelivery(farm, play) {
    farm.sentDay = Clock.day(play);
    farm.sentSlot = farmSlot(play);
}

function workSpots(site) {
    const spots = (site.exits || []).map((point) => ({ x: point.x, z: point.z }));
    for (const field of site.fields) {
        const gate = Town.fieldGate(field, site.bed);
        spots.push(gate.out, gate.inn);
        const cols = field.w > 40 ? 3 : 2;
        const rows = field.d > 30 ? 3 : 2;
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                spots.push({
                    x: field.x + field.w * (c + 1) / (cols + 1),
                    z: field.z + field.d * (r + 1) / (rows + 1)
                });
            }
        }
        spots.push(gate.inn, gate.out);
    }
    if (!spots.length) spots.push({ x: site.out.x, z: site.out.z });
    return spots;
}

function pathToStore(site) {
    if (site.haul) return site.haul;
    return villagerPath(site.village, { x: site.out.x, z: site.out.z }).slice().reverse();
}

function routeBlocked(state, village, path, now) {
    if (!path || path.length < 2) return true;
    const owner = state.owners[village];
    for (const attack of state.attacks || []) {
        if (attack.resolved || attack.to !== village || attack.faction === owner) continue;
        if (attack.heldForGate && !attack.breachedAt) return true;
        if (!attack.path || attack.path.length < 2) continue;
        const travel = Math.max(1, attack.arriveAt - attack.startedAt);
        const along = Math.max(0, Math.min(1, (now - attack.startedAt) / travel));
        const army = poseAt(attack.path, along * (attack.length || 0));
        for (const point of path) {
            if (Math.hypot(army.x - point.x, army.z - point.z) < 16) return true;
        }
    }
    for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const steps = Math.max(1, Math.ceil(len / 8));
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            if (World.wet(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return true;
        }
    }
    return false;
}

function holdFood(farm) {
    if (farm.carry > 0) {
        farm.stock += farm.carry;
        farm.carry = 0;
    }
}

function walkHome(farm, site) {
    const pose = farm.path && farm.path.length > 1 ? poseAt(farm.path, farm.along || 0) : site.out;
    farm.phase = "back";
    farm.path = [{ x: pose.x, z: pose.z }, { x: site.out.x, z: site.out.z }];
    farm.along = 0;
    farm.length = pathLength(farm.path);
}

function ensureFarms(state) {
    if (!Array.isArray(state.farms)) state.farms = [];
    let dirty = false;
    const sites = farmSiteList.concat(state.builtFarms || [], hamlets.map((hamlet) => hamlet.farm), starts ? starts.farms.filter(Boolean) : []);
    for (const site of sites) {
        const had = state.farms.find((farm) => farm.id === site.id);
        if (had) {
            if (had.crew !== 2) {
                had.crew = 2;
                dirty = true;
            }
            continue;
        }
        state.farms.push({
            id: site.id,
            village: site.village,
            stock: 0,
            grown: 0,
            health: 1,
            phase: "work",
            carry: 0,
            along: 0,
            length: 0,
            path: null,
            sentDay: -1,
            sentSlot: -1,
            retryAt: 0,
            crew: 2
        });
        dirty = true;
    }
    return dirty;
}

function stepFarms(state, now) {
    const play = playClock(state);
    if (play == null || !Array.isArray(state.farms)) return false;
    if (!Number.isFinite(state.farmPlay)) {
        state.farmPlay = play;
        return true;
    }
    const dt = play - state.farmPlay;
    if (dt <= 0) return false;
    const step = Math.min(5000, dt);
    state.farmPlay = play;
    const asleep = farmAsleep(play);
    const rate = FARM_PER_DAY / ((20 / 24) * Clock.DAY_MS);
    let dirty = false;
    for (const farm of state.farms) {
        const site = farmSite(state, farm.id);
        if (!site) continue;
        if (farm.health <= 0) {
            if (farm.carry > 0) {
                holdFood(farm);
                farm.phase = "dead";
                dirty = true;
            }
            continue;
        }
        if (asleep && farm.phase === "haul") {
            walkHome(farm, site);
            dirty = true;
        } else if (asleep && farm.phase === "work") {
            farm.phase = "sleep";
            dirty = true;
        } else if (!asleep && farm.phase === "sleep") {
            farm.phase = "work";
            dirty = true;
        }
        if (farm.phase === "haul" || farm.phase === "back") {
            if (farm.phase === "haul" && routeBlocked(state, farm.village, farm.path, now)) {
                walkHome(farm, site);
                farm.retryAt = play + FARM_RETRY_MS;
                dirty = true;
            }
            farm.along += FISH_WALK * step / 1000;
            dirty = true;
            if (farm.along >= farm.length) {
                if (farm.phase === "haul") {
                    const owner = farmOwner(state, farm.village);
                    const load = farm.carry || 0;
                    farm.carry = 0;
                    if (load > 0 && owner >= MINOR_BASE) {
                        const minor = state.minors[owner - MINOR_BASE];
                        minor.food = (minor.food || 0) + load;
                        note(state, nameOf(owner) + " brings " + load + " food to the farmhouse.");
                    } else if (load > 0) {
                        state.food[owner] = (state.food[owner] || 0) + load;
                        note(state, nameOf(owner) + " brings " + load + " food to the store.");
                    }
                    markDelivery(farm, play);
                    walkHome(farm, site);
                } else {
                    holdFood(farm);
                    farm.phase = farmAsleep(play) ? "sleep" : "work";
                    farm.path = null;
                    farm.along = 0;
                    farm.length = 0;
                }
            }
            continue;
        }
        if (farm.phase !== "work") continue;
        const hamlet = farm.village >= MINOR_BASE ? farm.village - MINOR_BASE : -1;
        const cutting = hamlet >= 0 && hamlets[hamlet].farm.id === farm.id && state.minors[hamlet] && state.minors[hamlet].cutting;
        farm.grown = (farm.grown || 0) + rate * step * (cutting ? 0.5 : 1);
        const whole = Math.floor(farm.grown);
        if (whole > 0) {
            farm.stock += whole;
            farm.grown -= whole;
            dirty = true;
        }
        if (!deliveryDue(farm, play) || play < (farm.retryAt || 0)) continue;
        if ((farm.stock || 0) < 1) {
            markDelivery(farm, play);
            dirty = true;
            continue;
        }
        const path = pathToStore(site);
        if (routeBlocked(state, farm.village, path, now)) {
            farm.retryAt = play + FARM_RETRY_MS;
            dirty = true;
            continue;
        }
        farm.carry = farm.stock;
        farm.stock = 0;
        farm.phase = "haul";
        farm.path = path;
        farm.along = 0;
        farm.length = pathLength(path);
        dirty = true;
    }
    return dirty;
}

function presentFarms(state, now) {
    const play = Number.isFinite(state.farmPlay) ? state.farmPlay : 0;
    return (state.farms || []).filter((farm) => farm.health > 0).map((farm) => {
        const site = farmSite(state, farm.id);
        const home = site ? site.out : { x: 0, z: 0 };
        const pose = (farm.phase === "haul" || farm.phase === "back") && farm.path && farm.path.length > 1
            ? poseAt(farm.path, farm.along || 0)
            : { x: home.x, z: home.z, yaw: 0 };
        const y = site ? site.y : 0;
        return {
            id: farm.id,
            village: farm.village,
            owner: farmOwner(state, farm.village),
            health: farm.health,
            phase: farm.phase,
            stock: farm.stock || 0,
            carry: farm.carry || 0,
            x: pose.x,
            z: pose.z,
            yaw: pose.yaw || 0,
            path: farm.path || null,
            along: farm.along || 0,
            length: farm.length || 0,
            playAt: play,
            crew: farmCrew(farm),
            spots: site ? workSpots(site) : [],
            nap: site ? [
                { x: site.out.x, z: site.out.z, y: y },
                { x: site.door.x, z: site.door.z, y: y },
                { x: site.inn.x, z: site.inn.z, y: y },
                { x: site.bed.x, z: site.bed.z, y: y }
            ] : []
        };
    });
}

function syncWorld(state, now) {
    const paused = Number.isFinite(state.pausedAt);
    const clock = paused ? state.pausedAt : now;
    const turn = turnOf(state, clock);
    let dirty = false;
    if (ensureHamlet(state, now)) dirty = true;
    if (ensure(state, turn)) dirty = true;
    if (stretchMarches(state, now)) dirty = true;
    if (capArmies(state)) dirty = true;
    if (ensureEconomy(state, now)) dirty = true;
    if (ensureLodges(state)) dirty = true;
    if (ensureMinors(state)) dirty = true;
    if (ensureStarts(state)) dirty = true;
    if (ensureFarms(state)) dirty = true;
    if (finishTraining(state, now)) dirty = true;
    if (orderTraining(state, now)) dirty = true;
    if (considerAttacks(state, now)) dirty = true;
    if (considerMinors(state, now)) dirty = true;
    if (creditFish(state, now)) dirty = true;
    if (moveCarts(state, now)) dirty = true;
    if (consumeFood(state)) dirty = true;
    if (creditWood(state, now)) dirty = true;
    if (stepYard(state, now)) dirty = true;
    if (creditRepair(state, now)) dirty = true;
    if (considerRepairs(state, now)) dirty = true;
    if (considerFarms(state, now)) dirty = true;
    if (considerSites(state, now)) dirty = true;
    if (considerHamlets(state, now)) dirty = true;
    if (ensureFarms(state)) dirty = true;
    if (stepFarms(state, now)) dirty = true;
    if (wearTrails(state)) dirty = true;
    if (besiege(state, now)) dirty = true;
    if (fight(state, now)) dirty = true;
    if (goblinRaids(state, now)) dirty = true;
    if (stepWilds(state, now)) dirty = true;
    if (ensureHero(state)) dirty = true;
    return { dirty, turn, paused };
}

function ensureHero(state) {
    const before = state.hero ? Hero.signature(state.hero) : "";
    state.hero = Hero.normalize(state.hero);
    return Hero.signature(state.hero) !== before;
}

async function saveHero(raw) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    state.hero = Hero.prefer(state.hero, raw);
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function campaignState(now, saved, playAdd) {
    const state = saved || await readState();
    const moved = notePlay(state, Number(playAdd), now);
    const { dirty, turn, paused } = syncWorld(state, now);
    if ((dirty || moved) && !saved) await writeState(state);
    return present(state, now, turn, paused);
}

// The player stands apart from every faction. Whoever the player strikes treats them as an enemy until the player dies.
function grudge(state, faction) {
    if (!Number.isInteger(faction) || faction < 0) return false;
    if (!Array.isArray(state.grudges)) state.grudges = [];
    if (!state.grudges.includes(faction)) {
        state.grudges.push(faction);
        note(state, nameOf(faction) + " turns on you.");
    }
    return true;
}

async function forgive() {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    if (Array.isArray(state.grudges) && state.grudges.length) {
        state.grudges = [];
        note(state, "You fall. The factions forget your quarrels.");
    }
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function hitDriver(id) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    const lodge = (state.lodges || []).find((item) => item.id === id);
    if (lodge && lodge.cart && grudge(state, state.owners[lodge.village]) && lodge.cart.driver > 0) {
        lodge.cart.driver -= 1;
    }
    moveCarts(state, now);
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function hitCart(id) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    const lodge = (state.lodges || []).find((item) => item.id === id);
    if (lodge && lodge.cart && grudge(state, state.owners[lodge.village]) && lodge.cart.hp > 0) {
        lodge.cart.hp -= 1;
    }
    moveCarts(state, now);
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function hitWood(id) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    const man = state.woodcutters[id];
    if (man && man.health > 0 && grudge(state, state.owners[man.village])) {
        man.health -= 1;
        if (man.health <= 0) dropRepair(state, man);
    }
    creditWood(state, now);
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function hitFarmer(id) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    const farm = (state.farms || []).find((item) => item.id === id);
    if (farm && farm.health > 0 && grudge(state, farmOwner(state, farm.village))) {
        farm.health -= 1;
        if (farm.health <= 0) {
            if (farm.carry > 0) {
                farm.stock = (farm.stock || 0) + farm.carry;
                farm.carry = 0;
            }
            farm.phase = "dead";
            farm.path = null;
        }
    }
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function hitFisher(village) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    const man = livingFisher(state, village);
    if (man && grudge(state, state.owners[man.village])) {
        man.health -= 1;
        if (man.health <= 0) dropRepair(state, man);
    }
    creditFish(state, now);
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function hitGate(village, side) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    if (village >= 0 && village <= 3 && side >= 0 && side <= 3 && grudge(state, state.owners[village])) {
        const row = state.gates && state.gates[village];
        if (row && row[side] > 0) {
            row[side] -= 1;
            if (row[side] <= 0) {
                row[side] = 0;
                releaseGate(state, village, side, now);
                note(state, "A gate at " + factions[village].name + " is broken.");
            }
        }
    }
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function hitArcher(village, side) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    if (village >= 0 && village <= 3 && side >= 0 && side <= 3 && grudge(state, state.owners[village])) {
        const row = state.archers && state.archers[village];
        if (row && row[side] > 0) {
            row[side] -= 1;
            if (row[side] <= 0) {
                row[side] = 0;
                note(state, "An archer falls at " + factions[village].name + ".");
            }
        }
    }
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function hitGoblin(index) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    const raid = state.goblins && state.goblins.raid;
    if (raid && raid.hp[index] > 0) raid.hp[index] -= 1;
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function hitWild(index) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    if (state.wilds && state.wilds.hp[index] > 0) state.wilds.hp[index] -= 1;
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function setFood(village, amount) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    const next = Math.floor(Number(amount));
    if (village >= 0 && village <= 3 && Number.isFinite(next) && next >= 0 && next <= 99999) {
        const owner = state.owners[village];
        if (!Array.isArray(state.food) || state.food.length !== 4) state.food = [0, 0, 0, 0];
        state.food[owner] = next;
    }
    const minor = state.minors && state.minors[village - MINOR_BASE];
    if (minor && minor.owner < 0 && Number.isFinite(next) && next >= 0 && next <= 99999) minor.food = next;
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function changeStance(other, kind) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    setStance(state, other, kind);
    considerMinors(state, now);
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function hit(village, index) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    const faction = village;
    if (faction >= 0 && faction <= 3 && index >= 0 && index < (state.nextIndex[faction] || 0) && grudge(state, faction)) {
        const key = keyOf(faction, index);
        const current = healthOf(state, faction, index);
        if (current > 0) state.health[key] = current - 1;
    }
    fight(state, now);
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

module.exports = async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    try {
        if (req.method === "POST") {
            if (req.body && Number.isInteger(req.body.setFood) && Number.isFinite(Number(req.body.amount))) {
                res.status(200).json(await setFood(req.body.setFood, req.body.amount));
                return;
            }
            if (req.body && Number.isInteger(req.body.stance) && typeof req.body.kind === "string") {
                res.status(200).json(await changeStance(req.body.stance, req.body.kind));
                return;
            }
            if (req.body && req.body.restart) {
                const state = await readState();
                restartCampaign(state, Date.now());
                await writeState(state);
                res.status(200).json(await campaignState(Date.now()));
                return;
            }
            if (req.body && req.body.hero && typeof req.body.hero === "object") {
                res.status(200).json(await saveHero(req.body.hero));
                return;
            }
            if (req.body && req.body.forgive) {
                res.status(200).json(await forgive());
                return;
            }
            if (req.body && typeof req.body.driver === "string") {
                res.status(200).json(await hitDriver(req.body.driver));
                return;
            }
            if (req.body && typeof req.body.cart === "string") {
                res.status(200).json(await hitCart(req.body.cart));
                return;
            }
            if (req.body && Number.isInteger(req.body.woodcutter)) {
                res.status(200).json(await hitWood(req.body.woodcutter));
                return;
            }
            if (req.body && typeof req.body.farmer === "string") {
                res.status(200).json(await hitFarmer(req.body.farmer));
                return;
            }
            if (req.body && Number.isInteger(req.body.fisherman)) {
                res.status(200).json(await hitFisher(req.body.fisherman));
                return;
            }
            if (req.body && Number.isInteger(req.body.gate) && Number.isInteger(req.body.side)) {
                res.status(200).json(await hitGate(req.body.gate, req.body.side));
                return;
            }
            if (req.body && Number.isInteger(req.body.wild)) {
                res.status(200).json(await hitWild(req.body.wild));
                return;
            }
            if (req.body && Number.isInteger(req.body.goblin)) {
                res.status(200).json(await hitGoblin(req.body.goblin));
                return;
            }
            if (req.body && Number.isInteger(req.body.archer) && Number.isInteger(req.body.tower)) {
                res.status(200).json(await hitArcher(req.body.archer, req.body.tower));
                return;
            }
            const village = Number(req.body && req.body.village);
            const index = Number(req.body && req.body.index);
            res.status(200).json(await hit(village, index));
            return;
        }
        if (req.method !== "GET") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        let playAdd = NaN;
        try {
            const raw = new URL(req.url, "http://localhost").searchParams.get("play");
            if (raw != null && raw !== "") playAdd = Number(raw);
        } catch (err) { /* a campaign-page poll has no play time */ }
        res.status(200).json(await campaignState(Date.now(), null, playAdd));
    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ error: "Something went wrong." });
    }
};

module.exports.campaignState = campaignState;
module.exports.TURN_MS = TURN_MS;
module.exports.syncWorld = syncWorld;
module.exports.present = present;
module.exports.readState = readState;
