/* Vertex-clustering decimator: snaps verts to a grid, merges them, drops
   degenerate faces. Shrinks over-tessellated Rhino meshes to web sizes.
   Usage: node tools/decimate.js <in.obj> <out.obj> <gridN> */
const fs = require("fs");

const [, , inPath, outPath, gridArg] = process.argv;
const GRID = parseInt(gridArg || "128", 10);

const buf = fs.readFileSync(inPath, "utf8");
const lines = buf.split("\n");

const vx = [], vy = [], vz = [];
const tris = []; // arrays of [i,i,i] 0-based into vx/vy/vz

function faceIdx(tok, nVerts) {
  let n = parseInt(tok, 10);
  if (n < 0) n = nVerts + n; else n -= 1;   // OBJ is 1-based; negatives are relative
  return n;
}

for (let li = 0; li < lines.length; li++) {
  const l = lines[li];
  if (l.charCodeAt(0) === 118 && l.charCodeAt(1) === 32) { // "v "
    const p = l.split(/\s+/);
    vx.push(+p[1]); vy.push(+p[2]); vz.push(+p[3]);
  } else if (l.charCodeAt(0) === 102 && l.charCodeAt(1) === 32) { // "f "
    const p = l.trim().split(/\s+/);
    const idx = [];
    for (let k = 1; k < p.length; k++) idx.push(faceIdx(p[k].split("/")[0], vx.length));
    for (let k = 1; k + 1 < idx.length; k++) tris.push([idx[0], idx[k], idx[k + 1]]); // fan triangulate
  }
}

// bbox
let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
for (let i = 0; i < vx.length; i++) {
  if (vx[i] < minX) minX = vx[i]; if (vx[i] > maxX) maxX = vx[i];
  if (vy[i] < minY) minY = vy[i]; if (vy[i] > maxY) maxY = vy[i];
  if (vz[i] < minZ) minZ = vz[i]; if (vz[i] > maxZ) maxZ = vz[i];
}
const cell = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / GRID || 1;

// cluster
const clusters = new Map(); // key -> {sx,sy,sz,c,idx}
const vmap = new Int32Array(vx.length);
let outN = 0;
for (let i = 0; i < vx.length; i++) {
  const kx = Math.floor((vx[i] - minX) / cell), ky = Math.floor((vy[i] - minY) / cell), kz = Math.floor((vz[i] - minZ) / cell);
  const key = kx + "_" + ky + "_" + kz;
  let cl = clusters.get(key);
  if (!cl) { cl = { sx: 0, sy: 0, sz: 0, c: 0, idx: outN++ }; clusters.set(key, cl); }
  cl.sx += vx[i]; cl.sy += vy[i]; cl.sz += vz[i]; cl.c++;
  vmap[i] = cl.idx;
}

// output verts (averaged per cluster, ordered by idx)
const ov = new Array(outN);
for (const cl of clusters.values()) ov[cl.idx] = [cl.sx / cl.c, cl.sy / cl.c, cl.sz / cl.c];

// output faces (dedupe degenerate + duplicate tris)
const seen = new Set();
const of = [];
for (const t of tris) {
  const a = vmap[t[0]], b = vmap[t[1]], c = vmap[t[2]];
  if (a === b || b === c || a === c) continue;
  const key = [a, b, c].sort((x, y) => x - y).join(",");
  if (seen.has(key)) continue;
  seen.add(key);
  of.push([a, b, c]);
}

// write
const out = [];
out.push("# decimated (vertex clustering grid=" + GRID + ")  verts " + vx.length + "->" + outN + "  tris " + tris.length + "->" + of.length);
for (const v of ov) out.push("v " + v[0].toFixed(4) + " " + v[1].toFixed(4) + " " + v[2].toFixed(4));
for (const f of of) out.push("f " + (f[0] + 1) + " " + (f[1] + 1) + " " + (f[2] + 1));
fs.writeFileSync(outPath, out.join("\n"));
console.log(`${inPath} -> ${outPath}  verts ${vx.length}->${outN}  tris ${tris.length}->${of.length}  ${(Buffer.byteLength(out.join("\n"))/1048576).toFixed(2)}MB`);
