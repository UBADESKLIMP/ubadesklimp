import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const bucket = "product-images";
    let totalDeleted = 0;
    const batchSize = 100;

    // Collect all file paths first
    const allPaths: string[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: files, error: listError } = await supabase.storage
        .from(bucket)
        .list("", { limit: batchSize, offset });

      if (listError) throw listError;
      if (!files || files.length === 0) break;

      allPaths.push(...files.map((f) => f.name));
      offset += files.length;
      if (files.length < batchSize) hasMore = false;
    }

    // Delete in batches
    for (let i = 0; i < allPaths.length; i += batchSize) {
      const batch = allPaths.slice(i, i + batchSize);
      const { error: removeError } = await supabase.storage
        .from(bucket)
        .remove(batch);
      if (removeError) throw removeError;
      totalDeleted += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, totalDeleted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
