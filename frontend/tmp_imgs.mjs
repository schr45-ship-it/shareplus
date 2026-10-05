const h = await (await fetch("https://www.shareplusai.com/he")).text();
const srcs = [...h.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m=>m[1]);
console.log("img tags:", srcs.length);
console.log([...new Set(srcs)].join("\n"));
