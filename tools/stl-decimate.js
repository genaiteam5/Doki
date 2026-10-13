/* Binary STL -> decimated OBJ (vertex clustering).
   Usage: node tools/stl-decimate.js <in.stl> <out.obj> <gridN> */
const fs = require("fs");
const [, , inPath, outPath, gridArg] = process.argv;
const GRID = parseInt(gridArg || "200", 10);

const b = fs.readFileSync(inPath);
const nTri = b.readUInt32LE(80);
let off = 84;
const vx = [], vy = [], vz = [];      // all triangle vertices (3 per tri)
for (let t = 0; t < nTri; t++) {
  off += 12;                           // skip face normal
  for (let k = 0; k < 3; k++) {
    vx.push(b.readFloatLE(off)); vy.push(b.readFloatLE(off + 4)); vz.push(b.readFloatLE(off + 8));
    off += 12;
  }
  off += 2;                            // attribute byte count
}

// bbox
let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
for (let i = 0; i < vx.length; i++) {
  if (vx[i] < minX) minX = vx[i]; if (vx[i] > maxX) maxX = vx[i];
  if (vy[i] < minY) minY = vy[i]; if (vy[i] > maxY) maxY = vy[i];
  if (vz[i] < minZ) minZ = vz[i]; if (vz[i] > maxZ) maxZ = vz[i];
}
const cell = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / GRID || 1;

// cluster vertices
const clusters = new Map();
const vmap = new Int32Array(vx.length);
let outN = 0;
for (let i = 0; i < vx.length; i++) {
  const key = Math.floor((vx[i] - minX) / cell) + "_" + Math.floor((vy[i] - minY) / cell) + "_" + Math.floor((vz[i] - minZ) / cell);
  let cl = clusters.get(key);
  if (!cl) { cl = { sx: 0, sy: 0, sz: 0, c: 0, idx: outN++ }; clusters.set(key, cl); }
  cl.sx += vx[i]; cl.sy += vy[i]; cl.sz += vz[i]; cl.c++;
  vmap[i] = cl.idx;
}
const ov = new Array(outN);
for (const cl of clusters.values()) ov[cl.idx] = [cl.sx / cl.c, cl.sy / cl.c, cl.sz / cl.c];

// remap triangles, drop degenerate + duplicate
const seen = new Set(), of = [];
for (let t = 0; t < nTri; t++) {
  const a = vmap[t * 3], bb = vmap[t * 3 + 1], c = vmap[t * 3 + 2];
  if (a === bb || bb === c || a === c) continue;
  const key = [a, bb, c].sort((x, y) => x - y).join(",");
  if (seen.has(key)) continue;
  seen.add(key);
  of.push([a, bb, c]);
}

const out = ["# STL->OBJ decimated grid=" + GRID + "  tris " + nTri + "->" + of.length + "  verts " + outN];
for (const v of ov) out.push("v " + v[0].toFixed(4) + " " + v[1].toFixed(4) + " " + v[2].toFixed(4));
for (const f of of) out.push("f " + (f[0] + 1) + " " + (f[1] + 1) + " " + (f[2] + 1));
fs.writeFileSync(outPath, out.join("\n"));
console.log(`${inPath} -> ${outPath}  tris ${nTri}->${of.length}  verts ${outN}  ${(Buffer.byteLength(out.join("\n")) / 1048576).toFixed(2)}MB`);
