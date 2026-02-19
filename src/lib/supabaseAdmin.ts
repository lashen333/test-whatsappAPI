// src\lib\supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const Url = process.env.SUPABASE_URL!;
console.log("Supabase URL:", Url);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
console.log("Supabase Service Role Key:", serviceKey ? "Loaded" : "Missing");

//Service role key must ONLY be used server-side
export const supabaseAdmin = createClient(Url, serviceKey,{
    auth:{persistSession: false},
});