const fs = require("fs");
const path = require("path");

function loadGlb(file) {
    const b = fs.readFileSync(file);
    const jsonLen = b.readUInt32LE(12);
    const json = JSON.parse(b.slice(20, 20 + jsonLen).toString());
    const binStart = 20 + jsonLen;
    const binLen = b.readUInt32LE(binStart);
    const bin = b.slice(binStart + 8, binStart + 8 + binLen);
    return { json, bin, dir: path.dirname(file) };
}

function loadGltf(file) {
    const dir = path.dirname(file);
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    const uri = json.buffers[0].uri;
    const bin = uri ? fs.readFileSync(path.join(dir, uri)) : Buffer.alloc(0);
    return { json, bin, dir };
}

function accessor(json, bin, index) {
    const acc = json.accessors[index];
    const view = json.bufferViews[acc.bufferView];
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[acc.type];
    const ctype = acc.componentType;
    const size = ctype === 5126 ? 4 : ctype === 5123 || ctype === 5122 ? 2 : ctype === 5125 || ctype === 5124 ? 4 : 1;
    const stride = view.byteStride || comps * size;
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const out = new Float32Array(acc.count * comps);
    for (let i = 0; i < acc.count; i++) {
        const at = start + i * stride;
        for (let c = 0; c < comps; c++) {
            const o = at + c * size;
            let v = 0;
            if (ctype === 5126) v = bin.readFloatLE(o);
            else if (ctype === 5123) v = bin.readUInt16LE(o);
            else if (ctype === 5121) v = bin.readUInt8(o);
            else if (ctype === 5125) v = bin.readUInt32LE(o);
            else if (ctype === 5122) v = bin.readInt16LE(o);
            else if (ctype === 5120) v = bin.readInt8(o);
            if (acc.normalized) {
                if (ctype === 5121) v /= 255;
                else if (ctype === 5123) v /= 65535;
            }
            out[i * comps + c] = v;
        }
    }
    return out;
}

function mul(a, b) {
    const c = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            c[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
        }
    }
    return c;
}

function compose(t, r, s) {
    const x = r[0], y = r[1], z = r[2], w = r[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const m = new Float32Array(16);
    m[0] = (1 - (yy + zz)) * s[0];
    m[1] = (xy + wz) * s[0];
    m[2] = (xz - wy) * s[0];
    m[4] = (xy - wz) * s[1];
    m[5] = (1 - (xx + zz)) * s[1];
    m[6] = (yz + wx) * s[1];
    m[8] = (xz + wy) * s[2];
    m[9] = (yz - wx) * s[2];
    m[10] = (1 - (xx + yy)) * s[2];
    m[12] = t[0];
    m[13] = t[1];
    m[14] = t[2];
    m[15] = 1;
    return m;
}

function slerp(a, b, t) {
    let ax = a[0], ay = a[1], az = a[2], aw = a[3];
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    let dot = ax * bx + ay * by + az * bz + aw * bw;
    if (dot < 0) {
        bx = -bx; by = -by; bz = -bz; bw = -bw; dot = -dot;
    }
    if (dot > 0.9995) {
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        const z = az + (bz - az) * t;
        const w = aw + (bw - aw) * t;
        const len = Math.hypot(x, y, z, w) || 1;
        return [x / len, y / len, z / len, w / len];
    }
    const theta = Math.acos(Math.min(1, dot));
    const s = Math.sin(theta);
    const w1 = Math.sin((1 - t) * theta) / s;
    const w2 = Math.sin(t * theta) / s;
    return [ax * w1 + bx * w2, ay * w1 + by * w2, az * w1 + bz * w2, aw * w1 + bw * w2];
}

function lerp(a, b, t, n) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = a[i] + (b[i] - a[i]) * t;
    return out;
}

function nodeIndexByName(json) {
    const map = new Map();
    json.nodes.forEach((node, index) => {
        if (node.name) map.set(node.name, index);
    });
    return map;
}

/** Apply animation from a sibling GLB (often mesh-less) onto the base rig by joint name. */
function sampleAnimRemapped(baseJson, animJson, animBin, animName, time) {
    const animPose = sampleAnim(animJson, animBin, animName, time);
    const baseByName = nodeIndexByName(baseJson);
    const animNodes = animJson.nodes;
    const remapped = new Map();
    for (const [animIndex, tracks] of animPose) {
        const name = animNodes[animIndex] && animNodes[animIndex].name;
        if (!name || !baseByName.has(name)) continue;
        remapped.set(baseByName.get(name), tracks);
    }
    return remapped;
}

function sampleAnim(json, bin, name, time) {
    const anim = json.animations.find((item) => item.name === name);
    const cache = [];
    let duration = 0.0001;
    for (const sampler of anim.samplers) {
        const times = accessor(json, bin, sampler.input);
        duration = Math.max(duration, times[times.length - 1]);
        cache.push({ times, values: accessor(json, bin, sampler.output) });
    }
    const wrapped = ((time % duration) + duration) % duration;
    const pose = new Map();
    for (const channel of anim.channels) {
        const track = cache[channel.sampler];
        const times = track.times;
        const comps = channel.target.path === "rotation" ? 4 : 3;
        let i = 0;
        while (i < times.length - 2 && times[i + 1] < wrapped) i += 1;
        const span = (times[Math.min(i + 1, times.length - 1)] - times[i]) || 1;
        const t = Math.min(1, Math.max(0, (wrapped - times[i]) / span));
        const next = Math.min(i + 1, times.length - 1);
        const a = track.values.slice(i * comps, i * comps + comps);
        const b = track.values.slice(next * comps, next * comps + comps);
        const value = channel.target.path === "rotation" ? slerp(a, b, t) : lerp(a, b, t, comps);
        const node = channel.target.node;
        if (!pose.has(node)) pose.set(node, {});
        pose.get(node)[channel.target.path] = value;
    }
    return pose;
}

function globalsOf(json, pose) {
    const nodes = json.nodes;
    const parent = new Array(nodes.length).fill(-1);
    nodes.forEach((node, index) => {
        (node.children || []).forEach((child) => { parent[child] = index; });
    });
    const globals = new Array(nodes.length);
    const ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    function localOf(index) {
        const node = nodes[index];
        const over = pose.get(index) || {};
        if (node.matrix && !over.translation && !over.rotation && !over.scale) return new Float32Array(node.matrix);
        const t = over.translation || node.translation || [0, 0, 0];
        const r = over.rotation || node.rotation || [0, 0, 0, 1];
        const s = over.scale || node.scale || [1, 1, 1];
        return compose(t, r, s);
    }
    function global(index) {
        if (globals[index]) return globals[index];
        const local = localOf(index);
        globals[index] = parent[index] < 0 ? local : mul(global(parent[index]), local);
        return globals[index];
    }
    for (let i = 0; i < nodes.length; i++) global(i);
    return { globals, ident };
}

function want(node) {
    if (node.skin != null) return true;
    const name = node.name || "";
    return /helmet|cape|hood/i.test(name) || name === "1H_Sword";
}

function bakeFrame(json, bin, pose) {
    const { globals } = globalsOf(json, pose);
    const skin = json.skins[0];
    const ibm = accessor(json, bin, skin.inverseBindMatrices);
    const jointMats = skin.joints.map((joint, index) => {
        const inv = ibm.subarray(index * 16, index * 16 + 16);
        return mul(globals[joint], inv);
    });
    const list = [];
    json.nodes.forEach((node, index) => {
        if (node.mesh == null || !want(node)) return;
        const mesh = json.meshes[node.mesh];
        for (const prim of mesh.primitives) {
            const pos = accessor(json, bin, prim.attributes.POSITION);
            const uv = accessor(json, bin, prim.attributes.TEXCOORD_0);
            const nrm = accessor(json, bin, prim.attributes.NORMAL);
            const idx = accessor(json, bin, prim.indices);
            const joints = prim.attributes.JOINTS_0 != null ? accessor(json, bin, prim.attributes.JOINTS_0) : null;
            const weights = prim.attributes.WEIGHTS_0 != null ? accessor(json, bin, prim.attributes.WEIGHTS_0) : null;
            const world = globals[index];
            for (let t = 0; t < idx.length; t++) {
                const v = idx[t];
                let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
                let nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
                if (joints) {
                    let px = 0, py = 0, pz = 0, dx = 0, dy = 0, dz = 0;
                    for (let k = 0; k < 4; k++) {
                        const w = weights[v * 4 + k];
                        if (w <= 0) continue;
                        const m = jointMats[joints[v * 4 + k]];
                        px += w * (m[0] * x + m[4] * y + m[8] * z + m[12]);
                        py += w * (m[1] * x + m[5] * y + m[9] * z + m[13]);
                        pz += w * (m[2] * x + m[6] * y + m[10] * z + m[14]);
                        dx += w * (m[0] * nx + m[4] * ny + m[8] * nz);
                        dy += w * (m[1] * nx + m[5] * ny + m[9] * nz);
                        dz += w * (m[2] * nx + m[6] * ny + m[10] * nz);
                    }
                    x = px; y = py; z = pz; nx = dx; ny = dy; nz = dz;
                }
                const wx = world[0] * x + world[4] * y + world[8] * z + world[12];
                const wy = world[1] * x + world[5] * y + world[9] * z + world[13];
                const wz = world[2] * x + world[6] * y + world[10] * z + world[14];
                const wnx = world[0] * nx + world[4] * ny + world[8] * nz;
                const wny = world[1] * nx + world[5] * ny + world[9] * nz;
                const wnz = world[2] * nx + world[6] * ny + world[10] * nz;
                const len = Math.hypot(wnx, wny, wnz) || 1;
                const shade = 0.42 + 0.58 * Math.max(0, (wnx * 0.25 + wny * 0.86 + wnz * 0.44) / len);
                list.push(wx, wy, wz, uv[v * 2], uv[v * 2 + 1], shade);
            }
        }
    });
    return list;
}

function fit(frames) {
    let minY = Infinity, maxY = -Infinity;
    const idle = frames[0];
    for (let i = 1; i < idle.length; i += 6) {
        minY = Math.min(minY, idle[i]);
        maxY = Math.max(maxY, idle[i]);
    }
    const scale = 1.78 / (maxY - minY || 1);
    for (const frame of frames) {
        let cx = 0, cz = 0, n = 0;
        for (let i = 0; i < frame.length; i += 6) {
            cx += frame[i];
            cz += frame[i + 2];
            n += 1;
        }
        cx /= n;
        cz /= n;
        for (let i = 0; i < frame.length; i += 6) {
            frame[i] = (frame[i] - cx) * scale;
            frame[i + 1] = (frame[i + 1] - minY) * scale;
            frame[i + 2] = (frame[i + 2] - cz) * scale;
        }
    }
}

function extractImage(json, bin, dest) {
    const image = json.images[0];
    const view = json.bufferViews[image.bufferView];
    const start = view.byteOffset || 0;
    fs.writeFileSync(dest, bin.slice(start, start + view.byteLength));
}

function bake(file, outBin, outPng) {
    const { json, bin } = loadGlb(file);
    const frames = [];
    frames.push(bakeFrame(json, bin, sampleAnim(json, bin, "Idle", 0)));
    for (let i = 0; i < 8; i++) frames.push(bakeFrame(json, bin, sampleAnim(json, bin, "Walking_A", i / 8)));
    frames.push(bakeFrame(json, bin, sampleAnim(json, bin, "1H_Melee_Attack_Slice_Horizontal", 0.35)));
    fit(frames);
    const count = frames[0].length / 6;
    const header = Buffer.alloc(8);
    header.writeUInt32LE(frames.length, 0);
    header.writeUInt32LE(count, 4);
    const body = Buffer.concat(frames.map((frame) => Buffer.from(new Float32Array(frame).buffer)));
    fs.writeFileSync(outBin, Buffer.concat([header, body]));
    extractImage(json, bin, outPng);
    const idle = frames[0];
    let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    let moved = 0;
    const walk = frames[4];
    for (let i = 0; i < idle.length; i += 6) {
        for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], idle[i + k]);
            max[k] = Math.max(max[k], idle[i + k]);
        }
        moved += Math.abs(idle[i] - walk[i]) + Math.abs(idle[i + 1] - walk[i + 1]) + Math.abs(idle[i + 2] - walk[i + 2]);
    }
    console.log(path.basename(file), "verts", count, "frames", frames.length, "bounds", min.map((n) => +n.toFixed(2)), max.map((n) => +n.toFixed(2)), "walk shift", +(moved / count).toFixed(3));
}

function bakeSkinned(json, bin, pose) {
    const { globals } = globalsOf(json, pose);
    const matsBySkin = new Map();
    const jointMatsFor = (skinIndex) => {
        if (matsBySkin.has(skinIndex)) return matsBySkin.get(skinIndex);
        const skin = json.skins[skinIndex];
        const ibm = accessor(json, bin, skin.inverseBindMatrices);
        const jointMats = skin.joints.map((joint, index) => mul(globals[joint], ibm.subarray(index * 16, index * 16 + 16)));
        matsBySkin.set(skinIndex, jointMats);
        return jointMats;
    };
    const parts = new Map();
    json.nodes.forEach((node, index) => {
        if (node.mesh == null || node.skin == null) return;
        const jointMats = jointMatsFor(node.skin);
        const mesh = json.meshes[node.mesh];
        for (const prim of mesh.primitives) {
            const mat = prim.material || 0;
            if (!parts.has(mat)) parts.set(mat, []);
            const list = parts.get(mat);
            const pos = accessor(json, bin, prim.attributes.POSITION);
            const uv = accessor(json, bin, prim.attributes.TEXCOORD_0);
            const nrm = accessor(json, bin, prim.attributes.NORMAL);
            const idx = accessor(json, bin, prim.indices);
            const joints = accessor(json, bin, prim.attributes.JOINTS_0);
            const weights = accessor(json, bin, prim.attributes.WEIGHTS_0);
            const world = globals[index];
            for (let t = 0; t < idx.length; t++) {
                const v = idx[t];
                const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
                const nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
                let px = 0, py = 0, pz = 0, dx = 0, dy = 0, dz = 0;
                for (let k = 0; k < 4; k++) {
                    const w = weights[v * 4 + k];
                    if (w <= 0) continue;
                    const m = jointMats[Math.round(joints[v * 4 + k])];
                    px += w * (m[0] * x + m[4] * y + m[8] * z + m[12]);
                    py += w * (m[1] * x + m[5] * y + m[9] * z + m[13]);
                    pz += w * (m[2] * x + m[6] * y + m[10] * z + m[14]);
                    dx += w * (m[0] * nx + m[4] * ny + m[8] * nz);
                    dy += w * (m[1] * nx + m[5] * ny + m[9] * nz);
                    dz += w * (m[2] * nx + m[6] * ny + m[10] * nz);
                }
                const wx = px;
                const wy = py;
                const wz = pz;
                const wnx = dx;
                const wny = dy;
                const wnz = dz;
                const len = Math.hypot(wnx, wny, wnz) || 1;
                const shade = 0.55 + 0.45 * Math.max(0, (wnx * 0.2 + wny * 0.8 + wnz * 0.35) / len);
                list.push(wx, wy, wz, uv[v * 2], uv[v * 2 + 1], shade);
            }
        }
    });
    return parts;
}

function fitTogether(partFrames, centerIndex, feetFromAll) {
    const basis = partFrames[centerIndex || 0];
    let minY = Infinity, maxY = -Infinity;
    const idle = basis[0];
    for (let i = 1; i < idle.length; i += 6) {
        minY = Math.min(minY, idle[i]);
        maxY = Math.max(maxY, idle[i]);
    }
    // The torso can be a separate material from the legs. Fitting to the torso alone plants the waist on the floor.
    if (feetFromAll) {
        const waist = minY;
        for (const frames of partFrames) {
            const part = frames[0];
            let partMin = Infinity;
            let partMax = -Infinity;
            for (let i = 1; i < part.length; i += 6) {
                partMin = Math.min(partMin, part[i]);
                partMax = Math.max(partMax, part[i]);
            }
            if (partMax > waist + 0.05) minY = Math.min(minY, partMin);
        }
    }
    const scale = 1.8 / (maxY - minY || 1);
    const frameCount = partFrames[0].length;
    for (let f = 0; f < frameCount; f++) {
        let cx = 0, cz = 0, n = 0;
        const frame = basis[f];
        for (let i = 0; i < frame.length; i += 6) {
            cx += frame[i];
            cz += frame[i + 2];
            n += 1;
        }
        cx /= n || 1;
        cz /= n || 1;
        for (const frames of partFrames) {
            const posed = frames[f];
            for (let i = 0; i < posed.length; i += 6) {
                posed[i] = (posed[i] - cx) * scale;
                posed[i + 1] = (posed[i + 1] - minY) * scale;
                posed[i + 2] = (posed[i + 2] - cz) * scale;
            }
        }
    }
}

function diffuseImage(json, bin, materialIndex, dest, dir) {
    const material = json.materials[materialIndex];
    const texIndex = material.pbrMetallicRoughness.baseColorTexture.index;
    const image = json.images[json.textures[texIndex].source];
    if (image.uri && dir) {
        fs.copyFileSync(path.join(dir, image.uri), dest);
        return;
    }
    const view = json.bufferViews[image.bufferView];
    const start = view.byteOffset || 0;
    fs.writeFileSync(dest, bin.slice(start, start + view.byteLength));
}

function sampleClip(file, steps) {
    const { json, bin } = loadGlb(file);
    const anim = json.animations[0];
    let duration = 0.0001;
    for (const sampler of anim.samplers) {
        const times = accessor(json, bin, sampler.input);
        duration = Math.max(duration, times[times.length - 1]);
    }
    const sampled = [];
    for (let i = 0; i < steps; i++) {
        const along = steps === 1 ? 0.5 : (i + 0.5) / steps;
        sampled.push(bakeSkinned(json, bin, sampleAnim(json, bin, anim.name, duration * along)));
    }
    return { json, bin, sampled };
}

function sampleClipOnBase(baseFile, animFile, steps) {
    const base = loadGlb(baseFile);
    const animDoc = loadGlb(animFile);
    const anim = animDoc.json.animations[0];
    if (!anim) throw new Error("No animation in " + animFile);
    let duration = 0.0001;
    for (const sampler of anim.samplers) {
        const times = accessor(animDoc.json, animDoc.bin, sampler.input);
        duration = Math.max(duration, times[times.length - 1]);
    }
    const sampled = [];
    for (let i = 0; i < steps; i++) {
        const along = steps === 1 ? 0.5 : (i + 0.5) / steps;
        const pose = sampleAnimRemapped(base.json, animDoc.json, animDoc.bin, anim.name, duration * along);
        sampled.push(bakeSkinned(base.json, base.bin, pose));
    }
    return { json: base.json, bin: base.bin, sampled };
}

function sampleNamed(json, bin, animName, steps) {
    const anim = json.animations.find((item) => item.name === animName);
    if (!anim) throw new Error("Animation not found: " + animName);
    let duration = 0.0001;
    for (const sampler of anim.samplers) {
        const times = accessor(json, bin, sampler.input);
        duration = Math.max(duration, times[times.length - 1]);
    }
    const sampled = [];
    for (let i = 0; i < steps; i++) {
        const along = steps === 1 ? 0.5 : (i + 0.5) / steps;
        sampled.push(bakeSkinned(json, bin, sampleAnim(json, bin, animName, duration * along)));
    }
    return sampled;
}

function fitHorse(partFrames) {
    const basis = partFrames[0];
    let minY = Infinity;
    let maxY = -Infinity;
    for (const frames of partFrames) {
        const part = frames[0];
        for (let i = 1; i < part.length; i += 6) {
            minY = Math.min(minY, part[i]);
            maxY = Math.max(maxY, part[i]);
        }
    }
    const scale = 1.42 / (maxY - minY || 1);
    const frameCount = partFrames[0].length;
    for (let f = 0; f < frameCount; f++) {
        let cx = 0;
        let cz = 0;
        let n = 0;
        const frame = basis[f];
        for (let i = 0; i < frame.length; i += 6) {
            cx += frame[i];
            cz += frame[i + 2];
            n += 1;
        }
        cx /= n || 1;
        cz /= n || 1;
        for (const frames of partFrames) {
            const posed = frames[f];
            for (let i = 0; i < posed.length; i += 6) {
                posed[i] = (posed[i] - cx) * scale;
                posed[i + 1] = (posed[i + 1] - minY) * scale;
                posed[i + 2] = (posed[i + 2] - cz) * scale;
            }
        }
    }
}

function writeClip(sampled, json, bin, stem, centerIndex, feetFromAll, outDir, assetDir) {
    const dir = outDir || path.join("models", "kaykit");
    const mats = [...sampled[0].keys()];
    const partFrames = mats.map((mat) => sampled.map((frame) => frame.get(mat)));
    const outKey = outDir ? String(outDir).replace(/\\/g, "/") : "";
    if (
        outKey &&
        (outKey.includes("horse") ||
            outKey.includes("cow") ||
            outKey.includes("dragon") ||
            outKey.includes("spider") ||
            outKey.includes("creatures"))
    )
        fitHorse(partFrames);
    else fitTogether(partFrames, centerIndex, feetFromAll);
    mats.forEach((mat, index) => {
        const frames = partFrames[index];
        const count = frames[0].length / 6;
        const header = Buffer.alloc(8);
        header.writeUInt32LE(frames.length, 0);
        header.writeUInt32LE(count, 4);
        const body = Buffer.concat(frames.map((frame) => Buffer.from(new Float32Array(frame).buffer)));
        const out = path.join(dir, stem + "-" + index);
        fs.writeFileSync(out + ".bin", Buffer.concat([header, body]));
        try {
            diffuseImage(json, bin, mat, out + ".png", assetDir);
        } catch (err) {
            console.warn(stem + "-" + index, "texture from glb skipped:", err.message);
        }
        console.log(stem + "-" + index, "verts", count, "frames", frames.length, "mat", json.materials[mat].name);
    });
}

function bakeMixamo(file, stem) {
    const { json, bin } = loadGlb(file);
    const name = json.animations[0].name;
    const anim = json.animations[0];
    let duration = 0.0001;
    for (const sampler of anim.samplers) {
        const times = accessor(json, bin, sampler.input);
        duration = Math.max(duration, times[times.length - 1]);
    }
    const sampled = [];
    for (let i = 0; i < 8; i++) sampled.push(bakeSkinned(json, bin, sampleAnim(json, bin, name, duration * (i + 0.5) / 8)));
    const mats = [...sampled[0].keys()];
    const partFrames = mats.map((mat) => sampled.map((frame) => frame.get(mat)));
    fitTogether(partFrames);
    mats.forEach((mat, index) => {
        const frames = partFrames[index];
        const count = frames[0].length / 6;
        const header = Buffer.alloc(8);
        header.writeUInt32LE(frames.length, 0);
        header.writeUInt32LE(count, 4);
        const body = Buffer.concat(frames.map((frame) => Buffer.from(new Float32Array(frame).buffer)));
        const out = path.join("models", "kaykit", stem + "-" + index);
        fs.writeFileSync(out + ".bin", Buffer.concat([header, body]));
        diffuseImage(json, bin, mat, out + ".png");
        console.log(stem + "-" + index, "verts", count, "mat", json.materials[mat].name, "duration", duration);
    });
}

if (process.argv[2] === "mixamo") {
    bakeMixamo(path.join("models", "kaykit", "ch10.glb"), "ch10");
} else if (process.argv[2] === "paladin") {
    const idle = sampleClip(path.join("models", "kaykit", "paladin-idle.glb"), 1);
    const walk = sampleClip(path.join("models", "kaykit", "paladin.glb"), 8);
    writeClip(idle.sampled.concat(walk.sampled), walk.json, walk.bin, "paladin");
} else if (process.argv[2] === "prop") {
    const idle = sampleClip(path.join("models", "kaykit", "prop-idle.glb"), 1);
    const walk = sampleClip(path.join("models", "kaykit", "prop-walk.glb"), 8);
    const attack = sampleClip(path.join("models", "kaykit", "prop-attack.glb"), 6);
    const death = sampleClip(path.join("models", "kaykit", "prop-death.glb"), 6);
    const sampled = idle.sampled.concat(walk.sampled, attack.sampled, death.sampled);
    const names = [...sampled[0].keys()].map((mat) => idle.json.materials[mat].name);
    let center = 0;
    names.forEach((name, index) => {
        if (/sword|shield|helmet/i.test(name)) return;
        center = index;
    });
    console.log("parts", names.join(", "), "center", names[center]);
    writeClip(sampled, idle.json, idle.bin, "prop", center);
} else if (process.argv[2] === "horse") {
    const file = path.join("models", "horse", "horse.glb");
    const { json, bin } = loadGlb(file);
    const names = (json.animations || []).map((a) => a.name);
    console.log("animations", names.join(", "));
    const idle = sampleNamed(json, bin, "Idle", 1);
    const trot = sampleNamed(json, bin, "Trot", 8);
    const sampled = idle.concat(trot);
    writeClip(sampled, json, bin, "horse", 0, true, path.join("models", "horse"));
} else if (process.argv[2] === "warhorse") {
    const file = path.join("models", "horse", "warhorse-lite.glb");
    const { json, bin } = loadGlb(file);
    const names = (json.animations || []).map((a) => a.name);
    console.log("animations", names.join(", "));
    const idle = sampleNamed(json, bin, "idle_loop", 1);
    const walk = sampleNamed(json, bin, "walk_loop", 8);
    const canter = sampleNamed(json, bin, "canter_loop", 8);
    const sampled = idle.concat(walk, canter);
    writeClip(sampled, json, bin, "warhorse", 0, true, path.join("models", "horse"));
} else if (process.argv[2] === "cow") {
    const file = path.join("models", "cow", "cow.glb");
    const { json, bin } = loadGlb(file);
    const names = (json.animations || []).map((a) => a.name);
    console.log("animations", names.join(", "));
    const idleAnim = names.includes("Idle") ? "Idle" : "Trot";
    const idle = sampleNamed(json, bin, idleAnim, 1);
    const trot = sampleNamed(json, bin, "Trot", 8);
    const sampled = idle.concat(trot);
    writeClip(sampled, json, bin, "cow", 0, true, path.join("models", "cow"));
} else if (process.argv[2] === "dragon") {
    const file = path.join("models", "dragon", "dragon.glb");
    const { json, bin } = loadGlb(file);
    const names = (json.animations || []).map((a) => a.name);
    console.log("animations", names.join(", "));
    const idle = sampleNamed(json, bin, "Idle", 1);
    const walk = sampleNamed(json, bin, "Walk", 8);
    const sampled = idle.concat(walk);
    writeClip(sampled, json, bin, "dragon", 0, true, path.join("models", "dragon"));
} else if (process.argv[2] === "spider") {
    const file = path.join("models", "spider", "spider.glb");
    const { json, bin } = loadGlb(file);
    const names = (json.animations || []).map((a) => a.name);
    console.log("animations", names.join(", "));
    const idle = sampleNamed(json, bin, "Idle", 1);
    const walk = sampleNamed(json, bin, "Walk", 8);
    const sampled = idle.concat(walk);
    writeClip(sampled, json, bin, "spider", 0, true, path.join("models", "spider"));
} else if (process.argv[2] === "generic-human") {
    const file = path.join("models", "kaykit", "generic-human.glb");
    const { json, bin } = loadGlb(file);
    const names = (json.animations || []).map((a) => a.name);
    console.log("animations", names.join(", "));
    const idle = sampleNamed(json, bin, "Idle_A", 1);
    const walk = sampleNamed(json, bin, "Walk", 8);
    const jog = sampleNamed(json, bin, "Jog", 8);
    const chop = sampleNamed(json, bin, "Chop_Tree", 6);
    const fish = sampleNamed(json, bin, "Fishing_Reel", 6);
    const sampled = idle.concat(walk, jog, chop, fish);
    writeClip(sampled, json, bin, "generic-human", 0, true);
} else if (process.argv[2] === "peasant") {
    const file = path.join("models", "kaykit", "peasant", "peasant.gltf");
    const { json, bin, dir } = loadGltf(file);
    const sampled = [bakeSkinned(json, bin, new Map())];
    writeClip(sampled, json, bin, "peasant", 0, true, path.join("models", "kaykit"), dir);
} else if (process.argv[2] === "mixamo-monster") {
    const idle = sampleClip(path.join("models", "monster-idle.glb"), 1);
    const walk = sampleClip(path.join("models", "monster-walk.glb"), 8);
    const hook = sampleClip(path.join("models", "monster-hook.glb"), 6);
    const sampled = idle.sampled.concat(walk.sampled, hook.sampled);
    writeClip(sampled, idle.json, idle.bin, "mixamo-monster", 0, true);
} else if (process.argv[2] === "mixamo-godwin") {
    const idle = sampleClip(path.join("models", "kaykit", "godwin-idle.glb"), 1);
    const walk = sampleClip(path.join("models", "kaykit", "godwin-walk.glb"), 8);
    const sampled = idle.sampled.concat(walk.sampled);
    writeClip(sampled, idle.json, idle.bin, "mixamo-godwin", 0, true);
} else if (process.argv[2] === "mixamo-peasant") {
    const idle = sampleClip(path.join("models", "kaykit", "mixamo-idle.glb"), 1);
    const walk = sampleClip(path.join("models", "kaykit", "mixamo-walk.glb"), 8);
    const sampled = idle.sampled.concat(walk.sampled);
    writeClip(sampled, idle.json, idle.bin, "mixamo-peasant", 0, true);
} else if (process.argv[2] === "outfit-innkeeper") {
    const rel = path.join(
        "models",
        "modular-outfits",
        "Modular Character Outfits - Fantasy[Standard]",
        "Exports",
        "glTF (Godot-Unreal)",
        "Outfits",
        "Male_Peasant.gltf"
    );
    const file = path.join(rel);
    const { json, bin, dir } = loadGltf(file);
    const sampled = [bakeSkinned(json, bin, new Map())];
    writeClip(sampled, json, bin, "outfit-innkeeper", 0, true, path.join("models", "kaykit"), dir);
} else if (process.argv[2] === "outfit-female-peasant") {
    const file = path.join(
        "models",
        "modular-outfits",
        "Modular Character Outfits - Fantasy[Standard]",
        "Exports",
        "glTF (Godot-Unreal)",
        "Outfits",
        "Female_Peasant.gltf"
    );
    const female = loadGltf(file);
    const human = loadGlb(path.join("models", "kaykit", "generic-human.glb"));
    const idle = [bakeSkinned(female.json, female.bin, new Map())];
    let duration = 0.0001;
    const walkAnim = (human.json.animations || []).find((a) => a.name === "Walk");
    if (walkAnim) {
        for (const sampler of walkAnim.samplers) {
            const times = accessor(human.json, human.bin, sampler.input);
            duration = Math.max(duration, times[times.length - 1]);
        }
    }
    const walkSampled = [];
    for (let i = 0; i < 8; i++) {
        const along = (i + 0.5) / 8;
        const pose = sampleAnim(human.json, human.bin, "Walk", duration * along);
        walkSampled.push(bakeSkinned(female.json, female.bin, pose));
    }
    const sampled = idle.concat(walkSampled);
    writeClip(sampled, female.json, female.bin, "outfit-female-peasant", 0, true, path.join("models", "kaykit"), female.dir);
} else if (process.argv[2] === "medieval-commander") {
    const file = path.join("models", "kaykit", "medieval-commander.glb");
    const { json, bin } = loadGlb(file);
    const sampled = [bakeSkinned(json, bin, new Map())];
    writeClip(sampled, json, bin, "medieval-commander", 0, true);
} else if (process.argv[2] === "medieval-innkeeper") {
    const file = path.join("models", "kaykit", "medieval-innkeeper.glb");
    const { json, bin } = loadGlb(file);
    const sampled = [bakeSkinned(json, bin, new Map())];
    writeClip(sampled, json, bin, "medieval-innkeeper", 0, true);
} else if (process.argv[2] === "medieval-king") {
    const file = path.join("models", "kaykit", "medieval-king.glb");
    const { json, bin } = loadGlb(file);
    const sampled = [bakeSkinned(json, bin, new Map())];
    writeClip(sampled, json, bin, "medieval-king", 0, true);
} else if (process.argv[2] && process.argv[2].startsWith("creature-static-")) {
    const id = process.argv[2].slice("creature-static-".length);
    const baseGlb = path.join("models", "creatures", "_glb", id + "-base.glb");
    const { json, bin } = loadGlb(baseGlb);
    const rest = bakeSkinned(json, bin, new Map());
    const sampled = [rest, rest, rest, rest, rest, rest, rest, rest, rest];
    writeClip(sampled, json, bin, id, 0, true, path.join("models", "creatures"));
} else if (process.argv[2] && process.argv[2].startsWith("creature-pair-")) {
    const id = process.argv[2].slice("creature-pair-".length);
    const dir = path.join("models", "creatures", "_glb");
    const baseGlb = path.join(dir, id + "-base.glb");
    const idleGlb = path.join(dir, id + "-idle.glb");
    const moveGlb = path.join(dir, id + "-move.glb");
    const idle = sampleClipOnBase(baseGlb, fs.existsSync(idleGlb) ? idleGlb : moveGlb, 1);
    const walk = sampleClipOnBase(baseGlb, moveGlb, 8);
    writeClip(idle.sampled.concat(walk.sampled), idle.json, idle.bin, id, 0, true, path.join("models", "creatures"));
} else if (process.argv[2] && process.argv[2].startsWith("creature-quad-")) {
    const id = process.argv[2].slice("creature-quad-".length);
    const dir = path.join("models", "creatures", "_glb");
    const idle = sampleClip(path.join(dir, id + "-idle.glb"), 1);
    const walk = sampleClip(path.join(dir, id + "-move.glb"), 8);
    if (idle.sampled[0].length !== walk.sampled[0].length) {
        throw new Error(id + " idle/move vertex mismatch — re-export Quaternius clips");
    }
    const sampled = idle.sampled.concat(walk.sampled);
    writeClip(sampled, idle.json, idle.bin, id, 0, true, path.join("models", "creatures"));
} else if (process.argv[2] && process.argv[2].startsWith("creature-")) {
    const id = process.argv[2].slice("creature-".length);
    const mergedGlb = path.join("models", "creatures", "_glb", id + "-merged.glb");
    const { json, bin } = loadGlb(mergedGlb);
    const animName = (json.animations && json.animations[0] && json.animations[0].name) || "Take 001";
    const idle = sampleNamed(json, bin, animName, 1);
    const walk = sampleNamed(json, bin, animName, 8);
    const sampled = idle.concat(walk);
    writeClip(sampled, json, bin, id, 0, true, path.join("models", "creatures"));
} else if (process.argv[2] === "archer") {
    const idle = sampleClip(path.join("models", "kaykit", "archer-idle.glb"), 1);
    const walk = sampleClip(path.join("models", "kaykit", "archer-walk.glb"), 8);
    const shoot = sampleClip(path.join("models", "kaykit", "archer-shoot.glb"), 6);
    const sampled = idle.sampled.concat(walk.sampled, shoot.sampled);
    const names = [...sampled[0].keys()].map((mat) => idle.json.materials[mat].name);
    let center = 0;
    names.forEach((name, index) => {
        if (/bow|arrow|quiver/i.test(name)) return;
        center = index;
    });
    console.log("parts", names.join(", "), "center", names[center]);
    writeClip(sampled, idle.json, idle.bin, "archer", center, true);
} else if (process.argv[2] === "fox" || process.argv[2] === "fox-full") {
    const file = path.join("models", "fox full.glb");
    const { json, bin } = loadGlb(file);
    const names = (json.animations || []).map((a) => a.name);
    console.log("animations", names.join(", "));
    const idle = sampleNamed(json, bin, "Idle", 1);
    const walk = sampleNamed(json, bin, "Walk", 8);
    const run = names.includes("Run") ? sampleNamed(json, bin, "Run", 8) : [];
    const sampled = idle.concat(walk, run);
    writeClip(sampled, json, bin, "fox-full", 0, true, path.join("models", "creatures"));
} else if (process.argv[2] === "eagle") {
    const file = path.join("models", "egle.glb");
    const { json, bin } = loadGlb(file);
    const names = (json.animations || []).map((a) => a.name);
    console.log("animations", names.join(", "));
    const idle = sampleNamed(json, bin, "Idle", 1);
    const move = sampleNamed(json, bin, names.includes("Walk") ? "Walk" : "Flap", 8);
    const sampled = idle.concat(move);
    writeClip(sampled, json, bin, "eagle", 0, true, path.join("models", "creatures"));
} else if (process.argv[2] === "snake") {
    const file = path.join("models", "snake.glb");
    const { json, bin } = loadGlb(file);
    const names = (json.animations || []).map((a) => a.name);
    console.log("animations", names.join(", "));
    const idle = sampleNamed(json, bin, "Idle", 1);
    const move = sampleNamed(json, bin, names.includes("Side_winding") ? "Side_winding" : "Idle", 8);
    const sampled = idle.concat(move);
    writeClip(sampled, json, bin, "snake", 0, true, path.join("models", "creatures"));
} else if (process.argv[2] === "horse2") {
    const file = path.join("models", "horse.glb");
    const { json, bin } = loadGlb(file);
    const names = (json.animations || []).map((a) => a.name);
    console.log("animations", names.join(", "));
    const idle = sampleNamed(json, bin, "Idle", 1);
    const walk = sampleNamed(json, bin, "Walk", 8);
    const trot = sampleNamed(json, bin, "Trot", 8);
    const run = names.includes("Run") ? sampleNamed(json, bin, "Run", 8) : [];
    const sampled = idle.concat(walk, trot, run);
    writeClip(sampled, json, bin, "horse2", 0, true, path.join("models", "horse"));
} else {
    const dir = path.join("models", "kaykit");
    bake(path.join(dir, "Knight.glb"), path.join(dir, "knight.bin"), path.join(dir, "knight.png"));
    bake(path.join(dir, "Rogue.glb"), path.join(dir, "rogue.bin"), path.join(dir, "rogue.png"));
}
