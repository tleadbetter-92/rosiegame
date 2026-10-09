(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.Interior = api;
})(typeof self !== "undefined" ? self : this, function () {
    function hash(i, j) {
        let n = Math.imul((i | 0) + 19, 374761393) + Math.imul((j | 0) + 7, 668265263);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    }

    function idNum(id) {
        let n = 0;
        const text = String(id);
        for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
        return n >>> 0;
    }

    function shell(w, d, h) {
        const t = 0.2;
        const door = 1.4;
        const cx = w * 0.5;
        const boxes = [];
        const solids = [];
        const add = (tex, x, y, z, ww, hh, dd) => boxes.push({ tex, x, y, z, w: ww, h: hh, d: dd });
        const wall = (x, z, ww, dd) => {
            add("plaster", x, 0, z, ww, h, dd);
            solids.push({ x, z, w: ww, d: dd, y0: 0, y1: h });
        };
        add("wood", 0, -0.08, 0, w, 0.08, d);
        add("plaster", 0, h, 0, w, 0.1, d);
        wall(0, d - t, w, t);
        wall(0, 0, cx - door * 0.5, t);
        wall(cx + door * 0.5, 0, w - (cx + door * 0.5), t);
        wall(0, 0, t, d);
        wall(w - t, 0, t, d);
        add("wood", cx - door * 0.5 - 0.12, 0, -0.04, 0.12, 2.35, 0.22);
        add("wood", cx + door * 0.5, 0, -0.04, 0.12, 2.35, 0.22);
        add("wood", cx - door * 0.5, 2.2, -0.02, door, 0.16, 0.18);
        return {
            w: w,
            d: d,
            h: h,
            props: [],
            boxes: boxes,
            solids: solids,
            floors: [{ x: 0.25, z: 0.25, w: w - 0.5, d: d - 0.5, y: 0 }],
            spawn: { x: cx, y: 1.62, z: 1.15, yaw: Math.PI },
            exit: { x: cx, z: 0.9, r: 0.95 }
        };
    }

    function place(plan, name, x, y, z, yaw, block) {
        plan.props.push({ name, x, y, z, yaw: yaw || 0, block: block !== false });
    }

    function hearth(plan, x, z) {
        plan.boxes.push({ tex: "rock", x: x, y: 0, z: z, w: 1.15, h: 0.42, d: 0.7 });
        plan.solids.push({ x: x, z: z, w: 1.15, d: 0.7, y0: 0, y1: 0.42 });
        place(plan, "Cauldron", x + 0.1, 0.42, z - 0.15, 0.4, true);
        place(plan, "Candle_1", x + 0.15, 0.84, z + 0.15, 0, false);
        place(plan, "Pot_1", x + 1.2, 0, z + 0.05, 0.6, true);
    }

    function housePoor(id) {
        const plan = shell(6.2, 5.2, 3.0);
        const side = hash(idNum(id), 3) > 0.5 ? 1 : 0;
        place(plan, "Bed_Twin1", side ? 3.7 : 0.45, 0, 2.5, Math.PI / 2, true);
        place(plan, "Chest_Wood", side ? 0.4 : 4.5, 0, 4.15, 0.2, true);
        place(plan, "Stool", 2.3, 0, 2.15, 0.4, true);
        place(plan, "Nightstand_Shelf", 1.3, 0, 0.85, 0, true);
        place(plan, "Mug", 1.55, 1.22, 1.0, 0, false);
        hearth(plan, 4.7, 4.2);
        return plan;
    }

    function houseModest(id) {
        const plan = shell(7.6, 6.2, 3.05);
        const flip = hash(idNum(id), 4) > 0.5;
        place(plan, "Bed_Twin1", flip ? 0.4 : 5.15, 0, 3.3, Math.PI / 2, true);
        place(plan, "Nightstand_Shelf", flip ? 2.35 : 4.35, 0, 4.55, 0, true);
        place(plan, "Candle_1", flip ? 2.55 : 4.55, 1.22, 4.7, 0, false);
        place(plan, "Table_Large", 0.7, 0, 1.7, 0, true);
        place(plan, "Chair_1", 1.5, 0, 2.95, Math.PI, true);
        place(plan, "Chest_Wood", flip ? 5.9 : 0.35, 0, 0.7, 0.3, true);
        place(plan, "Shelf_Simple", 0.55, 1.35, 5.7, 0, true);
        place(plan, "Book_Stack_1", 0.7, 1.62, 5.72, 0.2, false);
        place(plan, "Mug", 1.6, 0.82, 2.05, 0, false);
        place(plan, "Bottle_1", 2.1, 0.82, 2.15, 0, false);
        hearth(plan, flip ? 0.4 : 6.1, 5.15);
        return plan;
    }

    function houseComfort(id) {
        const plan = shell(8.4, 6.8, 3.15);
        const n = hash(idNum(id), 5);
        place(plan, "Bed_Twin2", n > 0.5 ? 0.45 : 5.9, 0, 3.6, Math.PI / 2, true);
        place(plan, "Nightstand_Shelf", n > 0.5 ? 2.5 : 5.05, 0, 5.15, 0, true);
        place(plan, "CandleStick", n > 0.5 ? 2.7 : 5.25, 1.22, 5.28, 0, false);
        place(plan, "Table_Large", 0.85, 0, 1.85, 0, true);
        place(plan, "Chair_1", 1.55, 0, 3.1, Math.PI, true);
        place(plan, "Chair_1", 2.7, 0, 1.15, 0, true);
        place(plan, "Cabinet", 6.7, 0, 0.55, 0, true);
        place(plan, "Bookcase_2", 0.4, 0, 4.55, 0, true);
        place(plan, "Chest_Wood", 6.6, 0, 5.7, 0.4, true);
        place(plan, "Shelf_Simple", 3.4, 1.45, 6.35, 0, true);
        place(plan, "Book_Stack_1", 3.55, 1.72, 6.38, 0.3, false);
        place(plan, "Mug", 1.7, 0.82, 2.2, 0, false);
        place(plan, "Candle_1", 2.4, 0.82, 2.25, 0, false);
        hearth(plan, 7.0, 5.7);
        return plan;
    }

    function shop(id) {
        const wide = hash(idNum(id), 2) > 0.5;
        const plan = shell(wide ? 10 : 9.2, 7.4, 3.2);
        place(plan, "Table_Large", 3.1, 0, 3.15, Math.PI / 2, true);
        place(plan, "Shelf_Arch", 0.45, 0, plan.d - 0.85, 0, true);
        place(plan, "Shelf_Simple", 2.3, 1.4, plan.d - 0.55, 0, true);
        place(plan, "Shelf_Small_Bottles", 4.3, 1.15, plan.d - 0.55, 0, true);
        place(plan, "Bookcase_2", plan.w - 1.85, 0, plan.d - 0.85, 0, true);
        place(plan, "Crate_Wooden", 0.35, 0, 0.45, 0.2, true);
        place(plan, "Crate_Wooden", 1.5, 0, 0.5, 0.8, true);
        place(plan, "Barrel", plan.w - 1.15, 0, 0.45, 0, true);
        place(plan, "Barrel", plan.w - 1.15, 0, 1.25, 0.5, true);
        place(plan, "Chest_Wood", plan.w - 1.7, 0, 2.3, 0, true);
        place(plan, "Bag", 0.4, 0, 1.9, 0.7, true);
        place(plan, "FarmCrate_Apple", 2.15, 0.82, 3.35, 0.4, false);
        place(plan, "Potion_1", 4.55, 1.75, plan.d - 0.62, 0, false);
        place(plan, "Bottle_1", 4.85, 1.75, plan.d - 0.58, 0, false);
        place(plan, "Mug", 3.55, 0.82, 3.55, 0, false);
        place(plan, "CandleStick", 3.9, 0.82, 2.85, 0, false);
        return plan;
    }

    function tavern(id) {
        const plan = shell(12, 9.2, 5.15);
        const shift = hash(idNum(id), 6) > 0.5 ? 0.6 : 0;
        place(plan, "Table_Large", 1.1, 0, 2.4 + shift, 0, true);
        place(plan, "Bench", 1.15, 0, 3.55 + shift, Math.PI, true);
        place(plan, "Stool", 4.05, 0, 2.55 + shift, 0.5, true);
        place(plan, "Table_Large", 1.2, 0, 5.3, 0, true);
        place(plan, "Bench", 1.25, 0, 6.45, Math.PI, true);
        place(plan, "Chair_1", 4.15, 0, 5.55, 1.2, true);
        place(plan, "Workbench", 7.6, 0, 7.55, Math.PI, true);
        place(plan, "Barrel", 10.3, 0, 7.7, 0.4, true);
        place(plan, "Barrel", 10.95, 0, 7.15, 1, true);
        place(plan, "Bottle_1", 8.3, 0.9, 7.7, 0, false);
        place(plan, "Mug", 8.7, 0.9, 7.85, 0.4, false);
        place(plan, "Mug", 1.8, 0.82, 2.7 + shift, 0, false);
        place(plan, "CandleStick", 2.5, 0.82, 2.85 + shift, 0, false);
        place(plan, "Mug", 2.0, 0.82, 5.6, 0.2, false);
        place(plan, "Bottle_1", 2.6, 0.82, 5.7, 0, false);
        hearth(plan, 10.4, 0.55);
        place(plan, "Stool", 6.3, 0, 7.15, Math.PI, true);
        place(plan, "Stool", 7.15, 0, 6.7, 1.1, true);
        const steps = 7;
        const rise = 2.55 / steps;
        const run = 0.46;
        for (let i = 0; i < steps; i++) {
            const x = 4.55 + i * run;
            plan.boxes.push({ tex: "wood", x: x, y: 0, z: 0.55, w: run, h: (i + 1) * rise, d: 1.7 });
            plan.floors.push({ x: x, z: 0.55, w: run, d: 1.7, y: (i + 1) * rise });
        }
        plan.boxes.push({ tex: "wood", x: 7.75, y: 2.55, z: 0.45, w: 3.95, h: 0.1, d: 8.4 });
        plan.floors.push({ x: 7.8, z: 2.35, w: 3.85, d: 6.4, y: 2.65 });
        plan.solids.push({ x: 7.8, z: 2.25, w: 3.9, d: 0.16, y0: 2.65, y1: 3.7 });
        plan.boxes.push({ tex: "wood", x: 7.8, y: 2.65, z: 2.25, w: 3.9, h: 0.08, d: 0.16 });
        place(plan, "Bed_Twin1", 8.15, 2.65, 4.3, Math.PI / 2, true);
        place(plan, "Bed_Twin2", 8.15, 2.65, 6.5, Math.PI / 2, true);
        place(plan, "Chest_Wood", 10.35, 2.65, 3.3, 0.2, true);
        place(plan, "Candle_1", 10.5, 3.37, 3.5, 0, false);
        return plan;
    }

    function layout(kind, id) {
        const roll = hash(idNum(id), 1);
        if (kind === "house") {
            if (roll < 0.2) return housePoor(id);
            if (roll < 0.55) return houseModest(id);
            return houseComfort(id);
        }
        if (kind === "shop") return shop(id);
        if (kind === "tavern") return tavern(id);
        return null;
    }

    return { layout, hash, idNum };
});
