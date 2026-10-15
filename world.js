(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.World = api;
})(typeof self !== "undefined" ? self : this, function () {
    const edit = typeof require === "function" ? require("./world-edit.js") : (typeof self !== "undefined" && self.WorldEdit) || { rise: null, water: [], rocks: [] };
    const editPaths = edit.paths || [];
    const editRoads = edit.roads || [];
    const editBridges = edit.bridges || [];
    let bridges = null;
    let loaded = false;
    const places = [
        { x: -1480, z: -980, ox: -1480, oz: -980 },
        { x: 1220, z: -1560, ox: 1220, oz: -1560 },
        { x: -2480, z: 620, ox: -2480, oz: 620 },
        { x: 780, z: 1320, ox: 780, oz: 1320 }
    ];
    const links = [[1, 2], [0, 3], [0, 3], [1, 2]];
    const hamlets = [
        { id: "ashby", x: -2000, z: 940 },
        { id: "fernlow", x: -2672, z: -64 },
        { id: "brackwick", x: -2512, z: -384 },
        { id: "stoneacre", x: -2740, z: -699 },
        { id: "hollins", x: -2540, z: -913 },
        { id: "redmere", x: -2272, z: -160 },
        { id: "westerby", x: -3245, z: -60 }
    ];

    function hash(ix, iz) {
        let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    }

    function fade(t) {
        return t * t * (3 - 2 * t);
    }

    function noise(x, z) {
        const x0 = Math.floor(x);
        const z0 = Math.floor(z);
        const fx = fade(x - x0);
        const fz = fade(z - z0);
        const a = hash(x0, z0);
        const b = hash(x0 + 1, z0);
        const c = hash(x0, z0 + 1);
        const d = hash(x0 + 1, z0 + 1);
        return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
    }

    function fbm(x, z) {
        return noise(x, z) * 0.55 + noise(x * 2.1 + 4, z * 2.1) * 0.28 + noise(x * 4.3 + 9, z * 4.3) * 0.17;
    }

    function smooth(edge0, edge1, t) {
        const u = Math.max(0, Math.min(1, (t - edge0) / (edge1 - edge0 || 1)));
        return u * u * (3 - 2 * u);
    }

    function coastField(x, z) {
        const n = fbm(x * 0.00032, z * 0.00032);
        const n2 = fbm(x * 0.00085 + 18, z * 0.00085);
        const wx = x + (n - 0.5) * 1280;
        const wz = z + (n2 - 0.5) * 980;
        let field = 1 - (wx * wx) / (3180 * 3180) - (wz * wz) / (2920 * 2920);
        field += 0.42 * Math.exp(-((x + 1900) ** 2) / (980 ** 2) - ((z + 1500) ** 2) / (760 ** 2));
        field += 0.34 * Math.exp(-((x + 2300) ** 2) / (860 ** 2) - ((z - 620) ** 2) / (980 ** 2));
        field += 0.22 * Math.exp(-((x - 900) ** 2) / (700 ** 2) - ((z + 2550) ** 2) / (480 ** 2));
        field -= 0.5 * Math.exp(-((x - 2900) ** 2) / (520 ** 2) - ((z + 80) ** 2) / (780 ** 2));
        field -= 0.28 * Math.exp(-((x + 180) ** 2) / (640 ** 2) - ((z - 2850) ** 2) / (420 ** 2));
        field += (n2 - 0.5) * 0.28;
        return field;
    }

    function mountains(x, z) {
        const belt = Math.exp(-((z + 2140) ** 2) / (420 ** 2));
        const span = smooth(-200, 400, x) * (1 - smooth(2300, 2750, x));
        const passWest = Math.exp(-((x - 280) ** 2) / (220 ** 2));
        const passEast = Math.exp(-((x - 1880) ** 2) / (180 ** 2));
        const open = 1 - 0.72 * passWest - 0.55 * passEast;
        const ridge = 0.55 + fbm(x * 0.0016, z * 0.0016) * 0.7;
        return belt * span * Math.max(0, open) * (38 + ridge * 28);
    }

    function hills(x, z) {
        const roll = (fbm(x * 0.00115 + 2, z * 0.00115) - 0.42) * 16;
        const detail = (fbm(x * 0.0038, z * 0.0038) - 0.5) * 4.2;
        let h = roll + detail;
        const nw = Math.exp(-((x + 1500) ** 2) / (1100 ** 2) - ((z + 1200) ** 2) / (900 ** 2));
        h += nw * (fbm(x * 0.002, z * 0.002) - 0.35) * 8;
        const center = Math.exp(-((x + 80) ** 2) / (900 ** 2) - ((z - 80) ** 2) / (800 ** 2));
        h += center * 10;
        const plains = Math.exp(-((x - 1100) ** 2) / (1400 ** 2) - ((z - 1600) ** 2) / (1100 ** 2));
        h *= 1 - plains * 0.72;
        const swFlat = Math.exp(-((x + 2060) ** 2) / (420 ** 2) - ((z - 540) ** 2) / (380 ** 2));
        h *= 1 - swFlat * 0.85;
        return h;
    }

    // The old hand-made river, brook, lake and lochs hold no water now; their lines only keep the land shaped as the editor saw it.
    const river = [
        [620, -2280],
        [380, -1960],
        [140, -1580],
        [-80, -1120],
        [-260, -620],
        [-180, -180],
        [-520, 220],
        [-980, 520],
        [-1460, 640],
        [-1960, 820],
        [-2480, 980]
    ];
    const brook = [
        [-1320, -980],
        [-860, -620],
        [-520, -180],
        [-260, -620]
    ];
    const outlet = [
        [1680, 2140],
        [1760, 2480],
        [1680, 2860]
    ];
    const inlet = [
        [1260, 1780],
        [1100, 1680],
        [960, 1580],
        [860, 1510],
        [800, 1475]
    ];
    const lake = { x: 1680, z: 1860, rx: 620, rz: 480 };

    function segDist(x, z, a, b) {
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const len = dx * dx + dz * dz || 1;
        let t = ((x - a[0]) * dx + (z - a[1]) * dz) / len;
        t = Math.max(0, Math.min(1, t));
        const px = a[0] + dx * t;
        const pz = a[1] + dz * t;
        return Math.hypot(x - px, z - pz);
    }

    function chainDist(x, z, chain) {
        let best = 1e9;
        for (let i = 1; i < chain.length; i++) best = Math.min(best, segDist(x, z, chain[i - 1], chain[i]));
        return best;
    }

    function nearRiver(x, z) {
        return editRivers.length > 0 && nearChainDist(x, z, editRivers, riverBoxes) < 50;
    }

    function lakeField(x, z) {
        const dx = (x - lake.x) / lake.rx;
        const dz = (z - lake.z) / lake.rz;
        return 1 - (dx * dx + dz * dz);
    }

    const tracks = {
        "0-1": [[-1280, -1080], [-820, -1240], [-280, -1400], [160, -1560], [280, -1680], [560, -1740], [900, -1620], [1100, -1560]],
        "1-0": [[1100, -1560], [900, -1620], [560, -1740], [280, -1680], [160, -1560], [-280, -1400], [-820, -1240], [-1280, -1080]],
        "0-2": [[-1560, -780], [-1680, -280], [-1860, 80], [-2100, 360], [-2300, 520]],
        "2-0": [[-2300, 520], [-2100, 360], [-1860, 80], [-1680, -280], [-1560, -780]],
        "2-3": [[-2280, 760], [-1760, 860], [-1120, 980], [-480, 1080], [40, 1160], [280, 1220], [520, 1260]],
        "3-2": [[520, 1260], [280, 1220], [40, 1160], [-480, 1080], [-1120, 980], [-1760, 860], [-2280, 760]],
        "1-3": [[1280, -1360], [1460, -860], [1380, -240], [1180, 280], [980, 760], [860, 1120]],
        "3-1": [[860, 1120], [980, 760], [1180, 280], [1380, -240], [1460, -860], [1280, -1360]]
    };

    function trackOf(from, to) {
        return tracks[from + "-" + to] || [];
    }

    function trackDist(x, z) {
        let best = 1e9;
        for (const key of Object.keys(tracks)) {
            if (key[0] > key[2]) continue;
            best = Math.min(best, chainDist(x, z, tracks[key]));
        }
        return best;
    }

    function boxOf(chain) {
        const box = { minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9 };
        for (const p of chain) {
            box.minX = Math.min(box.minX, p[0]);
            box.maxX = Math.max(box.maxX, p[0]);
            box.minZ = Math.min(box.minZ, p[1]);
            box.maxZ = Math.max(box.maxZ, p[1]);
        }
        return box;
    }

    function outsideBox(x, z, box) {
        const dx = x < box.minX ? box.minX - x : x > box.maxX ? x - box.maxX : 0;
        const dz = z < box.minZ ? box.minZ - z : z > box.maxZ ? z - box.maxZ : 0;
        return Math.max(dx, dz);
    }

    // Callers only care about distances under 200 m, so far-off chains report the distance to their box instead.
    function nearChainDist(x, z, chains, boxes) {
        let best = 1e9;
        for (let i = 0; i < chains.length; i++) {
            const out = outsideBox(x, z, boxes[i]);
            best = Math.min(best, out > 200 ? out : chainDist(x, z, chains[i]));
        }
        return best;
    }

    const pathBoxes = editPaths.map(boxOf);
    const roadBoxes = editRoads.map(boxOf);

    function stoneDist(x, z) {
        return nearChainDist(x, z, editRoads, roadBoxes);
    }

    function pathDist(x, z) {
        return Math.min(stoneDist(x, z), nearChainDist(x, z, editPaths, pathBoxes));
    }

    function roadDist(x, z) {
        return Math.min(trackDist(x, z), pathDist(x, z));
    }

    const editRivers = edit.rivers || [];
    const riverBoxes = editRivers.map(boxOf);

    function editRiverInfo(x, z) {
        if (!editRivers.length) return null;
        const d = nearChainDist(x, z, editRivers, riverBoxes);
        if (d > 60) return null;
        return { d, w: 8 + fbm(x * 0.004 + 3, z * 0.004) * 6 };
    }

    function editRiverOpen(x, z) {
        if (inField(x, z)) return false;
        for (const place of places) {
            if (Math.hypot(x - place.x, z - place.z) < 170) return false;
        }
        return true;
    }

    // Painted rivers follow the ground like the old river: a shallow bed with water laid just above it, so they can run over hills.
    function carveEditRivers(x, z, h) {
        const info = editRiverInfo(x, z);
        if (!info || info.d >= info.w || !editRiverOpen(x, z)) return h;
        const drop = 1 - smooth(0.36, 1, info.d / info.w);
        return h - drop * (roadDist(x, z) < 12 && !underBridge(x, z) ? 0.35 : 1.8);
    }

    function inEditRiver(x, z, part) {
        const info = editRiverInfo(x, z);
        return !!info && info.d < info.w * part && editRiverOpen(x, z) && (roadDist(x, z) >= 12 || underBridge(x, z));
    }

    const editGround = edit.ground || [];

    // The last disc painted over a spot wins; edges wobble so patches do not look like circles.
    function paintedGround(x, z) {
        for (let i = editGround.length - 1; i >= 0; i--) {
            const [gx, gz, r, kind] = editGround[i];
            const dx = x - gx;
            const dz = z - gz;
            const reach = r * 1.2;
            if (dx > reach || dx < -reach || dz > reach || dz < -reach) continue;
            const edge = r * (0.82 + fbm(x * 0.03 + i * 0.7, z * 0.03) * 0.36);
            if (dx * dx + dz * dz < edge * edge) return kind;
        }
        return null;
    }

    function paintedNear(x, z, pad) {
        for (const [gx, gz, r] of editGround) {
            const reach = r * 1.2 + pad;
            if (Math.abs(x - gx) < reach && Math.abs(z - gz) < reach) return true;
        }
        return false;
    }

    function paintedSurface(kind, x, z) {
        if (kind === "rocky") return fbm(x * 0.06 + 4, z * 0.06 + 1) > 0.56 ? "gravel" : "grass";
        return kind;
    }

    // Small loose stones over rocky grass; they are only looks, so you can walk through them: [x, z, ry, size].
    const groundStones = [];
    {
        const rocky = editGround.filter((g) => g[3] === "rocky");
        if (rocky.length) {
            const box = { minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9 };
            for (const [gx, gz, r] of rocky) {
                box.minX = Math.min(box.minX, gx - r);
                box.maxX = Math.max(box.maxX, gx + r);
                box.minZ = Math.min(box.minZ, gz - r);
                box.maxZ = Math.max(box.maxZ, gz + r);
            }
            const cell = 5;
            for (let ix = Math.floor(box.minX / cell); ix <= box.maxX / cell; ix++) {
                for (let iz = Math.floor(box.minZ / cell); iz <= box.maxZ / cell; iz++) {
                    const roll = hash(ix, iz);
                    if (roll > 0.5) continue;
                    const x = (ix + hash(ix + 7, iz)) * cell;
                    const z = (iz + hash(ix, iz + 7)) * cell;
                    const inGravel = fbm(x * 0.06 + 4, z * 0.06 + 1) > 0.56;
                    if (!inGravel && roll > 0.06) continue;
                    if (paintedGround(x, z) !== "rocky") continue;
                    groundStones.push([Math.round(x * 10) / 10, Math.round(z * 10) / 10, Number((hash(ix, iz + 3) * 6.28).toFixed(2)), Number((0.3 + hash(ix + 5, iz) * 1.3).toFixed(2))]);
                }
            }
        }
    }

    const editCliffs = edit.cliffs || [];
    const cliffBoxes = editCliffs.map(boxOf);
    const CLIFF_TOP = 7;
    const CLIFF_FOOT = 16;

    function cliffDist(x, z) {
        return nearChainDist(x, z, editCliffs, cliffBoxes);
    }

    // A rock wall along each cliff stroke: flat grassy top, a steep face, then loose scree at the foot.
    function cliffRise(x, z) {
        if (!editCliffs.length) return 0;
        const d = cliffDist(x, z);
        if (d >= CLIFF_FOOT) return 0;
        const gap = smooth(14, 40, roadDist(x, z));
        if (gap <= 0) return 0;
        const tall = (12 + fbm(x * 0.012 + 5, z * 0.012 + 9) * 10) * gap;
        if (d <= CLIFF_TOP) return tall + (fbm(x * 0.07, z * 0.07) - 0.5) * 1.6;
        const t = (d - CLIFF_TOP) / (CLIFF_FOOT - CLIFF_TOP);
        return tall * Math.pow(1 - Math.pow(t, 0.4), 1.5);
    }

    // Where a stone road runs between high ground, it goes through a cut: sheer rock walls a few metres either side.
    let cuts = null;
    let cutBox = null;
    let cutting = false;

    function layCuts() {
        cuts = [];
        cutting = true;
        for (const chain of editRoads) {
            for (let i = 1; i < chain.length; i++) {
                const a = chain[i - 1];
                const b = chain[i];
                const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
                if (len < 0.01) continue;
                const nx = -(b[1] - a[1]) / len;
                const nz = (b[0] - a[0]) / len;
                for (let s = 0; s < len; s += 6) {
                    const x = a[0] + (b[0] - a[0]) * s / len;
                    const z = a[1] + (b[1] - a[1]) * s / len;
                    const h0 = heightAt(x, z);
                    let hL = -1e9;
                    let hR = -1e9;
                    for (let o = 25; o <= 90; o += 5) {
                        hL = Math.max(hL, heightAt(x + nx * o, z + nz * o));
                        hR = Math.max(hR, heightAt(x - nx * o, z - nz * o));
                    }
                    const strength = Math.max(0, Math.min(1, (Math.min(hL, hR) - h0 - 10) / 10));
                    if (strength > 0) cuts.push({ x, z, nx, nz, h0, hL, hR, strength });
                }
            }
        }
        cutting = false;
        cutBox = cuts.length ? boxOf(cuts.map((c) => [c.x, c.z])) : null;
    }

    function nearCut(x, z) {
        if (!loaded || cutting) return null;
        if (!cuts) layCuts();
        if (!cutBox || outsideBox(x, z, cutBox) > 60) return null;
        let best = null;
        let bestD = 60;
        for (const c of cuts) {
            const d = Math.hypot(x - c.x, z - c.z);
            if (d < bestD) { bestD = d; best = c; }
        }
        return best;
    }

    function passCut(x, z, h) {
        const c = nearCut(x, z);
        if (!c) return h;
        const across = (x - c.x) * c.nx + (z - c.z) * c.nz;
        const d = Math.abs(across) + (fbm(x * 0.09 + 2, z * 0.09 + 7) - 0.5) * 3;
        if (d < 9) return h;
        const along = (x - c.x) * c.nz - (z - c.z) * c.nx;
        const strength = c.strength * (1 - smooth(4, 30, Math.abs(along)));
        const side = across > 0 ? c.hL : c.hR;
        const top = c.h0 + (side - c.h0 + (fbm(x * 0.05, z * 0.05) - 0.5) * 3) * strength * smooth(9, 12, d);
        const fade = 1 - smooth(35, 60, d);
        return Math.max(h, h + (top - h) * fade);
    }

    function inCut(x, z) {
        const c = nearCut(x, z);
        if (!c) return false;
        const d = Math.abs((x - c.x) * c.nx + (z - c.z) * c.nz);
        return d > 7 && d < 15;
    }

    // Rock slabs jutting from the cliff faces and fallen boulders below them: [x, z, ry, s].
    const cliffRocks = [];
    for (const chain of editCliffs) {
        for (let i = 1; i < chain.length; i++) {
            const [ax, az] = chain[i - 1];
            const [bx, bz] = chain[i];
            const len = Math.hypot(bx - ax, bz - az);
            if (len < 1) continue;
            const nx = -(bz - az) / len;
            const nz = (bx - ax) / len;
            const put = (t, out, ry, s) => {
                const x = ax + (bx - ax) * t + nx * out;
                const z = az + (bz - az) * t + nz * out;
                if (roadDist(x, z) < 26) return;
                cliffRocks.push([Math.round(x), Math.round(z), Number(ry.toFixed(2)), Number(s.toFixed(2))]);
            };
            for (let along = 0; along < len; ) {
                const k = Math.round(ax + along) * 7 + Math.round(az) * 13 + i;
                const t = along / len;
                along += 5 + hash(k, 57) * 13;
                const turn = Math.atan2(nz, nx);
                for (const side of [-1, 1]) {
                    if (hash(k, 40 + side) < 0.5) put(t, side * (CLIFF_TOP + 1 + hash(k, 43 + side) * 6), turn + (hash(k, 46 + side) - 0.5) * 1.2, 0.3 + hash(k, 49 + side) * 0.55);
                }
                if (hash(k, 52) < 0.45) {
                    const side = hash(k, 53) < 0.5 ? -1 : 1;
                    put(t, side * (CLIFF_FOOT + 1 + hash(k, 54) * 8), hash(k, 55) * 6.28, 0.16 + hash(k, 56) * 0.18);
                }
            }
        }
    }

    const peakBox = { minX: -2528, maxX: -1760, minZ: -1984, maxZ: -1152 };
    const peakPass = [
        [-2195, -1280],
        [-2195, -1400],
        [-2255, -1520],
        [-2135, -1640],
        [-2215, -1760]
    ];
    const peakMounts = [
        { x: -2335, z: -1490, r: 162, h: 48 },
        { x: -2055, z: -1455, r: 156, h: 42 },
        { x: -2070, z: -1695, r: 150, h: 38 }
    ];
    const peakLens = [];
    let peakLength = 0;
    for (let i = 1; i < peakPass.length; i++) {
        const len = Math.hypot(peakPass[i][0] - peakPass[i - 1][0], peakPass[i][1] - peakPass[i - 1][1]);
        peakLens.push(len);
        peakLength += len;
    }

    function mound(dist, radius, height) {
        const u = dist / radius;
        if (u >= 1) return 0;
        let t;
        if (u > 0.86) {
            const s = (1 - u) / 0.14;
            t = s * s * 0.16;
        } else if (u > 0.74) {
            const s = (0.86 - u) / 0.12;
            t = 0.16 + s * 0.4;
        } else {
            const s = 1 - u / 0.74;
            t = 0.56 + s * s * 0.44;
        }
        return t * height;
    }

    function passAt(x, z) {
        let best = 1e9;
        let walked = 0;
        let bestAlong = 0;
        for (let i = 1; i < peakPass.length; i++) {
            const a = peakPass[i - 1];
            const b = peakPass[i];
            const dx = b[0] - a[0];
            const dz = b[1] - a[1];
            const len2 = dx * dx + dz * dz || 1;
            let t = ((x - a[0]) * dx + (z - a[1]) * dz) / len2;
            t = Math.max(0, Math.min(1, t));
            const px = a[0] + dx * t;
            const pz = a[1] + dz * t;
            const dist = Math.hypot(x - px, z - pz);
            if (dist < best) {
                best = dist;
                bestAlong = walked + peakLens[i - 1] * t;
            }
            walked += peakLens[i - 1];
        }
        return { d: best, u: peakLength ? bestAlong / peakLength : 0 };
    }

    function passFloor(u) {
        const gate = Math.sin(u * Math.PI);
        return gate * (8.4 + Math.sin(u * Math.PI * 4) * 3.2);
    }

    function testPeaks(x, z) {
        if (x < peakBox.minX || x > peakBox.maxX || z < peakBox.minZ || z > peakBox.maxZ) return 0;
        let mountain = 0;
        for (const peak of peakMounts) {
            mountain = Math.max(mountain, mound(Math.hypot(x - peak.x, z - peak.z), peak.r, peak.h));
        }
        if (mountain > 0.8) {
            const t = Math.min(1, mountain / 24);
            mountain += (fbm(x * 0.007 + 3, z * 0.007) - 0.5) * 1.6 * t;
            if (mountain < 0) mountain = 0;
        }
        const info = passAt(x, z);
        const floor = passFloor(info.u);
        const valley = 8;
        const lip = 4;
        const wall = 7;
        if (info.d <= valley) return floor;
        if (mountain < 0.8) {
            const span = 20;
            if (info.d >= valley + span) return mountain;
            const s = (info.d - valley) / span;
            return floor * (1 - s * s);
        }
        if (info.d >= valley + lip + wall) return mountain;
        if (info.d <= valley + lip) {
            const s = (info.d - valley) / lip;
            return Math.min(mountain, floor + s * s * 1.5);
        }
        const s = (info.d - valley - lip) / wall;
        const rise = 1.5 + s * s * Math.max(10, mountain - floor - 1.5);
        return Math.min(mountain, floor + rise);
    }

    function tooSteep(x, z) {
        const inPeak = x >= peakBox.minX && x <= peakBox.maxX && z >= peakBox.minZ && z <= peakBox.maxZ;
        if (!inPeak && !(editCliffs.length && cliffDist(x, z) < CLIFF_FOOT) && !inCut(x, z)) return false;
        const h = heightAt(x, z);
        const s = 1.6;
        if (Math.abs(heightAt(x + s, z) - h) > 1.5) return true;
        if (Math.abs(heightAt(x - s, z) - h) > 1.5) return true;
        if (Math.abs(heightAt(x, z + s) - h) > 1.5) return true;
        if (Math.abs(heightAt(x, z - s) - h) > 1.5) return true;
        return false;
    }

    let countryOn = false;
    const shelves = [];

    function countryMask(x, z) {
        let mask = smooth(0.22, 0.42, coastField(x, z));
        const wetD = Math.min(
            chainDist(x, z, river),
            chainDist(x, z, brook),
            chainDist(x, z, outlet),
            chainDist(x, z, inlet),
            chainDist(x, z, lochWest),
            chainDist(x, z, lochEast)
        );
        mask *= smooth(42, 110, wetD);
        mask *= 1 - smooth(-0.5, -0.05, lakeField(x, z));
        mask *= 1 - Math.exp(-((z + 2140) ** 2) / (520 ** 2));
        let px = 0;
        let pz = 0;
        if (x < peakBox.minX) px = peakBox.minX - x;
        else if (x > peakBox.maxX) px = x - peakBox.maxX;
        if (z < peakBox.minZ) pz = peakBox.minZ - z;
        else if (z > peakBox.maxZ) pz = z - peakBox.maxZ;
        if (px === 0 && pz === 0) return 0;
        mask *= smooth(0, 170, Math.hypot(px, pz));
        for (const place of places) {
            mask = Math.min(mask, smooth(120, 220, Math.hypot(x - place.x, z - place.z)));
        }
        return mask;
    }

    function dome(x, z, cx, cz, rx, rz, height) {
        const u = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2;
        if (u >= 1) return 0;
        const s = 1 - u;
        return s * s * height;
    }

    function countryRoll(x, z) {
        const broad = noise(x * 0.00105 + 1.4, z * 0.00098 + 0.6);
        const wide = noise(x * 0.00048 + 9.2, z * 0.00052 + 4.8);
        return ((broad - 0.5) * 11 + (wide - 0.5) * 7) * countryMask(x, z);
    }

    function layCountry(x, z, h) {
        let roll = countryRoll(x, z);
        if (roll < 0) {
            const room = Math.max(0, h - 0.48);
            if (-roll > room) roll = -room;
        } else if (h > 12) {
            roll *= Math.max(0, (16 - h) / 4);
        }
        const swell = (
            dome(x, z, -2000, 420, 820, 640, 14) +
            dome(x, z, 1620, 360, 760, 600, 10) +
            dome(x, z, -280, 1680, 680, 480, 8)
        ) * countryMask(x, z);
        return h + roll + swell;
    }

    function waveMask(x, z) {
        let mask = smooth(0.28, 0.55, coastField(x, z));
        for (const place of places) {
            mask = Math.min(mask, smooth(108, 188, Math.hypot(x - place.x, z - place.z)));
        }
        for (let i = 0; i < shelves.length; i++) {
            const shelf = shelves[i];
            const dx = x < shelf.x ? shelf.x - x : x > shelf.x + shelf.w ? x - (shelf.x + shelf.w) : 0;
            const dz = z < shelf.z ? shelf.z - z : z > shelf.z + shelf.d ? z - (shelf.z + shelf.d) : 0;
            mask = Math.min(mask, smooth(6, 48, Math.hypot(dx, dz)));
        }
        let px = 0;
        let pz = 0;
        if (x < peakBox.minX) px = peakBox.minX - x;
        else if (x > peakBox.maxX) px = x - peakBox.maxX;
        if (z < peakBox.minZ) pz = peakBox.minZ - z;
        else if (z > peakBox.maxZ) pz = z - peakBox.maxZ;
        if (px === 0 && pz === 0) return 0;
        mask = Math.min(mask, smooth(40, 140, Math.hypot(px, pz)));
        const wetD = Math.min(
            chainDist(x, z, river),
            chainDist(x, z, brook),
            chainDist(x, z, outlet),
            chainDist(x, z, inlet)
        );
        mask *= smooth(24, 64, wetD);
        return mask;
    }

    function groundWave(x, z) {
        const mask = waveMask(x, z);
        if (mask < 0.001) return 0;
        const roll = (noise(x * 0.0062 + 2.4, z * 0.0056 + 5.1) - 0.5) * 8.4;
        const lump = (noise(x * 0.014 + 12.2, z * 0.013 + 3.6) - 0.5) * 3.4;
        return (roll + lump) * mask;
    }

    function layShelves(x, z, h) {
        let best = 1;
        let target = h;
        for (let i = 0; i < shelves.length; i++) {
            const shelf = shelves[i];
            const dx = x < shelf.x ? shelf.x - x : x > shelf.x + shelf.w ? x - (shelf.x + shelf.w) : 0;
            const dz = z < shelf.z ? shelf.z - z : z > shelf.z + shelf.d ? z - (shelf.z + shelf.d) : 0;
            const dist = Math.hypot(dx, dz);
            if (dist >= 72) continue;
            const u = smooth(0, 72, dist);
            if (u < best) {
                best = u;
                target = shelf.y;
            }
        }
        return h * best + target * (1 - best);
    }

    function pullRoad(x, z, h) {
        const rd = roadDist(x, z);
        const t = countryOn ? smooth(3.2, 6.2, h) : 0;
        const reach = 18 + 28 * t;
        if (rd >= reach || h <= 0.4) return h;
        const pull = 1 - rd / reach;
        const low = h * (1 - pull * 0.82) + 0.35 * pull * 0.82;
        const crown = 0.9 + (h - 0.9) * 0.6;
        const high = h * (1 - pull * 0.65) + crown * pull * 0.65;
        return low * (1 - t) + high * t;
    }

    function turfShade(x, z) {
        const broad = noise(x * 0.00058 + 2.2, z * 0.00052 + 1.4);
        const mid = noise(x * 0.0017 + 6.1, z * 0.00155 + 8.4);
        return 0.74 + broad * 0.22 + mid * 0.1;
    }

    // Level earth pads under buildings: the top at y over the rect, then a bank falling at PAD_BANK per metre to the land.
    // Pads only ever fill ground up, never cut it down.
    const PAD_LIP = 1.5;
    const PAD_BANK = 0.7;
    let pads = [];

    function setPads(list) {
        pads = list || [];
    }

    // Where the goblins of the camp ringed by cones on the editor map stand: n dry spots spread evenly inside the ring,
    // the same on the server and in the game. The centre comes first.
    let wildCache = null;
    function wildSpots(n) {
        const ring = (edit.wilds || [])[0];
        if (!ring) return { centre: null, spots: [] };
        if (wildCache && wildCache.n === n) return wildCache;
        const inside = (x, z) => {
            let hit = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const [xi, zi] = ring[i];
                const [xj, zj] = ring[j];
                if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
            }
            return hit;
        };
        const xs = ring.map((p) => p[0]);
        const zs = ring.map((p) => p[1]);
        const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
        const centre = { x: (box.x0 + box.x1) / 2, z: (box.z0 + box.z1) / 2 };
        const roll = (x, z) => {
            const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
            return v - Math.floor(v);
        };
        let spots = [];
        for (let step = 90; step >= 10 && spots.length < n; step -= 5) {
            spots = [];
            for (let x = box.x0 + step / 2; x < box.x1; x += step) {
                for (let z = box.z0 + step / 2; z < box.z1; z += step) {
                    const px = x + (roll(x, z) - 0.5) * step * 0.6;
                    const pz = z + (roll(z, x) - 0.5) * step * 0.6;
                    if (!inside(px, pz) || wet(px, pz) || heightAt(px, pz) < 0.5) continue;
                    spots.push({ x: px, z: pz, r: roll(px, pz) });
                }
            }
        }
        spots.sort((a, b) => a.r - b.r);
        wildCache = { n, centre, spots: spots.slice(0, n).map((s) => ({ x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10 })) };
        return wildCache;
    }

    // Ground under a building pad is cleared of trees and bushes.
    function onPad(x, z, margin = 1) {
        for (let i = 0; i < pads.length; i++) {
            const p = pads[i];
            if (x > p.minX - margin && x < p.minX + p.w + margin && z > p.minZ - margin && z < p.minZ + p.d + margin) return true;
        }
        return false;
    }

    function heightAt(x, z) {
        let h = bareHeight(x, z);
        for (let i = 0; i < pads.length; i++) {
            const p = pads[i];
            const dx = Math.max(p.minX - x, 0, x - p.minX - p.w);
            const dz = Math.max(p.minZ - z, 0, z - p.minZ - p.d);
            if (dx > 40 || dz > 40) continue;
            const top = p.y - Math.max(0, Math.hypot(dx, dz) - PAD_LIP) * PAD_BANK;
            if (top > h) h = top;
        }
        return h;
    }

    function bareHeight(x, z) {
        const field = coastField(x, z);
        if (field < -0.2) return -8 + field * 10;
        const shore = smooth(-0.04, 0.16, field);
        let h = shore * (1.4 + hills(x, z));
        h += mountains(x, z) * shore;
        if (field < 0.08) h = Math.min(h, smooth(-0.04, 0.08, field) * 1.6);
        else h = Math.max(h, shore * 0.7);
        if (countryOn) h = layCountry(x, z, h);
        h = pullRoad(x, z, h);
        h += testPeaks(x, z);
        h += editRise(x, z) + cliffRise(x, z);
        if (countryOn) {
            h = layShelves(x, z, h);
            h = pullRoad(x, z, h);
        }
        let pad = 1;
        for (const place of places) {
            const d = Math.hypot(x - place.x, z - place.z);
            pad = Math.min(pad, smooth(62, 150, d));
        }
        let shaped = h * pad;
        if (countryOn) {
            const wave = groundWave(x, z);
            if (wave < 0) shaped += Math.max(wave, -Math.max(0, shaped - 0.55));
            else shaped += wave;
        }
        return carveEditWater(x, z, carveEditRivers(x, z, passCut(x, z, shaped)));
    }

    function editRise(x, z) {
        const r = edit.rise;
        if (!r) return 0;
        const fx = (x - r.x0) / r.step;
        const fz = (z - r.z0) / r.step;
        if (fx < 0 || fz < 0 || fx >= r.nx - 1 || fz >= r.nz - 1) return 0;
        const ix = Math.floor(fx);
        const iz = Math.floor(fz);
        const tx = fx - ix;
        const tz = fz - iz;
        const i = iz * r.nx + ix;
        const top = r.dm[i] * (1 - tx) + r.dm[i + 1] * tx;
        const bottom = r.dm[i + r.nx] * (1 - tx) + r.dm[i + r.nx + 1] * tx;
        return (top * (1 - tz) + bottom * tz) * 0.1;
    }

    const waterBoxes = edit.water.map(boxOf);
    const editWaterBox = { minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9 };
    for (const stroke of edit.water) {
        for (const p of stroke) {
            editWaterBox.minX = Math.min(editWaterBox.minX, p[0] - 100);
            editWaterBox.maxX = Math.max(editWaterBox.maxX, p[0] + 100);
            editWaterBox.minZ = Math.min(editWaterBox.minZ, p[1] - 100);
            editWaterBox.maxZ = Math.max(editWaterBox.maxZ, p[1] + 100);
        }
    }

    function editWaterOpen(x, z) {
        if (inField(x, z) || (roadDist(x, z) < 28 && !underBridge(x, z))) return false;
        for (const place of places) {
            if (Math.hypot(x - place.x, z - place.z) < 160) return false;
        }
        for (const trail of fishTrail) {
            if (chainDist(x, z, trail) < 26) return false;
        }
        return true;
    }

    function editWaterReach(x, z) {
        const box = editWaterBox;
        if (x < box.minX || x > box.maxX || z < box.minZ || z > box.maxZ) return null;
        let d = 1e9;
        let w = 1e9;
        let n = -1;
        for (let i = 0; i < edit.water.length; i++) {
            if (outsideBox(x, z, waterBoxes[i]) > 100) continue;
            const stroke = edit.water[i];
            const sd = chainDist(x, z, stroke);
            if (sd >= d) continue;
            d = sd;
            const tip = stroke[stroke.length - 1];
            const fromTip = Math.hypot(x - tip[0], z - tip[1]);
            if (n < 0) n = fbm(x * 0.0034 + 6, z * 0.0034);
            w = Math.min(58 + n * 30, 22 + fromTip * 0.2);
        }
        for (const b of editBridges) w = Math.min(w, 12 + Math.hypot(x - b[0], z - b[1]) * 0.3);
        return d < w ? { d, w } : null;
    }

    function carveEditWater(x, z, h) {
        const reach = editWaterReach(x, z);
        if (!reach || !editWaterOpen(x, z)) return h;
        const t = reach.d / reach.w;
        return Math.min(h, -5.4 + 12 * t * t);
    }

    // Where painted water or a painted river stands, before roads and towns hold it back.
    function paintedWater(x, z) {
        const reach = editWaterReach(x, z);
        if (reach && reach.d < reach.w * 0.68) return true;
        const info = editRiverInfo(x, z);
        return !!info && info.d < info.w * 0.45;
    }

    // A bridge runs along the road or path it was dropped on; with none near, it runs straight across the water.
    function crossingDir(x, z) {
        const roads = editRoads.concat(editPaths, Object.keys(tracks).filter((key) => key[0] < key[2]).map((key) => tracks[key]));
        let best = 40;
        let dir = null;
        for (const chain of roads) {
            for (let i = 1; i < chain.length; i++) {
                const d = segDist(x, z, chain[i - 1], chain[i]);
                if (d >= best) continue;
                best = d;
                dir = [chain[i][0] - chain[i - 1][0], chain[i][1] - chain[i - 1][1]];
            }
        }
        if (!dir) {
            best = 1e9;
            for (const chain of edit.water.concat(editRivers)) {
                for (let i = 1; i < chain.length; i++) {
                    const d = segDist(x, z, chain[i - 1], chain[i]);
                    if (d >= best) continue;
                    best = d;
                    dir = [chain[i - 1][1] - chain[i][1], chain[i][0] - chain[i - 1][0]];
                }
            }
        }
        const len = dir ? Math.hypot(dir[0], dir[1]) : 0;
        return len > 0 ? [dir[0] / len, dir[1] / len] : [1, 0];
    }

    function layBridge(spot) {
        const [x, z] = spot;
        const [dx, dz] = crossingDir(x, z);
        const runs = [];
        for (let t = -150; t <= 150; t++) {
            if (!paintedWater(x + dx * t, z + dz * t)) continue;
            const run = runs[runs.length - 1];
            if (run && run[1] === t - 1) run[1] = t;
            else runs.push([t, t]);
        }
        const off = (run) => (run[0] > 0 ? run[0] : run[1] < 0 ? -run[1] : 0);
        runs.sort((a, b) => off(a) - off(b));
        const wet = runs[0] || [-6, 6];
        const lo = wet[0] - 6;
        const hi = wet[1] + 6;
        const mid = (lo + hi) / 2;
        const half = (hi - lo) / 2;
        const cx = x + dx * mid;
        const cz = z + dz * mid;
        return {
            x: cx,
            z: cz,
            dx,
            dz,
            half,
            width: 6,
            wetFrom: wet[0] - mid,
            wetTo: wet[1] - mid,
            hA: Math.max(0, heightAt(cx - dx * half, cz - dz * half)),
            hB: Math.max(0, heightAt(cx + dx * half, cz + dz * half))
        };
    }

    // Laid out on first use after the island is built, since the ground must be whole to find the banks.
    function bridgeList() {
        if (!loaded) return [];
        if (bridges) return bridges;
        bridges = [];
        const laid = editBridges.map(layBridge);
        bridges = laid;
        for (const bridge of laid) {
            bridge.water = waterLevel(bridge.x, bridge.z) ?? 0.03;
            bridge.hump = Math.min(5, Math.max(1.2, bridge.water + 3.2 - (bridge.hA + bridge.hB) / 2));
        }
        return bridges;
    }

    // Along is measured from the bridge middle; the deck meets the bank at both ends and humps over the water.
    function deckY(bridge, along) {
        const s = (along + bridge.half) / (bridge.half * 2);
        return bridge.hA + (bridge.hB - bridge.hA) * s + bridge.hump * Math.sin(Math.PI * s);
    }

    function bridgeLocal(bridge, x, z) {
        const rx = x - bridge.x;
        const rz = z - bridge.z;
        return { along: rx * bridge.dx + rz * bridge.dz, across: rz * bridge.dx - rx * bridge.dz };
    }

    function underBridge(x, z) {
        for (const bridge of bridgeList()) {
            const p = bridgeLocal(bridge, x, z);
            if (Math.abs(p.along) < bridge.half - 3 && Math.abs(p.across) < 30) return true;
        }
        return false;
    }

    function bridgeDeck(x, z) {
        for (const bridge of bridgeList()) {
            const p = bridgeLocal(bridge, x, z);
            if (Math.abs(p.along) <= bridge.half && Math.abs(p.across) <= bridge.width / 2) return deckY(bridge, p.along);
        }
        return null;
    }

    // The parapets along both sides; returns the deck height there so callers can block walking off the edge.
    function bridgeWall(x, z) {
        for (const bridge of bridgeList()) {
            const p = bridgeLocal(bridge, x, z);
            const edge = Math.abs(p.across);
            if (Math.abs(p.along) < bridge.half - 0.5 && edge > bridge.width / 2 - 0.45 && edge <= bridge.width / 2 + 0.1) return deckY(bridge, p.along);
        }
        return null;
    }

    function nearEditRock(x, z, pad) {
        for (const rock of edit.rocks) {
            const r = 9 * rock[3] + pad;
            if (Math.abs(x - rock[0]) < r && Math.abs(z - rock[1]) < r) return true;
        }
        if (editRivers.length && nearChainDist(x, z, editRivers, riverBoxes) < 16 + pad) return true;
        return editCliffs.length > 0 && cliffDist(x, z) < CLIFF_FOOT + pad;
    }

    const lochWest = [
        [-3180, -1040],
        [-2920, -980],
        [-2740, -1080],
        [-2560, -960],
        [-2380, -1060],
        [-2200, -940],
        [-2020, -1060],
        [-1840, -980],
        [-1720, -1040],
        [-1584, -990]
    ];
    const lochEast = [
        [3040, -1680],
        [2780, -1560],
        [2600, -1720],
        [2420, -1500],
        [2240, -1660],
        [2060, -1480],
        [1880, -1620],
        [1700, -1500],
        [1560, -1580],
        [1362, -1550]
    ];

    function waterLevel(x, z) {
        const h = heightAt(x, z);
        if (h < -0.08) return 0.03;
        if (h > 0.2 && inEditRiver(x, z, 0.4)) return h + 0.14;
        return null;
    }

    function wet(x, z) {
        const h = heightAt(x, z);
        if (h < -0.05) return true;
        return inEditRiver(x, z, 0.34);
    }

    const fishTrail = [
        [[-1480, -1400], [-1460, -1800], [-1500, -2140], [-1480, -2420]],
        [[1280, -1360], [1500, -1180], [2000, -1200], [2500, -1220], [2820, -1240]],
        [[-2700, 640], [-2940, 660], [-3180, 620], [-3280, 600]],
        [[782, 1442], [792, 1470], [1018, 1954], [1241, 2433]]
    ];

    const fields = [
        { x: -1508, z: -900, w: 58, d: 36 },
        { x: -1406, z: -1034, w: 54, d: 42 },
        { x: 1128, z: -1426, w: 48, d: 18 },
        { x: 1192, z: -1426, w: 40, d: 18 },
        { x: -2570, z: 758, w: 74, d: 54 },
        { x: -2464, z: 764, w: 56, d: 48 },
        { x: -2484.5, z: 746, w: 8, d: 68 },
        { x: -2442, z: 736, w: 18, d: 14 },
        { x: 694, z: 1398, w: 56, d: 40 },
        { x: 814, z: 1398, w: 56, d: 40 }
    ];

    function inField(x, z) {
        for (const field of fields) {
            if (x > field.x && x < field.x + field.w && z > field.z && z < field.z + field.d) return true;
        }
        return false;
    }

    function groundKind(x, z, rise, known) {
        const h = known ?? heightAt(x, z);
        const peak = testPeaks(x, z);
        if (peak > 0.4) {
            if ((rise || 0) > 2.2 || peak > 22) return "rock";
            if ((rise || 0) > 1.05 || peak > 16) return "dirt";
        }
        const cliff = editCliffs.length ? cliffDist(x, z) : 1e9;
        if (cliff < CLIFF_FOOT + 4 && roadDist(x, z) > 24) {
            if ((rise || 0) > 2.5 && cliff < CLIFF_FOOT - 4) return "rock";
            if (cliff < CLIFF_TOP - 1.5) return "grass";
            const scree = (cliff - (CLIFF_FOOT - 5)) / 9;
            if (scree < 0) return "rock";
            if (scree < 1) return fbm(x * 0.11 + 2, z * 0.11 + 5) + scree * 0.6 < 0.72 ? "rock" : "grass";
        }
        const painted = editGround.length ? paintedGround(x, z) : null;
        if (painted && (rise || 0) <= 6.5 && trackDist(x, z) >= 14 && pathDist(x, z) >= 5) return paintedSurface(painted, x, z);
        if ((rise || 0) > 6.5 || (h > 24 && (rise || 0) > 2.5)) return "rock";
        const stone = stoneDist(x, z);
        if (stone < 4.5) return "dirt";
        if (trackDist(x, z) < 14 || pathDist(x, z) < 3.5 || inField(x, z)) return "dirt";
        const er = editRiverInfo(x, z);
        if (er && er.d < er.w * 1.1 && er.d > er.w * 0.3) {
            const n = fbm(x * 0.05 + 1, z * 0.05);
            if (n > 0.68) return n > 0.82 ? "rock" : "dirt";
        }
        const coast = coastField(x, z);
        if (h < 1.15 && coast < 0.2) return "sand";
        return "grass";
    }

    function woodRoom(x, z) {
        const h = heightAt(x, z);
        if (h < 0.35 || h > 26 || wet(x, z) || roadDist(x, z) < 16) return false;
        if (inField(x, z) || nearEditRock(x, z, 4)) return false;
        if (x >= peakBox.minX && x <= peakBox.maxX && z >= peakBox.minZ && z <= peakBox.maxZ) return false;
        for (const place of places) {
            if (Math.hypot(x - place.x, z - place.z) < 168) return false;
        }
        for (const trail of fishTrail) {
            if (chainDist(x, z, trail) < 18) return false;
        }
        return true;
    }

    function woodBlob(x, z, cx, cz, rx, rz, salt) {
        const n = fbm(x * 0.00235 + salt, z * 0.00235);
        return ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 + (n - 0.5) * 0.66;
    }

    function forestAt(x, z) {
        if (x > 520 && z < -680) return 0;
        if (x > 400 && z > 1080 && z < 1520) return 0;
        if (!woodRoom(x, z)) return 0;
        let thick = 0;
        const west = woodBlob(x, z, -1760, -80, 520, 680, 2.2);
        if (west < 1.06) thick = Math.max(thick, smooth(1.06, 0.2, west));
        let mid = 0;
        const heart = woodBlob(x, z, 160, 40, 440, 380, 11);
        if (heart < 1.04) mid = smooth(1.04, 0.24, heart);
        thick = Math.max(thick, mid);
        const south = woodBlob(x, z, -80, 1780, 280, 250, 19);
        if (south < 1) thick = Math.max(thick, smooth(1, 0.28, south));
        else if (south < 1.62) thick = Math.max(thick, 0.2 * (1 - smooth(1.02, 1.62, south)));
        if (thick <= 0) return 0;
        const clear = fbm(x * 0.0048 + 4.2, z * 0.0044);
        if (thick > 0.34 && clear > 0.8) thick *= 0.06;
        else if (thick > 0.34 && clear > 0.7) thick *= 0.38;
        return thick;
    }

    function buildTrees() {
        const trees = [];
        const seen = [];
        const plant = (x, z, thick, gap) => {
            if (trees.length > 4200) return;
            const minD = gap || (thick > 0.62 ? 10 : 16);
            for (let i = 0; i < seen.length; i++) {
                const dx = seen[i].x - x;
                const dz = seen[i].z - z;
                if (dx * dx + dz * dz < minD * minD) return;
            }
            const roll = hash(Math.floor(x * 2) + 3, Math.floor(z * 2) + 1);
            let kind = "oak";
            if (thick < 0.3 && roll > 0.62) kind = "bush";
            else if (hash(Math.floor(x) + 9, Math.floor(z)) > (thick > 0.55 ? 0.74 : 0.6)) kind = "pine";
            const spot = { x: x, z: z, kind: kind };
            trees.push(spot);
            seen.push(spot);
        };
        for (const place of places) {
            for (let i = 0; i < 16; i++) {
                const ang = hash(i, place.x) * Math.PI * 2;
                const dist = 108 + hash(i + 4, place.z) * 52;
                const x = place.x + Math.cos(ang) * dist;
                const z = place.z + Math.sin(ang) * dist;
                if (heightAt(x, z) < 0.3 || wet(x, z) || roadDist(x, z) < 12 || inField(x, z)) continue;
                if (Math.hypot(x - place.x, z - place.z) < 96) continue;
                plant(x, z, 0.2, 14);
            }
        }
        const scatter = (x0, x1, z0, z1, step) => {
            for (let x = x0; x <= x1; x += step) {
                for (let z = z0; z <= z1; z += step) {
                    const jx = x + (hash(x, z) - 0.5) * step * 0.9;
                    const jz = z + (hash(x + 11, z + 7) - 0.5) * step * 0.9;
                    const thick = forestAt(jx, jz);
                    if (thick < 0.08) continue;
                    const chance = thick > 0.58 ? 0.96 : thick > 0.3 ? 0.68 : 0.42;
                    if (hash(Math.floor(jx), Math.floor(jz) + 4) > chance) continue;
                    plant(jx, jz, thick);
                }
            }
        };
        scatter(-2420, -1100, -900, 780, 22);
        scatter(-480, 780, -520, 640, 22);
        scatter(-560, 460, 1380, 2160, 22);
        const heart = (x0, x1, z0, z1) => {
            for (let x = x0; x <= x1; x += 11) {
                for (let z = z0; z <= z1; z += 11) {
                    const jx = x + (hash(x + 2, z + 5) - 0.5) * 9;
                    const jz = z + (hash(x + 8, z + 3) - 0.5) * 9;
                    const thick = forestAt(jx, jz);
                    if (thick < 0.72) continue;
                    if (hash(Math.floor(jx) + 2, Math.floor(jz)) > 0.9) continue;
                    plant(jx, jz, thick);
                }
            }
        };
        heart(-360, 240, 1520, 2040);
        heart(-280, 620, -360, 480);
        heart(-2300, -1200, -760, 640);
        return trees;
    }

    const trees = buildTrees();

    function plantEditWoods() {
        const made = [];
        const add = (x, z) => {
            for (const tree of trees) {
                if (Math.abs(tree.x - x) < 4 && Math.abs(tree.z - z) < 4) return;
            }
            const kind = hash(Math.floor(x) + 11, Math.floor(z) + 4) < 0.6 ? "pine" : "oak";
            made.push({ x, z, kind, edit: true });
        };
        const step = 9;
        // Forest pieces painted over each other thicken the wood: each one covering a cell adds a tree, up to three.
        const cover = new Map();
        for (const [fx, fz, r] of edit.forests || []) {
            for (let ix = Math.floor((fx - r) / step); ix <= Math.ceil((fx + r) / step); ix++) {
                for (let iz = Math.floor((fz - r) / step); iz <= Math.ceil((fz + r) / step); iz++) {
                    const x = ix * step + (hash(ix + 71, iz + 3) - 0.5) * step * 0.8;
                    const z = iz * step + (hash(ix + 5, iz + 83) - 0.5) * step * 0.8;
                    const d = Math.hypot(x - fx, z - fz);
                    if (d > r) continue;
                    const key = ix + "," + iz;
                    const cell = cover.get(key) || { ix, iz, x, z, n: 0, edge: true };
                    cell.n += 1;
                    if (d <= r * 0.75) cell.edge = false;
                    cover.set(key, cell);
                }
            }
        }
        const layers = [[0, 0], [0.5, 0.5], [0.5, 0]];
        for (const { ix, iz, x, z, n, edge } of cover.values()) {
            for (let k = 0; k < Math.min(3, n); k++) {
                if (hash(ix + 19 + k * 37, iz + 61) > (edge ? 0.5 : 0.88)) continue;
                const tx = k ? ix * step + (layers[k][0] + (hash(ix + 7 * k, iz + 29) - 0.5) * 0.4) * step : x;
                const tz = k ? iz * step + (layers[k][1] + (hash(ix + 41, iz + 13 * k) - 0.5) * 0.4) * step : z;
                if (woodRoom(tx, tz)) add(tx, tz);
            }
        }
        for (const [x, z] of edit.trees || []) {
            if (heightAt(x, z) > 0.3 && !wet(x, z)) add(x, z);
        }
        for (const tree of made) trees.push(tree);
    }
    plantEditWoods();

    const groveSpecs = [
        { x: -1720, z: -860, r: 18, count: 28, pine: 0.85 },
        { x: -1680, z: -1240, r: 14, count: 16, pine: 0.9 },
        { x: -1200, z: -760, r: 22, count: 36, pine: 0.55 },
        { x: -2680, z: 400, r: 20, count: 32, pine: 0.75 },
        { x: -2700, z: 900, r: 15, count: 18, pine: 0.8 },
        { x: 520, z: 1180, r: 16, count: 22, pine: 0.4 },
        { x: 980, z: 1100, r: 18, count: 26, pine: 0.75 },
        { x: 1100, z: 1500, r: 14, count: 16, pine: 0.9 },
        { x: 980, z: -1300, r: 16, count: 22, pine: 0.8 }
    ];

    function groveClear(x, z) {
        const h = heightAt(x, z);
        if (h < 0.4 || h > 12 || wet(x, z) || roadDist(x, z) < 28 || inField(x, z)) return false;
        for (const place of places) {
            if (Math.hypot(x - place.x, z - place.z) < 150) return false;
        }
        for (const trail of fishTrail) {
            if (chainDist(x, z, trail) < 22) return false;
        }
        return true;
    }

    function plantGroves() {
        const spots = [];
        for (const grove of groveSpecs) {
            const local = [];
            let guard = 0;
            let i = 1;
            while (local.length < grove.count && guard < grove.count * 24) {
                guard++;
                const n1 = hash(Math.floor(grove.x) + i * 19, Math.floor(grove.z) + 3);
                const n2 = hash(Math.floor(grove.x) + 5, Math.floor(grove.z) + i * 23);
                i++;
                const ang = n1 * Math.PI * 2;
                const dist = Math.sqrt(n2) * grove.r;
                const x = grove.x + Math.cos(ang) * dist;
                const z = grove.z + Math.sin(ang) * dist;
                if (!groveClear(x, z)) continue;
                let close = false;
                for (const spot of local) {
                    if (Math.hypot(spot.x - x, spot.z - z) < 3.05) close = true;
                }
                if (!close) {
                    for (const tree of trees) {
                        if ((tree.kind === "pine" || tree.kind === "oak") && Math.hypot(tree.x - x, tree.z - z) < 5) close = true;
                    }
                }
                if (close) continue;
                const pine = hash(Math.floor(x) + 11, Math.floor(z) + 4) < grove.pine;
                local.push({ x, z, kind: pine ? "pine" : "oak" });
            }
            for (const spot of local) spots.push(spot);
        }
        return spots;
    }

    const groves = plantGroves();

    function keepLevel(x, z, w, d) {
        shelves.push({ x: x, z: z, w: w, d: d, y: heightAt(x + w * 0.5, z + d * 0.5) });
    }
    for (const field of fields) keepLevel(field.x - 6, field.z - 6, field.w + 12, field.d + 12);
    keepLevel(-1516, -860, 86, 64);
    keepLevel(1264, -1482, 84, 64);
    keepLevel(-2420, 748, 130, 108);
    keepLevel(584, 1382, 112, 96);
    countryOn = true;
    keepLevel(-2016, 468, 32, 24);

    const cliffs = [
        [[-1900, -720], [-1820, -680], [-1740, -700]],
        [[-2360, 300], [-2280, 340], [-2200, 300]],
        [[560, 980], [640, 940], [720, 990]],
        [[-900, 180], [-820, 240], [-740, 200]],
        [[200, 600], [280, 660], [360, 600]],
        [[1520, -1460], [1600, -1400], [1680, -1460]]
    ];

    function cottageNap(x, z, w, d, facing, y) {
        const midX = x + w / 2;
        const midZ = z + d / 2;
        if (facing === "south") {
            return [
                { x: midX, z: z + d + 1.15, y: y },
                { x: midX, z: z + d - 0.75, y: y },
                { x: midX, z: z + 0.7, y: y }
            ];
        }
        if (facing === "north") {
            return [
                { x: midX, z: z - 1.15, y: y },
                { x: midX, z: z + 0.75, y: y },
                { x: midX, z: z + d - 0.7, y: y }
            ];
        }
        if (facing === "east") {
            return [
                { x: x + w + 1.15, z: midZ, y: y },
                { x: x + w - 0.75, z: midZ, y: y },
                { x: x + 0.7, z: midZ, y: y }
            ];
        }
        return [
            { x: x - 1.15, z: midZ, y: y },
            { x: x + 0.75, z: midZ, y: y },
            { x: x + w - 0.7, z: midZ, y: y }
        ];
    }

    function cottagePark(x, z, w, d, facing) {
        if (facing === "south") return { x: x + w + 0.8, z: z + d - 0.4 };
        if (facing === "north") return { x: x - 2.2, z: z + 0.2 };
        if (facing === "east") return { x: x + w - 0.4, z: z - 2.1 };
        return { x: x + 0.2, z: z + d + 0.8 };
    }

    function cottageLayout(village) {
        const trail = fishTrail[village];
        const shore = trail[trail.length - 1];
        const home = places[village];
        const dx = home.x - shore[0];
        const dz = home.z - shore[1];
        const len = Math.hypot(dx, dz) || 1;
        let x = shore[0] + (dx / len) * 26;
        let z = shore[1] + (dz / len) * 26;
        for (let dist = 14; dist <= 72; dist += 4) {
            const px = shore[0] + (dx / len) * dist;
            const pz = shore[1] + (dz / len) * dist;
            const h = heightAt(px, pz);
            if (!wet(px, pz) && h >= 0.16 && h < 6) {
                x = px;
                z = pz;
                break;
            }
        }
        const sx = shore[0] - x;
        const sz = shore[1] - z;
        const facing = Math.abs(sx) > Math.abs(sz) ? (sx > 0 ? "east" : "west") : (sz > 0 ? "south" : "north");
        const w = 4.4;
        const d = 3.6;
        const ox = x - w / 2;
        const oz = z - d / 2;
        const ground = Math.max(0, heightAt(x, z));
        return {
            x: ox,
            z: oz,
            w: w,
            d: d,
            facing: facing,
            ground: ground,
            cap: 8,
            nap: cottageNap(ox, oz, w, d, facing, ground),
            park: cottagePark(ox, oz, w, d, facing)
        };
    }

    function meadowClear(x, z) {
        const h = heightAt(x, z);
        if (h < 0.45 || h > 18 || wet(x, z)) return false;
        if (roadDist(x, z) < 16 || inField(x, z) || tooSteep(x, z) || nearEditRock(x, z, 4)) return false;
        if (forestAt(x, z) > 0.42) return false;
        for (let i = 0; i < places.length; i++) {
            const dx = x - places[i].x;
            const dz = z - places[i].z;
            if (dx * dx + dz * dz < 130 * 130) return false;
        }
        for (let i = 0; i < hamlets.length; i++) {
            if (Math.hypot(x - hamlets[i].x, z - hamlets[i].z) < 50) return false;
        }
        for (let i = 0; i < fishTrail.length; i++) {
            if (chainDist(x, z, fishTrail[i]) < 16) return false;
        }
        return true;
    }

    function meadowAt(ix, iz) {
        const step = 26;
        const x = ix * step + (hash(ix + 41, iz + 17) - 0.5) * 14;
        const z = iz * step + (hash(ix - 9, iz + 23) - 0.5) * 14;
        if (hash(ix + 5, iz - 3) > 0.97) return null;
        if (!meadowClear(x, z)) return null;
        const roll = hash(ix + 13, iz + 29);
        let kind = "rock";
        if (roll < 0.38) kind = "pine";
        else if (roll < 0.72) kind = "oak";
        else if (roll < 0.88) kind = "bush";
        return { x: x, z: z, kind: kind, ix: ix, iz: iz, roll: roll };
    }

    function meadowNear(x, z, reach) {
        const step = 26;
        const list = [];
        const i0 = Math.floor((x - reach) / step);
        const i1 = Math.floor((x + reach) / step);
        const k0 = Math.floor((z - reach) / step);
        const k1 = Math.floor((z + reach) / step);
        const r2 = reach * reach;
        for (let ix = i0; ix <= i1; ix++) {
            for (let iz = k0; iz <= k1; iz++) {
                const spot = meadowAt(ix, iz);
                if (!spot) continue;
                const dx = spot.x - x;
                const dz = spot.z - z;
                if (dx * dx + dz * dz > r2) continue;
                list.push(spot);
            }
        }
        return list;
    }

    loaded = true;
    return {
        places,
        hamlets,
        links,
        fields,
        fishTrail,
        trees,
        groves,
        cliffs,
        peakBox,
        peakPass,
        tooSteep,
        waterways: editRivers,
        stoneRoads: editRoads,
        bridgeList,
        bridgeDeck,
        bridgeWall,
        deckY,
        heightAt,
        bareHeight,
        setPads,
        onPad,
        waterLevel,
        wet,
        nearRiver,
        roadDist,
        groundKind,
        turfShade,
        inField,
        forestAt,
        trackOf,
        coastField,
        cottageLayout,
        meadowAt,
        meadowNear,
        pathDist,
        cliffDist,
        paintedNear,
        editRocks: edit.rocks,
        // Ore placed on the editor map, [x, z]: where mine workers dig stone and gold.
        ores: edit.ores || [],
        wildSpots,
        cliffRocks,
        groundStones
    };
});
