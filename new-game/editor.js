(function () {
    const canvas = document.getElementById("stage");
    const ctx = canvas.getContext("2d");
    const editorView = BattleView(canvas);
    const statusEl = document.getElementById("status");
    const TILE = BattleMap.TILE;
    const COLS = BattleMap.COLS;
    const ROWS = BattleMap.ROWS;
    const LOOK = {
        blue: { name: "Blue", color: "#3c5ec8", dark: "#243880" },
        red: { name: "Red", color: "#c43c3c", dark: "#7a2424" },
        yellow: { name: "Yellow", color: "#d4a017", dark: "#8a6410" },
        purple: { name: "Purple", color: "#7a4ea3", dark: "#4c2d6b" }
    };

    let tiles = BattleMap.load();
    let hallSpots = BattleMap.loadHalls();
    let brush = "water";
    let brushSize = 1;
    let painting = false;
    let hover = null;
    let placeNote = "";

    const HALL_W = 3;
    const HALL_H = 2;

    function hallList() {
        return Object.keys(LOOK).map(function (id) {
            const spot = hallSpots[id];
            if (!spot) return null;
            return {
                id: id,
                c: spot.c,
                r: spot.r,
                name: LOOK[id].name,
                color: LOOK[id].color,
                dark: LOOK[id].dark
            };
        }).filter(Boolean);
    }

    function isHall(c, r, ignoreId) {
        return hallList().some(function (hall) {
            if (hall.id === ignoreId) return false;
            return c >= hall.c && c < hall.c + HALL_W && r >= hall.r && r < hall.r + HALL_H;
        });
    }

    function hallBrush() {
        return brush.indexOf("hall:") === 0 ? brush.slice(5) : "";
    }

    function stampHall(c, r) {
        const id = hallBrush();
        if (!id || !LOOK[id]) return;
        if (c < 0 || r < 0 || c + HALL_W > COLS || r + HALL_H > ROWS) {
            placeNote = LOOK[id].name + " needs a 3 by 2 that stays on the map.";
            return;
        }
        for (let dc = 0; dc < HALL_W; dc++) {
            for (let dr = 0; dr < HALL_H; dr++) {
                if (BattleMap.blocked(tiles, c + dc, r + dr) || isHall(c + dc, r + dr, id)) {
                    placeNote = LOOK[id].name + " needs 3 by 2 open grass or road, clear of the other towns.";
                    return;
                }
            }
        }
        hallSpots[id] = { c: c, r: r };
        hallSpots = BattleMap.saveHalls(hallSpots);
        placeNote = LOOK[id].name + " settlement is placed. The battle keeps going and picks it up.";
    }

    function counts() {
        let water = 0;
        let forest = 0;
        let gold = 0;
        let stone = 0;
        let iron = 0;
        let tin = 0;
        let mountain = 0;
        let road = 0;
        Object.keys(tiles).forEach(function (key) {
            if (tiles[key] === "water") water += 1;
            else if (tiles[key] === "forest") forest += 1;
            else if (tiles[key] === "gold") gold += 1;
            else if (tiles[key] === "stone") stone += 1;
            else if (tiles[key] === "iron") iron += 1;
            else if (tiles[key] === "tin") tin += 1;
            else if (tiles[key] === "mountain") mountain += 1;
            else if (tiles[key] === "road") road += 1;
        });
        return water + " water, " + forest + " forest, " + gold + " gold, " + stone + " stone, " + iron + " iron, " + tin + " tin, "
            + mountain + " mountain, " + road + " road";
    }

    function paintOne(c, r) {
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
        if (isHall(c, r)) return false;
        const key = c + "," + r;
        if (brush === "grass") {
            BattleMap.clearNode(c, r);
            if (!tiles[key]) return false;
            delete tiles[key];
            return true;
        }
        if (tiles[key] === brush) {
            BattleMap.clearNode(c, r);
            return false;
        }
        tiles[key] = brush;
        BattleMap.clearNode(c, r);
        return true;
    }

    function paint(c, r) {
        const half = Math.floor(brushSize / 2);
        let changed = false;
        for (let dr = -half; dr <= half; dr++) {
            for (let dc = -half; dc <= half; dc++) {
                if (paintOne(c + dc, r + dr)) changed = true;
            }
        }
        if (changed) BattleMap.save(tiles);
    }

    function tileFromEvent(event) {
        return editorView.tileFromEvent(event);
    }

    canvas.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;
        if (!event.isPrimary || editorView.fingers() > 1) {
            painting = false;
            return;
        }
        const tile = tileFromEvent(event);
        if (hallBrush()) {
            stampHall(tile.c, tile.r);
            return;
        }
        painting = true;
        canvas.setPointerCapture(event.pointerId);
        paint(tile.c, tile.r);
    });

    canvas.addEventListener("pointermove", function (event) {
        if (editorView.fingers() > 1) {
            painting = false;
            return;
        }
        hover = tileFromEvent(event);
        if (!painting || !event.isPrimary) return;
        paint(hover.c, hover.r);
    });

    canvas.addEventListener("pointerup", function () {
        painting = false;
    });

    canvas.addEventListener("pointerleave", function () {
        hover = null;
        painting = false;
    });

    document.querySelectorAll(".size").forEach(function (button) {
        button.addEventListener("click", function () {
            brushSize = Number(button.dataset.size) || 1;
            document.querySelectorAll(".size").forEach(function (other) {
                other.classList.toggle("on", other === button);
            });
        });
    });

    document.querySelectorAll(".brush").forEach(function (button) {
        button.addEventListener("click", function () {
            brush = button.dataset.kind;
            document.querySelectorAll(".brush").forEach(function (other) {
                other.classList.toggle("on", other === button);
            });
        });
    });

    document.getElementById("clear").addEventListener("click", function () {
        if (!Object.keys(tiles).length) return;
        if (!window.confirm("Clear every painted tile?")) return;
        tiles = {};
        BattleMap.save(tiles);
    });

    function drawHall(hall) {
        const x = hall.c * TILE;
        const y = hall.r * TILE;
        const w = TILE * 2;
        ctx.fillStyle = "#1a2410";
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 52);
        ctx.lineTo(x + w / 2, y + 10);
        ctx.lineTo(x + w - 8, y + 52);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = hall.color;
        ctx.beginPath();
        ctx.moveTo(x + 16, y + 50);
        ctx.lineTo(x + w / 2, y + 18);
        ctx.lineTo(x + w - 16, y + 50);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#efe6cf";
        ctx.fillRect(x + 18, y + 50, w - 36, 58);
        ctx.fillStyle = hall.dark;
        ctx.fillRect(x + w / 2 - 12, y + 74, 24, 34);
        ctx.fillStyle = "#1a2410";
        ctx.font = "700 16px Segoe UI, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(hall.name, x + w / 2, y - 8);
    }

    let fitted = false;

    function draw() {
        if (!fitted) {
            fitted = true;
            editorView.ensure();
        }
        const view = editorView.beginFrame(ctx);
        BattleMap.drawGround(ctx, tiles, view);

        if ((view.zoom || 1) * TILE >= 20) {
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

        hallList().forEach(function (hall) {
            if (hall.c + HALL_W - 1 < view.c0 || hall.c > view.c1 || hall.r + HALL_H - 1 < view.r0 || hall.r > view.r1) return;
            if ((view.zoom || 1) * TILE < 8) {
                ctx.fillStyle = hall.color;
                ctx.fillRect(hall.c * TILE, hall.r * TILE, TILE * HALL_W, TILE * HALL_H);
                return;
            }
            if (window.BattleArt && BattleArt.drawHall(ctx, hall.c * TILE, hall.r * TILE, TILE * HALL_W, TILE * HALL_H)) {
                ctx.fillStyle = hall.color;
                ctx.fillRect(hall.c * TILE + TILE * HALL_W / 2 - 10, hall.r * TILE + 8, 20, 16);
                return;
            }
            drawHall(hall);
        });

        if (hallBrush() && hover && hover.c >= 0 && hover.r >= 0) {
            ctx.strokeStyle = LOOK[hallBrush()].color;
            ctx.lineWidth = 3;
            ctx.strokeRect(hover.c * TILE + 2, hover.r * TILE + 2, TILE * HALL_W - 4, TILE * HALL_H - 4);
        }

        if (!hallBrush() && hover && hover.c >= 0 && hover.r >= 0 && hover.c < COLS && hover.r < ROWS) {
            const half = Math.floor(brushSize / 2);
            const left = Math.max(0, hover.c - half);
            const top = Math.max(0, hover.r - half);
            const right = Math.min(COLS, hover.c + half + 1);
            const bottom = Math.min(ROWS, hover.r + half + 1);
            ctx.strokeStyle = "#f4f0d8";
            ctx.lineWidth = 3;
            ctx.strokeRect(left * TILE + 2, top * TILE + 2, (right - left) * TILE - 4, (bottom - top) * TILE - 4);
        }

        const names = {
            gold: "gold mine",
            stone: "stone mine",
            iron: "iron mine",
            tin: "tin mine",
            mountain: "mountain",
            road: "road",
            "hall:yellow": "the Yellow settlement",
            "hall:purple": "the Purple settlement",
            "hall:blue": "the Blue settlement",
            "hall:red": "the Red settlement"
        };
        const label = names[brush] || brush;
        const doing = hallBrush()
            ? "Placing " + label + ". Click the top-left square of a free 3 by 2."
            : "Painting " + label + " with a " + brushSize + " by " + brushSize + " brush.";
        statusEl.textContent = (placeNote ? placeNote + " " : "") + doing + " " + counts()
            + ". Yellow and Purple join the battle when placed. Blue and Red can be moved. Water, forest, mines, and mountains stay blocked.";
        requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
})();
