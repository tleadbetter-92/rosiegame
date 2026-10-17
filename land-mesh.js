// Pure ground mesh for the bubble around the player. No WebGL — safe to run in a worker.
(function (root, factory) {
    const api = factory(root);
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.LandMesh = api;
})(typeof self !== "undefined" ? self : this, function (root) {
    function lib(name, file) {
        if (root && root[name]) return root[name];
        if (typeof require === "function") return require(file);
        throw new Error(name + " missing");
    }

    const TOWN_VIEW = 320;
    const NAMES = ["grass", "dirt", "cobble", "sand", "gravel", "marsh", "water", "townDirt", "townCobble", "crag"];

    function groundTone(World, kind, x, z) {
        if (kind === "grass") return World.turfShade(x, z);
        return kind === "crag" ? 0.9 : kind === "dirt" ? 0.9 : 1;
    }

    function countryKind(kind) {
        return kind === "rock" ? "crag" : kind;
    }

    function pushQuad(list, a, b, c, d) {
        list.push(...a, ...b, ...c, ...a, ...c, ...d);
    }

    function landKind(x, z, rise, h) {
        const World = lib("World", "./world.js");
        const Town = lib("Town", "./town.js");
        const home = World.places[2];
        if (Math.hypot(x - home.x, z - home.z) < 220) {
            const pave = Town.groundAt(x, z);
            if (pave) return pave;
            return World.groundKind(x, z, rise, h);
        }
        if (Town.street(x, z)) return "dirt";
        return World.groundKind(x, z, rise, h);
    }

    function townBatch(kind) {
        if (kind === "dirt") return "townDirt";
        if (kind === "cobble") return "townCobble";
        return kind;
    }

    function townTile(kind) {
        if (kind === "cobble") return 9;
        if (kind === "dirt") return 10;
        return 8;
    }

    function paveShade(kind, x, z) {
        const n = ((Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263)) >>> 0) / 4294967296;
        if (kind === "cobble") return 0.72 + n * 0.34;
        if (kind === "dirt") return 0.86 + n * 0.16;
        return 1;
    }

    function countrySub() {
        return 8;
    }

    function townPatch(place) {
        const World = lib("World", "./world.js");
        const min = -3616;
        const cell = 32;
        const down = (v) => min + Math.floor((v - min) / cell) * cell;
        const up = (v) => min + Math.ceil((v - min) / cell) * cell;
        const home = World.places[2];
        if (place === home) {
            return {
                x0: down(place.x - 120),
                x1: up(place.x + 120),
                z0: down(place.z - 100),
                z1: up(place.z + 220)
            };
        }
        return { x0: down(place.x - 96), x1: up(place.x + 96), z0: down(place.z - 96), z1: up(place.z + 96) };
    }

    function paintPatch(World, batches, blends, x, z, s, h00, h10, h11, h01, corners) {
        const rise = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
        const mid = (h00 + h10 + h11 + h01) * 0.25;
        const cx = x + s * 0.5;
        const cz = z + s * 0.5;
        if (mid > -0.35) {
            const kinds = (corners || Array(4).fill(landKind(cx, cz, rise, mid))).map(countryKind);
            const u = x / s;
            const v = z / s;
            const spots = [[x, h00, z, u, v], [x + s, h10, z, u + 1, v], [x + s, h11, z + s, u + 1, v + 1], [x, h01, z + s, u, v + 1]];
            const at = (i, k, extra) => spots[i].concat(groundTone(World, k, spots[i][0], spots[i][2]), extra);
            // Grass is always the solid ground. Gravel, dirt and rock only fade in from the corners
            // that are actually that kind, so a mixed cell cannot become one hard triangle.
            pushQuad(batches.grass, at(0, "grass", []), at(3, "grass", []), at(2, "grass", []), at(1, "grass", []));
            for (const other of new Set(kinds)) {
                if (other === "grass" || !batches[other]) continue;
                const list = blends[other] || (blends[other] = []);
                const a = (i) => at(i, other, [kinds[i] === other ? 1 : 0]);
                pushQuad(list, a(0), a(3), a(2), a(1));
            }
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

    function build(cx, cz, drawFar) {
        const World = lib("World", "./world.js");
        const batches = {};
        const blends = {};
        for (let i = 0; i < NAMES.length; i++) batches[NAMES[i]] = [];
        const cell = 32;
        const reach = Math.max(TOWN_VIEW, drawFar || 300) + 48;
        const x0 = Math.floor((cx - reach) / cell) * cell;
        const z0 = Math.floor((cz - reach) / cell) * cell;
        const x1 = Math.ceil((cx + reach) / cell) * cell;
        const z1 = Math.ceil((cz + reach) / cell) * cell;
        const nx = (x1 - x0) / cell;
        const nz = (z1 - z0) / cell;
        const heights = new Float32Array((nx + 1) * (nz + 1));
        const sample = (ix, iz) => heights[iz * (nx + 1) + ix];
        const subdivide = (x, z, sub, h00, h10, h11, h01) => {
            const k = cell / sub + 1;
            const grid = new Float32Array(k * k);
            for (let j = 0; j < k; j++) {
                for (let i = 0; i < k; i++) {
                    const last = k - 1;
                    if (i === 0 && j === 0) grid[0] = h00;
                    else if (i === last && j === 0) grid[i] = h10;
                    else if (i === last && j === last) grid[j * k + i] = h11;
                    else if (i === 0 && j === last) grid[j * k] = h01;
                    else grid[j * k + i] = World.heightAt(x + i * sub, z + j * sub);
                }
            }
            const kinds = [];
            for (let j = 0; j < k; j++) {
                for (let i = 0; i < k; i++) {
                    const h = grid[j * k + i];
                    const near = (di, dj) => {
                        const ni = Math.min(k - 1, Math.max(0, i + di));
                        const nj = Math.min(k - 1, Math.max(0, j + dj));
                        return Math.abs(grid[nj * k + ni] - h);
                    };
                    const rise = Math.max(near(1, 0), near(-1, 0), near(0, 1), near(0, -1), near(1, 1), near(-1, -1)) * 4 / sub;
                    kinds.push(landKind(x + i * sub, z + j * sub, rise, h));
                }
            }
            for (let i = 0; i < k - 1; i++) {
                for (let j = 0; j < k - 1; j++) {
                    const c = j * k + i;
                    paintPatch(
                        World, batches, blends,
                        x + i * sub, z + j * sub, sub,
                        grid[c], grid[c + 1], grid[c + k + 1], grid[c + k],
                        [kinds[c], kinds[c + 1], kinds[c + k + 1], kinds[c + k]]
                    );
                }
            }
            const edges = [];
            for (let i = 0; i < k - 1; i++) edges.push([i, 0, i + 1, 0], [i, k - 1, i + 1, k - 1], [0, i, 0, i + 1], [k - 1, i, k - 1, i + 1]);
            for (const [i0, j0, i1, j1] of edges) {
                const a = j0 * k + i0;
                const b = j1 * k + i1;
                if (grid[a] < -0.35 && grid[b] < -0.35) continue;
                const kind = countryKind(kinds[a]);
                const list = batches[kind] || batches.grass;
                const ex0 = x + i0 * sub;
                const ez0 = z + j0 * sub;
                const ex1 = x + i1 * sub;
                const ez1 = z + j1 * sub;
                const t0 = [ex0, grid[a], ez0, ex0 / sub, ez0 / sub, groundTone(World, kind, ex0, ez0)];
                const t1 = [ex1, grid[b], ez1, ex1 / sub, ez1 / sub, groundTone(World, kind, ex1, ez1)];
                const d0 = [ex0, grid[a] - 1, ez0, ex0 / sub, ez0 / sub + 0.25, groundTone(World, kind, ex0, ez0)];
                const d1 = [ex1, grid[b] - 1, ez1, ex1 / sub, ez1 / sub + 0.25, groundTone(World, kind, ex1, ez1)];
                pushQuad(list, t0, t1, d1, d0);
                pushQuad(list, t0, d0, d1, t1);
            }
        };
        for (let iz = 0; iz <= nz; iz++) {
            for (let ix = 0; ix <= nx; ix++) {
                heights[iz * (nx + 1) + ix] = World.heightAt(x0 + ix * cell, z0 + iz * cell);
            }
        }
        let focusPlace = null;
        let nearTown = Infinity;
        for (let i = 0; i < World.places.length; i++) {
            const p = World.places[i];
            const d = Math.hypot(p.ox - cx, p.oz - cz);
            if (d < nearTown) {
                nearTown = d;
                focusPlace = p;
            }
        }
        if (nearTown > 220) focusPlace = null;
        const home = World.places[2];
        const homeFocus = focusPlace === home;
        const finePatch = focusPlace
            ? townPatch(focusPlace)
            : { x0: 0, x1: 0, z0: 0, z1: 0 };
        for (let iz = 0; iz < nz; iz++) {
            for (let ix = 0; ix < nx; ix++) {
                const x = x0 + ix * cell;
                const z = z0 + iz * cell;
                if (x >= finePatch.x0 && x < finePatch.x1 && z >= finePatch.z0 && z < finePatch.z1) continue;
                subdivide(x, z, countrySub(), sample(ix, iz), sample(ix + 1, iz), sample(ix + 1, iz + 1), sample(ix, iz + 1));
            }
        }
        const fine = 8;
        const inner = 100;
        for (let x = finePatch.x0; x < finePatch.x1; x += fine) {
            for (let z = finePatch.z0; z < finePatch.z1; z += fine) {
                if (homeFocus && x >= home.x - inner && x < home.x + inner && z >= home.z - inner && z < home.z + inner) continue;
                const h00 = World.heightAt(x, z);
                const h10 = World.heightAt(x + fine, z);
                const h11 = World.heightAt(x + fine, z + fine);
                const h01 = World.heightAt(x, z + fine);
                const rise = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
                paintPatch(World, batches, blends, x, z, fine, h00, h10, h11, h01, [
                    landKind(x, z, rise, h00),
                    landKind(x + fine, z, rise, h10),
                    landKind(x + fine, z + fine, rise, h11),
                    landKind(x, z + fine, rise, h01)
                ]);
            }
        }
        if (homeFocus) {
            const pave = 2;
            const cover = root.SwSquare ? root.SwSquare.bounds() : null;
            for (let x = home.x - inner; x < home.x + inner; x += pave) {
                for (let z = home.z - inner; z < home.z + inner; z += pave) {
                    if (cover && x + pave > cover.minX && x < cover.maxX && z + pave > cover.minZ && z < cover.maxZ) continue;
                    const h00 = World.heightAt(x, z);
                    const h10 = World.heightAt(x + pave, z);
                    const h11 = World.heightAt(x + pave, z + pave);
                    const h01 = World.heightAt(x, z + pave);
                    const rise = Math.max(h00, h10, h11, h01) - Math.min(h00, h10, h11, h01);
                    const kind = landKind(x + pave * 0.5, z + pave * 0.5, rise);
                    const list = batches[townBatch(kind)] || batches.grass;
                    const tile = townTile(kind);
                    const tone = (px, pz) => {
                        if (kind === "grass") return World.turfShade(px, pz);
                        return paveShade(kind, px, pz);
                    };
                    const u = x / tile;
                    const v = z / tile;
                    const step = pave / tile;
                    pushQuad(
                        list,
                        [x, h00, z, u, v, tone(x, z)],
                        [x, h01, z + pave, u, v + step, tone(x, z + pave)],
                        [x + pave, h11, z + pave, u + step, v + step, tone(x + pave, z + pave)],
                        [x + pave, h10, z, u + step, v, tone(x + pave, z)]
                    );
                }
            }
            if (cover) root.SwSquare.stampGround(batches, (px, pz) => World.heightAt(px, pz), pushQuad);
        }
        const meshes = {};
        for (let i = 0; i < NAMES.length; i++) {
            const name = NAMES[i];
            meshes[name] = batches[name].length ? new Float32Array(batches[name]) : new Float32Array(0);
        }
        const blendOut = {};
        for (const kind of Object.keys(blends)) blendOut[kind] = new Float32Array(blends[kind]);
        return { meshes: meshes, blends: blendOut };
    }

    return { build: build, landKind: landKind, townPatch: townPatch, countrySub: countrySub };
});
