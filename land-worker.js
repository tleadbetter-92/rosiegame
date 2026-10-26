importScripts("world-edit.js", "world.js", "town.js", "sw-square.js", "land-mesh.js");

self.onmessage = function (e) {
    const job = e.data || {};
    if (job.levelPads && job.levelPads.length) World.setLevelPads(job.levelPads);
    const built = LandMesh.build(job.x, job.z, job.drawFar);
    const transfer = [];
    const meshes = built.meshes;
    const blends = built.blends;
    for (const name of Object.keys(meshes)) {
        if (meshes[name] && meshes[name].buffer) transfer.push(meshes[name].buffer);
    }
    for (const name of Object.keys(blends)) {
        if (blends[name] && blends[name].buffer) transfer.push(blends[name].buffer);
    }
    self.postMessage({ x: job.x, z: job.z, meshes: meshes, blends: blends }, transfer);
};
