/**
 * Quaternius Creatures FBX → GLB → game .bin (via bake-kaykit).
 * Usage: node tools/bake-creature.js [all|wolf|deer|...]
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const convert = require("fbx2gltf");

const root = path.join(__dirname, "..");
const fbxRoot = path.join(root, "models", "Creatures_FBX", "Creatures");
const outDir = path.join(root, "models", "creatures");
const tmpDir = path.join(outDir, "_glb");

/** id, folder, locomotion clip name (FBX suffix after @) */
const CREATURES = [
    { id: "wolf", group: "Beasts", move: "Walk" },
    { id: "bear", group: "Beasts", move: "Walk" },
    { id: "deer", group: "Beasts", move: "Walk" },
    { id: "mammoth", group: "Beasts", move: "Walk" },
    { id: "rat", group: "Beasts", move: "Walk" },
    { id: "rhino", group: "Beasts", move: "Walk" },
    { id: "warg", group: "Beasts", move: "Walk" },
    { id: "ooze", group: "Beasts", move: "Crawl" },
    { id: "spider", group: "Insectoids", move: "Walk" },
    { id: "centipede", group: "Insectoids", move: "Walk" },
    { id: "wasp", group: "Insectoids", move: "Fly" }
];

function fbxName(id) {
    return id.charAt(0).toUpperCase() + id.slice(1);
}

function modelPath(group, name) {
    return path.join(fbxRoot, group, "Models", name + ".fbx");
}

function animPath(group, name, clip) {
    return path.join(fbxRoot, group, "Models", "Anims", name + "@" + clip + ".fbx");
}

async function convertPair(spec) {
    const name = fbxName(spec.id);
    const baseFbx = modelPath(spec.group, name);
    const moveFbx = animPath(spec.group, name, spec.move);
    const idleFbx = animPath(spec.group, name, "Idle");
    if (!fs.existsSync(baseFbx)) throw new Error("Missing " + baseFbx);
    if (!fs.existsSync(moveFbx)) throw new Error("Missing " + moveFbx);
    fs.mkdirSync(tmpDir, { recursive: true });
    const baseGlb = path.join(tmpDir, spec.id + "-base.glb");
    const moveGlb = path.join(tmpDir, spec.id + "-move.glb");
    const idleGlb = path.join(tmpDir, spec.id + "-idle.glb");
    await convert(baseFbx, baseGlb);
    await convert(moveFbx, moveGlb);
    if (fs.existsSync(idleFbx)) await convert(idleFbx, idleGlb);
    try {
        execSync(
            `node tools/merge-creature-glb.mjs "${baseGlb}" "${moveGlb}" "${path.join(tmpDir, spec.id + "-merged.glb")}"`,
            { cwd: root, stdio: "pipe" }
        );
    } catch {
        /* merge needs Node 20+ (sharp); static bake still works */
    }
    return { baseGlb, moveGlb };
}

function mergedHasAnim(mergedPath) {
    if (!fs.existsSync(mergedPath)) return false;
    try {
        const b = fs.readFileSync(mergedPath);
        const j = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)));
        return !!(j.animations && j.animations.length && j.meshes && j.meshes.length);
    } catch {
        return false;
    }
}

function copyPackTexture(spec) {
    const name = fbxName(spec.id);
    const src = path.join(fbxRoot, spec.group, "Textures", "T_" + name + ".png");
    const dest = path.join(outDir, spec.id + "-0.png");
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

function bakeFromGlb(spec) {
    const id = spec.id;
    const merged = path.join(tmpDir, id + "-merged.glb");
    if (mergedHasAnim(merged)) {
        execSync(`node tools/bake-kaykit.js creature-${id}`, { cwd: root, stdio: "inherit" });
    } else {
        execSync(`node tools/bake-kaykit.js creature-pair-${id}`, { cwd: root, stdio: "inherit" });
    }
    copyPackTexture(spec);
}

async function bakeOne(spec) {
    console.log("\n===", spec.id, "===");
    await convertPair(spec);
    bakeFromGlb(spec);
    console.log("Done", spec.id);
}

async function main() {
    const arg = (process.argv[2] || "all").toLowerCase();
    fs.mkdirSync(outDir, { recursive: true });
    const list = arg === "all" ? CREATURES : CREATURES.filter((c) => c.id === arg);
    if (!list.length) {
        console.error("Unknown creature. Pick one of:", CREATURES.map((c) => c.id).join(", "), "or all");
        process.exit(1);
    }
    for (const spec of list) {
        try {
            await bakeOne(spec);
        } catch (err) {
            console.error(spec.id, "FAILED:", err.message || err);
        }
    }
    console.log("\nBaked meshes in models/creatures/ (stem-0.bin + stem-0.png).");
}

main();
