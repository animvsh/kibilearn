
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateContent } from "./generateContent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Move main logic to generateContent.ts for maintainability
  return await generateContent(req, corsHeaders);
});
