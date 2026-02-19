// src\lib\supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const Url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

//Service role key must ONLY be used server-side
export const supabaseAdmin = createClient(Url, serviceKey,{
    auth:{persistSession: false},
});