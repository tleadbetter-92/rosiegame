(function () {
    const canvas = document.getElementById("stage");
    const battleView = BattleView(canvas);
    const ctx = canvas.getContext("2d");
    const statusEl = document.getElementById("status");
    const nameEl = document.getElementById("sel-name");
    const countEl = document.getElementById("sel-count");
    const trainBtn = document.getElementById("train");
    const workerBtn = document.getElementById("train-worker");
    const archerBtn = document.getElementById("train-archer");
    const houseBtn = document.getElementById("build-house");
    const millBtn = document.getElementById("build-mill");
    const mineBtn = document.getElementById("build-mine");
    const ironBtn = document.getElementById("build-iron");
    const yardBtn = document.getElementById("build-yard");
    const portBtn = document.getElementById("build-port");
    const wallBtn = document.getElementById("build-wall");
    const towerBtn = document.getElementById("build-tower");
    const cpuBtn = document.getElementById("red-cpu");
    const playerBtn = document.getElementById("player-mode");
    const restartBtn = document.getElementById("restart-battle");
    const swatch = document.getElementById("swatch");
    const CPU_KEY = "rosiesgame.red-cpu";
    const PLAYER_KEY = "rosiesgame.player-mode";
    const BATTLE_KEY = "rosiesgame.new-battle";
    let redCpu = localStorage.getItem(CPU_KEY) !== "off";
    let playerMode = localStorage.getItem(PLAYER_KEY) === "on";
    let player = null;
    let playerDown = 0;
    const hostile = { blue: false, red: false };
    const keys = {};
    const PLAYER_LOOK = { id: "player", name: "You", color: "#3cba4a", dark: "#1e6b32" };

    const COLS = BattleMap.COLS;
    const ROWS = BattleMap.ROWS;
    const OX = BattleMap.SHIFT_C;
    const OY = BattleMap.SHIFT_R;
    const TILE = 60;
    const INK = "#1a2410";
    let ground = BattleMap.load();
    const SOLDIER_HP = 100;
    const WORKER_HP = 50;
    const ARCHER_HP = 60;
    const SOLDIER_DAMAGE = 10;
    const WORKER_DAMAGE = 5;
    const ARCHER_RANGE = 4;
    const HOUSE_HP = 200;
    const HOUSE_COST = 10;
    const HALL_W = 3;
    const HALL_H = 2;
    const HOUSE_W = 2;
    const HOUSE_H = 2;
    const TOWER_W = 2;
    const TOWER_H = 3;
    const MILL_W = 2;
    const MILL_H = 2;
    const MILL_COST = 10;
    const MILL_FOOD = 10;
    const MILL_MS = 60000;
    const HOUSE_RANGE = 10;
    const POP_START = 10;
    const POP_PER_HOUSE = 5;
    const WORK_HP = 400;
    const GATHER = {
        water: { place: "water", haul: "10 food", key: "food", work: "port", drop: "fishing port" },
        forest: { place: "forest", haul: "10 wood", key: "wood", work: "yard", drop: "lumberyard" },
        gold: { place: "gold mine", haul: "10 gold", key: "gold", work: "mine", drop: "mine" },
        stone: { place: "stone mine", haul: "10 stone", key: "stone", work: "mine", drop: "mine" },
        iron: { place: "iron mine", haul: "10 iron", key: "iron", work: "iron", drop: "iron mine" }
    };
    const WORK_NAMES = { mine: "Mine", iron: "Iron mine", yard: "Lumberyard", port: "Fishing port" };
    const BUILDING_HP = 10000;
    const WALL_HP = 1000;
    const TOWER_HP = 1000;
    const TOWER_DAMAGE = 10;
    const TOWER_RANGE = 4;
    const TOWER_HIT_MS = 1500;
    const HIT_MS = 1000;
    const STEP_MS = 280;
    const TRAIN_COST = 10;
    const TRAIN_MS = 5000;
    const GATHER_MS = 10000;
    const HAUL = 10;
    const CART_LOAD = 50;
    const CART_STEP_MS = STEP_MS * 2;
    const PAY_AMOUNT = 10;
    const PAY_MS = 10000;

    const SOLDIER = [
        "......cccc......",
        ".....ccccccc....",
        ".....ckkckkc....",
        ".....csssssc....",
        "......ssss......",
        ".....fffffff....",
        ".....fffffff....",
        ".....ffbfff.....",
        ".....fffffff....",
        "......f..f......",
        "......d..d......",
        ".....dd..dd.....",
        "....ss....ss....",
        "...ss......ss...",
        "................",
        "................"
    ];

    const DIRS = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];

    const factions = [
        {
            id: "blue",
            name: "Blue",
            hall: "Blue settlement",
            color: "#3c5ec8",
            dark: "#243880",
            zone: [OX, OX + 6],
            gold: 500,
            food: 500,
            wood: 500,
            stone: 500,
            iron: 500,
            payday: PAY_MS,
            trainLeft: 0,
            trained: false,
            building: { c: 1 + OX, r: 3 + OY, hp: BUILDING_HP, maxHp: BUILDING_HP, dead: false, hurt: 0 },
            muster: [
                [OX, 3 + OY], [OX, 4 + OY], [3 + OX, 2 + OY], [3 + OX, 5 + OY],
                [4 + OX, 3 + OY], [4 + OX, 4 + OY], [4 + OX, 2 + OY], [4 + OX, 5 + OY]
            ],
            soldiers: [],
            houses: [],
            works: [],
            walls: [],
            towers: [],
            windmills: [],
            carts: []
        },
        {
            id: "red",
            name: "Red",
            hall: "Red settlement",
            color: "#c43c3c",
            dark: "#7a2424",
            zone: [15 + OX, 21 + OX],
            gold: 500,
            food: 500,
            wood: 500,
            stone: 500,
            iron: 500,
            payday: PAY_MS,
            trainLeft: 0,
            trained: false,
            building: { c: 18 + OX, r: 3 + OY, hp: BUILDING_HP, maxHp: BUILDING_HP, dead: false, hurt: 0 },
            muster: [
                [17 + OX, 3 + OY], [17 + OX, 4 + OY], [17 + OX, 2 + OY], [17 + OX, 5 + OY],
                [16 + OX, 3 + OY], [16 + OX, 4 + OY], [16 + OX, 2 + OY], [16 + OX, 5 + OY]
            ],
            soldiers: [],
            houses: [],
            works: [],
            walls: [],
            towers: [],
            windmills: [],
            carts: []
        }
    ];

    let nextId = 1;
    let battleSeq = 0;
    let saveLeft = 1000;
    let selected = null;
    let placing = null;
    let placeHint = "";
    let lastTime = 0;
    const floaters = [];
    const slashes = [];
    const arrows = [];

    function startingWorker(spot) {
        return {
            id: nextId++,
            role: "worker",
            damage: WORKER_DAMAGE,
            c: spot[0],
            r: spot[1],
            hp: WORKER_HP,
            maxHp: WORKER_HP,
            order: null,
            step: null,
            wasInRange: false,
            attackWait: 0,
            flash: 0,
            hurt: 0,
            dead: false
        };
    }

    factions.forEach(function (faction) {
        let placed = 0;
        faction.muster.forEach(function (spot) {
            if (placed >= 5 || occupied(spot[0], spot[1], null)) return;
            faction.soldiers.push(startingWorker(spot));
            placed += 1;
        });
        while (placed < 5) {
            const spot = nextMuster(faction);
            if (!spot) break;
            faction.soldiers.push(startingWorker(spot));
            placed += 1;
        }
    });

    const START_BATTLE = JSON.parse(JSON.stringify(battleSnapshot()));

    function factionById(id) {
        return factions.find(function (f) { return f.id === id; });
    }

    function findSoldier(id) {
        for (let i = 0; i < factions.length; i++) {
            const soldier = factions[i].soldiers.find(function (s) { return s.id === id; });
            if (soldier) return { faction: factions[i], soldier: soldier };
        }
        if (player && player.id === id) return { faction: null, soldier: player };
        return null;
    }

    function selectedSoldier() {
        if (!selected || selected.kind !== "soldier") return null;
        return findSoldier(selected.id);
    }

    function boxTiles(c, r, w, h) {
        const tiles = [];
        for (let dc = 0; dc < w; dc++) {
            for (let dr = 0; dr < h; dr++) tiles.push({ c: c + dc, r: r + dr });
        }
        return tiles;
    }

    function inBox(c, r, originC, originR, w, h) {
        return c >= originC && c < originC + w && r >= originR && r < originR + h;
    }

    function buildingTiles(faction) {
        const b = faction.building;
        return boxTiles(b.c, b.r, HALL_W, HALL_H);
    }

    function isBuildingTile(c, r) {
        return factions.some(function (f) {
            if (!f.building.dead && inBox(c, r, f.building.c, f.building.r, HALL_W, HALL_H)) return true;
            return f.houses.some(function (house) {
                return !house.dead && inBox(c, r, house.c, house.r, HOUSE_W, HOUSE_H);
            }) || f.works.some(function (work) {
                return !work.dead && inBox(c, r, work.c, work.r, 2, 2);
            }) || f.walls.some(function (wall) {
                return !wall.dead && wall.c === c && wall.r === r;
            }) || f.towers.some(function (tower) {
                return !tower.dead && inBox(c, r, tower.c, tower.r, TOWER_W, TOWER_H);
            }) || f.windmills.some(function (mill) {
                return !mill.dead && inBox(c, r, mill.c, mill.r, MILL_W, MILL_H);
            });
        });
    }

    function buildingAt(c, r) {
        return factions.find(function (f) {
            return !f.building.dead && inBox(c, r, f.building.c, f.building.r, HALL_W, HALL_H);
        });
    }

    function houseAt(c, r) {
        for (let i = 0; i < factions.length; i++) {
            const house = factions[i].houses.find(function (item) {
                return !item.dead && inBox(c, r, item.c, item.r, HOUSE_W, HOUSE_H);
            });
            if (house) return { faction: factions[i], house: house };
        }
        return null;
    }

    function millAt(c, r) {
        for (let i = 0; i < factions.length; i++) {
            const mill = factions[i].windmills.find(function (item) {
                return !item.dead && inBox(c, r, item.c, item.r, MILL_W, MILL_H);
            });
            if (mill) return { faction: factions[i], mill: mill };
        }
        return null;
    }

    function findMill(id) {
        for (let i = 0; i < factions.length; i++) {
            const mill = factions[i].windmills.find(function (item) { return item.id === id; });
            if (mill) return { faction: factions[i], mill: mill };
        }
        return null;
    }

    function findHouse(id) {
        for (let i = 0; i < factions.length; i++) {
            const house = factions[i].houses.find(function (item) { return item.id === id; });
            if (house) return { faction: factions[i], house: house };
        }
        return null;
    }

    function pieceAt(listName, c, r, w, h) {
        const width = w || 1;
        const height = h || width;
        for (let i = 0; i < factions.length; i++) {
            const piece = factions[i][listName].find(function (item) {
                return !item.dead && inBox(c, r, item.c, item.r, width, height);
            });
            if (piece) return { faction: factions[i], piece: piece };
        }
        return null;
    }

    function findPiece(listName, id) {
        for (let i = 0; i < factions.length; i++) {
            const piece = factions[i][listName].find(function (item) { return item.id === id; });
            if (piece) return { faction: factions[i], piece: piece };
        }
        return null;
    }

    function distToBox(originC, originR, w, h, c, r) {
        let dc = 0;
        let dr = 0;
        if (c < originC) dc = originC - c;
        else if (c >= originC + w) dc = c - (originC + w - 1);
        if (r < originR) dr = originR - r;
        else if (r >= originR + h) dr = r - (originR + h - 1);
        return Math.max(dc, dr);
    }

    function distToHall(faction, c, r) {
        const b = faction.building;
        return distToBox(b.c, b.r, HALL_W, HALL_H, c, r);
    }

    function canPlaceBox(faction, c, r, w, h) {
        if (!faction || faction.building.dead) return false;
        for (let dc = 0; dc < w; dc++) {
            for (let dr = 0; dr < h; dr++) {
                const tc = c + dc;
                const tr = r + dr;
                if (tc < 0 || tr < 0 || tc >= COLS || tr >= ROWS) return false;
                if (occupied(tc, tr, null)) return false;
            }
        }
        return true;
    }

    function canPlaceHouse(faction, c, r) {
        if (!canPlaceBox(faction, c, r, HOUSE_W, HOUSE_H)) return false;
        for (let dc = 0; dc < HOUSE_W; dc++) {
            for (let dr = 0; dr < HOUSE_H; dr++) {
                const dist = distToHall(faction, c + dc, r + dr);
                if (dist === 0 || dist > HOUSE_RANGE) return false;
            }
        }
        return true;
    }

    function placeHouse(faction, c, r) {
        if (faction.wood < HOUSE_COST || !canPlaceHouse(faction, c, r)) return false;
        faction.wood -= HOUSE_COST;
        faction.houses.push({
            id: nextId++,
            c: c,
            r: r,
            hp: HOUSE_HP,
            maxHp: HOUSE_HP,
            hurt: 0,
            dead: false
        });
        floaters.push({
            x: (c + HOUSE_W / 2) * TILE,
            y: r * TILE + 24,
            life: 900,
            text: "+5 population"
        });
        return true;
    }

    function workAt(c, r) {
        for (let i = 0; i < factions.length; i++) {
            const work = factions[i].works.find(function (item) {
                return !item.dead && c >= item.c && c < item.c + 2 && r >= item.r && r < item.r + 2;
            });
            if (work) return { faction: factions[i], work: work };
        }
        return null;
    }

    function findWork(id) {
        for (let i = 0; i < factions.length; i++) {
            const work = factions[i].works.find(function (item) { return item.id === id; });
            if (work) return { faction: factions[i], work: work };
        }
        return null;
    }

    function canPlaceWork(faction, c, r) {
        if (!faction || faction.building.dead) return false;
        for (let dc = 0; dc < 2; dc++) {
            for (let dr = 0; dr < 2; dr++) {
                const tc = c + dc;
                const tr = r + dr;
                if (tc >= COLS || tr >= ROWS) return false;
                if (occupied(tc, tr, null)) return false;
            }
        }
        return true;
    }

    function canPlaceBlock(faction, c, r) {
        return canPlaceBox(faction, c, r, 1, 1);
    }

    function placeBlock(faction, kind, c, r) {
        const w = kind === "tower" ? TOWER_W : 1;
        const h = kind === "tower" ? TOWER_H : 1;
        if (faction.wood < HOUSE_COST || !canPlaceBox(faction, c, r, w, h)) return false;
        faction.wood -= HOUSE_COST;
        const hp = kind === "tower" ? TOWER_HP : WALL_HP;
        const piece = {
            id: nextId++,
            c: c,
            r: r,
            hp: hp,
            maxHp: hp,
            hurt: 0,
            dead: false
        };
        if (kind === "tower") {
            piece.shotWait = 0;
            faction.towers.push(piece);
        } else {
            faction.walls.push(piece);
        }
        floaters.push({
            x: c * TILE + TILE / 2,
            y: r * TILE + 24,
            life: 900,
            text: "-10 wood"
        });
        return true;
    }

    function canAffordMill(faction) {
        return faction
            && faction.gold >= MILL_COST
            && faction.food >= MILL_COST
            && faction.wood >= MILL_COST
            && faction.stone >= MILL_COST
            && faction.iron >= MILL_COST;
    }

    function placeMill(faction, c, r) {
        if (!canAffordMill(faction) || !canPlaceBox(faction, c, r, MILL_W, MILL_H)) return false;
        faction.gold -= MILL_COST;
        faction.food -= MILL_COST;
        faction.wood -= MILL_COST;
        faction.stone -= MILL_COST;
        faction.iron -= MILL_COST;
        faction.windmills.push({
            id: nextId++,
            c: c,
            r: r,
            hp: WORK_HP,
            maxHp: WORK_HP,
            hurt: 0,
            dead: false,
            foodLeft: MILL_MS
        });
        floaters.push({
            x: (c + MILL_W / 2) * TILE,
            y: r * TILE + 24,
            life: 900,
            text: "-10 each"
        });
        return true;
    }

    function canPlaceKind(faction, kind, c, r) {
        if (kind === "house") return canPlaceHouse(faction, c, r);
        if (kind === "wall") return canPlaceBlock(faction, c, r);
        if (kind === "tower") return canPlaceBox(faction, c, r, TOWER_W, TOWER_H);
        if (kind === "mill") return canPlaceBox(faction, c, r, MILL_W, MILL_H);
        return canPlaceWork(faction, c, r);
    }

    function placeWork(faction, kind, c, r) {
        if (faction.wood < HOUSE_COST || !canPlaceWork(faction, c, r)) return false;
        faction.wood -= HOUSE_COST;
        faction.works.push({
            id: nextId++,
            kind: kind,
            c: c,
            r: r,
            hp: WORK_HP,
            maxHp: WORK_HP,
            hurt: 0,
            dead: false,
            stock: { food: 0, wood: 0, gold: 0, stone: 0, iron: 0 }
        });
        floaters.push({
            x: (c + 1) * TILE,
            y: r * TILE + 24,
            life: 900,
            text: "-10 wood"
        });
        return true;
    }

    function drawPos(soldier) {
        if (!soldier.step) return { c: soldier.c, r: soldier.r };
        const t = Math.min(1, soldier.step.t);
        return {
            c: soldier.step.fromC + (soldier.step.toC - soldier.step.fromC) * t,
            r: soldier.step.fromR + (soldier.step.toR - soldier.step.fromR) * t
        };
    }

    function soldierAt(c, r) {
        for (let i = 0; i < factions.length; i++) {
            const faction = factions[i];
            for (let j = 0; j < faction.soldiers.length; j++) {
                const soldier = faction.soldiers[j];
                if (soldier.c === c && soldier.r === r) return { faction: faction, soldier: soldier };
                if (soldier.step && soldier.step.t > 0.35 && soldier.step.toC === c && soldier.step.toR === r) {
                    return { faction: faction, soldier: soldier };
                }
            }
        }
        if (player && !player.dead) {
            if (player.c === c && player.r === r) return { faction: null, soldier: player };
            if (player.step && player.step.t > 0.35 && player.step.toC === c && player.step.toR === r) {
                return { faction: null, soldier: player };
            }
        }
        return null;
    }

    function occupied(c, r, ignore, allowKind, throughUnits) {
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
        if (BattleMap.blocked(ground, c, r) && BattleMap.kind(ground, c, r) !== allowKind) return true;
        if (isBuildingTile(c, r)) return true;
        if (throughUnits) return false;
        for (let i = 0; i < factions.length; i++) {
            const soldiers = factions[i].soldiers;
            for (let j = 0; j < soldiers.length; j++) {
                const soldier = soldiers[j];
                if (soldier === ignore || soldier.dead) continue;
                if (soldier.c === c && soldier.r === r) return true;
                if (soldier.step && soldier.step.toC === c && soldier.step.toR === r) return true;
            }
        }
        if (player && player !== ignore && !player.dead) {
            if (player.c === c && player.r === r) return true;
            if (player.step && player.step.toC === c && player.step.toR === r) return true;
        }
        return false;
    }

    function musterTile(faction, c, r) {
        return faction.muster.some(function (spot) {
            return spot[0] === c && spot[1] === r;
        });
    }

    function nextMuster(faction) {
        const listed = faction.muster.find(function (spot) {
            return !occupied(spot[0], spot[1], null);
        });
        if (listed) return listed;
        const hall = faction.building;
        for (let dist = 1; dist <= 16; dist++) {
            for (let dc = -dist; dc <= dist + 1; dc++) {
                for (let dr = -dist; dr <= dist + 1; dr++) {
                    const c = hall.c + dc;
                    const r = hall.r + dr;
                    if (distToHall(faction, c, r) !== dist) continue;
                    if (occupied(c, r, null)) continue;
                    return [c, r];
                }
            }
        }
        return null;
    }

    function clearDoor(faction, unit) {
        const hall = faction.building;
        for (let dist = 2; dist <= 6; dist++) {
            for (let dc = -dist; dc <= dist + 1; dc++) {
                for (let dr = -dist; dr <= dist + 1; dr++) {
                    const c = hall.c + dc;
                    const r = hall.r + dr;
                    if (c === unit.c && r === unit.r) continue;
                    if (distToHall(faction, c, r) !== dist) continue;
                    if (musterTile(faction, c, r)) continue;
                    if (occupied(c, r, unit)) continue;
                    orderMove(unit, c, r);
                    return;
                }
            }
        }
    }

    function resolveOrder(soldier) {
        const order = soldier.order;
        if (!order) return null;
        if (order.kind === "gather") {
            if (order.c < 0 || order.r < 0 || order.c >= COLS || order.r >= ROWS) return null;
            if (BattleMap.kind(ground, order.c, order.r) !== order.source) return null;
            return order;
        }
        if (order.kind === "move") {
            if (order.c < 0 || order.r < 0 || order.c >= COLS || order.r >= ROWS) return null;
            if (isBuildingTile(order.c, order.r)) return null;
            return { kind: "move", c: order.c, r: order.r, tiles: [{ c: order.c, r: order.r }] };
        }
        if (order.kind === "building") {
            const faction = factionById(order.factionId);
            if (!faction || faction.building.dead || faction.building.hp <= 0) return null;
            return {
                kind: "building",
                faction: faction,
                ref: faction.building,
                tiles: buildingTiles(faction)
            };
        }
        if (order.kind === "house") {
            const found = findHouse(order.id);
            if (!found || found.house.dead || found.house.hp <= 0) return null;
            return {
                kind: "house",
                faction: found.faction,
                ref: found.house,
                tiles: boxTiles(found.house.c, found.house.r, HOUSE_W, HOUSE_H)
            };
        }
        if (order.kind === "mill") {
            const found = findMill(order.id);
            if (!found || found.mill.dead || found.mill.hp <= 0) return null;
            return {
                kind: "mill",
                faction: found.faction,
                ref: found.mill,
                tiles: boxTiles(found.mill.c, found.mill.r, MILL_W, MILL_H)
            };
        }
        if (order.kind === "work") {
            const found = findWork(order.id);
            if (!found || found.work.dead || found.work.hp <= 0) return null;
            return {
                kind: "work",
                faction: found.faction,
                ref: found.work,
                tiles: [
                    { c: found.work.c, r: found.work.r },
                    { c: found.work.c + 1, r: found.work.r },
                    { c: found.work.c, r: found.work.r + 1 },
                    { c: found.work.c + 1, r: found.work.r + 1 }
                ]
            };
        }
        if (order.kind === "wall" || order.kind === "tower") {
            const found = findPiece(order.kind === "wall" ? "walls" : "towers", order.id);
            if (!found || found.piece.dead || found.piece.hp <= 0) return null;
            return {
                kind: order.kind,
                faction: found.faction,
                ref: found.piece,
                tiles: boxTiles(found.piece.c, found.piece.r, order.kind === "tower" ? TOWER_W : 1, order.kind === "tower" ? TOWER_H : 1)
            };
        }
        const found = findSoldier(order.id);
        if (!found || found.soldier.dead || found.soldier.hp <= 0) return null;
        return {
            kind: "soldier",
            faction: found.faction,
            ref: found.soldier,
            tiles: [{ c: found.soldier.c, r: found.soldier.r }]
        };
    }

    function attackTiles(target) {
        const tiles = [];
        const seen = {};
        target.tiles.forEach(function (tile) {
            DIRS.forEach(function (dir) {
                const c = tile.c + dir[0];
                const r = tile.r + dir[1];
                const key = c + "," + r;
                if (seen[key]) return;
                seen[key] = true;
                if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
                if (target.tiles.some(function (body) { return body.c === c && body.r === r; })) return;
                if (isBuildingTile(c, r)) return;
                tiles.push({ c: c, r: r });
            });
        });
        return tiles;
    }

    function inRange(soldier, target) {
        return attackTiles(target).some(function (tile) {
            return tile.c === soldier.c && tile.r === soldier.r;
        });
    }

    function archerInRange(soldier, target) {
        return target.tiles.some(function (tile) {
            const dist = chebyshev(soldier.c, soldier.r, tile.c, tile.r);
            return dist > 0 && dist <= ARCHER_RANGE;
        });
    }

    function engaged(soldier, target) {
        if (soldier.role === "archer") return archerInRange(soldier, target);
        return inRange(soldier, target);
    }

    function stepToward(soldier, goals, allowKind, throughUnits) {
        const startKey = soldier.c + "," + soldier.r;
        if (goals[startKey]) return null;

        const prev = {};
        prev[startKey] = "";
        const queue = [{ c: soldier.c, r: soldier.r }];
        let found = null;

        while (queue.length && !found) {
            const cur = queue.shift();
            const curKey = cur.c + "," + cur.r;
            for (let i = 0; i < DIRS.length; i++) {
                const nc = cur.c + DIRS[i][0];
                const nr = cur.r + DIRS[i][1];
                const key = nc + "," + nr;
                if (prev[key] !== undefined) continue;
                if (occupied(nc, nr, soldier, allowKind, throughUnits)) continue;
                if (DIRS[i][0] !== 0 && DIRS[i][1] !== 0) {
                    if (occupied(cur.c + DIRS[i][0], cur.r, soldier, allowKind, throughUnits)) continue;
                    if (occupied(cur.c, cur.r + DIRS[i][1], soldier, allowKind, throughUnits)) continue;
                }
                prev[key] = curKey;
                if (goals[key]) {
                    found = { c: nc, r: nr };
                    break;
                }
                queue.push({ c: nc, r: nr });
            }
        }

        if (!found) return null;
        let key = found.c + "," + found.r;
        let step = found;
        while (prev[key] && prev[key] !== startKey) {
            const parts = prev[key].split(",");
            step = { c: Number(parts[0]), r: Number(parts[1]) };
            key = prev[key];
        }
        return step;
    }

    function nextStep(soldier, target) {
        const goals = {};
        attackTiles(target).forEach(function (tile) {
            if (!occupied(tile.c, tile.r, soldier)) goals[tile.c + "," + tile.r] = true;
        });
        return stepToward(soldier, goals);
    }

    function nextArcherStep(soldier, target) {
        const goals = {};
        const body = {};
        target.tiles.forEach(function (tile) { body[tile.c + "," + tile.r] = true; });
        target.tiles.forEach(function (tile) {
            for (let dc = -ARCHER_RANGE; dc <= ARCHER_RANGE; dc++) {
                for (let dr = -ARCHER_RANGE; dr <= ARCHER_RANGE; dr++) {
                    const c = tile.c + dc;
                    const r = tile.r + dr;
                    const dist = Math.max(Math.abs(dc), Math.abs(dr));
                    if (dist === 0 || dist > ARCHER_RANGE) continue;
                    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
                    if (body[c + "," + r]) continue;
                    if (occupied(c, r, soldier)) continue;
                    goals[c + "," + r] = true;
                }
            }
        });
        return stepToward(soldier, goals);
    }

    function targetCenter(target) {
        let c = 0;
        let r = 0;
        target.tiles.forEach(function (tile) {
            c += tile.c;
            r += tile.r;
        });
        c /= target.tiles.length;
        r /= target.tiles.length;
        return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
    }

    function strike(attacker, target) {
        if (target.ref.hp <= 0 || target.ref.dead) return;
        target.ref.hp = Math.max(0, target.ref.hp - (attacker.damage || SOLDIER_DAMAGE));
        target.ref.hurt = 160;
        attacker.flash = 140;
        const pos = targetCenter(target);
        const from = drawPos(attacker);
        const dealt = attacker.damage || SOLDIER_DAMAGE;
        floaters.push({
            x: pos.x,
            y: pos.y,
            life: 700,
            text: target.ref.hp <= 0 ? "Down" : "-" + dealt
        });
        if (attacker.role === "archer") {
            arrows.push({
                x1: from.c * TILE + TILE / 2,
                y1: from.r * TILE + 28,
                x2: pos.x,
                y2: pos.y,
                life: 280
            });
        } else {
            slashes.push({
                x1: from.c * TILE + 30,
                y1: from.r * TILE + 28,
                x2: pos.x,
                y2: pos.y,
                life: 140
            });
        }
        if (target.ref.hp <= 0) {
            target.ref.dead = true;
            notePlayerDown(target.ref);
        } else if (target.kind === "soldier") {
            const victim = target.ref;
            const dist = chebyshev(attacker.c, attacker.r, victim.c, victim.r);
            const canAnswer = victim.role === "archer" ? dist > 0 && dist <= ARCHER_RANGE : dist <= 1;
            const fightingBack = victim.order
                && victim.order.kind === "soldier"
                && victim.order.id === attacker.id;
            if (canAnswer && !fightingBack && !(victim.order && victim.order.kind === "gather")) {
                victim.order = { kind: "soldier", id: attacker.id };
                victim.wasInRange = false;
                victim.attackWait = 0;
                victim.step = null;
            }
        }
        if (player && attacker === player && target.faction) hostile[target.faction.id] = true;
    }

    function factionOf(soldier) {
        for (let i = 0; i < factions.length; i++) {
            if (factions[i].soldiers.indexOf(soldier) !== -1) return factions[i];
        }
        return null;
    }

    function besideBox(soldier, box) {
        let dc = 0;
        let dr = 0;
        const bw = box.w || box.span;
        const bh = box.h || box.span;
        if (soldier.c < box.c) dc = box.c - soldier.c;
        else if (soldier.c >= box.c + bw) dc = soldier.c - (box.c + bw - 1);
        if (soldier.r < box.r) dr = box.r - soldier.r;
        else if (soldier.r >= box.r + bh) dr = soldier.r - (box.r + bh - 1);
        return Math.max(dc, dr) === 1;
    }

    function dropBox(soldier, faction, order) {
        const info = GATHER[order.source];
        const sites = faction.works.filter(function (work) {
            return !work.dead && work.kind === info.work;
        });
        let site = order.dropId ? sites.find(function (work) { return work.id === order.dropId; }) : null;
        if (!site && sites.length) {
            let best = sites[0];
            let bestDist = Infinity;
            sites.forEach(function (work) {
                const dist = Math.max(Math.abs(soldier.c - work.c), Math.abs(soldier.r - work.r));
                if (dist < bestDist) {
                    best = work;
                    bestDist = dist;
                }
            });
            site = best;
            order.dropId = site.id;
        }
        if (site) return { c: site.c, r: site.r, span: 2, name: info.drop, work: site };
        order.dropId = null;
        return { c: faction.building.c, r: faction.building.r, w: HALL_W, h: HALL_H, span: HALL_W, name: "settlement", work: null };
    }

    function ringTiles(box) {
        const tiles = [];
        const bw = box.w || box.span;
        const bh = box.h || box.span;
        for (let c = box.c - 1; c <= box.c + bw; c++) {
            for (let r = box.r - 1; r <= box.r + bh; r++) {
                if (c >= box.c && c < box.c + bw && r >= box.r && r < box.r + bh) continue;
                if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
                tiles.push({ c: c, r: r });
            }
        }
        return tiles;
    }

    function sendCarts(faction, work) {
        if (!work.stock || faction.building.dead) return;
        ["food", "wood", "gold", "stone", "iron"].forEach(function (key) {
            while ((work.stock[key] || 0) >= CART_LOAD) {
                work.stock[key] -= CART_LOAD;
                const spot = ringTiles({ c: work.c, r: work.r, span: 2 }).find(function (tile) { return !occupied(tile.c, tile.r, null, null, true); })
                    || { c: work.c, r: work.r };
                faction.carts.push({
                    key: key,
                    amount: CART_LOAD,
                    workId: work.id,
                    c: spot.c,
                    r: spot.r,
                    step: null,
                    done: false
                });
            }
        });
    }

    function tickCarts(dt) {
        factions.forEach(function (faction) {
            const hall = faction.building;
            faction.carts.forEach(function (cart) {
                if (hall.dead) {
                    const site = faction.works.find(function (work) { return work.id === cart.workId && !work.dead; });
                    if (site && site.stock) site.stock[cart.key] = (site.stock[cart.key] || 0) + cart.amount;
                    cart.done = true;
                    return;
                }
                if (cart.step) {
                    cart.step.t += dt / CART_STEP_MS;
                    if (cart.step.t >= 1) {
                        cart.c = cart.step.toC;
                        cart.r = cart.step.toR;
                        cart.step = null;
                    }
                    return;
                }
                const box = { c: hall.c, r: hall.r, w: HALL_W, h: HALL_H, span: HALL_W };
                if (besideBox(cart, box)) {
                    faction[cart.key] += cart.amount;
                    floaters.push({
                        x: (hall.c + 1) * TILE,
                        y: hall.r * TILE + 18,
                        life: 900,
                        text: "+" + cart.amount + " " + cart.key
                    });
                    cart.done = true;
                    return;
                }
                const goals = {};
                ringTiles(box).forEach(function (tile) {
                    if (!occupied(tile.c, tile.r, cart, null, true)) goals[tile.c + "," + tile.r] = true;
                });
                const step = stepToward(cart, goals, null, true);
                if (!step) return;
                cart.step = {
                    fromC: cart.c,
                    fromR: cart.r,
                    toC: step.c,
                    toR: step.r,
                    t: 0
                };
            });
            faction.carts = faction.carts.filter(function (cart) { return !cart.done; });
        });
    }

    function tickGather(soldier, dt) {
        const order = soldier.order;
        const faction = factionOf(soldier);
        if (!faction || faction.building.dead || BattleMap.kind(ground, order.c, order.r) !== order.source) {
            soldier.order = null;
            return;
        }

        if (order.phase === "work") {
            if (soldier.c !== order.c || soldier.r !== order.r) {
                order.phase = "go";
            } else {
                order.workLeft -= dt;
                if (order.workLeft <= 0) order.phase = "back";
                return;
            }
        }

        if (order.phase === "back") {
            const box = dropBox(soldier, faction, order);
            const info = GATHER[order.source];
            const onResource = soldier.c === order.c && soldier.r === order.r;
            if (!onResource && besideBox(soldier, box)) {
                if (box.work) {
                    box.work.stock[info.key] = (box.work.stock[info.key] || 0) + HAUL;
                    sendCarts(faction, box.work);
                } else {
                    faction[info.key] += HAUL;
                }
                floaters.push({
                    x: (box.c + box.span / 2) * TILE,
                    y: box.r * TILE + 30,
                    life: 900,
                    text: "+" + info.haul
                });
                order.phase = "go";
                order.workLeft = 0;
                order.dropId = null;
                return;
            }
            const goals = {};
            for (let c = box.c - 1; c <= box.c + box.span; c++) {
                for (let r = box.r - 1; r <= box.r + box.span; r++) {
                    if (c >= box.c && c < box.c + box.span && r >= box.r && r < box.r + box.span) continue;
                    if (c === order.c && r === order.r) continue;
                    if (!occupied(c, r, soldier)) goals[c + "," + r] = true;
                }
            }
            const step = stepToward(soldier, goals, order.source);
            if (!step) return;
            soldier.step = {
                fromC: soldier.c,
                fromR: soldier.r,
                toC: step.c,
                toR: step.r,
                t: 0
            };
            return;
        }

        if (soldier.c === order.c && soldier.r === order.r) {
            order.phase = "work";
            order.workLeft = GATHER_MS;
            return;
        }
        const goals = {};
        if (!occupied(order.c, order.r, soldier, order.source)) goals[order.c + "," + order.r] = true;
        const step = stepToward(soldier, goals, order.source);
        if (!step) return;
        soldier.step = {
            fromC: soldier.c,
            fromR: soldier.r,
            toC: step.c,
            toR: step.r,
            t: 0
        };
    }

    function tickSoldier(soldier, dt) {
        if (soldier.hurt > 0) soldier.hurt -= dt;
        if (soldier.flash > 0) soldier.flash -= dt;
        if (soldier.dead) return;

        if (soldier.step) {
            soldier.step.t += dt / STEP_MS;
            if (soldier.step.t >= 1) {
                soldier.c = soldier.step.toC;
                soldier.r = soldier.step.toR;
                soldier.step = null;
            }
            return;
        }

        const target = resolveOrder(soldier);
        if (!target) {
            soldier.order = null;
            soldier.wasInRange = false;
            return;
        }

        if (target.kind === "move") {
            soldier.wasInRange = false;
            if (soldier.c === target.c && soldier.r === target.r) {
                soldier.order = null;
                return;
            }
            const goals = {};
            if (!occupied(target.c, target.r, soldier)) goals[target.c + "," + target.r] = true;
            const step = stepToward(soldier, goals);
            if (!step || occupied(step.c, step.r, soldier)) return;
            soldier.step = {
                fromC: soldier.c,
                fromR: soldier.r,
                toC: step.c,
                toR: step.r,
                t: 0
            };
            return;
        }

        if (target.kind === "gather") {
            soldier.wasInRange = false;
            tickGather(soldier, dt);
            return;
        }

        if (engaged(soldier, target)) {
            if (!soldier.wasInRange) {
                soldier.wasInRange = true;
                soldier.attackWait = HIT_MS;
                return target;
            }
            soldier.attackWait -= dt;
            if (soldier.attackWait <= 0) {
                soldier.attackWait = HIT_MS;
                return target;
            }
            return null;
        }

        soldier.wasInRange = false;
        const step = soldier.role === "archer" ? nextArcherStep(soldier, target) : nextStep(soldier, target);
        if (!step || occupied(step.c, step.r, soldier)) return;
        soldier.step = {
            fromC: soldier.c,
            fromR: soldier.r,
            toC: step.c,
            toR: step.r,
            t: 0
        };
    }

    function cleanup() {
        factions.forEach(function (faction) {
            if (faction.building.dead) faction.building.hp = 0;
            faction.houses.forEach(function (house) {
                if (house.dead) house.hp = 0;
            });
            faction.houses = faction.houses.filter(function (house) { return !house.dead; });
            faction.works.forEach(function (work) {
                if (work.dead) work.hp = 0;
            });
            faction.works = faction.works.filter(function (work) { return !work.dead; });
            faction.walls.forEach(function (wall) {
                if (wall.dead) wall.hp = 0;
            });
            faction.walls = faction.walls.filter(function (wall) { return !wall.dead; });
            faction.towers.forEach(function (tower) {
                if (tower.dead) tower.hp = 0;
            });
            faction.towers = faction.towers.filter(function (tower) { return !tower.dead; });
            faction.windmills.forEach(function (mill) {
                if (mill.dead) mill.hp = 0;
            });
            faction.windmills = faction.windmills.filter(function (mill) { return !mill.dead; });
            faction.soldiers = faction.soldiers.filter(function (soldier) { return !soldier.dead; });
            faction.soldiers.forEach(function (soldier) {
                if (soldier.order && !resolveOrder(soldier)) {
                    soldier.order = null;
                    soldier.wasInRange = false;
                }
            });
        });
        if (selected && selected.kind === "soldier" && !findSoldier(selected.id)) selected = null;
        if (selected && selected.kind === "house" && !findHouse(selected.id)) selected = null;
        if (selected && selected.kind === "work" && !findWork(selected.id)) selected = null;
        if (selected && selected.kind === "wall" && !findPiece("walls", selected.id)) selected = null;
        if (selected && selected.kind === "tower" && !findPiece("towers", selected.id)) selected = null;
        if (selected && selected.kind === "mill" && !findMill(selected.id)) selected = null;
        if (selected && selected.kind === "building" && factionById(selected.factionId).building.dead) {
            selected = null;
        }
    }

    function secondsLeft(ms) {
        return Math.max(1, Math.ceil(ms / 1000));
    }

    function secondsPhrase(ms) {
        const n = secondsLeft(ms);
        return n + " second" + (n === 1 ? "" : "s");
    }

    function tickEconomy(faction, dt) {
        const hall = faction.building;
        if (hall.dead) {
            faction.trainLeft = 0;
            faction.trained = false;
            faction.trainKind = null;
            return;
        }

        faction.payday -= dt;
        while (faction.payday <= 0) {
            faction.gold += PAY_AMOUNT;
            faction.food += PAY_AMOUNT;
            faction.payday += PAY_MS;
            floaters.push({
                x: hall.c * TILE + TILE,
                y: hall.r * TILE + 20,
                life: 900,
                text: "+10 gold, +10 food"
            });
        }

        if (faction.trainLeft > 0) {
            faction.trainLeft -= dt;
            if (faction.trainLeft <= 0) {
                faction.trainLeft = 0;
                faction.trained = true;
            }
        }
        if (faction.trained && makeUnit(faction, faction.trainKind || "soldier")) {
            faction.trained = false;
            faction.trainKind = null;
        }
    }

    function popCount(faction) {
        return faction.soldiers.filter(function (soldier) {
            return !soldier.dead && soldier.hp > 0;
        }).length;
    }

    function popLimit(faction) {
        const houses = faction.houses.filter(function (house) {
            return !house.dead && house.hp > 0;
        }).length;
        return POP_START + houses * POP_PER_HOUSE;
    }

    function popRoom(faction) {
        return popCount(faction) < popLimit(faction);
    }

    function workerCount(faction) {
        return faction.soldiers.filter(function (soldier) {
            return !soldier.dead && soldier.hp > 0 && soldier.role === "worker";
        }).length;
    }

    function popPhrase(faction) {
        return "Population " + popCount(faction) + " / " + popLimit(faction)
            + ", " + workerCount(faction) + " workers";
    }

    function canAfford(faction, role) {
        if (role === "worker") return faction.food >= TRAIN_COST;
        if (role === "archer") return faction.gold >= TRAIN_COST && faction.wood >= TRAIN_COST;
        if (sideCpu(faction.id)) return faction.food >= TRAIN_COST && faction.iron >= TRAIN_COST && faction.wood >= TRAIN_COST;
        return faction.gold >= TRAIN_COST && faction.food >= TRAIN_COST;
    }

    function canStartTrain(faction, role) {
        return faction
            && !faction.building.dead
            && faction.trainLeft <= 0
            && !faction.trained
            && canAfford(faction, role || "soldier")
            && popRoom(faction)
            && nextMuster(faction);
    }

    function otherFaction(faction) {
        return factions[0].id === faction.id ? factions[1] : factions[0];
    }

    function sideCpu(id) {
        if (id === "blue") return playerMode;
        if (id === "red") return redCpu;
        return false;
    }

    function manualSelection() {
        if (!selected) return false;
        if (selected.kind === "soldier") {
            const found = findSoldier(selected.id);
            return !!(found && found.faction && !sideCpu(found.faction.id));
        }
        return !!(selected.factionId && !sideCpu(selected.factionId));
    }

    function nearestShotTarget(faction, c, r, w, h) {
        const foe = otherFaction(faction);
        let best = null;
        let dist = TOWER_RANGE + 1;
        foe.soldiers.forEach(function (soldier) {
            if (soldier.dead || soldier.hp <= 0) return;
            const d = distToBox(c, r, w, h, soldier.c, soldier.r);
            if (d <= TOWER_RANGE && d < dist) {
                dist = d;
                best = soldier;
            }
        });
        if (player && !player.dead && hostile[faction.id]) {
            const d = distToBox(c, r, w, h, player.c, player.r);
            if (d <= TOWER_RANGE && d < dist) best = player;
        }
        return best;
    }

    function shootFrom(c, r, w, h, foe) {
        foe.hp = Math.max(0, foe.hp - TOWER_DAMAGE);
        foe.hurt = 160;
        if (foe.hp <= 0) {
            foe.dead = true;
            notePlayerDown(foe);
        }
        const pos = drawPos(foe);
        arrows.push({
            x1: c * TILE + w * TILE / 2,
            y1: r * TILE + h * TILE / 2,
            x2: pos.c * TILE + TILE / 2,
            y2: pos.r * TILE + 28,
            life: 280
        });
        floaters.push({
            x: pos.c * TILE + TILE / 2,
            y: pos.r * TILE + 28,
            life: 700,
            text: foe.hp <= 0 ? "Down" : "-" + TOWER_DAMAGE
        });
    }

    function tickShooter(owner, faction, w, h, dt) {
        if (owner.dead || owner.hp <= 0) return;
        owner.shotWait = Math.max(0, (owner.shotWait || 0) - dt);
        const foe = nearestShotTarget(faction, owner.c, owner.r, w, h);
        if (!foe || owner.shotWait > 0) return;
        owner.shotWait = TOWER_HIT_MS;
        shootFrom(owner.c, owner.r, w, h, foe);
    }

    function tickTowers(dt) {
        factions.forEach(function (faction) {
            tickShooter(faction.building, faction, HALL_W, HALL_H, dt);
            faction.towers.forEach(function (tower) {
                tickShooter(tower, faction, TOWER_W, TOWER_H, dt);
            });
        });
    }

    function update(dt) {
        const strikes = [];
        factions.forEach(function (faction) {
            if (faction.building.hurt > 0) faction.building.hurt -= dt;
            faction.houses.forEach(function (house) {
                if (house.hurt > 0) house.hurt -= dt;
            });
            faction.works.forEach(function (work) {
                if (work.hurt > 0) work.hurt -= dt;
            });
            faction.walls.forEach(function (wall) {
                if (wall.hurt > 0) wall.hurt -= dt;
            });
            faction.towers.forEach(function (tower) {
                if (tower.hurt > 0) tower.hurt -= dt;
            });
            faction.windmills.forEach(function (mill) {
                if (mill.hurt > 0) mill.hurt -= dt;
                if (mill.dead || mill.hp <= 0) return;
                mill.foodLeft -= dt;
                while (mill.foodLeft <= 0) {
                    mill.foodLeft += MILL_MS;
                    faction.food += MILL_FOOD;
                    floaters.push({
                        x: mill.c * TILE + TILE / 2,
                        y: mill.r * TILE + 16,
                        life: 900,
                        text: "+10 food"
                    });
                }
                if (selected && selected.kind === "mill" && selected.id === mill.id) {
                    const sec = secondsLeft(mill.foodLeft);
                    if (sec !== mill.shown) {
                        mill.shown = sec;
                        updateHud();
                    }
                }
            });
            tickEconomy(faction, dt);
            faction.soldiers.forEach(function (soldier) {
                const target = tickSoldier(soldier, dt);
                if (target) strikes.push({ attacker: soldier, target: target });
            });
        });
        tickPlayer(dt, strikes);
        strikes.forEach(function (hit) { strike(hit.attacker, hit.target); });
        tickCarts(dt);
        tickTowers(dt);
        cleanup();
        tickRedCpu();
        for (let i = floaters.length - 1; i >= 0; i--) {
            floaters[i].life -= dt;
            if (floaters[i].life <= 0) floaters.splice(i, 1);
        }
        for (let i = slashes.length - 1; i >= 0; i--) {
            slashes[i].life -= dt;
            if (slashes[i].life <= 0) slashes.splice(i, 1);
        }
        for (let i = arrows.length - 1; i >= 0; i--) {
            arrows[i].life -= dt;
            if (arrows[i].life <= 0) arrows.splice(i, 1);
        }
        updateHud();
    }

    function personWord(unit) {
        if (unit && unit.role === "worker") return "worker";
        if (unit && unit.role === "archer") return "archer";
        return "soldier";
    }

    function trainName(kind) {
        if (kind === "worker") return "worker";
        if (kind === "archer") return "archer";
        return "soldier";
    }

    function trainPhrase(kind) {
        const who = trainName(kind);
        return (who === "archer" ? "an " : "a ") + who;
    }

    function struckName(target) {
        if (!target.faction) return "you";
        const side = target.faction.name.toLowerCase();
        if (target.kind === "building") return target.faction.hall;
        if (target.kind === "house") return "a " + side + " house";
        if (target.kind === "mill") return "a " + side + " windmill";
        if (target.kind === "work") return "a " + side + " " + WORK_NAMES[target.ref.kind].toLowerCase();
        if (target.kind === "wall") return "a " + side + " wall";
        if (target.kind === "tower") return "a " + side + " watchtower";
        return "a " + side + " " + personWord(target.ref);
    }

    function paintTrain(faction) {
        const training = faction && faction.trainLeft > 0;
        const kind = (faction && faction.trainKind) || "soldier";
        const openSoldier = !!(faction && canStartTrain(faction, "soldier"));
        const openWorker = !!(faction && canStartTrain(faction, "worker"));
        const openArcher = !!(faction && canStartTrain(faction, "archer"));
        const handsOff = faction && sideCpu(faction.id);
        trainBtn.disabled = handsOff || !openSoldier;
        workerBtn.disabled = handsOff || !openWorker;
        archerBtn.disabled = handsOff || !openArcher;
        trainBtn.textContent = training && kind === "soldier"
            ? "Training " + secondsLeft(faction.trainLeft) + "s"
            : "Make soldier";
        workerBtn.textContent = training && kind === "worker"
            ? "Training " + secondsLeft(faction.trainLeft) + "s"
            : "Make worker";
        archerBtn.textContent = training && kind === "archer"
            ? "Training " + secondsLeft(faction.trainLeft) + "s"
            : "Make archer";
    }

    function stocks(faction) {
        return popCount(faction) + "/" + popLimit(faction) + " population, "
            + faction.gold + " gold, " + faction.food + " food, " + faction.wood + " wood, "
            + faction.stone + " stone, " + faction.iron + " iron";
    }

    function storedPhrase(work) {
        const bits = [];
        ["food", "wood", "gold", "stone", "iron"].forEach(function (key) {
            const n = work.stock && work.stock[key];
            if (n > 0) bits.push(n + " " + key);
        });
        return bits.length ? bits.join(", ") : "nothing yet";
    }

    function stockBits(faction) {
        return popPhrase(faction) + "  ·  Gold " + faction.gold + "  ·  Food " + faction.food
            + "  ·  Wood " + faction.wood + "  ·  Stone " + faction.stone + "  ·  Iron " + faction.iron;
    }

    function paintHouse(faction) {
        const handsOff = faction && sideCpu(faction.id);
        const open = !!(faction && !faction.building.dead && faction.wood >= HOUSE_COST && !handsOff);
        [
            [houseBtn, "house", "house"],
            [mineBtn, "mine", "mine"],
            [ironBtn, "iron", "iron mine"],
            [yardBtn, "yard", "lumberyard"],
            [portBtn, "port", "fishing port"],
            [wallBtn, "wall", "wall"],
            [towerBtn, "tower", "watchtower"]
        ].forEach(function (item) {
            const active = !!(placing && faction && placing.factionId === faction.id && placing.kind === item[1]);
            item[0].disabled = handsOff || (!open && !active);
            item[0].textContent = active ? "Cancel " + item[2] : "Make " + item[2];
        });
        const milling = !!(placing && faction && placing.factionId === faction.id && placing.kind === "mill");
        millBtn.disabled = handsOff || (!canAffordMill(faction) && !milling) || !!(faction && faction.building.dead);
        if (!faction) millBtn.disabled = true;
        millBtn.textContent = milling ? "Cancel windmill" : "Make windmill";
    }

    function showPlayerHud() {
        swatch.style.background = PLAYER_LOOK.color;
        if (!player) {
            nameEl.textContent = "You";
            countEl.textContent = "Waiting";
            statusEl.textContent = "WASD moves. Right-click an enemy to attack. On a phone, press and hold.";
            return;
        }
        nameEl.textContent = "You";
        countEl.textContent = "Health " + player.hp + " / " + player.maxHp
            + "  ·  Blue " + workerCount(factions[0]) + " workers  ·  Red " + workerCount(factions[1]) + " workers";
        if (player.dead) {
            statusEl.textContent = "You are down. You return in " + secondsPhrase(playerDown) + ".";
            return;
        }
        const angry = [];
        if (hostile.blue) angry.push("Blue");
        if (hostile.red) angry.push("Red");
        const peace = angry.length
            ? angry.join(" and ") + (angry.length === 1 ? " is" : " are") + " fighting you."
            : "You are neutral until you attack a side.";
        const target = resolveOrder(player);
        if (target && player.wasInRange) {
            statusEl.textContent = "Hitting " + struckName(target) + " for " + player.damage + " each second. Health left " + target.ref.hp + " / " + target.ref.maxHp + ". " + peace;
        } else if (target) {
            statusEl.textContent = "Walking in. You hit for " + player.damage + " beside the enemy, then once a second. " + peace;
        } else {
            statusEl.textContent = "WASD moves. Right-click an enemy to attack. On a phone, press and hold. Blue is a computer. "
                + (redCpu ? "Red is a computer. " : "You can still command Red. ")
                + peace;
        }
    }

    function updateHud() {
        const mine = selectedSoldier();
        if (selected && selected.kind === "soldier" && !mine) selected = null;
        if (selected && selected.kind === "house" && !findHouse(selected.id)) selected = null;
        if (selected && selected.kind === "work" && !findWork(selected.id)) selected = null;
        if (selected && selected.kind === "wall" && !findPiece("walls", selected.id)) selected = null;
        if (selected && selected.kind === "tower" && !findPiece("towers", selected.id)) selected = null;
        if (selected && selected.kind === "mill" && !findMill(selected.id)) selected = null;
        if (placing && sideCpu(placing.factionId)) {
            placing = null;
            placeHint = "";
        }
        if (placing && (!selected || selected.kind !== "building" || selected.factionId !== placing.factionId)) {
            placing = null;
            placeHint = "";
        }

        const trainFaction = selected && selected.kind === "building"
            ? factionById(selected.factionId)
            : null;
        paintTrain(trainFaction);
        paintHouse(trainFaction);

        const lookingAtYou = !selected || (mine && !mine.faction);
        if (playerMode && lookingAtYou && !manualSelection()) {
            showPlayerHud();
            return;
        }

        if (!selected) {
            nameEl.textContent = "Nothing selected";
            countEl.textContent = "Blue " + stocks(factions[0]) + "  ·  Red " + stocks(factions[1]);
            const nextPay = factions.reduce(function (best, faction) {
                if (faction.building.dead) return best;
                if (best === null || faction.payday < best) return faction.payday;
                return best;
            }, null);
            statusEl.textContent = nextPay === null
                ? "Both settlements are down, so no gold or food is coming in."
                : "Settlements pay 10 gold and 10 food every 10 seconds. Next pay in "
                    + secondsPhrase(nextPay)
                    + ". Walls and watchtowers cost 10 wood. A watchtower shoots 4 squares. "
                    + (redCpu ? "Red is a computer trying to destroy Blue." : "You are commanding both sides.");
            swatch.style.background = "#3a4034";
            return;
        }

        const faction = factionById(selected.factionId || (mine && mine.faction.id));
        swatch.style.background = faction.color;

        if (selected.kind === "soldier") {
            const soldier = mine.soldier;
            const target = resolveOrder(soldier);
            nameEl.textContent = faction.name + " " + personWord(soldier);
            countEl.textContent = "Health " + soldier.hp + " / " + soldier.maxHp + "  ·  " + stockBits(faction);
            const say = function (line) {
                statusEl.textContent = sideCpu(faction.id)
                    ? line + " The computer keeps this order."
                    : line;
            };
            if (soldier.order && soldier.order.kind === "gather") {
                const order = soldier.order;
                const info = GATHER[order.source];
                const where = dropBox(soldier, faction, order).name;
                const held = dropBox(soldier, faction, order).work
                    ? " The load stays there until 50 is ready for a cart to the settlement."
                    : "";
                if (order.phase === "work") {
                    say("Gathering at the " + info.place + ". "
                        + secondsPhrase(order.workLeft) + " left, then they walk to the " + where + " with " + info.haul + "." + held);
                } else if (order.phase === "back") {
                    say("Walking to the " + where + " with " + info.haul + "." + held);
                } else {
                    say("Walking to the " + info.place + ". They stay 10 seconds, drop " + info.haul + " at the " + where + ", then go again." + held);
                }
                return;
            }
            if (soldier.order && soldier.order.kind === "move") {
                say("Walking to that square.");
                return;
            }
            if (!target) {
                if (soldier.role === "worker") {
                    say("Right-click water, forest, or a gold, stone, or iron mine. On a phone, press and hold. They stay 10 seconds, drop the load at a fishing port, lumberyard, mine, or iron mine when you have one, and go again. Those buildings keep the load until a cart takes 50 to the settlement. This worker hits for 5.");
                } else if (soldier.role === "archer") {
                    say("Right-click an empty square to walk there, or an enemy to shoot. On a phone, press and hold. This archer has 60 health and hits for " + soldier.damage + ", out to 4 squares.");
                } else {
                    say("Right-click an empty square to walk there, or an enemy to attack. On a phone, press and hold. This soldier hits for " + soldier.damage + ".");
                }
            } else if (soldier.wasInRange) {
                say("Hitting " + struckName(target) + " for " + soldier.damage + " each second. Health left " + target.ref.hp + " / " + target.ref.maxHp + ".");
            } else if (soldier.role === "archer") {
                say("Walking into range. They shoot for " + soldier.damage + " out to 4 squares, then once a second.");
            } else {
                say("Walking in. They hit for " + soldier.damage + " when they stand next to the enemy, then once a second.");
            }
            return;
        }

        if (selected.kind === "house") {
            const found = findHouse(selected.id);
            const house = found.house;
            nameEl.textContent = faction.name + " house";
            countEl.textContent = "Health " + house.hp + " / " + house.maxHp + "  ·  " + stockBits(faction);
            statusEl.textContent = "A house covers 2 by 2 squares, costs 10 wood, and has to sit within 10 squares of the settlement. Each house adds 5 to the population limit, which starts at 10.";
            return;
        }

        if (selected.kind === "mill") {
            const found = findMill(selected.id);
            const mill = found.mill;
            nameEl.textContent = faction.name + " windmill";
            countEl.textContent = "Health " + mill.hp + " / " + mill.maxHp + "  ·  " + stockBits(faction);
            statusEl.textContent = "A windmill covers 2 by 2 squares and costs 10 gold, food, wood, stone, and iron. It adds 10 food every minute. Next food in " + secondsPhrase(mill.foodLeft) + ".";
            return;
        }

        if (selected.kind === "work") {
            const found = findWork(selected.id);
            const work = found.work;
            nameEl.textContent = faction.name + " " + WORK_NAMES[work.kind].toLowerCase();
            countEl.textContent = "Health " + work.hp + " / " + work.maxHp + "  ·  Stored " + storedPhrase(work) + "  ·  " + stockBits(faction);
            const hold = " Workers' loads stay here. At 50 of one resource, a horse and cart takes it to the settlement and disappears.";
            if (work.kind === "mine") statusEl.textContent = "Workers drop gold and stone at this mine." + hold;
            else if (work.kind === "iron") statusEl.textContent = "Workers drop iron at this iron mine." + hold;
            else if (work.kind === "yard") statusEl.textContent = "Workers drop wood at this lumberyard." + hold;
            else statusEl.textContent = "Workers drop food at this fishing port." + hold;
            return;
        }

        if (selected.kind === "wall") {
            const found = findPiece("walls", selected.id);
            const wall = found.piece;
            nameEl.textContent = faction.name + " wall";
            countEl.textContent = "Health " + wall.hp + " / " + wall.maxHp + "  ·  " + stockBits(faction);
            statusEl.textContent = "A wall is one square, has 1000 health, and costs 10 wood. Soldiers cannot walk through it.";
            return;
        }

        if (selected.kind === "tower") {
            const found = findPiece("towers", selected.id);
            const tower = found.piece;
            nameEl.textContent = faction.name + " watchtower";
            countEl.textContent = "Health " + tower.hp + " / " + tower.maxHp + "  ·  " + stockBits(faction);
            statusEl.textContent = "A watchtower covers 2 by 3 squares. It shoots one arrow every 1.5 seconds for 10 damage, out to 4 squares.";
            return;
        }

        const hall = faction.building;
        nameEl.textContent = faction.hall;
        countEl.textContent = "Health " + hall.hp + " / " + hall.maxHp + "  ·  " + stockBits(faction);

        if (placing && placing.factionId === faction.id) {
            const lead = placing.kind === "house"
                ? "Right-click the top-left square of a free 2 by 2 within 10 of this settlement. On a phone, press and hold."
                : placing.kind === "wall"
                    ? "Right-click an open square anywhere on the map. On a phone, press and hold."
                    : placing.kind === "tower"
                        ? "Right-click the top-left square of a free 2 by 3 anywhere on the map. On a phone, press and hold."
                        : "Right-click the top-left square of a free 2 by 2 anywhere on the map. On a phone, press and hold.";
            const price = placing.kind === "mill"
                ? " It costs 10 of each resource. You have " + faction.gold + " gold, " + faction.food + " food, " + faction.wood + " wood, " + faction.stone + " stone, and " + faction.iron + " iron."
                : " It costs 10 wood. You have " + faction.wood + " wood.";
            statusEl.textContent = placeHint || (lead + price);
            return;
        }

        if (redCpu && faction.id === "red") {
            if (faction.trainLeft > 0) {
                statusEl.textContent = "The computer is training " + trainPhrase(faction.trainKind) + ". They step out in " + secondsPhrase(faction.trainLeft) + ". Red is trying to destroy Blue.";
                return;
            }
            statusEl.textContent = "The computer is running Red and trying to destroy Blue. Its soldiers cost 10 food, 10 iron, and 10 wood. It trains workers. A lumberyard, iron mine, or fishing port is built beside a resource that is at least 12 squares from the settlement. Closer resources are carried straight back. This settlement shoots 10 damage every 1.5 seconds, out to 4 squares. Switch Red to you to command this settlement.";
            return;
        }

        if (faction.trainLeft > 0) {
            statusEl.textContent = "Training " + trainPhrase(faction.trainKind) + ". They step out in " + secondsPhrase(faction.trainLeft) + ".";
            return;
        }
        if (faction.trained && !popRoom(faction)) {
            statusEl.textContent = popPhrase(faction) + ". This person is waiting for room. A house adds 5 to the limit.";
            return;
        }
        if (faction.trained) {
            const who = trainName(faction.trainKind);
            statusEl.textContent = "The " + who + " is trained and waiting for an open square.";
            return;
        }
        if (!nextMuster(faction)) {
            statusEl.textContent = "No open square in front of this settlement.";
            return;
        }
        if (!popRoom(faction)) {
            statusEl.textContent = popPhrase(faction) + ". Build a house to raise the limit by 5.";
            return;
        }
        if (faction.food < TRAIN_COST) {
            statusEl.textContent = "A soldier costs 10 gold and 10 food. A worker costs 10 food. An archer costs 10 gold and 10 wood. Next pay in " + secondsPhrase(faction.payday) + ".";
            return;
        }
        if (faction.gold < TRAIN_COST) {
            statusEl.textContent = "A worker is ready for 10 food. A soldier still needs 10 gold as well. An archer needs 10 gold and 10 wood. Next pay in " + secondsPhrase(faction.payday) + ".";
            return;
        }
        statusEl.textContent = "Each side starts with 5 workers. Population starts at 10. Each house adds 5. Soldier: 10 gold and 10 food, 100 health. Worker: 10 food. Archer: 10 gold and 10 wood, 60 health, shoots 10 damage out to 4 squares. House: 10 wood, within 10 squares of the settlement. Mine, iron mine, lumberyard, and fishing port: 10 wood, anywhere. They keep what workers drop until a cart takes 50 to the settlement. Wall and watchtower: 10 wood, one square, anywhere. This settlement and each watchtower shoot 10 damage every 1.5 seconds, out to 4 squares.";
    }

    function makeUnit(faction, role) {
        const spot = nextMuster(faction);
        if (!spot || !popRoom(faction)) return false;
        const worker = role === "worker";
        const archer = role === "archer";
        const hp = worker ? WORKER_HP : archer ? ARCHER_HP : SOLDIER_HP;
        const unit = {
            id: nextId++,
            role: worker ? "worker" : archer ? "archer" : "soldier",
            damage: worker ? WORKER_DAMAGE : SOLDIER_DAMAGE,
            c: spot[0],
            r: spot[1],
            hp: hp,
            maxHp: hp,
            order: null,
            step: null,
            wasInRange: false,
            attackWait: 0,
            flash: 0,
            hurt: 0,
            dead: false
        };
        faction.soldiers.push(unit);
        clearDoor(faction, unit);
        return true;
    }

    function orderAttack(soldier, order) {
        soldier.order = order;
        soldier.wasInRange = false;
        soldier.attackWait = 0;
    }

    function orderMove(soldier, c, r) {
        soldier.order = { kind: "move", c: c, r: r };
        soldier.wasInRange = false;
        soldier.attackWait = 0;
    }

    function tileHit(event) {
        const tile = battleView.tileFromEvent(event);
        const c = tile.c;
        const r = tile.r;
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
        const hall = buildingAt(c, r);
        const house = houseAt(c, r);
        const work = workAt(c, r);
        const wall = pieceAt("walls", c, r);
        const tower = pieceAt("towers", c, r, TOWER_W, TOWER_H);
        const mill = millAt(c, r);
        const unit = soldierAt(c, r);
        return {
            c: c,
            r: r,
            hall: hall,
            house: house,
            work: work,
            wall: wall,
            tower: tower,
            mill: mill,
            unit: unit,
            ownerId: hall ? hall.id
                : house ? house.faction.id
                : work ? work.faction.id
                : wall ? wall.faction.id
                : tower ? tower.faction.id
                : mill ? mill.faction.id
                : unit && unit.faction ? unit.faction.id
                : null
        };
    }

    function selectHit(hit) {
        if (hit.hall) selected = { kind: "building", factionId: hit.hall.id };
        else if (hit.house) selected = { kind: "house", id: hit.house.house.id, factionId: hit.house.faction.id };
        else if (hit.work) selected = { kind: "work", id: hit.work.work.id, factionId: hit.work.faction.id };
        else if (hit.wall) selected = { kind: "wall", id: hit.wall.piece.id, factionId: hit.wall.faction.id };
        else if (hit.tower) selected = { kind: "tower", id: hit.tower.piece.id, factionId: hit.tower.faction.id };
        else if (hit.mill) selected = { kind: "mill", id: hit.mill.mill.id, factionId: hit.mill.faction.id };
        else if (hit.unit) selected = { kind: "soldier", id: hit.unit.soldier.id };
        else selected = null;
        updateHud();
    }

    function actHit(hit) {
        const mine = selectedSoldier();
        const canOrder = mine && mine.faction && !sideCpu(mine.faction.id);
        const hall = hit.hall;
        const house = hit.house;
        const work = hit.work;
        const wall = hit.wall;
        const tower = hit.tower;
        const unit = hit.unit;
        const ownerId = hit.ownerId;
        const c = hit.c;
        const r = hit.r;
        if (playerMode && player && !player.dead && ownerId && sideCpu(ownerId) && !(canOrder && ownerId !== mine.faction.id)) {
            if (hall) {
                orderAttack(player, { kind: "building", factionId: hall.id });
                hostile[hall.id] = true;
            } else if (house) {
                orderAttack(player, { kind: "house", id: house.house.id });
                hostile[house.faction.id] = true;
            } else if (work) {
                orderAttack(player, { kind: "work", id: work.work.id });
                hostile[work.faction.id] = true;
            } else if (wall) {
                orderAttack(player, { kind: "wall", id: wall.piece.id });
                hostile[wall.faction.id] = true;
            } else if (tower) {
                orderAttack(player, { kind: "tower", id: tower.piece.id });
                hostile[tower.faction.id] = true;
            } else if (hit.mill) {
                orderAttack(player, { kind: "mill", id: hit.mill.mill.id });
                hostile[hit.mill.faction.id] = true;
            } else if (unit && unit.faction) {
                orderAttack(player, { kind: "soldier", id: unit.soldier.id });
                hostile[unit.faction.id] = true;
            }
            updateHud();
            return;
        }
        if (canOrder && hall && hall.id !== mine.faction.id) {
            orderAttack(mine.soldier, { kind: "building", factionId: hall.id });
            updateHud();
            return;
        }
        if (canOrder && house && house.faction.id !== mine.faction.id) {
            orderAttack(mine.soldier, { kind: "house", id: house.house.id });
            updateHud();
            return;
        }
        if (canOrder && work && work.faction.id !== mine.faction.id) {
            orderAttack(mine.soldier, { kind: "work", id: work.work.id });
            updateHud();
            return;
        }
        if (canOrder && wall && wall.faction.id !== mine.faction.id) {
            orderAttack(mine.soldier, { kind: "wall", id: wall.piece.id });
            updateHud();
            return;
        }
        if (canOrder && tower && tower.faction.id !== mine.faction.id) {
            orderAttack(mine.soldier, { kind: "tower", id: tower.piece.id });
            updateHud();
            return;
        }
        if (canOrder && hit.mill && hit.mill.faction.id !== mine.faction.id) {
            orderAttack(mine.soldier, { kind: "mill", id: hit.mill.mill.id });
            updateHud();
            return;
        }
        if (canOrder && unit && unit.soldier.id !== mine.soldier.id && unit.faction.id !== mine.faction.id) {
            orderAttack(mine.soldier, { kind: "soldier", id: unit.soldier.id });
            updateHud();
            return;
        }
        if (placing && !hall && !unit && !house && !work && !wall && !tower && !hit.mill) {
            const faction = factionById(placing.factionId);
            const ok = canPlaceKind(faction, placing.kind, c, r);
            if (ok) {
                if (placing.kind === "house") placeHouse(faction, c, r);
                else if (placing.kind === "mill") placeMill(faction, c, r);
                else if (placing.kind === "wall" || placing.kind === "tower") placeBlock(faction, placing.kind, c, r);
                else placeWork(faction, placing.kind, c, r);
                placeHint = "";
                if (placing.kind === "mill" ? !canAffordMill(faction) : faction.wood < HOUSE_COST) placing = null;
                updateHud();
                return;
            }
            placeHint = placing.kind === "house"
                ? "Those four squares need to be open and within 10 of the settlement."
                : placing.kind === "wall"
                    ? "That square is not open."
                    : placing.kind === "tower"
                        ? "Those six squares need to be open."
                        : "Those four squares need to be open.";
            updateHud();
            return;
        }
        if (canOrder && mine.soldier.role === "worker" && !hall && !unit && !house && !work && !wall && !tower && !hit.mill) {
            const groundKind = BattleMap.kind(ground, c, r);
            if (GATHER[groundKind]) {
                mine.soldier.order = {
                    kind: "gather",
                    c: c,
                    r: r,
                    source: groundKind,
                    phase: "go",
                    workLeft: 0,
                    dropId: null
                };
                mine.soldier.wasInRange = false;
                mine.soldier.attackWait = 0;
                mine.soldier.step = null;
                updateHud();
                return;
            }
        }
        if (canOrder && !hall && !unit && !house && !work && !wall && !tower && !hit.mill) {
            if (!occupied(c, r, mine.soldier)) orderMove(mine.soldier, c, r);
            updateHud();
        }
    }

    canvas.addEventListener("click", function (event) {
        if (event.button !== 0) return;
        if (battleView.swallowClick()) return;
        const hit = tileHit(event);
        if (!hit) return;
        selectHit(hit);
    });

    canvas.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        const hit = tileHit(event);
        if (!hit) return;
        actHit(hit);
    });

    function spendTrain(faction, role) {
        if (!canStartTrain(faction, role)) return false;
        if (role === "worker") {
            faction.food -= TRAIN_COST;
        } else if (role === "archer") {
            faction.gold -= TRAIN_COST;
            faction.wood -= TRAIN_COST;
        } else if (sideCpu(faction.id)) {
            faction.food -= TRAIN_COST;
            faction.iron -= TRAIN_COST;
            faction.wood -= TRAIN_COST;
        } else {
            faction.gold -= TRAIN_COST;
            faction.food -= TRAIN_COST;
        }
        faction.trainLeft = TRAIN_MS;
        faction.trainKind = role;
        return true;
    }

    function beginTrain(role) {
        if (!selected || selected.kind !== "building") return;
        const faction = factionById(selected.factionId);
        if (sideCpu(faction.id)) return;
        if (!spendTrain(faction, role)) return;
        updateHud();
    }

    trainBtn.addEventListener("click", function () { beginTrain("soldier"); });
    workerBtn.addEventListener("click", function () { beginTrain("worker"); });
    archerBtn.addEventListener("click", function () { beginTrain("archer"); });

    function beginPlace(kind) {
        if (!selected || selected.kind !== "building") return;
        const faction = factionById(selected.factionId);
        if (!faction || faction.building.dead || sideCpu(faction.id)) return;
        if (placing && placing.factionId === faction.id && placing.kind === kind) {
            placing = null;
            placeHint = "";
            updateHud();
            return;
        }
        if (kind === "mill" ? !canAffordMill(faction) : faction.wood < HOUSE_COST) return;
        placing = { factionId: faction.id, kind: kind };
        placeHint = "";
        updateHud();
    }

    houseBtn.addEventListener("click", function () { beginPlace("house"); });
    mineBtn.addEventListener("click", function () { beginPlace("mine"); });
    ironBtn.addEventListener("click", function () { beginPlace("iron"); });
    yardBtn.addEventListener("click", function () { beginPlace("yard"); });
    portBtn.addEventListener("click", function () { beginPlace("port"); });
    wallBtn.addEventListener("click", function () { beginPlace("wall"); });
    towerBtn.addEventListener("click", function () { beginPlace("tower"); });
    millBtn.addEventListener("click", function () { beginPlace("mill"); });

    function paintCpu() {
        cpuBtn.textContent = redCpu ? "Red: computer" : "Red: you";
        cpuBtn.classList.toggle("on", redCpu);
        cpuBtn.disabled = false;
        cpuBtn.setAttribute("aria-pressed", redCpu ? "true" : "false");
    }

    function paintPlayerBtn() {
        playerBtn.textContent = playerMode ? "Player: you" : "Player: off";
        playerBtn.classList.toggle("on", playerMode);
        playerBtn.classList.add("player");
        playerBtn.setAttribute("aria-pressed", playerMode ? "true" : "false");
        const pad = document.getElementById("pad");
        if (pad) pad.classList.toggle("on", playerMode);
    }

    const pad = document.getElementById("pad");
    if (pad) {
        pad.querySelectorAll("button").forEach(function (button) {
            const key = button.dataset.key;
            function press(event) {
                event.preventDefault();
                keys[key] = true;
            }
            function release() {
                keys[key] = false;
            }
            button.addEventListener("pointerdown", press);
            button.addEventListener("pointerup", release);
            button.addEventListener("pointercancel", release);
            button.addEventListener("pointerleave", release);
        });
    }

    cpuBtn.addEventListener("click", function () {
        redCpu = !redCpu;
        localStorage.setItem(CPU_KEY, redCpu ? "on" : "off");
        paintCpu();
        updateHud();
    });

    playerBtn.addEventListener("click", function () {
        playerMode = !playerMode;
        localStorage.setItem(PLAYER_KEY, playerMode ? "on" : "off");
        if (playerMode) {
            placePlayer(true);
        } else {
            player = null;
            playerDown = 0;
            hostile.blue = false;
            hostile.red = false;
            keys.w = false;
            keys.a = false;
            keys.s = false;
            keys.d = false;
            if (selected && selected.kind === "soldier" && selectedSoldier() && !selectedSoldier().faction) selected = null;
        }
        paintPlayerBtn();
        paintCpu();
        battleView.claimKeys(playerMode);
        updateHud();
    });
    paintPlayerBtn();
    paintCpu();
    battleView.claimKeys(playerMode);
    const resumed = loadBattle();
    if (playerMode && !player) placePlayer(true);
    if (!resumed) saveBattle();

    restartBtn.addEventListener("click", function () {
        if (!window.confirm("Restart the battle? Soldiers, buildings, and stock go back to the start. The map stays.")) return;
        resetBattle();
    });

    function chebyshev(c1, r1, c2, r2) {
        return Math.max(Math.abs(c1 - c2), Math.abs(r1 - r2));
    }

    function nearestPiece(list, soldier, maxDist) {
        let best = null;
        let dist = maxDist == null ? Infinity : maxDist + 1;
        (list || []).forEach(function (piece) {
            if (piece.dead || piece.hp <= 0) return;
            const d = chebyshev(soldier.c, soldier.r, piece.c, piece.r);
            if (d < dist) {
                dist = d;
                best = piece;
            }
        });
        return best;
    }

    function reaches(soldier, order) {
        const prev = soldier.order;
        soldier.order = order;
        const target = resolveOrder(soldier);
        soldier.order = prev;
        if (!target) return false;
        return inRange(soldier, target) || !!nextStep(soldier, target);
    }

    function notePlayerDown(unit) {
        if (!player || unit !== player || player.hp > 0) return;
        player.dead = true;
        player.order = null;
        player.step = null;
        if (playerDown <= 0) playerDown = 5000;
    }

    function playerStart() {
        const blue = factionById("blue");
        const hall = blue.building;
        const c = hall.c + Math.floor(HALL_W / 2);
        const r = hall.r + HALL_H + 2;
        const spots = [[c, r], [c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]];
        for (let i = 0; i < spots.length; i++) {
            if (!occupied(spots[i][0], spots[i][1], player)) return spots[i];
        }
        return [c, r];
    }

    function placePlayer(resetPeace) {
        const spot = playerStart();
        if (!player) {
            player = {
                id: nextId++,
                role: "player",
                damage: SOLDIER_DAMAGE,
                c: spot[0],
                r: spot[1],
                hp: SOLDIER_HP,
                maxHp: SOLDIER_HP,
                order: null,
                step: null,
                wasInRange: false,
                attackWait: 0,
                flash: 0,
                hurt: 0,
                dead: false,
                facingLeft: false
            };
        } else {
            player.c = spot[0];
            player.r = spot[1];
            player.hp = SOLDIER_HP;
            player.dead = false;
            player.order = null;
            player.step = null;
            player.wasInRange = false;
            player.attackWait = 0;
            player.flash = 0;
            player.hurt = 0;
        }
        playerDown = 0;
        if (resetPeace) {
            hostile.blue = false;
            hostile.red = false;
        }
        selected = { kind: "soldier", id: player.id };
    }

    function walkDir() {
        let dc = 0;
        let dr = 0;
        if (keys.a) dc -= 1;
        if (keys.d) dc += 1;
        if (keys.w) dr -= 1;
        if (keys.s) dr += 1;
        if (!dc && !dr) return null;
        return { dc: dc, dr: dr };
    }

    function startPlayerStep(dc, dr) {
        if (dc && dr) {
            if (occupied(player.c + dc, player.r, player)) return;
            if (occupied(player.c, player.r + dr, player)) return;
        }
        const nc = player.c + dc;
        const nr = player.r + dr;
        if (occupied(nc, nr, player)) return;
        player.step = {
            fromC: player.c,
            fromR: player.r,
            toC: nc,
            toR: nr,
            t: 0
        };
        player.order = null;
        player.wasInRange = false;
        if (dc < 0) player.facingLeft = true;
        else if (dc > 0) player.facingLeft = false;
    }

    function tickPlayer(dt, strikeList) {
        if (!playerMode || !player) return;
        if (player.dead) {
            playerDown -= dt;
            if (playerDown <= 0) placePlayer(false);
            return;
        }
        if (player.hurt > 0) player.hurt -= dt;
        if (player.flash > 0) player.flash -= dt;
        const dir = walkDir();
        if (dir) {
            player.order = null;
            player.wasInRange = false;
            if (!player.step) startPlayerStep(dir.dc, dir.dr);
        }
        const target = tickSoldier(player, dt);
        if (target) strikeList.push({ attacker: player, target: target });
    }

    const CPU_JOBS = [
        { source: "forest", work: "yard" },
        { source: "iron", work: "iron" },
        { source: "water", work: "port" }
    ];
    const CPU_HAUL = 12;

    function tilesOf(kind) {
        const list = [];
        Object.keys(ground).forEach(function (key) {
            if (ground[key] !== kind) return;
            const parts = key.split(",");
            const c = Number(parts[0]);
            const r = Number(parts[1]);
            if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
            list.push({ c: c, r: r });
        });
        return list;
    }

    function coversMuster(faction, c, r) {
        for (let x = 0; x < 2; x++) {
            for (let y = 0; y < 2; y++) {
                if (musterTile(faction, c + x, r + y)) return true;
            }
        }
        return false;
    }

    function spotBeside(faction, tile) {
        let best = null;
        let bestDist = Infinity;
        for (let dc = -2; dc <= 1; dc++) {
            for (let dr = -2; dr <= 1; dr++) {
                const c = tile.c + dc;
                const r = tile.r + dr;
                if (coversMuster(faction, c, r)) continue;
                if (!canPlaceWork(faction, c, r)) continue;
                let touches = false;
                for (let x = 0; x < 2; x++) {
                    for (let y = 0; y < 2; y++) {
                        if (Math.max(Math.abs(c + x - tile.c), Math.abs(r + y - tile.r)) === 1) touches = true;
                    }
                }
                if (!touches) continue;
                const dist = distToHall(faction, c, r);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = [c, r];
                }
            }
        }
        return best;
    }

    function placeCpuWork(faction, job) {
        const already = faction.works.some(function (work) {
            return !work.dead && work.hp > 0 && work.kind === job.work;
        });
        if (already || faction.wood < HOUSE_COST) return false;
        const tiles = tilesOf(job.source).filter(function (tile) {
            return distToHall(faction, tile.c, tile.r) >= CPU_HAUL;
        });
        tiles.sort(function (a, b) {
            return distToHall(faction, a.c, a.r) - distToHall(faction, b.c, b.r);
        });
        for (let i = 0; i < tiles.length && i < 40; i++) {
            const spot = spotBeside(faction, tiles[i]);
            if (spot && placeWork(faction, job.work, spot[0], spot[1])) return true;
        }
        return false;
    }

    function placeCpuHouse(faction) {
        if (faction.wood < HOUSE_COST) return false;
        const hall = faction.building;
        for (let dist = 2; dist <= HOUSE_RANGE; dist++) {
            for (let dc = -dist; dc <= dist + 1; dc++) {
                for (let dr = -dist; dr <= dist + 1; dr++) {
                    const c = hall.c + dc;
                    const r = hall.r + dr;
                    if (distToHall(faction, c, r) !== dist) continue;
                    if (musterTile(faction, c, r)) continue;
                    if (placeHouse(faction, c, r)) return true;
                }
            }
        }
        return false;
    }

    function wantedWorkers(faction) {
        let count = 0;
        CPU_JOBS.forEach(function (job) {
            if (tilesOf(job.source).length) count += 1;
        });
        return count;
    }

    function planEconomy(faction) {
        if (!popRoom(faction)) {
            placeCpuHouse(faction);
            return;
        }
        for (let i = 0; i < CPU_JOBS.length; i++) {
            if (placeCpuWork(faction, CPU_JOBS[i])) return;
        }
        const workers = faction.soldiers.filter(function (soldier) {
            return !soldier.dead && soldier.hp > 0 && soldier.role === "worker";
        }).length;
        if (workers < wantedWorkers(faction)) {
            spendTrain(faction, "worker");
            return;
        }
        spendTrain(faction, "soldier");
    }

    function assignWorkers(faction) {
        const workers = faction.soldiers.filter(function (soldier) {
            return !soldier.dead && soldier.hp > 0 && soldier.role === "worker";
        });
        const taken = {};
        workers.forEach(function (worker) {
            if (worker.order && worker.order.kind === "gather") taken[worker.order.c + "," + worker.order.r] = worker.order.source;
        });
        const idle = workers.filter(function (worker) {
            return !(worker.order && worker.order.kind === "gather");
        });
        const queues = CPU_JOBS.map(function (job) {
            const site = faction.works.find(function (work) {
                return !work.dead && work.hp > 0 && work.kind === job.work;
            });
            const tiles = tilesOf(job.source).filter(function (tile) {
                return !taken[tile.c + "," + tile.r];
            });
            tiles.sort(function (a, b) {
                const distA = site
                    ? Math.max(Math.abs(a.c - site.c), Math.abs(a.r - site.r))
                    : distToHall(faction, a.c, a.r);
                const distB = site
                    ? Math.max(Math.abs(b.c - site.c), Math.abs(b.r - site.r))
                    : distToHall(faction, b.c, b.r);
                return distA - distB;
            });
            return { job: job, tiles: tiles };
        }).filter(function (queue) { return queue.tiles.length; });
        idle.forEach(function (worker) {
            let best = null;
            let bestCount = Infinity;
            let bestDist = Infinity;
            queues.forEach(function (queue) {
                if (!queue.tiles.length) return;
                let count = 0;
                Object.keys(taken).forEach(function (key) {
                    if (taken[key] === queue.job.source) count += 1;
                });
                const tile = queue.tiles[0];
                const dist = Math.max(Math.abs(worker.c - tile.c), Math.abs(worker.r - tile.r));
                if (count < bestCount || (count === bestCount && dist < bestDist)) {
                    best = queue;
                    bestCount = count;
                    bestDist = dist;
                }
            });
            if (!best) return;
            const tile = best.tiles.shift();
            taken[tile.c + "," + tile.r] = best.job.source;
            worker.order = {
                kind: "gather",
                c: tile.c,
                r: tile.r,
                source: best.job.source,
                phase: "go",
                workLeft: 0,
                dropId: null
            };
            worker.wasInRange = false;
            worker.attackWait = 0;
            worker.step = null;
        });
    }

    function tickSideCpu(self) {
        const enemy = otherFaction(self);
        if (!self || self.building.dead) return;
        planEconomy(self);
        assignWorkers(self);
        const foes = enemy.soldiers.filter(function (soldier) { return !soldier.dead && soldier.hp > 0; });
        if (player && !player.dead && hostile[self.id]) foes.push(player);
        self.soldiers.forEach(function (soldier) {
            if (soldier.dead || soldier.hp <= 0 || soldier.role === "worker") return;
            const current = resolveOrder(soldier);
            if (current && (current.kind === "soldier" || current.kind === "building" || current.kind === "wall" || current.kind === "tower") && engaged(soldier, current)) return;

            let foe = null;
            let foeDist = 7;
            foes.forEach(function (other) {
                const dist = chebyshev(soldier.c, soldier.r, other.c, other.r);
                if (dist < foeDist) {
                    foe = other;
                    foeDist = dist;
                }
            });
            if (foe) {
                if (soldier.order && soldier.order.kind === "soldier" && soldier.order.id === foe.id) return;
                orderAttack(soldier, { kind: "soldier", id: foe.id });
                return;
            }
            const closeTower = nearestPiece(enemy.towers, soldier, 6);
            if (closeTower) {
                if (soldier.order && soldier.order.kind === "tower" && soldier.order.id === closeTower.id) return;
                orderAttack(soldier, { kind: "tower", id: closeTower.id });
                return;
            }
            if (!enemy.building.dead && enemy.building.hp > 0) {
                const barracksOrder = { kind: "building", factionId: enemy.id };
                if (reaches(soldier, barracksOrder)) {
                    if (soldier.order && soldier.order.kind === "building" && soldier.order.factionId === enemy.id) return;
                    orderAttack(soldier, barracksOrder);
                    return;
                }
            }
            const wall = nearestPiece(enemy.walls, soldier);
            if (wall) {
                if (soldier.order && soldier.order.kind === "wall" && soldier.order.id === wall.id) return;
                orderAttack(soldier, { kind: "wall", id: wall.id });
                return;
            }
            const tower = nearestPiece(enemy.towers, soldier);
            if (tower) {
                if (soldier.order && soldier.order.kind === "tower" && soldier.order.id === tower.id) return;
                orderAttack(soldier, { kind: "tower", id: tower.id });
            }
        });
    }

    function tickRedCpu() {
        if (sideCpu("red")) tickSideCpu(factionById("red"));
        if (sideCpu("blue")) tickSideCpu(factionById("blue"));
    }

    window.addEventListener("keydown", function (event) {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        const key = event.key.toLowerCase();
        if (playerMode && (key === "w" || key === "a" || key === "s" || key === "d")) {
            event.preventDefault();
            keys[key] = true;
            return;
        }
        if (key !== "t") return;
        if (trainBtn.disabled) return;
        event.preventDefault();
        trainBtn.click();
    });

    window.addEventListener("keyup", function (event) {
        keys[event.key.toLowerCase()] = false;
    });

    window.addEventListener("blur", function () {
        keys.w = false;
        keys.a = false;
        keys.s = false;
        keys.d = false;
    });

    function blit(rows, ox, oy, scale, colors, flip) {
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const ch = rows[r][c];
                if (!colors[ch]) continue;
                const dc = flip ? (rows[r].length - 1 - c) : c;
                ctx.fillStyle = colors[ch];
                ctx.fillRect(ox + dc * scale, oy + r * scale, scale, scale);
            }
        }
    }

    function faceLeft(soldier, faction) {
        const target = resolveOrder(soldier);
        if (!target) {
            if (soldier.role === "player") return !!soldier.facingLeft;
            return faction.id === "red";
        }
        if (target.kind === "gather" || target.kind === "move") return target.c < soldier.c;
        let c = 0;
        target.tiles.forEach(function (tile) { c += tile.c; });
        c /= target.tiles.length;
        return c < soldier.c;
    }

    let frameView = null;
    let frameDetail = "near";

    function seen(x, y, w, h) {
        if (!frameView) return true;
        const x0 = frameView.c0 * TILE;
        const y0 = frameView.r0 * TILE;
        const x1 = (frameView.c1 + 1) * TILE;
        const y1 = (frameView.r1 + 1) * TILE;
        return x + w >= x0 && x <= x1 && y + h >= y0 && y <= y1;
    }

    function drawBar(x, y, w, h, hp, max) {
        ctx.fillStyle = INK;
        ctx.fillRect(x, y, w, h);
        const ratio = Math.max(0, Math.min(1, hp / max));
        ctx.fillStyle = ratio > 0.6 ? "#3cba4a" : ratio > 0.3 ? "#e0c040" : "#e05040";
        ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * ratio), h - 4);
    }

    function drawHall(faction) {
        const b = faction.building;
        const x = b.c * TILE;
        const y = b.r * TILE;
        const w = HALL_W * TILE;
        const h = HALL_H * TILE;
        if (!seen(x, y - TILE, w, h + TILE)) return;
        if (frameDetail === "far") {
            ctx.fillStyle = b.dead ? "#6a5844" : faction.color;
            ctx.fillRect(x, y, w, h);
            return;
        }

        if (b.dead) {
            ctx.fillStyle = "#6a5844";
            ctx.fillRect(x + 18, y + 78, 36, 16);
            ctx.fillRect(x + 58, y + 70, 44, 20);
            ctx.fillRect(x + 40, y + 52, 24, 14);
            ctx.fillStyle = "#3a3228";
            ctx.fillRect(x + 24, y + 84, 22, 8);
            ctx.fillRect(x + 70, y + 78, 20, 8);
            ctx.fillStyle = INK;
            ctx.font = "700 16px Segoe UI, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Down", x + w / 2, y - 8);
            return;
        }

        const pictured = window.BattleArt && BattleArt.drawHall(ctx, x, y, w, h);
        if (pictured) {
            ctx.fillStyle = faction.color;
            ctx.fillRect(x + w / 2 - 10, y + Math.round(w * 0.18), 20, 16);
        }

        if (!pictured) {
        ctx.fillStyle = "rgba(20, 36, 12, 0.28)";
        ctx.fillRect(x + 14, y + TILE * 2 - 10, w - 20, 12);

        ctx.fillStyle = INK;
        ctx.fillRect(x + 8, y + 40, w - 16, TILE * 2 - 52);
        ctx.fillStyle = b.hurt > 0 ? "#fff6ea" : "#efe6cf";
        ctx.fillRect(x + 14, y + 46, w - 28, TILE * 2 - 64);

        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 52);
        ctx.lineTo(x + w / 2, y + 6);
        ctx.lineTo(x + w - 2, y + 52);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = faction.color;
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 50);
        ctx.lineTo(x + w / 2, y + 16);
        ctx.lineTo(x + w - 12, y + 50);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = faction.dark;
        ctx.fillRect(x + w / 2 - 14, y + 78, 28, 36);
        ctx.fillStyle = "#f0d080";
        ctx.fillRect(x + w / 2 + 4, y + 94, 6, 6);

        ctx.fillStyle = "#9ad7ea";
        ctx.fillRect(x + 26, y + 66, 18, 16);
        ctx.fillRect(x + w - 44, y + 66, 18, 16);
        ctx.fillStyle = INK;
        ctx.fillRect(x + 34, y + 66, 2, 16);
        ctx.fillRect(x + 26, y + 73, 18, 2);
        ctx.fillRect(x + w - 36, y + 66, 2, 16);
        ctx.fillRect(x + w - 44, y + 73, 18, 2);
        }

        ctx.font = "700 13px Segoe UI, system-ui, sans-serif";
        ctx.textAlign = "center";
        const purse = faction.gold + " gold   " + faction.food + " food   " + faction.wood + " wood   " + faction.stone + " stone   " + faction.iron + " iron";
        const purseWidth = ctx.measureText(purse).width;
        ctx.fillStyle = "rgba(244, 240, 216, 0.9)";
        ctx.fillRect(x + w / 2 - purseWidth / 2 - 5, y - 52, purseWidth + 10, 16);
        ctx.fillStyle = INK;
        ctx.fillText(purse, x + w / 2, y - 40);

        ctx.font = "700 16px Segoe UI, system-ui, sans-serif";
        ctx.fillText(faction.name, x + w / 2, y - 22);
        drawBar(x + (w - 76) / 2, y - 16, 76, 8, b.hp, b.maxHp);
        if (faction.trainLeft > 0) {
            const ratio = 1 - faction.trainLeft / TRAIN_MS;
            ctx.fillStyle = INK;
            ctx.fillRect(x + (w - 76) / 2, y - 6, 76, 5);
            ctx.fillStyle = "#e8c84a";
            ctx.fillRect(x + (w - 76) / 2 + 1, y - 5, Math.max(0, 74 * ratio), 3);
        }
    }

    function drawHouse(faction, house) {
        const x = house.c * TILE;
        const y = house.r * TILE;
        const w = HOUSE_W * TILE;
        const h = HOUSE_H * TILE;
        if (!seen(x, y, w, h)) return;
        if (frameDetail === "far" || !window.BattleArt || !BattleArt.drawHouse(ctx, x, y, w, h)) {
            ctx.fillStyle = faction.color;
            ctx.fillRect(x, y, w, h);
            if (frameDetail === "far") return;
        }
        drawBar(x + 8, y + 2, w - 16, 6, house.hp, house.maxHp);
    }

    function drawWall(faction, wall) {
        const x = wall.c * TILE;
        const y = wall.r * TILE;
        if (!seen(x, y, TILE, TILE)) return;
        if (frameDetail !== "near") {
            ctx.fillStyle = faction.color;
            ctx.fillRect(x, y, TILE, TILE);
            return;
        }
        ctx.fillStyle = wall.hurt > 0 ? "#d8d2c4" : "#6e685c";
        ctx.fillRect(x + 4, y + 14, 52, 40);
        ctx.fillStyle = faction.color;
        ctx.fillRect(x + 4, y + 14, 52, 8);
        ctx.fillStyle = "#8d8778";
        ctx.fillRect(x + 8, y + 26, 18, 14);
        ctx.fillRect(x + 32, y + 26, 18, 14);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, y + 14, 52, 40);
        drawBar(x + 8, y + 4, 44, 6, wall.hp, wall.maxHp);
    }

    function drawTower(faction, tower) {
        const x = tower.c * TILE;
        const y = tower.r * TILE;
        const w = TOWER_W * TILE;
        const h = TOWER_H * TILE;
        if (!seen(x, y, w, h)) return;
        if (frameDetail === "far" || !window.BattleArt || !BattleArt.drawTower(ctx, x, y, w, h)) {
            ctx.fillStyle = faction.color;
            ctx.fillRect(x, y, w, h);
            if (frameDetail === "far") return;
        }
        drawBar(x + 8, y + 2, w - 16, 6, tower.hp, tower.maxHp);
    }

    function drawWindmill(faction, mill, time) {
        const x = mill.c * TILE;
        const y = mill.r * TILE;
        const w = MILL_W * TILE;
        const h = MILL_H * TILE;
        if (!seen(x, y, w, h)) return;
        if (frameDetail === "far" || !window.BattleArt || !BattleArt.drawMill(ctx, x, y, w, h, time)) {
            ctx.fillStyle = faction.color;
            ctx.fillRect(x, y, w, h);
            if (frameDetail === "far") return;
        }
        drawBar(x + 8, y + 2, w - 16, 6, mill.hp, mill.maxHp);
    }

    function drawWork(faction, work) {
        const x = work.c * TILE;
        const y = work.r * TILE;
        const w = TILE * 2;
        if (!seen(x, y, w, w)) return;
        if (frameDetail !== "near") {
            ctx.fillStyle = faction.color;
            ctx.fillRect(x, y, w, w);
            if (frameDetail === "mid") drawBar(x + 10, y + 6, w - 20, 7, work.hp, work.maxHp);
            return;
        }
        ctx.fillStyle = "rgba(20, 36, 12, 0.28)";
        ctx.fillRect(x + 16, y + 100, w - 28, 12);
        if (work.kind === "port") {
            ctx.fillStyle = "#2a6eae";
            ctx.fillRect(x + 8, y + 70, w - 16, 40);
            ctx.fillStyle = "#c6a15a";
            ctx.fillRect(x + 14, y + 48, w - 28, 18);
            ctx.fillRect(x + 20, y + 78, 10, 28);
            ctx.fillRect(x + w - 30, y + 78, 10, 28);
            ctx.fillStyle = "#d8d2c4";
            ctx.fillRect(x + 48, y + 36, 28, 16);
        } else if (work.kind === "yard") {
            ctx.fillStyle = "#6a4428";
            ctx.fillRect(x + 16, y + 58, 36, 48);
            ctx.fillRect(x + 58, y + 68, 42, 38);
            ctx.fillStyle = "#c6a15a";
            ctx.fillRect(x + 20, y + 64, 28, 6);
            ctx.fillRect(x + 20, y + 76, 28, 6);
            ctx.fillRect(x + 64, y + 74, 30, 6);
            ctx.fillRect(x + 64, y + 86, 30, 6);
        } else if (work.kind === "iron") {
            ctx.fillStyle = "#4e4542";
            ctx.fillRect(x + 18, y + 50, w - 36, 58);
            ctx.fillStyle = "#2a2422";
            ctx.fillRect(x + 46, y + 72, 28, 36);
            ctx.fillStyle = "#c45a32";
            ctx.fillRect(x + 28, y + 64, 8, 6);
            ctx.fillRect(x + 78, y + 66, 8, 6);
        } else {
            ctx.fillStyle = "#8d939a";
            ctx.fillRect(x + 18, y + 50, w - 36, 58);
            ctx.fillStyle = "#4e4542";
            ctx.fillRect(x + 46, y + 72, 28, 36);
            ctx.fillStyle = "#e6c14a";
            ctx.fillRect(x + 28, y + 64, 8, 6);
            ctx.fillStyle = "#c45a32";
            ctx.fillRect(x + 78, y + 66, 8, 6);
        }
        ctx.fillStyle = faction.color;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 58);
        ctx.lineTo(x + w / 2, y + 16);
        ctx.lineTo(x + w - 10, y + 58);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.font = "700 14px Segoe UI, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(WORK_NAMES[work.kind], x + w / 2, y + 12);
        drawBar(x + (w - 76) / 2, y + 2, 76, 7, work.hp, work.maxHp);
        const held = storedPhrase(work);
        if (held !== "nothing yet") {
            ctx.font = "700 13px Segoe UI, system-ui, sans-serif";
            ctx.fillStyle = "#f4f0d8";
            ctx.fillText(held, x + w / 2, y + w - 6);
        }
        if (work.hurt > 0) {
            ctx.fillStyle = "rgba(220, 40, 40, 0.28)";
            ctx.fillRect(x + 16, y + 40, w - 32, 60);
        }
    }

    function drawSoldier(faction, soldier, time) {
        const p = drawPos(soldier);
        if (!seen(p.c * TILE, p.r * TILE, TILE, TILE)) return;
        if (frameDetail !== "near") {
            const color = soldier.role === "worker" ? "#c4a15a"
                : soldier.role === "archer" ? "#3d6b3a"
                : faction.color;
            const inset = frameDetail === "far" ? 12 : 18;
            ctx.fillStyle = color;
            ctx.fillRect(p.c * TILE + inset, p.r * TILE + inset, TILE - inset * 2, TILE - inset * 2);
            if (frameDetail === "mid" && soldier.hurt > 0) {
                drawBar(p.c * TILE + 8, p.r * TILE + 1, 44, 7, soldier.hp, soldier.maxHp);
            }
            return;
        }
        const left = faceLeft(soldier, faction);
        if (window.BattleArt && BattleArt.drawPerson(ctx, soldier, faction, p, left, time)) {
            if (soldier.hurt > 0) {
                ctx.fillStyle = "rgba(220, 40, 40, 0.35)";
                ctx.fillRect(p.c * TILE + 12, p.r * TILE + 8, 36, 40);
            }
            drawBar(p.c * TILE + 8, p.r * TILE + 1, 44, 7, soldier.hp, soldier.maxHp);
            if (soldier.order && soldier.order.kind === "gather" && soldier.order.phase === "work") {
                drawBar(p.c * TILE + 8, p.r * TILE + 54, 44, 4, soldier.order.workLeft, GATHER_MS);
            }
            return;
        }
        const bob = Math.floor(time / 420 + soldier.c + soldier.r) % 2 === 0 ? 0 : 2;
        const lunge = soldier.flash > 0 ? (left ? -5 : 5) : 0;
        const ox = p.c * TILE + 6 + lunge;
        const oy = p.r * TILE + 8 - bob;

        ctx.fillStyle = "rgba(20, 36, 12, 0.28)";
        ctx.beginPath();
        ctx.ellipse(p.c * TILE + 30, p.r * TILE + 52, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        const worker = soldier.role === "worker";
        const archer = soldier.role === "archer";
        blit(SOLDIER, ox, oy, 3, worker ? {
            c: "#4a3428",
            k: INK,
            s: "#f0c8a0",
            f: "#c4a15a",
            b: "#6a4428",
            d: "#3a3428"
        } : archer ? {
            c: "#3d6b3a",
            k: INK,
            s: "#f0c8a0",
            f: "#6a8f4a",
            b: "#c4a15a",
            d: "#3a3428"
        } : {
            c: faction.dark,
            k: INK,
            s: "#f0c8a0",
            f: faction.color,
            b: "#e8c84a",
            d: "#3a3428"
        }, left);

        if (worker) {
            ctx.fillStyle = "#6a4428";
            ctx.fillRect(left ? ox - 1 : ox + 46, oy + 12, 3, 18);
            ctx.fillStyle = "#9aa0a4";
            ctx.fillRect(left ? ox - 5 : ox + 42, oy + 8, 11, 6);
        } else if (archer) {
            ctx.strokeStyle = "#c4a15a";
            ctx.lineWidth = 2;
            ctx.beginPath();
            const bowX = left ? ox - 2 : ox + 48;
            ctx.arc(bowX, oy + 22, 10, left ? Math.PI * 0.5 : -Math.PI * 0.5, left ? Math.PI * 1.5 : Math.PI * 0.5);
            ctx.stroke();
        } else {
            ctx.fillStyle = "#d8d2c4";
            ctx.fillRect(left ? ox - 1 : ox + 46, oy + 4, 3, 28);
            ctx.fillStyle = faction.dark;
            ctx.fillRect(left ? ox - 3 : ox + 44, oy + 2, 7, 4);
        }

        if (soldier.hurt > 0) {
            ctx.fillStyle = "rgba(220, 40, 40, 0.35)";
            ctx.fillRect(ox + 12, oy + 2, 24, 36);
        }

        drawBar(p.c * TILE + 8, p.r * TILE + 1, 44, 7, soldier.hp, soldier.maxHp);
        if (soldier.order && soldier.order.kind === "gather" && soldier.order.phase === "work") {
            drawBar(p.c * TILE + 8, p.r * TILE + 54, 44, 4, soldier.order.workLeft, GATHER_MS);
        }
    }

    function drawCart(faction, cart) {
        const p = drawPos(cart);
        const x = p.c * TILE;
        const y = p.r * TILE;
        if (!seen(x, y, TILE, TILE)) return;
        if (frameDetail !== "near") {
            ctx.fillStyle = "#6a4428";
            ctx.fillRect(x + 16, y + 22, 28, 18);
            ctx.fillStyle = faction.color;
            ctx.fillRect(x + 20, y + 26, 20, 10);
            return;
        }
        const left = cart.step ? cart.step.toC < cart.c : faction.id === "red";
        ctx.fillStyle = "rgba(20, 36, 12, 0.28)";
        ctx.fillRect(x + 12, y + 46, 36, 6);
        ctx.fillStyle = "#6a4428";
        ctx.fillRect(left ? x + 8 : x + 36, y + 26, 16, 12);
        ctx.fillRect(left ? x + 6 : x + 46, y + 22, 8, 8);
        ctx.fillStyle = "#2a2418";
        ctx.fillRect(left ? x + 10 : x + 38, y + 36, 4, 8);
        ctx.fillRect(left ? x + 18 : x + 46, y + 36, 4, 8);
        ctx.fillStyle = faction.color;
        ctx.fillRect(left ? x + 28 : x + 10, y + 24, 22, 14);
        ctx.fillStyle = INK;
        ctx.fillRect(left ? x + 30 : x + 14, y + 36, 6, 6);
        ctx.fillRect(left ? x + 42 : x + 24, y + 36, 6, 6);
        ctx.font = "700 12px Segoe UI, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#f4f0d8";
        ctx.fillText(cart.amount + " " + cart.key, x + 30, y + 14);
    }

    function drawBrackets(x, y, w, h, color) {
        const arm = 14;
        ctx.strokeStyle = color || "#f4f0d8";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, y + arm);
        ctx.lineTo(x, y);
        ctx.lineTo(x + arm, y);
        ctx.moveTo(x + w - arm, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + arm);
        ctx.moveTo(x, y + h - arm);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + arm, y + h);
        ctx.moveTo(x + w - arm, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w, y + h - arm);
        ctx.stroke();
    }

    function draw(time) {
        const view = battleView.beginFrame(ctx);
        frameView = view;
        const tilePx = (view.zoom || 1) * TILE;
        frameDetail = tilePx >= 20 ? "near" : tilePx >= 8 ? "mid" : "far";
        ground = BattleMap.load();
        BattleMap.drawGround(ctx, ground, view);

        const active = selected && selected.kind === "building" ? factionById(selected.factionId) : null;
        if (frameDetail === "near" && active && !active.building.dead) {
            active.muster.forEach(function (spot) {
                const taken = occupied(spot[0], spot[1], null);
                ctx.fillStyle = taken ? "rgba(244, 240, 216, 0.12)" : "rgba(244, 240, 216, 0.38)";
                ctx.fillRect(spot[0] * TILE + 6, spot[1] * TILE + 6, TILE - 12, TILE - 12);
            });
        }

        if (frameDetail === "near") {
            ctx.strokeStyle = "rgba(26, 36, 16, 0.28)";
            ctx.lineWidth = 1;
            for (let c = view.c0; c <= view.c1; c++) {
                ctx.beginPath();
                ctx.moveTo(c * TILE + 0.5, view.r0 * TILE);
                ctx.lineTo(c * TILE + 0.5, (view.r1 + 1) * TILE);
                ctx.stroke();
            }
            for (let r = view.r0; r <= view.r1; r++) {
                ctx.beginPath();
                ctx.moveTo(view.c0 * TILE, r * TILE + 0.5);
                ctx.lineTo((view.c1 + 1) * TILE, r * TILE + 0.5);
                ctx.stroke();
            }
        }

        factions.forEach(function (faction) {
            drawHall(faction);
            faction.houses.forEach(function (house) {
                drawHouse(faction, house);
            });
            faction.walls.forEach(function (wall) {
                drawWall(faction, wall);
            });
            faction.towers.forEach(function (tower) {
                drawTower(faction, tower);
            });
            faction.windmills.forEach(function (mill) {
                drawWindmill(faction, mill, time);
            });
            faction.works.forEach(function (work) {
                drawWork(faction, work);
            });
        });
        factions.forEach(function (faction) {
            faction.soldiers.forEach(function (soldier) {
                drawSoldier(faction, soldier, time);
            });
            faction.carts.forEach(function (cart) {
                drawCart(faction, cart);
            });
        });
        if (playerMode && player && !player.dead) drawSoldier(PLAYER_LOOK, player, time);

        slashes.forEach(function (slash) {
            if (!seen(Math.min(slash.x1, slash.x2), Math.min(slash.y1, slash.y2), Math.abs(slash.x2 - slash.x1), Math.abs(slash.y2 - slash.y1))) return;
            ctx.strokeStyle = "rgba(255, 244, 210, " + Math.max(0, slash.life / 140) + ")";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(slash.x1, slash.y1);
            ctx.lineTo(slash.x2, slash.y2);
            ctx.stroke();
        });

        arrows.forEach(function (arrow) {
            if (!seen(Math.min(arrow.x1, arrow.x2), Math.min(arrow.y1, arrow.y2), Math.abs(arrow.x2 - arrow.x1), Math.abs(arrow.y2 - arrow.y1))) return;
            const alpha = Math.max(0, arrow.life / 280);
            ctx.strokeStyle = "rgba(244, 236, 210, " + alpha + ")";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(arrow.x1, arrow.y1);
            ctx.lineTo(arrow.x2, arrow.y2);
            ctx.stroke();
            ctx.fillStyle = "rgba(232, 200, 74, " + alpha + ")";
            ctx.beginPath();
            ctx.arc(arrow.x2, arrow.y2, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.font = "700 16px Segoe UI, system-ui, sans-serif";
        ctx.textAlign = "center";
        floaters.forEach(function (floater) {
            if (!seen(floater.x - 40, floater.y - 40, 80, 80)) return;
            const rise = (1 - floater.life / 700) * 22;
            ctx.fillStyle = floater.text === "Down" ? "#f4f0d8" : "#fff";
            ctx.fillText(floater.text, floater.x, floater.y - 20 - rise);
        });

        if (placing && frameDetail === "near") {
            const faction = factionById(placing.factionId);
            const allowed = function (c, r) { return canPlaceKind(faction, placing.kind, c, r); };
            if (faction) {
                ctx.fillStyle = faction.id === "red" ? "rgba(196, 60, 60, 0.28)" : "rgba(60, 94, 200, 0.28)";
                for (let c = view.c0; c <= view.c1; c++) {
                    for (let r = view.r0; r <= view.r1; r++) {
                        if (!allowed(c, r)) continue;
                        ctx.fillRect(c * TILE + 4, r * TILE + 4, TILE - 8, TILE - 8);
                    }
                }
            }
        }

        if (selected && selected.kind === "building") {
            const faction = factionById(selected.factionId);
            if (faction && !faction.building.dead) {
                drawBrackets(
                    faction.building.c * TILE + 2,
                    faction.building.r * TILE + 2,
                    HALL_W * TILE - 4,
                    HALL_H * TILE - 4
                );
                if (frameDetail !== "far") {
                    ctx.fillStyle = "rgba(232, 200, 74, 0.16)";
                    const hall = faction.building;
                    for (let c = hall.c - TOWER_RANGE; c <= hall.c + HALL_W - 1 + TOWER_RANGE; c++) {
                        for (let r = hall.r - TOWER_RANGE; r <= hall.r + HALL_H - 1 + TOWER_RANGE; r++) {
                            if (c < view.c0 || r < view.r0 || c > view.c1 || r > view.r1) continue;
                            if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
                            const dist = distToBox(hall.c, hall.r, HALL_W, HALL_H, c, r);
                            if (dist === 0 || dist > TOWER_RANGE) continue;
                            ctx.fillRect(c * TILE + 8, r * TILE + 8, TILE - 16, TILE - 16);
                        }
                    }
                }
            }
        }

        if (selected && selected.kind === "house") {
            const found = findHouse(selected.id);
            if (found) {
                drawBrackets(
                    found.house.c * TILE + 4,
                    found.house.r * TILE + 4,
                    HOUSE_W * TILE - 8,
                    HOUSE_H * TILE - 8
                );
            }
        }

        if (selected && selected.kind === "work") {
            const found = findWork(selected.id);
            if (found) {
                drawBrackets(
                    found.work.c * TILE + 2,
                    found.work.r * TILE + 2,
                    TILE * 2 - 4,
                    TILE * 2 - 4
                );
            }
        }

        if (selected && selected.kind === "mill") {
            const found = findMill(selected.id);
            if (found) {
                drawBrackets(
                    found.mill.c * TILE + 4,
                    found.mill.r * TILE + 4,
                    MILL_W * TILE - 8,
                    MILL_H * TILE - 8
                );
            }
        }

        if (selected && (selected.kind === "wall" || selected.kind === "tower")) {
            const found = findPiece(selected.kind === "wall" ? "walls" : "towers", selected.id);
            if (found) {
                const tw = selected.kind === "tower" ? TOWER_W : 1;
                const th = selected.kind === "tower" ? TOWER_H : 1;
                drawBrackets(
                    found.piece.c * TILE + 4,
                    found.piece.r * TILE + 4,
                    tw * TILE - 8,
                    th * TILE - 8
                );
                if (selected.kind === "tower" && frameDetail !== "far") {
                    ctx.fillStyle = "rgba(232, 200, 74, 0.16)";
                    for (let c = found.piece.c - TOWER_RANGE; c <= found.piece.c + tw - 1 + TOWER_RANGE; c++) {
                        for (let r = found.piece.r - TOWER_RANGE; r <= found.piece.r + th - 1 + TOWER_RANGE; r++) {
                            if (c < view.c0 || r < view.r0 || c > view.c1 || r > view.r1) continue;
                            if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
                            if (distToBox(found.piece.c, found.piece.r, tw, th, c, r) === 0) continue;
                            if (distToBox(found.piece.c, found.piece.r, tw, th, c, r) > TOWER_RANGE) continue;
                            ctx.fillRect(c * TILE + 8, r * TILE + 8, TILE - 16, TILE - 16);
                        }
                    }
                }
            }
        }

        const mine = selectedSoldier();
        if (mine) {
            const p = drawPos(mine.soldier);
            drawBrackets(p.c * TILE + 8, p.r * TILE + 6, 44, 48, "#f4f0d8");
            if (mine.soldier.role === "archer" && frameDetail !== "far") {
                ctx.fillStyle = "rgba(232, 200, 74, 0.16)";
                for (let c = mine.soldier.c - ARCHER_RANGE; c <= mine.soldier.c + ARCHER_RANGE; c++) {
                    for (let r = mine.soldier.r - ARCHER_RANGE; r <= mine.soldier.r + ARCHER_RANGE; r++) {
                        if (c < view.c0 || r < view.r0 || c > view.c1 || r > view.r1) continue;
                        if (c === mine.soldier.c && r === mine.soldier.r) continue;
                        if (chebyshev(mine.soldier.c, mine.soldier.r, c, r) > ARCHER_RANGE) continue;
                        ctx.fillRect(c * TILE + 8, r * TILE + 8, TILE - 16, TILE - 16);
                    }
                }
            }
            const order = mine.soldier.order;
            if (order && (order.kind === "move" || order.kind === "gather")) {
                ctx.fillStyle = "rgba(244, 240, 216, 0.45)";
                ctx.fillRect(order.c * TILE + 6, order.r * TILE + 6, TILE - 12, TILE - 12);
                drawBrackets(order.c * TILE + 8, order.r * TILE + 8, TILE - 16, TILE - 16, "#e8c84a");
            }
            const target = resolveOrder(mine.soldier);
            if (target && target.kind === "building") {
                drawBrackets(
                    target.faction.building.c * TILE + 2,
                    target.faction.building.r * TILE + 2,
                    HALL_W * TILE - 4,
                    HALL_H * TILE - 4,
                    "#e05040"
                );
            } else if (target && target.kind === "house") {
                drawBrackets(
                    target.ref.c * TILE + 4,
                    target.ref.r * TILE + 4,
                    HOUSE_W * TILE - 8,
                    HOUSE_H * TILE - 8,
                    "#e05040"
                );
            } else if (target && target.kind === "work") {
                drawBrackets(
                    target.ref.c * TILE + 2,
                    target.ref.r * TILE + 2,
                    TILE * 2 - 4,
                    TILE * 2 - 4,
                    "#e05040"
                );
            } else if (target && target.kind === "mill") {
                drawBrackets(
                    target.ref.c * TILE + 4,
                    target.ref.r * TILE + 4,
                    MILL_W * TILE - 8,
                    MILL_H * TILE - 8,
                    "#e05040"
                );
            } else if (target && (target.kind === "wall" || target.kind === "tower")) {
                const tw = target.kind === "tower" ? TOWER_W : 1;
                const th = target.kind === "tower" ? TOWER_H : 1;
                drawBrackets(
                    target.ref.c * TILE + 4,
                    target.ref.r * TILE + 4,
                    tw * TILE - 8,
                    th * TILE - 8,
                    "#e05040"
                );
            } else if (target && target.kind === "soldier") {
                const tp = drawPos(target.ref);
                drawBrackets(tp.c * TILE + 8, tp.r * TILE + 6, 44, 48, "#e05040");
            }
        }
    }

    let zoomReady = false;

    function battleSnapshot() {
        return {
            seq: battleSeq,
            nextId: nextId,
            player: player,
            playerDown: playerDown,
            hostile: { blue: !!hostile.blue, red: !!hostile.red },
            selected: selected,
            factions: factions.map(function (faction) {
                return {
                    id: faction.id,
                    gold: faction.gold,
                    food: faction.food,
                    wood: faction.wood,
                    stone: faction.stone,
                    iron: faction.iron,
                    payday: faction.payday,
                    trainLeft: faction.trainLeft,
                    trained: faction.trained,
                    trainKind: faction.trainKind || null,
                    building: faction.building,
                    soldiers: faction.soldiers,
                    houses: faction.houses,
                    works: faction.works,
                    walls: faction.walls,
                    towers: faction.towers,
                    windmills: faction.windmills,
                    carts: faction.carts
                };
            })
        };
    }

    function applySnapshot(data) {
        if (!data || !data.factions || data.factions.length !== factions.length) return false;
        const copy = JSON.parse(JSON.stringify(data));
        for (let i = 0; i < factions.length; i++) {
            const saved = copy.factions[i];
            const live = factions[i];
            if (!saved || saved.id !== live.id || !saved.building) return false;
            live.gold = saved.gold;
            live.food = saved.food;
            live.wood = saved.wood;
            live.stone = saved.stone;
            live.iron = saved.iron;
            live.payday = saved.payday;
            live.trainLeft = saved.trainLeft || 0;
            live.trained = !!saved.trained;
            live.trainKind = saved.trainKind || null;
            live.building = saved.building;
            if (live.building.maxHp > 0 && live.building.maxHp < BUILDING_HP) {
                const ratio = Math.max(0, Math.min(1, live.building.hp / live.building.maxHp));
                live.building.maxHp = BUILDING_HP;
                live.building.hp = Math.round(ratio * BUILDING_HP);
            }
            live.soldiers = saved.soldiers || [];
            live.houses = saved.houses || [];
            live.works = saved.works || [];
            live.walls = saved.walls || [];
            live.towers = saved.towers || [];
            live.windmills = saved.windmills || [];
            live.carts = saved.carts || [];
        }
        nextId = copy.nextId || 1;
        player = copy.player || null;
        playerDown = copy.playerDown || 0;
        hostile.blue = !!(copy.hostile && copy.hostile.blue);
        hostile.red = !!(copy.hostile && copy.hostile.red);
        selected = copy.selected || null;
        placing = null;
        placeHint = "";
        if (copy.seq) battleSeq = copy.seq;
        return true;
    }

    function saveBattle() {
        battleSeq += 1;
        const data = battleSnapshot();
        try {
            localStorage.setItem(BATTLE_KEY, JSON.stringify(data));
        } catch (err) {
            return;
        }
    }

    function loadBattle() {
        try {
            const raw = localStorage.getItem(BATTLE_KEY);
            if (!raw) return false;
            return applySnapshot(JSON.parse(raw));
        } catch (err) {
            return false;
        }
    }

    function resetBattle() {
        floaters.length = 0;
        slashes.length = 0;
        arrows.length = 0;
        applySnapshot(START_BATTLE);
        battleSeq = 0;
        if (playerMode) placePlayer(true);
        saveBattle();
        updateHud();
    }

    function frame(now) {
        if (!zoomReady) {
            zoomReady = true;
            battleView.ensure();
        }
        if (document.hidden) {
            lastTime = 0;
            requestAnimationFrame(frame);
            return;
        }
        if (!lastTime) lastTime = now;
        const dt = Math.min(100, now - lastTime);
        lastTime = now;
        update(dt);
        saveLeft -= dt;
        if (saveLeft <= 0) {
            saveLeft = 1000;
            saveBattle();
        }
        draw(now);
        requestAnimationFrame(frame);
    }

    window.addEventListener("pagehide", saveBattle);
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            saveBattle();
            return;
        }
        lastTime = 0;
        try {
            const data = JSON.parse(localStorage.getItem(BATTLE_KEY) || "null");
            if (data && data.seq && data.seq !== battleSeq) loadBattle();
        } catch (err) {
            return;
        }
        updateHud();
    });

    updateHud();
    requestAnimationFrame(frame);
})();
