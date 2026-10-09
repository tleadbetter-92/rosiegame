const canvas = document.getElementById("view");
const gl = canvas.getContext("webgl", { antialias: false, alpha: false });

if (!gl) {
    document.querySelector(".help").textContent = "This browser cannot show the village.";
}

const places = World.places;
const flying = new URLSearchParams(location.search).get("fly") === "1";
const cam = { x: places[2].ox, y: 1.62, z: places[2].oz + 20, yaw: 0, pitch: 0 };
if (flying) {
    cam.x = -200;
    cam.y = 340;
    cam.z = 980;
    cam.pitch = -0.62;
}
const homeVillage = 2;
let inside = null;
function activeCam() {
    return inside ? inside.view : cam;
}
const townLeash = 30;
const player = { hp: 40, max: 40, guard: 0, dead: 0, shake: 0 };
let hero = Hero.create();
let heroReady = false;
let heroSaveTimer = 0;
let selfPanel = null;
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
        speck(g, s, 280, "rgba(28,68,22,0.42)", "rgba(156,196,92,0.34)");
    }),
    dirt: makeTexture((g, s) => {
        g.fillStyle = "#8b7044";
        g.fillRect(0, 0, s, s);
        speck(g, s, 280, "rgba(70,48,24,0.4)", "rgba(196,164,110,0.35)");
    }),
    cobble: makeTexture((g, s) => {
        g.fillStyle = "#4e4a44";
        g.fillRect(0, 0, s, s);
        const tones = ["#8d8880", "#7a756e", "#6a655e", "#9a948c", "#5e5a54", "#847f76", "#726e68"];
        let y = 1;
        let row = 0;
        while (y < s - 1) {
            const h = 5 + (row % 3);
            let x = (row % 2) * 5 - 3;
            let col = 0;
            while (x < s) {
                const w = 6 + ((row * 3 + col * 5) % 6);
                g.fillStyle = tones[(row * 5 + col * 2) % tones.length];
                g.fillRect(x, y, w, h);
                if ((row + col) % 3 === 0) {
                    g.fillStyle = "rgba(255,250,240,0.16)";
                    g.fillRect(x + 1, y + 1, Math.max(1, w - 3), 1);
                }
                if ((row * 2 + col) % 5 === 0) {
                    g.fillStyle = "rgba(30,28,26,0.35)";
                    g.fillRect(x + 2, y + 2, 2, 2);
                }
                x += w + 1;
                col++;
            }
            y += h + 1;
            row++;
        }
    }),
    sand: makeTexture((g, s) => {
        g.fillStyle = "#c6a56a";
        g.fillRect(0, 0, s, s);
        speck(g, s, 240, "rgba(150,110,60,0.35)", "rgba(230,210,160,0.4)");
    }),
    water: makeTexture((g, s) => {
        g.fillStyle = "#2c5c58";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "#3d7368";
        g.fillRect(0, 8, s, 3);
        g.fillRect(0, 28, s, 2);
        g.fillRect(0, 46, s, 4);
        g.fillStyle = "#234a48";
        g.fillRect(0, 18, s, 2);
        g.fillRect(0, 56, s, 3);
        speck(g, s, 70, "rgba(180,200,170,0.28)", "rgba(20,40,36,0.35)");
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
    bloom: makeTexture((g, s) => {
        g.fillStyle = "#c6a83a";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "#f0e2a0";
        g.fillRect(10, 8, s - 20, s - 22);
        g.fillStyle = "#3e6a28";
        g.fillRect(0, s - 12, s, 12);
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
    grass: [], dirt: [], cobble: [], sand: [], water: [], wall: [], door: [], roof: [], store: [], plaster: [], trunk: [], leaf: [], bloom: [], rock: [], linen: [], glow: [],
    farTrunk: [], farLeaf: [], horizon: [], horizonRock: [], horizonLeaf: [], horizonWall: [], horizonRoof: []
};

function paintPatch(x, z, s, h00, h10, h11, h01) {
    const rise = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
    const mid = (h00 + h10 + h11 + h01) * 0.25;
    const cx = x + s * 0.5;
    const cz = z + s * 0.5;
    if (mid > -0.35) {
        const kind = landKind(cx, cz, rise);
        const list = batches[kind] || batches.grass;
        const plain = kind === "rock" ? 0.76 : kind === "dirt" ? 0.9 : 1;
        const tone = (px, pz) => (kind === "grass" ? World.turfShade(px, pz) : plain);
        const u = x / s;
        const v = z / s;
        pushQuad(
            list,
            [x, h00, z, u, v, tone(x, z)],
            [x, h01, z + s, u, v + 1, tone(x, z + s)],
            [x + s, h11, z + s, u + 1, v + 1, tone(x + s, z + s)],
            [x + s, h10, z, u + 1, v, tone(x + s, z)]
        );
    }
    const level = World.waterLevel(cx, cz);
    if (level != null && level > 0.4 && Math.min(h00, h10, h11, h01) < level + 0.08) {
        const u = x / 8;
        const v = z / 8;
        pushQuad(
            batches.water,
            [x, level, z, u, v, 0.72],
            [x, level, z + s, u, v + s / 8, 0.72],
            [x + s, level, z + s, u + s / 8, v + s / 8, 0.72],
            [x + s, level, z, u + s / 8, v, 0.72]
        );
        return;
    }
    if (Math.min(h00, h10, h11, h01) > -0.04) return;
    const y = 0.08;
    const u = x / 8;
    const v = z / 8;
    pushQuad(
        batches.water,
        [x, y, z, u, v, 0.95],
        [x, y, z + s, u, v + s / 8, 0.95],
        [x + s, y, z + s, u + s / 8, v + s / 8, 0.95],
        [x + s, y, z, u + s / 8, v, 0.95]
    );
}

function landKind(x, z, rise) {
    const home = World.places[2];
    if (Math.hypot(x - home.x, z - home.z) < 125) {
        const pave = Town.groundAt(x, z);
        if (pave) return pave;
        return World.groundKind(x, z, rise);
    }
    if (Town.street(x, z)) return "dirt";
    return World.groundKind(x, z, rise);
}

function paveShade(kind, x, z) {
    const n = ((Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263)) >>> 0) / 4294967296;
    if (kind === "cobble") return 0.72 + n * 0.34;
    if (kind === "dirt") return 0.86 + n * 0.16;
    return 1;
}

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
                if (x + cell > place.x - 180 && x < place.x + 180 && z + cell > place.z - 180 && z < place.z + 180) town = true;
            }
            if (town) continue;
            const box = World.peakBox;
            if (x + cell > box.minX && x < box.maxX && z + cell > box.minZ && z < box.maxZ) continue;
            let loch = false;
            for (const arm of World.lochMesh) {
                if (x + cell > arm.minX && x < arm.maxX && z + cell > arm.minZ && z < arm.maxZ) loch = true;
            }
            if (loch) continue;
            if (Math.min(h00, h10, h11, h01) < 0.35 || World.nearRiver(cx, cz)) {
                const sub = World.nearRiver(cx, cz) ? 4 : 8;
                for (let sx = x; sx < x + cell; sx += sub) {
                    for (let sz = z; sz < z + cell; sz += sub) {
                        paintPatch(
                            sx, sz, sub,
                            World.heightAt(sx, sz),
                            World.heightAt(sx + sub, sz),
                            World.heightAt(sx + sub, sz + sub),
                            World.heightAt(sx, sz + sub)
                        );
                    }
                }
                continue;
            }
            if (mid > -0.35) {
                const kind = landKind(cx, cz, rise);
                const list = batches[kind] || batches.grass;
                const plain = kind === "rock" ? 0.76 : 1;
                const tone = (px, pz) => (kind === "grass" ? World.turfShade(px, pz) : plain);
                const u = x / 8;
                const v = z / 8;
                pushQuad(
                    list,
                    [x, h00, z, u, v, tone(x, z)],
                    [x, h01, z + cell, u, v + cell / 8, tone(x, z + cell)],
                    [x + cell, h11, z + cell, u + cell / 8, v + cell / 8, tone(x + cell, z + cell)],
                    [x + cell, h10, z, u + cell / 8, v, tone(x + cell, z)]
                );
            }
        }
    }
    const fine = 4;
    const home = World.places[2];
    const inner = 100;
    for (const place of World.places) {
        for (let x = place.x - 180; x < place.x + 180; x += fine) {
            for (let z = place.z - 180; z < place.z + 180; z += fine) {
                if (place === home && x >= home.x - inner && x < home.x + inner && z >= home.z - inner && z < home.z + inner) continue;
                const h00 = World.heightAt(x, z);
                const h10 = World.heightAt(x + fine, z);
                const h11 = World.heightAt(x + fine, z + fine);
                const h01 = World.heightAt(x, z + fine);
                const rise = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
                const cx = x + fine * 0.5;
                const cz = z + fine * 0.5;
                const kind = landKind(cx, cz, rise);
                const list = batches[kind] || batches.grass;
                const tone = (px, pz) => (kind === "grass" ? World.turfShade(px, pz) : 1);
                const u = x / 4;
                const v = z / 4;
                pushQuad(
                    list,
                    [x, h00, z, u, v, tone(x, z)],
                    [x, h01, z + fine, u, v + 1, tone(x, z + fine)],
                    [x + fine, h11, z + fine, u + 1, v + 1, tone(x + fine, z + fine)],
                    [x + fine, h10, z, u + 1, v, tone(x + fine, z)]
                );
            }
        }
    }
    const pave = 2;
    for (let x = home.x - inner; x < home.x + inner; x += pave) {
        for (let z = home.z - inner; z < home.z + inner; z += pave) {
            const h00 = World.heightAt(x, z);
            const h10 = World.heightAt(x + pave, z);
            const h11 = World.heightAt(x + pave, z + pave);
            const h01 = World.heightAt(x, z + pave);
            const rise = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
            const kind = landKind(x + pave * 0.5, z + pave * 0.5, rise);
            const list = batches[kind] || batches.grass;
            const tone = (px, pz) => (kind === "grass" ? World.turfShade(px, pz) : paveShade(kind, px, pz));
            pushQuad(
                list,
                [x, h00, z, x / 4, z / 4, tone(x, z)],
                [x, h01, z + pave, x / 4, (z + pave) / 4, tone(x, z + pave)],
                [x + pave, h11, z + pave, (x + pave) / 4, (z + pave) / 4, tone(x + pave, z + pave)],
                [x + pave, h10, z, (x + pave) / 4, z / 4, tone(x + pave, z)]
            );
        }
    }
    const lochCell = 8;
    for (const arm of World.lochMesh) {
        for (let x = arm.minX; x < arm.maxX; x += lochCell) {
            for (let z = arm.minZ; z < arm.maxZ; z += lochCell) {
                let town = false;
                for (const place of World.places) {
                    if (x + lochCell > place.x - 180 && x < place.x + 180 && z + lochCell > place.z - 180 && z < place.z + 180) town = true;
                }
                if (town) continue;
                const h00 = World.heightAt(x, z);
                const h10 = World.heightAt(x + lochCell, z);
                const h11 = World.heightAt(x + lochCell, z + lochCell);
                const h01 = World.heightAt(x, z + lochCell);
                const rise = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
                const mid = (h00 + h10 + h11 + h01) * 0.25;
                const cx = x + lochCell * 0.5;
                const cz = z + lochCell * 0.5;
                if (mid > -0.35) {
                    const kind = landKind(cx, cz, rise);
                    const list = batches[kind] || batches.grass;
                    const plain = kind === "rock" ? 0.76 : 1;
                    const tone = (px, pz) => (kind === "grass" ? World.turfShade(px, pz) : plain);
                    pushQuad(
                        list,
                        [x, h00, z, x / 8, z / 8, tone(x, z)],
                        [x, h01, z + lochCell, x / 8, (z + lochCell) / 8, tone(x, z + lochCell)],
                        [x + lochCell, h11, z + lochCell, (x + lochCell) / 8, (z + lochCell) / 8, tone(x + lochCell, z + lochCell)],
                        [x + lochCell, h10, z, (x + lochCell) / 8, z / 8, tone(x + lochCell, z)]
                    );
                }
                if (Math.min(h00, h10, h11, h01) > -0.04) continue;
                const y = 0.08;
                pushQuad(
                    batches.water,
                    [x, y, z, x / 8, z / 8, 0.95],
                    [x, y, z + lochCell, x / 8, (z + lochCell) / 8, 0.95],
                    [x + lochCell, y, z + lochCell, (x + lochCell) / 8, (z + lochCell) / 8, 0.95],
                    [x + lochCell, y, z, (x + lochCell) / 8, z / 8, 0.95]
                );
            }
        }
    }
    const peak = World.peakBox;
    const peakCell = 4;
    for (let x = peak.minX; x < peak.maxX; x += peakCell) {
        for (let z = peak.minZ; z < peak.maxZ; z += peakCell) {
            const h00 = World.heightAt(x, z);
            const h10 = World.heightAt(x + peakCell, z);
            const h11 = World.heightAt(x + peakCell, z + peakCell);
            const h01 = World.heightAt(x, z + peakCell);
            const rise = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
            const mid = (h00 + h10 + h11 + h01) * 0.25;
            const cx = x + peakCell * 0.5;
            const cz = z + peakCell * 0.5;
            if (mid > -0.35) {
                const kind = landKind(cx, cz, rise);
                const list = batches[kind] || batches.grass;
                const plain = kind === "rock" ? 0.76 : kind === "dirt" ? 0.9 : 1;
                const tone = (px, pz) => (kind === "grass" ? World.turfShade(px, pz) : plain);
                pushQuad(
                    list,
                    [x, h00, z, x / 4, z / 4, tone(x, z)],
                    [x, h01, z + peakCell, x / 4, (z + peakCell) / 4, tone(x, z + peakCell)],
                    [x + peakCell, h11, z + peakCell, (x + peakCell) / 4, (z + peakCell) / 4, tone(x + peakCell, z + peakCell)],
                    [x + peakCell, h10, z, (x + peakCell) / 4, z / 4, tone(x + peakCell, z)]
                );
            }
            const level = World.waterLevel(cx, cz);
            if (level == null || mid > level + 0.45) continue;
            const wy = (hh) => (hh < 0.3 ? 0.03 : hh + 0.16);
            pushQuad(
                batches.water,
                [x, wy(h00), z, x / 8, z / 8, 0.95],
                [x, wy(h01), z + peakCell, x / 8, (z + peakCell) / 8, 0.95],
                [x + peakCell, wy(h11), z + peakCell, (x + peakCell) / 8, (z + peakCell) / 8, 0.95],
                [x + peakCell, wy(h10), z, (x + peakCell) / 8, z / 8, 0.95]
            );
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
uniform float uTime;
uniform float uFlow;
void main() {
    vec2 uv = vUv;
    if (uFlow > 0.5) uv.y += uTime * 0.035;
    vec3 color = texture2D(uTex, uv).rgb * vShade;
    if (uFlow > 0.5) color *= vec3(0.78, 0.9, 0.86);
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
uniform float uYaw;
uniform vec2 uEye;
uniform float uDark;
uniform vec2 uSun;
uniform float uSunUp;
uniform sampler2D uDay;
uniform sampler2D uMorning;
uniform sampler2D uNight;
uniform float uReady;
uniform float uSpin;
void main() {
    float horizon = 0.46 - uPitch * 0.42;
    float t = clamp((gl_FragCoord.y / uRes.y - horizon) / 0.62, 0.0, 1.0);
    vec3 haze = mix(vec3(0.80, 0.75, 0.64), vec3(0.07, 0.08, 0.13), uDark);
    vec3 zenith = mix(vec3(0.42, 0.58, 0.74), vec3(0.02, 0.025, 0.07), uDark);
    vec3 col = mix(haze, zenith, t);
    float aspect = uRes.x / max(uRes.y, 1.0);
    float ndcX = gl_FragCoord.x / uRes.x * 2.0 - 1.0;
    float ndcY = gl_FragCoord.y / uRes.y * 2.0 - 1.0;
    float cp = cos(uPitch);
    float sp = sin(uPitch);
    float sy = sin(uYaw);
    float cy = cos(uYaw);
    vec3 forward = vec3(sy * cp, sp, -cy * cp);
    vec3 right = vec3(cy, 0.0, sy);
    vec3 up = vec3(-sy * sp, cp, cy * sp);
    vec3 ray = normalize(forward + right * ndcX * 0.767 * aspect + up * ndcY * 0.767);
    if (uReady > 0.5) {
        float lon = atan(ray.x, ray.z);
        vec2 uv = vec2(fract(lon / 6.2831853 + 0.5 + uSpin), asin(clamp(ray.y, -1.0, 1.0)) * 0.5 + 0.5);
        vec3 dayCol = texture2D(uDay, uv).rgb;
        vec3 mornCol = texture2D(uMorning, uv).rgb;
        vec3 nightCol = texture2D(uNight, uv).rgb;
        float nightW = smoothstep(0.22, 0.82, uDark);
        float warm = sin(clamp(uDark, 0.0, 1.0) * 3.14159);
        vec3 sky = mix(dayCol, nightCol, nightW);
        sky = mix(sky, mornCol, warm * 0.9);
        sky = mix(sky, haze, smoothstep(0.05, -0.22, ray.y));
        col = sky;
    }
    float ang = atan(ray.x, -ray.z);
    float dx = ray.x;
    float dz = ray.z;
    float north = smoothstep(0.05, 0.92, -dz);
    float elen = length(uEye);
    float outward = elen > 1.0 ? dot(vec2(dx, dz), uEye / elen) : 0.0;
    float sea = smoothstep(0.18, 0.78, outward) * (1.0 - north);
    float bin = ang * 28.0;
    float tip = 1.0 - abs(fract(bin) - 0.5) * 2.0;
    float teeth = fract(sin(floor(bin) * 127.1) * 43758.5);
    float broad = fract(sin(floor(ang * 9.0) * 311.7) * 12543.2);
    float woodH = (0.13 + broad * 0.045 + tip * teeth * 0.09) * (1.0 - sea * 0.78);
    float mountH = north * (0.18 + 0.11 * sin(ang * 2.2) + 0.05 * sin(ang * 5.4 + 0.7));
    float above = gl_FragCoord.y / uRes.y - horizon;
    float mount = (1.0 - smoothstep(mountH - 0.028, mountH + 0.02, above)) * smoothstep(-0.02, 0.02, above) * north;
    float wood = (1.0 - smoothstep(woodH - 0.003, woodH + 0.007, above)) * smoothstep(-0.012, 0.008, above);
    wood *= 1.0 - sea * 0.7;
    vec3 mountCol = mix(vec3(0.50, 0.56, 0.60), vec3(0.08, 0.10, 0.14), uDark);
    vec3 woodCol = mix(vec3(0.20, 0.26, 0.16), vec3(0.03, 0.04, 0.05), uDark);
    col = mix(col, mountCol, mount * 0.62);
    col = mix(col, woodCol, wood * 0.78);
    float seaBand = sea * smoothstep(-0.006, 0.012, above) * (1.0 - smoothstep(0.018, 0.05, above));
    col = mix(col, mix(vec3(0.52, 0.60, 0.64), vec3(0.04, 0.05, 0.08), uDark), seaBand * 0.5);
    if (uReady < 0.5) {
        float sun = smoothstep(0.11, 0.0, distance(gl_FragCoord.xy / uRes, uSun));
        col += vec3(1.0, 0.78, 0.38) * sun * uSunUp * (1.0 - uDark * 0.75) * (1.0 - wood * 0.85);
        col += vec3(0.45, 0.18, 0.04) * (1.0 - t) * smoothstep(0.2, 0.7, uDark) * (1.0 - uDark);
    }
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
    band: gl.getUniformLocation(program, "uBand"),
    time: gl.getUniformLocation(program, "uTime"),
    flow: gl.getUniformLocation(program, "uFlow")
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
    yaw: gl.getUniformLocation(skyProgram, "uYaw"),
    eye: gl.getUniformLocation(skyProgram, "uEye"),
    dark: gl.getUniformLocation(skyProgram, "uDark"),
    sun: gl.getUniformLocation(skyProgram, "uSun"),
    sunUp: gl.getUniformLocation(skyProgram, "uSunUp"),
    day: gl.getUniformLocation(skyProgram, "uDay"),
    morning: gl.getUniformLocation(skyProgram, "uMorning"),
    night: gl.getUniformLocation(skyProgram, "uNight"),
    ready: gl.getUniformLocation(skyProgram, "uReady"),
    spin: gl.getUniformLocation(skyProgram, "uSpin")
};

const skyTex = { day: null, morning: null, night: null };
let skyReady = 0;
function loadSky() {
    const touch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (touch) return;
    const files = [
        ["day", "kenney_skyboxes/Skyboxes/skybox-day.png", 1],
        ["morning", "kenney_skyboxes/Skyboxes/skybox-morning.png", 2],
        ["night", "kenney_skyboxes/Skyboxes/skybox-night.png", 3]
    ];
    let pending = files.length;
    for (const item of files) {
        const img = new Image();
        img.onload = () => {
            const scale = document.createElement("canvas");
            scale.width = 1024;
            scale.height = 512;
            scale.getContext("2d").drawImage(img, 0, 0, 1024, 512);
            const tex = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0 + item[2]);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scale);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.activeTexture(gl.TEXTURE0);
            skyTex[item[0]] = tex;
            pending -= 1;
            if (pending === 0) skyReady = 1;
        };
        img.src = item[1];
    }
}
loadSky();

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
    for (const spot of World.groves) {
        const y = Math.max(0, World.heightAt(spot.x, spot.z));
        treeSpots.push({ x: spot.x, z: spot.z, y: y, pine: spot.kind === "pine" });
        impostor(spot.x, spot.z, y, spot.kind === "pine");
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
            const tone = (px, pz) => (rocky ? 0.72 : World.turfShade(px, pz) * 0.94);
            pushQuad(
                list,
                [x, h00, z, x / 16, z / 16, tone(x, z)],
                [x, h01, z + cell, x / 16, (z + cell) / 16, tone(x, z + cell)],
                [x + cell, h11, z + cell, (x + cell) / 16, (z + cell) / 16, tone(x + cell, z + cell)],
                [x + cell, h10, z, (x + cell) / 16, z / 16, tone(x + cell, z)]
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
    for (const b of Town.buildings) {
        const y = Math.max(0, World.heightAt(b.x, b.z));
        addBox(batches.horizonWall, b.minX, y, b.minZ, b.w, 3.1, b.d);
        addBox(batches.horizonRoof, b.minX - 0.2, y + 3.1, b.minZ - 0.2, b.w + 0.4, 0.7, b.d + 0.4);
    }
    for (const place of World.places) {
        const y = Math.max(0, World.heightAt(place.x, place.z));
        addBox(batches.horizonWall, place.x - 16, y, place.z - 10, 12, 8, 9);
        addBox(batches.horizonRoof, place.x - 17, y + 8, place.z - 11, 14, 3.2, 11);
        addBox(batches.horizonWall, place.x + 2, y, place.z - 4, 11, 7, 8);
        addBox(batches.horizonRoof, place.x + 1, y + 7, place.z - 5, 13, 2.8, 10);
    }
}

function dressSouthMeadow() {
    const yAt = (x, z) => Math.max(0, World.heightAt(x, z));
    const post = (x, z) => {
        const y = yAt(x, z);
        addBox(batches.trunk, x - 0.07, y, z - 0.07, 0.14, 0.92, 0.14);
        scenery.push({ x: x - 0.07, z: z - 0.07, w: 0.14, d: 0.14 });
    };
    const outZ = 90;
    const plant = (x, z, pine) => {
        z += outZ;
        if (World.wet(x, z) || World.roadDist(x, z) < 14) return;
        const y = yAt(x, z);
        treeSpots.push({ x, z, y, pine: !!pine });
        impostor(x, z, y, !!pine);
    };
    const bush = (x, z) => {
        z += outZ;
        const y = yAt(x, z);
        const w = 0.7;
        const d = 0.62;
        addBox(batches.leaf, x - w / 2, y, z - d / 2, w, 0.48, d);
        addBox(batches.leaf, x - 0.22, y + 0.28, z - 0.18, 0.44, 0.28, 0.4);
        scenery.push({ x: x - w / 2, z: z - d / 2, w, d });
    };
    const rock = (x, z) => {
        z += outZ;
        const y = yAt(x, z);
        addBox(batches.rock, x - 0.34, y, z - 0.26, 0.68, 0.28, 0.5);
        addBox(batches.rock, x - 0.12, y + 0.22, z - 0.1, 0.36, 0.22, 0.28);
        scenery.push({ x: x - 0.34, z: z - 0.26, w: 0.68, d: 0.5 });
    };
    const stump = (x, z) => {
        z += outZ;
        const y = yAt(x, z);
        addBox(batches.trunk, x - 0.2, y, z - 0.2, 0.4, 0.24, 0.4);
        scenery.push({ x: x - 0.2, z: z - 0.2, w: 0.4, d: 0.4 });
    };
    const log = (x, z) => {
        z += outZ;
        const y = yAt(x, z);
        addBox(batches.trunk, x, y + 0.06, z, 1.7, 0.26, 0.3);
        scenery.push({ x, z, w: 1.7, d: 0.3 });
    };
    const flowers = (x, z) => {
        z += outZ;
        const y = yAt(x, z);
        addBox(batches.leaf, x - 0.14, y, z - 0.14, 0.28, 0.12, 0.28);
        addBox(batches.bloom, x - 0.08, y + 0.1, z - 0.08, 0.16, 0.18, 0.16);
        addBox(batches.bloom, x + 0.1, y + 0.08, z + 0.04, 0.12, 0.14, 0.12);
    };
    const cropsAt = (x, z, w) => {
        for (let i = 0; i < w; i += 8) {
            const piece = Math.min(8, w - i);
            const y = yAt(x + i + piece * 0.5, z);
            addBox(batches.leaf, x + i, y, z, piece, 0.34, 0.55);
        }
    };
    const crops = (x, z, w) => cropsAt(x, z + outZ, w);
    const fenceSpan = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        if (len < 0.4) return;
        const n = Math.max(1, Math.round(len / 5));
        for (let i = 0; i <= n; i++) {
            const x = x0 + (x1 - x0) * (i / n);
            const z = z0 + (z1 - z0) * (i / n);
            post(x, z);
            if (i === n) break;
            const x2 = x0 + (x1 - x0) * ((i + 1) / n);
            const z2 = z0 + (z1 - z0) * ((i + 1) / n);
            const rx = Math.min(x, x2);
            const rz = Math.min(z, z2);
            const rw = Math.max(0.08, Math.abs(x2 - x));
            const rd = Math.max(0.08, Math.abs(z2 - z));
            const y = yAt((x + x2) * 0.5, (z + z2) * 0.5);
            addBox(batches.trunk, rx, y + 0.36, rz, rw, 0.07, rd);
            addBox(batches.trunk, rx, y + 0.68, rz, rw, 0.07, rd);
            scenery.push({ x: rx, z: rz, w: rw, d: rd });
        }
    };
    const fenceAt = (x0, z0, x1, z1, gap) => {
        if (!gap) {
            fenceSpan(x0, z0, x1, z1);
            return;
        }
        const along0 = Math.abs(z1 - z0) <= Math.abs(x1 - x0) ? x0 : z0;
        const along1 = Math.abs(z1 - z0) <= Math.abs(x1 - x0) ? x1 : z1;
        const delta = along1 - along0 || 1;
        let t0 = (gap.at - gap.width / 2 - along0) / delta;
        let t1 = (gap.at + gap.width / 2 - along0) / delta;
        if (t0 > t1) {
            const swap = t0;
            t0 = t1;
            t1 = swap;
        }
        const at = (t) => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
        if (t0 > 0.02) {
            const cut = at(Math.min(1, t0));
            fenceSpan(x0, z0, cut[0], cut[1]);
        }
        if (t1 < 0.98) {
            const cut = at(Math.max(0, t1));
            fenceSpan(cut[0], cut[1], x1, z1);
        }
    };
    const houseNear = (x, z) => {
        let best = null;
        let bestD = Infinity;
        for (const farm of Town.farms) {
            const house = farm.buildings.find((b) => b.role === "farmhouse");
            if (!house) continue;
            const dist = Math.hypot(house.x - x, house.z - z);
            if (dist < bestD) {
                bestD = dist;
                best = house;
            }
        }
        return best || { x: x, z: z };
    };
    const farmPlot = (x, z, w, d) => {
        const gate = Town.fieldGate({ x: x, z: z, w: w, d: d }, houseNear(x + w / 2, z + d / 2));
        const open = (side) => gate.side === side ? gate : null;
        fenceAt(x, z, x + w, z, open("north"));
        fenceAt(x + w, z, x + w, z + d, open("east"));
        fenceAt(x + w, z + d, x, z + d, open("south"));
        fenceAt(x, z + d, x, z, open("west"));
        const step = d < 24 ? 6 : 8;
        for (let row = z + 3; row < z + d - 3; row += step) cropsAt(x + 3, row, Math.max(4, w - 6));
    };
    farmPlot(-1508, -900, 58, 36);
    farmPlot(-1406, -1034, 54, 42);
    farmPlot(1128, -1426, 48, 18);
    farmPlot(1192, -1426, 40, 18);
    farmPlot(694, 1398, 56, 40);
    farmPlot(814, 1398, 56, 40);
    const westField = { x: -2570, z: 758, w: 74, d: 54 };
    const eastField = { x: -2464, z: 764, w: 56, d: 48 };
    const westGate = Town.fieldGate(westField, houseNear(-2533, 785));
    const eastGate = Town.fieldGate(eastField, houseNear(-2436, 788));
    const openSide = (gate, side) => gate.side === side ? gate : null;
    fenceAt(-2570, 758, -2496, 758, openSide(westGate, "south"));
    fenceAt(-2570, 758, -2570, 812, openSide(westGate, "west"));
    fenceAt(-2570, 812, -2496, 812, openSide(westGate, "north"));
    fenceAt(-2464, 764, -2408, 764, openSide(eastGate, "south"));
    fenceAt(-2408, 764, -2408, 812, openSide(eastGate, "east"));
    fenceAt(-2408, 812, -2464, 812, openSide(eastGate, "north"));
    for (let z = 678; z <= 712; z += 8) crops(-2562, z, 60);
    for (let z = 684; z <= 712; z += 8) crops(-2456, z, 42);
    [
        [-2596, 748], [-2622, 732], [-2578, 768, true], [-2644, 760],
        [-2610, 790], [-2660, 728], [-2588, 804], [-2636, 802, true],
        [-2558, 736], [-2672, 778], [-2604, 716], [-2648, 690],
        [-2516, 742], [-2532, 776], [-2508, 804, true], [-2544, 754],
        [-2446, 746], [-2422, 772], [-2458, 794, true], [-2408, 738],
        [-2434, 818], [-2394, 786], [-2470, 762], [-2416, 812]
    ].forEach((spot) => plant(spot[0], spot[1], spot[2]));
    [[-2552, 652], [-2502, 658], [-2452, 660], [-2396, 700], [-2588, 740], [-2610, 708], [-2564, 788], [-2466, 744], [-2416, 748], [-2384, 668], [-2518, 736], [-2440, 734]].forEach((spot) => bush(spot[0], spot[1]));
    [[-2630, 745], [-2592, 770], [-2548, 748], [-2518, 656], [-2444, 664], [-2388, 704]].forEach((spot) => rock(spot[0], spot[1]));
    stump(-2606, 760);
    stump(-2652, 742);
    stump(-2524, 728);
    stump(-2436, 752);
    log(-2628, 718);
    log(-2526, 748);
    log(-2438, 770);
    [[-2512, 652], [-2504, 644], [-2528, 648], [-2468, 656], [-2454, 642], [-2472, 650], [-2398, 688], [-2390, 656], [-2508, 730], [-2456, 730]].forEach((spot) => flowers(spot[0], spot[1]));
    for (let z = 646; z <= 662; z += 4) {
        flowers(-2508, z);
        flowers(-2452, z);
    }
}

function raiseCliffs() {
    const pointAlong = (line, u) => {
        let total = 0;
        const lens = [];
        for (let i = 1; i < line.length; i++) {
            const len = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
            lens.push(len);
            total += len;
        }
        let dist = Math.max(0, Math.min(1, u)) * total;
        for (let i = 0; i < lens.length; i++) {
            if (dist <= lens[i] || i === lens.length - 1) {
                const t = lens[i] ? dist / lens[i] : 0;
                return [
                    line[i][0] + (line[i + 1][0] - line[i][0]) * t,
                    line[i][1] + (line[i + 1][1] - line[i][1]) * t
                ];
            }
            dist -= lens[i];
        }
        return line[line.length - 1];
    };
    for (const line of World.cliffs) {
        let total = 0;
        for (let i = 1; i < line.length; i++) {
            total += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
        }
        const n = Math.max(4, Math.round(total / 2.3));
        for (let i = 0; i <= n; i++) {
            const u = i / n;
            const spot = pointAlong(line, u);
            const x = spot[0];
            const z = spot[1];
            const y = Math.max(0, World.heightAt(x, z));
            const taper = Math.sin(Math.PI * u);
            const nse = Math.sin(x * 12.9898 + z * 78.233 + 9) * 43758.5453;
            const roll = nse - Math.floor(nse);
            const h = 1.7 + taper * (4.4 + roll * 2.1);
            const w = 3.1 + taper * 1.6 + roll * 0.5;
            const d = 3.2 + taper * 1.3;
            addBox(batches.rock, x - w / 2, y, z - d / 2, w, h, d);
            if (taper > 0.4) {
                const cw = w * 0.58;
                const cd = d * 0.5;
                addBox(batches.rock, x - cw / 2 + (roll - 0.5) * 0.7, y + h * 0.58, z - cd / 2, cw, h * 0.5, cd);
            }
            scenery.push({ x: x - w / 2, z: z - d / 2, w: w, d: d });
        }
    }
}

function dressFarms() {
    const yAt = (x, z) => Math.max(0, World.heightAt(x, z));
    const post = (x, z) => {
        const y = yAt(x, z);
        addBox(batches.trunk, x - 0.07, y, z - 0.07, 0.14, 0.92, 0.14);
        scenery.push({ x: x - 0.07, z: z - 0.07, w: 0.14, d: 0.14 });
    };
    const rail = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0) || 1;
        const n = Math.max(1, Math.round(len / 5));
        for (let i = 0; i <= n; i++) {
            const x = x0 + (x1 - x0) * (i / n);
            const z = z0 + (z1 - z0) * (i / n);
            post(x, z);
            if (i === n) break;
            const x2 = x0 + (x1 - x0) * ((i + 1) / n);
            const z2 = z0 + (z1 - z0) * ((i + 1) / n);
            const rx = Math.min(x, x2);
            const rz = Math.min(z, z2);
            const rw = Math.max(0.08, Math.abs(x2 - x));
            const rd = Math.max(0.08, Math.abs(z2 - z));
            const y = yAt((x + x2) * 0.5, (z + z2) * 0.5);
            addBox(batches.trunk, rx, y + 0.36, rz, rw, 0.07, rd);
            addBox(batches.trunk, rx, y + 0.68, rz, rw, 0.07, rd);
            scenery.push({ x: rx, z: rz, w: rw, d: rd });
        }
    };
    const edge = (x0, z0, x1, z1, gap) => {
        const horizontal = Math.abs(z1 - z0) < 0.01;
        if (!gap) {
            rail(x0, z0, x1, z1);
            return;
        }
        const along0 = horizontal ? x0 : z0;
        const along1 = horizontal ? x1 : z1;
        const lo = Math.min(along0, along1);
        const hi = Math.max(along0, along1);
        const cut0 = Math.max(lo, gap.at - gap.width / 2);
        const cut1 = Math.min(hi, gap.at + gap.width / 2);
        const piece = (a, b) => {
            if (b - a < 0.4) return;
            if (horizontal) rail(a, z0, b, z1);
            else rail(x0, a, x1, b);
        };
        piece(lo, cut0);
        piece(cut1, hi);
    };
    const fenceRect = (rect) => {
        const gap = rect.gap;
        edge(rect.x, rect.z, rect.x + rect.w, rect.z, gap && gap.side === "north" ? gap : null);
        edge(rect.x, rect.z + rect.d, rect.x + rect.w, rect.z + rect.d, gap && gap.side === "south" ? gap : null);
        edge(rect.x, rect.z, rect.x, rect.z + rect.d, gap && gap.side === "west" ? gap : null);
        edge(rect.x + rect.w, rect.z, rect.x + rect.w, rect.z + rect.d, gap && gap.side === "east" ? gap : null);
    };
    const layTrack = (points) => {
        const width = 2.3;
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            const n = Math.max(1, Math.round(len / 2));
            const px = -(b[1] - a[1]) / len * width * 0.5;
            const pz = (b[0] - a[0]) / len * width * 0.5;
            for (let s = 0; s < n; s++) {
                const t0 = s / n;
                const t1 = (s + 1) / n;
                const x0 = a[0] + (b[0] - a[0]) * t0;
                const z0 = a[1] + (b[1] - a[1]) * t0;
                const x1 = a[0] + (b[0] - a[0]) * t1;
                const z1 = a[1] + (b[1] - a[1]) * t1;
                const y0 = yAt(x0, z0) + 0.06;
                const y1 = yAt(x1, z1) + 0.06;
                pushQuad(
                    batches.dirt,
                    [x0 + px, y0, z0 + pz, x0 / 4, z0 / 4, 0.92],
                    [x1 + px, y1, z1 + pz, x1 / 4, z1 / 4, 0.92],
                    [x1 - px, y1, z1 - pz, x1 / 4, z1 / 4, 0.92],
                    [x0 - px, y0, z0 - pz, x0 / 4, z0 / 4, 0.92]
                );
            }
        }
    };
    const drawTimber = (b) => {
        const x = b.minX;
        const z = b.minZ;
        const y = b.y || 0;
        const w = b.w;
        const d = b.d;
        const h = b.role === "shed" ? 2.35 : 3.15;
        const t = 0.18;
        const doorW = b.role === "shed" ? 1.15 : 1.45;
        const doorH = 2.05;
        const face = b.entrance || "north";
        const holeFor = (side, along) => {
            if (side !== face) return null;
            return { at: (along - doorW) / 2, size: doorW, y1: doorH };
        };
        const span = (ox, oz, len, depth, axis, hole) => {
            if (!hole) {
                addBox(batches.trunk, ox, y, oz, axis === "x" ? len : depth, h, axis === "x" ? depth : len);
                return;
            }
            const after = len - (hole.at + hole.size);
            if (axis === "x") {
                addBox(batches.trunk, ox, y, oz, hole.at, h, depth);
                addBox(batches.trunk, ox + hole.at + hole.size, y, oz, after, h, depth);
                addBox(batches.trunk, ox + hole.at, y + hole.y1, oz, hole.size, h - hole.y1, depth);
            } else {
                addBox(batches.trunk, ox, y, oz, depth, h, hole.at);
                addBox(batches.trunk, ox, y, oz + hole.at + hole.size, depth, h, after);
                addBox(batches.trunk, ox, y + hole.y1, oz + hole.at, depth, h - hole.y1, hole.size);
            }
        };
        span(x, z + d - t, w, t, "x", holeFor("south", w));
        span(x, z, w, t, "x", holeFor("north", w));
        span(x, z, d, t, "z", holeFor("west", d));
        span(x + w - t, z, d, t, "z", holeFor("east", d));
        const ridge = y + h + Math.min(w, d) * 0.34;
        const yEave = y + h - 0.04;
        if (w >= d) {
            const mid = z + d / 2;
            pushQuad(batches.roof, [x - 0.15, yEave, z - 0.1, 0, 0, 0.9], [x - 0.15, ridge, mid, 0, 0.5, 1], [x + w + 0.15, ridge, mid, 1, 0.5, 1], [x + w + 0.15, yEave, z - 0.1, 1, 0, 0.9]);
            pushQuad(batches.roof, [x - 0.15, yEave, z + d + 0.1, 0, 0, 0.78], [x + w + 0.15, yEave, z + d + 0.1, 1, 0, 0.78], [x + w + 0.15, ridge, mid, 1, 0.5, 1], [x - 0.15, ridge, mid, 0, 0.5, 1]);
        } else {
            const mid = x + w / 2;
            pushQuad(batches.roof, [x - 0.1, yEave, z - 0.15, 0, 0, 0.9], [x - 0.1, yEave, z + d + 0.15, 0, 1, 0.9], [mid, ridge, z + d + 0.15, 0.5, 1, 1], [mid, ridge, z - 0.15, 0.5, 0, 1]);
            pushQuad(batches.roof, [x + w + 0.1, yEave, z - 0.15, 1, 0, 0.78], [mid, ridge, z - 0.15, 0.5, 0, 1], [mid, ridge, z + d + 0.15, 0.5, 1, 1], [x + w + 0.1, yEave, z + d + 0.15, 1, 1, 0.78]);
        }
    };
    const drawHay = (x, z) => {
        const y = yAt(x, z);
        addBox(batches.dirt, x, y, z, 1.6, 0.7, 1.25);
        addBox(batches.dirt, x + 0.28, y + 0.7, z + 0.22, 1.05, 0.5, 0.82);
        addBox(batches.dirt, x + 0.55, y + 1.15, z + 0.42, 0.5, 0.32, 0.42);
        scenery.push({ x: x, z: z, w: 1.6, d: 1.25 });
    };
    const drawCart = (x, z) => {
        const y = yAt(x, z);
        addBox(batches.trunk, x, y + 0.38, z, 1.9, 0.1, 0.95);
        addBox(batches.trunk, x, y + 0.42, z, 0.08, 0.38, 0.95);
        addBox(batches.trunk, x + 1.82, y + 0.42, z, 0.08, 0.38, 0.95);
        addBox(batches.trunk, x, y + 0.42, z, 1.9, 0.32, 0.08);
        addBox(batches.trunk, x, y + 0.42, z + 0.87, 1.9, 0.32, 0.08);
        addBox(batches.rock, x + 0.12, y + 0.05, z - 0.06, 0.32, 0.32, 0.32);
        addBox(batches.rock, x + 1.42, y + 0.05, z - 0.06, 0.32, 0.32, 0.32);
        addBox(batches.rock, x + 0.12, y + 0.05, z + 0.7, 0.32, 0.32, 0.32);
        addBox(batches.rock, x + 1.42, y + 0.05, z + 0.7, 0.32, 0.32, 0.32);
        scenery.push({ x: x, z: z - 0.08, w: 1.9, d: 1.15 });
    };
    for (const farm of Town.farms) {
        for (const building of farm.buildings) {
            if (building.role === "barn" || building.role === "shed") drawTimber(building);
        }
        if (farm.yard) fenceRect(farm.yard);
        if (farm.pen) {
            fenceRect(farm.pen);
            const y = yAt(farm.pen.x + 0.6, farm.pen.z + 0.5);
            addBox(batches.trunk, farm.pen.x + 0.45, y, farm.pen.z + 0.4, 1.3, 0.28, 0.45);
            scenery.push({ x: farm.pen.x + 0.45, z: farm.pen.z + 0.4, w: 1.3, d: 0.45 });
        }
        if (farm.garden) {
            const g = farm.garden;
            fenceRect(g);
            for (let row = g.z + 1.2; row < g.z + g.d - 1; row += 1.5) {
                addBox(batches.leaf, g.x + 0.8, yAt(g.x + g.w / 2, row), row, Math.max(2, g.w - 1.6), 0.28, 0.4);
            }
        }
        for (const spot of farm.orchard || []) {
            const y = yAt(spot[0], spot[1]);
            treeSpots.push({ x: spot[0], z: spot[1], y: y, pine: false });
            impostor(spot[0], spot[1], y, false);
        }
        for (const spot of farm.hay || []) drawHay(spot[0], spot[1]);
        for (const spot of farm.cart || []) drawCart(spot[0], spot[1]);
        for (const track of farm.tracks || []) layTrack(track);
    }
}

growScenery();
raiseCliffs();
dressSouthMeadow();
dressFarms();
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
    const near = [];
    for (const spot of treeSpots) {
        const ox = spot.x - cam.x;
        const oz = spot.z - cam.z;
        const d2 = ox * ox + oz * oz;
        if (d2 > 175 * 175) continue;
        near.push({ spot: spot, d2: d2 });
    }
    if (near.length > 180) {
        near.sort((a, b) => a.d2 - b.d2);
        near.length = 180;
    }
    for (let i = 0; i < near.length; i++) {
        const spot = near[i].spot;
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
        addPerson(cloth[man.faction], skin, pants, steel, man.x - 0.24, man.z - 0.14, personXf(man), man.swing, man.fisher || man.farmer);
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
    const prev = new Map(men.filter((man) => !man.fisher && !man.farmer && !man.archer && !man.decor && !man.driver).map((man) => [man.faction + ":" + man.index, man]));
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
    const keptFish = men.filter((man) => man.fisher || man.farmer || man.archer || man.decor || man.driver);
    for (const man of men) {
        if (man.fisher || man.farmer || man.archer || man.decor || man.driver) continue;
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
    adoptHero(data.hero);
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
    const farmKey = (data.farms || []).map((farm) => farm.id + ":" + farm.health + ":" + farm.phase).join(",");
    const key = (data.owners || []).join(",") + "#" + attacks + "#" + units + "#" + fish + "#" + wood + "#" + arch + "#" + carts + "#" + farmKey;
    if (key === soldierKey) {
        ensureCottages(data);
        touchFarmers(data);
        raisePlots(data);
        return;
    }
    soldierKey = key;
    ensureCottages(data);
    mergeMen(data);
    mergeFishermen(data);
    mergeFarmers(data);
    mergeArchers(data);
    mergeDrivers(data);
    raisePlots(data);
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

function touchFarmers(data) {
    for (const item of data.farms || []) {
        const man = men.find((one) => one.farmer && one.farmId === item.id);
        if (!man) continue;
        man.phase = item.phase;
        man.path = item.path || null;
        man.along = item.along || 0;
        man.length = item.length || 0;
        man.playAt = item.playAt || 0;
        man.health = pendingHit ? Math.min(man.health, item.health) : item.health;
        man.faction = item.owner;
        man.spots = item.spots || man.spots;
        man.nap = item.nap || man.nap;
        if (man.health <= 0) man.dying = true;
    }
}

function mergeFarmers(data) {
    const wanted = data.farms || [];
    const prev = new Map(men.filter((man) => man.farmer).map((man) => [man.farmId, man]));
    const keep = new Set();
    const next = [];
    for (const item of wanted) {
        if (item.health <= 0) continue;
        keep.add(item.id);
        const old = prev.get(item.id);
        if (old) {
            old.health = pendingHit ? Math.min(old.health, item.health) : item.health;
            old.faction = item.owner;
            old.phase = item.phase;
            old.path = item.path || null;
            old.along = item.along || 0;
            old.length = item.length || 0;
            old.playAt = item.playAt || 0;
            old.spots = item.spots || [];
            old.nap = item.nap || [];
            old.village = item.village;
            if (old.health <= 0) old.dying = true;
            next.push(old);
        } else {
            next.push({
                farmer: true,
                fisher: false,
                farmId: item.id,
                village: item.village,
                faction: item.owner,
                index: -320 - wanted.indexOf(item),
                health: item.health,
                phase: item.phase,
                post: item.village,
                mode: "farm",
                x: item.x,
                z: item.z,
                yaw: item.yaw || 0,
                path: item.path || null,
                along: item.along || 0,
                length: item.length || 0,
                playAt: item.playAt || 0,
                spots: item.spots || [],
                nap: item.nap || [],
                spot: 0,
                bob: 0,
                down: 0,
                swing: -1,
                hostile: false,
                attackIn: 0,
                striking: 0,
                struck: false,
                dying: false
            });
        }
    }
    for (const man of men) {
        if (!man.farmer || keep.has(man.farmId)) continue;
        man.dying = true;
        man.health = 0;
        next.push(man);
    }
    const rest = men.filter((man) => !man.farmer);
    men.length = 0;
    men.push(...rest, ...next);
    actorsDirty = true;
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
    if (!lodge || !lodge.cart || lodge.cart.hp <= 0) return false;
    lodge.cart.hp -= 1;
    showStrike(lodge.cart.hp > 0 ? "Cart " + lodge.cart.hp : "Cart lost");
    postHit({ cart: lodge.id });
    return true;
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
    saveHero();
});
window.addEventListener("pagehide", () => {
    flushPlay();
    if (heroReady) {
        hero.hp = player.hp;
        fetch("/api/campaign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            keepalive: true,
            body: JSON.stringify({ hero: Hero.normalize(hero) })
        }).catch(() => {});
    }
});

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
    const max = Math.max(1, player.max);
    healthFill.style.width = Math.max(0, player.hp / max * 100) + "%";
    const staminaFill = document.getElementById("stamina-fill");
    const magickaFill = document.getElementById("magicka-fill");
    if (staminaFill) staminaFill.style.width = Math.max(0, hero.stamina / Math.max(1, Hero.maxStamina(hero)) * 100) + "%";
    if (magickaFill) magickaFill.style.width = Math.max(0, hero.magicka / Math.max(1, Hero.maxMagicka(hero)) * 100) + "%";
}

function applyHeroVitals(fromSave) {
    player.max = Hero.maxHealth(hero);
    if (fromSave) {
        if (hero.hp <= 0) hero.hp = player.max;
        player.hp = Math.max(0, Math.min(player.max, hero.hp));
    } else {
        player.hp = Math.min(player.hp, player.max);
    }
    hero.hp = player.hp;
    hero.stamina = Math.min(Hero.maxStamina(hero), hero.stamina);
    hero.magicka = Math.min(Hero.maxMagicka(hero), hero.magicka);
    paintHealth();
    paintSheet();
}

function adoptHero(raw) {
    if (!raw) return;
    const next = Hero.normalize(raw);
    if (heroReady && next.raised <= hero.raised) return;
    hero = next;
    heroReady = true;
    applyHeroVitals(true);
}

function scheduleHeroSave() {
    if (!heroReady) return;
    clearTimeout(heroSaveTimer);
    heroSaveTimer = setTimeout(saveHero, 500);
}

function saveHero() {
    if (!heroReady) return;
    clearTimeout(heroSaveTimer);
    hero.hp = player.hp;
    const sent = hero.raised;
    fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ hero: Hero.normalize(hero) })
    }).then((res) => res.json()).then((data) => {
        if (hero.raised === sent) adoptHero(data.hero);
    }).catch(() => {});
}

function notePractice(use) {
    const result = Hero.practiceUse(hero, use);
    if (!result) return;
    hero = result.hero;
    player.max = Hero.maxHealth(hero);
    if (result.leveled) {
        hero.hp = player.max;
        hero.stamina = Hero.maxStamina(hero);
        hero.magicka = Hero.maxMagicka(hero);
        player.hp = player.max;
        showStrike("Level " + hero.level);
    } else if (result.gained) {
        player.hp = Math.min(player.hp, player.max);
        showStrike(result.name + " " + result.value);
    } else {
        player.hp = Math.min(player.hp, player.max);
    }
    hero.hp = player.hp;
    paintHealth();
    paintSheet();
    scheduleHeroSave();
}

function tickHero(dt) {
    const stamina = Math.min(Hero.maxStamina(hero), hero.stamina + Hero.staminaRegen(hero) * dt);
    const magicka = Math.min(Hero.maxMagicka(hero), hero.magicka + Hero.magickaRegen(hero) * dt);
    if (stamina === hero.stamina && magicka === hero.magicka) return;
    hero.stamina = stamina;
    hero.magicka = magicka;
    paintHealth();
    if (selfPanel && !selfPanel.hidden) paintSheet();
}

function paintSheet() {
    if (!selfPanel || selfPanel.hidden) return;
    const level = document.getElementById("self-level");
    if (level) level.textContent = "Level " + hero.level;
    const attrs = document.getElementById("self-attributes");
    const skills = document.getElementById("self-skills");
    if (attrs) {
        attrs.innerHTML = Hero.ATTRIBUTES.map((attr) => (
            "<li><span>" + attr.name + "</span><b>" + hero.attributes[attr.id] + "</b></li>"
        )).join("");
    }
    if (skills) {
        skills.innerHTML = Hero.SKILLS.map((skill) => {
            const value = hero.skills[skill.id];
            const span = Hero.needed(value);
            const pct = value >= 100 ? 100 : Math.max(0, Math.min(100, (hero.practice[skill.id] || 0) / span * 100));
            return "<li><span>" + skill.name + "</span><b>" + value + "</b><i style=\"width:" + pct.toFixed(0) + "%\"></i></li>";
        }).join("");
    }
}

function flashHurt() {
    hurt.classList.add("show");
    clearTimeout(flashHurt.timer);
    flashHurt.timer = setTimeout(() => hurt.classList.remove("show"), 380);
}

function hurtPlayer(amount) {
    if (inside || player.dead || player.guard > 0) return;
    player.hp = Math.max(0, player.hp - amount);
    hero.hp = player.hp;
    player.guard = 0.45;
    paintHealth();
    scheduleHeroSave();
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
    player.max = Hero.maxHealth(hero);
    player.hp = player.max;
    hero.hp = player.hp;
    hero.stamina = Hero.maxStamina(hero);
    hero.magicka = Hero.maxMagicka(hero);
    player.dead = 0;
    player.guard = 1.4;
    cam.x = places[2].ox;
    cam.y = 1.62;
    hop = 0;
    cam.z = places[2].oz + 20;
    cam.yaw = 0;
    cam.pitch = 0;
    death.classList.remove("show");
    death.hidden = true;
    paintHealth();
    scheduleHeroSave();
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
    if (man.farmer) {
        man.health -= 1;
        if (man.health <= 0) {
            man.dying = true;
            if (!quiet) showStrike("Slain");
        } else if (!quiet) {
            showStrike(word);
        }
        actorsDirty = true;
        postHit({ farmer: man.farmId });
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
        if (strikeGate(gate)) notePractice("sword");
        return;
    }
    if (!best) {
        const cart = cartUnder(ox + fx * Math.min(1.4, profile.reach), oz + fz * Math.min(1.4, profile.reach));
        if (cart && strikeCart(cart)) notePractice("sword");
        return;
    }
    const label = swing.kind === "chop" ? "Chop" : swing.kind === "thrust" ? "Thrust" : "Slash";
    if (wound(best, label, false, fx * 0.28, fz * 0.28)) notePractice("sword");
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
        if (other === man || other.dying || other.health <= 0 || other.fisher || other.farmer) continue;
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

function farmerDoor(village, door) {
    let best = null;
    let bestDist = 2.4;
    for (const leaf of doors) {
        if (leaf.role !== "farmhouse") continue;
        if (leaf.id.indexOf(village + ":farmhouse") !== 0) continue;
        const dist = door ? Math.hypot(leaf.x - door.x, leaf.z - door.z) : 0;
        if (dist < bestDist) {
            best = leaf;
            bestDist = dist;
        }
    }
    return best;
}

function holdFarmDoor(man, open) {
    const leaf = farmerDoor(man.village, man.nap && man.nap[1]);
    if (!leaf) return;
    if (open) {
        leaf.want = true;
        leaf.farmHold = true;
    } else if (leaf.farmHold) {
        leaf.want = false;
        leaf.farmHold = false;
    }
}

function stepFarmer(man, dt) {
    const nap = man.nap || [];
    const door = nap[1];
    if (man.phase === "sleep") {
        const here = { x: man.x, z: man.z, y: man.floorY || 0 };
        stepIndoor(man, [here].concat(nap), dt, 2.2, "hide", "farmbed" + man.farmId);
        const near = door && Math.hypot(man.x - door.x, man.z - door.z) < 2.2;
        holdFarmDoor(man, near || man.indoors);
        man.swing = -1;
        man.walking = !man.hidden;
        man.mode = "farm";
        plant(man);
        actorsDirty = true;
        return false;
    }
    if (man.hidden || man.indoors) {
        const leaving = nap.length ? nap.slice().reverse() : [];
        const near = door && Math.hypot(man.x - door.x, man.z - door.z) < 2.2;
        holdFarmDoor(man, true);
        if (stepIndoor(man, leaving, dt, 2.2, "leave", "farmout" + man.farmId)) {
            holdFarmDoor(man, near);
            plant(man);
            actorsDirty = true;
            return false;
        }
        holdFarmDoor(man, false);
    }
    if ((man.phase === "haul" || man.phase === "back") && man.path && man.path.length > 1) {
        const extra = Math.max(0, (gameMs() - (man.playAt || 0)) / 1000) * 2.2;
        const dist = Math.min(man.length || 0, (man.along || 0) + extra);
        const pose = pathPose(man.path, dist);
        man.x = pose.x;
        man.z = pose.z;
        man.yaw = pose.yaw;
        man.floorY = null;
        man.walking = dist + 0.2 < (man.length || 0);
        man.bob = Math.sin(performance.now() * 0.01) * 0.04;
        man.swing = -1;
        man.mode = "farm";
        plant(man);
        actorsDirty = true;
        return false;
    }
    const spots = man.spots || [];
    if (!spots.length) {
        man.walking = false;
        plant(man);
        return false;
    }
    if (man.spot == null || man.spot >= spots.length) man.spot = 0;
    const goal = spots[man.spot];
    const beforeX = man.x;
    const beforeZ = man.z;
    const moving = moveToward(man, goal.x, goal.z, dt, 2.2);
    if (!moving) man.spot = (man.spot + 1) % spots.length;
    else if (Math.hypot(man.x - beforeX, man.z - beforeZ) < 0.002) {
        man.stuck = (man.stuck || 0) + dt;
        if (man.stuck > 1.2) {
            man.spot = (man.spot + 1) % spots.length;
            man.stuck = 0;
        }
    } else man.stuck = 0;
    man.walking = Boolean(moving);
    man.bob = Math.sin(performance.now() * (moving ? 0.012 : 0.004)) * (moving ? 0.045 : 0.015);
    man.swing = -1;
    man.floorY = null;
    man.mode = "farm";
    plant(man);
    actorsDirty = true;
    return false;
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
    if (inside) return;
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

function wallStopT(x0, y0, z0, x1, y1, z1) {
    let best = null;
    const offer = (t) => {
        if (t > 0.02 && t <= 1 && (best == null || t < best)) best = t;
    };
    const cross = (axis, at, span0, span1, gap) => {
        const d0 = axis === "z" ? z0 : x0;
        const d1 = axis === "z" ? z1 : x1;
        const delta = d1 - d0;
        if (Math.abs(delta) < 0.0001) return;
        const t = (at - d0) / delta;
        if (t < 0 || t > 1) return;
        const along0 = axis === "z" ? x0 : z0;
        const along = along0 + ((axis === "z" ? x1 - x0 : z1 - z0) * t);
        if (along < Math.min(span0, span1) || along > Math.max(span0, span1)) return;
        if (Math.abs(along - gap) < GATE_HALF + 0.2) return;
        if (y0 + (y1 - y0) * t < 2.25) offer(t);
    };
    for (let village = 0; village < 4; village++) {
        const box = palisadeBox(village);
        cross("z", box.minZ, box.minX, box.maxX, box.cx);
        cross("z", box.maxZ, box.minX, box.maxX, box.cx);
        cross("x", box.minX, box.minZ, box.maxZ, box.cz);
        cross("x", box.maxX, box.minZ, box.maxZ, box.cz);
    }
    return best;
}

function boxHitT(x0, y0, z0, x1, y1, z1, minX, minY, minZ, maxX, maxY, maxZ) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    let tmin = 0;
    let tmax = 1;
    const slab = (p, d, min, max) => {
        if (Math.abs(d) < 1e-8) return p >= min && p <= max;
        let a = (min - p) / d;
        let b = (max - p) / d;
        if (a > b) {
            const swap = a;
            a = b;
            b = swap;
        }
        if (a > tmin) tmin = a;
        if (b < tmax) tmax = b;
        return tmax >= tmin;
    };
    if (!slab(x0, dx, minX, maxX) || !slab(y0, dy, minY, maxY) || !slab(z0, dz, minZ, maxZ)) return null;
    if (tmax < 0 || tmin > 1) return null;
    return tmin < 0 ? 0 : tmin;
}

function missesFlat(x0, z0, x1, z1, minX, minZ, maxX, maxZ) {
    return Math.max(x0, x1) < minX || Math.min(x0, x1) > maxX || Math.max(z0, z1) < minZ || Math.min(z0, z1) > maxZ;
}

function shotStop(x0, y0, z0, x1, y1, z1) {
    let best = wallStopT(x0, y0, z0, x1, y1, z1);
    const offer = (t) => {
        if (t == null || t <= 0.02 || t > 1) return;
        if (best == null || t < best) best = t;
    };
    for (const b of houses) {
        if (!b.parts || !b.parts.length) continue;
        if (missesFlat(x0, z0, x1, z1, b.x - 0.5, b.z - 0.5, b.x + b.w + 0.5, b.z + b.d + 0.5)) continue;
        for (const part of b.parts) {
            if ((part.y1 || 0) - (part.y0 || 0) < 0.45) continue;
            offer(boxHitT(
                x0, y0, z0, x1, y1, z1,
                part.x, part.y0, part.z,
                part.x + part.w, part.y1, part.z + part.d
            ));
        }
    }
    const dist = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const steps = Math.max(1, Math.ceil(dist / 0.16));
    for (const b of Town.buildings) {
        if (missesFlat(x0, z0, x1, z1, b.minX - 0.8, b.minZ - 0.8, b.minX + b.w + 0.8, b.minZ + b.d + 0.8)) continue;
        for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const y = y0 + (y1 - y0) * t;
            if (y > 4.6) continue;
            const x = x0 + (x1 - x0) * t;
            const z = z0 + (z1 - z0) * t;
            if (hitsShell(b, x, z, 0.08) || (b.entry && hitsDoor(b.entry, x, z, 0.05))) {
                offer(t);
                break;
            }
        }
    }
    return best;
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
        const blockedAt = shotStop(x0, y0, z0, arrow.x, arrow.y, arrow.z);
        if (blockedAt != null) {
            arrow.x = x0 + (arrow.x - x0) * blockedAt;
            arrow.y = y0 + (arrow.y - y0) * blockedAt;
            arrow.z = z0 + (arrow.z - z0) * blockedAt;
        }
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
                if (wound(man, "Shot", !arrow.fromPlayer, arrow.vx / speed * 0.2, arrow.vz / speed * 0.2) && arrow.fromPlayer) notePractice("bow");
                hit = true;
                break;
            }
            if (!hit) {
                const lodge = cartUnder(arrow.x, arrow.z, arrow.faction);
                if (lodge) {
                    const pose = clientCartPose(lodge.cart);
                    if (sweptNear(x0, y0, z0, arrow.x, arrow.y, arrow.z, pose.x, 0.7, pose.z, 1.15, 0.8) && strikeCart(lodge)) {
                        if (arrow.fromPlayer) notePractice("bow");
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
            if (gate && strikeGate(gate)) {
                if (arrow.fromPlayer) notePractice("bow");
                hit = true;
            }
        }
        if (!hit && blockedAt != null) hit = true;
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
    if (man.farmer) return stepFarmer(man, dt);
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
        const close = man.dying || man.fisher || man.farmer || man.driver || (man.mode === "march" && man.path) || nearPerson(man, 500);
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
    const body = activeCam();
    const cp = Math.cos(body.pitch);
    const sp = Math.sin(body.pitch);
    const sy = Math.sin(body.yaw);
    const cy = Math.cos(body.yaw);
    const fx = sy * cp;
    const fy = sp;
    const fz = -cy * cp;
    const shake = player.shake > 0 ? Math.sin(player.shake * 70) * 0.07 : 0;
    const eye = [body.x + shake, body.y + shake * 0.4, body.z];
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
    if (!flying && owner === homeVillage && !onTower(cam.x, cam.z) && floorAt(cam.x, cam.z) < 2 && Math.hypot(cam.x - spot.x, cam.z - spot.z) < 7.5) return 1;
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
    if (!row || row[gate.side] <= 0) return false;
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
    return true;
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
    if (inside) {
        const feet = inside.view.y - 1.62;
        let height = 0;
        for (const floor of inside.floors) {
            if (x <= floor.x || x >= floor.x + floor.w || z <= floor.z || z >= floor.z + floor.d) continue;
            if (floor.y <= feet + 0.52 && floor.y >= feet - 0.85) height = Math.max(height, floor.y);
        }
        return height;
    }
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
    if (inside) {
        const r = 0.34;
        const stand = feet == null ? inside.view.y - 1.62 : feet;
        const body = stand + 1.6;
        for (const solid of inside.solids) {
            if (body <= solid.y0 + 0.02 || stand >= solid.y1 - 0.02) continue;
            if (x > solid.x - r && x < solid.x + solid.w + r && z > solid.z - r && z < solid.z + solid.d + r) return true;
        }
        if (x < 0.35 || z < 0.4 || x > inside.w - 0.35 || z > inside.d - 0.35) return true;
        return false;
    }
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
    for (const b of Town.buildings) {
        if (hitsShell(b, x, z, r)) return true;
    }
    for (const door of doors) {
        if (hitsDoor(door, x, z, r)) return true;
    }
    for (const item of scenery) {
        if (x > item.x - r && x < item.x + item.w + r && z > item.z - r && z < item.z + item.d + r) return true;
    }
    if (World.tooSteep(x, z)) return true;
    if (World.wet(x, z)) return true;
    if (hitsSolid(x, z, stand)) return true;
    return wallBlocks(x, z, who);
}

let lookId = null;
let moveId = null;
const stick = { x: 0, y: 0 };

let flyLift = 0;
let hop = 0;
let jumpHeld = false;
let fastOn = false;
let spotSaved = null;

function facingName(yaw) {
    const names = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"];
    const deg = ((yaw * 180 / Math.PI) % 360 + 360) % 360;
    return names[Math.round(deg / 45) % 8];
}

function paintCompass() {
    const compass = document.getElementById("compass");
    if (!compass) return;
    const body = activeCam();
    const name = facingName(body.yaw);
    compass.textContent = fastOn ? name + " · Fast" : name;
    compass.classList.toggle("fast", fastOn);
}

function saveSpot() {
    try {
        localStorage.setItem("village-spot", JSON.stringify({ x: cam.x, z: cam.z }));
    } catch (err) { /* the map still shows the last place that was saved */ }
}

function toggleFast() {
    fastOn = !fastOn;
    const button = document.getElementById("fly-fast");
    if (button) button.setAttribute("aria-pressed", fastOn ? "true" : "false");
    paintCompass();
    if (helpLine && flying) paintArm();
}

function flyPlayer(dt) {
    const sy = Math.sin(cam.yaw);
    const cy = Math.cos(cam.yaw);
    const sp = Math.sin(cam.pitch);
    const cp = Math.cos(cam.pitch);
    let mx = 0;
    let my = 0;
    let mz = 0;
    const forward = keys.KeyW || keys.ArrowUp;
    const back = keys.KeyS || keys.ArrowDown;
    const left = keys.KeyA;
    const right = keys.KeyD;
    if (forward) { mx += sy * cp; my += sp; mz -= cy * cp; }
    if (back) { mx -= sy * cp; my -= sp; mz += cy * cp; }
    if (right) { mx += cy; mz += sy; }
    if (left) { mx -= cy; mz -= sy; }
    const stickMag = Math.hypot(stick.x, stick.y);
    if (stickMag > 0.18) {
        mx += -stick.y * sy + stick.x * cy;
        mz += stick.y * cy + stick.x * sy;
    }
    if (keys.Space || flyLift > 0) my += 1;
    if (keys.ShiftLeft || keys.ShiftRight || flyLift < 0) my -= 1;
    const len = Math.hypot(mx, my, mz);
    if (!len) return;
    const fast = fastOn;
    const power = stickMag > 0.18 && !forward && !back && !left && !right
        ? Math.min(1, (stickMag - 0.18) / 0.82)
        : 1;
    const dist = (fast ? 140 : 48) * dt * power;
    cam.x += mx / len * dist;
    cam.y = Math.max(-40, Math.min(1200, cam.y + my / len * dist));
    cam.z += mz / len * dist;
}

function groundUnder(x, z, feet) {
    if (!inside) return floorAt(x, z);
    let height = 0;
    let found = false;
    for (const floor of inside.floors) {
        if (x <= floor.x || x >= floor.x + floor.w || z <= floor.z || z >= floor.z + floor.d) continue;
        if (floor.y > feet + 0.3) continue;
        height = Math.max(height, floor.y);
        found = true;
    }
    return found ? height : floorAt(x, z);
}

function movePlayer(dt) {
    const body = activeCam();
    if (player.dead && !flying) return;
    if (keys.ArrowLeft) body.yaw -= 1.7 * dt;
    if (keys.ArrowRight) body.yaw += 1.7 * dt;
    if (flying) {
        hop = 0;
        flyPlayer(dt);
        return;
    }
    const sy = Math.sin(body.yaw);
    const cy = Math.cos(body.yaw);
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
    const feet = body.y - 1.62;
    if (len) {
        const power = stickMag > 0.18 && !forward && !back && !left && !right
            ? Math.min(1, (stickMag - 0.18) / 0.82)
            : 1;
        const dist = Hero.walkSpeed(hero) * dt * power * (fastOn ? 2.4 : 1);
        mx = mx / len * dist;
        mz = mz / len * dist;
        const stepUp = (nx, nz) => {
            const next = floorAt(nx, nz);
            if (next > feet + 0.52) return false;
            if (next < feet - 0.52 && World.tooSteep(nx, nz)) return false;
            return true;
        };
        if (!blocked(body.x + mx, body.z, null, feet) && stepUp(body.x + mx, body.z)) body.x += mx;
        if (!blocked(body.x, body.z + mz, null, feet) && stepUp(body.x, body.z + mz)) body.z += mz;
    }
    const ground = groundUnder(body.x, body.z, feet);
    const grounded = hop <= 0 && feet <= ground + 0.12;
    if (grounded && (keys.Space || jumpHeld)) hop = 6.4;
    if (hop > 0 || feet > ground + 0.12) {
        hop -= 18 * dt;
        let nextY = body.y + hop * dt;
        const land = groundUnder(body.x, body.z, nextY - 1.62);
        if (hop <= 0 && nextY <= 1.62 + land) {
            nextY = 1.62 + land;
            hop = 0;
        }
        body.y = nextY;
    } else {
        body.y = 1.62 + ground;
        hop = 0;
    }
}

function draw() {
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(skyProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuffer);
    gl.enableVertexAttribArray(skyLoc.pos);
    gl.vertexAttribPointer(skyLoc.pos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(skyLoc.res, canvas.width, canvas.height);
    const view = activeCam();
    gl.uniform1f(skyLoc.pitch, view.pitch);
    gl.uniform1f(skyLoc.yaw, view.yaw);
    gl.uniform2f(skyLoc.eye, view.x, view.z);
    const dark = inside ? 0.28 : Clock.darkness(gameMs());
    const sun = sunScreen();
    gl.uniform1f(skyLoc.dark, dark);
    gl.uniform2f(skyLoc.sun, sun.x, sun.y);
    gl.uniform1f(skyLoc.sunUp, sun.up);
    gl.uniform1f(skyLoc.ready, skyReady);
    gl.uniform1f(skyLoc.spin, skySpin());
    if (skyReady && skyTex.day) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, skyTex.day);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, skyTex.morning);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, skyTex.night);
        gl.uniform1i(skyLoc.day, 1);
        gl.uniform1i(skyLoc.morning, 2);
        gl.uniform1i(skyLoc.night, 3);
        gl.activeTexture(gl.TEXTURE0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.useProgram(program);
    gl.uniformMatrix4fv(loc.view, false, lookAt());
    gl.uniformMatrix4fv(loc.model, false, identity);
    gl.uniform2f(loc.eye, view.x, view.z);
    gl.uniform1f(loc.time, performance.now() * 0.001);
    gl.uniform1f(loc.flow, 0);
    if (inside) {
        const rooms = ["roomplaster", "roomwood", "roomrock", "roomfurniture", "roompropmetal", "roompropcloth", "roomproppack"];
        const texOf = { roomplaster: "plaster", roomwood: "wood", roomrock: "rock", roomfurniture: "furniture", roompropmetal: "propmetal", roompropcloth: "propcloth", roomproppack: "proppack" };
        gl.uniform1f(loc.dark, 0.32);
        gl.uniform1f(loc.glow, 1);
        gl.uniform1f(loc.band, 0);
        gl.uniformMatrix4fv(loc.proj, false, proj);
        const stride = 24;
        for (const name of rooms) {
            if (!mesh[name] || !mesh[name].count || !textures[texOf[name]]) continue;
            gl.disable(gl.CULL_FACE);
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh[name].buffer);
            gl.enableVertexAttribArray(loc.pos);
            gl.enableVertexAttribArray(loc.uv);
            gl.enableVertexAttribArray(loc.shade);
            gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
            gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 12);
            gl.vertexAttribPointer(loc.shade, 1, gl.FLOAT, false, stride, 20);
            gl.bindTexture(gl.TEXTURE_2D, textures[texOf[name]]);
            gl.drawArrays(gl.TRIANGLES, 0, mesh[name].count);
        }
        gl.uniform1f(loc.glow, 0);
        return;
    }
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
        gl.uniform1f(loc.flow, name === "water" ? 1 : 0);
        gl.uniformMatrix4fv(loc.proj, false, farPass ? horizonProj : proj);
        gl.drawArrays(gl.TRIANGLES, 0, mesh[name].count);
    };
    for (const name of ["horizon", "horizonRock"]) drawMesh(name, 2, true);
    for (const name of ["horizonLeaf", "horizonWall", "horizonRoof"]) drawMesh(name, 3, true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    for (const name of Object.keys(mesh)) {
        if (name.indexOf("horizon") === 0 || name.indexOf("far") === 0 || name.indexOf("near") === 0 || name.indexOf("room") === 0) continue;
        drawMesh(name, 1, false);
    }
    drawMesh("farTrunk", 0.6, false);
    drawMesh("farLeaf", 0.6, false);
    drawMesh("nearTrunk", 1, false);
    drawMesh("nearLeaf", 1, false);
    gl.uniform1f(loc.band, 1);
    gl.uniform1f(loc.flow, 0);
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

let townKit = null;
function loadTown() {
    fetch("models/town.json", { cache: "no-store" }).then((res) => res.json()).then((data) => {
        townKit = data;
        const buckets = {};
        const light = [0.25, 0.86, 0.28];
        const lightLen = Math.hypot(light[0], light[1], light[2]);
        for (const b of Town.buildings) {
            const src = data.buildings[b.mesh];
            const groups = src && (src.groups || src);
            if (!groups) continue;
            const c = Math.cos(b.yaw);
            const s = Math.sin(b.yaw);
            for (const name of Object.keys(groups)) {
                const verts = groups[name];
                if (!buckets[name]) buckets[name] = [];
                const list = buckets[name];
                for (let i = 0; i < verts.length; i += 8) {
                    const x = verts[i];
                    const y = verts[i + 1];
                    const z = verts[i + 2];
                    const nx = verts[i + 5] * c + verts[i + 7] * s;
                    const ny = verts[i + 6];
                    const nz = -verts[i + 5] * s + verts[i + 7] * c;
                    const lit = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / lightLen);
                    list.push(x * c + z * s + b.x, y + (b.y || 0), -x * s + z * c + b.z, verts[i + 3], verts[i + 4], Math.min(1, 0.42 + 0.58 * lit));
                }
            }
        }
        for (const name of Object.keys(buckets)) {
            const floats = new Float32Array(buckets[name]);
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
                textures["town" + name] = tex;
                textures["raise" + name] = tex;
                const buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, floats, gl.STATIC_DRAW);
                mesh["town" + name] = { buffer, count: floats.length / 6, cull: false };
            };
            img.src = "models/" + name + ".png";
        }
        stampRaisedPlots();
    }).catch(() => {});
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
function skySpin() {
    const h = Clock.hours(gameMs());
    const t = (h - 5) / 18;
    let x = 0;
    let z = 1;
    if (t > 0 && t < 1) {
        x = Math.cos(t * Math.PI);
        z = 0.2 * Math.sin(t * Math.PI);
    }
    const sunU = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
    return 0.912 - sunU;
}

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
    const skyCam = activeCam();
    const cp = Math.cos(skyCam.pitch);
    const sp = Math.sin(skyCam.pitch);
    const sy = Math.sin(skyCam.yaw);
    const cy = Math.cos(skyCam.yaw);
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

const doors = [];
function interiorKind(mesh, role) {
    if (role === "farmhouse" || role === "barn" || role === "shed") return "house";
    if (mesh === "shop" || mesh === "brick") return "shop";
    if (mesh === "long") return "tavern";
    return "house";
}

function doorLeaf(door) {
    const acrossX = door.fz;
    const acrossZ = -door.fx;
    const hw = 0.56;
    const angle = (door.swing || 0) * 1.7;
    const dirX = acrossX * Math.cos(angle) - door.fx * Math.sin(angle);
    const dirZ = acrossZ * Math.cos(angle) - door.fz * Math.sin(angle);
    const x0 = door.x - acrossX * hw;
    const z0 = door.z - acrossZ * hw;
    return { x0: x0, z0: z0, x1: x0 + dirX * hw * 2, z1: z0 + dirZ * hw * 2, dirX: dirX, dirZ: dirZ };
}

function hitsShell(b, x, z, r) {
    const minX = b.minX;
    const maxX = b.minX + b.w;
    const minZ = b.minZ;
    const maxZ = b.minZ + b.d;
    if (x < minX - r || x > maxX + r || z < minZ - r || z > maxZ + r) return false;
    const door = b.entry;
    if (door) {
        const out = (x - door.x) * door.fx + (z - door.z) * door.fz;
        const lat = (x - door.x) * door.fz - (z - door.z) * door.fx;
        if (Math.abs(lat) < 0.74 && out > -0.85 && out < 0.8) return false;
    }
    const t = 0.34;
    if (z > minZ - r && z < minZ + t + r) return true;
    if (z < maxZ + r && z > maxZ - t - r) return true;
    if (x > minX - r && x < minX + t + r) return true;
    if (x < maxX + r && x > maxX - t - r) return true;
    return false;
}

function hitsDoor(door, x, z, r) {
    if ((door.swing || 0) > 0.9) return false;
    const leaf = doorLeaf(door);
    const dx = leaf.x1 - leaf.x0;
    const dz = leaf.z1 - leaf.z0;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((x - leaf.x0) * dx + (z - leaf.z0) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (leaf.x0 + dx * t), z - (leaf.z0 + dz * t)) < 0.16 + r * 0.45;
}

(function () {
    const counts = {};
    const floorGeom = [];
    for (const b of Town.buildings) {
        const kind = interiorKind(b.mesh, b.role);
        const key = b.village + ":" + (b.role || b.mesh);
        counts[key] = (counts[key] || 0) + 1;
        const s = Math.sin(b.yaw);
        const c = Math.cos(b.yaw);
        const fx = -s;
        const fz = -c;
        const half = (Math.abs(fx) > Math.abs(fz) ? b.w : b.d) * 0.5;
        const side = b.doorSide == null ? 1 : b.doorSide;
        const x = b.x + fx * (half - 0.06) - c * side;
        const z = b.z + fz * (half - 0.06) + s * side;
        const gy = b.y || 0;
        const door = { id: key + ":" + counts[key], kind, role: b.role || "", x, z, y: gy, fx, fz, yaw: b.yaw, half, swing: 0, want: false };
        b.entry = door;
        doors.push(door);
        const inset = 0.55;
        const floorY = gy + 0.045;
        floors.push({ x: b.minX + inset, z: b.minZ + inset, w: Math.max(0.4, b.w - inset * 2), d: Math.max(0.4, b.d - inset * 2), y: floorY });
        addBox(floorGeom, b.minX + inset, floorY - 0.04, b.minZ + inset, Math.max(0.4, b.w - inset * 2), 0.06, Math.max(0.4, b.d - inset * 2));
    }
    textures.housedoor = textures.wood;
    textures.housefloor = textures.wood;
    poseDoors();
    uploadMesh("housefloor", floorGeom);
})();

function addSwungDoor(geom, door) {
    const leaf = doorLeaf(door);
    const px = -leaf.dirZ * 0.04;
    const pz = leaf.dirX * 0.04;
    const y0 = (door.y || 0) + 0.02;
    const y1 = y0 + 2.16;
    const a = [leaf.x0 + px, y0, leaf.z0 + pz];
    const b = [leaf.x0 - px, y0, leaf.z0 - pz];
    const c = [leaf.x1 - px, y0, leaf.z1 - pz];
    const d = [leaf.x1 + px, y0, leaf.z1 + pz];
    const a2 = [a[0], y1, a[2]];
    const b2 = [b[0], y1, b[2]];
    const c2 = [c[0], y1, c[2]];
    const d2 = [d[0], y1, d[2]];
    const face = (p, q, r, s, u0, v0, u1, v1, shade) => {
        pushQuad(geom,
            [p[0], p[1], p[2], u0, v0, shade],
            [q[0], q[1], q[2], u0, v1, shade],
            [r[0], r[1], r[2], u1, v1, shade],
            [s[0], s[1], s[2], u1, v0, shade]
        );
    };
    face(a, a2, d2, d, 0, 0, 1, 1, 0.92);
    face(b, c, c2, b2, 0, 0, 1, 1, 0.78);
    face(a, b, b2, a2, 0, 0, 0.15, 1, 0.7);
    face(d, d2, c2, c, 0, 0, 0.15, 1, 0.7);
    face(a2, b2, c2, d2, 0, 0, 1, 0.12, 1);
    face(a, d, c, b, 0, 0, 1, 0.12, 0.6);
}

function poseDoors() {
    const geom = [];
    for (const door of doors) addSwungDoor(geom, door);
    uploadMesh("housedoor", geom);
    if (mesh.housedoor) mesh.housedoor.cull = false;
}

let raisedData = null;
let raisedKey = "";

function houseGroups() {
    const src = townKit && townKit.buildings && townKit.buildings.house;
    if (!src) return null;
    return src.groups || src;
}

function raisePlots(data) {
    raisedData = data || null;
    stampRaisedPlots();
}

function clearRaised() {
    for (let i = Town.buildings.length - 1; i >= 0; i--) {
        if (Town.buildings[i].raised) Town.buildings.splice(i, 1);
    }
    for (let i = doors.length - 1; i >= 0; i--) {
        if (doors[i].raised) doors.splice(i, 1);
    }
    for (let i = floors.length - 1; i >= 0; i--) {
        if (floors[i].raised) floors.splice(i, 1);
    }
    for (let i = scenery.length - 1; i >= 0; i--) {
        if (scenery[i].raised) scenery.splice(i, 1);
    }
    textures.raisedfield = textures.dirt;
    textures.raisedleaf = textures.leaf;
    textures.raisedtrunk = textures.trunk;
    textures.raisedfloor = textures.wood;
    for (const name of ["raisedfield", "raisedleaf", "raisedtrunk", "raisedfloor"]) uploadMesh(name, []);
    const groups = houseGroups();
    if (groups) {
        for (const name of Object.keys(groups)) {
            if (textures["town" + name]) textures["raise" + name] = textures["town" + name];
            uploadMesh("raise" + name, []);
            if (mesh["raise" + name]) mesh["raise" + name].cull = false;
        }
    }
}

function stampHouse(buckets, b) {
    const groups = houseGroups();
    if (!groups) return;
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    const light = [0.25, 0.86, 0.28];
    const lightLen = Math.hypot(light[0], light[1], light[2]);
    for (const name of Object.keys(groups)) {
        const verts = groups[name];
        if (!verts || !verts.length) continue;
        if (!buckets[name]) buckets[name] = [];
        const list = buckets[name];
        for (let i = 0; i < verts.length; i += 8) {
            const x = verts[i];
            const y = verts[i + 1];
            const z = verts[i + 2];
            const nx = verts[i + 5] * c + verts[i + 7] * s;
            const ny = verts[i + 6];
            const nz = -verts[i + 5] * s + verts[i + 7] * c;
            const lit = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / lightLen);
            list.push(x * c + z * s + b.x, y + (b.y || 0), -x * s + z * c + b.z, verts[i + 3], verts[i + 4], Math.min(1, 0.42 + 0.58 * lit));
        }
    }
}

function addRaisedDoor(b, id, floorsGeom) {
    const s = Math.sin(b.yaw);
    const c = Math.cos(b.yaw);
    const fx = -s;
    const fz = -c;
    const half = (Math.abs(fx) > Math.abs(fz) ? b.w : b.d) * 0.5;
    const side = b.doorSide == null ? 1 : b.doorSide;
    const x = b.x + fx * (half - 0.06) - c * side;
    const z = b.z + fz * (half - 0.06) + s * side;
    const door = {
        id: b.village + ":farmhouse:" + id,
        kind: "house",
        role: "farmhouse",
        x: x,
        z: z,
        y: b.y || 0,
        fx: fx,
        fz: fz,
        yaw: b.yaw,
        half: half,
        swing: 0,
        want: false,
        raised: true
    };
    b.entry = door;
    b.raised = true;
    doors.push(door);
    const inset = 0.55;
    const floorY = (b.y || 0) + 0.045;
    const fw = Math.max(0.4, b.w - inset * 2);
    const fd = Math.max(0.4, b.d - inset * 2);
    floors.push({ x: b.minX + inset, z: b.minZ + inset, w: fw, d: fd, y: floorY, raised: true });
    addBox(floorsGeom, b.minX + inset, floorY - 0.04, b.minZ + inset, fw, 0.06, fd);
}

function stampRaisedPlots() {
    if (!townKit || !raisedData) return;
    const plots = raisedData.plots || [];
    const raising = raisedData.raising || [];
    const key = (raisedData.restartedAt || 0) + "|" + plots.map((plot) => plot.id).join(",") + "|" + raising.map((job) => job.id).join(",");
    if (key === raisedKey) return;
    raisedKey = key;
    clearRaised();
    const field = [];
    const leaf = [];
    const trunk = [];
    const floorGeom = [];
    const buckets = {};
    const cell = (list, x, z, w, d) => {
        const y00 = Math.max(0, World.heightAt(x, z)) + 0.07;
        const y10 = Math.max(0, World.heightAt(x + w, z)) + 0.07;
        const y11 = Math.max(0, World.heightAt(x + w, z + d)) + 0.07;
        const y01 = Math.max(0, World.heightAt(x, z + d)) + 0.07;
        pushQuad(
            list,
            [x, y00, z, x / 4, z / 4, 0.9],
            [x, y01, z + d, x / 4, (z + d) / 4, 0.9],
            [x + w, y11, z + d, (x + w) / 4, (z + d) / 4, 0.9],
            [x + w, y10, z, (x + w) / 4, z / 4, 0.9]
        );
    };
    for (const plot of plots) {
        const house = plot.house;
        if (!house) continue;
        house.village = plot.village;
        house.mesh = "house";
        house.role = "farmhouse";
        house.raised = true;
        Town.buildings.push(house);
        stampHouse(buckets, house);
        addRaisedDoor(house, plot.id, floorGeom);
        const f = plot.field;
        if (f) {
            for (let z = f.z; z < f.z + f.d - 0.1; z += 2) {
                for (let x = f.x; x < f.x + f.w - 0.1; x += 2) {
                    cell(field, x, z, Math.min(2, f.x + f.w - x), Math.min(2, f.z + f.d - z));
                }
            }
            for (let row = f.z + 2; row < f.z + f.d - 1; row += 3) {
                const y = Math.max(0, World.heightAt(f.x + f.w / 2, row));
                addBox(leaf, f.x + 1.2, y, row, Math.max(2, f.w - 2.4), 0.28, 0.45);
            }
        }
        if (plot.hay) {
            const hx = plot.hay[0];
            const hz = plot.hay[1];
            const y = Math.max(0, World.heightAt(hx, hz));
            addBox(field, hx, y, hz, 1.5, 0.7, 1.15);
            addBox(field, hx + 0.25, y + 0.7, hz + 0.18, 1, 0.45, 0.75);
            scenery.push({ x: hx, z: hz, w: 1.5, d: 1.15, raised: true });
        }
    }
    for (const job of raising) {
        const y = Math.max(0, job.y || World.heightAt(job.x, job.z));
        const posts = [[-1.7, -1.7], [1.5, -1.7], [-1.7, 1.5], [1.5, 1.5]];
        for (const post of posts) {
            addBox(trunk, job.x + post[0], y, job.z + post[1], 0.18, 1.45, 0.18);
            scenery.push({ x: job.x + post[0], z: job.z + post[1], w: 0.18, d: 0.18, raised: true });
        }
        addBox(trunk, job.x - 1.7, y + 1.35, job.z - 1.7, 3.4, 0.14, 0.16);
        addBox(trunk, job.x - 1.7, y + 1.35, job.z + 1.5, 3.4, 0.14, 0.16);
    }
    uploadMesh("raisedfield", field);
    uploadMesh("raisedleaf", leaf);
    uploadMesh("raisedtrunk", trunk);
    uploadMesh("raisedfloor", floorGeom);
    if (mesh.raisedfield) mesh.raisedfield.cull = false;
    if (mesh.raisedleaf) mesh.raisedleaf.cull = false;
    for (const name of Object.keys(buckets)) {
        uploadMesh("raise" + name, buckets[name]);
        if (mesh["raise" + name]) mesh["raise" + name].cull = false;
        if (textures["town" + name]) textures["raise" + name] = textures["town" + name];
    }
    poseDoors();
}

function swingDoors(dt) {
    let moving = false;
    for (const door of doors) {
        const target = door.want ? 1 : 0;
        if (Math.abs(door.swing - target) < 0.001) {
            door.swing = target;
            continue;
        }
        const step = Math.min(Math.abs(target - door.swing), dt * 1.6);
        door.swing += Math.sign(target - door.swing) * step;
        moving = true;
    }
    if (moving) poseDoors();
}

function aimedDoor() {
    if (inside || flying || player.dead) return null;
    const body = activeCam();
    const sy = Math.sin(body.yaw);
    const cy = Math.cos(body.yaw);
    const cp = Math.cos(body.pitch);
    const fx = sy * cp;
    const fy = Math.sin(body.pitch);
    const fz = -cy * cp;
    let best = null;
    let bestT = 3.4;
    for (const door of doors) {
        const denom = fx * door.fx + fz * door.fz;
        if (Math.abs(denom) < 0.25) continue;
        const t = ((door.x - body.x) * door.fx + (door.z - body.z) * door.fz) / denom;
        if (t < 0.2 || t > bestT) continue;
        const hx = body.x + fx * t;
        const hy = body.y + fy * t;
        const hz = body.z + fz * t;
        const lat = (hx - door.x) * door.fz - (hz - door.z) * door.fx;
        const base = door.y || 0;
        if (Math.abs(lat) > 0.62 || hy < base + 0.15 || hy > base + 2.2) continue;
        best = door;
        bestT = t;
    }
    return best;
}

let propData = null;
function loadPropTextures() {
    for (const name of ["furniture", "propmetal", "propcloth", "proppack"]) {
        const img = new Image();
        img.onload = () => {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            textures[name] = tex;
            textures["farm" + name] = tex;
            if (inside && !inside.furnished) furnishInterior();
        };
        img.src = "models/" + name + ".png";
    }
}
fetch("models/props.json", { cache: "no-store" }).then((res) => res.json()).then((data) => {
    propData = data;
    loadPropTextures();
    stampFarmProps();
    if (inside && !inside.furnished) furnishInterior();
}).catch(() => {});

function turnProp(x, y, z, yaw) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return [x * c + z * s, y, -x * s + z * c];
}

function propSolid(bounds, x, y, z, yaw) {
    let minX = 1e9;
    let minY = 1e9;
    let minZ = 1e9;
    let maxX = -1e9;
    let maxY = -1e9;
    let maxZ = -1e9;
    for (const px of [bounds.min[0], bounds.max[0]]) {
        for (const py of [bounds.min[1], bounds.max[1]]) {
            for (const pz of [bounds.min[2], bounds.max[2]]) {
                const p = turnProp(px, py, pz, yaw);
                const wx = p[0] + x;
                const wy = p[1] + y;
                const wz = p[2] + z;
                minX = Math.min(minX, wx);
                minY = Math.min(minY, wy);
                minZ = Math.min(minZ, wz);
                maxX = Math.max(maxX, wx);
                maxY = Math.max(maxY, wy);
                maxZ = Math.max(maxZ, wz);
            }
        }
    }
    return { x: minX, z: minZ, w: maxX - minX, d: maxZ - minZ, y0: minY, y1: maxY };
}

function stampFarmProps() {
    if (!propData || !Town.farms) return;
    const buckets = {};
    const light = [0.25, 0.86, 0.28];
    const lightLen = Math.hypot(light[0], light[1], light[2]);
    for (const farm of Town.farms) {
        for (const item of farm.props || []) {
            const src = propData.props[item.name];
            const bounds = propData.bounds[item.name];
            if (!src || !bounds) continue;
            const y = Math.max(0, World.heightAt(item.x, item.z));
            const box = propSolid(bounds, item.x, y, item.z, item.yaw || 0);
            scenery.push({ x: box.x, z: box.z, w: box.w, d: box.d });
            const c = Math.cos(item.yaw || 0);
            const s = Math.sin(item.yaw || 0);
            for (const name of Object.keys(src)) {
                const verts = src[name];
                if (!buckets[name]) buckets[name] = [];
                const list = buckets[name];
                for (let i = 0; i < verts.length; i += 8) {
                    const px = verts[i];
                    const py = verts[i + 1];
                    const pz = verts[i + 2];
                    const nx = verts[i + 5] * c + verts[i + 7] * s;
                    const ny = verts[i + 6];
                    const nz = -verts[i + 5] * s + verts[i + 7] * c;
                    const lit = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / lightLen);
                    list.push(px * c + pz * s + item.x, py + y, -px * s + pz * c + item.z, verts[i + 3], verts[i + 4], Math.min(1, 0.55 + 0.45 * lit));
                }
            }
        }
    }
    for (const name of Object.keys(buckets)) {
        uploadMesh("farm" + name, buckets[name]);
        mesh["farm" + name].cull = false;
        if (textures[name]) textures["farm" + name] = textures[name];
    }
}

function furnishInterior() {
    if (!inside || !propData) return;
    const plan = inside.plan;
    const buckets = {};
    const light = [0.25, 0.86, 0.28];
    const lightLen = Math.hypot(light[0], light[1], light[2]);
    for (const item of plan.props) {
        const src = propData.props[item.name];
        const bounds = propData.bounds[item.name];
        if (!src || !bounds) continue;
        if (item.block) inside.solids.push(propSolid(bounds, item.x, item.y, item.z, item.yaw));
        const c = Math.cos(item.yaw);
        const s = Math.sin(item.yaw);
        for (const name of Object.keys(src)) {
            const verts = src[name];
            if (!buckets[name]) buckets[name] = [];
            const list = buckets[name];
            for (let i = 0; i < verts.length; i += 8) {
                const x = verts[i];
                const y = verts[i + 1];
                const z = verts[i + 2];
                const nx = verts[i + 5] * c + verts[i + 7] * s;
                const ny = verts[i + 6];
                const nz = -verts[i + 5] * s + verts[i + 7] * c;
                const lit = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / lightLen);
                list.push(x * c + z * s + item.x, y + item.y, -x * s + z * c + item.z, verts[i + 3], verts[i + 4], Math.min(1, 0.62 + 0.38 * lit));
            }
        }
    }
    for (const name of Object.keys(buckets)) uploadMesh("room" + name, buckets[name]);
    inside.furnished = true;
}

function buildInterior(plan) {
    const groups = {};
    for (const box of plan.boxes) {
        if (!groups[box.tex]) groups[box.tex] = [];
        addBox(groups[box.tex], box.x, box.y, box.z, box.w, box.h, box.d);
    }
    inside.solids = plan.solids.slice();
    inside.floors = plan.floors;
    inside.w = plan.w;
    inside.d = plan.d;
    inside.exit = plan.exit;
    inside.plan = plan;
    inside.furnished = false;
    for (const tex of ["plaster", "wood", "rock"]) uploadMesh("room" + tex, groups[tex] || []);
    furnishInterior();
}

function nearestDoor() {
    if (flying || player.dead) return null;
    let best = null;
    let bestD = 2.6;
    for (const door of doors) {
        const dist = Math.hypot(cam.x - door.x, cam.z - door.z);
        if (dist < bestD) {
            best = door;
            bestD = dist;
        }
    }
    return best;
}

function atExit() {
    if (!inside) return false;
    const exit = inside.exit;
    return inside.view.y < 2.3 && Math.hypot(inside.view.x - exit.x, inside.view.z - exit.z) < exit.r;
}

function enterPortal(portal) {
    if (inside || !portal || flying || player.dead) return;
    const plan = Interior.layout(portal.kind, portal.id);
    if (!plan) return;
    inside = {
        id: portal.id,
        kind: portal.kind,
        view: { x: plan.spawn.x, y: plan.spawn.y, z: plan.spawn.z, yaw: plan.spawn.yaw, pitch: 0 },
        back: { x: cam.x, y: cam.y, z: cam.z, yaw: cam.yaw, pitch: cam.pitch }
    };
    buildInterior(plan);
}

function leaveInterior() {
    if (!inside) return;
    const back = inside.back;
    cam.x = back.x;
    cam.y = back.y;
    cam.z = back.z;
    cam.yaw = back.yaw;
    cam.pitch = back.pitch;
    inside = null;
}

function toggleDoor(door) {
    if (!door || flying || player.dead) return;
    if (door.want && hitsDoor({ swing: 0, fx: door.fx, fz: door.fz, x: door.x, z: door.z }, cam.x, cam.z, 0.35)) return;
    door.want = !door.want;
}

function useDoor() {
    if (inside) {
        if (atExit()) leaveInterior();
        return;
    }
    toggleDoor(aimedDoor() || nearestDoor());
}

function paintDoor() {
    const button = document.getElementById("enter");
    if (button) button.hidden = true;
    if (!helpLine || flying) return;
    const base = arm === "bow"
        ? "WASD to walk · Space to jump · mouse to look · click to shoot · Alt toggles fast · Pack to switch"
        : "WASD to walk · Space to jump · mouse to look · drag to swing · Alt toggles fast · Pack to switch";
    const door = inside ? null : (aimedDoor() || nearestDoor());
    helpLine.textContent = door ? base + (door.want ? " · right click to close" : " · right click to open") : base;
}

function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    accrue();
    tickHero(dt);
    const clock = document.getElementById("clock");
    if (clock) clock.textContent = Clock.label(gameMs());
    const where = document.getElementById("where");
    if (where) where.textContent = Math.round(cam.x) + ", " + Math.round(cam.z) + " · " + Math.round(cam.y);
    paintCompass();
    if (!spotSaved || Math.hypot(cam.x - spotSaved.x, cam.z - spotSaved.z) > 12) {
        spotSaved = { x: cam.x, z: cam.z };
        saveSpot();
    }
    movePlayer(dt);
    swingDoors(dt);
    refreshNearTrees();
    updateFight(dt);
    updatePalisade(dt);
    syncArrowMesh();
    paintDoor();
    draw();
    requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.key === "Alt" && !e.repeat) {
        toggleFast();
        e.preventDefault();
    }
    if (e.code === "KeyF" && !e.repeat) shootArrow();
    if (e.code === "KeyE" && !e.repeat) useDoor();
    if (e.code === "KeyP" && !e.repeat) {
        packPanel.hidden = !packPanel.hidden;
        e.preventDefault();
    }
    if (e.code === "KeyC" && !e.repeat) {
        toggleSheet();
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
    const body = activeCam();
    body.yaw += e.movementX * sens;
    body.pitch = Math.max(-1.05, Math.min(1.05, body.pitch - e.movementY * sens));
});

let dragging = false;
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
        if (inside) {
            if (atExit()) leaveInterior();
        } else {
            toggleDoor(aimedDoor() || nearestDoor());
        }
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
    weapon.hidden = flying || arm !== "sword";
    viewbow.hidden = flying || arm !== "bow";
    pad.hidden = !on;
    attack.hidden = flying || !on;
    const jumpBtn = document.getElementById("jump");
    if (jumpBtn) jumpBtn.hidden = flying || !on;
    attack.classList.toggle("arm-bow", arm === "bow");
    attack.setAttribute("aria-label", arm === "bow" ? "Shoot" : "Attack");
    bowButton.hidden = true;
    const flyPad = document.getElementById("fly-pad");
    if (flyPad) flyPad.hidden = !(flying && on);
    const land = document.getElementById("land");
    if (land) land.hidden = !flying;
    const where = document.getElementById("where");
    if (where) where.hidden = !flying;
    if (helpLine && flying) {
        helpLine.textContent = fastOn
            ? "WASD to fly · mouse to look · Space up · Shift down · Alt toggles fast · fast on"
            : "WASD to fly · mouse to look · Space up · Shift down · Alt toggles fast";
    } else if (helpLine) {
        helpLine.textContent = arm === "bow"
            ? "WASD to walk · Space to jump · mouse to look · click to shoot · Alt toggles fast · Pack to switch"
            : "WASD to walk · Space to jump · mouse to look · drag to swing · Alt toggles fast · Pack to switch";
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

function bindFly(button, dir) {
    if (!button) return;
    button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        flyLift = dir;
    });
    const stop = () => { if (flyLift === dir) flyLift = 0; };
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
}
bindFly(document.getElementById("fly-up"), 1);
bindFly(document.getElementById("fly-down"), -1);
const flyFast = document.getElementById("fly-fast");
if (flyFast) flyFast.addEventListener("click", toggleFast);
window.addEventListener("pagehide", saveSpot);

const jumpBtn = document.getElementById("jump");
if (jumpBtn) {
    jumpBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        jumpHeld = true;
        jumpBtn.classList.add("down");
    });
    const releaseJump = () => {
        jumpHeld = false;
        jumpBtn.classList.remove("down");
    };
    jumpBtn.addEventListener("pointerup", releaseJump);
    jumpBtn.addEventListener("pointercancel", releaseJump);
    jumpBtn.addEventListener("contextmenu", (e) => e.preventDefault());
}

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

const selfButton = document.getElementById("self");
selfPanel = document.getElementById("self-panel");
function toggleSheet() {
    if (!selfPanel) return;
    selfPanel.hidden = !selfPanel.hidden;
    if (!selfPanel.hidden) paintSheet();
}
if (selfButton) selfButton.addEventListener("click", toggleSheet);
const selfClose = document.getElementById("self-close");
if (selfClose) selfClose.addEventListener("click", () => {
    if (selfPanel) selfPanel.hidden = true;
});
packButton.addEventListener("click", () => {
    packPanel.hidden = !packPanel.hidden;
});
const enterButton = document.getElementById("enter");
if (enterButton) {
    enterButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        useDoor();
    });
}
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
        const look = activeCam();
        look.yaw += mx * 0.006;
        look.pitch = Math.max(-1.05, Math.min(1.05, look.pitch - my * 0.006));
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
    loadTown();
    loadPeople();
    requestAnimationFrame(frame);
}
