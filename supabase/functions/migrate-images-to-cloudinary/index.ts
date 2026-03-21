import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dclgv77ji/image/upload";
const UPLOAD_PRESET = "ubadesklimp";
const BATCH_LIMIT = 20;

async function uploadToCloudinary(imageUrl: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("file", imageUrl);
    formData.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(CLOUDINARY_URL, { method: "POST", body: formData });
    if (!res.ok) {
      const text = await res.text();
      console.error("Cloudinary error:", text);
      return null;
    }
    const data = await res.json();
    return data.secure_url;
  } catch (e) {
    console.error("Upload failed for", imageUrl, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results = { migrated: 0, failed: 0, details: [] as string[] };
    let remaining = BATCH_LIMIT;

    // 1. Products
    if (remaining > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, image_url")
        .like("image_url", "%supabase%")
        .limit(remaining);

      for (const p of products || []) {
        const newUrl = await uploadToCloudinary(p.image_url);
        if (newUrl) {
          await supabase.from("products").update({ image_url: newUrl }).eq("id", p.id);
          results.migrated++;
          results.details.push(`product:${p.id}`);
        } else {
          results.failed++;
        }
        remaining--;
      }
    }

    // 2. Product variations
    if (remaining > 0) {
      const { data: variations } = await supabase
        .from("product_variations")
        .select("id, image_url")
        .like("image_url", "%supabase%")
        .limit(remaining);

      for (const v of variations || []) {
        const newUrl = await uploadToCloudinary(v.image_url);
        if (newUrl) {
          await supabase.from("product_variations").update({ image_url: newUrl }).eq("id", v.id);
          results.migrated++;
          results.details.push(`variation:${v.id}`);
        } else {
          results.failed++;
        }
        remaining--;
      }
    }

    // 3. Product fragrances
    if (remaining > 0) {
      const { data: fragrances } = await supabase
        .from("product_fragrances")
        .select("id, image_url")
        .like("image_url", "%supabase%")
        .limit(remaining);

      for (const f of fragrances || []) {
        const newUrl = await uploadToCloudinary(f.image_url);
        if (newUrl) {
          await supabase.from("product_fragrances").update({ image_url: newUrl }).eq("id", f.id);
          results.migrated++;
          results.details.push(`fragrance:${f.id}`);
        } else {
          results.failed++;
        }
        remaining--;
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
