// Reads Roblox binary model files (.rbxm / .rbxl) into plain objects: { instances: [{ id, className, props, parent, children }] }.
// Only the property types a building made of parts needs are decoded; anything else is skipped.
const fs = require("fs");

function lz4(src, size) {
    const out = Buffer.alloc(size);
    let i = 0;
    let o = 0;
    while (i < src.length) {
        const token = src[i++];
        let lit = token >> 4;
        if (lit === 15) {
            let n;
            do { n = src[i++]; lit += n; } while (n === 255);
        }
        src.copy(out, o, i, i + lit);
        i += lit;
        o += lit;
        if (i >= src.length) break;
        const back = src[i] | (src[i + 1] << 8);
        i += 2;
        let len = token & 15;
        if (len === 15) {
            let n;
            do { n = src[i++]; len += n; } while (n === 255);
        }
        len += 4;
        for (let k = 0; k < len; k++, o++) out[o] = out[o - back];
    }
    return out;
}

// Roblox stores arrays of numbers byte-interleaved: all first bytes, then all second bytes, and so on (big-endian).
function deinterleave(buf, at, count, width) {
    const out = Buffer.alloc(count * width);
    for (let i = 0; i < count; i++) {
        for (let b = 0; b < width; b++) out[i * width + b] = buf[at + b * count + i];
    }
    return out;
}

function ints(buf, at, count) {
    const raw = deinterleave(buf, at, count, 4);
    const list = [];
    for (let i = 0; i < count; i++) {
        const u = raw.readUInt32BE(i * 4);
        list.push((u >>> 1) ^ -(u & 1));
    }
    return list;
}

function floats(buf, at, count) {
    const raw = deinterleave(buf, at, count, 4);
    const list = [];
    const tmp = Buffer.alloc(4);
    for (let i = 0; i < count; i++) {
        const u = raw.readUInt32BE(i * 4);
        tmp.writeUInt32BE(((u >>> 1) | (u << 31)) >>> 0, 0);
        list.push(tmp.readFloatBE(0));
    }
    return list;
}

function refs(buf, at, count) {
    const list = ints(buf, at, count);
    for (let i = 1; i < count; i++) list[i] += list[i - 1];
    return list;
}

// The 24 axis-aligned rotations Roblox can store as a single byte id.
function rotationOf(id) {
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]];
    const n = id - 1;
    const r0 = axes[Math.floor(n / 6)];
    const r1 = axes[n % 6];
    const r2 = [r0[1] * r1[2] - r0[2] * r1[1], r0[2] * r1[0] - r0[0] * r1[2], r0[0] * r1[1] - r0[1] * r1[0]];
    return r0.concat(r1, r2);
}

function readRbxm(file) {
    const b = fs.readFileSync(file);
    if (b.slice(0, 8).toString("latin1") !== "<roblox!") throw new Error("not a binary Roblox file");
    const classes = new Map();
    const byId = new Map();
    let o = 32;
    while (o < b.length) {
        const name = b.slice(o, o + 4).toString("latin1");
        const packed = b.readUInt32LE(o + 4);
        const size = b.readUInt32LE(o + 8);
        const body = packed ? lz4(b.slice(o + 16, o + 16 + packed), size) : b.slice(o + 16, o + 16 + size);
        o += 16 + (packed || size);
        if (name === "END\0") break;
        if (name === "INST") {
            const classId = body.readInt32LE(0);
            const len = body.readUInt32LE(4);
            const className = body.slice(8, 8 + len).toString("utf8");
            const count = body.readUInt32LE(9 + len);
            const ids = refs(body, 13 + len, count);
            classes.set(classId, { className, ids });
            for (const id of ids) byId.set(id, { id, className, props: {}, parent: -1, children: [] });
        } else if (name === "PROP") {
            const classId = body.readInt32LE(0);
            const len = body.readUInt32LE(4);
            const prop = body.slice(8, 8 + len).toString("utf8");
            const type = body[8 + len];
            const cls = classes.get(classId);
            if (!cls) continue;
            const n = cls.ids.length;
            const at = 9 + len;
            let values = null;
            if (type === 0x01) {
                values = [];
                let p = at;
                for (let i = 0; i < n; i++) {
                    const l = body.readUInt32LE(p);
                    values.push(body.slice(p + 4, p + 4 + l).toString("utf8"));
                    p += 4 + l;
                }
            } else if (type === 0x02) {
                values = [...body.slice(at, at + n)].map((v) => v !== 0);
            } else if (type === 0x03) {
                values = ints(body, at, n);
            } else if (type === 0x04) {
                values = floats(body, at, n);
            } else if (type === 0x0c) {
                const r = floats(body, at, n);
                const g = floats(body, at + 4 * n, n);
                const bl = floats(body, at + 8 * n, n);
                values = r.map((v, i) => [v, g[i], bl[i]]);
            } else if (type === 0x0e) {
                const x = floats(body, at, n);
                const y = floats(body, at + 4 * n, n);
                const z = floats(body, at + 8 * n, n);
                values = x.map((v, i) => [v, y[i], z[i]]);
            } else if (type === 0x10) {
                const rots = [];
                let p = at;
                for (let i = 0; i < n; i++) {
                    const id = body[p++];
                    if (id === 0) {
                        const m = [];
                        for (let k = 0; k < 9; k++) m.push(body.readFloatLE(p + k * 4));
                        rots.push(m);
                        p += 36;
                    } else rots.push(rotationOf(id));
                }
                const x = floats(body, p, n);
                const y = floats(body, p + 4 * n, n);
                const z = floats(body, p + 8 * n, n);
                values = rots.map((r, i) => ({ pos: [x[i], y[i], z[i]], rot: r }));
            } else if (type === 0x12) {
                const raw = deinterleave(body, at, n, 4);
                values = [];
                for (let i = 0; i < n; i++) values.push(raw.readUInt32BE(i * 4));
            } else if (type === 0x1a) {
                values = [];
                for (let i = 0; i < n; i++) values.push([body[at + i] / 255, body[at + n + i] / 255, body[at + 2 * n + i] / 255]);
            }
            if (values) cls.ids.forEach((id, i) => { byId.get(id).props[prop] = values[i]; });
        } else if (name === "PRNT") {
            const count = body.readUInt32LE(1);
            const kids = refs(body, 5, count);
            const parents = refs(body, 5 + count * 4, count);
            kids.forEach((kid, i) => {
                const inst = byId.get(kid);
                if (!inst) return;
                inst.parent = parents[i];
                const up = byId.get(parents[i]);
                if (up) up.children.push(inst);
            });
        }
    }
    return { instances: [...byId.values()] };
}

// The plain parts under a model. Roblox meshes, unions and decals live on Roblox's servers, not in the file, so they are left out,
// unless `blocks` is set: then each mesh and union stands in as a box of its size and colour.
// Doors are opened by scripts in Roblox, so anything named door is left walk-through like parts with CanCollide off.
// Roblox characters (models with a Humanoid) are left out.
function partsIn(group, blocks) {
    const list = [];
    const walk = (inst, door) => {
        // Characters (Humanoid) are skipped unless --blocks: then the horse stands in as boxes too.
        if (!blocks && inst.children.some((c) => c.className === "Humanoid")) return;
        door = door || /door/i.test(inst.props.Name || "");
        const shell = blocks && (inst.className === "MeshPart" || inst.className === "UnionOperation");
        const solid = shell || inst.className === "Part" || inst.className === "WedgePart" || inst.className === "Seat" || inst.className === "VehicleSeat";
        if (solid && inst.props.CFrame && inst.props.size && (inst.props.Transparency || 0) < 0.5) {
            const special = inst.children.find((c) => c.className === "SpecialMesh");
            if (!(special && special.props.MeshType === 5)) {
                let size = inst.props.size.slice();
                const scaled = inst.children.find((c) => c.className === "BlockMesh" || c.className === "CylinderMesh");
                if (scaled && scaled.props.Scale) size = size.map((v, k) => v * scaled.props.Scale[k]);
                const kind = inst.className === "WedgePart" ? "wedge" : ["ball", "box", "cyl"][inst.props.shape] || "box";
                const collide = inst.props.CanCollide !== false && !door;
                list.push({ kind, size, pos: inst.props.CFrame.pos, rot: inst.props.CFrame.rot, color: inst.props.Color3uint8 || [0.6, 0.6, 0.6], collide });
            }
        }
        inst.children.forEach((child) => walk(child, door));
    };
    walk(group, false);
    return list;
}

function boundsOf(parts) {
    const b = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
    for (const p of parts) {
        for (let k = 0; k < 3; k++) {
            const r = p.rot;
            const ext = Math.abs(r[k * 3]) * p.size[0] / 2 + Math.abs(r[k * 3 + 1]) * p.size[1] / 2 + Math.abs(r[k * 3 + 2]) * p.size[2] / 2;
            b[k][0] = Math.min(b[k][0], p.pos[k] - ext);
            b[k][1] = Math.max(b[k][1], p.pos[k] + ext);
        }
    }
    return b;
}

// Packs parts for the game: metres, centred on the whole model, ground at y 0.
// Each part is [kind, sx, sy, sz, px, py, pz, r0..r8, colour, grounded, collide]; rect(bounds) gives a centred footprint in the same frame.
function packModel(all, scale) {
    const whole = boundsOf(all);
    const cx = (whole[0][0] + whole[0][1]) / 2;
    const cz = (whole[2][0] + whole[2][1]) / 2;
    const base = whole[1][0];
    const rect = (b) => ({
        x: +(((b[0][0] + b[0][1]) / 2 - cx) * scale).toFixed(2),
        z: +(((b[2][0] + b[2][1]) / 2 - cz) * scale).toFixed(2),
        w: +((b[0][1] - b[0][0]) * scale).toFixed(2),
        d: +((b[2][1] - b[2][0]) * scale).toFixed(2)
    });
    const palette = [];
    const paletteIndex = new Map();
    const parts = all.map((p) => {
        const rgb = p.color.map((v) => Math.round(v * 255));
        const key = rgb.join(",");
        if (!paletteIndex.has(key)) {
            paletteIndex.set(key, palette.length);
            palette.push(rgb);
        }
        const bottom = boundsOf([p])[1][0];
        return [
            p.kind,
            ...p.size.map((v) => +(v * scale).toFixed(3)),
            +((p.pos[0] - cx) * scale).toFixed(3), +((p.pos[1] - base) * scale).toFixed(3), +((p.pos[2] - cz) * scale).toFixed(3),
            ...p.rot.map((v) => +v.toFixed(4)),
            paletteIndex.get(key),
            bottom - base < 0.6 ? 1 : 0,
            p.collide ? 1 : 0
        ];
    });
    return { scale, w: rect(whole).w, d: rect(whole).d, palette, parts, rect };
}

module.exports = { readRbxm, partsIn, boundsOf, packModel };

if (require.main === module) {
    const { instances } = readRbxm(process.argv[2]);
    const counts = {};
    for (const inst of instances) counts[inst.className] = (counts[inst.className] || 0) + 1;
    console.log(counts);
}
