(function (root, factory) {
    const world = typeof World !== "undefined" ? World : require("./world");
    const api = factory(world);
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.Town = api;
})(typeof self !== "undefined" ? self : this, function (World) {
    const MESH = {
        house: { w: 4.7, d: 4.7 },
        tall: { w: 4.7, d: 4.7 },
        shop: { w: 4.7, d: 4.7 },
        brick: { w: 4.7, d: 4.7 },
        long: { w: 4.7, d: 6.7 },
        grand: { w: 4.7, d: 6.7 }
    };
    const TYPES = [
        "grand", "grand", "grand",
        "shop", "shop", "long", "long",
        "brick", "shop", "grand", "long", "shop", "brick", "shop", "long", "grand", "brick",
        "house", "tall", "house", "tall", "house", "house", "tall", "house",
        "house", "tall", "house", "house", "tall", "house", "tall", "house",
        "house", "house", "tall", "house", "house", "tall", "house"
    ];
    const LINES = {
        0: [
            [[0, -30], [0, -74]],
            [[24, -4], [74, 6]],
            [[-24, -4], [-72, -18]],
            [[0, 18], [8, 70]],
            [[-24, -4], [-48, -30], [-66, -8]],
            [[-42, -38], [-42, 10]],
            [[24, 12], [52, 36], [28, 60]],
            [[-8, -52], [30, -60], [54, -36]],
            [[-16, 26], [18, 42], [42, 24]],
            [[-68, -42], [-36, -70], [8, -72]]
        ],
        1: [
            [[0, -28], [-6, -74]],
            [[-24, -4], [-76, -8]],
            [[22, -4], [50, -4]],
            [[0, 18], [2, 72]],
            [[-18, 36], [22, 46], [40, 24]],
            [[-28, 16], [-52, 44]],
            [[22, -4], [42, -38], [18, -62]],
            [[-12, -48], [20, -40], [36, -16]],
            [[-44, -22], [-24, 18]],
            [[-70, -36], [-36, -68], [12, -70]]
        ],
        2: [
            [[0, -28], [0, -76]],
            [[-24, -4], [-76, -2]],
            [[22, -4], [76, -10]],
            [[0, 18], [0, 130]],
            [[0, -46], [-38, -64], [-64, -36]],
            [[22, -4], [48, -32], [70, -16]],
            [[42, -46], [68, -42]],
            [[-24, 10], [-52, 30], [-30, 56]],
            [[-10, -52], [22, -60], [48, -46]],
            [[16, 22], [44, 36], [22, 58]]
        ],
        3: [
            [[0, -28], [2, -76]],
            [[-24, -4], [-76, 4]],
            [[22, -4], [72, -14]],
            [[0, 18], [0, 54]],
            [[-20, -42], [18, -56], [40, -34]],
            [[22, 14], [54, 30], [30, 54]],
            [[-30, 10], [-56, 32]],
            [[-10, -24], [26, -22], [22, 12]],
            [[-18, 22], [12, 40], [36, 22]],
            [[40, -52], [66, -18], [46, 18]],
            [[-62, 18], [-38, 50]]
        ]
    };
    const MARKET = {
        0: [-48, -16],
        1: [6, 48],
        2: [52, -30],
        3: [2, -58]
    };

    function hash(i, j) {
        let n = Math.imul(i + 19, 374761393) + Math.imul(j + 7, 668265263);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    }

    function segDist(x, z, a, b) {
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const len = dx * dx + dz * dz || 1;
        let t = ((x - a[0]) * dx + (z - a[1]) * dz) / len;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
    }

    function lineDist(x, z, lines) {
        let best = 1e9;
        for (const line of lines) {
            for (let i = 1; i < line.length; i++) best = Math.min(best, segDist(x, z, line[i - 1], line[i]));
        }
        return best;
    }

    function faceYaw(sx, sz) {
        if (Math.abs(sx) > Math.abs(sz)) return sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        return sz > 0 ? Math.PI : 0;
    }

    function keepBox(place) {
        return {
            x: place.x - 0.5 - 20,
            z: place.z - 4 - 20,
            w: 40,
            d: 40
        };
    }

    function gateCorridors(place) {
        const cx = place.x - 0.5;
        const cz = place.z - 4;
        const reach = 86;
        return [
            { x: cx - 2.5, z: cz - 17 - reach, w: 5, d: reach },
            { x: cx + 17, z: cz - 2.5, w: reach, d: 5 },
            { x: cx - 2.5, z: cz + 17, w: 5, d: reach },
            { x: cx - 17 - reach, z: cz - 2.5, w: reach, d: 5 }
        ];
    }

    function hits(a, b, pad) {
        return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.z < b.z + b.d + pad && a.z + a.d > b.z - pad;
    }

    function slotsFor(lines) {
        const slots = [];
        for (const line of lines) {
            for (let i = 1; i < line.length; i++) {
                const a = line[i - 1];
                const b = line[i];
                const dx = b[0] - a[0];
                const dz = b[1] - a[1];
                const len = Math.hypot(dx, dz) || 1;
                const ux = dx / len;
                const uz = dz / len;
                const lx = -uz;
                const lz = ux;
                for (let t = 4.2; t < len - 3; t += 6.6) {
                    slots.push({
                        px: a[0] + ux * t,
                        pz: a[1] + uz * t,
                        lx: lx,
                        lz: lz
                    });
                }
            }
        }
        return slots;
    }

    function clearance(place, village) {
        const lines = [];
        const home = { x: place.x, z: place.z };
        for (const other of World.links[village]) {
            const track = World.trackOf(village, other);
            if (!track.length) continue;
            lines.push([home, track[0]]);
        }
        const fish = World.fishTrail[village];
        if (fish && fish.length) lines.push([home, fish[0]]);
        return lines;
    }

    function buildVillage(village) {
        const place = World.places[village];
        const lines = LINES[village].map((line) => line.map((p) => [p[0] + place.x, p[1] + place.z]));
        const market = [MARKET[village][0] + place.x, MARKET[village][1] + place.z];
        const keep = keepBox(place);
        const corridors = gateCorridors(place);
        const paths = clearance(place, village);
        const placed = [];
        const why = {};
        const note = (key) => { why[key] = (why[key] || 0) + 1; };
        const slots = slotsFor(lines);
        slots.sort((a, b) => {
            const da = Math.hypot(a.px - market[0], a.pz - market[1]);
            const db = Math.hypot(b.px - market[0], b.pz - market[1]);
            return da - db;
        });
        let index = 0;
        for (const mesh of TYPES) {
            const size = MESH[mesh];
            let found = false;
            while (index < slots.length) {
                const slot = slots[index++];
                const side = hash(index, village + 3) > 0.5 ? 1 : -1;
                const off = 3.3 + size.d / 2;
                const cx = slot.px + slot.lx * side * off;
                const cz = slot.pz + slot.lz * side * off;
                if (Math.hypot(cx - place.x, cz - place.z) > 84) { note("far"); continue; }
                const sx = slot.px - cx;
                const sz = slot.pz - cz;
                const yaw = faceYaw(sx, sz);
                const swap = Math.abs(Math.abs(yaw) - Math.PI / 2) < 0.01;
                const bw = swap ? size.d : size.w;
                const bd = swap ? size.w : size.d;
                const box = { x: cx - bw / 2, z: cz - bd / 2, w: bw, d: bd };
                if (hits(box, keep, 1.5)) { note("keep"); continue; }
                if (corridors.some((lane) => hits(box, lane, 0))) { note("gate"); continue; }
                if (lineDist(cx, cz, lines) < size.d / 2 + 2.5) { note("street"); continue; }
                if (paths.some((line) => segDist(cx, cz, line[0], line[1]) < size.d / 2 + 2.4)) { note("path"); continue; }
                if (placed.some((other) => hits(box, other, 1.1))) { note("busy"); continue; }
                if (World.wet(cx, cz) || World.heightAt(cx, cz) > 2.2 || World.heightAt(cx, cz) < -0.2) { note("land"); continue; }
                placed.push({
                    x: cx,
                    z: cz,
                    yaw: yaw,
                    mesh: mesh,
                    w: bw,
                    d: bd,
                    minX: box.x,
                    minZ: box.z,
                    village: village
                });
                found = true;
                break;
            }
            if (!found) placed.push(null);
        }
        return { buildings: placed.filter(Boolean), lines: lines, why: why, slots: slots.length };
    }

    const towns = [0, 1, 2, 3].map(buildVillage);
    const buildings = towns.reduce((all, town) => all.concat(town.buildings), []);
    const streets = towns.reduce((all, town) => all.concat(town.lines), []);

    function kitBuilding(village, mesh, x, z, yaw, role) {
        const size = MESH[mesh];
        const swap = Math.abs(Math.abs(yaw) - Math.PI / 2) < 0.01;
        const w = swap ? size.d : size.w;
        const d = swap ? size.w : size.d;
        return {
            x: x,
            z: z,
            y: Math.max(0, World.heightAt(x, z)),
            yaw: yaw,
            mesh: mesh,
            role: role,
            w: w,
            d: d,
            minX: x - w / 2,
            minZ: z - d / 2,
            village: village,
            doorSide: 1
        };
    }

    function timberBuilding(village, role, x, z, w, d, yaw, entrance) {
        return {
            x: x,
            z: z,
            y: Math.max(0, World.heightAt(x, z)),
            yaw: yaw,
            mesh: role,
            role: role,
            entrance: entrance,
            w: w,
            d: d,
            minX: x - w / 2,
            minZ: z - d / 2,
            village: village,
            doorSide: 0
        };
    }

    const farms = [
        {
            village: 0,
            name: "northwest",
            buildings: [
                kitBuilding(0, "house", -1476, -834, 0, "farmhouse"),
                timberBuilding(0, "shed", -1454, -820, 3, 2.4, Math.PI, "south")
            ],
            yard: { x: -1504, z: -848, w: 58, d: 34, gap: { side: "east", at: -830, width: 2.4 } },
            pen: { x: -1442, z: -846, w: 4.4, d: 3.6, gap: { side: "west", at: -844.2, width: 1.4 } },
            garden: { x: -1498, z: -808, w: 6.5, d: 4 },
            orchard: [],
            hay: [[-1462, -828]],
            cart: [[-1436, -832]],
            props: [
                { name: "Barrel", x: -1466, z: -828, yaw: 0.4 },
                { name: "Crate_Wooden", x: -1486, z: -826, yaw: 0.7 },
                { name: "FarmCrate_Apple", x: -1490, z: -804, yaw: 0.2 }
            ],
            tracks: [[[-1446, -830], [-1444, -830], [-1444, -896], [-1486, -910]]]
        },
        {
            village: 1,
            name: "northeast",
            buildings: [
                kitBuilding(1, "house", 1296, -1454, Math.PI, "farmhouse"),
                timberBuilding(1, "shed", 1318, -1448, 3, 2.4, Math.PI / 2, "west")
            ],
            yard: { x: 1278, z: -1468, w: 56, d: 36, gap: { side: "south", at: 1296, width: 2.4 } },
            pen: { x: 1262, z: -1456, w: 4.2, d: 3.4, gap: { side: "east", at: -1454.3, width: 1.3 } },
            garden: { x: 1324, z: -1464, w: 6, d: 4 },
            orchard: [],
            hay: [[1306, -1460]],
            cart: [[1284, -1428]],
            props: [
                { name: "Barrel", x: 1306, z: -1462, yaw: 0.5 },
                { name: "Crate_Wooden", x: 1288, z: -1460, yaw: 0.3 },
                { name: "Pot_1", x: 1312, z: -1456, yaw: 0.8 }
            ],
            tracks: [[[1296, -1432], [1296, -1436], [1164, -1436]]]
        },
        {
            village: 2,
            name: "southwest",
            buildings: [
                kitBuilding(2, "tall", -2366, 770, Math.PI / 2, "farmhouse"),
                timberBuilding(2, "barn", -2356, 792, 6.6, 4.2, 0, "north"),
                timberBuilding(2, "shed", -2386, 780, 3.2, 2.6, -Math.PI / 2, "east")
            ],
            yard: { x: -2406, z: 762, w: 96, d: 42, gap: { side: "north", at: -2372, width: 2.8 } },
            pen: { x: -2396, z: 746, w: 5.2, d: 4.4, gap: { side: "south", at: -2393.4, width: 1.6 } },
            garden: { x: -2334, z: 768, w: 8, d: 6 },
            orchard: [[-2382, 818], [-2368, 826], [-2354, 818], [-2340, 826]],
            hay: [[-2348, 786]],
            cart: [[-2374, 752]],
            props: [
                { name: "Barrel", x: -2350, z: 786, yaw: 0.4 },
                { name: "Barrel", x: -2344, z: 788, yaw: 1.2 },
                { name: "Crate_Wooden", x: -2378, z: 786, yaw: 0.3 },
                { name: "FarmCrate_Apple", x: -2342, z: 778, yaw: 0.6 },
                { name: "Bag", x: -2358, z: 784, yaw: 0.2 },
                { name: "Workbench", x: -2388, z: 796, yaw: 0 },
                { name: "Bench", x: -2366, z: 778, yaw: Math.PI / 2 }
            ],
            tracks: [
                [[-2372, 762], [-2372, 754], [-2482, 754], [-2482, 718]],
                [[-2405, 762], [-2405, 804]]
            ]
        },
        {
            village: 3,
            name: "southeast",
            buildings: [
                kitBuilding(3, "house", 636, 1410, -Math.PI / 2, "farmhouse"),
                timberBuilding(3, "barn", 658, 1434, 5.4, 3.6, 0, "north"),
                timberBuilding(3, "shed", 612, 1424, 3, 2.4, -Math.PI / 2, "east")
            ],
            yard: { x: 598, z: 1396, w: 82, d: 52, gap: { side: "east", at: 1412, width: 2.6 } },
            pen: { x: 600, z: 1452, w: 4.6, d: 3.6, gap: { side: "north", at: 602.3, width: 1.4 } },
            garden: { x: 668, z: 1402, w: 7, d: 5 },
            orchard: [[670, 1456], [658, 1464], [682, 1460]],
            hay: [[646, 1422]],
            cart: [[688, 1412]],
            props: [
                { name: "Barrel", x: 650, z: 1426, yaw: 0.4 },
                { name: "Crate_Wooden", x: 642, z: 1428, yaw: 0.6 },
                { name: "FarmCrate_Apple", x: 672, z: 1408, yaw: 0.3 },
                { name: "Bag", x: 638, z: 1420, yaw: 1 },
                { name: "Bench", x: 628, z: 1418, yaw: 0 }
            ],
            tracks: [
                [[680, 1412], [692, 1412]],
                [[648, 1396], [724, 1366]]
            ]
        }
    ];
    for (const farm of farms) {
        for (const building of farm.buildings) buildings.push(building);
    }

    function kitDoor(b) {
        const s = Math.sin(b.yaw);
        const c = Math.cos(b.yaw);
        const fx = -s;
        const fz = -c;
        const half = (Math.abs(fx) > Math.abs(fz) ? b.w : b.d) * 0.5;
        const side = b.doorSide == null ? 1 : b.doorSide;
        const x = b.x + fx * (half - 0.06) - c * side;
        const z = b.z + fz * (half - 0.06) + s * side;
        return {
            door: { x: x, z: z },
            out: { x: x + fx * 1.2, z: z + fz * 1.2 },
            inn: { x: x - fx * 0.9, z: z - fz * 0.9 }
        };
    }

    function farmSites() {
        const sites = [];
        for (let i = 0; i < farms.length; i++) {
            const farm = farms[i];
            const house = farm.buildings.find((b) => b.role === "farmhouse");
            if (!house) continue;
            const door = kitDoor(house);
            const y = house.y || 0;
            const exits = [];
            for (const line of farm.tracks || []) {
                for (const point of line) exits.push({ x: point[0], z: point[1] });
            }
            sites.push({
                id: "farm-" + farm.village + "-" + i,
                village: farm.village,
                out: door.out,
                inn: door.inn,
                door: door.door,
                bed: { x: house.x, z: house.z, y: y },
                y: y,
                exits: exits,
                fields: []
            });
        }
        for (const field of World.fields) {
            const cx = field.x + field.w * 0.5;
            const cz = field.z + field.d * 0.5;
            let best = 0;
            let bestD = Infinity;
            for (let i = 0; i < sites.length; i++) {
                const dist = Math.hypot(cx - sites[i].bed.x, cz - sites[i].bed.z);
                if (dist < bestD) {
                    bestD = dist;
                    best = i;
                }
            }
            if (sites[best]) sites[best].fields.push({ x: field.x, z: field.z, w: field.w, d: field.d });
        }
        return sites;
    }

    function street(x, z) {
        if (lineDist(x, z, streets) > 3.1) return false;
        for (const place of World.places) {
            const cx = place.x - 0.5;
            const cz = place.z - 4;
            if (Math.abs(x - cx) < 16.5 && Math.abs(z - cz) < 16.5) return false;
        }
        return true;
    }

    function coverDist(x, z, line, accept) {
        let best = 1e9;
        for (let i = 1; i < line.length; i++) {
            const a = line[i - 1];
            const b = line[i];
            const dx = b[0] - a[0];
            const dz = b[1] - a[1];
            const len2 = dx * dx + dz * dz || 1;
            let t = ((x - a[0]) * dx + (z - a[1]) * dz) / len2;
            t = Math.max(0, Math.min(1, t));
            const px = a[0] + dx * t;
            const pz = a[1] + dz * t;
            if (accept && !accept(px, pz)) continue;
            best = Math.min(best, Math.hypot(x - px, z - pz));
        }
        return best;
    }

    function groundAt(x, z) {
        const place = World.places[2];
        if (Math.hypot(x - place.x, z - place.z) > 118) return null;
        const home = towns[2];
        const lines = home.lines;
        const cx = place.x - 0.5;
        const cz = place.z - 4;
        const n = hash(Math.floor(x), Math.floor(z * 1.7));
        const wobble = (n - 0.45) * 1.7;
        const gates = [
            [cx, cz - 17],
            [cx + 17, cz],
            [cx, cz + 17],
            [cx - 17, cz]
        ];
        let atGate = false;
        for (const gate of gates) {
            if (Math.hypot(x - gate[0], z - gate[1]) < 4.2 + wobble * 0.35) atGate = true;
        }
        if (!atGate && Math.abs(x - cx) < 16.2 && Math.abs(z - cz) < 16.2) return null;
        for (const b of buildings) {
            if (b.village !== 2) continue;
            if (x > b.minX + 0.25 && x < b.minX + b.w - 0.25 && z > b.minZ + 0.25 && z < b.minZ + b.d - 0.25) return null;
        }
        let bestC = 1e9;
        let bestE = 1e9;
        const cobbleLines = [0, 1, 2, 5, 8];
        const earthLines = [4, 6, 7, 9];
        for (const index of cobbleLines) bestC = Math.min(bestC, coverDist(x, z, lines[index]));
        bestC = Math.min(bestC, coverDist(x, z, lines[3], (px, pz) => pz < place.z + 52));
        for (const index of earthLines) bestE = Math.min(bestE, coverDist(x, z, lines[index]));
        bestE = Math.min(bestE, coverDist(x, z, lines[3], (px, pz) => pz >= place.z + 42 && pz < place.z + 96));
        const market = [place.x + MARKET[2][0], place.z + MARKET[2][1]];
        const md = Math.hypot(x - market[0], z - market[1]);
        const mw = 6.2 + (n - 0.5) * 2.4;
        if (md < mw) bestC = 0;
        else if (md < mw + 2.4) bestC = Math.min(bestC, 2.6);
        if (atGate) bestC = Math.min(bestC, 1.2);
        if (bestC < 2.35 + wobble) return "cobble";
        if (bestC < 3.7 + wobble) return n > 0.58 ? "dirt" : "cobble";
        if (bestE < 1.85 + wobble * 0.65) return "dirt";
        if (bestE < 3.15 + wobble) return n > 0.62 ? null : "dirt";
        for (const b of buildings) {
            if (b.village !== 2 || (b.mesh !== "shop" && b.mesh !== "brick")) continue;
            const s = Math.sin(b.yaw);
            const c = Math.cos(b.yaw);
            const doorX = b.x - s * (b.d * 0.5 + 1.1);
            const doorZ = b.z - c * (b.d * 0.5 + 1.1);
            if (Math.hypot(x - doorX, z - doorZ) < 2.4 + wobble * 0.4) return n > 0.82 ? "dirt" : "cobble";
        }
        if (n > 0.9) {
            for (const b of buildings) {
                if (b.village !== 2) continue;
                if (x > b.minX - 2.4 && x < b.minX + b.w + 2.4 && z > b.minZ - 2.4 && z < b.minZ + b.d + 2.4) return "dirt";
            }
        }
        if (hash(Math.floor(x / 6), Math.floor(z / 6)) > 0.94 && Math.hypot(x - place.x, z - place.z) < 78) return "dirt";
        return null;
    }

    function fieldGate(field, from) {
        const cx = field.x + field.w * 0.5;
        const cz = field.z + field.d * 0.5;
        const dx = from.x - cx;
        const dz = from.z - cz;
        const hx = field.w * 0.5;
        const hz = field.d * 0.5;
        const tx = Math.abs(dx) < 1e-4 ? Infinity : hx / Math.abs(dx);
        const tz = Math.abs(dz) < 1e-4 ? Infinity : hz / Math.abs(dz);
        const width = 3.2;
        let side;
        let at;
        let ox;
        let oz;
        let ix;
        let iz;
        if (tx < tz) {
            side = dx >= 0 ? "east" : "west";
            at = cz + (Math.abs(dx) < 1e-4 ? 0 : dz * tx);
            at = Math.max(field.z + width * 0.5 + 0.6, Math.min(field.z + field.d - width * 0.5 - 0.6, at));
            const x = side === "east" ? field.x + field.w : field.x;
            const out = side === "east" ? 1.6 : -1.6;
            ox = x + out;
            oz = at;
            ix = x - out;
            iz = at;
        } else {
            side = dz >= 0 ? "south" : "north";
            at = cx + (Math.abs(dz) < 1e-4 ? 0 : dx * tz);
            at = Math.max(field.x + width * 0.5 + 0.6, Math.min(field.x + field.w - width * 0.5 - 0.6, at));
            const z = side === "south" ? field.z + field.d : field.z;
            const out = side === "south" ? 1.6 : -1.6;
            ox = at;
            oz = z + out;
            ix = at;
            iz = z - out;
        }
        return { side: side, at: at, width: width, out: { x: ox, z: oz }, inn: { x: ix, z: iz } };
    }

    return { buildings, street, groundAt, MESH, towns, farms, farmSites, fieldGate };
});
