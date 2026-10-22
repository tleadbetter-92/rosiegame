/**
 * Scan models/, art/, assets/ and write assets/inventory.json + assets/INVENTORY.md
 * Usage: node tools/asset-inventory.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const SCAN_ROOTS = [
    { id: "models", dir: path.join(root, "models") },
    { id: "art", dir: path.join(root, "art") },
    { id: "assets", dir: path.join(root, "assets") }
];

/** Folder name patterns → category (first match wins). */
const CATEGORY_RULES = [
    [/modular-outfits|Modular Character Outfits|fantasy-outfits|Outfits_extract/i, "characters"],
    [/medieval-people|Free Medieval 3D People|Free character medieval|kaykit/i, "characters"],
    [/creatures|Creatures_FBX|horse|spider|dragon|cow|gobkit|styloo|sauropelta|Warhorse/i, "animals"],
    [/nature-megakit|deciduous|Stylized Nature|nature/i, "environment"],
    [/village-megakit|Medieval Village|kitbuild|megakit/i, "buildings"],
    [/universal-animation|mixamo|\.fbx$/i, "animation"],
    [/roblox/i, "roblox-layout"],
    [/weapon|Wep|tools_mekmeesk/i, "props-tools"]
];

const IN_GAME_PATHS = [
    "models/kaykit/",
    "models/kitbuild/",
    "models/creatures/",
    "models/horse/",
    "models/spider/",
    "models/dragon/",
    "models/plaster.png",
    "models/brick.png",
    "models/wood.png",
    "models/roblox/",
    "models/village-megakit/",
    "models/nature-megakit/",
    "models/3D_deciduous_trees_pack/"
];

const BAKE_PATHS = [
    "models/modular-outfits/",
    "models/Creatures_FBX/",
    "models/kaykit/",
    "models/Free character medieval/",
    "tools/bake"
];

function categoryFor(relPath, isDir) {
    const base = path.basename(relPath);
    for (const [re, cat] of CATEGORY_RULES) {
        if (re.test(relPath) || re.test(base)) return cat;
    }
    if (/\.(bin|png)$/i.test(relPath) && relPath.includes("kaykit")) return "characters-runtime";
    if (/\.(bin|png)$/i.test(relPath) && relPath.includes("kitbuild")) return "buildings-runtime";
    if (/\.(bin|png)$/i.test(relPath) && relPath.includes("creatures")) return "animals-runtime";
    if (isDir) return "other";
    return "other-files";
}

function statusFor(relPosix) {
    const p = relPosix.replace(/\\/g, "/");
    if (p.includes("assets/archive/")) return "archived-duplicate";
    if (IN_GAME_PATHS.some((x) => p.startsWith(x) || p === x.slice(0, -1))) return "in-game";
    if (p.includes("-0.bin") || p.includes("-0.png")) return "baked-runtime";
    if (BAKE_PATHS.some((x) => p.startsWith(x))) return "bake-source";
    if (/\.zip$/i.test(p)) return "zip-archive";
    return "source-unused";
}

function walkDir(absDir, relBase, out, maxDepth, depth = 0) {
    if (!fs.existsSync(absDir) || depth > maxDepth) return;
    let entries;
    try {
        entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const ent of entries) {
        if (ent.name === "node_modules" || ent.name === ".git") continue;
        const abs = path.join(absDir, ent.name);
        const rel = path.join(relBase, ent.name);
        if (ent.isDirectory()) {
            const st = fs.statSync(abs);
            let fileCount = 0;
            let bytes = 0;
            try {
                const stack = [abs];
                while (stack.length) {
                    const d = stack.pop();
                    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                        const f = path.join(d, e.name);
                        if (e.isDirectory()) stack.push(f);
                        else {
                            fileCount++;
                            bytes += fs.statSync(f).size;
                        }
                    }
                }
            } catch {
                /* skip */
            }
            out.folders.push({
                root: relBase.split(path.sep)[0],
                path: rel.replace(/\\/g, "/"),
                name: ent.name,
                files: fileCount,
                mb: Math.round((bytes / (1024 * 1024)) * 10) / 10,
                category: categoryFor(rel, true),
                status: statusFor(rel.replace(/\\/g, "/"))
            });
            if (depth < maxDepth && fileCount < 8000) walkDir(abs, rel, out, maxDepth, depth + 1);
        }
    }
}

function scanRootZips() {
    const zips = [];
    for (const name of fs.readdirSync(root)) {
        if (!name.toLowerCase().endsWith(".zip")) continue;
        const abs = path.join(root, name);
        if (!fs.statSync(abs).isFile()) continue;
        zips.push({
            path: name,
            mb: Math.round((fs.statSync(abs).size / (1024 * 1024)) * 10) / 10
        });
    }
    return zips;
}

function main() {
    const out = { generatedAt: new Date().toISOString(), folders: [], rootZips: scanRootZips() };
    for (const { dir } of SCAN_ROOTS) {
        if (!fs.existsSync(dir)) continue;
        walkDir(dir, path.relative(root, dir), out, 2);
    }

    out.folders.sort((a, b) => b.mb - a.mb || a.path.localeCompare(b.path));

    const byCategory = {};
    for (const f of out.folders) {
        if (f.path.split("/").length > 3) continue;
        byCategory[f.category] = byCategory[f.category] || [];
        byCategory[f.category].push(f);
    }

    const assetsDir = path.join(root, "assets");
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, "inventory.json"), JSON.stringify({ ...out, byCategory }, null, 2));

    const lines = [
        "# Asset inventory (auto-generated)",
        "",
        `Generated: ${out.generatedAt}`,
        "",
        "Re-run: `node tools/asset-inventory.js`",
        "",
        "See [README.md](./README.md) for how folders are organized.",
        "",
        "## By category (top-level folders)",
        ""
    ];

    for (const cat of Object.keys(byCategory).sort()) {
        lines.push(`### ${cat}`);
        lines.push("");
        lines.push("| Folder | Files | MB | Status |");
        lines.push("|--------|------:|---:|--------|");
        for (const f of byCategory[cat]) {
            lines.push(`| \`${f.path}\` | ${f.files} | ${f.mb} | ${f.status} |`);
        }
        lines.push("");
    }

    if (out.rootZips.length) {
        lines.push("## Zip files at repo root (not extracted or backup)");
        lines.push("");
        for (const z of out.rootZips) lines.push(`- \`${z.path}\` (${z.mb} MB)`);
        lines.push("");
    }

    fs.writeFileSync(path.join(assetsDir, "INVENTORY.md"), lines.join("\n"));
    console.log("Wrote assets/inventory.json and assets/INVENTORY.md");
    console.log("Top folders:", out.folders.slice(0, 12).map((f) => `${f.path} (${f.mb}MB)`).join("\n  "));
}

main();
