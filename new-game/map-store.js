(function (global) {
    const SHIFT_C = 80;
    const SHIFT_R = 48;
    const COLS = 202 + SHIFT_C;
    const ROWS = 114 + SHIFT_R;
    const TILE = 60;
    const KEY = "rosiesgame.new-battle-map";
    const SHIFT_FLAG = "rosiesgame.new-battle-map-shift";
    const HALL_KEY = "rosiesgame.new-battle-halls";
    const HALL_IDS = ["blue", "red", "yellow", "purple"];
    let cachedRaw = null;
    let cachedTiles = null;
    let cachedHallRaw = null;
    let cachedHalls = null;

    function remember(raw, tiles) {
        cachedRaw = raw;
        cachedTiles = tiles;
        return tiles;
    }

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (cachedTiles && raw === cachedRaw) return cachedTiles;
            const data = raw ? JSON.parse(raw) : {};
            if (!data || typeof data !== "object" || Array.isArray(data)) return remember(raw, {});
            if (localStorage.getItem(SHIFT_FLAG) === "1") return remember(raw, data);
            const shifted = {};
            Object.keys(data).forEach(function (key) {
                const parts = key.split(",");
                const c = Number(parts[0]);
                const r = Number(parts[1]);
                if (!isFinite(c) || !isFinite(r)) return;
                shifted[(c + SHIFT_C) + "," + (r + SHIFT_R)] = data[key];
            });
            const next = JSON.stringify(shifted);
            localStorage.setItem(KEY, next);
            localStorage.setItem(SHIFT_FLAG, "1");
            return remember(next, shifted);
        } catch (err) {
            return {};
        }
    }

    const NODE_KEY = "rosiesgame.new-battle-nodes";
    const NODE_AMOUNT = 1000;
    let cachedNodeRaw = null;
    let cachedNodes = null;

    function loadNodes() {
        let raw = "";
        try {
            raw = localStorage.getItem(NODE_KEY) || "";
        } catch (err) {
            raw = "";
        }
        if (cachedNodes && raw === cachedNodeRaw) return cachedNodes;
        let nodes = {};
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object") nodes = parsed;
            } catch (err) {
                nodes = {};
            }
        }
        cachedNodeRaw = raw;
        cachedNodes = nodes;
        return nodes;
    }

    function saveNodes(nodes) {
        const raw = JSON.stringify(nodes);
        try {
            localStorage.setItem(NODE_KEY, raw);
        } catch (err) {
            return;
        }
        cachedNodeRaw = raw;
        cachedNodes = nodes;
    }

    function nodeKind(tiles, c, r) {
        const tile = kind(tiles, c, r);
        if (tile === "forest" || tile === "gold" || tile === "stone" || tile === "iron" || tile === "tin") return tile;
        return "";
    }

    function nodeLeft(tiles, c, r) {
        const tile = nodeKind(tiles, c, r);
        if (!tile) return 0;
        const row = loadNodes()[c + "," + r];
        if (!row || row.kind !== tile) return NODE_AMOUNT;
        return row.left;
    }

    function clearNode(c, r) {
        const nodes = loadNodes();
        const key = c + "," + r;
        if (!nodes[key]) return;
        delete nodes[key];
        saveNodes(nodes);
    }

    function takeNode(tiles, c, r, amount) {
        const tile = nodeKind(tiles, c, r);
        if (!tile || amount <= 0) return 0;
        const nodes = loadNodes();
        const key = c + "," + r;
        const row = nodes[key];
        let left = (!row || row.kind !== tile) ? NODE_AMOUNT : row.left;
        const taken = Math.min(amount, left);
        left -= taken;
        if (left <= 0) {
            delete nodes[key];
            delete tiles[key];
            save(tiles);
        } else {
            nodes[key] = { kind: tile, left: left };
        }
        saveNodes(nodes);
        return taken;
    }

    function save(tiles) {
        const raw = JSON.stringify(tiles);
        localStorage.setItem(KEY, raw);
        remember(raw, tiles);
    }

    function kind(tiles, c, r) {
        const value = tiles[c + "," + r];
        if (value === "water" || value === "forest" || value === "gold" || value === "stone" || value === "iron" || value === "tin" || value === "mountain" || value === "road") return value;
        return "grass";
    }

    function blocked(tiles, c, r) {
        const tile = kind(tiles, c, r);
        return tile !== "grass" && tile !== "road";
    }

    function defaultHalls() {
        return {
            blue: { c: 1 + SHIFT_C, r: 3 + SHIFT_R },
            red: { c: 18 + SHIFT_C, r: 3 + SHIFT_R }
        };
    }

    function loadHalls() {
        let raw = "";
        try {
            raw = localStorage.getItem(HALL_KEY) || "";
        } catch (err) {
            raw = "";
        }
        if (cachedHalls && raw === cachedHallRaw) return cachedHalls;
        const halls = defaultHalls();
        if (raw) {
            try {
                const data = JSON.parse(raw);
                HALL_IDS.forEach(function (id) {
                    const spot = data && data[id];
                    if (!spot || !isFinite(spot.c) || !isFinite(spot.r)) return;
                    halls[id] = { c: spot.c, r: spot.r };
                });
            } catch (err) {
                raw = "";
            }
        }
        cachedHallRaw = raw;
        cachedHalls = halls;
        return halls;
    }

    function saveHalls(spots) {
        const data = {};
        HALL_IDS.forEach(function (id) {
            const spot = spots && spots[id];
            if (!spot || !isFinite(spot.c) || !isFinite(spot.r)) return;
            data[id] = { c: spot.c, r: spot.r };
        });
        if (!data.blue) data.blue = defaultHalls().blue;
        if (!data.red) data.red = defaultHalls().red;
        const raw = JSON.stringify(data);
        cachedHallRaw = raw;
        cachedHalls = null;
        try {
            localStorage.setItem(HALL_KEY, raw);
        } catch (err) {
            return loadHalls();
        }
        return loadHalls();
    }

    function grassColor(c, r) {
        const n = (c * 17 + r * 5) % 4;
        if (n === 0) return "#7fbf45";
        if (n === 1) return "#74b43c";
        if (n === 2) return "#88c84e";
        return "#6aaa38";
    }

    function drawWater(ctx, c, r) {
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = (c + r) % 2 === 0 ? "#2a6eae" : "#24649f";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#3d88c8";
        ctx.fillRect(x + 8 + (r % 3) * 4, y + 16, 20, 5);
        ctx.fillRect(x + 28, y + 38, 16, 5);
        ctx.fillStyle = "#b7e4f2";
        ctx.fillRect(x + 10 + (r % 3) * 4, y + 16, 7, 2);
    }

    function drawForest(ctx, c, r) {
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = "#3c7634";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#2a5a28";
        ctx.fillRect(x + 6, y + 40, 48, 10);
        const shift = (c * 3 + r) % 2 === 0 ? 0 : 6;
        ctx.fillStyle = "#173e1c";
        ctx.beginPath();
        ctx.arc(x + 22 + shift, y + 28, 14, 0, Math.PI * 2);
        ctx.arc(x + 40 - shift, y + 34, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3f8a3c";
        ctx.beginPath();
        ctx.arc(x + 18 + shift, y + 24, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#6a4428";
        ctx.fillRect(x + 20 + shift, y + 36, 4, 14);
        ctx.fillRect(x + 38 - shift, y + 40, 4, 10);
    }

    function drawRock(ctx, c, r, body, chip) {
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = "#6aaa38";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 46);
        ctx.lineTo(x + 16, y + 22);
        ctx.lineTo(x + 30, y + 14);
        ctx.lineTo(x + 48, y + 24);
        ctx.lineTo(x + 54, y + 48);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = chip;
        ctx.fillRect(x + 22, y + 28, 7, 6);
        ctx.fillRect(x + 36, y + 34, 6, 5);
        ctx.fillRect(x + 18, y + 40, 5, 4);
    }

    function drawMountain(ctx, c, r) {
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = "#6a7a48";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#5c564e";
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 54);
        ctx.lineTo(x + 16, y + 22);
        ctx.lineTo(x + 30, y + 6);
        ctx.lineTo(x + 46, y + 24);
        ctx.lineTo(x + 58, y + 56);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#8d877c";
        ctx.beginPath();
        ctx.moveTo(x + 22, y + 30);
        ctx.lineTo(x + 30, y + 6);
        ctx.lineTo(x + 40, y + 28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#3c3834";
        ctx.fillRect(x + 12, y + 42, 9, 5);
        ctx.fillRect(x + 36, y + 46, 11, 5);
    }

    function roadMask(tiles, c, r) {
        const pathC = 7 + SHIFT_C;
        function joins(nc, nr) {
            if (tiles[nc + "," + nr] === "road") return true;
            return nc === pathC || nc === pathC + 1;
        }
        let mask = 0;
        if (joins(c, r - 1)) mask += 1;
        if (joins(c + 1, r)) mask += 2;
        if (joins(c, r + 1)) mask += 4;
        if (joins(c - 1, r)) mask += 8;
        return mask;
    }

    function drawRoad(ctx, c, r) {
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = (c + r) % 2 === 0 ? "#c6a15a" : "#b8924c";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "rgba(90, 60, 24, 0.22)";
        ctx.fillRect(x + 8 + (r % 3) * 4, y + 16, 14, 6);
        ctx.fillRect(x + 30, y + 38, 16, 6);
    }

    function drawGround(ctx, tiles, view) {
        const c0 = view ? view.c0 : 0;
        const r0 = view ? view.r0 : 0;
        const c1 = view ? view.c1 : COLS - 1;
        const r1 = view ? view.r1 : ROWS - 1;
        const px = view && view.zoom ? view.zoom * TILE : TILE;
        const near = px >= 20;
        const far = px < 8;

        if (near) {
            for (let r = r0; r <= r1; r++) {
                for (let c = c0; c <= c1; c++) {
                    ctx.fillStyle = grassColor(c, r);
                    ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
                }
            }
        } else {
            ctx.fillStyle = "#74b43c";
            ctx.fillRect(c0 * TILE, r0 * TILE, (c1 - c0 + 1) * TILE, (r1 - r0 + 1) * TILE);
        }

        ctx.fillStyle = "rgba(60, 94, 200, 0.14)";
        ctx.fillRect(SHIFT_C * TILE, r0 * TILE, 6 * TILE, (r1 - r0 + 1) * TILE);
        ctx.fillStyle = "rgba(196, 60, 60, 0.14)";
        ctx.fillRect((15 + SHIFT_C) * TILE, r0 * TILE, 6 * TILE, (r1 - r0 + 1) * TILE);

        const pathC = 7 + SHIFT_C;
        if (pathC <= c1 && pathC + 1 >= c0) {
            if (near) {
                for (let r = r0; r <= r1; r++) {
                    ctx.fillStyle = (r % 2 === 0) ? "#c6a15a" : "#b8924c";
                    ctx.fillRect(pathC * TILE, r * TILE, TILE * 2, TILE);
                    ctx.fillStyle = "rgba(90, 60, 24, 0.18)";
                    ctx.fillRect(pathC * TILE + 8, r * TILE + 18, 10, 6);
                    ctx.fillRect((pathC + 1) * TILE + 28, r * TILE + 36, 12, 6);
                }
            } else {
                ctx.fillStyle = "#c6a15a";
                ctx.fillRect(pathC * TILE, r0 * TILE, TILE * 2, (r1 - r0 + 1) * TILE);
            }
        }

        if (near) {
            for (let r = r0; r <= r1; r++) {
                for (let c = c0; c <= c1; c++) {
                    if ((c * 13 + r * 7) % 11 !== 0) continue;
                    if (c >= pathC && c <= pathC + 1) continue;
                    const x = c * TILE + 18;
                    const y = r * TILE + 22;
                    ctx.fillStyle = "#3d7a28";
                    ctx.fillRect(x + 3, y, 2, 8);
                    ctx.fillStyle = "#f2e27a";
                    ctx.fillRect(x, y - 2, 4, 4);
                    ctx.fillRect(x + 5, y - 2, 4, 4);
                }
            }
        }

        const flat = {
            water: "#2a6eae",
            forest: "#2f6a32",
            mountain: "#5c564e",
            road: "#c6a15a",
            gold: "#e6c14a",
            stone: "#8d939a",
            iron: "#c45a32",
            tin: "#9bb7c4"
        };
        Object.keys(tiles).forEach(function (key) {
            const parts = key.split(",");
            const c = Number(parts[0]);
            const r = Number(parts[1]);
            if (c < c0 || r < r0 || c > c1 || r > r1) return;
            if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
            const x = c * TILE;
            const y = r * TILE;
            if (far) {
                ctx.fillStyle = flat[tiles[key]] || "#74b43c";
                ctx.fillRect(x, y, TILE, TILE);
            } else if (tiles[key] === "water") {
                if (near && global.BattleArt && global.BattleArt.drawWater(ctx, c, r)) return;
                drawWater(ctx, c, r);
            } else if (tiles[key] === "forest") {
                ctx.fillStyle = grassColor(c, r);
                ctx.fillRect(x, y, TILE, TILE);
                if (near && global.BattleArt && global.BattleArt.drawTree(ctx, c, r)) return;
                drawForest(ctx, c, r);
            } else if (tiles[key] === "gold") drawRock(ctx, c, r, "#6a5a40", "#e6c14a");
            else if (tiles[key] === "stone") drawRock(ctx, c, r, "#8d939a", "#d5dde4");
            else if (tiles[key] === "iron") drawRock(ctx, c, r, "#4e4542", "#c45a32");
            else if (tiles[key] === "tin") drawRock(ctx, c, r, "#6f8f9a", "#d7e6ee");
            else if (tiles[key] === "mountain") drawMountain(ctx, c, r);
            else if (tiles[key] === "road") {
                if (far || !global.BattleArt || !global.BattleArt.drawRoad(ctx, c, r, roadMask(tiles, c, r))) drawRoad(ctx, c, r);
            }
        });
    }

    global.BattleMap = {
        COLS: COLS,
        ROWS: ROWS,
        TILE: TILE,
        SHIFT_C: SHIFT_C,
        SHIFT_R: SHIFT_R,
        load: load,
        save: save,
        kind: kind,
        blocked: blocked,
        drawGround: drawGround,
        loadHalls: loadHalls,
        saveHalls: saveHalls,
        nodeLeft: nodeLeft,
        clearNode: clearNode,
        takeNode: takeNode
    };
})(window);
