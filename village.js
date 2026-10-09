const canvas = document.getElementById("view");
const gl = canvas.getContext("webgl", { antialias: false, alpha: false });

if (!gl) {
    document.querySelector(".help").textContent = "This browser cannot show the village.";
}

const places = World.places;
const cam = { x: places[2].ox, y: 1.62, z: places[2].oz + 20, yaw: 0, pitch: 0 };
const homeVillage = 2;
const townLeash = 30;
const player = { hp: 40, max: 40, guard: 0, dead: 0, shake: 0 };
const keys = {};
const housePlan = [
    { x: -10, z: 3, w: 6, d: 5, h: 3.1, rise: 1.5, door: "e" },
    { x: 4, z: 3, w: 6, d: 5, h: 3.3, rise: 1.7, door: "w" },
    { x: -11, z: -5.2, w: 6, d: 5, h: 3.0, rise: 1.4, door: "e" },
    { x: 5, z: -5.2, w: 5.5, d: 5, h: 3.2, rise: 1.6, door: "w" },
    { x: -12, z: -16, w: 8, d: 5.5, h: 3.5, rise: 1.8, door: "s" },
    { x: 4, z: -16, w: 7, d: 5.5, h: 3.2, rise: 1.5, door: "s" }
];
const houses = [];
let cottage = null;
const homeKinds = ["manor", "barracks", "smith", "shop", "stores", "tavern"];
const homeDoors = ["east", "west", "east", "west", "south", "south"];
const homeRise = [1.9, 1.5, 1.35, 1.45, 1.6, 1.7];
for (const place of places) {
    housePlan.forEach((house, index) => {
        const village = places.indexOf(place);
        houses.push({
            x: house.x + place.ox,
            z: house.z + place.oz,
            w: house.w,
            d: house.d,
            h: 5.2,
            rise: homeRise[index],
            door: house.door,
            store: house === housePlan[4],
            open: true,
            entrance: index === 4 && village !== 2 ? "north" : homeDoors[index],
            kind: homeKinds[index],
            parts: [],
            village,
            decks: [],
            nap: []
        });
    });
}

function makeTexture(draw) {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    draw(c.getContext("2d"), 64);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
}

function speck(g, s, count, a, b) {
    for (let i = 0; i < count; i++) {
        g.fillStyle = Math.random() < 0.5 ? a : b;
        g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 2, 2);
    }
}

const textures = {
    grass: makeTexture((g, s) => {
        g.fillStyle = "#4d7a3c";
        g.fillRect(0, 0, s, s);
        speck(g, s, 320, "rgba(30,70,24,0.45)", "rgba(150,190,90,0.35)");
    }),
    dirt: makeTexture((g, s) => {
        g.fillStyle = "#8b7044";
        g.fillRect(0, 0, s, s);
        speck(g, s, 280, "rgba(70,48,24,0.4)", "rgba(196,164,110,0.35)");
    }),
    sand: makeTexture((g, s) => {
        g.fillStyle = "#c6a56a";
        g.fillRect(0, 0, s, s);
        speck(g, s, 240, "rgba(150,110,60,0.35)", "rgba(230,210,160,0.4)");
    }),
    water: makeTexture((g, s) => {
        g.fillStyle = "#2d6d86";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "#3e86a0";
        g.fillRect(0, 10, s, 4);
        g.fillRect(0, 34, s, 3);
        g.fillRect(0, 52, s, 5);
        speck(g, s, 80, "rgba(180,220,230,0.35)", "rgba(16,60,80,0.28)");
    }),
    wall: makeTexture((g, s) => {
        g.fillStyle = "#d2c09a";
        g.fillRect(0, 0, s, s);
        speck(g, s, 140, "rgba(90,70,40,0.18)", "rgba(255,248,230,0.18)");
        g.fillStyle = "#5c3b24";
        g.fillRect(0, 0, s, 5);
        g.fillRect(0, s - 6, s, 6);
        g.fillRect(0, 0, 5, s);
        g.fillRect(s - 5, 0, 5, s);
        g.fillRect(0, 30, s, 4);
        g.fillRect(30, 0, 4, s);
        g.fillStyle = "#243044";
        g.fillRect(10, 8, 14, 14);
        g.fillRect(40, 8, 14, 14);
    }),
    door: makeTexture((g, s) => {
        g.fillStyle = "#d2c09a";
        g.fillRect(0, 0, s, s);
        speck(g, s, 100, "rgba(90,70,40,0.18)", "rgba(255,248,230,0.18)");
        g.fillStyle = "#5c3b24";
        g.fillRect(0, 0, s, 5);
        g.fillRect(0, s - 6, s, 6);
        g.fillRect(0, 0, 5, s);
        g.fillRect(s - 5, 0, 5, s);
        g.fillRect(0, 30, s, 4);
        g.fillStyle = "#3e2918";
        g.fillRect(22, 32, 20, 32);
        g.fillStyle = "#e2c27a";
        g.fillRect(36, 46, 3, 3);
        g.fillStyle = "#243044";
        g.fillRect(8, 8, 12, 14);
        g.fillRect(44, 8, 12, 14);
    }),
    store: makeTexture((g, s) => {
        g.fillStyle = "#d2c09a";
        g.fillRect(0, 0, s, s);
        speck(g, s, 80, "rgba(90,70,40,0.18)", "rgba(255,248,230,0.18)");
        g.fillStyle = "#5c3b24";
        g.fillRect(0, 0, s, 5);
        g.fillRect(0, s - 6, s, 6);
        g.fillRect(0, 0, 5, s);
        g.fillRect(s - 5, 0, 5, s);
        g.fillRect(0, 30, s, 4);
        g.fillStyle = "#3e2918";
        g.fillRect(22, 32, 20, 32);
        g.fillStyle = "#e2c27a";
        g.fillRect(36, 46, 3, 3);
        g.fillStyle = "#2d6d86";
        g.beginPath();
        g.ellipse(32, 14, 14, 7, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#e8f4f8";
        g.beginPath();
        g.arc(40, 13, 2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#1e4e62";
        g.fillRect(18, 13, 6, 2);
    }),
    roof: makeTexture((g, s) => {
        g.fillStyle = "#7a3a2c";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "#5e2b20";
        for (let y = 0; y < s; y += 6) g.fillRect(0, y, s, 2);
        speck(g, s, 80, "rgba(0,0,0,0.15)", "rgba(255,180,140,0.12)");
    }),
    skin: makeTexture((g, s) => {
        g.fillStyle = "#e0b896";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "#d2a888";
        g.fillRect(36, 0, 12, s);
        g.fillStyle = "#3a2a22";
        g.fillRect(48, 0, 16, s);
        g.fillStyle = "#2a1c16";
        g.fillRect(48, 0, 3, s);
        g.fillStyle = "#3a2a22";
        g.fillRect(0, 0, 32, 11);
        g.fillStyle = "#2a1c16";
        g.fillRect(3, 14, 10, 3);
        g.fillRect(19, 14, 10, 3);
        g.fillStyle = "#f3eee6";
        g.fillRect(4, 19, 9, 7);
        g.fillRect(19, 19, 9, 7);
        g.fillStyle = "#1c2430";
        g.fillRect(8, 21, 4, 4);
        g.fillRect(23, 21, 4, 4);
        g.fillStyle = "#c48b72";
        g.fillRect(14, 28, 4, 7);
        g.fillStyle = "#a86858";
        g.fillRect(9, 38, 14, 3);
        g.fillStyle = "rgba(90, 50, 40, 0.28)";
        g.fillRect(10, 50, 12, 5);
    }),
    pants: makeTexture((g, s) => {
        g.fillStyle = "#4a3428";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "rgba(0,0,0,0.22)";
        g.fillRect(30, 0, 4, s);
    }),
    steel: makeTexture((g, s) => {
        g.fillStyle = "#8b949c";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "#f4f7f8";
        g.fillRect(0, 0, s * 0.42, s);
        g.fillStyle = "#3e474e";
        g.fillRect(s * 0.72, 0, s * 0.28, s);
        g.fillStyle = "#b08a45";
        g.fillRect(0, s * 0.42, s, s * 0.16);
    }),
    wood: makeTexture((g, s) => {
        g.fillStyle = "#6a4324";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "#8b5a32";
        for (let x = 2; x < s; x += 7) g.fillRect(x, 0, 3, s);
        g.fillStyle = "#3e2614";
        g.fillRect(0, 0, s, 4);
        g.fillRect(0, 30, s, 2);
    }),
    trunk: makeTexture((g, s) => {
        g.fillStyle = "#5a3a22";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "#3a2414";
        for (let x = 4; x < s; x += 9) g.fillRect(x, 0, 2, s);
        g.fillStyle = "#7a5430";
        g.fillRect(0, 18, s, 3);
        g.fillRect(0, 44, s, 2);
    }),
    leaf: makeTexture((g, s) => {
        g.fillStyle = "#2f6a32";
        g.fillRect(0, 0, s, s);
        speck(g, s, 220, "#1d4a22", "#6a9a3e");
        g.fillStyle = "#245628";
        g.fillRect(0, 0, s, 6);
    }),
    glow: makeTexture((g, s) => {
        g.fillStyle = "#ff9a32";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "#ffe08a";
        g.fillRect(16, 16, 32, 32);
    }),
    linen: makeTexture((g, s) => {
        g.fillStyle = "#8d3d3a";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "#c4b49a";
        g.fillRect(0, 0, s, 14);
        g.fillStyle = "#6e2e2c";
        for (let y = 18; y < s; y += 10) g.fillRect(0, y, s, 3);
    }),
    plaster: makeTexture((g, s) => {
        g.fillStyle = "#d8c4a4";
        g.fillRect(0, 0, s, s);
        speck(g, s, 160, "rgba(90,70,40,0.16)", "rgba(255,248,230,0.2)");
        g.fillStyle = "#5c3b24";
        g.fillRect(0, 0, s, 6);
        g.fillRect(0, s - 7, s, 7);
    }),
    rock: makeTexture((g, s) => {
        g.fillStyle = "#7d7a74";
        g.fillRect(0, 0, s, s);
        speck(g, s, 180, "#5c5954", "#a8a49c");
        g.fillStyle = "#4e4b46";
        g.fillRect(8, 12, 22, 16);
        g.fillRect(36, 34, 18, 14);
    }),
    cloth0: clothTexture("#c45c3a"),
    cloth1: clothTexture("#3d6b8a"),
    cloth2: clothTexture("#6a7a3a"),
    cloth3: clothTexture("#8a5a7a")
};

function clothTexture(color) {
    return makeTexture((g, s) => {
        g.fillStyle = color;
        g.fillRect(0, 0, s, s);
        g.fillStyle = "rgba(255,255,255,0.2)";
        g.fillRect(28, 8, 8, s - 16);
        g.fillStyle = "#3a2a22";
        g.fillRect(0, 0, s, 8);
        g.fillRect(0, 36, s, 6);
        g.fillStyle = "#e2c27a";
        g.fillRect(30, 37, 4, 4);
    });
}

function pushQuad(list, a, b, c, d) {
    list.push(...a, ...b, ...c, ...a, ...c, ...d);
}

function pushTri(list, a, b, c) {
    list.push(...a, ...b, ...c);
}

const batches = {
    grass: [], dirt: [], sand: [], water: [], wall: [], door: [], roof: [], store: [], plaster: [], trunk: [], leaf: [], rock: [], linen: [], glow: [],
    farTrunk: [], farLeaf: [], horizon: [], horizonRock: [], horizonLeaf: [], horizonWall: [], horizonRoof: []
};

function buildLand() {
    const cell = 32;
    const min = -3616;
    const span = 7232;
    const n = span / cell;
    const heights = new Float32Array((n + 1) * (n + 1));
    const sample = (ix, iz) => heights[iz * (n + 1) + ix];
    for (let iz = 0; iz <= n; iz++) {
        for (let ix = 0; ix <= n; ix++) {
            heights[iz * (n + 1) + ix] = World.heightAt(min + ix * cell, min + iz * cell);
        }
    }
    for (let iz = 0; iz < n; iz++) {
        for (let ix = 0; ix < n; ix++) {
            const x = min + ix * cell;
            const z = min + iz * cell;
            const h00 = sample(ix, iz);
            const h10 = sample(ix + 1, iz);
            const h11 = sample(ix + 1, iz + 1);
            const h01 = sample(ix, iz + 1);
            const rise = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
            const mid = (h00 + h10 + h11 + h01) * 0.25;
            const cx = x + cell * 0.5;
            const cz = z + cell * 0.5;
            let town = false;
            for (const place of World.places) {
                if (x + cell > place.x - 104 && x < place.x + 104 && z + cell > place.z - 104 && z < place.z + 104) town = true;
            }
            if (town) continue;
            if (mid > -0.35) {
                const kind = World.groundKind(cx, cz, rise);
                const list = batches[kind] || batches.grass;
                const shade = kind === "rock" ? 0.76 : 1;
                const u = x / 8;
                const v = z / 8;
                pushQuad(
                    list,
                    [x, h00, z, u, v, shade],
                    [x, h01, z + cell, u, v + cell / 8, shade],
                    [x + cell, h11, z + cell, u + cell / 8, v + cell / 8, shade],
                    [x + cell, h10, z, u + cell / 8, v, shade]
                );
            }
            const level = World.waterLevel(cx, cz);
            if (level == null || mid > level + 0.45) continue;
            const wy = (hh) => (hh < 0.3 ? 0.03 : hh + 0.16);
            const u = x / 8;
            const v = z / 8;
            pushQuad(
                batches.water,
                [x, wy(h00), z, u, v, 0.95],
                [x, wy(h01), z + cell, u, v + cell / 8, 0.95],
                [x + cell, wy(h11), z + cell, u + cell / 8, v + cell / 8, 0.95],
                [x + cell, wy(h10), z, u + cell / 8, v, 0.95]
            );
        }
    }
    const fine = 4;
    for (const place of World.places) {
        for (let x = place.x - 104; x < place.x + 104; x += fine) {
            for (let z = place.z - 104; z < place.z + 104; z += fine) {
                const h00 = World.heightAt(x, z);
                const h10 = World.heightAt(x + fine, z);
                const h11 = World.heightAt(x + fine, z + fine);
                const h01 = World.heightAt(x, z + fine);
                const rise = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
                const cx = x + fine * 0.5;
                const cz = z + fine * 0.5;
                const kind = World.groundKind(cx, cz, rise);
                const list = batches[kind] || batches.grass;
                const u = x / 4;
                const v = z / 4;
                pushQuad(
                    list,
                    [x, h00, z, u, v, 1],
                    [x, h01, z + fine, u, v + 1, 1],
                    [x + fine, h11, z + fine, u + 1, v + 1, 1],
                    [x + fine, h10, z, u + 1, v, 1]
                );
            }
        }
    }
    const sea = 7200;
    const lip = sea - 3616;
    addWater(-sea, -sea, sea * 2, lip);
    addWater(-sea, 3616, sea * 2, lip);
    addWater(-sea, -3616, lip, 7232);
    addWater(3616, -3616, lip, 7232);
}

function addWater(x, z, w, d) {
    const u = x / 8;
    const v = z / 8;
    pushQuad(
        batches.water,
        [x, 0.02, z, u, v, 0.95],
        [x, 0.02, z + d, u, v + d / 8, 0.95],
        [x + w, 0.02, z + d, u + w / 8, v + d / 8, 0.95],
        [x + w, 0.02, z, u + w / 8, v, 0.95]
    );
}

buildLand();

function addOpenRoom(b) {
    const { x, z, w, d, h, rise } = b;
    const t = 0.28;
    const doorW = 1.7;
    const doorH = 2.2;
    const winW = 1.15;
    const winH = 0.85;
    const winY = 1.12;
    const entrance = b.entrance || "south";
    const windowSide = entrance === "east" || entrance === "west" ? "south" : "east";
    const holeOn = (side, along) => {
        if (side === entrance) return { at: (along - doorW) / 2, size: doorW, y0: 0, y1: doorH };
        if (side === windowSide) return { at: (along - winW) / 2, size: winW, y0: winY, y1: winY + winH };
        return null;
    };
    const span = (ox, oz, len, depth, axis, hole) => {
        const out = [];
        const push = (px, pz, ww, dd, y0, y1) => {
            if (ww > 0.04 && dd > 0.04 && y1 - y0 > 0.04) out.push({ x: px, z: pz, w: ww, d: dd, y0, y1 });
        };
        if (!hole) {
            push(ox, oz, axis === "x" ? len : depth, axis === "x" ? depth : len, 0, h);
            return out;
        }
        const after = len - (hole.at + hole.size);
        if (axis === "x") {
            push(ox, oz, hole.at, depth, 0, h);
            push(ox + hole.at + hole.size, oz, after, depth, 0, h);
            push(ox + hole.at, oz, hole.size, depth, 0, hole.y0);
            push(ox + hole.at, oz, hole.size, depth, hole.y1, h);
        } else {
            push(ox, oz, depth, hole.at, 0, h);
            push(ox, oz + hole.at + hole.size, depth, after, 0, h);
            push(ox, oz + hole.at, depth, hole.size, 0, hole.y0);
            push(ox, oz + hole.at, depth, hole.size, hole.y1, h);
        }
        return out;
    };
    const parts = [
        ...span(x, z, w, t, "x", holeOn("north", w)),
        ...span(x, z + d - t, w, t, "x", holeOn("south", w)),
        ...span(x, z, d, t, "z", holeOn("west", d)),
        ...span(x + w - t, z, d, t, "z", holeOn("east", d))
    ];
    for (const part of parts) {
        addBox(batches.plaster, part.x, part.y0, part.z, part.w, part.y1 - part.y0, part.d);
    }
    const trim = (side, along, hole, jamb) => {
        const at = hole.at;
        const postY = hole.y0 > 0 ? hole.y0 : 0;
        const postH = hole.y1 - postY;
        if (side === "south" || side === "north") {
            const oz = side === "south" ? z + d - t - 0.06 : z - 0.06;
            const ox = x + at;
            addBox(batches.trunk, ox - 0.08, postY, oz, 0.14, postH, t + 0.12);
            addBox(batches.trunk, ox + hole.size - 0.06, postY, oz, 0.14, postH, t + 0.12);
            addBox(batches.trunk, ox - 0.08, hole.y1 - jamb, oz, hole.size + 0.16, jamb, t + 0.12);
            if (hole.y0 > 0) addBox(batches.trunk, ox - 0.04, hole.y0, oz, hole.size + 0.08, jamb, t + 0.1);
        } else {
            const ox = side === "east" ? x + w - t - 0.06 : x - 0.06;
            const oz = z + at;
            addBox(batches.trunk, ox, postY, oz - 0.08, t + 0.12, postH, 0.14);
            addBox(batches.trunk, ox, postY, oz + hole.size - 0.06, t + 0.12, postH, 0.14);
            addBox(batches.trunk, ox, hole.y1 - jamb, oz - 0.08, t + 0.12, jamb, hole.size + 0.16);
            if (hole.y0 > 0) addBox(batches.trunk, ox, hole.y0, oz - 0.04, t + 0.1, jamb, hole.size + 0.08);
        }
    };
    trim(entrance, entrance === "east" || entrance === "west" ? d : w, holeOn(entrance, entrance === "east" || entrance === "west" ? d : w), 0.16);
    trim(windowSide, windowSide === "east" || windowSide === "west" ? d : w, holeOn(windowSide, windowSide === "east" || windowSide === "west" ? d : w), 0.08);
    const glowPane = (side, y0) => {
        const paneW = 0.7;
        const paneH = 0.55;
        if (side === "south") addBox(batches.glow, x + w / 2 - paneW / 2, y0, z + d - 0.04, paneW, paneH, 0.08);
        else if (side === "north") addBox(batches.glow, x + w / 2 - paneW / 2, y0, z - 0.04, paneW, paneH, 0.08);
        else if (side === "east") addBox(batches.glow, x + w - 0.04, y0, z + d / 2 - paneW / 2, 0.08, paneH, paneW);
        else addBox(batches.glow, x - 0.04, y0, z + d / 2 - paneW / 2, 0.08, paneH, paneW);
    };
    glowPane(windowSide, 1.2);
    glowPane(windowSide, 3.45);
    const torchAt = (px, pz) => {
        addBox(batches.trunk, px, 0, pz, 0.08, 1.35, 0.08);
        addBox(batches.glow, px - 0.06, 1.28, pz - 0.06, 0.2, 0.22, 0.2);
    };
    const outside = entrance === "south" ? [x + w * 0.72, z + d + 0.35]
        : entrance === "north" ? [x + w * 0.28, z - 0.45]
        : entrance === "east" ? [x + w + 0.35, z + d * 0.72]
        : [x - 0.45, z + d * 0.28];
    torchAt(outside[0], outside[1]);
    pushQuad(
        batches.trunk,
        [x + t, 0.04, z + t, 0, 0, 0.62],
        [x + t, 0.04, z + d - t, 0, 2, 0.62],
        [x + w - t, 0.04, z + d - t, 2, 2, 0.62],
        [x + w - t, 0.04, z + t, 2, 0, 0.62]
    );
    addBox(batches.trunk, x + t + 0.08, h - 0.14, z + t + 0.08, w - t * 2 - 0.16, 0.08, d - t * 2 - 0.16);
    const ix = x + t;
    const iz = z + t;
    const iw = w - t * 2;
    const id = d - t * 2;
    const furn = [];
    const use = (px, pz, ww, dd, top) => {
        furn.push({ x: px, z: pz, w: ww, d: dd, y0: 0, y1: top });
    };
    const tableAt = (px, pz, ww, dd) => {
        addBox(batches.trunk, px, 0.66, pz, ww, 0.08, dd);
        addBox(batches.trunk, px + 0.06, 0, pz + 0.06, 0.08, 0.66, 0.08);
        addBox(batches.trunk, px + ww - 0.14, 0, pz + 0.06, 0.08, 0.66, 0.08);
        addBox(batches.trunk, px + 0.06, 0, pz + dd - 0.14, 0.08, 0.66, 0.08);
        addBox(batches.trunk, px + ww - 0.14, 0, pz + dd - 0.14, 0.08, 0.66, 0.08);
        use(px, pz, ww, dd, 0.74);
    };
    const stoolAt = (px, pz) => {
        addBox(batches.trunk, px, 0.32, pz, 0.38, 0.08, 0.38);
        addBox(batches.trunk, px + 0.06, 0, pz + 0.06, 0.08, 0.32, 0.08);
        addBox(batches.trunk, px + 0.24, 0, pz + 0.24, 0.08, 0.32, 0.08);
        use(px, pz, 0.38, 0.38, 0.46);
    };
    const chestAt = (px, pz, ww, dd) => {
        addBox(batches.trunk, px, 0, pz, ww, 0.36, dd);
        addBox(batches.trunk, px + 0.04, 0.36, pz + 0.02, ww - 0.08, 0.06, dd - 0.04);
        use(px, pz, ww, dd, 0.42);
    };
    const bedAt = (px, pz, ww, dd) => {
        addBox(batches.trunk, px, 0.2, pz, ww, 0.1, dd);
        addBox(batches.trunk, px, 0, pz, 0.08, 0.2, 0.08);
        addBox(batches.trunk, px + ww - 0.08, 0, pz + dd - 0.08, 0.08, 0.2, 0.08);
        addBox(batches.linen, px + 0.08, 0.3, pz + 0.08, ww - 0.16, 0.1, dd - 0.16);
        addBox(batches.linen, px + 0.1, 0.4, pz + 0.1, ww - 0.2, 0.14, 0.32);
        use(px, pz, ww, dd, 0.5);
    };
    const hearthAt = (px, pz, ww, dd) => {
        addBox(batches.rock, px, 0, pz, ww, 0.48, dd);
        addBox(batches.rock, px + ww * 0.22, 0.48, pz + 0.12, ww * 0.32, 0.16, dd * 0.45);
        use(px, pz, ww, dd, 0.64);
    };
    const crateAt = (px, pz, s) => {
        addBox(batches.trunk, px, 0, pz, s, s * 0.82, s);
        use(px, pz, s, s, s * 0.82);
    };
    const barrelAt = (px, pz) => {
        addBox(batches.trunk, px, 0, pz, 0.48, 0.64, 0.48);
        addBox(batches.trunk, px - 0.03, 0.2, pz - 0.03, 0.54, 0.08, 0.54);
        addBox(batches.trunk, px - 0.03, 0.42, pz - 0.03, 0.54, 0.08, 0.54);
        use(px, pz, 0.48, 0.48, 0.64);
    };
    const rugAt = (px, pz, ww, dd) => {
        pushQuad(
            batches.linen,
            [px, 0.055, pz, 0, 0, 0.92],
            [px, 0.055, pz + dd, 0, 1, 0.92],
            [px + ww, 0.055, pz + dd, 1, 1, 0.92],
            [px + ww, 0.055, pz, 1, 0, 0.92]
        );
    };
    const shelfAt = (px, pz, len, axis) => {
        if (axis === "x") {
            addBox(batches.trunk, px, 1.18, pz, len, 0.08, 0.26);
            addBox(batches.rock, px + 0.1, 1.26, pz + 0.05, 0.16, 0.18, 0.16);
            addBox(batches.linen, px + len * 0.45, 1.26, pz + 0.04, 0.28, 0.12, 0.16);
            addBox(batches.trunk, px + len - 0.32, 1.26, pz + 0.04, 0.18, 0.22, 0.16);
            use(px, pz, len, 0.26, 1.48);
        } else {
            addBox(batches.trunk, px, 1.18, pz, 0.26, 0.08, len);
            addBox(batches.rock, px + 0.05, 1.26, pz + 0.1, 0.16, 0.18, 0.16);
            addBox(batches.linen, px + 0.04, 1.26, pz + len * 0.45, 0.16, 0.12, 0.28);
            use(px, pz, 0.26, len, 1.48);
        }
    };
    const benchAt = (px, pz, len, axis) => {
        if (axis === "x") {
            addBox(batches.trunk, px, 0.38, pz, len, 0.08, 0.36);
            addBox(batches.trunk, px + 0.06, 0, pz + 0.06, 0.08, 0.38, 0.1);
            addBox(batches.trunk, px + len - 0.14, 0, pz + 0.2, 0.08, 0.38, 0.1);
            use(px, pz, len, 0.36, 0.46);
        } else {
            addBox(batches.trunk, px, 0.38, pz, 0.36, 0.08, len);
            addBox(batches.trunk, px + 0.06, 0, pz + 0.06, 0.1, 0.38, 0.08);
            addBox(batches.trunk, px + 0.2, 0, pz + len - 0.14, 0.1, 0.38, 0.08);
            use(px, pz, 0.36, len, 0.46);
        }
    };
    const sackAt = (px, pz) => {
        addBox(batches.linen, px, 0, pz, 0.42, 0.28, 0.34);
        use(px, pz, 0.42, 0.34, 0.28);
    };
    const dishes = (px, pz) => {
        addBox(batches.rock, px, 0.74, pz, 0.16, 0.06, 0.16);
        addBox(batches.linen, px + 0.22, 0.74, pz + 0.04, 0.12, 0.1, 0.12);
    };
    const stairLow = entrance === "north" || entrance === "west";
    const stairEast = entrance === "west";
    const stairW = 0.92;
    const stairL = Math.min(2.2, id - 1.35);
    const stairX = stairEast ? ix + iw - stairW - 0.08 : ix + 0.08;
    const stairZ = stairLow ? iz + id - stairL - 0.08 : iz + 0.08;
    const topY = 2.72;
    const stepN = 9;
    const nap = [];
    const pushNap = (px, pz, py) => nap.push({ x: px, z: pz, y: py });
    const doorOut = entrance === "south" ? { x: x + w / 2, z: z + d + 1.05, yaw: Math.PI }
        : entrance === "north" ? { x: x + w / 2, z: z - 1.05, yaw: 0 }
        : entrance === "east" ? { x: x + w + 1.05, z: z + d / 2, yaw: -Math.PI / 2 }
        : { x: x - 1.05, z: z + d / 2, yaw: Math.PI / 2 };
    const doorIn = entrance === "south" ? { x: x + w / 2, z: z + d - t - 0.75 }
        : entrance === "north" ? { x: x + w / 2, z: z + t + 0.75 }
        : entrance === "east" ? { x: x + w - t - 0.75, z: z + d / 2 }
        : { x: x + t + 0.75, z: z + d / 2 };
    pushNap(doorOut.x, doorOut.z, 0);
    pushNap(doorIn.x, doorIn.z, 0);
    const stairCx = stairX + stairW / 2;
    const stairCz = stairZ + stairL / 2;
    pushNap(stairCx, stairLow ? stairZ + stairL - 0.2 : stairZ + 0.2, 0);
    for (let i = 0; i < stepN; i++) {
        const py = (i + 1) / stepN * topY;
        const along = (i + 0.5) / stepN;
        const pz = stairLow ? stairZ + stairL - along * stairL : stairZ + along * stairL;
        const run = stairL / stepN;
        const sz = stairLow ? stairZ + stairL - (i + 1) * run : stairZ + i * run;
        addBox(batches.trunk, stairX, 0, sz, stairW, py, run + 0.02);
        pushNap(stairCx, pz, py);
        b.decks.push({ x: stairX, z: sz, w: stairW, d: run + 0.02, y: py });
    }
    const landX = stairEast ? ix + 0.08 : stairX + stairW + 0.08;
    const landW = iw - stairW - 0.24;
    b.decks.push({ x: landX, z: iz + 0.06, w: landW, d: id - 0.12, y: topY });
    if (!stairLow) b.decks.push({ x: stairX, z: stairZ + stairL, w: stairW, d: id - stairL - 0.14, y: topY });
    else b.decks.push({ x: stairX, z: iz + 0.06, w: stairW, d: stairZ - iz - 0.08, y: topY });
    for (const deck of b.decks.slice(-2)) {
        if (deck.d < 0.2 || deck.w < 0.2) continue;
        pushQuad(batches.trunk, [deck.x, deck.y, deck.z, 0, 0, 0.62], [deck.x, deck.y, deck.z + deck.d, 0, 1, 0.62], [deck.x + deck.w, deck.y, deck.z + deck.d, 1, 1, 0.62], [deck.x + deck.w, deck.y, deck.z, 1, 0, 0.62]);
        pushQuad(batches.trunk, [deck.x, deck.y - 0.08, deck.z + deck.d, 0, 0, 0.45], [deck.x, deck.y - 0.08, deck.z, 0, 1, 0.45], [deck.x + deck.w, deck.y - 0.08, deck.z, 1, 1, 0.45], [deck.x + deck.w, deck.y - 0.08, deck.z + deck.d, 1, 0, 0.45]);
    }
    const sleepZ = stairLow ? iz + 0.55 : iz + id - 0.85;
    const gap = 0.86;
    const gapX = ix + iw / 2 - gap / 2;
    const wallH = 2.05;
    addBox(batches.plaster, ix + 0.05, topY, sleepZ, gapX - ix - 0.05, wallH, 0.12);
    addBox(batches.plaster, gapX + gap, topY, sleepZ, ix + iw - (gapX + gap) - 0.05, wallH, 0.12);
    furn.push({ x: ix + 0.05, z: sleepZ, w: gapX - ix - 0.05, d: 0.12, y0: topY, y1: topY + wallH });
    furn.push({ x: gapX + gap, z: sleepZ, w: ix + iw - (gapX + gap) - 0.05, d: 0.12, y0: topY, y1: topY + wallH });
    addBox(batches.trunk, gapX - 0.06, topY, sleepZ - 0.04, 0.08, wallH, 0.2);
    addBox(batches.trunk, gapX + gap - 0.02, topY, sleepZ - 0.04, 0.08, wallH, 0.2);
    addBox(batches.door, gapX + 0.08, topY, sleepZ - 0.02, gap - 0.16, wallH * 0.92, 0.06);
    pushNap(gapX + gap / 2, sleepZ + (stairLow ? 0.35 : -0.15), topY);
    b.nap = nap;
    b.keeper = { x: doorIn.x, z: doorIn.z + (entrance === "north" ? 1.15 : entrance === "south" ? -1.15 : 0), yaw: doorOut.yaw };
    if (entrance === "east") b.keeper = { x: doorIn.x - 1.15, z: doorIn.z, yaw: doorOut.yaw };
    if (entrance === "west") b.keeper = { x: doorIn.x + 1.15, z: doorIn.z, yaw: doorOut.yaw };
    const backZ = stairLow ? iz + 0.15 : iz + Math.max(0.4, id - 1.7);
    if (b.kind === "stores") {
        shelfAt(ix + stairW + 0.25, iz + 0.08, Math.max(1.1, iw - stairW - 0.5), "x");
        crateAt(ix + stairW + 0.3, iz + 1.15, 0.55);
        crateAt(ix + stairW + 0.95, iz + 1.2, 0.42);
        barrelAt(ix + iw - 0.7, iz + 0.2);
        barrelAt(ix + iw - 0.68, iz + 0.85);
        sackAt(ix + iw - 1.25, iz + 0.25);
        sackAt(ix + iw - 1.2, iz + 0.7);
        addBox(batches.trunk, ix + 1.3, 0, backZ, 1.4, 0.28, 0.34);
        use(ix + 1.3, backZ, 1.4, 0.34, 0.28);
    } else if (b.kind === "barracks") {
        tableAt(ix + stairW + 0.35, iz + 1.15, 1.35, 0.7);
        benchAt(ix + stairW + 0.4, iz + 1.95, 1.2, "x");
        addBox(batches.trunk, ix + iw - 0.42, 0, iz + 0.2, 0.16, 1.5, 1.3);
        addBox(batches.rock, ix + iw - 0.5, 0.45, iz + 0.35, 0.08, 0.7, 0.08);
        addBox(batches.rock, ix + iw - 0.5, 0.85, iz + 0.7, 0.08, 0.55, 0.08);
        addBox(batches.door, ix + iw - 0.28, 0.7, iz + 1.15, 0.08, 0.55, 0.4);
        use(ix + iw - 0.5, iz + 0.2, 0.28, 1.3, 1.5);
        chestAt(ix + stairW + 0.3, iz + 0.2, 0.55, 0.4);
    } else if (b.kind === "smith") {
        hearthAt(ix + stairW + 0.2, iz + 0.12, 1.15, 0.7);
        addBox(batches.glow, ix + stairW + 0.45, 0.5, iz + 0.28, 0.42, 0.18, 0.32);
        addBox(batches.rock, ix + iw - 1.15, 0.55, iz + 1.15, 0.42, 0.28, 0.55);
        addBox(batches.trunk, ix + iw - 1.22, 0, iz + 1.22, 0.1, 0.55, 0.1);
        addBox(batches.trunk, ix + iw - 0.8, 0, iz + 1.55, 0.1, 0.55, 0.1);
        use(ix + iw - 1.22, iz + 1.15, 0.55, 0.6, 0.85);
        addBox(batches.trunk, ix + 0.2, 0.7, iz + id - 0.55, 1.3, 0.1, 0.38);
        use(ix + 0.2, iz + id - 0.55, 1.3, 0.38, 0.85);
        addBox(batches.rock, x + w * 0.35, h, z + d * 0.25, 0.55, 1.15, 0.55);
    } else if (b.kind === "shop") {
        const fx = stairEast ? ix + 0.25 : stairX + stairW + 0.2;
        addBox(batches.trunk, fx, 0.9, iz + 1.35, Math.max(1.1, iw - stairW - 0.55), 0.1, 0.5);
        addBox(batches.plaster, fx + 0.08, 0, iz + 1.42, Math.max(0.9, iw - stairW - 0.7), 0.9, 0.34);
        use(fx, iz + 1.35, Math.max(1.1, iw - stairW - 0.55), 0.5, 1);
        shelfAt(fx, iz + 0.06, Math.max(1, iw - stairW - 0.45), "x");
        barrelAt(ix + iw - 0.62, iz + id - 0.7);
        sackAt(fx, iz + id - 0.55);
        b.keeper = { x: fx + 0.4, z: iz + 0.85, yaw: doorOut.yaw };
    } else if (b.kind === "tavern") {
        const fx = stairEast ? ix + 0.2 : stairX + stairW + 0.18;
        hearthAt(ix + iw - 1.35, iz + 0.12, 1.05, 0.55);
        addBox(batches.glow, ix + iw - 1.05, 0.48, iz + 0.26, 0.36, 0.16, 0.28);
        addBox(batches.trunk, fx, 0.92, iz + 0.85, 0.5, 0.1, 1.4);
        addBox(batches.plaster, fx + 0.06, 0, iz + 0.92, 0.36, 0.92, 1.25);
        use(fx, iz + 0.85, 0.5, 1.4, 1.05);
        tableAt(fx + 0.7, iz + 1.15, 0.8, 0.65);
        stoolAt(fx + 0.85, iz + 1.95);
        barrelAt(fx, iz + id - 0.65);
    } else {
        rugAt(ix + stairW + 0.15, iz + 0.85, Math.max(1.2, iw - stairW - 0.4), Math.max(1.2, id - 1.6));
        hearthAt(ix + iw - 1.4, iz + 0.12, 1.15, 0.58);
        addBox(batches.glow, ix + iw - 1.1, 0.5, iz + 0.26, 0.38, 0.16, 0.28);
        tableAt(ix + stairW + 0.25, iz + 1.05, Math.min(1.6, iw - stairW - 0.45), 0.75);
        benchAt(ix + stairW + 0.3, iz + 1.9, Math.min(1.4, iw - stairW - 0.6), "x");
        shelfAt(ix + stairW + 0.2, iz + 0.05, Math.max(0.9, iw - stairW - 1.6), "x");
        chestAt(ix + iw - 0.75, iz + id - 0.7, 0.5, 0.38);
    }
    b.parts = parts.concat(furn);
    const ridge = h + rise;
    const midZ = z + d / 2;
    pushQuad(
        batches.roof,
        [x, h, z, 0, 0, 0.95],
        [x, ridge, midZ, 0, 1, 0.95],
        [x + w, ridge, midZ, w / 2, 1, 0.95],
        [x + w, h, z, w / 2, 0, 0.95]
    );
    pushQuad(
        batches.roof,
        [x + w, h, z + d, 0, 0, 0.78],
        [x + w, ridge, midZ, 0, 1, 0.78],
        [x, ridge, midZ, w / 2, 1, 0.78],
        [x, h, z + d, w / 2, 0, 0.78]
    );
    pushTri(
        batches.plaster,
        [x, h, z, 0, 0.15, 0.8],
        [x, h, z + d, 1, 0.15, 0.8],
        [x, ridge, midZ, 0.5, 0.45, 0.8]
    );
    pushTri(
        batches.plaster,
        [x + w, h, z + d, 0, 0.15, 0.86],
        [x + w, h, z, 1, 0.15, 0.86],
        [x + w, ridge, midZ, 0.5, 0.45, 0.86]
    );
}

function addHouse(b) {
    if (b.open) {
        addOpenRoom(b);
        return;
    }
    const { x, z, w, d, h, rise, door } = b;
    const ridge = h + rise;
    const midZ = z + d / 2;
    const vu = h / 2.2;
    const faces = [
        ["s", 1, w / 2.2, [
            [x, 0, z], [x, h, z], [x + w, h, z], [x + w, 0, z]
        ]],
        ["n", 0.72, w / 2.2, [
            [x + w, 0, z + d], [x + w, h, z + d], [x, h, z + d], [x, 0, z + d]
        ]],
        ["e", 0.86, d / 2.2, [
            [x + w, 0, z], [x + w, h, z], [x + w, h, z + d], [x + w, 0, z + d]
        ]],
        ["w", 0.8, d / 2.2, [
            [x, 0, z + d], [x, h, z + d], [x, h, z], [x, 0, z]
        ]]
    ];
    for (const [side, shade, across, corners] of faces) {
        const list = side === door ? (b.store ? batches.store : batches.door) : batches.wall;
        const u1 = side === door ? 1 : across;
        const v1 = side === door ? 1 : vu;
        const quad = corners.map((p, i) => {
            const u = i >= 2 ? u1 : 0;
            const v = i === 1 || i === 2 ? v1 : 0;
            return [p[0], p[1], p[2], u, v, shade];
        });
        pushQuad(list, quad[0], quad[1], quad[2], quad[3]);
    }
    pushQuad(
        batches.roof,
        [x, h, z, 0, 0, 0.95],
        [x, ridge, midZ, 0, 1, 0.95],
        [x + w, ridge, midZ, w / 2, 1, 0.95],
        [x + w, h, z, w / 2, 0, 0.95]
    );
    pushQuad(
        batches.roof,
        [x + w, h, z + d, 0, 0, 0.78],
        [x + w, ridge, midZ, 0, 1, 0.78],
        [x, ridge, midZ, w / 2, 1, 0.78],
        [x, h, z + d, w / 2, 0, 0.78]
    );
    pushTri(
        batches.wall,
        [x, h, z, 0, 0.15, 0.8],
        [x, h, z + d, 1, 0.15, 0.8],
        [x, ridge, midZ, 0.5, 0.45, 0.8]
    );
    pushTri(
        batches.wall,
        [x + w, h, z + d, 0, 0.15, 0.86],
        [x + w, h, z, 1, 0.15, 0.86],
        [x + w, ridge, midZ, 0.5, 0.45, 0.86]
    );
}

houses.forEach((house) => {
    if (!house.test) addHouse(house);
});

function addYard(place) {
    const ox = place.ox;
    const oz = place.oz;
    const pile = (x, z) => {
        addBox(batches.trunk, ox + x, 0, oz + z, 0.9, 0.32, 0.45);
        addBox(batches.trunk, ox + x + 0.1, 0.32, oz + z + 0.05, 0.7, 0.22, 0.34);
        scenery.push({ x: ox + x, z: oz + z, w: 0.9, d: 0.45 });
    };
    const barrel = (x, z) => {
        addBox(batches.trunk, ox + x, 0, oz + z, 0.48, 0.62, 0.48);
        scenery.push({ x: ox + x, z: oz + z, w: 0.48, d: 0.48 });
    };
    const cart = (x, z) => {
        addBox(batches.trunk, ox + x, 0.28, oz + z, 1.3, 0.12, 0.7);
        addBox(batches.trunk, ox + x + 0.08, 0, oz + z + 0.08, 0.16, 0.28, 0.16);
        addBox(batches.trunk, ox + x + 1.05, 0, oz + z + 0.42, 0.16, 0.28, 0.16);
        scenery.push({ x: ox + x, z: oz + z, w: 1.3, d: 0.7 });
    };
    pile(-4.6, -3.1);
    barrel(-3.4, -9.4);
    barrel(-2.7, -9.5);
    cart(0.6, -8.2);
}
function spawnKeepers() {
    for (const house of houses) {
        if (house.kind !== "shop" || !house.keeper) continue;
        const owner = 2;
        men.push({
            decor: true,
            fisher: false,
            faction: owner,
            post: house.village,
            index: -50 - house.village,
            health: 1,
            x: house.keeper.x,
            z: house.keeper.z,
            yaw: house.keeper.yaw,
            bob: 0,
            down: 0,
            swing: -1,
            walking: false,
            hostile: false,
            dying: false,
            mode: "guard"
        });
    }
}

function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, `
attribute vec3 aPos;
attribute vec2 aUv;
attribute float aShade;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
varying vec2 vUv;
varying float vShade;
varying float vDepth;
varying vec2 vWorld;
void main() {
    vec4 world = uModel * vec4(aPos, 1.0);
    vWorld = world.xz;
    vec4 view = uView * world;
    vDepth = -view.z;
    vUv = aUv;
    vShade = aShade;
    gl_Position = uProj * view;
}
`));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `
precision mediump float;
varying vec2 vUv;
varying float vShade;
varying float vDepth;
varying vec2 vWorld;
uniform sampler2D uTex;
uniform float uDark;
uniform float uGlow;
uniform vec2 uEye;
uniform float uBand;
void main() {
    vec3 color = texture2D(uTex, vUv).rgb * vShade;
    float dist = distance(vWorld, uEye);
    float fog = clamp((dist - 60.0) / 1800.0, 0.0, 0.78);
    if (uBand > 2.5) {
        fog = clamp((dist - 60.0) / 1800.0, 0.0, 0.66);
        if (dist < 1220.0) discard;
    } else if (uBand > 1.5) {
        fog = clamp((dist - 60.0) / 1800.0, 0.0, 0.66);
        if (dist < 1080.0) discard;
    } else if (uBand > 0.5) {
        if (dist > 1280.0) discard;
        if (uBand < 0.8 && dist < 80.0) discard;
    }
    vec3 fogCol = mix(vec3(0.73, 0.75, 0.68), vec3(0.05, 0.06, 0.1), uDark);
    if (uGlow > 0.5) {
        color = mix(color, color * vec3(1.2, 0.7, 0.28), uDark);
        color += vec3(0.28, 0.12, 0.02) * uDark;
    } else {
        color *= mix(1.0, 0.2, uDark);
    }
    gl_FragColor = vec4(mix(color, fogCol, fog), 1.0);
}
`));
gl.linkProgram(program);

const skyProgram = gl.createProgram();
gl.attachShader(skyProgram, compile(gl.VERTEX_SHADER, `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 1.0, 1.0); }
`));
gl.attachShader(skyProgram, compile(gl.FRAGMENT_SHADER, `
precision mediump float;
uniform vec2 uRes;
uniform float uPitch;
uniform float uDark;
uniform vec2 uSun;
uniform float uSunUp;
void main() {
    float horizon = 0.46 - uPitch * 0.42;
    float t = clamp((gl_FragCoord.y / uRes.y - horizon) / 0.62, 0.0, 1.0);
    vec3 haze = mix(vec3(0.80, 0.75, 0.64), vec3(0.07, 0.08, 0.13), uDark);
    vec3 zenith = mix(vec3(0.42, 0.58, 0.74), vec3(0.02, 0.025, 0.07), uDark);
    vec3 col = mix(haze, zenith, t);
    float sun = smoothstep(0.11, 0.0, distance(gl_FragCoord.xy / uRes, uSun));
    col += vec3(1.0, 0.78, 0.38) * sun * uSunUp * (1.0 - uDark * 0.75);
    col += vec3(0.45, 0.18, 0.04) * (1.0 - t) * smoothstep(0.2, 0.7, uDark) * (1.0 - uDark);
    gl_FragColor = vec4(col, 1.0);
}
`));
gl.linkProgram(skyProgram);

const loc = {
    proj: gl.getUniformLocation(program, "uProj"),
    view: gl.getUniformLocation(program, "uView"),
    model: gl.getUniformLocation(program, "uModel"),
    pos: gl.getAttribLocation(program, "aPos"),
    uv: gl.getAttribLocation(program, "aUv"),
    shade: gl.getAttribLocation(program, "aShade"),
    dark: gl.getUniformLocation(program, "uDark"),
    glow: gl.getUniformLocation(program, "uGlow"),
    eye: gl.getUniformLocation(program, "uEye"),
    band: gl.getUniformLocation(program, "uBand")
};
const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const peopleModels = {};
const peopleHands = {};
let peopleReady = false;
let swordModel = null;
const skyLoc = {
    pos: gl.getAttribLocation(skyProgram, "aPos"),
    res: gl.getUniformLocation(skyProgram, "uRes"),
    pitch: gl.getUniformLocation(skyProgram, "uPitch"),
    dark: gl.getUniformLocation(skyProgram, "uDark"),
    sun: gl.getUniformLocation(skyProgram, "uSun"),
    sunUp: gl.getUniformLocation(skyProgram, "uSunUp")
};

const scenery = [];

function growScenery() {
    const roll = (x, z, salt) => {
        const n = Math.sin(x * 12.9898 + z * 78.233 + salt * 45.164) * 43758.5453;
        return n - Math.floor(n);
    };
    const bush = (x, z, y) => {
        const w = 0.55 + roll(x, z, 2) * 0.45;
        const d = 0.5 + roll(x, z, 3) * 0.4;
        const h = 0.36 + roll(x, z, 4) * 0.24;
        addBox(batches.leaf, x - w / 2, y, z - d / 2, w, h, d);
        scenery.push({ x: x - w / 2, z: z - d / 2, w, d });
    };
    const stone = (x, z, y) => {
        const w = 0.45 + roll(x, z, 5) * 0.75;
        const d = 0.4 + roll(x, z, 6) * 0.55;
        const h = 0.22 + roll(x, z, 7) * 0.4;
        addBox(batches.rock, x - w / 2, y, z - d / 2, w, h, d);
        if (roll(x, z, 8) > 0.45) addBox(batches.rock, x - w * 0.2, y + h * 0.55, z - d * 0.15, w * 0.55, h * 0.75, d * 0.5);
        scenery.push({ x: x - w / 2, z: z - d / 2, w, d });
    };
    for (const spot of World.trees) {
        const y = Math.max(0, World.heightAt(spot.x, spot.z));
        if (spot.kind === "bush") bush(spot.x, spot.z, y);
        else if (spot.kind === "rock") stone(spot.x, spot.z, y);
        else {
            treeSpots.push({ x: spot.x, z: spot.z, y: y, pine: spot.kind === "pine" });
            impostor(spot.x, spot.z, y, spot.kind === "pine");
        }
    }
}

const treeSpots = [];

function fullTree(trunk, leaf, x, z, y, pine) {
    const n = Math.sin(x * 12.9898 + z * 78.233 + 45.164) * 43758.5453;
    const s = n - Math.floor(n);
    const tw = 0.24 + s * 0.14;
    const th = pine ? 2.8 + s * 1.1 : 2.35 + s * 0.7;
    addBox(trunk, x - tw / 2, y, z - tw / 2, tw, Math.max(2.05, th * 0.62), tw);
    if (pine) {
        for (let i = 0; i < 3; i++) {
            const g = 1.05 - i * 0.26;
            addBox(leaf, x - g, y + 1.85 + i * 0.58, z - g, g * 2, 0.7, g * 2);
        }
    } else {
        const g = 0.72 + s * 0.28;
        addBox(leaf, x - g * 1.15, y + 1.9, z - g * 0.7, g * 1.45, g * 0.85, g * 1.2);
        addBox(leaf, x - g * 0.15, y + 2.05, z - g * 1.05, g * 1.35, g * 0.8, g * 1.15);
        addBox(leaf, x - g * 0.55, y + 2.45, z - g * 0.4, g * 1.1, g * 0.65, g);
    }
}

function impostor(x, z, y, pine) {
    addBox(batches.farTrunk, x - 0.18, y, z - 0.18, 0.36, pine ? 3.4 : 2.5, 0.36);
    const g = pine ? 1.35 : 1.55;
    addBox(batches.farLeaf, x - g, y + 1.45, z - g, g * 2, pine ? 2.3 : 1.7, g * 2);
    scenery.push({ x: x - 0.18, z: z - 0.18, w: 0.36, d: 0.36 });
}

function buildHorizon() {
    const cell = 128;
    const min = -3584;
    const n = 56;
    for (let iz = 0; iz < n; iz++) {
        for (let ix = 0; ix < n; ix++) {
            const x = min + ix * cell;
            const z = min + iz * cell;
            const h00 = World.heightAt(x, z);
            const h10 = World.heightAt(x + cell, z);
            const h11 = World.heightAt(x + cell, z + cell);
            const h01 = World.heightAt(x, z + cell);
            const top = Math.max(h00, h10, h11, h01);
            if (top < -0.25) continue;
            const cx = x + cell * 0.5;
            const cz = z + cell * 0.5;
            const rocky = top > 8 || World.groundKind(cx, cz, top) === "rock";
            const list = rocky ? batches.horizonRock : batches.horizon;
            const shade = rocky ? 0.72 : 0.92;
            pushQuad(
                list,
                [x, h00, z, x / 16, z / 16, shade],
                [x, h01, z + cell, x / 16, (z + cell) / 16, shade],
                [x + cell, h11, z + cell, (x + cell) / 16, (z + cell) / 16, shade],
                [x + cell, h10, z, (x + cell) / 16, z / 16, shade]
            );
        }
    }
    for (let x = -3400; x <= 3400; x += 200) {
        for (let z = -3400; z <= 3400; z += 200) {
            if (World.forestAt(x, z) < 0.42) continue;
            let close = false;
            for (const place of World.places) {
                if (Math.hypot(x - place.x, z - place.z) < 240) close = true;
            }
            if (close) continue;
            const y = World.heightAt(x, z);
            if (y < 0.4 || World.wet(x, z)) continue;
            addBox(batches.horizonLeaf, x, y + 1.2, z, 96, 7, 96);
        }
    }
    for (const place of World.places) {
        const y = Math.max(0, World.heightAt(place.x, place.z));
        addBox(batches.horizonWall, place.x - 16, y, place.z - 10, 12, 8, 9);
        addBox(batches.horizonRoof, place.x - 17, y + 8, place.z - 11, 14, 3.2, 11);
        addBox(batches.horizonWall, place.x + 2, y, place.z - 4, 11, 7, 8);
        addBox(batches.horizonRoof, place.x + 1, y + 7, place.z - 5, 13, 2.8, 10);
    }
}

growScenery();
buildHorizon();
places.forEach(addYard);

const mesh = {};
for (const name of Object.keys(batches)) {
    const data = new Float32Array(batches[name]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    mesh[name] = { buffer, count: data.length / 6 };
}

textures.farTrunk = textures.trunk;
textures.farLeaf = textures.leaf;
textures.horizon = textures.grass;
textures.horizonRock = textures.rock;
textures.horizonLeaf = textures.leaf;
textures.horizonWall = textures.wall;
textures.horizonRoof = textures.roof;

let nearMarkX = 1e9;
let nearMarkZ = 1e9;
function refreshNearTrees() {
    const dx = cam.x - nearMarkX;
    const dz = cam.z - nearMarkZ;
    if (dx * dx + dz * dz < 40 * 40) return;
    nearMarkX = cam.x;
    nearMarkZ = cam.z;
    const trunk = [];
    const leaf = [];
    for (const spot of treeSpots) {
        const ox = spot.x - cam.x;
        const oz = spot.z - cam.z;
        if (ox * ox + oz * oz > 175 * 175) continue;
        fullTree(trunk, leaf, spot.x, spot.z, spot.y, spot.pine);
    }
    textures.nearTrunk = textures.trunk;
    textures.nearLeaf = textures.leaf;
    uploadMesh("nearTrunk", trunk);
    uploadMesh("nearLeaf", leaf);
}
refreshNearTrees();

function addBox(list, x, y, z, w, h, d, xf, uv) {
    const y1 = y + h;
    const u0 = uv ? uv[0] : 0;
    const v0 = uv ? uv[1] : 0;
    const u1 = uv ? uv[2] : 1;
    const v1 = uv ? uv[3] : 1;
    const p = (px, py, pz, u, v, s) => {
        const t = xf ? xf(px, py, pz) : [px, py, pz];
        return [t[0], t[1], t[2], u, v, s];
    };
    pushQuad(list, p(x, y, z, u0, v0, 1), p(x, y1, z, u0, v1, 1), p(x + w, y1, z, u1, v1, 1), p(x + w, y, z, u1, v0, 1));
    pushQuad(list, p(x + w, y, z + d, u0, v0, 0.72), p(x + w, y1, z + d, u0, v1, 0.72), p(x, y1, z + d, u1, v1, 0.72), p(x, y, z + d, u1, v0, 0.72));
    pushQuad(list, p(x + w, y, z, u0, v0, 0.86), p(x + w, y1, z, u0, v1, 0.86), p(x + w, y1, z + d, u1, v1, 0.86), p(x + w, y, z + d, u1, v0, 0.86));
    pushQuad(list, p(x, y, z + d, u0, v0, 0.8), p(x, y1, z + d, u0, v1, 0.8), p(x, y1, z, u1, v1, 0.8), p(x, y, z, u1, v0, 0.8));
    pushQuad(list, p(x, y1, z, u0, v0, 0.95), p(x, y1, z + d, u0, v1, 0.95), p(x + w, y1, z + d, u1, v1, 0.95), p(x + w, y1, z, u1, v0, 0.95));
    pushQuad(list, p(x, y, z + d, u0, v0, 0.55), p(x, y, z, u0, v1, 0.55), p(x + w, y, z, u1, v1, 0.55), p(x + w, y, z + d, u1, v0, 0.55));
}

function addHead(list, x, y, z, w, h, d, xf) {
    const y1 = y + h;
    const x1 = x + w;
    const z1 = z + d;
    const p = (px, py, pz, u, v, s) => {
        const t = xf ? xf(px, py, pz) : [px, py, pz];
        return [t[0], t[1], t[2], u, v, s];
    };
    pushQuad(list, p(x, y, z, 0.5, 0, 1), p(x, y1, z, 0.5, 1, 1), p(x1, y1, z, 0, 1, 1), p(x1, y, z, 0, 0, 1));
    pushQuad(list, p(x1, y, z1, 0.78, 0.12, 0.72), p(x1, y1, z1, 0.78, 0.88, 0.72), p(x, y1, z1, 0.98, 0.88, 0.72), p(x, y, z1, 0.98, 0.12, 0.72));
    pushQuad(list, p(x1, y, z, 0.58, 0.2, 0.9), p(x1, y1, z, 0.58, 0.8, 0.9), p(x1, y1, z1, 0.72, 0.8, 0.9), p(x1, y, z1, 0.72, 0.2, 0.9));
    pushQuad(list, p(x, y, z1, 0.58, 0.2, 0.82), p(x, y1, z1, 0.58, 0.8, 0.82), p(x, y1, z, 0.72, 0.8, 0.82), p(x, y, z, 0.72, 0.2, 0.82));
    pushQuad(list, p(x, y1, z, 0.8, 0.2, 0.95), p(x1, y1, z, 0.98, 0.2, 0.95), p(x1, y1, z1, 0.98, 0.8, 0.95), p(x, y1, z1, 0.8, 0.8, 0.95));
}

function uploadMesh(name, floats) {
    const data = new Float32Array(floats);
    if (!mesh[name]) {
        const buffer = gl.createBuffer();
        mesh[name] = { buffer, count: 0 };
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh[name].buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    mesh[name].count = data.length / 6;
}

function addLocalBox(list, map, xf, x, y, z, w, h, d, shade) {
    const y1 = y + h;
    const z1 = z + d;
    const x1 = x + w;
    const p = (px, py, pz, u, v, s) => {
        const b = map(px, py, pz);
        const t = xf ? xf(b[0], b[1], b[2]) : b;
        return [t[0], t[1], t[2], u, v, s];
    };
    pushQuad(list, p(x, y, z, 0, 0, shade), p(x, y1, z, 0, 1, shade), p(x1, y1, z, 1, 1, shade), p(x1, y, z, 1, 0, shade));
    pushQuad(list, p(x1, y, z1, 0, 0, shade * 0.72), p(x1, y1, z1, 0, 1, shade * 0.72), p(x, y1, z1, 1, 1, shade * 0.72), p(x, y, z1, 1, 0, shade * 0.72));
    pushQuad(list, p(x1, y, z, 0, 0, shade * 0.86), p(x1, y1, z, 0, 1, shade * 0.86), p(x1, y1, z1, 1, 1, shade * 0.86), p(x1, y, z1, 1, 0, shade * 0.86));
    pushQuad(list, p(x, y, z1, 0, 0, shade * 0.8), p(x, y1, z1, 0, 1, shade * 0.8), p(x, y1, z, 1, 1, shade * 0.8), p(x, y, z, 1, 0, shade * 0.8));
    pushQuad(list, p(x, y1, z, 0, 0, shade * 0.95), p(x1, y1, z, 1, 0, shade * 0.95), p(x1, y1, z1, 1, 1, shade * 0.95), p(x, y1, z1, 0, 1, shade * 0.95));
}

function swordAim(swing) {
    if (swing < 0) return [0.36, 0.18, -0.55];
    const t = Math.max(0, Math.min(1, swing));
    const arc = Math.sin(t * Math.PI);
    return [0.7 * Math.cos(t * Math.PI), 0.05 + 0.62 * arc, -0.18 - 0.75 * arc];
}

function addSword(steel, grip, x, z, swing, xf) {
    const hx = x + 0.52;
    const hy = 0.66;
    const hz = z + 0.1;
    const aim = swordAim(swing);
    const len = Math.hypot(aim[0], aim[1], aim[2]) || 1;
    const fx = aim[0] / len;
    const fy = aim[1] / len;
    const fz = aim[2] / len;
    let rx = -fz;
    let ry = 0;
    let rz = fx;
    let rlen = Math.hypot(rx, rz);
    if (rlen < 0.25) {
        rx = 1;
        rz = 0;
        rlen = 1;
    }
    rx /= rlen;
    rz /= rlen;
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;
    const map = (px, py, pz) => [
        hx + rx * px + ux * py + fx * pz,
        hy + uy * py + fy * pz,
        hz + rz * px + uz * py + fz * pz
    ];
    addLocalBox(grip, map, xf, -0.04, -0.04, -0.22, 0.08, 0.08, 0.28, 0.75);
    addLocalBox(steel, map, xf, -0.2, -0.03, 0.05, 0.4, 0.06, 0.07, 0.9);
    addLocalBox(steel, map, xf, -0.055, -0.02, 0.12, 0.11, 0.05, Math.max(0.35, len - 0.1), 1);
}

function addPerson(cloth, skin, pants, steel, x, z, xf, swing, fisher) {
    const skinUv = [0.58, 0.22, 0.72, 0.78];
    const hairUv = [0.8, 0.15, 0.97, 0.85];
    addBox(pants, x + 0.05, 0, z + 0.07, 0.15, 0.5, 0.16, xf);
    addBox(pants, x + 0.28, 0, z + 0.07, 0.15, 0.5, 0.16, xf);
    addBox(cloth, x + 0.02, 0.48, z + 0.03, 0.44, 0.46, 0.24, xf);
    addBox(cloth, x - 0.1, 0.52, z + 0.07, 0.12, 0.34, 0.14, xf);
    addBox(cloth, x + 0.46, 0.52, z + 0.07, 0.12, 0.34, 0.14, xf);
    addBox(skin, x - 0.1, 0.46, z + 0.08, 0.12, 0.08, 0.12, xf, skinUv);
    addBox(skin, x + 0.46, 0.46, z + 0.08, 0.12, 0.08, 0.12, xf, skinUv);
    addHead(skin, x + 0.1, 0.9, z + 0.05, 0.28, 0.28, 0.2, xf);
    addBox(skin, x + 0.04, 1.0, z + 0.1, 0.06, 0.09, 0.07, xf, skinUv);
    addBox(skin, x + 0.38, 1.0, z + 0.1, 0.06, 0.09, 0.07, xf, skinUv);
    addBox(skin, x + 0.08, 1.14, z + 0.03, 0.32, 0.08, 0.24, xf, hairUv);
    addBox(skin, x + 0.12, 0.96, z + 0.25, 0.24, 0.18, 0.05, xf, hairUv);
    if (fisher) addBox(pants, x + 0.48, 0.72, z - 0.45, 0.04, 0.04, 0.72, xf);
    else addSword(steel, pants, x, z, swing == null ? -1 : swing, xf);
}

const men = [];
let actorsDirty = true;

function pathPose(points, dist) {
    let left = dist;
    for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const len = Math.hypot(dx, dz) || 0.0001;
        if (left <= len || i === points.length - 2) {
            const t = Math.min(1, left / len);
            return {
                x: start.x + dx * t,
                z: start.z + dz * t,
                yaw: Math.atan2(-dx, -dz),
                rx: dz / len,
                rz: -dx / len
            };
        }
        left -= len;
    }
    const last = points[points.length - 1];
    return { x: last.x, z: last.z, yaw: 0, rx: 1, rz: 0 };
}

function homeOf(place, slot) {
    const col = slot % 4;
    const row = Math.floor(slot / 4);
    return {
        x: place.ox + (-1.7 + col * 1.15) + 0.24,
        z: place.oz + (-9 + row * 1.15) + 0.14
    };
}

function personXf(man) {
    const c = Math.cos(man.yaw);
    const s = Math.sin(man.yaw);
    const slash = man.swing > 0 ? Math.sin(man.swing * Math.PI) : 0;
    const lunge = slash * 0.26;
    return (px, py, pz) => {
        const lx = px - man.x;
        const lz = pz - man.z;
        return [
            man.x + lx * c + lz * s - s * lunge,
            py + man.bob - man.down,
            man.z - lx * s + lz * c - c * lunge
        ];
    };
}

function mulMat4(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        }
    }
    return out;
}

function legMatrix(man, hip, angle) {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const hy = hip[1];
    const hz = hip[2];
    const local = new Float32Array([
        1, 0, 0, 0,
        0, ca, sa, 0,
        0, -sa, ca, 0,
        0, hy - ca * hy + sa * hz, hz - sa * hy - ca * hz, 1
    ]);
    return mulMat4(personMatrix(man), local);
}

function plant(man) {
    if (man.archer) return;
    if (man.floorY != null) {
        man.stand = man.floorY;
        return;
    }
    man.stand = Math.max(0, World.heightAt(man.x, man.z));
}

function personMatrix(man) {
    const yaw = man.yaw + Math.PI;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const slash = man.swing > 0 ? Math.sin(man.swing * Math.PI) : 0;
    const lunge = slash * 0.22;
    const y = (man.stand || 0) + man.bob - Math.min(man.down, 1.05);
    const px = man.x + Math.sin(man.yaw) * lunge;
    const pz = man.z - Math.cos(man.yaw) * lunge;
    return new Float32Array([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        px, y, pz, 1
    ]);
}

function swordMatrix(man, hand) {
    const yaw = man.yaw + Math.PI;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const tilt = -0.38;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const slash = man.swing > 0 ? Math.sin(man.swing * Math.PI) : 0;
    const lunge = slash * 0.22;
    const y = (man.stand || 0) + man.bob - Math.min(man.down, 1.05);
    const hx = Math.min(hand[0] - 0.16, -0.36);
    const hy = hand[1] - 0.04;
    const hz = hand[2] + 0.04;
    const px = man.x + Math.sin(man.yaw) * lunge;
    const pz = man.z - Math.cos(man.yaw) * lunge;
    return new Float32Array([
        c * ct, st, s * ct, 0,
        -c * st, ct, -s * st, 0,
        -s, 0, c, 0,
        px + c * hx + s * hz, y + hy, pz - s * hx + c * hz, 1
    ]);
}

function bowMatrix(man) {
    const yaw = man.yaw + Math.PI;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const y = (man.stand || 0) + man.bob - Math.min(man.down, 1.05);
    const hx = 0.3;
    const hy = 0.92;
    const hz = 0.22;
    return new Float32Array([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        man.x + c * hx - s * hz, y + hy, man.z + s * hx + c * hz, 1
    ]);
}

function rebuildMesh() {
    if (peopleReady) {
        actorsDirty = false;
        return;
    }
    const skin = [];
    const pants = [];
    const steel = [];
    const cloth = [[], [], [], []];
    for (const man of men) {
        if (man.hidden) continue;
        addPerson(cloth[man.faction], skin, pants, steel, man.x - 0.24, man.z - 0.14, personXf(man), man.swing, man.fisher);
    }
    for (let i = 0; i < 4; i++) uploadMesh("cloth" + i, cloth[i]);
    uploadMesh("skin", skin);
    uploadMesh("pants", pants);
    uploadMesh("steel", steel);
    actorsDirty = false;
}

function mergeMen(data) {
    const attacks = new Map((data.attacks || []).map((attack) => [attack.id, attack]));
    const wanted = [];
    data.factions.forEach((faction, factionIndex) => {
        (faction.units || []).forEach((unit) => {
            if (unit.health <= 0) return;
            const place = places[unit.post];
            const home = homeOf(place, unit.slot || 0);
            const attack = unit.attack ? attacks.get(unit.attack) : null;
            wanted.push({
                faction: factionIndex,
                index: unit.index,
                health: unit.health,
                post: unit.post,
                mode: unit.mode || "guard",
                slot: unit.slot || 0,
                homeX: home.x,
                homeZ: home.z,
                path: attack ? attack.path : null,
                startedAt: attack ? attack.startedAt : 0,
                arriveAt: attack ? attack.arriveAt : 0,
                length: attack ? attack.length : 0
            });
        });
    });
    const prev = new Map(men.filter((man) => !man.fisher && !man.archer && !man.decor && !man.driver).map((man) => [man.faction + ":" + man.index, man]));
    const next = [];
    const keep = new Set();
    for (const item of wanted) {
        const key = item.faction + ":" + item.index;
        const old = prev.get(key);
        keep.add(key);
        if (old) {
            old.health = pendingHit ? Math.min(old.health, item.health) : item.health;
            old.post = item.post;
            old.mode = item.mode;
            old.slot = item.slot;
            old.homeX = item.homeX;
            old.homeZ = item.homeZ;
            old.path = item.path;
            old.startedAt = item.startedAt;
            old.arriveAt = item.arriveAt;
            old.length = item.length;
            if (old.health <= 0) old.dying = true;
            next.push(old);
        } else {
            next.push({
                faction: item.faction,
                index: item.index,
                health: item.health,
                post: item.post,
                mode: item.mode,
                slot: item.slot,
                x: item.homeX,
                z: item.homeZ,
                homeX: item.homeX,
                homeZ: item.homeZ,
                path: item.path,
                startedAt: item.startedAt,
                arriveAt: item.arriveAt,
                length: item.length,
                yaw: 0,
                bob: 0,
                down: 0,
                hostile: false,
                attackIn: 0.8,
                striking: 0,
                struck: false,
                dying: false
            });
        }
    }
    const keptFish = men.filter((man) => man.fisher || man.archer || man.decor || man.driver);
    for (const man of men) {
        if (man.fisher || man.archer || man.decor || man.driver) continue;
        const key = man.faction + ":" + man.index;
        if (keep.has(key)) continue;
        man.dying = true;
        man.health = 0;
        next.push(man);
    }
    men.length = 0;
    men.push(...next, ...keptFish);
    actorsDirty = true;
}

let soldierKey = "";
let pendingHit = 0;
let seenRestart = 0;
let campaign = null;

function applyCampaign(data) {
    rememberPlay(data);
    const stamp = Number(data && data.restartedAt) || 0;
    if (stamp < seenRestart) return;
    seenRestart = Math.max(seenRestart, stamp);
    campaign = data;
    const units = data.factions.map((faction) => (
        (faction.units || []).map((unit) => unit.index + ":" + unit.health + ":" + unit.mode + ":" + unit.post).join(".")
    )).join("|");
    const attacks = (data.attacks || []).map((attack) => attack.id).join(",");
    const fish = (data.fishermen || []).map((man) => man.village + ":" + man.slot + ":" + man.health + ":" + man.cycleStart + ":" + man.walkMs + ":" + (man.bed || "")).join(",");
    const wood = (data.woodcutters || []).map((man) => man.id + ":" + man.village + ":" + man.health + ":" + man.cycleStart + ":" + man.to.x.toFixed(1) + ":" + (man.bed || "")).join(",");
    const carts = (data.lodges || []).map((lodge) => lodge.id + ":" + lodge.cart.phase + ":" + lodge.cart.driver + ":" + lodge.cart.hp + ":" + lodge.cart.cargo).join(",");
    const arch = (data.archers || []).map((row, village) => (
        ((data.owners || [])[village] || 0) + ":" + (row || []).join(".")
    )).join(",");
    const key = (data.owners || []).join(",") + "#" + attacks + "#" + units + "#" + fish + "#" + wood + "#" + arch + "#" + carts;
    if (key === soldierKey) {
        ensureCottages(data);
        return;
    }
    soldierKey = key;
    ensureCottages(data);
    mergeMen(data);
    mergeFishermen(data);
    mergeArchers(data);
    mergeDrivers(data);
}

function villagerKey(man) {
    return man.village + ":" + (man.wood ? "w" : "f") + ":" + (man.slot || 0);
}

function mergeFishermen(data) {
    const wanted = (data.fishermen || []).map((item) => Object.assign({ wood: false }, item)).concat(
        (data.woodcutters || []).map((item) => Object.assign({ wood: true }, item))
    );
    const prev = new Map(men.filter((man) => man.fisher).map((man) => [villagerKey(man), man]));
    const keep = new Set();
    const nextFish = [];
    for (const item of wanted) {
        if (item.health <= 0) continue;
        const key = villagerKey(item);
        keep.add(key);
        const old = prev.get(key);
        if (old) {
            old.health = pendingHit ? Math.min(old.health, item.health) : item.health;
            old.faction = item.owner;
            old.cycleStart = item.cycleStart;
            old.walkMs = item.walkMs;
            old.wood = item.wood;
            old.slot = item.slot || 0;
            old.woodId = item.id;
            old.fromX = item.from.x;
            old.fromZ = item.from.z;
            old.viaX = item.via ? item.via.x : null;
            old.viaZ = item.via ? item.via.z : null;
            old.toX = item.to.x;
            old.toZ = item.to.z;
            old.path = item.path || null;
            old.asleep = !!item.asleep;
            old.shelter = !!item.shelter;
            old.bed = item.bed || "manor";
            if (old.health <= 0) old.dying = true;
            nextFish.push(old);
        } else {
            nextFish.push({
                fisher: true,
                wood: item.wood,
                woodId: item.id,
                village: item.village,
                slot: item.slot || 0,
                faction: item.owner,
                index: -1 - item.village - (item.wood ? 10 : 0) - (item.slot || 0),
                health: item.health,
                post: item.village,
                mode: item.wood ? "wood" : "fish",
                x: item.from.x,
                z: item.from.z,
                fromX: item.from.x,
                fromZ: item.from.z,
                viaX: item.via ? item.via.x : null,
                viaZ: item.via ? item.via.z : null,
                toX: item.to.x,
                toZ: item.to.z,
                path: item.path || null,
                asleep: !!item.asleep,
                shelter: !!item.shelter,
                bed: item.bed || "manor",
                cycleStart: item.cycleStart,
                walkMs: item.walkMs,
                yaw: 0,
                bob: 0,
                down: 0,
                hostile: false,
                attackIn: 0,
                striking: 0,
                struck: false,
                dying: false,
                swing: -1
            });
        }
    }
    for (const man of men) {
        if (!man.fisher || keep.has(villagerKey(man))) continue;
        man.dying = true;
        man.health = 0;
        nextFish.push(man);
    }
    const soldiers = men.filter((man) => !man.fisher);
    men.length = 0;
    men.push(...soldiers, ...nextFish);
}

function clientCartPose(cart) {
    if (!cart) return { x: 0, z: 0, yaw: 0 };
    if (cart.phase === "stopped") return { x: cart.stopX, z: cart.stopZ, yaw: cart.yaw || 0 };
    if (cart.phase === "parked" || !cart.path || cart.path.length < 2) {
        return { x: cart.parkX, z: cart.parkZ, yaw: cart.parkYaw || 0 };
    }
    const travel = Math.max(1, cart.arriveAt - cart.startedAt);
    const along = Math.max(0, Math.min(1, (Date.now() - cart.startedAt) / travel));
    return pathPose(cart.path, along * (cart.length || 0));
}

function mergeDrivers(data) {
    const wanted = (data.lodges || []).filter((lodge) => lodge.cart && lodge.cart.driver > 0);
    const prev = new Map(men.filter((man) => man.driver).map((man) => [man.lodge, man]));
    const keep = new Set();
    const next = [];
    for (const lodge of wanted) {
        keep.add(lodge.id);
        const old = prev.get(lodge.id);
        if (old) {
            old.health = pendingHit ? Math.min(old.health, lodge.cart.driver) : lodge.cart.driver;
            old.faction = lodge.owner;
            if (old.health <= 0) old.dying = true;
            next.push(old);
        } else {
            const pose = clientCartPose(lodge.cart);
            next.push({
                driver: true,
                fisher: false,
                decor: false,
                lodge: lodge.id,
                faction: lodge.owner,
                index: -90 - lodge.village,
                health: lodge.cart.driver,
                post: lodge.village,
                mode: "drive",
                x: pose.x,
                z: pose.z,
                yaw: pose.yaw,
                bob: 0,
                down: 0,
                swing: -1,
                walking: true,
                hostile: false,
                attackIn: 0,
                striking: 0,
                struck: false,
                dying: false
            });
        }
    }
    for (const man of men) {
        if (!man.driver || keep.has(man.lodge)) continue;
        man.dying = true;
        man.health = 0;
        next.push(man);
    }
    const rest = men.filter((man) => !man.driver);
    men.length = 0;
    men.push(...rest, ...next);
}

const cottageMeshes = { cotWall: [], cotRoof: [], cotDoor: [], cotWood: [], cotGlow: [] };
const builtLodges = new Set();

function buildCottage(lodge) {
    const x = lodge.x;
    const z = lodge.z;
    const w = lodge.w;
    const d = lodge.d;
    const facing = lodge.facing;
    const y = lodge.ground || 0;
    const h = 2.55;
    const t = 0.28;
    const doorW = 1.5;
    const doorH = 2.05;
    const parts = [];
    const wall = (px, pz, ww, dd, y0, y1) => {
        addBox(cottageMeshes.cotWall, px, y0, pz, ww, Math.max(0.08, y1 - y0), dd);
        parts.push({ x: px, z: pz, w: ww, d: dd, y0: y0, y1: y1 });
    };
    if (facing === "south" || facing === "north") {
        const front = facing === "south" ? z + d - t : z;
        const back = facing === "south" ? z : z + d - t;
        wall(x, back, w, t, y, y + h);
        wall(x, z, t, d, y, y + h);
        wall(x + w - t, z, t, d, y, y + h);
        const gapX = x + (w - doorW) / 2;
        wall(x, front, Math.max(0.08, gapX - x), t, y, y + h);
        wall(gapX + doorW, front, Math.max(0.08, x + w - gapX - doorW), t, y, y + h);
        wall(gapX, front, doorW, t, y + doorH, y + h);
        addBox(cottageMeshes.cotDoor, gapX + 0.12, y + 0.02, front - 0.02, doorW - 0.24, doorH * 0.9, 0.06);
    } else {
        const front = facing === "east" ? x + w - t : x;
        const back = facing === "east" ? x : x + w - t;
        wall(back, z, t, d, y, y + h);
        wall(x, z, w, t, y, y + h);
        wall(x, z + d - t, w, t, y, y + h);
        const gapZ = z + (d - doorW) / 2;
        wall(front, z, t, Math.max(0.08, gapZ - z), y, y + h);
        wall(front, gapZ + doorW, t, Math.max(0.08, z + d - gapZ - doorW), y, y + h);
        wall(front, gapZ, t, doorW, y + doorH, y + h);
        addBox(cottageMeshes.cotDoor, front - 0.02, y + 0.02, gapZ + 0.12, 0.06, doorH * 0.9, doorW - 0.24);
    }
    const ridge = y + h + 1.05;
    const midZ = z + d / 2;
    pushQuad(
        cottageMeshes.cotRoof,
        [x - 0.15, y + h, z - 0.15, 0, 0, 0.95],
        [x - 0.15, ridge, midZ, 0, 1, 0.95],
        [x + w + 0.15, ridge, midZ, 1, 1, 0.95],
        [x + w + 0.15, y + h, z - 0.15, 1, 0, 0.95]
    );
    pushQuad(
        cottageMeshes.cotRoof,
        [x + w + 0.15, y + h, z + d + 0.15, 0, 0, 0.78],
        [x + w + 0.15, ridge, midZ, 0, 1, 0.78],
        [x - 0.15, ridge, midZ, 1, 1, 0.78],
        [x - 0.15, y + h, z + d + 0.15, 1, 0, 0.78]
    );
    addBox(cottageMeshes.cotGlow, x + 0.55, y + 1.2, z - 0.05, 0.62, 0.48, 0.08);
    addBox(cottageMeshes.cotWood, x + 0.35, y, z + 0.45, 0.7, 0.42, 0.45);
    houses.push({
        open: true,
        village: lodge.village,
        kind: "cottage",
        id: lodge.id,
        nap: lodge.nap || [],
        parts,
        decks: [],
        x: x,
        z: z,
        w: w,
        d: d,
        h: h
    });
}

function ensureCottages(data) {
    let built = false;
    for (const lodge of data.lodges || []) {
        if (builtLodges.has(lodge.id)) continue;
        builtLodges.add(lodge.id);
        buildCottage(lodge);
        built = true;
    }
    if (!built) return;
    textures.cotWall = textures.wall;
    textures.cotRoof = textures.roof;
    textures.cotDoor = textures.door;
    textures.cotWood = textures.trunk;
    textures.cotGlow = textures.glow;
    uploadMesh("cotWall", cottageMeshes.cotWall);
    uploadMesh("cotRoof", cottageMeshes.cotRoof);
    uploadMesh("cotDoor", cottageMeshes.cotDoor);
    uploadMesh("cotWood", cottageMeshes.cotWood);
    uploadMesh("cotGlow", cottageMeshes.cotGlow);
}

function paintCarts() {
    const list = [];
    const lodges = campaign && campaign.lodges || [];
    for (const lodge of lodges) {
        const cart = lodge.cart;
        if (!cart || cart.hp <= 0) continue;
        const pose = clientCartPose(cart);
        const y = Math.max(0, World.heightAt(pose.x, pose.z));
        const c = Math.cos(pose.yaw);
        const s = Math.sin(pose.yaw);
        const xf = (px, py, pz) => {
            const lx = px - pose.x;
            const lz = pz - pose.z;
            return [pose.x + lx * c + lz * s, py, pose.z - lx * s + lz * c];
        };
        addBox(list, pose.x - 0.75, y + 0.34, pose.z - 0.38, 1.55, 0.12, 0.76, xf);
        addBox(list, pose.x - 0.55, y + 0.46, pose.z - 0.3, 1.05, 0.32, 0.6, xf);
        addBox(list, pose.x - 0.58, y + 0.02, pose.z - 0.26, 0.18, 0.32, 0.18, xf);
        addBox(list, pose.x + 0.42, y + 0.02, pose.z + 0.08, 0.18, 0.32, 0.18, xf);
        if ((cart.cargo || 0) > 0) addBox(list, pose.x - 0.4, y + 0.78, pose.z - 0.22, 0.72, 0.26, 0.44, xf);
    }
    textures.cart = textures.trunk;
    uploadMesh("cart", list);
}

function cartUnder(x, z, faction) {
    const lodges = campaign && campaign.lodges || [];
    const who = faction == null ? homeVillage : faction;
    let best = null;
    let bestDist = 1.35;
    for (const lodge of lodges) {
        if (!lodge.cart || lodge.cart.hp <= 0 || lodge.owner === who) continue;
        const pose = clientCartPose(lodge.cart);
        const dist = Math.hypot(pose.x - x, pose.z - z);
        if (dist < bestDist) {
            best = lodge;
            bestDist = dist;
        }
    }
    return best;
}

function strikeCart(lodge) {
    if (!lodge || !lodge.cart || lodge.cart.hp <= 0) return;
    lodge.cart.hp -= 1;
    showStrike(lodge.cart.hp > 0 ? "Cart " + lodge.cart.hp : "Cart lost");
    postHit({ cart: lodge.id });
}

function archerSpot(village, side) {
    const layout = towerLayout(village, side);
    return {
        x: layout.x + layout.w * 0.5,
        z: layout.z + layout.d * 0.5,
        stand: layout.floor,
        yaw: [0, Math.PI / 2, Math.PI, -Math.PI / 2][side]
    };
}

function mergeArchers(data) {
    const rows = data.archers || [];
    const owners = data.owners || [0, 1, 2, 3];
    const prev = new Map(men.filter((man) => man.archer).map((man) => [man.village + ":" + man.side, man]));
    const next = [];
    const keep = new Set();
    for (let village = 0; village < 4; village++) {
        const row = rows[village] || [];
        for (let side = 0; side < 4; side++) {
            const health = row[side] || 0;
            if (health <= 0) continue;
            const key = village + ":" + side;
            keep.add(key);
            const spot = archerSpot(village, side);
            const old = prev.get(key);
            if (old) {
                old.health = pendingHit ? Math.min(old.health, health) : health;
                old.faction = owners[village];
                if (old.health <= 0) old.dying = true;
                next.push(old);
            } else {
                next.push({
                    archer: true,
                    village,
                    side,
                    faction: owners[village],
                    index: side,
                    health,
                    x: spot.x,
                    z: spot.z,
                    stand: spot.stand,
                    homeYaw: spot.yaw,
                    yaw: spot.yaw,
                    bob: 0,
                    down: 0,
                    attackIn: 0.45 + side * 0.18,
                    dying: false,
                    hostile: false,
                    striking: 0,
                    struck: false,
                    swing: -1,
                    mode: "guard"
                });
            }
        }
    }
    for (const man of men) {
        if (!man.archer) continue;
        if (keep.has(man.village + ":" + man.side)) continue;
        man.dying = true;
        man.health = 0;
        next.push(man);
    }
    const rest = men.filter((man) => !man.archer);
    men.length = 0;
    men.push(...rest, ...next);
    actorsDirty = true;
}

const MORNING_MS = Math.round(8 / 24 * Clock.DAY_MS);
let playBase = null;
let accrued = 0;
let pendingSend = 0;
let accrueAt = 0;

function accrue() {
    const nowMs = Date.now();
    if (document.visibilityState !== "visible") {
        accrueAt = 0;
        return;
    }
    if (accrueAt) accrued += Math.min(1000, Math.max(0, nowMs - accrueAt));
    accrueAt = nowMs;
}

function gameMs() {
    const base = playBase == null ? MORNING_MS : playBase;
    let extra = accrued + pendingSend;
    if (document.visibilityState === "visible" && accrueAt) {
        extra += Math.min(1000, Math.max(0, Date.now() - accrueAt));
    }
    return base + extra;
}

function pullPlay() {
    accrue();
    const send = Math.min(4000, Math.round(accrued));
    if (send > 0) {
        accrued -= send;
        pendingSend += send;
    }
    return send;
}

function rememberPlay(data) {
    if (!data || !Number.isFinite(Number(data.playMs))) return;
    const next = Number(data.playMs);
    if (playBase == null || next >= playBase) playBase = next;
}

function syncCampaign() {
    if (pendingHit) return;
    let url = "/api/campaign";
    let sent = 0;
    if (document.visibilityState === "visible") {
        sent = pullPlay();
        url += "?play=" + sent;
    }
    fetch(url, { cache: "no-store" }).then((res) => res.json()).then((data) => {
        if (sent) pendingSend = Math.max(0, pendingSend - sent);
        applyCampaign(data);
    }).catch(() => {
        if (sent) {
            accrued += sent;
            pendingSend = Math.max(0, pendingSend - sent);
        }
    });
}

function flushPlay() {
    const nowMs = Date.now();
    if (accrueAt) {
        accrued += Math.min(1000, Math.max(0, nowMs - accrueAt));
        accrueAt = 0;
    }
    const sent = Math.min(4000, Math.round(accrued));
    if (sent <= 0) return;
    accrued -= sent;
    pendingSend += sent;
    fetch("/api/campaign?play=" + sent, { cache: "no-store", keepalive: true }).then((res) => res.json()).then((data) => {
        pendingSend = Math.max(0, pendingSend - sent);
        applyCampaign(data);
    }).catch(() => {
        accrued += sent;
        pendingSend = Math.max(0, pendingSend - sent);
    });
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        accrueAt = Date.now();
        return;
    }
    flushPlay();
});
window.addEventListener("pagehide", flushPlay);

let nextSwing = 0;
let nextShot = 0;
let arm = "sword";
try {
    const savedArm = localStorage.getItem("village-arm");
    if (savedArm === "bow" || savedArm === "sword") arm = savedArm;
} catch (err) { /* keep the sword if storage is blocked */ }
const arrows = [];
let strikeTimer = 0;
let swing = null;
let gesture = null;
const strike = document.getElementById("strike");
const weapon = document.getElementById("weapon");
const healthFill = document.getElementById("health-fill");
const hurt = document.getElementById("hurt");
const death = document.getElementById("death");
const swings = {
    thrust: { reach: 2.7, radius: 0.42, side: 0 },
    chop: { reach: 2.05, radius: 0.72, side: 0 },
    "slash-left": { reach: 2.25, radius: 0.9, side: -0.55 },
    "slash-right": { reach: 2.25, radius: 0.9, side: 0.55 }
};

function showStrike(text) {
    strike.textContent = text;
    strike.classList.add("show");
    clearTimeout(strikeTimer);
    strikeTimer = setTimeout(() => strike.classList.remove("show"), 700);
}

function paintHealth() {
    healthFill.style.width = Math.max(0, player.hp / player.max * 100) + "%";
}

function flashHurt() {
    hurt.classList.add("show");
    clearTimeout(flashHurt.timer);
    flashHurt.timer = setTimeout(() => hurt.classList.remove("show"), 380);
}

function hurtPlayer(amount) {
    if (player.dead || player.guard > 0) return;
    player.hp = Math.max(0, player.hp - amount);
    player.guard = 0.45;
    paintHealth();
    flashHurt();
    player.shake = 0.32;
    if (player.hp <= 0) {
        player.dead = 1.8;
        death.hidden = false;
        death.classList.add("show");
        swing = null;
        gesture = null;
    }
}

function respawn() {
    player.hp = player.max;
    player.dead = 0;
    player.guard = 1.4;
    cam.x = places[2].ox;
    cam.y = 1.62;
    cam.z = places[2].oz + 20;
    cam.yaw = 0;
    cam.pitch = 0;
    death.classList.remove("show");
    death.hidden = true;
    paintHealth();
    for (const man of men) {
        man.hostile = false;
        man.striking = 0;
        man.struck = false;
    }
}

function aim() {
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const sy = Math.sin(cam.yaw);
    const cy = Math.cos(cam.yaw);
    return {
        fx: sy * cp,
        fy: sp,
        fz: -cy * cp,
        rx: cy,
        rz: sy
    };
}

function postHit(body) {
    pendingHit += 1;
    soldierKey = "";
    fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body)
    }).then((res) => res.json()).then((data) => {
        pendingHit -= 1;
        if (pendingHit === 0) applyCampaign(data);
    }).catch(() => { pendingHit -= 1; });
}

function wound(man, label, quiet, knockX, knockZ) {
    if (!man || man.dying || man.health <= 0 || man.faction === homeVillage) return false;
    const word = label || "Hit";
    if (man.archer) {
        man.health -= 1;
        if (man.health <= 0) {
            man.dying = true;
            if (!quiet) showStrike("Slain");
        } else if (!quiet) {
            showStrike(word);
        }
        actorsDirty = true;
        postHit({ archer: man.village, tower: man.side });
        return true;
    }
    if (man.driver) {
        man.health -= 1;
        if (man.health <= 0) {
            man.dying = true;
            if (!quiet) showStrike("Slain");
        } else if (!quiet) {
            showStrike(word);
        }
        actorsDirty = true;
        postHit({ driver: man.lodge });
        return true;
    }
    if (man.fisher) {
        man.health -= 1;
        if (man.health <= 0) {
            man.dying = true;
            if (!quiet) showStrike("Slain");
        } else if (!quiet) {
            showStrike(word);
        }
        actorsDirty = true;
        postHit(man.wood ? { woodcutter: man.woodId } : { fisherman: man.village });
        return true;
    }
    const faction = campaign && campaign.factions[man.faction];
    const unit = faction && (faction.units || []).find((item) => item.index === man.index);
    if (!unit || unit.health <= 0) return false;
    unit.health -= 1;
    man.health = unit.health;
    man.hostile = true;
    man.attackIn = Math.max(man.attackIn, 0.35);
    if (unit.health <= 0) {
        faction.alive = Math.max(0, (faction.alive || 0) - 1);
        man.dying = true;
        if (!quiet) showStrike("Slain");
    } else if (!quiet) {
        showStrike(word);
    }
    if (knockX || knockZ) {
        const nx = man.x + (knockX || 0);
        const nz = man.z + (knockZ || 0);
        if (!blocked(nx, man.z, man.faction)) man.x = nx;
        if (!blocked(man.x, nz, man.faction)) man.z = nz;
    }
    if (!quiet) {
        for (const other of men) {
            if (other.dying || other.archer || other.faction !== man.faction || other.faction === homeVillage) continue;
            const near = Math.hypot(other.x - man.x, other.z - man.z);
            if (near < 12) {
                other.hostile = true;
                if (other.attackIn <= 0) other.attackIn = 0.3 + Math.random() * 0.6;
            }
        }
    }
    actorsDirty = true;
    postHit({ village: man.faction, index: man.index });
    return true;
}

function connectSwing() {
    if (!campaign || !swing) return;
    const profile = swings[swing.kind];
    const { fx, fy, fz, rx, rz } = aim();
    const ox = cam.x + rx * profile.side;
    const oz = cam.z + rz * profile.side;
    let best = null;
    let bestT = profile.reach;
    for (const man of men) {
        if (man.dying || man.hidden || man.decor || man.health <= 0 || man.faction === homeVillage) continue;
        const chest = (man.stand || 0) + 0.95;
        const dx = man.x - ox;
        const dy = chest - cam.y;
        const dz = man.z - oz;
        const t = dx * fx + dy * fy + dz * fz;
        if (t < 0.4 || t > profile.reach) continue;
        const wide = Math.hypot(dx - fx * t, dz - fz * t);
        const high = Math.abs(dy - fy * t);
        if (wide < profile.radius && high < 1.4 && t < bestT) {
            best = man;
            bestT = t;
        }
    }
    const gate = gateInReach(ox, oz, fx, fy, fz, profile.reach);
    if (gate && gate.t < bestT) {
        strikeGate(gate);
        return;
    }
    if (!best) {
        const cart = cartUnder(ox + fx * Math.min(1.4, profile.reach), oz + fz * Math.min(1.4, profile.reach));
        if (cart) strikeCart(cart);
        return;
    }
    const label = swing.kind === "chop" ? "Chop" : swing.kind === "thrust" ? "Thrust" : "Slash";
    wound(best, label, false, fx * 0.28, fz * 0.28);
}

function startSwing(kind) {
    if (arm !== "sword" || player.dead || swing || !swings[kind]) return;
    const now = performance.now();
    if (now < nextSwing) return;
    nextSwing = now + 480;
    swing = { kind, age: 0, hit: false };
    weapon.classList.remove("swing-thrust", "swing-chop", "swing-slash-left", "swing-slash-right");
    void weapon.offsetWidth;
    weapon.classList.add("swing-" + kind);
}

function resolveSwing(g) {
    const adx = Math.abs(g.x);
    const ady = Math.abs(g.y);
    let kind = "thrust";
    if (adx > 26 || ady > 26) {
        if (adx > ady) kind = g.x > 0 ? "slash-right" : "slash-left";
        else if (g.y > 0) kind = "chop";
    }
    startSwing(kind);
}

function nearestFoe(man) {
    let best = null;
    let bestDist = 38;
    for (const other of men) {
        if (other === man || other.dying || other.health <= 0 || other.fisher) continue;
        if (other.faction === man.faction || other.mode === "guard") continue;
        const dist = Math.hypot(other.x - man.x, other.z - man.z);
        if (dist < bestDist) {
            best = other;
            bestDist = dist;
        }
    }
    return best;
}

function moveToward(man, x, z, dt, speed) {
    const dx = x - man.x;
    const dz = z - man.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    man.yaw = Math.atan2(-dx, -dz);
    if (dist < 1.2) return false;
    const step = Math.min(speed * dt, dist - 1.05);
    const nx = man.x + (dx / dist) * step;
    const nz = man.z + (dz / dist) * step;
    if (!blocked(nx, man.z, man.faction)) man.x = nx;
    if (!blocked(man.x, nz, man.faction)) man.z = nz;
    return true;
}

function building(village, kind) {
    return houses.find((house) => house.village === village && house.kind === kind);
}

function followRoute(man, dt, speed) {
    const points = man.route;
    if (!points || !points.length) return true;
    const leg = man.leg || 0;
    if (leg >= points.length) return true;
    const goal = points[leg];
    const prev = points[Math.max(0, leg - 1)];
    if (!goal || !prev) return true;
    const dx = goal.x - man.x;
    const dz = goal.z - man.z;
    const dist = Math.hypot(dx, dz);
    const span = Math.hypot(goal.x - prev.x, goal.z - prev.z) || 1;
    const along = 1 - Math.min(1, dist / span);
    man.floorY = (prev.y || 0) + ((goal.y || 0) - (prev.y || 0)) * along;
    if (dist <= speed * dt + 0.04) {
        man.x = goal.x;
        man.z = goal.z;
        man.floorY = goal.y || 0;
        man.leg = leg + 1;
        if (man.leg >= points.length) return true;
    } else {
        man.x += dx / dist * Math.min(speed * dt, dist);
        man.z += dz / dist * Math.min(speed * dt, dist);
        man.yaw = Math.atan2(-dx, -dz);
    }
    man.walking = true;
    man.stand = man.floorY;
    return false;
}

function startTrip(man, points, key) {
    if (man.trip === key) return;
    man.trip = key;
    man.route = points;
    man.leg = 0;
    man.hidden = false;
    man.indoors = true;
    man.floorY = points[0] ? points[0].y || 0 : 0;
}

function stepIndoor(man, points, dt, speed, mode, key) {
    if (!points || points.length < 2) return false;
    startTrip(man, points, key);
    const done = followRoute(man, dt, speed);
    if (!done) return true;
    if (mode === "hide") {
        man.hidden = true;
        man.walking = false;
        man.floorY = points[points.length - 1].y || 0;
        return true;
    }
    if (mode === "stay") {
        man.hidden = false;
        man.walking = false;
        return true;
    }
    man.hidden = false;
    man.indoors = false;
    man.floorY = null;
    man.trip = "";
    man.route = null;
    return false;
}

function sleepNap(man) {
    if (man.bed && man.bed !== "manor") {
        const lodge = houses.find((house) => house.kind === "cottage" && house.id === man.bed);
        if (lodge && lodge.nap && lodge.nap.length) return lodge.nap;
    }
    const house = building(man.post, "manor");
    return house && house.nap;
}

function stepFisher(man, dt) {
    const nap = sleepNap(man);
    if (nap && (man.asleep || man.shelter)) {
        const goal = man.asleep ? nap : nap.slice(0, 2);
        const here = { x: man.x, z: man.z, y: man.floorY || 0 };
        stepIndoor(man, [here].concat(goal), dt, 2.2, man.asleep ? "hide" : "stay", (man.asleep ? "bed" : "safe") + man.post);
        man.swing = -1;
        man.hostile = false;
        man.mode = "fish";
        plant(man);
        return false;
    }
    if (man.hidden || man.indoors) {
        const out = nap ? nap.slice().reverse() : [];
        if (stepIndoor(man, out, dt, 2.2, "leave", "out" + man.post)) {
            plant(man);
            return false;
        }
        man.rejoin = true;
    }
    const fishMs = 30000;
    const walkMs = Math.max(1, man.walkMs || 1);
    const period = walkMs * 2 + fishMs;
    let t = (Date.now() - man.cycleStart) % period;
    if (t < 0) t = 0;
    let along = 0;
    let outward = true;
    if (t < walkMs) along = t / walkMs;
    else if (t < walkMs + fishMs) along = 1;
    else {
        outward = false;
        along = 1 - (t - walkMs - fishMs) / walkMs;
    }
    const spot = fisherSpot(man, along);
    if (man.rejoin) {
        const dx = spot.x - man.x;
        const dz = spot.z - man.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.4) man.rejoin = false;
        else {
            const step = Math.min(2.2 * dt, dist);
            man.x += dx / dist * step;
            man.z += dz / dist * step;
            man.yaw = Math.atan2(-dx, -dz);
            man.floorY = null;
            man.walking = true;
            plant(man);
            man.swing = -1;
            man.hostile = false;
            return false;
        }
    }
    man.x = spot.x;
    man.z = spot.z;
    man.floorY = null;
    const face = outward ? 1 : -1;
    man.yaw = Math.atan2(-spot.dx * face, -spot.dz * face);
    const walking = t < walkMs || t >= walkMs + fishMs;
    man.walking = walking;
    man.bob = Math.sin(performance.now() * (walking ? 0.01 : 0.004)) * (walking ? 0.04 : 0.02);
    man.swing = -1;
    man.hostile = false;
    man.mode = "fish";
    plant(man);
    actorsDirty = true;
    return false;
}

const BOW_RANGE = 22;

function archerTarget(man) {
    let best = null;
    let bestDist = BOW_RANGE;
    if (man.faction !== homeVillage && !player.dead) {
        const dist = Math.hypot(cam.x - man.x, cam.z - man.z);
        if (dist < bestDist && dist > 1.2) {
            best = { x: cam.x, y: cam.y - 0.35, z: cam.z };
            bestDist = dist;
        }
    }
    for (const other of men) {
        if (other === man || other.dying || other.health <= 0 || other.faction === man.faction) continue;
        const dist = Math.hypot(other.x - man.x, other.z - man.z);
        if (dist < bestDist && dist > 1.2) {
            best = { x: other.x, y: (other.stand || 0) + 1, z: other.z };
            bestDist = dist;
        }
    }
    return best;
}

function launchArrow(from, x, y, z, tx, ty, tz, gravity) {
    const dx = tx - x;
    const dy = ty - y;
    const dz = tz - z;
    const dist = Math.hypot(dx, dy, dz) || 0.001;
    const speed = 30;
    const time = dist / speed;
    arrows.push({
        x,
        y,
        z,
        vx: dx / dist * speed,
        vy: gravity ? dy / time + 0.5 * gravity * time : dy / dist * speed,
        vz: dz / dist * speed,
        faction: from,
        fromPlayer: from === homeVillage && !gravity,
        age: 0,
        gravity: gravity || 0
    });
}

function shootArrow() {
    if (arm !== "bow" || player.dead) return;
    const now = performance.now();
    if (now < nextShot) return;
    nextShot = now + 680;
    const view = document.getElementById("viewbow");
    if (view) {
        view.classList.remove("loose");
        void view.offsetWidth;
        view.classList.add("loose");
    }
    const a = aim();
    const speed = 36;
    arrows.push({
        x: cam.x + a.fx * 0.55,
        y: cam.y - 0.06 + a.fy * 0.55,
        z: cam.z + a.fz * 0.55,
        vx: a.fx * speed,
        vy: a.fy * speed,
        vz: a.fz * speed,
        faction: homeVillage,
        fromPlayer: true,
        age: 0,
        gravity: 0,
        range: BOW_RANGE,
        ox: cam.x,
        oz: cam.z
    });
}

function sweptNear(x0, y0, z0, x1, y1, z1, cx, cy, cz, radius, yTol) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len2 = dx * dx + dy * dy + dz * dz || 1;
    let t = ((cx - x0) * dx + (cy - y0) * dy + (cz - z0) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    const pz = z0 + dz * t;
    return Math.hypot(px - cx, pz - cz) < radius && Math.abs(py - cy) < yTol;
}

function arrowGate(arrow, x0, y0, z0) {
    if (!arrow.fromPlayer || !campaign || !campaign.owners) return null;
    for (let village = 0; village < 4; village++) {
        if (campaign.owners[village] === homeVillage) continue;
        for (let side = 0; side < 4; side++) {
            if (gateHealth(village, side) <= 0) continue;
            const spot = gateCenter(village, side);
            if (sweptNear(x0, y0, z0, arrow.x, arrow.y, arrow.z, spot.x, 1.15, spot.z, 1.05, 1.05)) {
                return { village, side };
            }
        }
    }
    return null;
}

function wallStops(x0, y0, z0, x1, y1, z1) {
    const cross = (axis, at, span0, span1, gap) => {
        const d0 = axis === "z" ? z0 : x0;
        const d1 = axis === "z" ? z1 : x1;
        const delta = d1 - d0;
        if (Math.abs(delta) < 0.0001) return false;
        const t = (at - d0) / delta;
        if (t < 0 || t > 1) return false;
        const along0 = axis === "z" ? x0 : z0;
        const along = along0 + ((axis === "z" ? x1 - x0 : z1 - z0) * t);
        if (along < Math.min(span0, span1) || along > Math.max(span0, span1)) return false;
        if (Math.abs(along - gap) < GATE_HALF + 0.2) return false;
        return y0 + (y1 - y0) * t < 2.25;
    };
    for (let village = 0; village < 4; village++) {
        const box = palisadeBox(village);
        if (cross("z", box.minZ, box.minX, box.maxX, box.cx)) return true;
        if (cross("z", box.maxZ, box.minX, box.maxX, box.cx)) return true;
        if (cross("x", box.minX, box.minZ, box.maxZ, box.cz)) return true;
        if (cross("x", box.maxX, box.minZ, box.maxZ, box.cz)) return true;
    }
    return false;
}

function stepArrows(dt) {
    for (let i = arrows.length - 1; i >= 0; i--) {
        const arrow = arrows[i];
        const x0 = arrow.x;
        const y0 = arrow.y;
        const z0 = arrow.z;
        arrow.vy -= arrow.gravity * dt;
        arrow.x += arrow.vx * dt;
        arrow.y += arrow.vy * dt;
        arrow.z += arrow.vz * dt;
        arrow.age += dt;
        if (arrow.range) {
            const traveled = Math.hypot(arrow.x - arrow.ox, arrow.z - arrow.oz);
            if (traveled >= arrow.range) {
                const before = Math.hypot(x0 - arrow.ox, z0 - arrow.oz);
                const span = traveled - before || 1;
                const clamp = Math.max(0, Math.min(1, (arrow.range - before) / span));
                arrow.x = x0 + (arrow.x - x0) * clamp;
                arrow.y = y0 + (arrow.y - y0) * clamp;
                arrow.z = z0 + (arrow.z - z0) * clamp;
            }
        }
        let hit = false;
        if (campaign) {
            for (const man of men) {
                if (man.dying || man.hidden || man.decor || man.health <= 0 || man.faction === arrow.faction) continue;
                const chest = (man.stand || 0) + 0.95;
                if (!sweptNear(x0, y0, z0, arrow.x, arrow.y, arrow.z, man.x, chest, man.z, 0.48, 1.05)) continue;
                const speed = Math.hypot(arrow.vx, arrow.vz) || 1;
                wound(man, "Shot", !arrow.fromPlayer, arrow.vx / speed * 0.2, arrow.vz / speed * 0.2);
                hit = true;
                break;
            }
            if (!hit) {
                const lodge = cartUnder(arrow.x, arrow.z, arrow.faction);
                if (lodge) {
                    const pose = clientCartPose(lodge.cart);
                    if (sweptNear(x0, y0, z0, arrow.x, arrow.y, arrow.z, pose.x, 0.7, pose.z, 1.15, 0.8)) {
                        strikeCart(lodge);
                        hit = true;
                    }
                }
            }
        }
        if (!hit && arrow.faction !== homeVillage && !player.dead) {
            if (sweptNear(x0, y0, z0, arrow.x, arrow.y, arrow.z, cam.x, cam.y - 0.55, cam.z, 0.46, 1.05)) {
                hurtPlayer(8);
                hit = true;
            }
        }
        if (!hit) {
            const gate = arrowGate(arrow, x0, y0, z0);
            if (gate) {
                strikeGate(gate);
                hit = true;
            }
        }
        if (!hit && wallStops(x0, y0, z0, arrow.x, arrow.y, arrow.z)) hit = true;
        if (!hit && arrow.range && Math.hypot(arrow.x - arrow.ox, arrow.z - arrow.oz) >= arrow.range - 0.05) hit = true;
        if (!hit && arrow.y < World.heightAt(arrow.x, arrow.z) + 0.2) hit = true;
        if (hit || arrow.age > 1.5 || arrow.y < -4) {
            arrows.splice(i, 1);
        }
    }
}

function stepArcher(man, dt) {
    const target = archerTarget(man);
    man.swing = -1;
    man.hostile = false;
    if (target) {
        man.yaw = Math.atan2(-(target.x - man.x), -(target.z - man.z));
        man.attackIn -= dt;
        if (man.attackIn <= 0) {
            man.attackIn = 1.55;
            launchArrow(man.faction, man.x, (man.stand || 0) + 1.28, man.z, target.x, target.y, target.z, 9);
        }
    } else {
        man.yaw = man.homeYaw;
        man.attackIn = Math.min(man.attackIn, 0.4);
    }
    man.bob = Math.sin(performance.now() * 0.004 + man.side) * 0.015;
    man.walking = false;
    return false;
}

function postAttacked(post) {
    if (!campaign || !campaign.attacks) return false;
    return campaign.attacks.some((attack) => !attack.resolved && attack.to === post);
}

function guardsAt(post) {
    return men.filter((man) => (
        !man.fisher && !man.archer && !man.decor && !man.dying && man.health > 0 && man.post === post && man.mode !== "march"
    )).sort((a, b) => (a.slot || 0) - (b.slot || 0));
}

function stepSoldierRest(man, dt) {
    if (man.mode === "march") return false;
    const roster = guardsAt(man.post);
    const index = roster.indexOf(man);
    const attacked = postAttacked(man.post) || man.mode === "battle";
    const wants = !attacked && Clock.soldierAsleep(index, roster.length, gameMs());
    const house = building(man.post, "barracks");
    const nap = house && house.nap;
    if (!nap || index < 0) return false;
    if (wants) {
        stepIndoor(man, [{ x: man.x, z: man.z, y: man.floorY || 0 }].concat(nap), dt, 2.2, "hide", "sb" + man.index);
        plant(man);
        return true;
    }
    if (man.hidden || man.indoors) {
        if (!man.riseAt) man.riseAt = performance.now() + index * 420;
        if (performance.now() < man.riseAt) return true;
        if (stepIndoor(man, nap.slice().reverse(), dt, 4.5, "leave", "so" + man.index)) {
            plant(man);
            return true;
        }
        man.riseAt = 0;
    }
    return false;
}

function stepKeeper(man, dt) {
    const house = building(man.post, "shop");
    if (!house || !house.nap) return false;
    if (campaign && campaign.owners) man.faction = campaign.owners[man.post];
    if (!Clock.shopOpen(gameMs())) {
        stepIndoor(man, [{ x: man.x, z: man.z, y: man.floorY || 0 }].concat(house.nap), dt, 2.2, "hide", "kb" + man.post);
    } else if (man.hidden || man.indoors) {
        stepIndoor(man, house.nap.slice().reverse(), dt, 2.2, "leave", "ko" + man.post);
    } else if (house.keeper) {
        man.x = house.keeper.x;
        man.z = house.keeper.z;
        man.yaw = house.keeper.yaw;
        man.floorY = null;
        man.walking = false;
    }
    man.swing = -1;
    man.hostile = false;
    plant(man);
    return false;
}

function stepDriver(man, dt) {
    const lodge = (campaign && campaign.lodges || []).find((item) => item.id === man.lodge);
    const cart = lodge && lodge.cart;
    if (!cart || cart.driver <= 0) {
        man.hidden = true;
        man.walking = false;
        return false;
    }
    const pose = clientCartPose(cart);
    man.hidden = false;
    man.x = pose.x;
    man.z = pose.z + 0.15;
    man.yaw = pose.yaw;
    man.floorY = null;
    man.walking = cart.phase === "out" || cart.phase === "back";
    man.health = cart.driver;
    man.swing = -1;
    man.hostile = false;
    plant(man);
    return false;
}

function stepMan(man, dt) {
    if (man.dying) {
        man.down += dt * 1.5;
        man.bob = 0;
        man.walking = false;
        actorsDirty = true;
        return man.down > 1.2;
    }
    if (man.driver) return stepDriver(man, dt);
    if (man.archer) return stepArcher(man, dt);
    if (man.decor) return stepKeeper(man, dt);
    if (man.fisher) return stepFisher(man, dt);
    if (stepSoldierRest(man, dt)) return false;
    if (man.mode === "march" && man.path && man.length) {
        const attack = marchAttack(man);
        const travel = Math.max(1, man.arriveAt - man.startedAt);
        const plain = man.length * Math.max(0, Math.min(1, (Date.now() - man.startedAt) / travel));
        const covered = attack ? marchDistance(attack, plain) : plain;
        const back = Math.floor(man.slot / 2) * 1.15;
        const side = man.slot % 2 === 0 ? -0.7 : 0.7;
        const pose = pathPose(man.path, Math.max(0, covered - back));
        man.x = pose.x + pose.rx * side;
        man.z = pose.z + pose.rz * side;
        man.yaw = pose.yaw;
        man.bob = Math.sin(performance.now() * 0.012 + man.index) * 0.05;
        man.hostile = false;
        man.striking = 0;
        const gate = attack && Number.isFinite(attack.gateSide) ? gateSpot(attack.to, attack.gateSide) : null;
        const atGate = gate && gateHealth(attack.to, attack.gateSide) > 0 && Math.hypot(man.x - gate.x, man.z - gate.z) < 3.4;
        if (atGate) {
            const cycle = (performance.now() / 1000 + man.index * 0.17) % 0.8;
            man.swing = cycle < 0.38 ? cycle / 0.38 : -1;
        } else {
            man.swing = -1;
        }
        man.walking = !atGate && Date.now() < man.arriveAt;
        actorsDirty = true;
        return false;
    }
    if (man.mode === "battle") {
        const foe = nearestFoe(man);
        const moving = foe ? moveToward(man, foe.x, foe.z, dt, 2.4) : moveToward(man, man.homeX, man.homeZ, dt, 2.2);
        const reach = foe ? Math.hypot(foe.x - man.x, foe.z - man.z) : 99;
        man.hostile = false;
        man.striking = 0;
        if (foe && reach < 1.8) {
            const cycle = (performance.now() / 1000 + man.index * 0.37) % 0.8;
            man.swing = cycle < 0.38 ? cycle / 0.38 : -1;
        } else {
            man.swing = -1;
        }
        man.bob = moving ? Math.sin(performance.now() * 0.012 + man.index) * 0.05 : 0;
        man.walking = Boolean(moving);
        if (moving || foe) actorsDirty = true;
        return false;
    }
    const dx = cam.x - man.x;
    const dz = cam.z - man.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const place = places[man.post];
    const outsideTown = (x, z) => Math.hypot(x - place.ox, z - place.oz) > townLeash;
    if (man.faction === homeVillage) {
        man.hostile = false;
        man.striking = 0;
    } else if (!man.hostile && dist < 5.6) {
        man.hostile = true;
        man.attackIn = 0.35 + Math.random() * 0.7;
    }
    if (man.hostile && outsideTown(man.x, man.z)) man.hostile = false;
    let moving = false;
    if (man.hostile) {
        man.yaw = Math.atan2(-dx, -dz);
        if (dist > 1.4) {
            const step = Math.min(2.35 * dt, dist - 1.3);
            const nx = man.x + dx / dist * step;
            const nz = man.z + dz / dist * step;
            if (outsideTown(nx, nz)) {
                man.hostile = false;
            } else {
                if (!blocked(nx, man.z, man.faction)) man.x = nx;
                if (!blocked(man.x, nz, man.faction)) man.z = nz;
                moving = true;
            }
        } else if (!player.dead) {
            man.attackIn -= dt;
            if (man.attackIn <= 0) {
                man.attackIn = 1.15 + Math.random() * 0.4;
                man.striking = 0.32;
                man.struck = false;
            }
        }
    } else {
        const hx = man.homeX - man.x;
        const hz = man.homeZ - man.z;
        const home = Math.hypot(hx, hz);
        if (home > 0.08) {
            man.yaw = Math.atan2(-hx, -hz);
            const step = Math.min(1.8 * dt, home);
            const nx = man.x + hx / home * step;
            const nz = man.z + hz / home * step;
            if (!blocked(nx, man.z, man.faction)) man.x = nx;
            if (!blocked(man.x, nz, man.faction)) man.z = nz;
            moving = true;
        } else {
            man.x = man.homeX;
            man.z = man.homeZ;
            man.yaw = 0;
        }
    }
    const stepping = moving;
    if (man.striking > 0) {
        man.striking -= dt;
        man.swing = 1 - Math.max(0, man.striking) / 0.32;
        const reach = Math.hypot(cam.x - man.x, cam.z - man.z);
        if (!man.struck && man.striking < 0.16 && reach < 1.75) {
            man.struck = true;
            hurtPlayer(8);
        }
        moving = true;
    } else {
        man.swing = -1;
    }
    man.bob = moving ? Math.sin(performance.now() * 0.012 + man.index) * 0.05 : 0;
    man.walking = stepping;
    if (moving) actorsDirty = true;
    plant(man);
    return false;
}

function nearPerson(man, range) {
    const dx = man.x - cam.x;
    const dz = man.z - cam.z;
    return dx * dx + dz * dz < range * range;
}

function separateMen(dt) {
    for (let i = 0; i < men.length; i++) {
        const man = men[i];
        if (!nearPerson(man, 70)) continue;
        if (man.dying || man.archer || man.decor || man.driver || man.hidden || man.indoors || man.mode === "march") continue;
        for (let j = i + 1; j < men.length; j++) {
            const other = men[j];
            if (other.dying || other.archer || other.decor || other.driver || other.hidden || other.indoors || other.mode === "march") continue;
            const ox = man.x - other.x;
            const oz = man.z - other.z;
            const dist = Math.hypot(ox, oz);
            if (dist >= 0.72 || dist < 0.001) continue;
            const push = (0.72 - dist) * 0.5 * dt * 8;
            const px = ox / dist * push;
            const pz = oz / dist * push;
            if (!blocked(man.x + px, man.z, man.faction)) man.x += px;
            if (!blocked(man.x, man.z + pz, man.faction)) man.z += pz;
            if (!blocked(other.x - px, other.z, other.faction)) other.x -= px;
            if (!blocked(other.x, other.z - pz, other.faction)) other.z -= pz;
            actorsDirty = true;
        }
    }
}

function updateFight(dt) {
    if (player.guard > 0) player.guard -= dt;
    if (player.shake > 0) player.shake = Math.max(0, player.shake - dt);
    if (player.dead > 0) {
        player.dead -= dt;
        if (player.dead <= 0) respawn();
    }
    if (swing) {
        swing.age += dt;
        if (!swing.hit && swing.age >= 0.11) {
            swing.hit = true;
            connectSwing();
        }
        if (swing.age >= 0.36) swing = null;
    }
    for (let i = men.length - 1; i >= 0; i--) {
        const man = men[i];
        const close = man.dying || man.fisher || man.driver || (man.mode === "march" && man.path) || nearPerson(man, 500);
        if (close ? stepMan(man, dt) : false) {
            men.splice(i, 1);
            actorsDirty = true;
        } else if (!close) {
            man.walking = false;
        }
    }
    stepArrows(dt);
    separateMen(dt);
    if (actorsDirty) rebuildMesh();
}

paintHealth();
weapon.addEventListener("animationend", () => {
    weapon.classList.remove("swing-thrust", "swing-chop", "swing-slash-left", "swing-slash-right");
});

const skyBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1
]), gl.STATIC_DRAW);

let proj = new Float32Array(16);
let horizonProj = new Float32Array(16);

function resize() {
    const scale = window.innerWidth < 700 ? 1 : 0.65;
    canvas.width = Math.max(320, Math.floor(window.innerWidth * scale));
    canvas.height = Math.max(200, Math.floor(window.innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    proj = perspective(0.12, 1600);
    horizonProj = perspective(1, 6800);
}

function perspective(near, far) {
    const f = 1 / Math.tan((75 * Math.PI / 180) / 2);
    const aspect = canvas.width / Math.max(1, canvas.height);
    const nf = 1 / (near - far);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0
    ]);
}

function lookAt() {
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const sy = Math.sin(cam.yaw);
    const cy = Math.cos(cam.yaw);
    const fx = sy * cp;
    const fy = sp;
    const fz = -cy * cp;
    const shake = player.shake > 0 ? Math.sin(player.shake * 70) * 0.07 : 0;
    const eye = [cam.x + shake, cam.y + shake * 0.4, cam.z];
    const target = [eye[0] + fx, eye[1] + fy, eye[2] + fz];
    let zx = eye[0] - target[0];
    let zy = eye[1] - target[1];
    let zz = eye[2] - target[2];
    let len = Math.hypot(zx, zy, zz) || 1;
    zx /= len; zy /= len; zz /= len;
    let xx = zz;
    let xy = 0;
    let xz = -zx;
    len = Math.hypot(xx, xy, xz) || 1;
    xx /= len; xy /= len; xz /= len;
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;
    return new Float32Array([
        xx, yx, zx, 0,
        xy, yy, zy, 0,
        xz, yz, zz, 0,
        -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
        -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
        -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
        1
    ]);
}

const WALL_HALF = 17;
const WALL_CX = -0.5;
const WALL_CZ = -4;
const GATE_HALF = 1.8;
const gateAnim = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
let gateVisual = "";

function placeOf(village) {
    const place = places[village];
    return { x: place.ox, z: place.oz };
}

function palisadeBox(village) {
    const place = placeOf(village);
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

function gateSpot(village, side) {
    const box = palisadeBox(village);
    const out = 1.6;
    if (side === 0) return { x: box.cx, z: box.minZ - out };
    if (side === 1) return { x: box.maxX + out, z: box.cz };
    if (side === 2) return { x: box.cx, z: box.maxZ + out };
    return { x: box.minX - out, z: box.cz };
}

function gateCenter(village, side) {
    const box = palisadeBox(village);
    if (side === 0) return { x: box.cx, z: box.minZ };
    if (side === 1) return { x: box.maxX, z: box.cz };
    if (side === 2) return { x: box.cx, z: box.maxZ };
    return { x: box.minX, z: box.cz };
}

function ownerOf(village) {
    if (campaign && campaign.owners) return campaign.owners[village];
    return village;
}

function gateHealth(village, side) {
    const row = campaign && campaign.gates && campaign.gates[village];
    if (!row) return 50;
    return row[side];
}

function gatePasses(village, side, faction) {
    if (gateHealth(village, side) <= 0) return true;
    return faction === ownerOf(village);
}

function wallBlocks(x, z, faction) {
    const t = 0.36;
    for (let village = 0; village < 4; village++) {
        const box = palisadeBox(village);
        if (z > box.minZ - t && z < box.minZ + t && x > box.minX - t && x < box.maxX + t) {
            if (!(gatePasses(village, 0, faction) && Math.abs(x - box.cx) < GATE_HALF - 0.15)) return true;
        }
        if (z > box.maxZ - t && z < box.maxZ + t && x > box.minX - t && x < box.maxX + t) {
            if (!(gatePasses(village, 2, faction) && Math.abs(x - box.cx) < GATE_HALF - 0.15)) return true;
        }
        if (x > box.minX - t && x < box.minX + t && z > box.minZ - t && z < box.maxZ + t) {
            if (!(gatePasses(village, 3, faction) && Math.abs(z - box.cz) < GATE_HALF - 0.15)) return true;
        }
        if (x > box.maxX - t && x < box.maxX + t && z > box.minZ - t && z < box.maxZ + t) {
            if (!(gatePasses(village, 1, faction) && Math.abs(z - box.cz) < GATE_HALF - 0.15)) return true;
        }
    }
    return false;
}

function fisherSpot(man, along) {
    const pts = man.path;
    if (pts && pts.length > 1) {
        const lens = [];
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
            const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) || 0.001;
            lens.push(len);
            total += len;
        }
        let dist = Math.max(0, Math.min(1, along)) * total;
        for (let i = 0; i < lens.length; i++) {
            if (dist <= lens[i] || i === lens.length - 1) {
                const t = Math.min(1, dist / lens[i]);
                const a = pts[i];
                const b = pts[i + 1];
                return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: b.x - a.x, dz: b.z - a.z };
            }
            dist -= lens[i];
        }
    }
    const ax = man.fromX;
    const az = man.fromZ;
    const cx = man.toX;
    const cz = man.toZ;
    if (!Number.isFinite(man.viaX)) {
        return { x: ax + (cx - ax) * along, z: az + (cz - az) * along, dx: cx - ax, dz: cz - az };
    }
    const bx = man.viaX;
    const bz = man.viaZ;
    const len1 = Math.hypot(bx - ax, bz - az) || 0.001;
    const len2 = Math.hypot(cx - bx, cz - bz) || 0.001;
    const dist = along * (len1 + len2);
    if (dist <= len1) {
        const t = dist / len1;
        return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: bx - ax, dz: bz - az };
    }
    const t = (dist - len1) / len2;
    return { x: bx + (cx - bx) * t, z: bz + (cz - bz) * t, dx: cx - bx, dz: cz - bz };
}

function marchAttack(man) {
    if (!campaign) return null;
    return (campaign.attacks || []).find((attack) => attack.faction === man.faction && (attack.indexes || []).includes(man.index)) || null;
}

function marchDistance(attack, plain) {
    if (!Number.isFinite(attack.gateDist) || !Number.isFinite(attack.gateAt)) return plain;
    const now = Date.now();
    const hp = gateHealth(attack.to, attack.gateSide);
    if (attack.breachedAt) {
        const remain = Math.max(1, attack.remainMs || 1);
        const t = Math.max(0, Math.min(1, (now - attack.breachedAt) / remain));
        return attack.gateDist + t * ((attack.length || 0) - attack.gateDist);
    }
    if (hp > 0 || attack.heldForGate) {
        const leg = Math.max(1, attack.gateAt - attack.startedAt);
        const covered = attack.gateDist * Math.max(0, Math.min(1, (now - attack.startedAt) / leg));
        return Math.min(covered, attack.gateDist);
    }
    return plain;
}

function onTower(x, z) {
    for (const floor of floors) {
        if (!floor.tower || floor.y <= 2) continue;
        if (x > floor.x && x < floor.x + floor.w && z > floor.z && z < floor.z + floor.d) return true;
    }
    return false;
}

function gateWant(village, side) {
    if (gateHealth(village, side) <= 0) return 0;
    const owner = ownerOf(village);
    const spot = gateCenter(village, side);
    if (owner === homeVillage && !onTower(cam.x, cam.z) && floorAt(cam.x, cam.z) < 2 && Math.hypot(cam.x - spot.x, cam.z - spot.z) < 7.5) return 1;
    for (const man of men) {
        if (man.dying || man.health <= 0 || man.archer || man.faction !== owner) continue;
        if (onTower(man.x, man.z) || man.indoors || man.hidden || (man.floorY || 0) > 1) continue;
        if (Math.hypot(man.x - spot.x, man.z - spot.z) < 7.5) return 1;
    }
    return 0;
}

function gateInReach(ox, oz, fx, fy, fz, reach) {
    if (!campaign || !campaign.owners) return null;
    let best = null;
    let bestT = reach;
    for (let village = 0; village < 4; village++) {
        if (campaign.owners[village] === homeVillage) continue;
        for (let side = 0; side < 4; side++) {
            if (gateHealth(village, side) <= 0) continue;
            const spot = gateCenter(village, side);
            const dx = spot.x - ox;
            const dy = 1.15 - cam.y;
            const dz = spot.z - oz;
            const t = dx * fx + dy * fy + dz * fz;
            if (t < 0.35 || t > reach) continue;
            const wide = Math.hypot(dx - fx * t, dz - fz * t);
            if (wide < 1.35 && t < bestT) {
                best = { village, side, t };
                bestT = t;
            }
        }
    }
    return best;
}

function strikeGate(gate) {
    const row = campaign.gates && campaign.gates[gate.village];
    if (!row || row[gate.side] <= 0) return;
    row[gate.side] -= 1;
    showStrike(row[gate.side] > 0 ? "Gate " + row[gate.side] : "Gate down");
    gateVisual = "";
    pendingHit += 1;
    fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gate: gate.village, side: gate.side })
    }).then((res) => res.json()).then((data) => {
        pendingHit -= 1;
        if (pendingHit === 0) applyCampaign(data);
    }).catch(() => { pendingHit -= 1; });
}

function addPlank(list, hx, hz, tx, tz, ox, oz, open) {
    const ex = tx + (ox - tx) * open;
    const ez = tz + (oz - tz) * open;
    const dx = ex - hx;
    const dz = ez - hz;
    const len = Math.hypot(dx, dz) || 0.001;
    const ang = Math.atan2(-dz, dx);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const xf = (x, y, z) => {
        const lx = x - hx;
        const lz = z - hz;
        return [hx + c * lx + s * lz, y, hz - s * lx + c * lz];
    };
    addBox(list, hx, 0.1, hz - 0.08, len, 1.96, 0.16, xf);
}

function addWallRun(list, x0, z0, x1, z1, gap, axis) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.round(len / 0.46));
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        const along = axis === "x" ? x : z;
        if (Math.abs(along - gap) < 1.95) continue;
        addBox(list, x - 0.1, 0, z - 0.1, 0.2, 2.15, 0.2);
        addBox(list, x - 0.05, 2.15, z - 0.05, 0.1, 0.34, 0.1);
    }
    const rail = (y, a0, a1) => {
        if (a1 - a0 < 0.4) return;
        if (axis === "x") addBox(list, a0, y, z0 - 0.05, a1 - a0, 0.1, 0.1);
        else addBox(list, x0 - 0.05, y, a0, 0.1, 0.1, a1 - a0);
    };
    const low = gap - GATE_HALF;
    const high = gap + GATE_HALF;
    if (axis === "x") {
        rail(0.72, x0, low);
        rail(1.4, x0, low);
        rail(0.72, high, x1);
        rail(1.4, high, x1);
    } else {
        rail(0.72, z0, low);
        rail(1.4, z0, low);
        rail(0.72, high, z1);
        rail(1.4, high, z1);
    }
}

function addGateDoors(list, village, side, open) {
    const box = palisadeBox(village);
    const g = GATE_HALF;
    if (side === 0) {
        addPlank(list, box.cx - g, box.minZ, box.cx + 0.06, box.minZ, box.cx - g, box.minZ - g, open);
        addPlank(list, box.cx + g, box.minZ, box.cx - 0.06, box.minZ, box.cx + g, box.minZ - g, open);
        addBox(list, box.cx - g, 2.12, box.minZ - 0.1, g * 2, 0.16, 0.2);
    } else if (side === 2) {
        addPlank(list, box.cx - g, box.maxZ, box.cx + 0.06, box.maxZ, box.cx - g, box.maxZ + g, open);
        addPlank(list, box.cx + g, box.maxZ, box.cx - 0.06, box.maxZ, box.cx + g, box.maxZ + g, open);
        addBox(list, box.cx - g, 2.12, box.maxZ - 0.1, g * 2, 0.16, 0.2);
    } else if (side === 1) {
        addPlank(list, box.maxX, box.cz - g, box.maxX, box.cz + 0.06, box.maxX + g, box.cz - g, open);
        addPlank(list, box.maxX, box.cz + g, box.maxX, box.cz - 0.06, box.maxX + g, box.cz + g, open);
        addBox(list, box.maxX - 0.1, 2.12, box.cz - g, 0.2, 0.16, g * 2);
    } else {
        addPlank(list, box.minX, box.cz - g, box.minX, box.cz + 0.06, box.minX - g, box.cz - g, open);
        addPlank(list, box.minX, box.cz + g, box.minX, box.cz - 0.06, box.minX - g, box.cz + g, open);
        addBox(list, box.minX - 0.1, 2.12, box.cz - g, 0.2, 0.16, g * 2);
    }
}

const floors = [];
const solids = [];
const TOWER_RISE = 0.46;
const TOWER_RUN = 0.34;
const TOWER_STEPS = 6;

function towerLayout(village, side) {
    const box = palisadeBox(village);
    const beside = GATE_HALF + 0.62;
    const inset = 0.42;
    const size = 2.05;
    const floor = TOWER_RISE * TOWER_STEPS;
    if (side === 0) {
        return { x: box.cx + beside, z: box.minZ + inset, w: size, d: size, floor, stair: 2, outward: 0, gateEdge: 3 };
    }
    if (side === 2) {
        return { x: box.cx + beside, z: box.maxZ - inset - size, w: size, d: size, floor, stair: 0, outward: 2, gateEdge: 3 };
    }
    if (side === 1) {
        return { x: box.maxX - inset - size, z: box.cz + beside, w: size, d: size, floor, stair: 3, outward: 1, gateEdge: 0 };
    }
    return { x: box.minX + inset, z: box.cz + beside, w: size, d: size, floor, stair: 1, outward: 3, gateEdge: 0 };
}

function towerSteps(layout) {
    const steps = [];
    const span = 1.15;
    for (let i = 0; i < TOWER_STEPS; i++) {
        const y = layout.floor - i * TOWER_RISE;
        let x = layout.x;
        let z = layout.z;
        let w = layout.w;
        let d = layout.d;
        if (layout.stair === 2) {
            x += (layout.w - span) / 2;
            z += layout.d + i * TOWER_RUN;
            w = span;
            d = TOWER_RUN;
        } else if (layout.stair === 0) {
            x += (layout.w - span) / 2;
            z -= (i + 1) * TOWER_RUN;
            w = span;
            d = TOWER_RUN;
        } else if (layout.stair === 1) {
            x += layout.w + i * TOWER_RUN;
            z += (layout.d - span) / 2;
            w = TOWER_RUN;
            d = span;
        } else {
            x -= (i + 1) * TOWER_RUN;
            z += (layout.d - span) / 2;
            w = TOWER_RUN;
            d = span;
        }
        steps.push({ x, z, w, d, y });
    }
    return steps;
}

function addRail(list, layout, edge, tall) {
    const lip = 0.14;
    const y = tall ? layout.floor + 0.95 : layout.floor + 0.42;
    const h = 0.1;
    const { x, z, w, d } = layout;
    if (edge === 0) addBox(list, x, y, z, w, h, lip);
    else if (edge === 2) addBox(list, x, y, z + d - lip, w, h, lip);
    else if (edge === 3) addBox(list, x, y, z, lip, h, d);
    else addBox(list, x + w - lip, y, z, lip, h, d);
}

function addTower(list, layout) {
    const post = 0.16;
    const top = layout.floor + 1.25;
    const { x, z, w, d } = layout;
    addBox(list, x, 0, z, post, top, post);
    addBox(list, x + w - post, 0, z, post, top, post);
    addBox(list, x, 0, z + d - post, post, top, post);
    addBox(list, x + w - post, 0, z + d - post, post, top, post);
    addBox(list, x, layout.floor - 0.1, z, w, 0.1, d);
    addBox(list, x, layout.floor - 0.22, z + 0.2, w, 0.1, 0.12);
    addBox(list, x, layout.floor - 0.22, z + d - 0.32, w, 0.1, 0.12);
    for (const step of towerSteps(layout)) {
        addBox(list, step.x, 0, step.z, step.w, step.y, step.d);
    }
    for (let edge = 0; edge < 4; edge++) {
        if (edge === layout.stair) continue;
        addRail(list, layout, edge, edge !== layout.outward && edge !== layout.gateEdge);
    }
}

function curbOf(layout, edge) {
    const lip = 0.16;
    const { x, z, w, d } = layout;
    if (edge === 0) return { x, z, w, d: lip };
    if (edge === 2) return { x, z: z + d - lip, w, d: lip };
    if (edge === 3) return { x, z, w: lip, d };
    return { x: x + w - lip, z, w: lip, d };
}

let bowModel = null;
let arrowMesh = null;

function addShaft(list, x, y, z, dx, dy, dz) {
    const len = Math.hypot(dx, dy, dz) || 1;
    const fx = dx / len;
    const fy = dy / len;
    const fz = dz / len;
    let sx = -fz;
    let sz = fx;
    const sl = Math.hypot(sx, sz) || 1;
    sx /= sl;
    sz /= sl;
    const ux = fy * sz;
    const uy = fz * sx - fx * sz;
    const uz = -fy * sx;
    const w = 0.028;
    const tip = 0.56;
    const xf = (px, py, pz) => [
        x + sx * px + ux * py + fx * (pz - tip),
        y + ux * 0 + uy * py + fy * (pz - tip),
        z + sz * px + uz * py + fz * (pz - tip)
    ];
    addBox(list, -w, -w, 0, w * 2, w * 2, tip, xf);
}

function prepareBow() {
    const list = [];
    addBox(list, -0.045, -0.78, 0.05, 0.09, 0.62, 0.07);
    addBox(list, -0.04, -0.2, 0, 0.08, 0.4, 0.08);
    addBox(list, -0.045, 0.16, 0.08, 0.09, 0.62, 0.07);
    addBox(list, -0.012, -0.7, 0.28, 0.024, 1.4, 0.02);
    addBox(list, -0.018, -0.02, 0.22, 0.036, 0.036, 0.72);
    const data = new Float32Array(list);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    bowModel = { buffer, count: list.length / 6 };
    arrowMesh = { buffer: gl.createBuffer(), count: 0 };
}

function syncArrowMesh() {
    if (!arrowMesh) return;
    const list = [];
    for (const arrow of arrows) addShaft(list, arrow.x, arrow.y, arrow.z, arrow.vx, arrow.vy, arrow.vz);
    gl.bindBuffer(gl.ARRAY_BUFFER, arrowMesh.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(list), gl.DYNAMIC_DRAW);
    arrowMesh.count = list.length / 6;
}

function prepareTowers() {
    floors.length = 0;
    solids.length = 0;
    const post = 0.16;
    for (let village = 0; village < 4; village++) {
        for (let side = 0; side < 4; side++) {
            const layout = towerLayout(village, side);
            floors.push({ x: layout.x, z: layout.z, w: layout.w, d: layout.d, y: layout.floor, tower: true });
            const corners = [
                [layout.x, layout.z],
                [layout.x + layout.w - post, layout.z],
                [layout.x, layout.z + layout.d - post],
                [layout.x + layout.w - post, layout.z + layout.d - post]
            ];
            for (const corner of corners) {
                solids.push({ x: corner[0], z: corner[1], w: post, d: post, y0: 0, y1: layout.floor + 1.25 });
            }
            for (const step of towerSteps(layout)) floors.push(Object.assign({ tower: true }, step));
            for (let edge = 0; edge < 4; edge++) {
                if (edge === layout.stair) continue;
                const curb = curbOf(layout, edge);
                const low = edge === layout.outward || edge === layout.gateEdge;
                solids.push({ x: curb.x, z: curb.z, w: curb.w, d: curb.d, y0: layout.floor, y1: layout.floor + (low ? 0.55 : 1.05) });
            }
        }
    }
    for (const house of houses) {
        for (const deck of house.decks || []) floors.push(deck);
    }
}

function floorAt(x, z) {
    let height = Math.max(0, World.heightAt(x, z));
    for (const floor of floors) {
        if (x > floor.x && x < floor.x + floor.w && z > floor.z && z < floor.z + floor.d) {
            height = Math.max(height, floor.y);
        }
    }
    return height;
}

function hitsSolid(x, z, feet) {
    const body = feet + 1.6;
    for (const solid of solids) {
        if (x <= solid.x || x >= solid.x + solid.w || z <= solid.z || z >= solid.z + solid.d) continue;
        if (body > solid.y0 + 0.02 && feet < solid.y1 - 0.02) return true;
    }
    return false;
}

function rebuildPalisade() {
    const list = [];
    for (let village = 0; village < 4; village++) {
        const box = palisadeBox(village);
        addWallRun(list, box.minX, box.minZ, box.maxX, box.minZ, box.cx, "x");
        addWallRun(list, box.minX, box.maxZ, box.maxX, box.maxZ, box.cx, "x");
        addWallRun(list, box.minX, box.minZ, box.minX, box.maxZ, box.cz, "z");
        addWallRun(list, box.maxX, box.minZ, box.maxX, box.maxZ, box.cz, "z");
        for (let side = 0; side < 4; side++) {
            addTower(list, towerLayout(village, side));
            if (gateHealth(village, side) <= 0) continue;
            addGateDoors(list, village, side, gateAnim[village][side]);
        }
    }
    uploadMesh("wood", list);
}

function updatePalisade(dt) {
    let key = "";
    const step = Math.min(1, dt * 4.5);
    for (let village = 0; village < 4; village++) {
        for (let side = 0; side < 4; side++) {
            const want = gateWant(village, side);
            const current = gateAnim[village][side];
            const next = Math.abs(want - current) < 0.02 ? want : current + (want - current) * step;
            gateAnim[village][side] = next;
            key += gateHealth(village, side) + ":" + next.toFixed(2) + ",";
        }
    }
    if (key === gateVisual) return;
    gateVisual = key;
    rebuildPalisade();
}

function blocked(x, z, faction, feet) {
    const r = 0.4;
    const stand = feet == null ? 0 : feet;
    const who = faction == null ? homeVillage : faction;
    for (const b of houses) {
        if (b.open) {
            const body = stand + 1.6;
            for (const part of b.parts) {
                if (body <= part.y0 + 0.02 || stand >= part.y1 - 0.02) continue;
                if (x > part.x - r && x < part.x + part.w + r && z > part.z - r && z < part.z + part.d + r) return true;
            }
            continue;
        }
        if (stand < b.h && x > b.x - r && x < b.x + b.w + r && z > b.z - r && z < b.z + b.d + r) return true;
    }
    for (const item of scenery) {
        if (x > item.x - r && x < item.x + item.w + r && z > item.z - r && z < item.z + item.d + r) return true;
    }
    if (World.wet(x, z)) return true;
    if (hitsSolid(x, z, stand)) return true;
    return wallBlocks(x, z, who);
}

let lookId = null;
let moveId = null;
const stick = { x: 0, y: 0 };

function movePlayer(dt) {
    if (player.dead) return;
    if (keys.ArrowLeft) cam.yaw -= 1.7 * dt;
    if (keys.ArrowRight) cam.yaw += 1.7 * dt;
    const sy = Math.sin(cam.yaw);
    const cy = Math.cos(cam.yaw);
    let mx = 0;
    let mz = 0;
    const forward = keys.KeyW || keys.ArrowUp;
    const back = keys.KeyS || keys.ArrowDown;
    const left = keys.KeyA;
    const right = keys.KeyD;
    const stickMag = Math.hypot(stick.x, stick.y);
    if (forward) { mx += sy; mz -= cy; }
    if (back) { mx -= sy; mz += cy; }
    if (right) { mx += cy; mz += sy; }
    if (left) { mx -= cy; mz -= sy; }
    if (stickMag > 0.18) {
        mx += -stick.y * sy + stick.x * cy;
        mz += stick.y * cy + stick.x * sy;
    }
    const len = Math.hypot(mx, mz);
    if (!len) return;
    const power = stickMag > 0.18 && !forward && !back && !left && !right
        ? Math.min(1, (stickMag - 0.18) / 0.82)
        : 1;
    const dist = 4.6 * dt * power;
    mx = mx / len * dist;
    mz = mz / len * dist;
    const feet = cam.y - 1.62;
    const stepUp = (nx, nz) => floorAt(nx, nz) <= feet + 0.52;
    if (!blocked(cam.x + mx, cam.z, null, feet) && stepUp(cam.x + mx, cam.z)) cam.x += mx;
    if (!blocked(cam.x, cam.z + mz, null, feet) && stepUp(cam.x, cam.z + mz)) cam.z += mz;
    cam.y = 1.62 + floorAt(cam.x, cam.z);
}

function draw() {
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(skyProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
    gl.enableVertexAttribArray(skyLoc.pos);
    gl.vertexAttribPointer(skyLoc.pos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(skyLoc.res, canvas.width, canvas.height);
    gl.uniform1f(skyLoc.pitch, cam.pitch);
    const dark = Clock.darkness(gameMs());
    const sun = sunScreen();
    gl.uniform1f(skyLoc.dark, dark);
    gl.uniform2f(skyLoc.sun, sun.x, sun.y);
    gl.uniform1f(skyLoc.sunUp, sun.up);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.useProgram(program);
    gl.uniformMatrix4fv(loc.view, false, lookAt());
    gl.uniformMatrix4fv(loc.model, false, identity);
    gl.uniform2f(loc.eye, cam.x, cam.z);
    paintCarts();
    const stride = 24;
    const drawMesh = (name, band, farPass) => {
        if (!mesh[name] || !textures[name] || !mesh[name].count) return;
        if (mesh[name].cull === false) gl.disable(gl.CULL_FACE);
        else gl.enable(gl.CULL_FACE);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh[name].buffer);
        gl.enableVertexAttribArray(loc.pos);
        gl.enableVertexAttribArray(loc.uv);
        gl.enableVertexAttribArray(loc.shade);
        gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 12);
        gl.vertexAttribPointer(loc.shade, 1, gl.FLOAT, false, stride, 20);
        gl.bindTexture(gl.TEXTURE_2D, textures[name]);
        gl.uniform1f(loc.dark, dark);
        gl.uniform1f(loc.glow, name === "glow" ? 1 : 0);
        gl.uniform1f(loc.band, band);
        gl.uniformMatrix4fv(loc.proj, false, farPass ? horizonProj : proj);
        gl.drawArrays(gl.TRIANGLES, 0, mesh[name].count);
    };
    for (const name of ["horizon", "horizonRock"]) drawMesh(name, 2, true);
    for (const name of ["horizonLeaf", "horizonWall", "horizonRoof"]) drawMesh(name, 3, true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    for (const name of Object.keys(mesh)) {
        if (name.indexOf("horizon") === 0 || name.indexOf("far") === 0 || name.indexOf("near") === 0) continue;
        drawMesh(name, 1, false);
    }
    drawMesh("farTrunk", 0.6, false);
    drawMesh("farLeaf", 0.6, false);
    drawMesh("nearTrunk", 1, false);
    drawMesh("nearLeaf", 1, false);
    gl.uniform1f(loc.band, 1);
    gl.uniformMatrix4fv(loc.proj, false, proj);
    if (peopleReady && textures.people) {
        gl.enable(gl.CULL_FACE);
        gl.bindTexture(gl.TEXTURE_2D, textures.people);
        for (const man of men) {
            if (man.hidden || !nearPerson(man, 500)) continue;
            const kind = man.fisher || man.decor || man.driver ? "fisher" : "soldier";
            const model = peopleModels[kind + man.faction];
            if (!model) continue;
            plant(man);
            const hand = peopleHands[kind + man.faction];
            gl.uniformMatrix4fv(loc.model, false, personMatrix(man));
            gl.bindBuffer(gl.ARRAY_BUFFER, model.buffer);
            gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
            gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 12);
            gl.vertexAttribPointer(loc.shade, 1, gl.FLOAT, false, stride, 20);
            gl.drawArrays(gl.TRIANGLES, 0, model.count);
            if (model.left && model.right) {
                const phase = man.walking ? performance.now() * 0.008 + (man.index || 0) * 1.7 : 0;
                const step = man.walking ? Math.sin(phase) * 0.55 : 0;
                gl.uniformMatrix4fv(loc.model, false, legMatrix(man, model.hipL, step));
                gl.bindBuffer(gl.ARRAY_BUFFER, model.left.buffer);
                gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
                gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 12);
                gl.vertexAttribPointer(loc.shade, 1, gl.FLOAT, false, stride, 20);
                gl.drawArrays(gl.TRIANGLES, 0, model.left.count);
                gl.uniformMatrix4fv(loc.model, false, legMatrix(man, model.hipR, -step));
                gl.bindBuffer(gl.ARRAY_BUFFER, model.right.buffer);
                gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
                gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 12);
                gl.vertexAttribPointer(loc.shade, 1, gl.FLOAT, false, stride, 20);
                gl.drawArrays(gl.TRIANGLES, 0, model.right.count);
            }
            if (man.archer && bowModel && textures.wood) {
                gl.bindTexture(gl.TEXTURE_2D, textures.wood);
                gl.uniformMatrix4fv(loc.model, false, bowMatrix(man));
                gl.bindBuffer(gl.ARRAY_BUFFER, bowModel.buffer);
                gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
                gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 12);
                gl.vertexAttribPointer(loc.shade, 1, gl.FLOAT, false, stride, 20);
                gl.drawArrays(gl.TRIANGLES, 0, bowModel.count);
                gl.bindTexture(gl.TEXTURE_2D, textures.people);
            } else if (!man.fisher && !man.decor && !man.driver && hand && swordModel && textures.sword) {
                gl.bindTexture(gl.TEXTURE_2D, textures.sword);
                gl.uniformMatrix4fv(loc.model, false, swordMatrix(man, hand));
                gl.bindBuffer(gl.ARRAY_BUFFER, swordModel.buffer);
                gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
                gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 12);
                gl.vertexAttribPointer(loc.shade, 1, gl.FLOAT, false, stride, 20);
                gl.drawArrays(gl.TRIANGLES, 0, swordModel.count);
                gl.bindTexture(gl.TEXTURE_2D, textures.people);
            }
        }
    }
    if (arrowMesh && textures.wood && arrowMesh.count) {
        gl.bindTexture(gl.TEXTURE_2D, textures.wood);
        gl.uniformMatrix4fv(loc.model, false, identity);
        gl.bindBuffer(gl.ARRAY_BUFFER, arrowMesh.buffer);
        gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 12);
        gl.vertexAttribPointer(loc.shade, 1, gl.FLOAT, false, stride, 20);
        gl.drawArrays(gl.TRIANGLES, 0, arrowMesh.count);
    }
}

function loadCottage() {
    if (!cottage) return;
    fetch("models/cottage.json", { cache: "no-store" }).then((res) => res.json()).then((data) => {
        const c = Math.cos(cottage.yaw);
        const s = Math.sin(cottage.yaw);
        const light = [0.25, 0.86, 0.28];
        const lightLen = Math.hypot(light[0], light[1], light[2]);
        for (const [name, src] of Object.entries(data.groups)) {
            const floats = new Float32Array(src.length / 8 * 6);
            for (let i = 0, o = 0; i < src.length; i += 8, o += 6) {
                const x = src[i];
                const y = src[i + 1];
                const z = src[i + 2];
                const nx = src[i + 5] * c + src[i + 7] * s;
                const ny = src[i + 6];
                const nz = -src[i + 5] * s + src[i + 7] * c;
                const lit = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / lightLen);
                floats[o] = x * c + z * s + cottage.x;
                floats[o + 1] = y;
                floats[o + 2] = -x * s + z * c + cottage.z;
                floats[o + 3] = src[i + 3];
                floats[o + 4] = src[i + 4];
                floats[o + 5] = Math.min(1, 0.42 + 0.58 * lit);
            }
            const img = new Image();
            img.onload = () => {
                const tex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                textures["cottage" + name] = tex;
                const buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, floats, gl.STATIC_DRAW);
                mesh["cottage" + name] = { buffer, count: floats.length / 6, cull: false };
            };
            img.src = "models/" + name + ".png";
        }
    }).catch(() => {});
}

function loadPeople() {
    fetch("models/people.json", { cache: "no-store" }).then((res) => res.json()).then((data) => {
        for (const [name, src] of Object.entries(data.models)) {
            const part = (data.legs && data.legs[name]) || null;
            const upload = (floats) => {
                const data = new Float32Array(floats);
                const buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
                return { buffer, count: data.length / 6 };
            };
            const model = upload(src);
            if (part && part.left && part.right) {
                model.left = upload(part.left);
                model.right = upload(part.right);
                model.hipL = part.hipL;
                model.hipR = part.hipR;
            }
            peopleModels[name] = model;
        }
        Object.assign(peopleHands, data.hands || {});
        const img = new Image();
        img.onload = () => {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            textures.people = tex;
            for (let i = 0; i < 4; i++) uploadMesh("cloth" + i, []);
            uploadMesh("skin", []);
            uploadMesh("pants", []);
            uploadMesh("steel", []);
            peopleReady = true;
        };
        img.src = "models/people.png";
    }).catch(() => {});
    fetch("models/sword.json", { cache: "no-store" }).then((res) => res.json()).then((src) => {
        const floats = new Float32Array(src);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, floats, gl.STATIC_DRAW);
        swordModel = { buffer, count: floats.length / 6 };
        const img = new Image();
        img.onload = () => {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            textures.sword = tex;
        };
        img.src = "models/sword.png";
    }).catch(() => {});
}

let last = performance.now();
function sunScreen() {
    const h = Clock.hours(gameMs());
    const t = (h - 5) / 18;
    const u = Math.max(0, Math.min(1, t));
    const elev = Math.sin(u * Math.PI);
    let x = Math.cos(u * Math.PI);
    let y = t > 0 && t < 1 ? elev : -0.25;
    let z = 0.2 * Math.sin(u * Math.PI);
    const len = Math.hypot(x, y, z) || 1;
    x /= len; y /= len; z /= len;
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const sy = Math.sin(cam.yaw);
    const cy = Math.cos(cam.yaw);
    const fx = sy * cp;
    const fy = sp;
    const fz = -cy * cp;
    const rx = cy;
    const rz = sy;
    const ux = -sy * sp;
    const uy = cp;
    const uz = cy * sp;
    const sx = x * rx + z * rz;
    const syv = x * ux + y * uy + z * uz;
    const sz = x * fx + y * fy + z * fz;
    const aspect = canvas.width / Math.max(1, canvas.height);
    const tan = Math.tan((75 * Math.PI / 180) / 2);
    if (sz <= 0.08) return { x: -1, y: -1, up: 0 };
    return {
        x: (sx / sz) / tan / aspect * 0.5 + 0.5,
        y: (syv / sz) / tan * 0.5 + 0.5,
        up: t > 0 && t < 1 ? 1 : 0
    };
}

function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    accrue();
    const clock = document.getElementById("clock");
    if (clock) clock.textContent = Clock.label(gameMs());
    movePlayer(dt);
    refreshNearTrees();
    updateFight(dt);
    updatePalisade(dt);
    syncArrowMesh();
    draw();
    requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "KeyF" && !e.repeat) shootArrow();
    if (e.code === "KeyP" && !e.repeat) {
        packPanel.hidden = !packPanel.hidden;
        e.preventDefault();
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

canvas.addEventListener("click", () => {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
});
document.addEventListener("mousemove", (e) => {
    if (gesture) {
        gesture.x += e.movementX;
        gesture.y += e.movementY;
        return;
    }
    const locked = document.pointerLockElement === canvas;
    if (!locked && !dragging) return;
    const sens = locked ? 0.0022 : 0.005;
    cam.yaw += e.movementX * sens;
    cam.pitch = Math.max(-1.05, Math.min(1.05, cam.pitch - e.movementY * sens));
});

let dragging = false;
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
        shootArrow();
        return;
    }
    if (e.button !== 0) return;
    dragging = true;
    if (arm === "bow") {
        shootArrow();
        return;
    }
    if (document.pointerLockElement === canvas && !player.dead) gesture = { x: 0, y: 0 };
});
window.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;
    dragging = false;
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    resolveSwing(g);
});

const phone = window.matchMedia("(hover: none) and (pointer: coarse)");
const pad = document.getElementById("pad");
const knob = pad.querySelector(".knob");
const attack = document.getElementById("attack");
const bowButton = document.getElementById("bow");

const packButton = document.getElementById("pack");
const packPanel = document.getElementById("pack-panel");
const helpLine = document.querySelector(".help");
const viewbow = document.getElementById("viewbow");

function paintArm() {
    const on = phone.matches;
    weapon.hidden = arm !== "sword";
    viewbow.hidden = arm !== "bow";
    pad.hidden = !on;
    attack.hidden = !on;
    attack.classList.toggle("arm-bow", arm === "bow");
    attack.setAttribute("aria-label", arm === "bow" ? "Shoot" : "Attack");
    bowButton.hidden = true;
    if (helpLine) {
        helpLine.textContent = arm === "bow"
            ? "WASD to walk · mouse to look · click to shoot · Pack to switch"
            : "WASD to walk · mouse to look · drag to swing · Pack to switch";
    }
    packPanel.querySelectorAll("button").forEach((button) => {
        button.setAttribute("aria-pressed", button.dataset.arm === arm ? "true" : "false");
    });
}

function chooseArm(next) {
    if (next !== "sword" && next !== "bow") return;
    arm = next;
    try { localStorage.setItem("village-arm", arm); } catch (err) { /* the choice still lasts this visit */ }
    packPanel.hidden = true;
    paintArm();
}

function showPhoneControls() {
    paintArm();
}

function placeKnob(x, y) {
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = x - cx;
    let dy = y - cy;
    const max = rect.width * 0.34;
    const mag = Math.hypot(dx, dy) || 1;
    if (mag > max) {
        dx = dx / mag * max;
        dy = dy / mag * max;
    }
    stick.x = dx / max;
    stick.y = dy / max;
    knob.style.transform = "translate(" + dx + "px, " + dy + "px)";
}

function releaseKnob() {
    stick.x = 0;
    stick.y = 0;
    moveId = null;
    pad.classList.remove("held");
    knob.style.transform = "translate(0px, 0px)";
}

phone.addEventListener("change", showPhoneControls);
showPhoneControls();

pad.addEventListener("pointerdown", (e) => {
    if (!phone.matches || player.dead || moveId !== null) return;
    moveId = e.pointerId;
    pad.classList.add("held");
    placeKnob(e.clientX, e.clientY);
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already held */ }
    e.preventDefault();
});
pad.addEventListener("pointermove", (e) => {
    if (e.pointerId !== moveId) return;
    placeKnob(e.clientX, e.clientY);
});
pad.addEventListener("pointerup", (e) => {
    if (e.pointerId !== moveId) return;
    releaseKnob();
});
pad.addEventListener("pointercancel", releaseKnob);

attack.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    attack.classList.add("down");
    if (arm === "bow") shootArrow();
    else startSwing("thrust");
});
attack.addEventListener("pointerup", () => attack.classList.remove("down"));
attack.addEventListener("pointercancel", () => attack.classList.remove("down"));
attack.addEventListener("contextmenu", (e) => e.preventDefault());

bowButton.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    bowButton.classList.add("down");
    shootArrow();
});
bowButton.addEventListener("pointerup", () => bowButton.classList.remove("down"));
bowButton.addEventListener("pointercancel", () => bowButton.classList.remove("down"));
bowButton.addEventListener("contextmenu", (e) => e.preventDefault());

packButton.addEventListener("click", () => {
    packPanel.hidden = !packPanel.hidden;
});
packPanel.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    chooseArm(button.dataset.arm);
});

canvas.addEventListener("touchstart", (e) => {
    for (const t of e.changedTouches) {
        if (lookId !== null) continue;
        lookId = t.identifier;
        stick.lx = t.clientX;
        stick.ly = t.clientY;
    }
    e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        const mx = t.clientX - stick.lx;
        const my = t.clientY - stick.ly;
        cam.yaw += mx * 0.006;
        cam.pitch = Math.max(-1.05, Math.min(1.05, cam.pitch - my * 0.006));
        stick.lx = t.clientX;
        stick.ly = t.clientY;
    }
    e.preventDefault();
}, { passive: false });

function endTouch(e) {
    for (const t of e.changedTouches) {
        if (t.identifier === lookId) lookId = null;
    }
}
canvas.addEventListener("touchend", endTouch);
canvas.addEventListener("touchcancel", endTouch);

if (gl) {
    gl.clearColor(0.55, 0.66, 0.74, 1);
    resize();
    syncCampaign();
    setInterval(syncCampaign, 1500);
    prepareTowers();
    spawnKeepers();
    prepareBow();
    loadCottage();
    loadPeople();
    requestAnimationFrame(frame);
}
