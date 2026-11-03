(function () {
    const KEY = "aoe-dev-sheet";
    const UNITS = {
        soldier: { name: "Soldier", use: "military", model: "militia", anims: "Idle, Walk", hp: 40, attack: 8, move: 3.4, cost: 50, w: 1.1, d: 0.63 },
        worker: { name: "Worker", use: "economical", model: "villager", anims: "Idle, Walk", hp: 20, attack: 8, move: 3.4, cost: 50, w: 0.62, d: 0.4 }
    };
    const BUILDINGS = {
        manor: { name: "Manor", map: "lorsmanor-courtyard", model: "lorsmanor-courtyard", makes: "worker", time: 0, wood: 0, hx: 16.19, hz: 11.27, placed: false },
        house: { name: "Small house", map: "small-house1", model: "small-house1", makes: "", time: 300, wood: 20, hx: 3.28, hz: 4.29, placed: true },
        barracks: { name: "Barracks", map: "barracks", model: "barracks", makes: "soldier", time: 300, wood: 100, hx: 14.26, hz: 9.09, placed: true },
        farm: { name: "Farm", map: "farm", model: "farm", makes: "", time: 300, wood: 100, hx: 8.81, hz: 18.43, placed: true },
        salt: { name: "Salt works", map: "salt-works-ex", model: "salt-works-ex", makes: "", time: 300, wood: 100, hx: 11.06, hz: 14.33, placed: true },
        store: { name: "Storehouse", map: "storehouse", model: "storehouse", makes: "", time: 300, wood: 100, hx: 8.06, hz: 8.11, placed: true },
        smith: { name: "Blacksmith", map: "blacksmith", model: "blacksmith", makes: "", time: 300, wood: 100, hx: 5, hz: 5, placed: false }
    };
    const CREATURES = {
        bear: { name: "Bear", use: "Not in the match", model: "bear", anims: "Idle, Walk", hp: 80, attack: 18, move: 3.2, cost: 0, w: 1.2, d: 2 },
        wolf: { name: "Wolf", use: "Not in the match", model: "wolf", anims: "Idle, Walk", hp: 30, attack: 10, move: 5.5, cost: 0, w: 0.6, d: 1.3 },
        warg: { name: "Warg", use: "Not in the match", model: "warg", anims: "Idle, Walk", hp: 45, attack: 14, move: 5.2, cost: 0, w: 0.8, d: 1.6 },
        fox: { name: "Fox", use: "Not in the match", model: "fox", anims: "Idle, Walk", hp: 12, attack: 4, move: 5.8, cost: 0, w: 0.4, d: 0.9 },
        deer: { name: "Deer", use: "Not in the match", model: "deer", anims: "Idle, Walk", hp: 18, attack: 2, move: 6.2, cost: 0, w: 0.6, d: 1.5 },
        rat: { name: "Rat", use: "Not in the match", model: "rat", anims: "Idle, Walk", hp: 6, attack: 2, move: 3.6, cost: 0, w: 0.2, d: 0.45 },
        snake: { name: "Snake", use: "Not in the match", model: "snake", anims: "Idle, Walk", hp: 10, attack: 8, move: 2.4, cost: 0, w: 0.15, d: 1.1 },
        eagle: { name: "Eagle", use: "Not in the match", model: "eagle", anims: "Idle, Walk", hp: 14, attack: 6, move: 8, cost: 0, w: 0.9, d: 0.5 },
        spider: { name: "Spider", use: "Not in the match", model: "spider", anims: "Idle, Walk", hp: 16, attack: 7, move: 3.2, cost: 0, w: 0.9, d: 0.9 },
        wasp: { name: "Wasp", use: "Not in the match", model: "wasp", anims: "Idle, Walk", hp: 8, attack: 5, move: 7, cost: 0, w: 0.35, d: 0.4 },
        centipede: { name: "Centipede", use: "Not in the match", model: "centipede", anims: "Idle, Walk", hp: 14, attack: 6, move: 2.8, cost: 0, w: 0.2, d: 0.9 },
        rhino: { name: "Rhino", use: "Not in the match", model: "rhino", anims: "Idle, Walk", hp: 90, attack: 16, move: 4, cost: 0, w: 1.2, d: 2.4 },
        mammoth: { name: "Mammoth", use: "Not in the match", model: "mammoth", anims: "Idle, Walk", hp: 160, attack: 22, move: 2.6, cost: 0, w: 2, d: 3.6 },
        cow: { name: "Cow", use: "Animated, not placed", model: "cow", anims: "Idle, Trot", hp: 28, attack: 4, move: 3, cost: 0, w: 1, d: 2 },
        dragon: { name: "Dragon", use: "Animated, not placed", model: "dragon", anims: "Idle, Walk", hp: 220, attack: 35, move: 4.5, cost: 0, w: 2.5, d: 4.5 },
        horse: { name: "Horse", use: "Salt works", model: "horse", anims: "Idle, Trot", hp: 30, attack: 0, move: 6.4, cost: 50, w: 0.63, d: 3.21 },
        horse2: { name: "Horse 2", use: "Village pet", model: "horse2", anims: "Idle, Walk, Trot, Run", hp: 36, attack: 3, move: 7, cost: 0, w: 0.8, d: 2.2 },
        zombie: { name: "Zombie", use: "Village woods", model: "ch10", anims: "Idle, Walk", hp: 35, attack: 9, move: 2.2, cost: 0, w: 0.7, d: 0.7 }
    };
    const FIGURES = [
        { group: "Characters", name: "Soldier", model: "militia", anims: "Idle, Walk" },
        { group: "Characters", name: "Man at arms", model: "../models/meshy/harlequin-man-at-arms.glb", anims: "Idle, Walking, Running, Sword slash, Sword parry, Archery shot, Draw and shoot, Hammer swing, Dead" },
        { group: "Characters", name: "Worker", model: "villager", anims: "Idle, Walk" },
        { group: "Characters", name: "Blacksmith", model: "../models/meshy/blacksmith-character.glb", anims: "Running, Walking, Dead, Hammer swing, Idle, Sword slash" },
        { group: "Characters", name: "Archer", model: "../models/meshy/forest-archer.glb", anims: "Running, Walking, Archery shot, Dead, Idle" },
        { group: "Characters", name: "Guardian", model: "../models/meshy/guardian.glb", anims: "Running, Walking" },
        { group: "Characters", name: "King", model: "../models/meshy/king-character.glb", anims: "Running, Walking, Ground stomp, Dead, Idle, Sword slash" },
        { group: "Characters", name: "Heroic warrior", model: "../tools/CharacterPacks/heroic-warrior/heroic-warrior.glb", anims: "Idle, Walk, Jump, Punch" },
        { group: "Characters", name: "Paladin", model: "../models/kaykit/prop-idle.glb", anims: "Idle" },
        { group: "Characters", name: "Zombie", model: "ch10", anims: "Idle, Walk" },
        { group: "Animals", name: "Rat", model: "rat", anims: "Idle, Walk" },
        { group: "Animals", name: "Bear", model: "bear", anims: "Idle, Walk" },
        { group: "Animals", name: "Snake", model: "snake", anims: "Idle, Bite, Side winding" },
        { group: "Animals", name: "Eagle", model: "eagle", anims: "Idle, Walk, Flap, Glide" },
        { group: "Animals", name: "Spider", model: "spider", anims: "Idle, Walk" },
        { group: "Animals", name: "Fox", model: "fox", anims: "Idle, Walk, Run, Sit" },
        { group: "Animals", name: "Wolf", model: "wolf", anims: "Idle, Walk" },
        { group: "Animals", name: "Deer", model: "deer", anims: "Idle, Walk" },
        { group: "Animals", name: "Horse", model: "horse", anims: "Idle, Trot" },
        { group: "Animals", name: "Horse 2", model: "../models/horse.glb", anims: "Idle, Walk, Trot, Run" },
        { group: "Animals", name: "Cart horse", model: "../models/meshy/cart-horse.glb", anims: "Animated" },
        { group: "Animals", name: "Cart", model: "../models/meshy/wooden-cart.glb", anims: "" },
        { group: "Animals", name: "Horse with cart", model: "../models/meshy/horse-and-cart.glb", anims: "" }
    ];

    function num(value, fallback, min, max) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    }

    function ticked(value) {
        return value === true || value === "true";
    }

    const REAL_SIZE = {
        buildings: {
            manor: [16.19, 11.27],
            house: [3.28, 4.29],
            barracks: [14.26, 9.09],
            farm: [8.81, 18.43],
            salt: [11.06, 14.33],
            store: [8.06, 8.11],
            smith: [5, 5]
        },
        units: { soldier: [1.1, 0.63], worker: [0.62, 0.4] },
        horse: [0.63, 3.21],
        player: [1.1, 0.63]
    };

    function loadAll() {
        let data;
        try {
            data = JSON.parse(localStorage.getItem(KEY) || "{}");
        } catch (err) {
            data = {};
        }
        data.buildings = data.buildings || {};
        const store = data.buildings.store || {};
        const wide = Number(store.hx);
        const deep = Number(store.hz);
        if (data.storeFit !== 1) {
            if (!Number.isFinite(wide) || Math.abs(wide - 16.08) < 0.05) store.hx = 8.06;
            if (!Number.isFinite(deep) || Math.abs(deep - 11.12) < 0.05) store.hz = 8.11;
            data.buildings.store = store;
            data.storeFit = 1;
            saveAll(data);
        }
        if (data.sizeStamp === 1) return data;
        data.buildings = data.buildings || {};
        Object.keys(REAL_SIZE.buildings).forEach((id) => {
            const row = data.buildings[id] || {};
            row.hx = REAL_SIZE.buildings[id][0];
            row.hz = REAL_SIZE.buildings[id][1];
            data.buildings[id] = row;
        });
        data.units = data.units || {};
        Object.keys(REAL_SIZE.units).forEach((id) => {
            const row = data.units[id] || {};
            row.w = REAL_SIZE.units[id][0];
            row.d = REAL_SIZE.units[id][1];
            data.units[id] = row;
        });
        data.creatures = data.creatures || {};
        const horse = data.creatures.horse || {};
        horse.w = REAL_SIZE.horse[0];
        horse.d = REAL_SIZE.horse[1];
        data.creatures.horse = horse;
        data.player = data.player || {};
        data.player.w = REAL_SIZE.player[0];
        data.player.d = REAL_SIZE.player[1];
        data.sizeStamp = 1;
        saveAll(data);
        return data;
    }

    function saveAll(data) {
        localStorage.setItem(KEY, JSON.stringify(data));
    }

    function text(value, fallback, max) {
        if (typeof value !== "string") return fallback;
        return value.slice(0, max || 80);
    }

    function optionList(value) {
        if (!Array.isArray(value)) return [];
        const seen = {};
        const out = [];
        value.forEach((item) => {
            const label = text(item, "", 40).trim();
            const key = label.toLowerCase();
            if (!label || seen[key]) return;
            seen[key] = true;
            out.push(label);
        });
        return out.slice(0, 24);
    }

    function columnRecord(col, patch) {
        const name = patch && patch.name != null ? (text(patch.name, "Column", 40) || "Column") : (text(col.name, "Column", 40) || "Column");
        const asked = patch && patch.kind != null ? patch.kind : col.kind;
        const kind = asked === "dropdown" || asked === "multi" ? asked : "text";
        const source = patch && patch.options != null ? patch.options : col.options;
        return { id: col.id, name: name, kind: kind, options: optionList(source) };
    }

    function columnsOf(all, table) {
        const saved = all.columns && all.columns[table];
        if (!Array.isArray(saved)) return [];
        const seen = {};
        const out = [];
        saved.forEach((col) => {
            if (!col || typeof col.id !== "string" || seen[col.id]) return;
            seen[col.id] = true;
            out.push(columnRecord({ id: col.id.slice(0, 40), name: col.name, kind: col.kind, options: col.options }));
        });
        return out.slice(0, 24);
    }

    function seedCreatureType() {
        const all = loadAll();
        all.seeds = all.seeds && typeof all.seeds === "object" ? all.seeds : {};
        if (all.seeds.creatureTypeDropdown) return;
        const list = columnsOf(all, "creatures");
        const found = list.find((col) => col.name.trim().toLowerCase() === "type");
        if (!found) list.push({ id: "col-creature-type", name: "Type", kind: "dropdown", options: [] });
        else found.kind = "dropdown";
        all.columns = all.columns || {};
        all.columns.creatures = list;
        all.seeds.creatureTypeDropdown = true;
        saveAll(all);
    }

    const GOODS = ["food", "wood", "gold", "stone", "iron", "salt", "fabric"];

    function extraCosts(row, primary) {
        const src = row && row.costs && typeof row.costs === "object" ? row.costs : {};
        const out = {};
        GOODS.forEach((key) => {
            if (key === primary || src[key] == null || src[key] === "") return;
            out[key] = num(src[key], 0, 0, 99999);
        });
        return out;
    }

    function extraMap(row, cols) {
        const src = row && row.extra && typeof row.extra === "object" ? row.extra : {};
        const out = {};
        cols.forEach((col) => {
            out[col.id] = text(src[col.id], "", 500);
        });
        return out;
    }

    function readTable(base, saved, fill) {
        const out = {};
        Object.keys(base).forEach((id) => {
            out[id] = fill(base[id], (saved && saved[id]) || {});
        });
        return out;
    }

    const ROLES = ["military", "economical", "NPC"];

    function roleOf(row, base) {
        const saved = text(row && row.use, "", 40);
        if (ROLES.indexOf(saved) >= 0) return saved;
        const fallback = text(base && base.use, "", 40);
        return ROLES.indexOf(fallback) >= 0 ? fallback : "military";
    }

    function trainableUnits() {
        const out = {};
        const rows = units();
        Object.keys(rows).forEach((id) => {
            if (rows[id].use === "military" || rows[id].use === "economical") out[id] = rows[id];
        });
        return out;
    }

    function productionId(value) {
        const chosen = text(value, "", 40);
        if (!chosen) return "";
        const list = trainableUnits();
        if (list[chosen]) return chosen;
        const legacy = { Soldier: "soldier", Worker: "worker" };
        if (legacy[chosen] && list[legacy[chosen]]) return legacy[chosen];
        const byName = Object.keys(list).find((id) => list[id].name === chosen);
        return byName || "";
    }

    function productionList(row, base) {
        let src = "";
        if (row && Array.isArray(row.makesList)) src = row.makesList;
        else if (row && (typeof row.makes === "string" || Array.isArray(row.makes))) src = row.makes;
        else if (base && base.makes) src = base.makes;
        const ids = Array.isArray(src) ? src : (src ? [src] : []);
        const out = [];
        ids.forEach((item) => {
            const id = productionId(item);
            if (id && out.indexOf(id) < 0) out.push(id);
        });
        return out.slice(0, 12);
    }

    function actorFrom(base, row, cols, added, roles) {
        return {
            name: added ? text(row.name, base.name) : base.name,
            use: roles ? roleOf(row, base) : (added ? text(row.use, base.use) : base.use),
            model: added ? text(row.model, base.model, 240) : (text(row.model, "", 240) || base.model),
            anims: added ? text(row.anims, base.anims, 240) : (text(row.anims, "", 240) || base.anims),
            hp: num(row.hp, base.hp, 1, 9999),
            attack: num(row.attack, base.attack, 0, 9999),
            defence: num(row.defence, base.defence != null ? base.defence : 0, 0, 9999),
            move: num(row.move, base.move, 0.1, 99),
            cost: num(row.cost, base.cost, 0, 99999),
            costs: extraCosts(row, "food"),
            w: num(row.w, base.w, 0.1, 40),
            d: num(row.d, base.d, 0.1, 40),
            inUse: ticked(row.inUse),
            added: added,
            extra: extraMap(row, cols)
        };
    }

    function blankActor(label) {
        return { name: label, use: "", model: "", anims: "", hp: 20, attack: 0, defence: 0, move: 3, cost: 0, w: 0.7, d: 0.7 };
    }

    function buildingFrom(base, row, cols, added) {
        const made = productionList(row, added ? null : base);
        return {
            name: added ? text(row.name, base.name) : base.name,
            map: text(row.map, "", 240) || base.map,
            model: added ? text(row.model, base.model) : base.model,
            makes: made[0] || "",
            makesList: made,
            placed: added ? true : base.placed,
            time: num(row.time, base.time, 0, 3600),
            wood: num(row.wood, base.wood, 0, 99999),
            costs: extraCosts(row, "wood"),
            hx: num(row.hx, base.hx, 0.5, 80),
            hz: num(row.hz, base.hz, 0.5, 80),
            inUse: ticked(row.inUse),
            mapInUse: ticked(row.mapInUse),
            modelInUse: ticked(row.modelInUse),
            added: added,
            extra: extraMap(row, cols)
        };
    }

    const MAP_HOUSES = [];
    for (let house = 1; house <= 20; house++) {
        const n = house < 10 ? "0" + house : String(house);
        MAP_HOUSES.push({ name: "House " + house, model: "../models/houses/house-" + n + ".fbx" });
    }

    function blankBuilding() {
        return { name: "New building", map: "", model: "", makes: "", time: 300, wood: 0, hx: 4, hz: 4, placed: true };
    }

    function addedRaw(all, table) {
        const saved = all.added && all.added[table];
        return saved && typeof saved === "object" ? saved : {};
    }

    function readActors(base, table, label) {
        const all = loadAll();
        const cols = columnsOf(all, table);
        const roles = table === "units";
        const out = readTable(base, all[table], (item, row) => actorFrom(item, row, cols, false, roles));
        const blank = blankActor(label);
        Object.keys(addedRaw(all, table)).forEach((id) => {
            if (base[id]) return;
            out[id] = actorFrom(blank, addedRaw(all, table)[id], cols, true, roles);
        });
        return out;
    }

    function writeActors(base, table, label, patch) {
        const all = loadAll();
        const cols = columnsOf(all, table);
        const next = readActors(base, table, label);
        const known = {};
        const added = {};
        Object.keys(next).forEach((id) => {
            const row = patch[id] ? actorFrom(base[id] || blankActor(label), patch[id], cols, !base[id], table === "units") : next[id];
            if (base[id]) known[id] = row;
            else added[id] = row;
        });
        all[table] = known;
        all.added = all.added || {};
        all.added[table] = added;
        saveAll(all);
        return readActors(base, table, label);
    }

    function units() {
        return readActors(UNITS, "units", "New unit");
    }

    function writeUnits(patch) {
        return writeActors(UNITS, "units", "New unit", patch);
    }

    function buildings() {
        const all = loadAll();
        const cols = columnsOf(all, "buildings");
        const out = readTable(BUILDINGS, all.buildings, (item, row) => buildingFrom(item, row, cols, false));
        const blank = blankBuilding();
        Object.keys(addedRaw(all, "buildings")).forEach((id) => {
            if (BUILDINGS[id]) return;
            out[id] = buildingFrom(blank, addedRaw(all, "buildings")[id], cols, true);
        });
        return out;
    }

    function writeBuildings(patch) {
        const all = loadAll();
        const cols = columnsOf(all, "buildings");
        const next = buildings();
        const known = {};
        const added = {};
        Object.keys(next).forEach((id) => {
            const row = patch[id] ? buildingFrom(BUILDINGS[id] || blankBuilding(), patch[id], cols, !BUILDINGS[id]) : next[id];
            if (BUILDINGS[id]) known[id] = row;
            else added[id] = row;
        });
        all.buildings = known;
        all.added = all.added || {};
        all.added.buildings = added;
        saveAll(all);
        return buildings();
    }

    function creatures() {
        seedCreatureType();
        return readActors(CREATURES, "creatures", "New creature");
    }

    function writeCreatures(patch) {
        return writeActors(CREATURES, "creatures", "New creature", patch);
    }

    function player() {
        const all = loadAll();
        const row = all.player || {};
        return {
            name: "Player",
            use: "First person",
            model: "militia",
            anims: "Idle, Walk",
            hp: num(row.hp, 40, 1, 9999),
            attack: num(row.attack, 12, 0, 9999),
            shot: num(row.shot, 8, 0, 9999),
            defence: num(row.defence, 0, 0, 9999),
            move: num(row.move, 6.8, 0.1, 99),
            w: num(row.w, 1.1, 0.1, 40),
            d: num(row.d, 0.63, 0.1, 40),
            inUse: ticked(row.inUse),
            extra: extraMap(row, columnsOf(all, "player"))
        };
    }

    function writePlayer(patch) {
        const all = loadAll();
        const current = player();
        all.player = {
            hp: num(patch.hp, current.hp, 1, 9999),
            attack: num(patch.attack, current.attack, 0, 9999),
            shot: num(patch.shot, current.shot, 0, 9999),
            defence: num(patch.defence, current.defence, 0, 9999),
            move: num(patch.move, current.move, 0.1, 99),
            w: num(patch.w, current.w, 0.1, 40),
            d: num(patch.d, current.d, 0.1, 40),
            inUse: ticked(patch.inUse),
            extra: extraMap(patch, columnsOf(all, "player"))
        };
        saveAll(all);
        return player();
    }

    const BASE_FACTIONS = {
        you: { name: "Team A" },
        cpu: { name: "Team B" }
    };

    function startLines(saved, fallback) {
        if (!Array.isArray(saved)) return fallback.map((line) => ({ id: line.id, count: line.count }));
        return saved.map((line) => ({
            id: text(line && line.id, "", 40),
            count: num(line && line.count, 1, 0, 999)
        })).filter((line) => line.id).slice(0, 24);
    }

    function factionFrom(id, base, saved) {
        const row = saved || {};
        const fallbackName = base ? base.name : "New faction";
        const out = {
            id: id,
            name: text(row.name, fallbackName, 40) || fallbackName,
            base: !!base,
            units: startLines(row.units, [{ id: "worker", count: 1 }]),
            buildings: startLines(row.buildings, [{ id: "manor", count: 1 }])
        };
        GOODS.forEach((key) => {
            out[key] = num(row[key], key === "food" ? 200 : 0, 0, 999999);
        });
        return out;
    }

    function factions() {
        const all = loadAll();
        const saved = all.campaign && all.campaign.factions && typeof all.campaign.factions === "object" ? all.campaign.factions : {};
        const order = all.campaign && Array.isArray(all.campaign.order) ? all.campaign.order : [];
        const ids = ["you", "cpu"];
        order.forEach((id) => {
            if (typeof id === "string" && ids.indexOf(id) < 0 && saved[id]) ids.push(id);
        });
        Object.keys(saved).forEach((id) => {
            if (ids.indexOf(id) < 0) ids.push(id);
        });
        return ids.map((id) => factionFrom(id, BASE_FACTIONS[id], saved[id]));
    }

    function writeFactions(list) {
        const all = loadAll();
        const stored = {};
        const order = [];
        (Array.isArray(list) ? list : []).forEach((row) => {
            const id = row && typeof row.id === "string" ? row.id.slice(0, 40) : "";
            if (!id || stored[id]) return;
            if (!BASE_FACTIONS[id] && id.indexOf("fac-") !== 0) return;
            stored[id] = factionFrom(id, BASE_FACTIONS[id], row);
            order.push(id);
        });
        ["you", "cpu"].forEach((id) => {
            if (stored[id]) return;
            stored[id] = factionFrom(id, BASE_FACTIONS[id], {});
            order.unshift(id);
        });
        all.campaign = { factions: stored, order: order };
        saveAll(all);
        return factions();
    }

    function addFaction() {
        const id = "fac-" + Math.random().toString(36).slice(2, 8);
        const list = factions();
        list.push(factionFrom(id, null, { name: "New faction" }));
        writeFactions(list);
        return id;
    }

    function removeFaction(id) {
        if (BASE_FACTIONS[id]) return;
        writeFactions(factions().filter((row) => row.id !== id));
    }

    function columns(table) {
        if (table === "creatures") seedCreatureType();
        return columnsOf(loadAll(), table);
    }

    function addColumn(table) {
        const all = loadAll();
        const list = columnsOf(all, table);
        const id = "col-" + Math.random().toString(36).slice(2, 8);
        list.push({ id: id, name: "Column", kind: "text", options: [] });
        all.columns = all.columns || {};
        all.columns[table] = list;
        saveAll(all);
        return id;
    }

    function renameColumn(table, id, name) {
        setColumn(table, id, { name: name });
    }

    function setColumn(table, id, patch) {
        const all = loadAll();
        const list = columnsOf(all, table).map((col) => col.id === id ? columnRecord(col, patch || {}) : col);
        all.columns = all.columns || {};
        all.columns[table] = list;
        saveAll(all);
    }

    function removeColumn(table, id) {
        const all = loadAll();
        all.columns = all.columns || {};
        all.columns[table] = columnsOf(all, table).filter((col) => col.id !== id);
        saveAll(all);
    }

    const WEAPON_FILE = "weapons pack/3D_fantasy_weapons_pack/models/";
    const WEAPONS = {
        "knights-longsword": { name: "Knight's Longsword", damage: 12, cost: 50, model: WEAPON_FILE + "knights_longsword.glb" },
        "orcish-cleaver": { name: "Orcish Cleaver", damage: 14, cost: 40, model: WEAPON_FILE + "orcish_cleaver.glb" },
        "elven-leaf-blade": { name: "Elven Leaf Blade", damage: 11, cost: 70, model: WEAPON_FILE + "elven_leaf_blade.glb" },
        "dwarven-war-axe": { name: "Dwarven War Axe", damage: 15, cost: 60, model: WEAPON_FILE + "dwarven_war_axe.glb" },
        "twin-moon-battle-axe": { name: "Twin-Moon Battle Axe", damage: 16, cost: 80, model: WEAPON_FILE + "twin_moon_battle_axe.glb" },
        "spiked-mace": { name: "Spiked Mace", damage: 13, cost: 45, model: WEAPON_FILE + "spiked_mace.glb" },
        "warhammer": { name: "Warhammer", damage: 16, cost: 55, model: WEAPON_FILE + "warhammer.glb" },
        "giants-maul": { name: "Giant's Maul", damage: 20, cost: 90, model: WEAPON_FILE + "giants_maul.glb" },
        "rogues-dagger": { name: "Rogue's Dagger", damage: 7, cost: 20, model: WEAPON_FILE + "rogues_dagger.glb" },
        "jeweled-dagger": { name: "Jeweled Dagger", damage: 8, cost: 35, model: WEAPON_FILE + "jeweled_dagger.glb" },
        "pirate-cutlass": { name: "Pirate Cutlass", damage: 11, cost: 40, model: WEAPON_FILE + "pirate_cutlass.glb" },
        "katana": { name: "Katana", damage: 13, cost: 75, model: WEAPON_FILE + "katana.glb" },
        "highland-claymore": { name: "Highland Claymore", damage: 18, cost: 85, model: WEAPON_FILE + "highland_claymore.glb" },
        "falchion": { name: "Falchion", damage: 12, cost: 45, model: WEAPON_FILE + "falchion.glb" },
        "duelists-rapier": { name: "Duelist's Rapier", damage: 9, cost: 60, model: WEAPON_FILE + "duelists_rapier.glb" },
        "morning-star": { name: "Morning Star", damage: 14, cost: 50, model: WEAPON_FILE + "morning_star.glb" },
        "halberd": { name: "Halberd", damage: 15, cost: 70, model: WEAPON_FILE + "halberd.glb" },
        "hunting-spear": { name: "Hunting Spear", damage: 11, cost: 30, model: WEAPON_FILE + "hunting_spear.glb" },
        "tidal-trident": { name: "Tidal Trident", damage: 14, cost: 80, model: WEAPON_FILE + "tidal_trident.glb" },
        "reapers-scythe": { name: "Reaper's Scythe", damage: 17, cost: 90, model: WEAPON_FILE + "reapers_scythe.glb" },
        "war-pick": { name: "War Pick", damage: 13, cost: 40, model: WEAPON_FILE + "war_pick.glb" },
        "wizards-staff": { name: "Wizard's Staff", damage: 8, cost: 65, model: WEAPON_FILE + "wizards_staff.glb" },
        "paladins-mace": { name: "Paladin's Mace", damage: 14, cost: 70, model: WEAPON_FILE + "paladins_mace.glb" },
        "bone-club": { name: "Bone Club", damage: 10, cost: 15, model: WEAPON_FILE + "bone_club.glb" },
        "crystal-greatsword": { name: "Crystal Greatsword", damage: 19, cost: 100, model: WEAPON_FILE + "crystal_greatsword.glb" },
        "meshy-crossbow": { name: "Crossbow", damage: 10, cost: 55, model: "../tools/Meshy_AI_lowpoly_medieval_crossbow_20261102_texture_a0475ada/Meshy_AI_model.glb" },
        "meshy-spear": { name: "Spear", damage: 12, cost: 35, model: "../tools/Meshy_AI_lowpoly_medieval_spear_20261102_texture_f72770c0/Meshy_AI_model.glb" },
        "meshy-mace": { name: "Mace", damage: 12, cost: 40, model: "../tools/Meshy_AI_lowpoly_medieval_mace_20261102_texture_5d63fe2a/Meshy_AI_model.glb" },
        "meshy-musket": { name: "Musket", damage: 16, cost: 80, model: "../tools/Meshy_AI_lowpoly_medieval_musket_20261102_texture_b96c6c21/Meshy_AI_model.glb" },
        "meshy-halberd": { name: "Meshy Halberd", damage: 14, cost: 60, model: "../tools/Meshy_AI_lowpoly_medieval_halberd_20261102_texture_dd7a42bb/Meshy_AI_model.glb" }
    };

    function blankWeapon() {
        return { name: "New weapon", damage: 0, cost: 0, model: "" };
    }

    function weaponFrom(base, row, cols, added) {
        const src = row && typeof row === "object" ? row : {};
        const damage = src.damage != null && src.damage !== "" ? src.damage : base.damage;
        const cost = src.cost != null && src.cost !== "" ? src.cost : base.cost;
        return {
            name: added ? (text(src.name, base.name, 48) || base.name) : base.name,
            damage: num(damage, base.damage, 0, 99999),
            cost: num(cost, base.cost, 0, 99999),
            model: added ? text(src.model, base.model, 180) : base.model,
            costs: extraCosts(src, "food"),
            extra: extraMap(src, cols),
            added: !!added
        };
    }

    function weapons() {
        const all = loadAll();
        const cols = columnsOf(all, "weapons");
        const saved = all.weapons && typeof all.weapons === "object" ? all.weapons : {};
        const out = {};
        Object.keys(WEAPONS).forEach((id) => {
            out[id] = weaponFrom(WEAPONS[id], saved[id], cols, false);
        });
        const raw = addedRaw(all, "weapons");
        Object.keys(raw).forEach((id) => {
            if (WEAPONS[id]) return;
            out[id] = weaponFrom(blankWeapon(), raw[id], cols, true);
        });
        return out;
    }

    function writeWeapons(patch) {
        const all = loadAll();
        const cols = columnsOf(all, "weapons");
        const next = weapons();
        const known = {};
        const added = {};
        Object.keys(next).forEach((id) => {
            const row = weaponFrom(WEAPONS[id] || blankWeapon(), patch && patch[id] ? patch[id] : next[id], cols, !WEAPONS[id]);
            if (WEAPONS[id]) known[id] = row;
            else added[id] = row;
        });
        all.weapons = known;
        all.added = all.added || {};
        all.added.weapons = added;
        saveAll(all);
        return weapons();
    }

    function addRow(table) {
        const all = loadAll();
        const id = "add-" + table + "-" + Math.random().toString(36).slice(2, 8);
        all.added = all.added || {};
        all.added[table] = addedRaw(all, table);
        if (table === "buildings") all.added[table][id] = blankBuilding();
        else if (table === "weapons") all.added[table][id] = blankWeapon();
        else all.added[table][id] = blankActor(table === "creatures" ? "New creature" : "New unit");
        saveAll(all);
        return id;
    }

    function removeRow(table, id) {
        if (table === "units" && UNITS[id]) return;
        if (table === "buildings" && BUILDINGS[id]) return;
        if (table === "creatures" && CREATURES[id]) return;
        if (table === "weapons" && WEAPONS[id]) return;
        const all = loadAll();
        const rows = addedRaw(all, table);
        delete rows[id];
        all.added = all.added || {};
        all.added[table] = rows;
        saveAll(all);
    }

    window.AoeSheet = {
        read: units,
        write: writeUnits,
        units: units,
        writeUnits: writeUnits,
        figures: function () { return FIGURES; },
        mapHouses: function () { return MAP_HOUSES; },
        buildings: buildings,
        writeBuildings: writeBuildings,
        creatures: creatures,
        writeCreatures: writeCreatures,
        weapons: weapons,
        writeWeapons: writeWeapons,
        player: player,
        writePlayer: writePlayer,
        factions: factions,
        writeFactions: writeFactions,
        addFaction: addFaction,
        removeFaction: removeFaction,
        columns: columns,
        addColumn: addColumn,
        renameColumn: renameColumn,
        setColumn: setColumn,
        removeColumn: removeColumn,
        addRow: addRow,
        removeRow: removeRow
    };
})();
