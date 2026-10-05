import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>l.split("=")));
const base = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r = await fetch(base+"/storage/v1/object/article-images/_perm_test.txt",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"text/plain","x-upsert":"true"},body:"x"});
console.log(r.status, await r.text());
