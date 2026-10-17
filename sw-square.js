(function (root) {
    const cells = [[-8,-2,"gravel"],[-8,0,"gravel"],[-8,2,"gravel"],[-8,4,"gravel"],[-8,6,"gravel"],[-8,8,"gravel"],[-8,10,"gravel"],[-8,12,"gravel"],[-6,-2,"gravel"],[-6,0,"stone"],[-6,2,"stone"],[-6,4,"stone"],[-6,6,"stone"],[-6,8,"stone"],[-6,10,"stone"],[-6,12,"stone"],[-6,14,"stone"],[-4,-2,"gravel"],[-4,0,"stone"],[-4,2,"grass"],[-4,4,"grass"],[-4,6,"gravel"],[-4,8,"grass"],[-4,10,"grass"],[-4,12,"cobble"],[-4,14,"grass"],[-2,-2,"gravel"],[-2,0,"stone"],[-2,2,"grass"],[-2,4,"cobble"],[-2,6,"gravel"],[-2,8,"cobble"],[-2,10,"cobble"],[0,-2,"gravel"],[0,0,"stone"],[0,2,"grass"],[0,4,"grass"],[0,6,"gravel"],[0,8,"cobble"],[0,10,"cobble"],[0,12,"cobble"],[0,14,"cobble"],[2,-2,"gravel"],[2,0,"stone"],[2,2,"grass"],[2,4,"gravel"],[2,8,"cobble"],[2,10,"cobble"],[2,14,"cobble"],[4,-2,"gravel"],[4,0,"stone"],[4,2,"grass"],[4,4,"grass"],[4,6,"grass"],[4,12,"grass"],[6,-2,"gravel"],[6,0,"stone"],[6,2,"grass"],[6,4,"grass"],[6,8,"cobble"],[6,10,"cobble"],[6,12,"grass"],[8,-2,"gravel"],[8,0,"stone"],[8,2,"grass"],[8,4,"grass"],[8,10,"cobble"],[8,14,"grass"],[10,-2,"gravel"],[10,0,"stone"],[10,2,"grass"],[10,4,"grass"],[12,-2,"stone"],[12,0,"stone"],[12,2,"stone"],[12,4,"stone"],[14,-2,"stone"],[14,0,"stone"],[14,2,"stone"],[14,4,"stone"],[16,-2,"gravel"],[16,0,"stone"],[16,2,"gravel"],[16,4,"gravel"],[-4,16,"grass"],[-2,14,"cobble"],[-2,16,"cobble"],[0,16,"cobble"],[6,6,"grass"],[10,8,"cobble"],[14,6,"stone"],[12,6,"stone"],[8,6,"grass"],[10,6,"grass"],[0,18,"stone"],[2,16,"cobble"],[4,16,"grass"],[6,14,"grass"],[8,12,"grass"],[10,12,"grass"],[10,10,"cobble"],[4,14,"grass"],[12,10,"stone"],[16,8,"gravel"],[10,14,"grass"],[6,16,"grass"],[2,20,"stone"],[2,18,"stone"],[0,20,"stone"],[4,20,"stone"],[4,18,"stone"],[6,18,"stone"],[8,16,"grass"],[10,16,"grass"],[12,14,"stone"],[14,14,"stone"],[16,12,"gravel"],[-4,22,"grass"],[-4,20,"stone"],[-4,18,"stone"],[-2,18,"stone"],[-2,20,"stone"],[-2,22,"cobble"],[-6,16,"stone"],[-6,18,"stone"],[-6,20,"stone"],[-6,22,"stone"],[-8,16,"gravel"],[-8,18,"stone"],[-8,20,"stone"],[-8,22,"gravel"],[-8,14,"gravel"],[0,22,"cobble"],[4,22,"gravel"],[6,22,"gravel"],[2,22,"cobble"],[6,20,"stone"],[8,20,"stone"],[8,18,"stone"],[10,18,"stone"],[12,18,"stone"],[14,16,"stone"],[12,16,"stone"],[16,14,"gravel"],[16,16,"gravel"],[16,18,"stone"],[16,20,"stone"],[14,20,"stone"],[10,20,"stone"],[12,20,"stone"],[8,22,"gravel"],[14,18,"stone"],[10,22,"gravel"],[12,22,"stone"],[14,22,"stone"],[16,22,"cobble"],[18,22,"cobble"],[20,22,"cobble"],[-4,24,"grass"],[-4,26,"grass"],[-4,28,"grass"],[-2,30,"grass"],[-2,32,"gravel"],[-2,34,"grass"],[-4,34,"grass"],[-4,36,"stone"],[-4,38,"gravel"],[-2,38,"gravel"],[-2,36,"stone"],[-2,28,"cobble"],[-2,26,"cobble"],[-2,24,"cobble"],[-4,30,"grass"],[-4,32,"grass"],[-8,24,"gravel"],[-8,26,"gravel"],[-8,28,"gravel"],[-8,30,"gravel"],[-8,32,"gravel"],[-8,34,"gravel"],[-8,36,"gravel"],[-6,36,"stone"],[-6,38,"gravel"],[-8,38,"gravel"],[6,36,"stone"],[8,36,"stone"],[10,36,"stone"],[12,36,"stone"],[14,36,"stone"],[14,38,"stone"],[16,38,"gravel"],[0,36,"stone"],[2,36,"stone"],[4,36,"stone"],[10,38,"gravel"],[12,38,"stone"],[18,36,"stone"],[16,36,"stone"],[18,38,"gravel"],[20,38,"gravel"],[20,36,"stone"],[22,38,"gravel"],[22,36,"stone"],[26,36,"stone"],[24,36,"stone"],[28,36,"stone"],[30,36,"stone"],[32,36,"stone"],[32,34,"stone"],[32,32,"stone"],[32,30,"stone"],[32,28,"stone"],[30,26,"cobble"],[30,24,"cobble"],[30,22,"cobble"],[30,20,"stone"],[28,18,"stone"],[28,16,"cobble"],[28,14,"gravel"],[30,12,"gravel"],[30,14,"gravel"],[30,16,"gravel"],[30,18,"stone"],[32,18,"stone"],[32,20,"stone"],[32,22,"stone"],[32,24,"stone"],[32,26,"stone"],[34,28,"gravel"],[24,38,"gravel"],[26,38,"gravel"],[28,38,"gravel"],[30,38,"gravel"],[32,38,"gravel"],[34,38,"gravel"],[34,36,"gravel"],[34,34,"gravel"],[34,32,"gravel"],[34,30,"gravel"],[34,26,"gravel"],[34,24,"gravel"],[30,28,"grass"],[30,30,"grass"],[30,34,"grass"],[30,32,"grass"],[18,4,"grass"],[20,4,"grass"],[22,4,"grass"],[24,4,"grass"],[26,4,"grass"],[28,4,"grass"],[30,4,"gravel"],[32,4,"stone"],[18,2,"gravel"],[20,2,"gravel"],[22,2,"gravel"],[24,2,"gravel"],[26,2,"gravel"],[28,2,"gravel"],[30,2,"gravel"],[32,2,"stone"],[34,2,"gravel"],[18,-2,"gravel"],[20,-2,"gravel"],[20,0,"stone"],[22,0,"stone"],[24,0,"stone"],[26,0,"stone"],[28,0,"stone"],[30,0,"stone"],[32,0,"stone"],[34,0,"gravel"],[22,-2,"gravel"],[24,-2,"gravel"],[26,-2,"gravel"],[28,-2,"gravel"],[30,-2,"gravel"],[32,-2,"gravel"],[34,-2,"gravel"],[34,4,"gravel"],[34,6,"gravel"],[34,8,"gravel"],[32,10,"stone"],[32,12,"stone"],[32,14,"stone"],[32,16,"stone"],[34,18,"stone"],[34,20,"stone"],[34,22,"gravel"],[34,16,"gravel"],[34,14,"gravel"],[34,12,"gravel"],[32,8,"stone"],[34,10,"gravel"],[18,0,"stone"],[-6,24,"stone"],[4,28,"gravel"],[8,28,"gravel"],[4,30,"grass"],[4,32,"grass"],[-6,26,"stone"],[-6,28,"stone"],[-6,30,"stone"],[-6,32,"stone"],[-6,34,"stone"],[8,38,"gravel"],[6,38,"gravel"],[4,38,"gravel"],[2,38,"gravel"],[0,38,"gravel"],[18,6,"grass"],[20,6,"grass"],[22,6,"grass"],[22,8,"grass"],[18,18,"stone"],[18,16,"cobble"],[20,14,"grass"],[18,14,"grass"],[18,10,"gravel"],[18,8,"grass"],[20,10,"gravel"],[20,12,"gravel"],[18,12,"grass"],[22,12,"gravel"],[22,14,"gravel"],[22,10,"gravel"],[22,16,"gravel"],[22,18,"stone"],[22,20,"stone"],[22,22,"cobble"],[18,20,"stone"],[20,20,"stone"],[20,18,"stone"],[20,16,"cobble"],[0,34,"grass"],[2,34,"grass"],[6,32,"grass"],[8,30,"grass"],[2,32,"grass"],[2,26,"cobble"],[0,24,"cobble"],[0,32,"grass"],[0,26,"cobble"],[0,28,"cobble"],[0,30,"gravel"],[4,26,"cobble"],[6,28,"gravel"],[6,30,"grass"],[6,34,"grass"],[10,34,"grass"],[12,34,"stone"],[14,34,"stone"],[24,34,"grass"],[26,34,"grass"],[28,34,"grass"],[16,34,"grass"],[20,34,"grass"],[22,34,"grass"],[18,34,"grass"],[32,6,"stone"],[24,6,"grass"],[30,6,"gravel"],[30,8,"gravel"],[30,10,"gravel"],[28,12,"gravel"],[28,10,"gravel"],[28,8,"grass"],[26,12,"stone"],[26,14,"stone"],[26,18,"stone"],[24,8,"grass"],[24,10,"gravel"],[24,12,"gravel"],[24,14,"gravel"],[24,16,"gravel"],[24,18,"stone"],[26,20,"stone"],[26,22,"cobble"],[26,24,"cobble"],[24,22,"cobble"],[24,20,"stone"],[24,24,"cobble"],[28,20,"stone"],[28,22,"cobble"],[28,24,"cobble"],[28,26,"cobble"],[28,28,"gravel"],[28,30,"gravel"],[26,30,"gravel"],[24,30,"gravel"],[16,30,"grass"],[18,30,"gravel"],[18,28,"gravel"],[20,28,"gravel"],[22,28,"gravel"],[24,28,"gravel"],[22,26,"cobble"],[20,26,"cobble"],[18,26,"cobble"],[18,24,"cobble"],[20,24,"cobble"],[22,24,"cobble"],[24,26,"cobble"],[26,26,"cobble"],[16,26,"cobble"],[14,26,"stone"],[12,24,"stone"],[10,24,"gravel"],[8,24,"grass"],[14,24,"stone"],[16,24,"cobble"],[12,26,"stone"],[8,26,"grass"],[6,26,"cobble"],[4,24,"cobble"],[10,28,"gravel"],[12,30,"stone"],[16,28,"grass"],[10,32,"grass"],[12,32,"stone"],[16,32,"grass"],[18,32,"gravel"],[24,32,"gravel"],[26,32,"gravel"],[28,32,"gravel"],[22,30,"gravel"],[20,30,"gravel"],[14,30,"stone"],[10,30,"grass"],[8,32,"grass"],[8,34,"grass"],[12,28,"stone"],[4,34,"grass"],[6,24,"grass"],[2,12,"cobble"],[14,10,"stone"],[14,12,"stone"],[12,12,"stone"],[26,10,"gravel"],[26,16,"cobble"],[2,24,"cobble"],[-2,12,"cobble"],[8,8,"cobble"],[4,10,"cobble"],[10,26,"gravel"],[14,32,"stone"],[20,32,"gravel"],[22,32,"gravel"],[20,8,"grass"],[16,10,"gravel"],[28,6,"grass"],[16,6,"gravel"],[12,8,"stone"],[14,8,"stone"],[14,28,"stone"],[4,8,"cobble"],[2,6,"gravel"],[26,8,"grass"],[26,6,"grass"],[2,28,"grass"],[2,30,"grass"]];
    const buildings = [["barracks",0,32,3.141592653589793],["smith",8,26,1.5707963267948966],["inn",20,14,0],["vshop",28,14,0],["stores",24,30,3.141592653589793],["lord",0,6,0]];
    const CX = 14;
    const CZ = 19;
    const SCALE = 31.2 / 44;
    function frame() {
        const place = root.World.places[2];
        return { ox: place.x - 0.5, oz: place.z - 4 };
    }
    function world(lx, lz) {
        const f = frame();
        return { x: f.ox + (lx - CX) * SCALE, z: f.oz + (lz - CZ) * SCALE };
    }
    function bounds() {
        const a = world(-8, -2);
        const b = world(36, 40);
        return {
            minX: Math.min(a.x, b.x),
            maxX: Math.max(a.x, b.x),
            minZ: Math.min(a.z, b.z),
            maxZ: Math.max(a.z, b.z)
        };
    }
    const batchOf = { grass: "grass", gravel: "gravel", cobble: "townCobble", stone: "cobble" };
    function stampGround(batches, heightAt, pushQuad) {
        const box = bounds();
        const lift = 0.05;
        pushQuad(
            batches.grass,
            [box.minX, heightAt(box.minX, box.minZ) + lift, box.minZ, box.minX / 2, box.minZ / 2, 1],
            [box.minX, heightAt(box.minX, box.maxZ) + lift, box.maxZ, box.minX / 2, box.maxZ / 2, 1],
            [box.maxX, heightAt(box.maxX, box.maxZ) + lift, box.maxZ, box.maxX / 2, box.maxZ / 2, 1],
            [box.maxX, heightAt(box.maxX, box.minZ) + lift, box.minZ, box.maxX / 2, box.minZ / 2, 1]
        );
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            const list = batches[batchOf[cell[2]] || "grass"];
            if (!list) continue;
            const a = world(cell[0], cell[1]);
            const b = world(cell[0] + 2, cell[1]);
            const c = world(cell[0] + 2, cell[1] + 2);
            const d = world(cell[0], cell[1] + 2);
            const y = (p) => heightAt(p.x, p.z) + lift + 0.03;
            pushQuad(
                list,
                [a.x, y(a), a.z, a.x / 2, a.z / 2, 1],
                [d.x, y(d), d.z, d.x / 2, d.z / 2, 1],
                [c.x, y(c), c.z, c.x / 2, c.z / 2, 1],
                [b.x, y(b), b.z, b.x / 2, b.z / 2, 1]
            );
        }
    }
    root.SwSquare = {
        buildings: buildings.map((b) => ({ t: b[0], x: b[1], z: b[2], yaw: b[3] })),
        world: world,
        bounds: bounds,
        scale: SCALE,
        stampGround: stampGround
    };
})(typeof self !== "undefined" ? self : this);
