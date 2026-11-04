import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MAP_BUILDINGS, MAP_KINDS, MAP_TOKEN, TREE_CARDS, kindById, loadKitShell, makeMapShape, makeStandIn, plantModel } from "./map-props.js?v=obj5";
import { PATHS, flushPathPaint, loadPathPaint, paintPath, pathSaveBody, setPathFrame, useGroundLook } from "./ground-look.js?v=look2";

const SEA = 141;
const note = document.getElementById("note");
const list = document.getElementById("kinds");
const rockList = document.getElementById("rocks");
const treeList = document.getElementById("trees");
const buildingList = document.getElementById("buildings");
const saveBtn = document.getElementById("save");
const copyBtn = document.getElementById("copy");
const pasteBtn = document.getElementById("paste");
const eraseBtn = document.getElementById("erase");
const keepBtn = document.getElementById("keep");
const dropBtn = document.getElementById("drop");
const nameInput = document.getElementById("copy-name");
const copyList = document.getElementById("copies");
const boxEl = document.getElementById("box");
const pathList = document.getElementById("paths");
const brushInput = document.getElementById("brush");
const brushRead = document.getElementById("brush-read");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec8ee);
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3d6b28, 1.15));
const sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
sun.position.set(40, 80, 20);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 9000);
const look = new THREE.Vector3(0, 120, 0);
const pitch = 1.05;
let yaw = 0;
let dist = 220;
const limit = 1024;

const placed = new THREE.Group();
scene.add(placed);
const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.05, 28),
    new THREE.MeshBasicMaterial({ color: 0xf0d080, side: THREE.DoubleSide, depthTest: false })
);
ring.rotation.x = -Math.PI / 2;
ring.visible = false;
ring.renderOrder = 2;
scene.add(ring);
const brushRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 40),
    new THREE.MeshBasicMaterial({ color: 0xf0d080, side: THREE.DoubleSide, depthTest: false })
);
brushRing.rotation.x = -Math.PI / 2;
brushRing.visible = false;
brushRing.renderOrder = 3;
scene.add(brushRing);

const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let surface = null;
let sea = null;
let kind = TREE_CARDS[0];
let objects = [];
let nextId = 1;
let picked = [];
let clip = null;
let stamps = [];
let stamp = null;
let stampYaw = 0;
let fromStamp = false;
let erasing = false;
let dirty = false;
let pathDirty = false;
let pathTool = null;
let painting = false;
let lastPaint = null;
let mouseX = 0;
let mouseY = 0;
const templates = {};
const marks = new THREE.Group();
scene.add(marks);

function say(text) {
    note.textContent = text;
}

function placeCamera() {
    const cp = Math.cos(pitch);
    const aimY = look.y + 8;
    camera.position.set(
        look.x + Math.sin(yaw) * cp * dist,
        aimY + Math.sin(pitch) * dist,
        look.z + Math.cos(yaw) * cp * dist
    );
    camera.lookAt(look.x, aimY, look.z);
}

function panBy(dx, dy, scale) {
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const foreX = -Math.sin(yaw);
    const foreZ = -Math.cos(yaw);
    look.x = Math.max(-limit, Math.min(limit, look.x + (-dx * rightX + dy * foreX) * scale));
    look.z = Math.max(-limit, Math.min(limit, look.z + (-dx * rightZ + dy * foreZ) * scale));
}

function mapScale() {
    const half = Math.tan((camera.fov * Math.PI / 180) / 2);
    const reach = dist / Math.max(0.45, Math.sin(pitch));
    return (2 * half * reach) / Math.max(1, renderer.domElement.clientHeight);
}

function clearErase() {
    erasing = false;
    eraseBtn.classList.remove("on");
}

function choose(item, button) {
    kind = item;
    stamp = null;
    fromStamp = false;
    clearErase();
    [treeList, buildingList, list, copyList].forEach((box) => {
        const buttons = box.querySelectorAll("button");
        for (let i = 0; i < buttons.length; i++) buttons[i].classList.toggle("on", buttons[i] === button);
    });
}

MAP_BUILDINGS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.name;
    button.addEventListener("click", () => choose(item, button));
    buildingList.appendChild(button);
});

TREE_CARDS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.title = item.file.split("/").pop();
    const img = document.createElement("img");
    img.alt = "";
    img.src = encodeURI(item.file);
    const label = document.createElement("span");
    label.textContent = item.name;
    button.appendChild(img);
    button.appendChild(label);
    button.addEventListener("click", () => choose(item, button));
    treeList.appendChild(button);
});
treeList.children[0].classList.add("on");

MAP_KINDS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.file || item.shape ? item.name : item.name + " (stand-in)";
    button.addEventListener("click", () => choose(item, button));
    (item.shape || item.id.indexOf("rock") === 0 ? rockList : list).appendChild(button);
});

function markDirty() {
    dirty = true;
    saveBtn.textContent = "Save";
}

function setPicked(items) {
    picked = items.filter(Boolean);
    while (marks.children.length) marks.remove(marks.children[0]);
    picked.forEach((item) => {
        const mark = ring.clone();
        mark.visible = true;
        mark.position.set(item.mesh.position.x, item.mesh.position.y + 0.4, item.mesh.position.z);
        marks.add(mark);
    });
    ring.visible = false;
}

function copyPicked() {
    if (!picked.length) {
        say("Highlight some trees first, then copy.");
        return;
    }
    let cx = 0;
    let cz = 0;
    picked.forEach((item) => {
        cx += item.x;
        cz += item.z;
    });
    cx /= picked.length;
    cz /= picked.length;
    clip = picked.map((item) => ({
        kind: item.kind,
        dx: item.x - cx,
        dz: item.z - cz,
        yaw: item.yaw,
        scale: item.scale
    }));
    stamp = null;
    stampYaw = 0;
    fromStamp = false;
    copyList.querySelectorAll("button").forEach((button) => button.classList.remove("on"));
    say("Copied " + clip.length + ". Type a name and Keep, or paste it where you are looking.");
}

function loadCard(url) {
    return new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(encodeURI(url), (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            const image = texture.image;
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0);
            const data = ctx.getImageData(0, 0, image.width, image.height).data;
            let bottom = image.height - 1;
            for (let y = image.height - 1; y >= 0; y--) {
                let hit = false;
                for (let x = 0; x < image.width; x += 2) {
                    if (data[(y * image.width + x) * 4 + 3] > 24) {
                        hit = true;
                        break;
                    }
                }
                if (hit) {
                    bottom = y;
                    break;
                }
            }
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: texture,
                color: new THREE.Color(6.5, 6.5, 6.5),
                transparent: true,
                alphaTest: 0.2,
                depthWrite: true
            }));
            const tall = 14 * 1.3;
            sprite.scale.set(tall, tall * image.height / image.width, 1);
            sprite.center.set(0.5, (image.height - 1 - bottom) / image.height);
            resolve(sprite);
        }, undefined, reject);
    });
}

async function templateFor(itemKind) {
    if (templates[itemKind.id]) return templates[itemKind.id];
    if (itemKind.card) {
        templates[itemKind.id] = await loadCard(itemKind.file);
        return templates[itemKind.id];
    }
    if (itemKind.shape) {
        templates[itemKind.id] = makeMapShape(itemKind);
        return templates[itemKind.id];
    }
    if (itemKind.kit) {
        templates[itemKind.id] = await loadKitShell(itemKind.kit);
        return templates[itemKind.id];
    }
    if (!itemKind.file) {
        templates[itemKind.id] = makeStandIn(itemKind);
        return templates[itemKind.id];
    }
    const gltf = await new Promise((resolve, reject) => {
        loader.load(itemKind.file, resolve, undefined, reject);
    });
    templates[itemKind.id] = plantModel(gltf.scene);
    return templates[itemKind.id];
}

async function addObject(itemKind, x, z, y, yaw, scale, fromFile) {
    const mesh = (await templateFor(itemKind)).clone(true);
    if (itemKind.card) mesh.scale.multiplyScalar(scale);
    else mesh.scale.setScalar(scale);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    mesh.userData.placed = true;
    mesh.traverse((child) => {
        child.userData.placed = true;
    });
    placed.add(mesh);
    const item = { id: nextId++, kind: itemKind.id, x: x, z: z, yaw: yaw, scale: scale, mesh: mesh };
    mesh.userData.item = item;
    objects.push(item);
    if (!fromFile) {
        markDirty();
        setPicked([item]);
        say(itemKind.name + " placed. Save writes it into the match.");
    }
    return item;
}

async function pastePieces(pieces, x, z, spin) {
    if (!pieces || !pieces.length) {
        say("Copy a highlighted group first.");
        return;
    }
    const c = Math.cos(spin || 0);
    const s = Math.sin(spin || 0);
    const added = [];
    for (let i = 0; i < pieces.length; i++) {
        const item = pieces[i];
        const itemKind = kindById(item.kind);
        if (!itemKind) continue;
        const px = x + item.dx * c - item.dz * s;
        const pz = z + item.dx * s + item.dz * c;
        const py = groundY(px, pz);
        if (py < SEA + 0.4) continue;
        added.push(await addObject(itemKind, px, pz, py, (Number(item.yaw) || 0) + (spin || 0), item.scale, true));
    }
    if (!added.length) {
        say("That spot is in the water.");
        return;
    }
    markDirty();
    fromStamp = !!stamp;
    setPicked(added);
    const turned = stamp ? " " + stamp.name + " at " + turnDegrees() + "°." : "";
    say("Pasted " + added.length + "." + turned + " Save writes them into the match.");
}

function pasteAt(x, z) {
    if (stamp) return pastePieces(stamp.pieces, x, z, stampYaw);
    return pastePieces(clip, x, z, 0);
}

function turnDegrees() {
    let degrees = Math.round((stampYaw * 180) / Math.PI) % 360;
    if (degrees < 0) degrees += 360;
    return degrees;
}

function paintStamps(selectId) {
    while (copyList.children.length) copyList.removeChild(copyList.children[0]);
    stamps.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item.name;
        if (item.id === selectId) button.classList.add("on");
        button.addEventListener("click", () => selectStamp(item, button));
        copyList.appendChild(button);
    });
}

function selectStamp(item, button) {
    stamp = item;
    stampYaw = 0;
    fromStamp = false;
    clearErase();
    setPicked([]);
    [treeList, buildingList, list, copyList].forEach((box) => {
        box.querySelectorAll("button").forEach((one) => one.classList.remove("on"));
    });
    button.classList.add("on");
    nameInput.value = item.name;
    say(item.name + ". Q and E turn it, then click the ground.");
}

function loadStamps() {
    return fetch("map-groups.json", { cache: "no-store" }).then((res) => res.ok ? res.json() : { groups: [] }).then((data) => {
        stamps = data && Array.isArray(data.groups) ? data.groups : [];
        paintStamps(stamp ? stamp.id : "");
        if (stamp) stamp = stamps.find((item) => item.id === stamp.id) || null;
    }).catch(() => {
        stamps = [];
    });
}

function keepCopy() {
    if (picked.length) copyPicked();
    if (!clip || !clip.length) {
        say("Highlight some trees first, then copy.");
        return;
    }
    const name = nameInput.value.trim();
    if (!name) {
        say("Type a name, such as Oak forest.");
        nameInput.focus();
        return;
    }
    keepBtn.disabled = true;
    fetch("/api/map-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, pieces: clip })
    }).then((res) => res.json().then((data) => ({ ok: res.ok, data: data }))).then((result) => {
        keepBtn.disabled = false;
        if (!result.ok) {
            say(result.data.error || "That copy was not kept.");
            return;
        }
        stamps = result.data.groups || [];
        paintStamps(result.data.id);
        stamp = stamps.find((item) => item.id === result.data.id) || null;
        stampYaw = 0;
        fromStamp = false;
        setPicked([]);
        say(result.data.name + " kept (" + result.data.count + "). Q and E turn it, then click the ground.");
    }).catch(() => {
        keepBtn.disabled = false;
        say("That copy was not kept. The local server needs to be running.");
    });
}

function dropCopy() {
    if (!stamp) {
        say("Click a saved copy first.");
        return;
    }
    const name = stamp.name;
    dropBtn.disabled = true;
    fetch("/api/map-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delete: stamp.id })
    }).then((res) => res.json().then((data) => ({ ok: res.ok, data: data }))).then((result) => {
        dropBtn.disabled = false;
        if (!result.ok) {
            say(result.data.error || "That copy is still saved.");
            return;
        }
        stamps = result.data.groups || [];
        stamp = null;
        stampYaw = 0;
        paintStamps("");
        say(name + " dropped.");
    }).catch(() => {
        dropBtn.disabled = false;
        say("That copy is still saved.");
    });
}

function groundAt(clientX, clientY) {
    if (!surface) return null;
    hitPoint({ clientX: clientX, clientY: clientY });
    const hits = raycaster.intersectObjects([surface, sea].filter(Boolean), false);
    return hits.length ? hits[0].point : null;
}

function hitPoint(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
}

function placedRoot(object) {
    let current = object;
    while (current) {
        if (current.userData && current.userData.item) return current.userData.item;
        current = current.parent;
    }
    return null;
}

async function onClick(event) {
    if (!surface) return;
    hitPoint(event);
    const objectHits = raycaster.intersectObjects(placed.children, true);
    if (erasing) {
        if (objectHits.length) {
            const item = placedRoot(objectHits[0].object);
            if (item) {
                setPicked([item]);
                removeSelected();
            }
        } else say("Click a tree to erase it.");
        return;
    }
    if (objectHits.length) {
        const item = placedRoot(objectHits[0].object);
        if (item) {
            if (event.shiftKey && picked.indexOf(item) >= 0) setPicked(picked.filter((one) => one !== item));
            else if (event.shiftKey) setPicked(picked.concat([item]));
            else setPicked([item]);
            say(picked.length + " highlighted. Copy, then paste, repeats them.");
            return;
        }
    }
    const groundHits = raycaster.intersectObjects([surface, sea].filter(Boolean), false);
    if (!groundHits.length) return;
    const hit = groundHits[0];
    if (hit.object === sea || hit.point.y < SEA + 0.4) {
        say("That spot is in the water.");
        return;
    }
    if (stamp) {
        await pasteAt(hit.point.x, hit.point.z);
        return;
    }
    const spin = kind.kit ? 0 : Math.random() * Math.PI * 2;
    try {
        await addObject(kind, hit.point.x, hit.point.z, hit.point.y, spin, 1, false);
    } catch (err) {
        say("That one did not load.");
    }
}

function removeSelected() {
    if (!picked.length) return;
    const count = picked.length;
    picked.forEach((item) => placed.remove(item.mesh));
    objects = objects.filter((item) => picked.indexOf(item) < 0);
    setPicked([]);
    markDirty();
    say("Erased " + count + ". Save writes the change into the match.");
}

function turnSelected(delta) {
    if (picked.length > 1) {
        let cx = 0;
        let cz = 0;
        picked.forEach((item) => {
            cx += item.x;
            cz += item.z;
        });
        cx /= picked.length;
        cz /= picked.length;
        const c = Math.cos(delta);
        const s = Math.sin(delta);
        picked.forEach((item) => {
            const dx = item.x - cx;
            const dz = item.z - cz;
            item.x = cx + dx * c - dz * s;
            item.z = cz + dx * s + dz * c;
            item.yaw += delta;
            item.mesh.position.set(item.x, groundY(item.x, item.z), item.z);
            item.mesh.rotation.y = item.yaw;
        });
        markDirty();
        if (fromStamp && stamp) {
            stampYaw += delta;
            say(stamp.name + " turned " + turnDegrees() + "°.");
        }
        return;
    }
    if (picked.length === 1) {
        const item = picked[0];
        item.yaw += delta;
        item.mesh.rotation.y = item.yaw;
        markDirty();
        return;
    }
    if (!stamp) return;
    stampYaw += delta;
    say(stamp.name + " turned " + turnDegrees() + "°. Click the ground.");
}

function sizeSelected(factor) {
    if (!picked.length) return;
    picked.forEach((item) => {
        item.scale = Math.max(0.4, Math.min(3, item.scale * factor));
        if (kindById(item.kind).card) {
            const base = templates[item.kind];
            item.mesh.scale.copy(base.scale).multiplyScalar(item.scale);
        } else item.mesh.scale.setScalar(item.scale);
    });
    markDirty();
}

function brushMetres() {
    return Number(brushInput.value) || 5;
}

function showPathButtons() {
    pathList.querySelectorAll("button").forEach((button) => {
        button.classList.toggle("on", button.dataset.path === String(pathTool));
    });
}

function choosePath(next) {
    pathTool = pathTool === next ? null : next;
    showPathButtons();
    brushRing.visible = pathTool !== null;
    if (pathTool === null) say("Path brush is off. Click the ground to place the chosen object.");
    else if (pathTool === "lift") say("Lift is on. Drag to rub a path back to grass.");
    else say(PATHS[pathTool].name + ". Drag on the ground. Save writes the path.");
}

PATHS.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.path = String(index);
    const img = document.createElement("img");
    img.src = item.file;
    img.alt = "";
    button.append(img, document.createTextNode(item.name));
    button.addEventListener("click", () => choosePath(index));
    pathList.appendChild(button);
});
const liftButton = document.createElement("button");
liftButton.type = "button";
liftButton.dataset.path = "lift";
liftButton.textContent = "Lift";
liftButton.addEventListener("click", () => choosePath("lift"));
pathList.appendChild(liftButton);
brushInput.addEventListener("input", () => {
    brushRead.textContent = brushMetres() + " m";
});

function savePaths() {
    if (!pathDirty) return Promise.resolve(true);
    return fetch("/api/map-paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pathSaveBody())
    }).then((res) => res.json().then((data) => ({ ok: res.ok, data: data }))).then((result) => {
        if (!result.ok) {
            say(result.data.error || "The path did not save.");
            return false;
        }
        pathDirty = false;
        return true;
    }).catch(() => {
        say("The path did not save. The local server needs to be running.");
        return false;
    });
}

saveBtn.addEventListener("click", () => {
    saveBtn.disabled = true;
    const body = {
        map: MAP_TOKEN,
        objects: objects.map((item) => ({ kind: item.kind, x: item.x, z: item.z, yaw: item.yaw, scale: item.scale }))
    };
    fetch("/api/map-objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }).then((res) => res.json().then((data) => ({ ok: res.ok, data: data }))).then((result) => {
        if (!result.ok) {
            saveBtn.disabled = false;
            say(result.data.error || "Save failed.");
            return;
        }
        dirty = false;
        return savePaths().then((pathsOk) => {
            saveBtn.disabled = false;
            if (!pathsOk) return;
            say("Saved " + result.data.count + " objects. Reload the match to see them.");
        });
    }).catch(() => {
        saveBtn.disabled = false;
        say("Save failed. The local server needs to be running.");
    });
});

const keys = {};
copyBtn.addEventListener("click", copyPicked);
eraseBtn.addEventListener("click", () => {
    if (picked.length) {
        removeSelected();
        erasing = true;
        eraseBtn.classList.add("on");
        return;
    }
    erasing = !erasing;
    eraseBtn.classList.toggle("on", erasing);
    say(erasing ? "Erase is on. Click a tree, or drag a box around several." : "Erase is off.");
});
pasteBtn.addEventListener("click", () => {
    const point = groundAt(mouseX, mouseY) || { x: look.x, y: groundY(look.x, look.z), z: look.z };
    pasteAt(point.x, point.z);
});
keepBtn.addEventListener("click", keepCopy);
dropBtn.addEventListener("click", dropCopy);
nameInput.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
        event.preventDefault();
        keepCopy();
    }
});
loadStamps();

window.addEventListener("keydown", (event) => {
    if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) return;
    keys[event.key.toLowerCase()] = true;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "c") {
        copyPicked();
        event.preventDefault();
        return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "v") {
        const point = groundAt(mouseX, mouseY) || { x: look.x, y: groundY(look.x, look.z), z: look.z };
        pasteAt(point.x, point.z);
        event.preventDefault();
        return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
        removeSelected();
        event.preventDefault();
    } else if (event.key.toLowerCase() === "q") {
        turnSelected(-0.15);
    } else if (event.key.toLowerCase() === "e") {
        turnSelected(0.15);
    } else if (event.key === "[") {
        sizeSelected(0.9);
    } else if (event.key === "]") {
        sizeSelected(1.1);
    }
});
window.addEventListener("keyup", (event) => {
    keys[event.key.toLowerCase()] = false;
});
window.addEventListener("beforeunload", (event) => {
    if (!dirty && !pathDirty) return;
    event.preventDefault();
    event.returnValue = "";
});

let rightDrag = false;
let leftDown = false;
let boxDrag = false;
let panX = 0;
let panY = 0;
let downX = 0;
let downY = 0;
let pickAtDrag = [];

function screenOf(point) {
    const v = point.clone().project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
        x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-v.y * 0.5 + 0.5) * rect.height
    };
}

function insideBox(item, left, top, right, bottom) {
    const base = item.mesh.position.clone();
    const crown = base.clone();
    crown.y += 18 * (item.scale || 1);
    const points = [screenOf(base), screenOf(crown)];
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p.x >= left && p.x <= right && p.y >= top && p.y <= bottom) return true;
    }
    return false;
}

function showBox(x0, y0, x1, y1) {
    const left = Math.min(x0, x1);
    const top = Math.min(y0, y1);
    boxEl.hidden = false;
    boxEl.style.left = left + "px";
    boxEl.style.top = top + "px";
    boxEl.style.width = Math.abs(x1 - x0) + "px";
    boxEl.style.height = Math.abs(y1 - y0) + "px";
}

function followBrush(clientX, clientY) {
    if (pathTool === null) {
        brushRing.visible = false;
        return;
    }
    const point = groundAt(clientX, clientY);
    if (!point) return;
    brushRing.visible = true;
    brushRing.position.set(point.x, point.y + 0.45, point.z);
    brushRing.scale.setScalar(brushMetres());
}

function paintStroke(clientX, clientY) {
    const point = groundAt(clientX, clientY);
    if (!point || point.y < SEA + 0.4) return;
    const radius = brushMetres();
    const channel = pathTool === "lift" ? -1 : pathTool;
    const stamps = [];
    if (!lastPaint) stamps.push(point);
    else {
        const gap = Math.hypot(point.x - lastPaint.x, point.z - lastPaint.z);
        const step = Math.max(0.35, radius * 0.35);
        const count = Math.max(1, Math.ceil(gap / step));
        for (let i = 1; i <= count; i++) {
            const t = i / count;
            stamps.push({
                x: lastPaint.x + (point.x - lastPaint.x) * t,
                z: lastPaint.z + (point.z - lastPaint.z) * t
            });
        }
    }
    stamps.forEach((spot) => paintPath(spot.x, spot.z, radius, channel));
    lastPaint = { x: point.x, z: point.z };
    pathDirty = true;
    followBrush(clientX, clientY);
}

renderer.domElement.addEventListener("pointerdown", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (event.button === 2) {
        rightDrag = true;
        panX = event.clientX;
        panY = event.clientY;
    }
    if (event.button === 0 && pathTool !== null) {
        painting = true;
        lastPaint = null;
        paintStroke(event.clientX, event.clientY);
        return;
    }
    if (event.button === 0) {
        leftDown = true;
        boxDrag = false;
        downX = event.clientX;
        downY = event.clientY;
        pickAtDrag = event.shiftKey ? picked.slice() : [];
    }
});
window.addEventListener("pointerup", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (event.button === 2) rightDrag = false;
    if (event.button === 0 && painting) {
        painting = false;
        lastPaint = null;
        return;
    }
    if (event.button === 0 && leftDown) {
        leftDown = false;
        if (boxDrag) {
            boxDrag = false;
            boxEl.hidden = true;
            const left = Math.min(downX, event.clientX);
            const right = Math.max(downX, event.clientX);
            const top = Math.min(downY, event.clientY);
            const bottom = Math.max(downY, event.clientY);
            const found = objects.filter((item) => insideBox(item, left, top, right, bottom));
            const merged = pickAtDrag.slice();
            found.forEach((item) => {
                if (merged.indexOf(item) < 0) merged.push(item);
            });
            fromStamp = false;
            if (erasing) {
                setPicked(found);
                if (found.length) removeSelected();
                else say("Nothing in that box.");
                return;
            }
            setPicked(merged);
            say(picked.length + " highlighted. Copy, then type a name and Keep.");
            return;
        }
        if (Math.hypot(event.clientX - downX, event.clientY - downY) < 5) onClick(event);
    }
});
window.addEventListener("pointermove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (pathTool !== null) followBrush(event.clientX, event.clientY);
    if (painting) paintStroke(event.clientX, event.clientY);
    if (leftDown && Math.hypot(event.clientX - downX, event.clientY - downY) > 6) {
        boxDrag = true;
        showBox(downX, downY, event.clientX, event.clientY);
    }
    if (!rightDrag) return;
    const dx = event.clientX - panX;
    const dy = event.clientY - panY;
    panX = event.clientX;
    panY = event.clientY;
    panBy(dx, dy, mapScale());
});
renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
renderer.domElement.addEventListener("wheel", (event) => {
    dist = Math.max(20, Math.min(1600, dist + event.deltaY * 0.35));
    event.preventDefault();
}, { passive: false });
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    let x = 0;
    let y = 0;
    if (keys.w || keys.arrowup) y += 1;
    if (keys.s || keys.arrowdown) y -= 1;
    if (keys.a || keys.arrowleft) x += 1;
    if (keys.d || keys.arrowright) x -= 1;
    if (x || y) panBy(x, y, dist * 0.85 * dt);
    flushPathPaint();
    picked.forEach((item, index) => {
        const mark = marks.children[index];
        if (mark) mark.position.set(item.mesh.position.x, item.mesh.position.y + 0.4, item.mesh.position.z);
    });
    placeCamera();
    renderer.render(scene, camera);
}
frame();

say("Loading the map…");
new GLTFLoader().load("newmapfromex/manual.glb?v=1", (gltf) => {
    gltf.scene.traverse((child) => {
        if (!child.isMesh) return;
        const count = child.geometry && child.geometry.attributes.position ? child.geometry.attributes.position.count : 0;
        if (!surface || count > surface.geometry.attributes.position.count) surface = child;
    });
    if (!surface) {
        say("The map file has no ground.");
        return;
    }
    useGroundLook(surface);
    rememberGround(surface);
    scene.add(surface);
    surface.geometry.computeBoundingBox();
    const bounds = surface.geometry.boundingBox;
    setPathFrame(bounds.min.x, bounds.min.z, bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
    loadPathPaint();
    const mid = groundY(0, 0);
    look.set(0, mid > SEA ? mid : SEA + 8, 0);
    const span = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
    sea = new THREE.Mesh(
        new THREE.PlaneGeometry(span, span),
        new THREE.MeshStandardMaterial({ color: 0x2a6d86, transparent: true, opacity: 0.62, roughness: 0.2, depthWrite: false })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = SEA;
    scene.add(sea);
    fetch("map-objects.json", { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then(async (data) => {
        if (!data || data.map !== MAP_TOKEN || !Array.isArray(data.objects)) {
            say("Click the ground to place the chosen object. Save writes it into the match.");
            return;
        }
        for (let i = 0; i < data.objects.length; i++) {
            const item = data.objects[i];
            const itemKind = kindById(item.kind);
            if (!itemKind) continue;
            const y = itemKind && surface ? groundY(item.x, item.z) : look.y;
            await addObject(itemKind, item.x, item.z, y, Number(item.yaw) || 0, Number(item.scale) || 1, true);
        }
        setPicked([]);
        dirty = false;
        say(objects.length + " objects on this map. Click the ground to add another.");
    }).catch(() => {
        say("Click the ground to place the chosen object. Save writes it into the match.");
    });
}, undefined, () => {
    say("The map file did not load.");
});

function groundY(x, z) {
    if (!heights) {
        raycaster.set(new THREE.Vector3(x, 400, z), new THREE.Vector3(0, -1, 0));
        const hits = raycaster.intersectObject(surface, false);
        return hits.length ? hits[0].point.y : look.y;
    }
    const u = (x - heightMinX) / heightSpan;
    const v = (z - heightMinZ) / heightSpan;
    if (u < 0 || v < 0 || u > 1 || v > 1) return SEA;
    const n = heightN;
    const fx = u * (n - 1);
    const fz = v * (n - 1);
    const i = Math.min(n - 2, Math.max(0, Math.floor(fx)));
    const j = Math.min(n - 2, Math.max(0, Math.floor(fz)));
    const tx = fx - i;
    const tz = fz - j;
    const i00 = j * n + i;
    return (heights[i00] * (1 - tx) + heights[i00 + 1] * tx) * (1 - tz) + (heights[i00 + n] * (1 - tx) + heights[i00 + n + 1] * tx) * tz;
}

let heights = null;
let heightN = 0;
let heightMinX = 0;
let heightMinZ = 0;
let heightSpan = 1;

function rememberGround(mesh) {
    const pos = mesh.geometry && mesh.geometry.attributes.position;
    if (!pos) return;
    const n = Math.round(Math.sqrt(pos.count));
    if (n * n !== pos.count) return;
    const next = new Float32Array(pos.count);
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
        next[i] = pos.getY(i);
        const x = pos.getX(i);
        const z = pos.getZ(i);
        if (x < minX) minX = x;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (z > maxZ) maxZ = z;
    }
    heights = next;
    heightN = n;
    heightMinX = minX;
    heightMinZ = minZ;
    heightSpan = Math.max(1, maxX - minX);
}
