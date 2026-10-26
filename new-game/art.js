(function (global) {
    const PACK = "Pixel Crawler - Free Pack/";
    const TILE = global.BattleMap.TILE;

    function load(path) {
        const img = new Image();
        img.src = PACK + path.split("/").map(function (part) {
            return encodeURIComponent(part);
        }).join("/");
        return img;
    }

    function loadRoot(path) {
        const img = new Image();
        img.src = path.split("/").map(function (part) {
            return encodeURIComponent(part);
        }).join("/");
        return img;
    }

    const ART = "free-buildings/kenney-medieval-rts/PNG/Default size/";
    const hall = loadRoot(ART + "Structure/medievalStructure_06.png");
    const house = loadRoot(ART + "Structure/medievalStructure_17.png");
    const tower = loadRoot(ART + "Structure/medievalStructure_12.png");
    const mill = loadRoot(ART + "Structure/medievalStructure_08.png");
    const blades = [
        loadRoot(ART + "Structure/medievalStructure_13.png"),
        loadRoot(ART + "Structure/medievalStructure_14.png"),
        loadRoot(ART + "Structure/medievalStructure_15.png")
    ];
    const roadFiles = {
        0: "02", 1: "34", 2: "33", 3: "31", 4: "35", 5: "03", 6: "17", 7: "21",
        8: "19", 9: "32", 10: "04", 11: "07", 12: "18", 13: "20", 14: "06", 15: "05"
    };
    const roads = {};
    Object.keys(roadFiles).forEach(function (mask) {
        roads[mask] = loadRoot(ART + "Tile/medievalTile_" + roadFiles[mask] + ".png");
    });

    const knight = load("Entities/Npc's/Knight/Run/Run-Sheet.png");
    const rogue = load("Entities/Npc's/Rogue/Run/Run-Sheet.png");
    const peasant = load("Entities/Npc's/Citizen_F/Peasant_A/Walk/Walk-Sheet.png");
    const heroDown = load("Entities/Characters/Body_A/Animations/Walk_Base/Walk_Down-Sheet.png");
    const heroSide = load("Entities/Characters/Body_A/Animations/Walk_Base/Walk_Side-Sheet.png");
    const pines = load("Environment/Props/Static/Trees/Model_02/Size_02.png");
    const water = load("Environment/Tilesets/Water_tiles.png");
    const tinted = document.createElement("canvas");
    tinted.width = 64;
    tinted.height = 64;
    const tintCtx = tinted.getContext("2d");

    function ready(img) {
        return img.complete && img.naturalWidth > 0;
    }

    function paint(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, flip, tint) {
        if (!ready(img)) return false;
        ctx.imageSmoothingEnabled = false;
        if (tint) {
            tintCtx.setTransform(1, 0, 0, 1, 0, 0);
            tintCtx.clearRect(0, 0, 64, 64);
            tintCtx.imageSmoothingEnabled = false;
            tintCtx.globalCompositeOperation = "source-over";
            tintCtx.drawImage(img, sx, sy, sw, sh, 0, 0, 64, 64);
            tintCtx.globalCompositeOperation = "source-atop";
            tintCtx.fillStyle = tint;
            tintCtx.fillRect(0, 0, 64, 64);
            tintCtx.globalCompositeOperation = "source-over";
            img = tinted;
            sx = 0;
            sy = 0;
            sw = 64;
            sh = 64;
        }
        if (flip) {
            ctx.save();
            ctx.translate(dx + dw, dy);
            ctx.scale(-1, 1);
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
            ctx.restore();
        } else {
            ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        }
        return true;
    }

    function drawFit(ctx, img, x, y, w, h) {
        if (!ready(img)) return false;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, x, y, w, h);
        ctx.imageSmoothingEnabled = false;
        return true;
    }

    function drawOpaque(ctx, img, sx, sy, sw, sh, x, y, dw, dh) {
        if (!ready(img) || sw <= 0 || sh <= 0) return false;
        const scale = Math.min(dw / sw, dh / sh);
        const pw = sw * scale;
        const ph = sh * scale;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, sx, sy, sw, sh, x + (dw - pw) / 2, y + dh - ph, pw, ph);
        ctx.imageSmoothingEnabled = false;
        return true;
    }

    function drawHall(ctx, x, y, w, h) {
        return drawOpaque(ctx, hall, 2, 0, 60, 38, x, y, w, h || w);
    }

    function drawHouse(ctx, x, y, w, h) {
        return drawOpaque(ctx, house, 10, 2, 44, 60, x, y, w, h || w);
    }

    function drawTower(ctx, x, y, w, h) {
        return drawOpaque(ctx, tower, 22, 14, 20, 36, x, y, w, h || w);
    }

    function drawMill(ctx, x, y, w, h, time) {
        const height = h || w;
        if (!drawFit(ctx, mill, x, y, w, height)) return false;
        const blade = blades[Math.floor(time / 180) % blades.length];
        drawFit(ctx, blade, x, y, w, height);
        return true;
    }

    function drawRoad(ctx, c, r, mask) {
        return drawFit(ctx, roads[mask] || roads[0], c * TILE, r * TILE, TILE, TILE);
    }

    function drawWater(ctx, c, r) {
        return paint(ctx, water, 32, 112, 16, 16, c * TILE, r * TILE, TILE, TILE, false);
    }

    function drawTree(ctx, c, r) {
        const col = Math.abs(c + r * 3) % 4;
        const dw = 26;
        const dh = 70;
        return paint(
            ctx,
            pines,
            col * 32,
            0,
            32,
            96,
            c * TILE + (TILE - dw) / 2,
            r * TILE + TILE - dh + 8,
            dw,
            dh,
            false
        );
    }

    function drawPerson(ctx, soldier, faction, pos, left, time) {
        const moving = !!(soldier.step);
        const frame = Math.floor(time / (moving ? 110 : 240)) % 6;
        let img = knight;
        let tint = null;
        let flip = left;
        if (soldier.role === "worker") {
            img = peasant;
            tint = faction && faction.id === "red" ? "rgba(190, 40, 40, 0.38)" : "rgba(36, 74, 190, 0.32)";
        } else if (soldier.role === "archer") {
            img = rogue;
            tint = faction && faction.id === "red" ? "rgba(190, 40, 40, 0.35)" : "rgba(36, 74, 190, 0.28)";
        } else if (soldier.role === "player") {
            const sideways = soldier.step && soldier.step.toC !== soldier.step.fromC;
            img = sideways ? heroSide : heroDown;
            flip = sideways ? soldier.step.toC < soldier.step.fromC : left;
        } else if (faction && faction.id === "red") {
            tint = "rgba(210, 36, 36, 0.5)";
        } else {
            tint = "rgba(36, 78, 210, 0.28)";
        }
        const dw = 58;
        const dh = 58;
        const dx = pos.c * TILE + (TILE - dw) / 2 + (soldier.flash > 0 ? (flip ? -4 : 4) : 0);
        const dy = pos.r * TILE + TILE - dh + 4;
        return paint(ctx, img, frame * 64, 0, 64, 64, dx, dy, dw, dh, flip, tint);
    }

    global.BattleArt = {
        drawWater: drawWater,
        drawTree: drawTree,
        drawPerson: drawPerson,
        drawHall: drawHall,
        drawHouse: drawHouse,
        drawTower: drawTower,
        drawMill: drawMill,
        drawRoad: drawRoad
    };
})(window);
