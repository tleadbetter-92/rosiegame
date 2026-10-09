(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.World = api;
})(typeof self !== "undefined" ? self : this, function () {
    const places = [
        { x: -1480, z: -980, ox: -1480, oz: -980 },
        { x: 1220, z: -1560, ox: 1220, oz: -1560 },
        { x: -2480, z: 620, ox: -2480, oz: 620 },
        { x: 780, z: 1320, ox: 780, oz: 1320 }
    ];
    const links = [[1, 2], [0, 3], [0, 3], [1, 2]];

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

    const fords = [[-180, -180], [-980, 520], [1760, 2480]];

    function nearFord(x, z) {
        for (const ford of fords) {
            if (Math.hypot(x - ford[0], z - ford[1]) < 46) return true;
        }
        return false;
    }

    function lakeField(x, z) {
        const dx = (x - lake.x) / lake.rx;
        const dz = (z - lake.z) / lake.rz;
        return 1 - (dx * dx + dz * dz);
    }

    function carve(x, z, h) {
        const rw = 16 + fbm(x * 0.002, z * 0.002) * 22;
        const rd = chainDist(x, z, river);
        if (rd < rw) {
            const u = 1 - rd / rw;
            const depth = nearFord(x, z) ? 0.55 : Math.min(h + 2.2, 5.4);
            h -= u * u * depth;
        }
        const bw = 8 + fbm(x * 0.003 + 3, z * 0.003) * 6;
        const bd = chainDist(x, z, brook);
        if (bd < bw) {
            const u = 1 - bd / bw;
            h -= u * u * (nearFord(x, z) ? 0.35 : Math.min(2.8, h * 0.35 + 1.2));
        }
        const lf = lakeField(x, z);
        if (lf > 0) h -= lf * lf * 6.5;
        const ow = 14 + fbm(x * 0.002 + 8, z * 0.002) * 10;
        const od = chainDist(x, z, outlet);
        if (od < ow) {
            const u = 1 - od / ow;
            h -= u * u * (nearFord(x, z) ? 0.4 : Math.min(h + 1.5, 4.2));
        }
        return h;
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

    function roadDist(x, z) {
        let best = 1e9;
        for (const key of Object.keys(tracks)) {
            if (key[0] > key[2]) continue;
            best = Math.min(best, chainDist(x, z, tracks[key]));
        }
        return best;
    }

    function heightAt(x, z) {
        const field = coastField(x, z);
        if (field < -0.2) return -8 + field * 10;
        const shore = smooth(-0.04, 0.16, field);
        let h = shore * (1.4 + hills(x, z));
        h += mountains(x, z) * shore;
        if (field < 0.08) h = Math.min(h, smooth(-0.04, 0.08, field) * 1.6);
        else h = Math.max(h, shore * 0.7);
        h = carve(x, z, h);
        const rd = roadDist(x, z);
        if (rd < 18 && h > 0.4) {
            const pull = 1 - rd / 18;
            h = h * (1 - pull * 0.82) + 0.35 * pull * 0.82;
        }
        let pad = 1;
        for (const place of places) {
            const d = Math.hypot(x - place.x, z - place.z);
            pad = Math.min(pad, smooth(62, 150, d));
        }
        return h * pad;
    }

    function waterLevel(x, z) {
        const h = heightAt(x, z);
        if (h < -0.08) return 0.03;
        const stream = Math.min(chainDist(x, z, river), chainDist(x, z, brook), chainDist(x, z, outlet));
        if (stream < 7 && h > 0.6 && !nearFord(x, z)) return h + 0.22;
        if (lakeField(x, z) > 0.08 && h < 0.2) return 0.03;
        return null;
    }

    function wet(x, z) {
        const h = heightAt(x, z);
        const level = waterLevel(x, z);
        if (h < -0.05) return true;
        if (level != null && level <= 0.05 && h < 0.14) return true;
        if (level != null && level > 0.5) {
            const stream = Math.min(chainDist(x, z, river), chainDist(x, z, brook), chainDist(x, z, outlet));
            if (stream < 4.5 && !nearFord(x, z)) return true;
        }
        return false;
    }

    const fishTrail = [
        [[-1480, -1400], [-1460, -1800], [-1500, -2140], [-1480, -2420]],
        [[1280, -1360], [1500, -1180], [2000, -1200], [2500, -1220], [2820, -1240]],
        [[-2700, 640], [-2940, 660], [-3180, 620], [-3280, 600]],
        [[780, 1680], [760, 2060], [780, 2440], [800, 2620]]
    ];

    const fields = [
        { x: -1680, z: -1160, w: 180, d: 90 },
        { x: -1320, z: -1180, w: 140, d: 70 },
        { x: -1700, z: -780, w: 160, d: 80 }
    ];

    function inField(x, z) {
        for (const field of fields) {
            if (x > field.x && x < field.x + field.w && z > field.z && z < field.z + field.d) return true;
        }
        return false;
    }

    function groundKind(x, z, rise) {
        const h = heightAt(x, z);
        if ((rise || 0) > 6.5 || h > 24) return "rock";
        if (roadDist(x, z) < 14 || inField(x, z)) return "dirt";
        const coast = coastField(x, z);
        const watery = coast < 0.22 || lakeField(x, z) > -0.22 || chainDist(x, z, river) < 30 || chainDist(x, z, outlet) < 28;
        if (h < 1.4 && watery) return "sand";
        if (lakeField(x, z) > -0.55 && h < 2.2) return "dirt";
        return "grass";
    }

    function forestAt(x, z) {
        const h = heightAt(x, z);
        if (h < 0.4 || h > 28 || wet(x, z) || roadDist(x, z) < 10) return 0;
        for (const place of places) {
            if (Math.hypot(x - place.x, z - place.z) < 78) return 0;
        }
        const eastWood = Math.exp(-((x + 500) ** 2) / (980 ** 2) - ((z + 1200) ** 2) / (520 ** 2));
        const swWood = Math.exp(-((x + 1600) ** 2) / (780 ** 2) - ((z - 280) ** 2) / (700 ** 2));
        const central = Math.exp(-((x + 40) ** 2) / (700 ** 2) - ((z + 40) ** 2) / (560 ** 2));
        const sePatch = Math.exp(-((x - 200) ** 2) / (380 ** 2) - ((z - 980) ** 2) / (300 ** 2));
        const pines = h > 12 ? 0.35 : 0;
        return Math.max(eastWood, swWood * 0.95, central * 0.55, sePatch * 0.7, pines);
    }

    function buildTrees() {
        const trees = [];
        const seen = [];
        const consider = (x, z, thick) => {
            if (trees.length > 1100) return;
            const n = hash(Math.floor(x), Math.floor(z));
            if (n > thick) return;
            const jx = x + (hash(Math.floor(x) + 3, Math.floor(z)) - 0.5) * 16;
            const jz = z + (hash(Math.floor(x), Math.floor(z) + 7) - 0.5) * 16;
            if (thick < 0.8 && forestAt(jx, jz) < 0.22) return;
            if (heightAt(jx, jz) < 0.25 || wet(jx, jz)) return;
            for (const spot of seen) {
                if (Math.hypot(spot.x - jx, spot.z - jz) < 14) return;
            }
            const pine = heightAt(jx, jz) > 10 || hash(Math.floor(jx) + 9, Math.floor(jz)) > 0.62;
            const roll = hash(Math.floor(jx) + 1, Math.floor(jz) + 1);
            const kind = roll < 0.72 ? (pine ? "pine" : "oak") : roll < 0.86 ? "bush" : "rock";
            const spot = { x: jx, z: jz, kind };
            trees.push(spot);
            seen.push(spot);
        };
        for (const place of places) {
            for (let i = 0; i < 18; i++) {
                const ang = hash(i, place.x) * Math.PI * 2;
                const dist = 120 + hash(i + 4, place.z) * 70;
                consider(place.x + Math.cos(ang) * dist, place.z + Math.sin(ang) * dist, 0.98);
            }
        }
        for (let x = -2500; x <= 2400; x += 34) {
            for (let z = -2400; z <= 2300; z += 34) consider(x, z, forestAt(x, z));
        }
        return trees;
    }

    const trees = buildTrees();

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

    return {
        places,
        links,
        fields,
        fishTrail,
        trees,
        waterways: [river, brook, outlet],
        heightAt,
        waterLevel,
        wet,
        roadDist,
        groundKind,
        inField,
        forestAt,
        trackOf,
        coastField,
        cottageLayout
    };
});
