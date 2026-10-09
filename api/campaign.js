const fs = require("fs");
const path = require("path");

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

const places = [
    { x: -40, z: -64 },
    { x: 40, z: -64 },
    { x: -40, z: 64 },
    { x: 40, z: 64 }
];

const MAX_HP = 3;
const FISHER_HP = 1;
const POP = 20;
const RECRUIT_MS = 2 * 60 * 1000;
const FISHER_COST = 50;
const SOLDIER_COST = 70;
const fisherAim = [2, 4, 3, 3];
const FISH_MS = 30000;
const FISH_WALK = 2.2;
const FISH_FOOD = 10;
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

function readState() {
    try {
        const saved = JSON.parse(fs.readFileSync(file, "utf8"));
        if (saved && Number.isFinite(saved.startedAt)) return saved;
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
    state.gates = freshGates();
    state.archers = freshArchers();
    state.restartedAt = now;
    state.log = ["The houses start again. Each has one fisherman and 100 food."];
    state.marchAfter = now + RECRUIT_MS;
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

function marchPath(from, to) {
    const start = places[from];
    const end = places[to];
    const mid = start.x === end.x || start.z === end.z
        ? []
        : [{ x: start.x, z: start.z < 0 ? -40 : 40 }, { x: end.x, z: start.z < 0 ? -40 : 40 }];
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
        const sameRow = places[village].x === places[from].x || places[village].z === places[from].z;
        enemies.push({ village, neighbor: sameRow });
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

function storeDoor(village) {
    const place = places[village];
    return {
        x: place.x + storePlan.x + storePlan.w / 2,
        z: place.z + storePlan.z - 1.1
    };
}

function fishShore(from) {
    const edges = [
        { x: from.x, z: -98.5 },
        { x: from.x, z: 98.5 },
        { x: -98.5, z: from.z },
        { x: 98.5, z: from.z }
    ];
    edges.sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
    return edges[0];
}

function fishRoute(village) {
    const from = storeDoor(village);
    const to = fishShore(from);
    const via = gateSpot(village, exitSide(village, from, to), 0);
    const length = Math.hypot(via.x - from.x, via.z - from.z) + Math.hypot(to.x - via.x, to.z - via.z);
    return { from, via, to, length, walkMs: Math.round((length / FISH_WALK) * 1000) };
}

function fishPeriod(village) {
    return fishRoute(village).walkMs * 2 + FISH_MS;
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

function villageCounts(state, village) {
    const owner = state.owners[village];
    let soldiers = 0;
    eachLiving(state, owner, (index) => {
        if (state.post[keyOf(owner, index)] === village) soldiers += 1;
    });
    const fishers = state.fishermen.filter((man) => man.village === village && man.health > 0).length;
    const training = state.training.filter((job) => job.village === village);
    return { soldiers, fishers, training, pop: soldiers + fishers + training.length };
}

function ensureEconomy(state, now) {
    let dirty = false;
    if (!Array.isArray(state.food) || state.food.length !== 4) {
        state.food = [100, 100, 100, 100];
        dirty = true;
    }
    if (!Array.isArray(state.fishermen)) {
        state.fishermen = [];
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
        const future = state.training.filter((item) => item.village === job.village && item !== job && now < item.readyAt).length;
        if (counts.soldiers + counts.fishers + future >= POP) {
            state.food[state.owners[job.village]] += job.kind === "fisher" ? FISHER_COST : SOLDIER_COST;
            continue;
        }
        if (job.kind === "fisher") addFisher(state, job.village, now);
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
            if (counts.fishers < aim && counts.pop < POP && pay(FISHER_COST)) {
                state.training.push({ village, kind: "fisher", readyAt: now + RECRUIT_MS });
                dirty = true;
            }
        }
        if (!has("soldier")) {
            const counts = villageCounts(state, village);
            const fishRoom = Math.max(0, aim - counts.fishers);
            if (counts.pop < POP && counts.soldiers < POP - fishRoom && pay(SOLDIER_COST)) {
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

function creditFish(state, now) {
    let dirty = false;
    for (const man of state.fishermen) {
        if (man.health <= 0) continue;
        const done = Math.floor(Math.max(0, now - man.cycleStart) / fishPeriod(man.village));
        const paid = man.delivered || 0;
        if (done <= paid) continue;
        const trips = done - paid;
        const owner = state.owners[man.village];
        state.food[owner] += trips * FISH_FOOD;
        man.delivered = done;
        note(state, factions[owner].name + " stores " + (trips * FISH_FOOD) + " food.");
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
    return {
        turn,
        paused,
        turnMs: TURN_MS,
        nextTurnAt: paused ? null : now + nextIn,
        maxHealth: MAX_HP,
        restartedAt: state.restartedAt || 0,
        owners: state.owners.slice(),
        log: state.log.slice(),
        food: state.food.slice(),
        fishermen: state.fishermen.filter((man) => man.health > 0).map((man) => {
            const route = fishRoute(man.village);
            return {
                village: man.village,
                owner: state.owners[man.village],
                health: man.health,
                cycleStart: man.cycleStart,
                walkMs: route.walkMs,
                from: route.from,
                via: route.via,
                to: route.to
            };
        }),
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
                fishing: state.fishermen.some((man) => man.village === index && man.health > 0),
                fishers: state.fishermen.filter((man) => man.village === index && man.health > 0).length,
                training: state.training.filter((job) => job.village === index).map((job) => job.kind),
                pop: villageCounts(state, index).pop
            };
        }),
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

function syncWorld(state, now) {
    const paused = Number.isFinite(state.pausedAt);
    const clock = paused ? state.pausedAt : now;
    const turn = turnOf(state, clock);
    let dirty = false;
    if (ensure(state, turn)) dirty = true;
    if (capArmies(state)) dirty = true;
    if (ensureEconomy(state, now)) dirty = true;
    if (finishTraining(state, now)) dirty = true;
    if (orderTraining(state, now)) dirty = true;
    if (considerAttacks(state, now)) dirty = true;
    if (creditFish(state, now)) dirty = true;
    if (besiege(state, now)) dirty = true;
    if (fight(state, now)) dirty = true;
    return { dirty, turn, paused };
}

function campaignState(now, saved) {
    const state = saved || readState();
    const { dirty, turn, paused } = syncWorld(state, now);
    if (dirty && !saved) writeState(state);
    return present(state, now, turn, paused);
}

function hitFisher(village) {
    const state = readState();
    const now = Date.now();
    syncWorld(state, now);
    const man = livingFisher(state, village);
    if (man) man.health -= 1;
    creditFish(state, now);
    writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

function hitGate(village, side) {
    const state = readState();
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
    writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

function hitArcher(village, side) {
    const state = readState();
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
    writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

function hit(village, index) {
    const state = readState();
    const now = Date.now();
    syncWorld(state, now);
    const faction = village;
    if (faction >= 0 && faction <= 3 && index >= 0 && index < (state.nextIndex[faction] || 0)) {
        const key = keyOf(faction, index);
        const current = healthOf(state, faction, index);
        if (current > 0) state.health[key] = current - 1;
    }
    fight(state, now);
    writeState(state);
    const clock = Number.isFinite(state.pausedAt) ? state.pausedAt : now;
    return present(state, now, turnOf(state, clock), Number.isFinite(state.pausedAt));
}

module.exports = function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "POST") {
        if (req.body && req.body.restart) {
            const state = readState();
            restartCampaign(state, Date.now());
            writeState(state);
            res.status(200).json(campaignState(Date.now()));
            return;
        }
        if (req.body && Number.isInteger(req.body.fisherman)) {
            res.status(200).json(hitFisher(req.body.fisherman));
            return;
        }
        if (req.body && Number.isInteger(req.body.gate) && Number.isInteger(req.body.side)) {
            res.status(200).json(hitGate(req.body.gate, req.body.side));
            return;
        }
        if (req.body && Number.isInteger(req.body.archer) && Number.isInteger(req.body.tower)) {
            res.status(200).json(hitArcher(req.body.archer, req.body.tower));
            return;
        }
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
module.exports.syncWorld = syncWorld;
module.exports.present = present;
module.exports.readState = readState;
