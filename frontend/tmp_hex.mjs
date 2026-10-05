const u="https://bmnsaeqdudktftnacttk.supabase.co/storage/v1/object/public/article-images/62e12204-ad70-4577-b3d9-14863f0b9d6f.jpg";
const buf = await (await fetch(u)).arrayBuffer();
const b = Buffer.from(buf);
console.log("hex:", b.slice(0,16).toString("hex"));
console.log("text:", JSON.stringify(b.slice(0,200).toString("latin1")));
