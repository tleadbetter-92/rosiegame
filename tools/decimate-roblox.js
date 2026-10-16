// Keep the largest parts of a Roblox convert so carts stay readable without hundreds of tiny bits.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "models", "roblox");
const jobs = [
    { name: "horsecart", keep: 48 },
    { name: "ore", keep: 24 },
    { name: "mine", keep: 40 },
    { name: "lumberyard", keep: 80 }
];

for (const job of jobs) {
    const file = path.join(root, job.name + ".json");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const before = data.parts.length;
    const ranked = data.parts
        .map((part, index) => ({ part, index, vol: part[1] * part[2] * part[3] }))
        .sort((a, b) => b.vol - a.vol || a.index - b.index);
    data.parts = ranked.slice(0, job.keep).map((row) => row.part);
    fs.writeFileSync(file, JSON.stringify(data));
    console.log(job.name + ": " + before + " -> " + data.parts.length);
}
