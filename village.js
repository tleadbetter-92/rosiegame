const canvas = document.getElementById("view");
const gl = canvas.getContext("webgl", { antialias: false, alpha: false });

if (!gl) {
    document.querySelector(".help").textContent = "This browser cannot show the village.";
}

const places = [
    { ox: -40, oz: -64 },
    { ox: 40, oz: -64 },
    { ox: -40, oz: 64 },
    { ox: 40, oz: 64 }
];
const cam = { x: places[2].ox, y: 1.62, z: places[2].oz + 14, yaw: 0, pitch: 0 };
const homeVillage = 2;
const townLeash = 30;
const player = { hp: 40, max: 40, guard: 0, dead: 0 };
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
for (const place of places) {
    for (const house of housePlan) {
        houses.push({
            x: house.x + place.ox,
            z: house.z + place.oz,
            w: house.w,
            d: house.d,
            h: house.h,
            rise: house.rise,
            door: house.door
        });
    }
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
        g.fillStyle = "#3a2a22";
        g.fillRect(0, 0, s, 14);
        g.fillStyle = "#1c2430";
        g.fillRect(16, 24, 10, 8);
        g.fillRect(38, 24, 10, 8);
        g.fillStyle = "#a86858";
        g.fillRect(26, 40, 12, 4);
    }),
    pants: makeTexture((g, s) => {
        g.fillStyle = "#4a3428";
        g.fillRect(0, 0, s, s);
        g.fillStyle = "rgba(0,0,0,0.22)";
        g.fillRect(30, 0, 4, s);
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

const batches = { grass: [], dirt: [], wall: [], door: [], roof: [] };

function isPath(x, z) {
    if (Math.abs(x + 40) < 2.3 && z >= -82 && z <= 82) return true;
    if (Math.abs(x - 40) < 2.3 && z >= -82 && z <= 82) return true;
    if (Math.abs(z + 40) < 2.3 && x >= -82 && x <= 82) return true;
    if (Math.abs(z - 40) < 2.3 && x >= -82 && x <= 82) return true;
    for (const place of places) {
        const lx = x - place.ox;
        const lz = z - place.oz;
        if (Math.abs(lz + 7.85) < 1.9 && Math.abs(lx) < 14) return true;
    }
    return false;
}

for (let x = -100; x < 100; x += 2) {
    for (let z = -100; z < 100; z += 2) {
        const list = isPath(x + 1, z + 1) ? batches.dirt : batches.grass;
        const u = x / 2;
        const v = z / 2;
        pushQuad(
            list,
            [x, 0, z, u, v, 1],
            [x, 0, z + 2, u, v + 1, 1],
            [x + 2, 0, z + 2, u + 1, v + 1, 1],
            [x + 2, 0, z, u + 1, v, 1]
        );
    }
}

function addHouse(b) {
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
        const list = side === door ? batches.door : batches.wall;
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

houses.forEach(addHouse);

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
varying vec2 vUv;
varying float vShade;
varying float vDepth;
void main() {
    vec4 view = uView * vec4(aPos, 1.0);
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
uniform sampler2D uTex;
void main() {
    vec3 color = texture2D(uTex, vUv).rgb * vShade;
    float fog = clamp((vDepth - 28.0) / 90.0, 0.0, 0.58);
    gl_FragColor = vec4(mix(color, vec3(0.73, 0.75, 0.68), fog), 1.0);
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
void main() {
    float horizon = 0.46 - uPitch * 0.42;
    float t = clamp((gl_FragCoord.y / uRes.y - horizon) / 0.62, 0.0, 1.0);
    vec3 haze = vec3(0.80, 0.75, 0.64);
    vec3 zenith = vec3(0.42, 0.58, 0.74);
    gl_FragColor = vec4(mix(haze, zenith, t), 1.0);
}
`));
gl.linkProgram(skyProgram);

const loc = {
    proj: gl.getUniformLocation(program, "uProj"),
    view: gl.getUniformLocation(program, "uView"),
    pos: gl.getAttribLocation(program, "aPos"),
    uv: gl.getAttribLocation(program, "aUv"),
    shade: gl.getAttribLocation(program, "aShade")
};
const skyLoc = {
    pos: gl.getAttribLocation(skyProgram, "aPos"),
    res: gl.getUniformLocation(skyProgram, "uRes"),
    pitch: gl.getUniformLocation(skyProgram, "uPitch")
};

const mesh = {};
for (const name of Object.keys(batches)) {
    const data = new Float32Array(batches[name]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    mesh[name] = { buffer, count: data.length / 6 };
}

function addBox(list, x, y, z, w, h, d, xf) {
    const y1 = y + h;
    const p = (px, py, pz, u, v, s) => {
        const t = xf ? xf(px, py, pz) : [px, py, pz];
        return [t[0], t[1], t[2], u, v, s];
    };
    pushQuad(list, p(x, y, z, 0, 0, 1), p(x, y1, z, 0, 1, 1), p(x + w, y1, z, 1, 1, 1), p(x + w, y, z, 1, 0, 1));
    pushQuad(list, p(x + w, y, z + d, 0, 0, 0.72), p(x + w, y1, z + d, 0, 1, 0.72), p(x, y1, z + d, 1, 1, 0.72), p(x, y, z + d, 1, 0, 0.72));
    pushQuad(list, p(x + w, y, z, 0, 0, 0.86), p(x + w, y1, z, 0, 1, 0.86), p(x + w, y1, z + d, 1, 1, 0.86), p(x + w, y, z + d, 1, 0, 0.86));
    pushQuad(list, p(x, y, z + d, 0, 0, 0.8), p(x, y1, z + d, 0, 1, 0.8), p(x, y1, z, 1, 1, 0.8), p(x, y, z, 1, 0, 0.8));
    pushQuad(list, p(x, y1, z, 0, 0, 0.95), p(x + w, y1, z, 1, 0, 0.95), p(x + w, y1, z + d, 1, 1, 0.95), p(x, y1, z + d, 0, 1, 0.95));
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

function addPerson(cloth, skin, pants, x, z, xf) {
    addBox(pants, x + 0.05, 0, z + 0.07, 0.15, 0.5, 0.16, xf);
    addBox(pants, x + 0.28, 0, z + 0.07, 0.15, 0.5, 0.16, xf);
    addBox(cloth, x + 0.02, 0.48, z + 0.03, 0.44, 0.46, 0.24, xf);
    addBox(cloth, x - 0.1, 0.52, z + 0.07, 0.12, 0.38, 0.14, xf);
    addBox(cloth, x + 0.46, 0.52, z + 0.07, 0.12, 0.38, 0.14, xf);
    addBox(skin, x + 0.1, 0.92, z + 0.05, 0.28, 0.28, 0.2, xf);
    addBox(pants, x + 0.08, 1.16, z + 0.03, 0.32, 0.08, 0.24, xf);
}

const men = [];
let actorsDirty = true;

function livingUnits(faction) {
    if (faction.units) return faction.units.filter((unit) => unit.health > 0).slice(0, 24);
    const list = [];
    for (let i = 0; i < Math.min(faction.soldiers || 0, 24); i++) list.push({ index: i, health: 3 });
    return list;
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
    return (px, py, pz) => {
        const lx = px - man.x;
        const lz = pz - man.z;
        return [
            man.x + lx * c + lz * s,
            py + man.bob - man.down,
            man.z - lx * s + lz * c
        ];
    };
}

function rebuildMesh() {
    const skin = [];
    const pants = [];
    const cloth = [[], [], [], []];
    for (const man of men) {
        addPerson(cloth[man.village], skin, pants, man.x - 0.24, man.z - 0.14, personXf(man));
    }
    for (let i = 0; i < 4; i++) uploadMesh("cloth" + i, cloth[i]);
    uploadMesh("skin", skin);
    uploadMesh("pants", pants);
    actorsDirty = false;
}

function mergeMen(factionList) {
    const wanted = [];
    factionList.forEach((faction) => {
        const place = places[faction.village];
        livingUnits(faction).forEach((unit, slot) => {
            const home = homeOf(place, slot);
            wanted.push({
                village: faction.village,
                index: unit.index,
                health: unit.health,
                homeX: home.x,
                homeZ: home.z
            });
        });
    });
    const prev = new Map(men.map((man) => [man.village + ":" + man.index, man]));
    const next = [];
    const keep = new Set();
    for (const item of wanted) {
        const key = item.village + ":" + item.index;
        const old = prev.get(key);
        keep.add(key);
        if (old) {
            old.health = pendingHit ? Math.min(old.health, item.health) : item.health;
            old.homeX = item.homeX;
            old.homeZ = item.homeZ;
            if (old.health > 0) next.push(old);
            else if (old.dying) next.push(old);
        } else {
            next.push({
                village: item.village,
                index: item.index,
                health: item.health,
                x: item.homeX,
                z: item.homeZ,
                homeX: item.homeX,
                homeZ: item.homeZ,
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
    for (const man of men) {
        const key = man.village + ":" + man.index;
        if (!keep.has(key) && man.dying) next.push(man);
    }
    men.length = 0;
    men.push(...next);
    actorsDirty = true;
}

let soldierKey = "";
let pendingHit = 0;
let campaign = null;

function applyCampaign(data) {
    campaign = data;
    const key = data.factions.map((faction) => (
        (faction.units || []).map((unit) => unit.index + ":" + unit.health).join(".")
    )).join("|");
    if (key === soldierKey) return;
    soldierKey = key;
    mergeMen(data.factions);
}

function syncCampaign() {
    if (pendingHit) return;
    fetch("/api/campaign").then((res) => res.json()).then(applyCampaign).catch(() => {});
}

let nextSwing = 0;
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
    cam.z = places[2].oz + 14;
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

function connectSwing() {
    if (!campaign || !swing) return;
    const profile = swings[swing.kind];
    const { fx, fy, fz, rx, rz } = aim();
    const ox = cam.x + rx * profile.side;
    const oz = cam.z + rz * profile.side;
    let best = null;
    let bestT = profile.reach;
    for (const man of men) {
        if (man.dying || man.health <= 0 || man.village === homeVillage) continue;
        const dx = man.x - ox;
        const dy = 0.95 - cam.y;
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
    if (!best) return;
    const faction = campaign.factions[best.village];
    const unit = faction && (faction.units || []).find((item) => item.index === best.index);
    if (!unit || unit.health <= 0) return;
    unit.health -= 1;
    best.health = unit.health;
    best.hostile = true;
    best.attackIn = Math.max(best.attackIn, 0.35);
    if (unit.health <= 0) {
        faction.alive = Math.max(0, (faction.alive || 0) - 1);
        best.dying = true;
        showStrike("Slain");
    } else {
        showStrike(swing.kind === "chop" ? "Chop" : swing.kind === "thrust" ? "Thrust" : "Slash");
    }
    const knock = 0.28;
    const nx = best.x + fx * knock;
    const nz = best.z + fz * knock;
    if (!blocked(nx, best.z)) best.x = nx;
    if (!blocked(best.x, nz)) best.z = nz;
    for (const other of men) {
        if (other.dying || other.village !== best.village) continue;
        const near = Math.hypot(other.x - best.x, other.z - best.z);
        if (near < 12) {
            other.hostile = true;
            if (other.attackIn <= 0) other.attackIn = 0.3 + Math.random() * 0.6;
        }
    }
    actorsDirty = true;
    soldierKey = "";
    pendingHit += 1;
    fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ village: best.village, index: best.index })
    }).then((res) => res.json()).then((data) => {
        pendingHit -= 1;
        if (pendingHit === 0) applyCampaign(data);
    }).catch(() => { pendingHit -= 1; });
}

function startSwing(kind) {
    if (player.dead || swing || !swings[kind]) return;
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

function stepMan(man, dt) {
    if (man.dying) {
        man.down += dt * 1.5;
        man.bob = 0;
        actorsDirty = true;
        return man.down > 1.2;
    }
    const dx = cam.x - man.x;
    const dz = cam.z - man.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const place = places[man.village];
    const outsideTown = (x, z) => Math.hypot(x - place.ox, z - place.oz) > townLeash;
    if (man.village === homeVillage) {
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
                if (!blocked(nx, man.z)) man.x = nx;
                if (!blocked(man.x, nz)) man.z = nz;
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
            if (!blocked(nx, man.z)) man.x = nx;
            if (!blocked(man.x, nz)) man.z = nz;
            moving = true;
        } else {
            man.x = man.homeX;
            man.z = man.homeZ;
            man.yaw = 0;
        }
    }
    if (man.striking > 0) {
        man.striking -= dt;
        const reach = Math.hypot(cam.x - man.x, cam.z - man.z);
        if (!man.struck && man.striking < 0.16 && reach < 1.75) {
            man.struck = true;
            hurtPlayer(8);
        }
        moving = true;
    }
    man.bob = moving ? Math.sin(performance.now() * 0.012 + man.index) * 0.05 : 0;
    if (moving) actorsDirty = true;
    return false;
}

function separateMen(dt) {
    for (let i = 0; i < men.length; i++) {
        const man = men[i];
        if (man.dying) continue;
        for (let j = i + 1; j < men.length; j++) {
            const other = men[j];
            if (other.dying) continue;
            const ox = man.x - other.x;
            const oz = man.z - other.z;
            const dist = Math.hypot(ox, oz);
            if (dist >= 0.72 || dist < 0.001) continue;
            const push = (0.72 - dist) * 0.5 * dt * 8;
            const px = ox / dist * push;
            const pz = oz / dist * push;
            if (!blocked(man.x + px, man.z)) man.x += px;
            if (!blocked(man.x, man.z + pz)) man.z += pz;
            if (!blocked(other.x - px, other.z)) other.x -= px;
            if (!blocked(other.x, other.z - pz)) other.z -= pz;
            actorsDirty = true;
        }
    }
}

function updateFight(dt) {
    if (player.guard > 0) player.guard -= dt;
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
        if (stepMan(men[i], dt)) {
            men.splice(i, 1);
            actorsDirty = true;
        }
    }
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

function resize() {
    const scale = window.innerWidth < 700 ? 1 : 0.65;
    canvas.width = Math.max(320, Math.floor(window.innerWidth * scale));
    canvas.height = Math.max(200, Math.floor(window.innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    const f = 1 / Math.tan((75 * Math.PI / 180) / 2);
    const aspect = canvas.width / canvas.height;
    const near = 0.08;
    const far = 220;
    const nf = 1 / (near - far);
    proj = new Float32Array([
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
    const eye = [cam.x, cam.y, cam.z];
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

function blocked(x, z) {
    const r = 0.4;
    for (const b of houses) {
        if (x > b.x - r && x < b.x + b.w + r && z > b.z - r && z < b.z + b.d + r) return true;
    }
    return x < -96 || x > 96 || z < -96 || z > 96;
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
    const forward = keys.KeyW || keys.ArrowUp || stick.y < -0.25;
    const back = keys.KeyS || keys.ArrowDown || stick.y > 0.25;
    const left = keys.KeyA || stick.x < -0.25;
    const right = keys.KeyD || stick.x > 0.25;
    if (forward) { mx += sy; mz -= cy; }
    if (back) { mx -= sy; mz += cy; }
    if (right) { mx += cy; mz += sy; }
    if (left) { mx -= cy; mz -= sy; }
    const len = Math.hypot(mx, mz);
    if (!len) return;
    const dist = 4.6 * dt;
    mx = mx / len * dist;
    mz = mz / len * dist;
    if (!blocked(cam.x + mx, cam.z)) cam.x += mx;
    if (!blocked(cam.x, cam.z + mz)) cam.z += mz;
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
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.useProgram(program);
    gl.uniformMatrix4fv(loc.proj, false, proj);
    gl.uniformMatrix4fv(loc.view, false, lookAt());
    const stride = 24;
    for (const name of Object.keys(mesh)) {
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh[name].buffer);
        gl.enableVertexAttribArray(loc.pos);
        gl.enableVertexAttribArray(loc.uv);
        gl.enableVertexAttribArray(loc.shade);
        gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 12);
        gl.vertexAttribPointer(loc.shade, 1, gl.FLOAT, false, stride, 20);
        gl.bindTexture(gl.TEXTURE_2D, textures[name]);
        gl.drawArrays(gl.TRIANGLES, 0, mesh[name].count);
    }
}

let last = performance.now();
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    movePlayer(dt);
    updateFight(dt);
    draw();
    requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
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
canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
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

canvas.addEventListener("touchstart", (e) => {
    for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && moveId === null) {
            moveId = t.identifier;
            stick.ox = t.clientX;
            stick.oy = t.clientY;
        } else if (lookId === null) {
            lookId = t.identifier;
            stick.lx = t.clientX;
            stick.ly = t.clientY;
            stick.gx = 0;
            stick.gy = 0;
            stick.lookAt = performance.now();
        }
    }
    e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
        if (t.identifier === lookId) {
            const mx = t.clientX - stick.lx;
            const my = t.clientY - stick.ly;
            stick.gx += mx;
            stick.gy += my;
            cam.yaw += mx * 0.006;
            cam.pitch = Math.max(-1.05, Math.min(1.05, cam.pitch - my * 0.006));
            stick.lx = t.clientX;
            stick.ly = t.clientY;
        }
        if (t.identifier === moveId) {
            stick.x = Math.max(-1, Math.min(1, (t.clientX - stick.ox) / 48));
            stick.y = Math.max(-1, Math.min(1, (t.clientY - stick.oy) / 48));
        }
    }
    e.preventDefault();
}, { passive: false });

function endTouch(e) {
    for (const t of e.changedTouches) {
        if (t.identifier === lookId) {
            if (!player.dead && performance.now() - stick.lookAt < 340) resolveSwing({ x: stick.gx || 0, y: stick.gy || 0 });
            lookId = null;
        }
        if (t.identifier === moveId) {
            moveId = null;
            stick.x = 0;
            stick.y = 0;
        }
    }
}
canvas.addEventListener("touchend", endTouch);
canvas.addEventListener("touchcancel", endTouch);

if (gl) {
    gl.clearColor(0.55, 0.66, 0.74, 1);
    resize();
    syncCampaign();
    setInterval(syncCampaign, 4000);
    requestAnimationFrame(frame);
}
