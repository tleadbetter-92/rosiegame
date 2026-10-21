import { NodeIO } from "@gltf-transform/core";
import { copyToDocument } from "@gltf-transform/functions";

const [basePath, animPath, outPath] = process.argv.slice(2);
if (!basePath || !animPath || !outPath) {
    console.error("Usage: node tools/merge-creature-glb.mjs base.glb anim.glb out.glb");
    process.exit(1);
}

const io = new NodeIO();
const base = await io.read(basePath);
const animDoc = await io.read(animPath);
const anims = animDoc.getRoot().listAnimations();
if (!anims.length) {
    console.error("No animations in", animPath);
    process.exit(1);
}
await base.transform(copyToDocument(anims));
await io.write(outPath, base);
console.log(
    "Wrote",
    outPath,
    "animations:",
    base
        .getRoot()
        .listAnimations()
        .map((a) => a.getName())
        .join(", ")
);
