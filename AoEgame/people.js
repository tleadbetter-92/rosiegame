import * as THREE from "three";

function readSkin(buf) {
    const view = new DataView(buf);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (magic !== "SKN1") throw new Error("not a person mesh");
    const vertexCount = view.getUint32(4, true);
    const indexCount = view.getUint32(8, true);
    const boneCount = view.getUint32(12, true);
    const clipCount = view.getUint32(16, true);
    let o = 20;
    const vert = new Float32Array(buf, o, vertexCount * 16);
    o += vertexCount * 64;
    const indexBytes = indexCount * 2 + (indexCount % 2 ? 2 : 0);
    const indices = new Uint16Array(buf.slice(o, o + indexCount * 2));
    o += indexBytes;
    const clips = {};
    for (let c = 0; c < clipCount; c++) {
        const head = o;
        const nameLen = view.getUint8(head);
        let name = "";
        for (let i = 0; i < nameLen; i++) name += String.fromCharCode(view.getUint8(head + 1 + i));
        const frameCount = view.getUint32(head + 1 + nameLen, true);
        const duration = view.getFloat32(head + 5 + nameLen, true);
        o = (head + 1 + nameLen + 8 + 3) & ~3;
        const mats = new Float32Array(buf, o, frameCount * boneCount * 16);
        o += frameCount * boneCount * 64;
        clips[name] = { frameCount: frameCount, duration: duration, mats: mats };
    }
    return { vert: vert, indices: indices, vertexCount: vertexCount, boneCount: boneCount, clips: clips };
}

function poseGeometry(actor, clipName, frame) {
    const clip = actor.clips[clipName] || actor.clips.idle;
    const f = ((frame % clip.frameCount) + clip.frameCount) % clip.frameCount;
    const mats = clip.mats;
    const base = f * actor.boneCount * 16;
    const src = actor.vert;
    const count = actor.vertexCount;
    const pos = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    for (let v = 0; v < count; v++) {
        const s = v * 16;
        const x = src[s];
        const y = src[s + 1];
        const z = src[s + 2];
        let px = 0;
        let py = 0;
        let pz = 0;
        for (let k = 0; k < 4; k++) {
            const w = src[s + 12 + k];
            if (w <= 0) continue;
            const o = base + (src[s + 8 + k] | 0) * 16;
            px += w * (mats[o] * x + mats[o + 4] * y + mats[o + 8] * z + mats[o + 12]);
            py += w * (mats[o + 1] * x + mats[o + 5] * y + mats[o + 9] * z + mats[o + 13]);
            pz += w * (mats[o + 2] * x + mats[o + 6] * y + mats[o + 10] * z + mats[o + 14]);
        }
        pos[v * 3] = px;
        pos[v * 3 + 1] = py;
        pos[v * 3 + 2] = pz;
        uv[v * 2] = src[s + 6];
        uv[v * 2 + 1] = src[s + 7];
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geom.setIndex(new THREE.BufferAttribute(actor.indices, 1));
    geom.computeVertexNormals();
    return geom;
}

export async function loadPerson(binUrl, texUrl) {
    const [buf, tex] = await Promise.all([
        fetch(binUrl).then((res) => {
            if (!res.ok) throw new Error(binUrl);
            return res.arrayBuffer();
        }),
        new Promise((resolve, reject) => {
            new THREE.TextureLoader().load(texUrl, (texture) => {
                texture.flipY = false;
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.magFilter = THREE.LinearFilter;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                resolve(texture);
            }, undefined, reject);
        })
    ]);
    const actor = readSkin(buf);
    actor.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.02 });
    actor.frames = {
        idle: [poseGeometry(actor, "idle", 0)],
        walk: [],
        punch: []
    };
    const walk = actor.clips.walk;
    const steps = walk ? Math.min(walk.frameCount, 10) : 1;
    for (let i = 0; i < steps; i++) {
        const frame = walk ? Math.floor(i * walk.frameCount / steps) : 0;
        actor.frames.walk.push(poseGeometry(actor, walk ? "walk" : "idle", frame));
    }
    const punch = actor.clips.punch;
    if (punch) {
        const swings = Math.min(punch.frameCount, 8);
        for (let i = 0; i < swings; i++) {
            actor.frames.punch.push(poseGeometry(actor, "punch", Math.floor(i * punch.frameCount / swings)));
        }
    }
    return actor;
}

export function personMesh(actor) {
    const mesh = new THREE.Mesh(actor.frames.idle[0], actor.material);
    mesh.castShadow = true;
    mesh.userData.actor = actor;
    return mesh;
}
