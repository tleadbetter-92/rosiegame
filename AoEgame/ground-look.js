import * as THREE from "three";

const files = [
    ["map", "grass-a.jpg?v=1"],
    ["grassAlt", "grass-b.jpg?v=1"],
    ["grassWide", "grass-wide.jpg?v=1"],
    ["sandMap", "sand-a.jpg?v=1"],
    ["sandAlt", "sand-b.jpg?v=1"],
    ["sandWide", "sand-wide.jpg?v=1"],
    ["sandBroad", "sand-broad.jpg?v=1"],
    ["rockMap", "rock-a.jpg?v=1"],
    ["rockAlt", "rock-b.jpg?v=1"],
    ["rockWide", "rock-wide.jpg?v=1"],
    ["rockBroad", "rock-broad.jpg?v=1"],
    ["pathMoss", "path-moss.jpg?v=1"],
    ["pathFlag", "path-flag.jpg?v=1"],
    ["pathCobble", "path-cobble.jpg?v=1"],
    ["pathSlab", "path-slab.jpg?v=1"]
];

export const PATHS = [
    { id: "moss", name: "Moss stones", file: "path-moss.jpg" },
    { id: "flag", name: "Flag stones", file: "path-flag.jpg" },
    { id: "cobble", name: "Cobbles", file: "path-cobble.jpg" },
    { id: "slab", name: "Planted slabs", file: "path-slab.jpg" }
];

const PATH_SIZE = 2048;
const pathData = new Uint8Array(PATH_SIZE * PATH_SIZE * 4);
const pathTexture = new THREE.DataTexture(pathData, PATH_SIZE, PATH_SIZE);
pathTexture.format = THREE.RGBAFormat;
pathTexture.type = THREE.UnsignedByteType;
pathTexture.magFilter = THREE.LinearFilter;
pathTexture.minFilter = THREE.LinearFilter;
pathTexture.wrapS = THREE.ClampToEdgeWrapping;
pathTexture.wrapT = THREE.ClampToEdgeWrapping;
pathTexture.colorSpace = THREE.NoColorSpace;
pathTexture.flipY = false;
pathTexture.generateMipmaps = false;
pathTexture.needsUpdate = true;

const pathFrame = new THREE.Vector4(-1024, -1024, 2048, 2048);
let pathPending = false;

export function setPathFrame(minX, minZ, spanX, spanZ) {
    pathFrame.set(minX, minZ, Math.max(1, spanX), Math.max(1, spanZ));
}

export function paintPath(x, z, radius, channel) {
    const spanX = pathFrame.z;
    const spanZ = pathFrame.w;
    const cx = ((x - pathFrame.x) / spanX) * (PATH_SIZE - 1);
    const cz = ((z - pathFrame.y) / spanZ) * (PATH_SIZE - 1);
    const rad = Math.max((radius / spanX) * (PATH_SIZE - 1), (radius / spanZ) * (PATH_SIZE - 1), 0.75);
    const x0 = Math.max(0, Math.floor(cx - rad));
    const x1 = Math.min(PATH_SIZE - 1, Math.ceil(cx + rad));
    const z0 = Math.max(0, Math.floor(cz - rad));
    const z1 = Math.min(PATH_SIZE - 1, Math.ceil(cz + rad));
    const erase = channel < 0;
    for (let py = z0; py <= z1; py++) {
        const dz = (py - cz) / rad;
        for (let px = x0; px <= x1; px++) {
            const dx = (px - cx) / rad;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist >= 1) continue;
            const soft = (1 - dist) * (1 - dist);
            const o = (py * PATH_SIZE + px) * 4;
            if (erase) {
                const keep = 1 - soft;
                for (let c = 0; c < 4; c++) pathData[o + c] = Math.round(pathData[o + c] * keep);
                continue;
            }
            const fade = 1 - soft * 0.92;
            for (let c = 0; c < 4; c++) pathData[o + c] = Math.round(pathData[o + c] * fade);
            const add = Math.round(soft * 255);
            if (pathData[o + channel] < add) pathData[o + channel] = add;
        }
    }
    pathPending = true;
    return true;
}

export function flushPathPaint() {
    if (!pathPending) return;
    pathPending = false;
    pathTexture.needsUpdate = true;
}

export function loadPathPaint() {
    return fetch("map-paths.json", { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then((meta) => {
        if (!meta || meta.map !== "newmap") return false;
        return new Promise((resolve) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = PATH_SIZE;
                canvas.height = PATH_SIZE;
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                ctx.drawImage(image, 0, 0, PATH_SIZE, PATH_SIZE);
                pathData.set(ctx.getImageData(0, 0, PATH_SIZE, PATH_SIZE).data);
                pathTexture.needsUpdate = true;
                resolve(true);
            };
            image.onerror = () => resolve(false);
            image.src = "map-paths.png?v=" + Date.now();
        });
    }).catch(() => false);
}

export function pathSaveBody() {
    const canvas = document.createElement("canvas");
    canvas.width = PATH_SIZE;
    canvas.height = PATH_SIZE;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pathData), PATH_SIZE, PATH_SIZE), 0, 0);
    return {
        map: "newmap",
        minX: pathFrame.x,
        minZ: pathFrame.y,
        spanX: pathFrame.z,
        spanZ: pathFrame.w,
        png: canvas.toDataURL("image/png")
    };
}

function photo(file) {
    const tex = new THREE.TextureLoader().load(file);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
}

export function makeGroundMaterial() {
    const textures = {};
    files.forEach((pair) => {
        textures[pair[0]] = photo(pair[1]);
    });
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: textures.map });
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.grassAlt = { value: textures.grassAlt };
        shader.uniforms.grassWide = { value: textures.grassWide };
        shader.uniforms.sandMap = { value: textures.sandMap };
        shader.uniforms.sandAlt = { value: textures.sandAlt };
        shader.uniforms.sandWide = { value: textures.sandWide };
        shader.uniforms.sandBroad = { value: textures.sandBroad };
        shader.uniforms.rockMap = { value: textures.rockMap };
        shader.uniforms.rockAlt = { value: textures.rockAlt };
        shader.uniforms.rockWide = { value: textures.rockWide };
        shader.uniforms.rockBroad = { value: textures.rockBroad };
        shader.uniforms.pathMask = { value: pathTexture };
        shader.uniforms.pathFrame = { value: pathFrame };
        shader.uniforms.pathMoss = { value: textures.pathMoss };
        shader.uniforms.pathFlag = { value: textures.pathFlag };
        shader.uniforms.pathCobble = { value: textures.pathCobble };
        shader.uniforms.pathSlab = { value: textures.pathSlab };
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <map_pars_fragment>", [
                "#include <map_pars_fragment>",
                "uniform sampler2D grassAlt;",
                "uniform sampler2D grassWide;",
                "uniform sampler2D sandMap;",
                "uniform sampler2D sandAlt;",
                "uniform sampler2D sandWide;",
                "uniform sampler2D sandBroad;",
                "uniform sampler2D rockMap;",
                "uniform sampler2D rockAlt;",
                "uniform sampler2D rockWide;",
                "uniform sampler2D rockBroad;",
                "uniform sampler2D pathMask;",
                "uniform vec4 pathFrame;",
                "uniform sampler2D pathMoss;",
                "uniform sampler2D pathFlag;",
                "uniform sampler2D pathCobble;",
                "uniform sampler2D pathSlab;",
                "float grassNoise( vec2 p ) {",
                "  vec2 i = floor( p );",
                "  vec2 f = fract( p );",
                "  f = f * f * ( 3.0 - 2.0 * f );",
                "  float a = fract( sin( dot( i, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );",
                "  float b = fract( sin( dot( i + vec2( 1.0, 0.0 ), vec2( 127.1, 311.7 ) ) ) * 43758.5453 );",
                "  float c = fract( sin( dot( i + vec2( 0.0, 1.0 ), vec2( 127.1, 311.7 ) ) ) * 43758.5453 );",
                "  float d = fract( sin( dot( i + vec2( 1.0, 1.0 ), vec2( 127.1, 311.7 ) ) ) * 43758.5453 );",
                "  return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );",
                "}",
                "float grassLod( vec2 uv ) {",
                "  vec2 dx = dFdx( uv );",
                "  vec2 dy = dFdy( uv );",
                "  float ax = length( dx );",
                "  float ay = length( dy );",
                "  float stretch = max( ax, ay ) / max( 0.0001, min( ax, ay ) );",
                "  return -clamp( log2( stretch ) * 0.85, 0.0, 3.5 );",
                "}"
            ].join("\n"))
            .replace("#include <map_fragment>", [
                "vec3 grassDetail = vec3(1.0);",
                "vec3 sandDetail = vec3(1.0);",
                "vec3 rockDetail = vec3(1.0);",
                "#ifdef USE_MAP",
                "  vec2 uvA = vMapUv * 0.45;",
                "  float fineLod = grassLod( uvA );",
                "  vec3 fineA = texture2D( map, uvA, fineLod ).rgb;",
                "  vec2 uvB = mat2( 0.682, 0.731, -0.731, 0.682 ) * uvA + vec2( 0.17, 0.41 );",
                "  vec3 fineB = texture2D( grassAlt, uvB, fineLod ).rgb;",
                "  vec3 wide = texture2D( grassWide, vMapUv * 0.12 ).rgb;",
                "  float pick = grassNoise( vMapUv * 0.4 ) * 0.7 + wide.g * 0.3;",
                "  grassDetail = mix( fineA, fineB, smoothstep( 0.38, 0.62, pick ) );",
                "  grassDetail = mix( grassDetail, wide, 0.28 );",
                "  vec2 suv = vMapUv * 0.5;",
                "  float sandLod = grassLod( suv );",
                "  vec3 sandA = texture2D( sandMap, suv, sandLod ).rgb;",
                "  vec2 suvB = mat2( 0.731, -0.682, 0.682, 0.731 ) * suv + vec2( 0.23, 0.11 );",
                "  vec3 sandB = texture2D( sandAlt, suvB, sandLod ).rgb;",
                "  vec3 sandFar = texture2D( sandWide, vMapUv * 0.08 ).rgb;",
                "  vec3 sandFarB = texture2D( sandBroad, vMapUv * 0.05 + vec2( 0.31, 0.17 ) ).rgb;",
                "  float sandPick = grassNoise( vMapUv * 0.35 );",
                "  sandDetail = mix( sandA, sandB, smoothstep( 0.38, 0.62, sandPick ) );",
                "  sandDetail = mix( sandDetail, mix( sandFar, sandFarB, 0.5 ), 0.28 );",
                "  vec2 ruv = vMapUv * 0.48;",
                "  float rockLod = grassLod( ruv );",
                "  vec3 rockA = texture2D( rockMap, ruv, rockLod ).rgb;",
                "  vec2 ruvB = mat2( 0.58, 0.81, -0.81, 0.58 ) * ruv + vec2( 0.41, 0.07 );",
                "  vec3 rockB = texture2D( rockAlt, ruvB, rockLod ).rgb;",
                "  vec3 rockFar = texture2D( rockWide, vMapUv * 0.08 ).rgb;",
                "  vec3 rockFarB = texture2D( rockBroad, vMapUv * 0.05 + vec2( 0.19, 0.44 ) ).rgb;",
                "  float rockPick = grassNoise( vMapUv * 0.33 );",
                "  rockDetail = mix( rockA, rockB, smoothstep( 0.38, 0.62, rockPick ) );",
                "  rockDetail = mix( rockDetail, mix( rockFar, rockFarB, 0.5 ), 0.28 );",
                "#endif"
            ].join("\n"))
            .replace("#include <color_fragment>", [
                "#if defined( USE_COLOR )",
                "  float maxC = max( vColor.r, max( vColor.g, vColor.b ) );",
                "  float minC = min( vColor.r, min( vColor.g, vColor.b ) );",
                "  float grassLead = vColor.g - max( vColor.r, vColor.b );",
                "  float sandLead = vColor.r - max( vColor.g, vColor.b );",
                "  float grassMix = smoothstep( 0.0, max( 0.0008, fwidth( grassLead ) * 1.25 ), grassLead );",
                "  float sandMix = smoothstep( 0.0, max( 0.0008, fwidth( sandLead ) * 1.25 ), sandLead );",
                "  float rockLead = min( 0.078 - ( maxC - minC ), min( 0.41 - maxC, minC - 0.08 ) );",
                "  float rockMix = smoothstep( 0.0, max( 0.0008, fwidth( rockLead ) * 1.25 ), rockLead );",
                "  vec3 tinted = mix( vColor, grassDetail, grassMix * 0.78 );",
                "  tinted = mix( tinted, sandDetail, sandMix * 0.78 );",
                "  tinted = mix( tinted, rockDetail, rockMix * 0.78 );",
                "  vec2 pathWorld = vMapUv * 3.5;",
                "  vec2 pathMaskUv = ( pathWorld - pathFrame.xy ) / pathFrame.zw;",
                "  float pathInside = step( 0.0, pathMaskUv.x ) * step( pathMaskUv.x, 1.0 ) * step( 0.0, pathMaskUv.y ) * step( pathMaskUv.y, 1.0 );",
                "  vec4 pathW = texture2D( pathMask, clamp( pathMaskUv, 0.0, 1.0 ) ) * pathInside;",
                "  float pathSum = pathW.r + pathW.g + pathW.b + pathW.a;",
                "  vec3 mossCol = texture2D( pathMoss, pathWorld / 6.0 ).rgb;",
                "  vec3 flagCol = texture2D( pathFlag, pathWorld / 5.0 ).rgb;",
                "  vec3 cobbleCol = texture2D( pathCobble, pathWorld / 3.2 ).rgb;",
                "  vec3 slabCol = texture2D( pathSlab, pathWorld / 6.0 ).rgb;",
                "  vec3 pathCol = ( mossCol * pathW.r + flagCol * pathW.g + cobbleCol * pathW.b + slabCol * pathW.a ) / max( pathSum, 0.001 );",
                "  tinted = mix( tinted, pathCol, smoothstep( 0.02, 0.45, pathSum ) );",
                "  diffuseColor.rgb *= tinted;",
                "#endif"
            ].join("\n"));
    };
    return mat;
}

export function useGroundLook(mesh) {
    const geom = mesh.geometry;
    const pos = geom && geom.attributes ? geom.attributes.position : null;
    if (!pos) return;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = pos.getX(i) / 3.5;
        uv[i * 2 + 1] = pos.getZ(i) / 3.5;
    }
    geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    if (!geom.attributes.color) {
        const col = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
            col[i * 3] = 0.42;
            col[i * 3 + 1] = 0.55;
            col[i * 3 + 2] = 0.28;
        }
        geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
    }
    mesh.material = makeGroundMaterial();
}
