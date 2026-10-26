(function () {
    const canvas = document.getElementById("stage");
    const ctx = canvas.getContext("2d");
    const editorView = BattleView(canvas);
    const statusEl = document.getElementById("status");
    const TILE = BattleMap.TILE;
    const COLS = BattleMap.COLS;
    const ROWS = BattleMap.ROWS;
    const halls = [
        { c: 1 + BattleMap.SHIFT_C, r: 3 + BattleMap.SHIFT_R, name: "Blue", color: "#3c5ec8", dark: "#243880" },
        { c: 18 + BattleMap.SHIFT_C, r: 3 + BattleMap.SHIFT_R, name: "Red", color: "#c43c3c", dark: "#7a2424" }
    ];

    let tiles = BattleMap.load();
    let brush = "water";
    let painting = false;
    let hover = null;

    function isHall(c, r) {
        return halls.some(function (hall) {
            return c >= hall.c && c < hall.c + 2 && r >= hall.r && r < hall.r + 2;
        });
    }

    function counts() {
        let water = 0;
        let forest = 0;
        let gold = 0;
        let stone = 0;
        let iron = 0;
        Object.keys(tiles).forEach(function (key) {
            if (tiles[key] === "water") water += 1;
            else if (tiles[key] === "forest") forest += 1;
            else if (tiles[key] === "gold") gold += 1;
            else if (tiles[key] === "stone") stone += 1;
            else if (tiles[key] === "iron") iron += 1;
        });
        return water + " water, " + forest + " forest, " + gold + " gold, " + stone + " stone, " + iron + " iron";
    }

    function paint(c, r) {
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
        if (isHall(c, r)) return;
        const key = c + "," + r;
        if (brush === "grass") delete tiles[key];
        else tiles[key] = brush;
        BattleMap.save(tiles);
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
        painting = true;
        canvas.setPointerCapture(event.pointerId);
        const tile = tileFromEvent(event);
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
        if (!window.confirm("Clear all water and forest?")) return;
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

        if (view.c1 - view.c0 < 48) {
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

        halls.forEach(drawHall);

        if (hover && hover.c >= 0 && hover.r >= 0 && hover.c < COLS && hover.r < ROWS) {
            ctx.strokeStyle = isHall(hover.c, hover.r) ? "#e05040" : "#f4f0d8";
            ctx.lineWidth = 3;
            ctx.strokeRect(hover.c * TILE + 2, hover.r * TILE + 2, TILE - 4, TILE - 4);
        }

        const names = { gold: "gold mine", stone: "stone mine", iron: "iron mine" };
        const label = names[brush] || brush;
        statusEl.textContent = "Painting " + label + ". " + counts()
            + ". Scroll the wheel to zoom. Arrow keys or WASD move the view. Soldiers cannot walk on water, forest, or mines. Workers gather food, wood, gold, stone, and iron from them. Settlement squares stay as they are.";
        requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
})();
