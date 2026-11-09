import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MAP_BUILDINGS, MAP_KINDS, MAP_TOKEN, TREE_CARDS, kindById, loadKitShell, loadTownList, makeMapShape, makeStandIn, makeTownMesh, plantModel, playKindFromMap, setPlayKits, sheetPlayKits, teamBuildings } from "./map-props.js?v=obj11";
import { PATHS, addRulesOverlay, flushPathPaint, flushRulesPaint, loadPathPaint, loadRulesPaint, paintPath, paintRules, pathSaveBody, rulesSaveBody, setPathFrame, setRulesShown, useGroundLook } from "./ground-look.js?v=look8";

const SEA = 113;
const note = document.getElementById("note");
const list = document.getElementById("kinds");
const rockList = document.getElementById("rocks");
const treeList = document.getElementById("trees");
const buildingList = document.getElementById("buildings");
const teamBuildingList = document.getElementById("team-buildings");
const teamList = document.getElementById("teams");
const townList = document.getElementById("towns");
const saveBtn = document.getElementById("save");
const clearAllBtn = document.getElementById("clear-all");
const copyBtn = document.getElementById("copy");
const pasteBtn = document.getElementById("paste");
const eraseBtn = document.getElementById("erase");
const keepBtn = document.getElementById("keep");
const dropBtn = document.getElementById("drop");
const nameInput = document.getElementById("copy-name");
const copyList = document.getElementById("copies");
const boxEl = document.getElementById("box");
const pathList = document.getElementById("paths");
const ruleList = document.getElementById("rules");
const marksEye = document.getElementById("marks-eye");
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
let limit = 1024;

const placed = new THREE.Group();
scene.add(placed);
const ghost = new THREE.Group();
scene.add(ghost);
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
let activeTown = null;
let placeTeam = "";
let teamPlace = false;
let placeYaw = 0;
let townListReady = [];
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
let rulesOn = false;
let rulesDirty = false;
let ruleTool = null;
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

function paletteBoxes() {
    return [treeList, teamBuildingList, buildingList, townList, list, rockList, copyList];
}

function paintPalette(button) {
    paletteBoxes().forEach((box) => {
        if (!box) return;
        const buttons = box.querySelectorAll("button");
        for (let i = 0; i < buttons.length; i++) buttons[i].classList.toggle("on", buttons[i] === button);
    });
}

function choose(item, button, asTeam) {
    teamPlace = !!asTeam;
    kind = item;
    activeTown = null;
    stamp = null;
    fromStamp = false;
    placeYaw = 0;
    clearErase();
    paintPalette(button);
    if (item.kit) say(kitBrushSay(item));
    refreshGhost();
}

function chooseTeamBuilding(item, button) {
    if (!placeTeam) chooseTeam("you");
    choose(item, button, true);
}

function stampTeam() {
    if (!teamPlace) return "";
    if (placeTeam === "cpu") return "cpu";
    if (placeTeam) return placeTeam;
    return "you";
}

function teamRows() {
    const rows = window.AoeSheet && AoeSheet.factions ? AoeSheet.factions() : [];
    const list = [{ id: "", name: "None" }];
    if (!rows.length) {
        list.push({ id: "you", name: "Team A" }, { id: "cpu", name: "Team B" });
        return list;
    }
    rows.forEach((row) => list.push({ id: row.id, name: row.name || row.id }));
    return list;
}

function teamLabel(id) {
    if (!id) return "None";
    const row = teamRows().find((one) => one.id === id);
    return row ? row.name : id;
}

function teamColor(id) {
    if (id === "you") return 0x2f7d46;
    if (id === "cpu") return 0xb43c32;
    if (id) return 0x3a6ad2;
    return 0xf0d080;
}

function kitBrushSay(itemKind) {
    const who = teamLabel(stampTeam() || placeTeam);
    const play = playKindFromMap({ kind: itemKind.id });
    if (teamPlace) return itemKind.name + " for " + who + ". This is a real match building, not scenery. Q and E turn it.";
    if (itemKind.kit) return itemKind.name + " is scenery. Use Team buildings to give a side a real building. Q and E turn it.";
    return itemKind.name + " shows under the cursor. Q and E turn it.";
}

function placedKitSay(itemKind, team) {
    const who = teamLabel(team);
    if (team) return itemKind.name + " placed for " + who + ". Save makes it a real building in the match.";
    if (itemKind.kit) return itemKind.name + " placed as scenery. Team buildings are the ones that belong to a side.";
    return itemKind.name + " placed.";
}

function paintTeamButtons() {
    if (!teamList) return;
    teamList.querySelectorAll("button").forEach((button) => {
        button.classList.toggle("on", (button.dataset.team || "") === placeTeam);
    });
}

function meshBounds(mesh) {
    mesh.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    mesh.worldToLocal(center);
    const scale = new THREE.Vector3();
    mesh.getWorldScale(scale);
    size.x /= Math.max(0.001, Math.abs(scale.x));
    size.y /= Math.max(0.001, Math.abs(scale.y));
    size.z /= Math.max(0.001, Math.abs(scale.z));
    return { size: size, center: center };
}

function makeTeamWrap(hex, size, center) {
    const group = new THREE.Group();
    const sx = Math.max(3, size.x);
    const sy = Math.max(3, size.y);
    const sz = Math.max(3, size.z);
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
    }));
    fill.position.copy(center);
    const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: hex, depthTest: false })
    );
    line.position.copy(center);
    line.renderOrder = 4;
    const flagH = Math.max(1.8, sy * 0.2);
    const flagW = Math.max(2.6, sx * 0.22);
    const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(flagW, flagH),
        new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, depthTest: false })
    );
    flag.position.set(center.x, center.y + sy * 0.5 + flagH * 0.65, center.z);
    flag.renderOrder = 5;
    group.add(fill, line, flag);
    group.traverse((child) => {
        child.userData.placed = true;
        child.userData.teamDecal = true;
    });
    return group;
}

function paintTeamMark(item) {
    if (!item || !item.mesh) return;
    if (item.teamMark) {
        item.mesh.remove(item.teamMark);
        item.teamMark = null;
    }
    const spec = kindById(item.kind);
    if (!spec || !spec.kit || !item.team) return;
    const bounds = meshBounds(item.mesh);
    const wrap = makeTeamWrap(teamColor(item.team), bounds.size, bounds.center);
    item.mesh.add(wrap);
    item.teamMark = wrap;
}

function assignTeam(item, team) {
    const spec = kindById(item && item.kind);
    if (!item || !spec || !spec.kit) return false;
    item.team = team || "";
    paintTeamMark(item);
    return true;
}

function chooseTeam(id) {
    placeTeam = id || "";
    if (!placeTeam) teamPlace = false;
    paintTeamButtons();
    let assigned = 0;
    picked.forEach((item) => {
        if (assignTeam(item, placeTeam)) assigned++;
    });
    if (assigned) markDirty();
    const who = teamLabel(placeTeam);
    if (assigned) say(assigned + " set to " + who + ".");
    else if (!placeTeam) say("New buildings are scenery.");
    else if (placeTeam !== "you" && placeTeam !== "cpu") say("New buildings go to " + who + ". The live match still uses Team A and Team B.");
    else say("New buildings go to " + who + ".");
    refreshGhost();
}

function fillTeams() {
    if (!teamList) return;
    teamRows().forEach((row) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.team = row.id;
        button.textContent = row.name;
        button.addEventListener("click", () => chooseTeam(row.id));
        teamList.appendChild(button);
    });
    paintTeamButtons();
}

function syncTeamFromPicked() {
    if (teamPlace) return;
    const kits = picked.filter((item) => {
        const spec = kindById(item.kind);
        return spec && spec.kit;
    });
    if (!kits.length) return;
    const team = kits[0].team || "";
    if (!kits.every((item) => (item.team || "") === team)) return;
    placeTeam = team;
    paintTeamButtons();
}

function chooseTown(town, button) {
    teamPlace = false;
    activeTown = town;
    stamp = null;
    fromStamp = false;
    placeYaw = 0;
    clearErase();
    paintPalette(button);
    say(town.name + " shows under the cursor. Q and E turn it a quarter turn.");
    refreshGhost();
}

fillTeams();
setPlayKits(sheetPlayKits());

teamBuildings().forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.name;
    button.addEventListener("click", () => chooseTeamBuilding(item, button));
    teamBuildingList.appendChild(button);
});

MAP_BUILDINGS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.name;
    button.addEventListener("click", () => choose(item, button));
    buildingList.appendChild(button);
});

loadTownList().then((towns) => {
    townListReady = towns;
    towns.forEach((town) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = town.name;
        button.addEventListener("click", () => chooseTown(town, button));
        townList.appendChild(button);
    });
}).catch(() => {
    say("Towns did not load.");
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
    syncTeamFromPicked();
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
        town: item.town || "",
        team: item.team || "",
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
    if (!fromFile && itemKind.kit && stampTeam()) assignTeam(item, stampTeam());
    if (!fromFile) {
        markDirty();
        setPicked([item]);
        say(itemKind.kit ? placedKitSay(itemKind, item.team) : itemKind.name + " placed. Save writes it into the match.");
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
        const px = x + item.dx * c - item.dz * s;
        const pz = z + item.dx * s + item.dz * c;
        const py = groundY(px, pz);
        if (py < SEA + 0.4) continue;
        if (item.kind === "town" && item.town) {
            const town = townListReady.find((one) => one.id === item.town) || { id: item.town, name: item.town };
            added.push(await addTown(town, px, pz, py, (Number(item.yaw) || 0) + (spin || 0), true));
            continue;
        }
        const itemKind = kindById(item.kind);
        if (!itemKind) continue;
        const placedItem = await addObject(itemKind, px, pz, py, (Number(item.yaw) || 0) + (spin || 0), item.scale, true);
        if (item.team) assignTeam(placedItem, item.team);
        added.push(placedItem);
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
    activeTown = null;
    stampYaw = 0;
    fromStamp = false;
    clearErase();
    setPicked([]);
    paintPalette(button);
    nameInput.value = item.name;
    say(item.name + ". Q and E turn it, then click the ground.");
    refreshGhost();
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

function ghostArmed() {
    if (erasing || stamp || pathTool !== null || ruleTool !== null) return false;
    return !!(activeTown || (kind && kind.kit));
}

function clearGhost() {
    const drop = [];
    ghost.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const list = Array.isArray(child.material) ? child.material : [child.material];
        for (let i = 0; i < list.length; i++) {
            if (list[i] && list[i].userData && list[i].userData.fade) drop.push(list[i]);
        }
    });
    ghost.clear();
    ghost.visible = false;
    for (let i = 0; i < drop.length; i++) drop[i].dispose();
}

function fadeCopy(source) {
    const mesh = source.clone(true);
    mesh.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const list = Array.isArray(child.material) ? child.material : [child.material];
        const faded = list.map((material) => {
            const copy = material.clone();
            copy.transparent = true;
            copy.opacity = 0.45;
            copy.depthWrite = false;
            copy.userData.fade = true;
            return copy;
        });
        child.material = faded.length === 1 ? faded[0] : faded;
    });
    return mesh;
}

let ghostJob = 0;

function refreshGhost() {
    const job = ++ghostJob;
    clearGhost();
    if (!ghostArmed()) return;
    const pending = activeTown
        ? makeTownMesh(activeTown.id).then((master) => master ? fadeCopy(master) : null)
        : templateFor(kind).then((master) => fadeCopy(master));
    pending.then((mesh) => {
        if (job !== ghostJob) {
            if (mesh) {
                ghost.add(mesh);
                clearGhost();
            }
            return;
        }
        if (!mesh) {
            say("That one did not load.");
            return;
        }
        ghost.add(mesh);
        const team = stampTeam();
        if (team && kind && kind.kit && !activeTown) {
            const bounds = meshBounds(mesh);
            mesh.add(makeTeamWrap(teamColor(team), bounds.size, bounds.center));
        }
        ghost.rotation.y = placeYaw;
        moveGhost(mouseX, mouseY);
    }).catch(() => {
        if (job === ghostJob) say("That one did not load.");
    });
}

function moveGhost(clientX, clientY) {
    if (!ghost.children.length || !ghostArmed()) {
        ghost.visible = false;
        return;
    }
    const point = groundAt(clientX, clientY);
    if (!point || point.y < SEA + 0.4) {
        ghost.visible = false;
        return;
    }
    ghost.visible = true;
    ghost.position.set(point.x, point.y, point.z);
    ghost.rotation.y = placeYaw;
}

function quarterTurn(sign) {
    let turns = Math.round(placeYaw / (Math.PI / 2)) + sign;
    turns = ((turns % 4) + 4) % 4;
    placeYaw = turns * Math.PI / 2;
    ghost.rotation.y = placeYaw;
    say("Facing " + (turns * 90) + "°. Click the ground.");
}

async function addTown(town, x, z, y, yaw, fromFile) {
    const master = await makeTownMesh(town.id);
    if (!master) throw new Error("missing town");
    const mesh = master.clone(true);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    mesh.userData.placed = true;
    mesh.traverse((child) => {
        child.userData.placed = true;
    });
    placed.add(mesh);
    const item = { id: nextId++, kind: "town", town: town.id, x: x, z: z, yaw: yaw, scale: 1, mesh: mesh };
    mesh.userData.item = item;
    objects.push(item);
    if (!fromFile) {
        markDirty();
        setPicked([item]);
        say(town.name + " placed. It is scenery. Save writes it into the match.");
    }
    return item;
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
            const spec = kindById(item.kind);
            if (spec && spec.kit && picked.length === 1) {
                say(spec.name + " · " + teamLabel(picked[0].team) + ". Pick a team to reassign it.");
            } else say(picked.length + " highlighted. Copy, then paste, or pick a team to assign them.");
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
    if (activeTown) {
        try {
            await addTown(activeTown, hit.point.x, hit.point.z, hit.point.y, placeYaw, false);
        } catch (err) {
            say("That town did not load.");
        }
        return;
    }
    const spin = kind.kit ? placeYaw : Math.random() * Math.PI * 2;
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
        const spec = kindById(item.kind);
        if (spec && spec.card) {
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
    if (pathTool !== null) {
        ruleTool = null;
        showRuleButtons();
    }
    showPathButtons();
    brushRing.visible = pathTool !== null || ruleTool !== null;
    brushRing.material.color.setHex(0xf0d080);
    if (pathTool === null) say("Path brush is off. Click the ground to place the chosen object.");
    else if (pathTool === "lift") say("Lift is on. Drag to rub a path back to grass.");
    else say(PATHS[pathTool].name + ". Drag on the ground. Save writes the path.");
    refreshGhost();
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
const RULES = [
    { id: 0, name: "Units stop" },
    { id: 1, name: "No building" },
    { id: "lift", name: "Lift" }
];

function paintMarksEye() {
    marksEye.textContent = rulesOn ? "Hide marks" : "Show marks";
    marksEye.classList.toggle("on", rulesOn);
}

function toggleMarks() {
    rulesOn = !rulesOn;
    setRulesShown(rulesOn);
    paintMarksEye();
    say(rulesOn
        ? "Marks are showing. Red is where units stop. Blue is where buildings cannot go."
        : "Marks are hidden. Keep editing. Show marks brings the colour back.");
}

marksEye.addEventListener("click", toggleMarks);

function showRuleButtons() {
    ruleList.querySelectorAll("button").forEach((button) => {
        button.classList.toggle("on", button.dataset.rule === String(ruleTool));
    });
}

function chooseRule(next) {
    ruleTool = ruleTool === next ? null : next;
    if (ruleTool !== null) {
        pathTool = null;
        showPathButtons();
        rulesOn = true;
        setRulesShown(true);
        paintMarksEye();
    }
    showRuleButtons();
    brushRing.visible = pathTool !== null || ruleTool !== null;
    brushRing.material.color.setHex(ruleTool === 0 ? 0xd24a3a : ruleTool === 1 ? 0x3a6ad2 : 0xf0d080);
    if (ruleTool === null) say("Mark brush is off. Hide marks turns the colour off while you keep editing.");
    else if (ruleTool === "lift") say("Lift is on. Drag to rub a mark away. Hide marks turns the colour off. The brush stays.");
    else if (ruleTool === 0) say("Units stop. Drag where people cannot cross. The edge is solid.");
    else say("No building. Drag where a building cannot go. Units can still walk there. The edge is solid.");
    refreshGhost();
}

RULES.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rule = String(item.id);
    button.textContent = item.name;
    button.addEventListener("click", () => chooseRule(item.id));
    ruleList.appendChild(button);
});

brushInput.addEventListener("input", () => {
    brushRead.textContent = brushMetres() + " m";
});

function saveRules() {
    if (!rulesDirty) return Promise.resolve(true);
    return fetch("/api/map-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rulesSaveBody())
    }).then((res) => res.json().then((data) => ({ ok: res.ok, data: data }))).then((result) => {
        if (!result.ok) {
            say(result.data.error || "The marks did not save.");
            return false;
        }
        rulesDirty = false;
        return true;
    }).catch(() => {
        say("The marks did not save. The local server needs to be running.");
        return false;
    });
}

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

function wipeMatchSaves() {
    try {
        localStorage.removeItem("aoe-board-save");
        localStorage.removeItem("aoe-playtest-save");
    } catch (err) { /* the match still starts new if the browser will not store it */ }
}

function clearAll() {
    if (!objects.length) {
        say("The map is already empty.");
        return;
    }
    if (!window.confirm("Clear every tree, building, and town on this map?")) return;
    objects.forEach((item) => placed.remove(item.mesh));
    objects = [];
    setPicked([]);
    markDirty();
    say("Cleared. Place a new base, then Save to start a new match from it.");
}

clearAllBtn.addEventListener("click", clearAll);

saveBtn.addEventListener("click", () => {
    saveBtn.disabled = true;
    const body = {
        map: MAP_TOKEN,
        objects: objects.map((item) => {
            const row = { kind: item.kind, x: item.x, z: item.z, yaw: item.yaw, scale: item.scale };
            if (item.town) row.town = item.town;
            if (item.team) row.team = item.team;
            else if (playKindFromMap({ kind: item.kind })) row.team = "you";
            return row;
        })
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
            if (!pathsOk) {
                saveBtn.disabled = false;
                return;
            }
            return saveRules().then((rulesOk) => {
                saveBtn.disabled = false;
                if (!rulesOk) return;
                wipeMatchSaves();
                say("Saved " + result.data.count + " objects. The next Game or Play test starts a new match from only what you placed.");
            });
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
        refreshGhost();
        return;
    }
    erasing = !erasing;
    eraseBtn.classList.toggle("on", erasing);
    say(erasing ? "Erase is on. Click a tree, or drag a box around several." : "Erase is off.");
    refreshGhost();
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
        if (ghostArmed()) quarterTurn(-1);
        else turnSelected(-0.15);
    } else if (event.key.toLowerCase() === "e") {
        if (ghostArmed()) quarterTurn(1);
        else turnSelected(0.15);
    } else if (event.key === "[") {
        sizeSelected(0.9);
    } else if (event.key === "]") {
        sizeSelected(1.1);
    } else if (key === "t") {
        toggleMarks();
    }
});
window.addEventListener("keyup", (event) => {
    keys[event.key.toLowerCase()] = false;
});
window.addEventListener("beforeunload", (event) => {
    if (!dirty && !pathDirty && !rulesDirty) return;
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
    if (pathTool === null && ruleTool === null) {
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
    if (ruleTool !== null) {
        const channel = ruleTool === "lift" ? -1 : ruleTool;
        stamps.forEach((spot) => paintRules(spot.x, spot.z, radius, channel));
        rulesDirty = true;
    } else {
        const channel = pathTool === "lift" ? -1 : pathTool;
        stamps.forEach((spot) => paintPath(spot.x, spot.z, radius, channel));
        pathDirty = true;
    }
    lastPaint = { x: point.x, z: point.z };
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
    if (event.button === 0 && (pathTool !== null || ruleTool !== null)) {
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
    moveGhost(event.clientX, event.clientY);
    if (pathTool !== null || ruleTool !== null) followBrush(event.clientX, event.clientY);
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
    flushRulesPaint();
    picked.forEach((item, index) => {
        const mark = marks.children[index];
        if (mark) mark.position.set(item.mesh.position.x, item.mesh.position.y + 0.4, item.mesh.position.z);
    });
    placeCamera();
    renderer.render(scene, camera);
}
frame();

say("Loading the map…");
new GLTFLoader().load("newmapfromex/manual.glb?v=5", (gltf) => {
    gltf.scene.traverse((child) => {
        if (!child.isMesh) return;
        const count = child.geometry && child.geometry.attributes.position ? child.geometry.attributes.position.count : 0;
        if (!surface || count > surface.geometry.attributes.position.count) surface = child;
    });
    if (!surface) {
        say("The map file has no ground.");
        return;
    }
    if (!surface.geometry.attributes.normal) surface.geometry.computeVertexNormals();
    useGroundLook(surface);
    surface.material.side = THREE.DoubleSide;
    scene.add(addRulesOverlay(surface));
    rememberGround(surface);
    scene.add(surface);
    surface.geometry.computeBoundingBox();
    const bounds = surface.geometry.boundingBox;
    setPathFrame(bounds.min.x, bounds.min.z, bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
    limit = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.z), Math.abs(bounds.max.z)) + 80;
    loadPathPaint();
    loadRulesPaint();
    const span = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
    const land = landLook();
    if (land) look.set(land.x, land.y, land.z);
    else look.set((bounds.min.x + bounds.max.x) / 2, SEA + 30, (bounds.min.z + bounds.max.z) / 2);
    dist = Math.max(900, span * 0.85);
    sea = new THREE.Mesh(
        new THREE.PlaneGeometry(span, span),
        new THREE.MeshStandardMaterial({ color: 0x2a6d86, transparent: true, opacity: 0.62, roughness: 0.2, depthWrite: false })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set((bounds.min.x + bounds.max.x) / 2, SEA, (bounds.min.z + bounds.max.z) / 2);
    scene.add(sea);
    fetch("map-objects.json", { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then(async (data) => {
        if (!data || data.map !== MAP_TOKEN || !Array.isArray(data.objects)) {
            say("Click the ground to place the chosen object. Save writes it into the match.");
            return;
        }
        for (let i = 0; i < data.objects.length; i++) {
            const item = data.objects[i];
            if (item.kind === "town" && item.town) {
                const town = townListReady.find((one) => one.id === item.town) || { id: item.town, name: item.town };
                const y = surface ? groundY(item.x, item.z) : look.y;
                try {
                    await addTown(town, item.x, item.z, y, Number(item.yaw) || 0, true);
                } catch (err) { /* a missing town stays off the map */ }
                continue;
            }
            const itemKind = kindById(item.kind);
            if (!itemKind) continue;
            const y = itemKind && surface ? groundY(item.x, item.z) : look.y;
            const placedItem = await addObject(itemKind, item.x, item.z, y, Number(item.yaw) || 0, Number(item.scale) || 1, true);
            if (item.team) assignTeam(placedItem, item.team);
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

function landLook() {
    if (!heights) return null;
    const step = Math.max(1, Math.floor(heightN / 80));
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let count = 0;
    for (let j = 0; j < heightN; j += step) {
        for (let i = 0; i < heightN; i += step) {
            const y = heights[j * heightN + i];
            if (y < SEA + 2) continue;
            sx += heightMinX + (i / (heightN - 1)) * heightSpan;
            sy += y;
            sz += heightMinZ + (j / (heightN - 1)) * heightSpan;
            count++;
        }
    }
    if (!count) return null;
    return { x: sx / count, y: sy / count, z: sz / count };
}

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
