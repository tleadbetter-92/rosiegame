// District lines for the campaign map and the first-person walk.
// One settlement each. The walk loads that settlement and leaves the others out.
var CampaignDistricts = (function () {
    const west = -3720;
    const east = -1400;
    const north = -680;
    const south = 1060;
    const split = 200;
    const list = [
        { id: "westwatch", faction: 0, poly: [[west, north], [-3000, north], [-2630, -240], [-2660, -51], [-3200, split], [west, split]] },
        { id: "southhold", faction: 0, poly: [[-3000, north], [-2200, north], [-2420, -348], [-2445, -160], [-2100, split], [-3200, split], [-2660, -51], [-2630, -240]] },
        { id: "eastwatch", faction: 0, poly: [[-2200, north], [east, north], [east, split], [-2100, split], [-2445, -160], [-2420, -348]] },
        { id: "westfield", faction: 2, poly: [[west, split], [-2680, split], [-2680, south], [west, south]] },
        { id: "southwest", faction: 2, poly: [[-2680, split], [-2300, split], [-2180, 500], [east, 640], [east, south], [-2680, south]] },
        { id: "southfield", faction: 2, poly: [[-2300, split], [east, split], [east, 640], [-2180, 500]] }
    ];

    function contains(poly, x, z) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i][0];
            const zi = poly[i][1];
            const xj = poly[j][0];
            const zj = poly[j][1];
            const cross = ((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-9) + xi);
            if (cross) inside = !inside;
        }
        return inside;
    }

    function nearPoly(poly, x, z, pad) {
        if (contains(poly, x, z)) return true;
        const pad2 = pad * pad;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const ax = poly[j][0];
            const az = poly[j][1];
            const bx = poly[i][0];
            const bz = poly[i][1];
            const dx = bx - ax;
            const dz = bz - az;
            const len = dx * dx + dz * dz || 1;
            let t = ((x - ax) * dx + (z - az) * dz) / len;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
            const ex = x - (ax + dx * t);
            const ez = z - (az + dz * t);
            if (ex * ex + ez * ez <= pad2) return true;
        }
        return false;
    }

    function byId(id) {
        for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
        return null;
    }

    function at(x, z) {
        for (let i = 0; i < list.length; i++) {
            if (contains(list[i].poly, x, z)) return list[i];
        }
        return null;
    }

    // Stay in the current district until you are clearly across the line.
    function holding(x, z, currentId) {
        if (currentId) {
            const current = byId(currentId);
            if (current && nearPoly(current.poly, x, z, 40)) return currentId;
        }
        const hit = at(x, z);
        return hit ? hit.id : null;
    }

    function polysFor(faction) {
        const polys = [];
        for (let i = 0; i < list.length; i++) {
            if (list[i].faction === faction) polys.push(list[i].poly);
        }
        return polys;
    }

    return { list: list, byId: byId, at: at, holding: holding, polysFor: polysFor, shown: { town: null, soldiers: 0 } };
})();
