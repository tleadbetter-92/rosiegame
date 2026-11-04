import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

const PACK_TREES = [
    "BirchTree_1.fbx", "BirchTree_2.fbx", "BirchTree_3.fbx", "BirchTree_4.fbx", "BirchTree_5.fbx",
    "BirchTree_Autumn_1.fbx", "BirchTree_Autumn_2.fbx", "BirchTree_Autumn_3.fbx", "BirchTree_Autumn_4.fbx", "BirchTree_Autumn_5.fbx",
    "BirchTree_Dead_1.fbx", "BirchTree_Dead_2.fbx", "BirchTree_Dead_3.fbx", "BirchTree_Dead_4.fbx", "BirchTree_Dead_5.fbx",
    "CommonTree_1.fbx", "CommonTree_2.fbx", "CommonTree_3.fbx", "CommonTree_4.fbx", "CommonTree_5.fbx",
    "CommonTree_Autumn_1.fbx", "CommonTree_Autumn_2.fbx", "CommonTree_Autumn_3.fbx", "CommonTree_Autumn_4.fbx", "CommonTree_Autumn_5.fbx",
    "CommonTree_Dead_1.fbx", "CommonTree_Dead_2.fbx", "CommonTree_Dead_3.fbx", "CommonTree_Dead_4.fbx", "CommonTree_Dead_5.fbx",
    "PalmTree_1.fbx", "PalmTree_2.fbx", "PalmTree_3.fbx", "PalmTree_4.fbx",
    "PineTree_1.fbx", "PineTree_2.fbx", "PineTree_3.fbx", "PineTree_4.fbx", "PineTree_5.fbx",
    "PineTree_Autumn_1.fbx", "PineTree_Autumn_2.fbx", "PineTree_Autumn_3.fbx", "PineTree_Autumn_4.fbx", "PineTree_Autumn_5.fbx",
    "Willow_1.fbx", "Willow_2.fbx", "Willow_3.fbx", "Willow_4.fbx", "Willow_5.fbx",
    "Willow_Autumn_1.fbx", "Willow_Autumn_2.fbx", "Willow_Autumn_3.fbx", "Willow_Autumn_4.fbx", "Willow_Autumn_5.fbx",
    "Willow_Dead_1.fbx", "Willow_Dead_2.fbx", "Willow_Dead_3.fbx", "Willow_Dead_4.fbx", "Willow_Dead_5.fbx"
];

const TREE_TALL = 14 * 1.3;

export function treeRoll(x, z) {
    let n = Math.imul(Math.round(x), 374761393) ^ Math.imul(Math.round(z), 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n >>> 0) / 4294967296;
}

function fitTree(root) {
    root.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const list = Array.isArray(child.material) ? child.material : [child.material];
        list.forEach((mat) => {
            if ("metalness" in mat) mat.metalness = 0;
            if ("roughness" in mat) mat.roughness = 1;
            mat.side = THREE.DoubleSide;
            if (child.geometry && child.geometry.getAttribute("color")) mat.vertexColors = true;
        });
    });
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const height = box.max.y - box.min.y;
    const fit = height > 0.001 ? TREE_TALL / height : 1;
    const group = new THREE.Group();
    root.scale.multiplyScalar(fit);
    root.position.set(
        -(box.min.x + box.max.x) * 0.5 * fit,
        -box.min.y * fit,
        -(box.min.z + box.max.z) * 0.5 * fit
    );
    group.add(root);
    return group;
}

let loading = null;

export function loadPackTrees() {
    if (!loading) {
        const loader = new FBXLoader();
        loading = Promise.all(PACK_TREES.map((name) => new Promise((resolve) => {
            loader.load("FBX/" + encodeURIComponent(name), (root) => {
                resolve(fitTree(root));
            }, undefined, () => resolve(null));
        }))).then((list) => list.filter(Boolean));
    }
    return loading;
}

export function packTree(models, x, z) {
    const roll = treeRoll(x, z);
    return models[Math.floor(roll * models.length) % models.length];
}
