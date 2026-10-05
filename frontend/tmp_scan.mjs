import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>l.split("=")));
const base = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const h = { apikey: key, Authorization: "Bearer "+key };
const arts = await (await fetch(base+"/rest/v1/articles?select=id,featured_image_url,status&status=eq.published&limit=600",{headers:h})).json();
console.log("published:", arts.length);
const broken=[];
await Promise.all(arts.map(async a=>{
  if(!a.featured_image_url) return;
  try{ const r=await fetch(a.featured_image_url,{method:"HEAD"}); if(!r.ok) broken.push({id:a.id,url:a.featured_image_url,code:r.status}); }
  catch(e){ broken.push({id:a.id,url:a.featured_image_url,code:"err"}); }
}));
console.log("broken:",broken.length);
fs.writeFileSync("broken.json",JSON.stringify(broken,null,1));
broken.slice(0,20).forEach(b=>console.log(b.code,b.url.slice(0,110)));
