// Build-time / static generation client
// No cookies / auth context — safe for use in generateStaticParams
import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

export const supabaseBuild = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
