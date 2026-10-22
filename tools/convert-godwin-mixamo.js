/**
 * Mixamo Godwin (peasant girl 2): FBX → GLB in models/kaykit/
 * Expects With Skin export in models/:
 *   idle woman2.fbx  (required)
 * Optional walk: walk woman2.fbx — if missing, walk GLB is copied from idle (innkeeper stays idle).
 * Then: node tools/bake-kaykit.js mixamo-godwin
 */
const fs = require("fs");
const path = require("path");
const convert = require("fbx2gltf");

const root = path.join(__dirname, "..");
const models = path.join(root, "models");
const kaykit = path.join(root, "models", "kaykit");

const idleCandidates = ["idle woman2.fbx", "Idle woman2.fbx"];
const walkCandidates = ["walk woman2.fbx", "walking woman2.fbx", "Walking woman2.fbx", "Walk woman2.fbx"];

function pick(candidates) {
    for (const name of candidates) {
        const p = path.join(models, name);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

async function main() {
    const idleFbx = pick(idleCandidates);
    const walkFbx = pick(walkCandidates);
    if (!idleFbx) {
        console.error("Missing idle FBX — copy With Skin export to models/ as one of:", idleCandidates.join(", "));
        process.exit(1);
    }
    fs.mkdirSync(kaykit, { recursive: true });
    const idleGlb = path.join(kaykit, "godwin-idle.glb");
    const walkGlb = path.join(kaykit, "godwin-walk.glb");
    await convert(idleFbx, idleGlb);
    console.log("Wrote", idleGlb);
    if (walkFbx) {
        await convert(walkFbx, walkGlb);
        console.log("Wrote", walkGlb);
    } else {
        fs.copyFileSync(idleGlb, walkGlb);
        console.log("No walk FBX — copied idle to", walkGlb, "(Godwin idle-only until walk is added)");
    }
    console.log("Next: node tools/bake-kaykit.js mixamo-godwin");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
