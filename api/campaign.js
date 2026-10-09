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
const CAP = 10;
const FIELD = CAP;
const file = path.join(__dirname, "..", "data", "campaign.json");

const factions = [
    { id: "northwest", name: "Northwest", color: "#c45c3a" },
    { id: "northeast", name: "Northeast", color: "#3d6b8a" },
    { id: "southwest", name: "Southwest", color: "#6a7a3a" },
    { id: "southeast", name: "Southeast", color: "#8a5a7a" }
];

const places = World.places;

const MAX_HP = 3;
const FISHER_HP = 1;
const POP = 30;
const RECRUIT_MS = 2 * 60 * 1000;
const FISHER_COST = 50;
const SOLDIER_COST = 70;
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
const REPAIR_MS = 30000;
const REPAIR_CHUNK = 10;
const FARM_PER_DAY = 18;
const FARM_RETRY_MS = Math.round(Clock.DAY_MS / 144);
const FARM_WOOD = 40;
const FARM_BUILD_MS = 3 * 60 * 1000;
const HEALTHY_FOOD = 160;
const FARM_CAP = 3;
const FARM_EXTRA = 2;
const storePlan = { x: -12, z: -16, w: 8, d: 5.5 };
const GATE_HP = 50;
const PLAYER_FACTION = 2;
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
    return posted(state, faction, village, busyIndexes(state, faction)).slice(0, POP);
}

function restartCampaign(state, now) {
    state.owners = [0, 1, 2, 3];
    state.food = [100, 100, 100, 100];
    state.wood = [0, 0, 0, 0];
    state.health = {};
    state.post = {};
    state.nextIndex = [0, 0, 0, 0];
    state.attacks = [];
    state.training = [];
    state.fishermen = [0, 1, 2, 3].map((village) => ({
        village,
        health: FISHER_HP,
        cycleStart: now,
        delivered: 0
    }));
    state.woodcutters = [];
    state.gates = freshGates();
    state.archers = freshArchers();
    state.restartedAt = now;
    state.log = ["The houses start again. Each has one fisherman and 100 food."];
    state.marchAfter = now + RECRUIT_MS;
    state.farms = [];
    state.farmPlay = null;
    state.farmJobs = [];
    state.builtFarms = [];
    state.farmSerial = 0;
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
    if (livingCount(state, faction) >= CAP) return;
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
        if (state.owners[village] === faction) continue;
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
    if (!trees.length) return { x: from.x, z: from.z };
    let best = trees[0];
    let bestDist = Infinity;
    for (const tree of trees) {
        const dist = Math.hypot(tree.x - from.x, tree.z - from.z);
        if (dist < bestDist) {
            best = tree;
            bestDist = dist;
        }
    }
    const dx = from.x - best.x;
    const dz = from.z - best.z;
    const len = Math.hypot(dx, dz) || 1;
    const side = (slot || 0) * 0.75;
    return {
        x: best.x + (dx / len) * 1.15 + (-dz / len) * side,
        z: best.z + (dz / len) * 1.15 + (dx / len) * side
    };
}

function woodRoute(village, slot) {
    const from = storeExit(village);
    const to = nearestTree(from, slot);
    const path = villagerPath(village, to);
    const length = pathLength(path);
    return { from: path[0], via: path[Math.min(1, path.length - 1)], to, path, length, walkMs: Math.round((length / FISH_WALK) * 1000) };
}

function woodPeriod(village, slot) {
    return woodRoute(village, slot).walkMs * 2 + WOOD_MS;
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

function addWoodcutter(state, village, now) {
    const slot = state.woodcutters.filter((man) => man.village === village).length;
    state.woodcutters.push({ village, slot, health: FISHER_HP, cycleStart: now, delivered: 0 });
    const owner = state.owners[village];
    const who = factions[owner].name;
    const place = factions[village].name;
    note(state, owner === village ? who + " recruits a woodcutter." : who + " recruits a woodcutter in " + place + ".");
}

function jobWeight(kind) {
    return kind === "soldier" ? 2 : 1;
}

function villageCounts(state, village) {
    const owner = state.owners[village];
    let soldiers = 0;
    eachLiving(state, owner, (index) => {
        if (state.post[keyOf(owner, index)] === village) soldiers += 1;
    });
    const fishers = state.fishermen.filter((man) => man.village === village && man.health > 0).length;
    const wood = (state.woodcutters || []).filter((man) => man.village === village && man.health > 0).length;
    const training = state.training.filter((job) => job.village === village);
    const trainingPop = training.reduce((sum, job) => sum + jobWeight(job.kind), 0);
    const living = soldiers * 2 + fishers + wood;
    return { soldiers, fishers, wood, training, living, pop: living + trainingPop };
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
        const counts = villageCounts(state, job.village);
        const others = state.training.filter((item) => item.village === job.village && item !== job && now < item.readyAt);
        const otherPop = others.reduce((sum, item) => sum + jobWeight(item.kind), 0);
        if (counts.living + otherPop + jobWeight(job.kind) > POP) {
            state.food[state.owners[job.village]] += job.kind === "soldier" ? SOLDIER_COST : FISHER_COST;
            continue;
        }
        if (job.kind === "fisher") addFisher(state, job.village, now);
        else if (job.kind === "wood") addWoodcutter(state, job.village, now);
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

function orderTraining(state, now) {
    let dirty = false;
    for (let village = 0; village < 4; village++) {
        const owner = state.owners[village];
        const aim = fisherAim[owner];
        const has = (kind) => state.training.some((job) => job.village === village && job.kind === kind);
        const pay = (cost) => {
            if ((state.food[owner] || 0) < cost) return false;
            state.food[owner] -= cost;
            return true;
        };
        if (!has("fisher")) {
            const counts = villageCounts(state, village);
            if (counts.fishers < aim && counts.pop + 1 <= POP && pay(FISHER_COST)) {
                state.training.push({ village, kind: "fisher", readyAt: now + RECRUIT_MS });
                dirty = true;
            }
        }
        if (!has("wood")) {
            const counts = villageCounts(state, village);
            if (counts.wood < aim && counts.pop + 1 <= POP && pay(FISHER_COST)) {
                state.training.push({ village, kind: "wood", readyAt: now + RECRUIT_MS });
                dirty = true;
            }
        }
        if (!has("soldier")) {
            const counts = villageCounts(state, village);
            const fisherRoom = Math.max(0, aim - counts.fishers - (has("fisher") ? 1 : 0));
            const woodRoom = Math.max(0, aim - counts.wood - (has("wood") ? 1 : 0));
            if (counts.pop + 2 + fisherRoom + woodRoom <= POP && pay(SOLDIER_COST)) {
                state.training.push({ village, kind: "soldier", readyAt: now + RECRUIT_MS });
                dirty = true;
            }
        }
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

function bedsOf(state) {
    const map = new Map();
    for (let village = 0; village < 4; village++) {
        const lodge = fishLodge(state, village);
        const fishers = state.fishermen.filter((man) => man.village === village && man.health > 0);
        const cutters = (state.woodcutters || []).filter((man) => man.village === village && man.health > 0);
        let room = lodge && fishFar(village) ? lodge.cap : 0;
        for (const man of fishers) {
            if (room <= 0) break;
            map.set(man, lodge.id);
            room -= 1;
        }
        let manor = MANOR_CAP;
        for (const man of fishers.concat(cutters)) {
            if (map.has(man)) continue;
            map.set(man, "manor");
            manor -= 1;
        }
    }
    return map;
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
        const done = Math.floor(Math.max(0, now - man.cycleStart) / woodPeriod(man.village, man.slot || 0));
        const paid = man.delivered || 0;
        if (done <= paid) continue;
        const trips = done - paid;
        const owner = state.owners[man.village];
        state.wood[owner] += trips * WOOD_YIELD;
        man.delivered = done;
        note(state, factions[owner].name + " stores " + (trips * WOOD_YIELD) + " wood.");
        dirty = true;
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
    for (const attack of state.attacks) {
        if (attack.faction === faction && attack.indexes.includes(index)) {
            return now >= attack.arriveAt ? "battle" : "march";
        }
        if (attack.defender === faction && attack.defenders.includes(index)) {
            return now + 8000 >= attack.arriveAt ? "battle" : "guard";
        }
    }
    return "guard";
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
    else route = cutting ? woodRoute(man.village, man.slot || 0) : fishRoute(man.village);
    return {
        cycleStart: man.cycleStart,
        walkMs: route.walkMs,
        from: route.from,
        via: route.via,
        to: route.to,
        path: route.path
    };
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
            if (!attack && !defending && !field) return;
            const slot = slots[post]++;
            shown[faction].units.push({
                index,
                health,
                post,
                mode,
                slot,
                attack: attack ? attack.id : null
            });
        });
    }
    const beds = bedsOf(state);
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
                bed: beds.get(man) || "manor"
            };
        }),
        woodcutters: state.woodcutters.filter((man) => man.health > 0).map((man) => {
            const route = routeOf(state, man, true);
            const shelter = state.attacks.some((attack) => !attack.resolved && attack.to === man.village);
            return {
                id: state.woodcutters.indexOf(man),
                village: man.village,
                slot: man.slot || 0,
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
                bed: beds.get(man) || "manor"
            };
        }),
        farms: presentFarms(state),
        plots: (state.builtFarms || []).map((site) => ({
            id: site.id,
            village: site.village,
            yaw: site.yaw,
            house: site.house,
            field: site.fields[0],
            hay: site.hay,
            door: site.door
        })),
        raising: (state.farmJobs || []).map((job) => ({
            id: job.id,
            village: job.village,
            x: job.site.bed.x,
            z: job.site.bed.z,
            y: job.site.y
        })),
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
                chopping: state.woodcutters.some((man) => man.village === index && man.health > 0),
                woodcutters: state.woodcutters.filter((man) => man.village === index && man.health > 0).length,
                repairing: villageMending(state, index),
                training: state.training.filter((job) => job.village === index).map((job) => job.kind),
                pop: villageCounts(state, index).pop
            };
        }),
        hero: Hero.normalize(state.hero),
        factions: factions.map((faction, index) => {
            let alive = 0;
            eachLiving(state, index, () => { alive += 1; });
            return {
                id: faction.id,
                name: faction.name,
                color: faction.color,
                village: index,
                soldiers: state.nextIndex[index],
                alive,
                food: state.food[index] || 0,
                units: shown[index].units
            };
        })
    };
}

const farmSiteList = Town.farmSites();

function farmSite(state, id) {
    const fixed = farmSiteList.find((site) => site.id === id);
    if (fixed) return fixed;
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

function extraFarms(state, faction) {
    let n = 0;
    for (const site of state.builtFarms || []) {
        if (state.owners[site.village] === faction) n += 1;
    }
    for (const job of state.farmJobs || []) {
        if (job.payer === faction) n += 1;
    }
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

function wantsFarm(state, faction) {
    const food = state.food[faction] || 0;
    if (food >= HEALTHY_FOOD) return false;
    let fishers = 0;
    for (let village = 0; village < 4; village++) {
        if (state.owners[village] !== faction) continue;
        fishers += state.fishermen.filter((man) => man.village === village && man.health > 0).length;
    }
    const perDay = producingFarms(state, faction) * FARM_PER_DAY + fishers * FISH_FOOD;
    if (food >= URGENT_FOOD && perDay >= SOLDIER_COST) return false;
    return true;
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

function landScore(x, z, wood) {
    if (World.wet(x, z) || World.inField(x, z) || Town.street(x, z)) return -1;
    const h = World.heightAt(x, z);
    if (h < 0.45 || h > 7 || World.tooSteep(x, z)) return -1;
    if (World.roadDist(x, z) < 18 || World.forestAt(x, z) > 0.4) return -1;
    const box = World.peakBox;
    if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) return -1;
    const reach = 6;
    const reach2 = reach * reach;
    for (let i = 0; i < wood.length; i++) {
        const tree = wood[i];
        const dx = tree.x - x;
        if (dx > reach || dx < -reach) continue;
        const dz = tree.z - z;
        if (dx * dx + dz * dz < reach2) return -1;
    }
    const s = 4;
    const dh = Math.max(
        Math.abs(World.heightAt(x + s, z) - h),
        Math.abs(World.heightAt(x - s, z) - h),
        Math.abs(World.heightAt(x, z + s) - h),
        Math.abs(World.heightAt(x, z - s) - h)
    );
    if (dh > 1.25) return -1;
    return dh;
}

function nearbyWood(village) {
    const place = places[village];
    const reach = 240;
    const wood = [];
    const lists = [World.trees, World.groves];
    for (let list = 0; list < lists.length; list++) {
        const trees = lists[list];
        for (let i = 0; i < trees.length; i++) {
            const tree = trees[i];
            if (tree.kind === "bush") continue;
            if (Math.abs(tree.x - place.x) > reach || Math.abs(tree.z - place.z) > reach) continue;
            wood.push(tree);
        }
    }
    return wood;
}

function takenRects(state) {
    const rects = [];
    for (const building of Town.buildings) rects.push(rectOf(building));
    for (const field of World.fields) rects.push({ minX: field.x, minZ: field.z, w: field.w, d: field.d });
    for (let village = 0; village < 4; village++) {
        const cot = World.cottageLayout(village);
        rects.push({ minX: cot.x, minZ: cot.z, w: cot.w, d: cot.d });
    }
    const sites = (state.builtFarms || []).concat((state.farmJobs || []).map((job) => job.site));
    for (const site of sites) {
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

function layoutFarm(state, village, cx, cz, wood, blocked) {
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
    if (Math.hypot(hx - place.x, hz - place.z) < 78) return null;
    if (Math.hypot(cx - place.x, cz - place.z) < 90) return null;
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
    let slope = 0;
    for (const spot of spots) {
        const score = landScore(spot[0], spot[1], wood);
        if (score < 0) return null;
        slope = Math.max(slope, score);
    }
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
    if (!path || path.length < 2 || pathWet(path) || pathLength(path) > 320) return null;
    return site;
}

function pickFarmSite(state, village) {
    const wood = nearbyWood(village);
    const blocked = takenRects(state);
    const place = places[village];
    for (const dist of [108, 132, 156, 180, 204]) {
        let pick = null;
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2 + dist * 0.002;
            const site = layoutFarm(
                state,
                village,
                place.x + Math.cos(ang) * dist,
                place.z + Math.sin(ang) * dist,
                wood,
                blocked
            );
            if (!site) continue;
            if (!pick || site.slope < pick.slope) pick = site;
        }
        if (pick) return pick;
    }
    return null;
}

const farmThink = [0, 0, 0, 0];

function considerFarms(state, now) {
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
        if (state.owners[job.village] !== job.payer) {
            state.wood[job.payer] = (state.wood[job.payer] || 0) + FARM_WOOD;
            note(state, factions[job.payer].name + " stops the farm.");
            dirty = true;
            continue;
        }
        if (now < job.readyAt) {
            keep.push(job);
            continue;
        }
        state.builtFarms.push(job.site);
        note(state, factions[job.payer].name + " finishes a farm.");
        dirty = true;
    }
    state.farmJobs = keep;
    for (let faction = 0; faction < 4; faction++) {
        if (state.farmJobs.some((job) => job.payer === faction)) continue;
        if (now < farmThink[faction]) continue;
        if (!wantsFarm(state, faction) || extraFarms(state, faction) >= FARM_EXTRA || (state.wood[faction] || 0) < FARM_WOOD) {
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
        state.wood[faction] -= FARM_WOOD;
        state.farmJobs.push({
            id: site.id,
            village: village,
            payer: faction,
            readyAt: now + FARM_BUILD_MS,
            site: site
        });
        note(state, factions[faction].name + " starts a farm.");
        farmThink[faction] = now + 20000;
        dirty = true;
    }
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
    const sites = farmSiteList.concat(state.builtFarms || []);
    for (const site of sites) {
        if (state.farms.some((farm) => farm.id === site.id)) continue;
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
            retryAt: 0
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
                    const owner = state.owners[farm.village];
                    const load = farm.carry || 0;
                    farm.carry = 0;
                    if (load > 0) {
                        state.food[owner] = (state.food[owner] || 0) + load;
                        note(state, factions[owner].name + " brings " + load + " food to the store.");
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
        farm.grown = (farm.grown || 0) + rate * step;
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
            owner: state.owners[farm.village],
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
    if (ensure(state, turn)) dirty = true;
    if (stretchMarches(state, now)) dirty = true;
    if (capArmies(state)) dirty = true;
    if (ensureEconomy(state, now)) dirty = true;
    if (ensureLodges(state)) dirty = true;
    if (ensureFarms(state)) dirty = true;
    if (finishTraining(state, now)) dirty = true;
    if (orderTraining(state, now)) dirty = true;
    if (considerAttacks(state, now)) dirty = true;
    if (creditFish(state, now)) dirty = true;
    if (moveCarts(state, now)) dirty = true;
    if (creditWood(state, now)) dirty = true;
    if (creditRepair(state, now)) dirty = true;
    if (considerRepairs(state, now)) dirty = true;
    if (considerFarms(state, now)) dirty = true;
    if (ensureFarms(state)) dirty = true;
    if (stepFarms(state, now)) dirty = true;
    if (besiege(state, now)) dirty = true;
    if (fight(state, now)) dirty = true;
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

async function hitDriver(id) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    const lodge = (state.lodges || []).find((item) => item.id === id);
    if (lodge && lodge.cart && state.owners[lodge.village] !== PLAYER_FACTION && lodge.cart.driver > 0) {
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
    if (lodge && lodge.cart && state.owners[lodge.village] !== PLAYER_FACTION && lodge.cart.hp > 0) {
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
    if (man && man.health > 0 && state.owners[man.village] !== PLAYER_FACTION) {
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
    if (farm && farm.health > 0 && state.owners[farm.village] !== PLAYER_FACTION) {
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
    if (man) {
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
    if (village >= 0 && village <= 3 && side >= 0 && side <= 3 && state.owners[village] !== PLAYER_FACTION) {
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
    if (village >= 0 && village <= 3 && side >= 0 && side <= 3 && state.owners[village] !== PLAYER_FACTION) {
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
    await writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

async function hit(village, index) {
    const state = await readState();
    const now = Date.now();
    syncWorld(state, now);
    const faction = village;
    if (faction >= 0 && faction <= 3 && index >= 0 && index < (state.nextIndex[faction] || 0)) {
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
