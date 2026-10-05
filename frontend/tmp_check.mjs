const h = await (await fetch("https://www.shareplusai.com/he")).text();
const srcs = [...new Set([...h.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m=>m[1]))];
for (const u of srcs) {
  if (u.startsWith("/")) continue;
  try {
    const r = await fetch(u);
    const ct = r.headers.get("content-type");
    const len = r.headers.get("content-length");
    const buf = await r.arrayBuffer();
    const head = Buffer.from(buf.slice(0,12)).toString("hex");
    const isJpg = head.startsWith("ffd8ff");
    console.log(r.status, ct, buf.byteLength, isJpg?"JPG":"NOT-JPG", u.slice(-50));
  } catch(e){ console.log("ERR", e.message, u.slice(-50)); }
}
