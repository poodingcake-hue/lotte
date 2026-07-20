// CORS origins allowed for the application
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://poodingcake-hue.github.io"
];

// Helper to construct CORS headers dynamically based on origin request
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".github.io") || origin.endsWith(".workers.dev"))) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else {
    // Default fallback to GitHub Pages origin
    headers["Access-Control-Allow-Origin"] = "https://poodingcake-hue.github.io";
  }
  return headers;
}

// Simple Bearer authentication verification
function authenticate(request, env) {
  // If API_KEY is not defined in backend variables, bypass auth checking (default/local setups)
  if (!env.API_KEY) return true;

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;

  const token = authHeader.substring(7);
  return token === env.API_KEY;
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Authenticate all requests except static images or public proxies
    const url = new URL(request.url);
    const isImageRequest = request.method === "GET" && url.pathname.startsWith("/images/");
    const isProxyRequest = request.method === "GET" && url.pathname === "/proxy";

    if (!isImageRequest && !isProxyRequest && !authenticate(request, env)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      // 1. GET /images/:filename - Serve images directly from R2
      if (request.method === "GET" && url.pathname.startsWith("/images/")) {
        const filename = url.pathname.split("/images/")[1];
        if (!filename) return new Response("Not found", { status: 404 });
        
        const object = await env.IMAGE_BUCKET.get(filename);
        if (!object) return new Response("Not found", { status: 404 });
        
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("Access-Control-Allow-Origin", "*"); // R2 assets can be public

        return new Response(object.body, { headers });
      }

      // 2. GET /proxy - SSRF protected Image Proxy
      if (request.method === "GET" && url.pathname === "/proxy") {
        const targetUrl = url.searchParams.get("url");
        if (!targetUrl) return new Response("Missing url", { status: 400, headers: corsHeaders });
        
        try {
          const parsedTarget = new URL(targetUrl);
          const allowedProxyHosts = [
            "image2.lotteimall.com",
            "www.lotteimall.com",
            "fal.media",
            "queue.fal.run"
          ];
          const isAllowed = allowedProxyHosts.some(host => 
            parsedTarget.hostname === host || parsedTarget.hostname.endsWith("." + host) || parsedTarget.hostname.endsWith(".workers.dev")
          );

          if (!isAllowed) {
            return new Response("Forbidden proxy target host", { status: 403, headers: corsHeaders });
          }

          const res = await fetch(targetUrl);
          if (!res.ok) return new Response("Failed to fetch target URL", { status: res.status, headers: corsHeaders });
          
          const contentType = res.headers.get("content-type") || "image/jpeg";
          const body = await res.arrayBuffer();
          
          return new Response(body, {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400"
            }
          });
        } catch (e) {
          return new Response("Proxy error: " + e.message, { status: 500, headers: corsHeaders });
        }
      }

      // 3. GET /listr2 - List images in R2 bucket
      if (request.method === "GET" && url.pathname === "/listr2") {
        const list = await env.IMAGE_BUCKET.list({ limit: 1000 });
        return new Response(JSON.stringify(list.objects.map(o => o.key)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 4. GET / - Fetch unified application state batch
      if (request.method === "GET" && url.pathname === "/") {
        const batchResults = await env.DB.batch([
            env.DB.prepare("SELECT * FROM inventory"),
            env.DB.prepare("SELECT * FROM rentals"),
            env.DB.prepare("SELECT * FROM outfits"),
            env.DB.prepare("SELECT * FROM notes"),
            env.DB.prepare("SELECT * FROM supplies"),
            env.DB.prepare("SELECT * FROM products"),
            env.DB.prepare("SELECT * FROM inventory_history"),
            env.DB.prepare("SELECT * FROM custom_models ORDER BY created_at DESC"),
            env.DB.prepare("SELECT * FROM gallery ORDER BY created_at DESC")
        ]);

        const inventoryResults = batchResults[0].results;
        const rentalsResults = batchResults[1].results;
        const outfitsResults = batchResults[2].results;
        const notesResults = batchResults[3].results;
        const suppliesResults = batchResults[4].results;
        const productsResults = batchResults[5].results;
        const historyResults = batchResults[6].results;
        const customModelsResults = batchResults[7].results;
        const galleryResults = batchResults[8].results;

        const formattedInventory = {};
        inventoryResults.forEach(item => {
          if (!formattedInventory[item.code]) {
            formattedInventory[item.code] = [];
          }
          formattedInventory[item.code].push({
            size: item.size,
            color: item.color,
            qty: item.qty
          });
        });

        const responseData = {
          inventory: formattedInventory,
          rentals: rentalsResults,
          outfits: outfitsResults,
          notes: notesResults,
          supplies: suppliesResults,
          products: productsResults,
          history: historyResults,
          custom_models: customModelsResults,
          gallery: galleryResults
        };

        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 5. POST / - API handling endpoints
      if (request.method === "POST") {
        const contentType = request.headers.get("content-type") || "";
        
        // Multipart file upload to R2
        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          const file = formData.get("file");
          if (!file) {
            return new Response(JSON.stringify({ success: false, message: "No file provided" }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          
          const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          
          await env.IMAGE_BUCKET.put(filename, file.stream(), {
            httpMetadata: { contentType: file.type }
          });
          
          const imageUrl = `${url.origin}/images/${filename}`;
          
          return new Response(JSON.stringify({ success: true, imageUrl }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // JSON RPC actions
        const body = await request.json();
        const { type, data } = body;

        // Route actions securely using separate handlers
        switch (type) {
          case "fal_api_proxy": {
            const { modelUrl, payload } = data;
            const key = env.FAL_API_KEY;
            if (!key) {
              return new Response(JSON.stringify({ error: "FAL_API_KEY is not configured on the server." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const res = await fetch(`https://queue.fal.run/${modelUrl}`, {
                method: 'POST',
                headers: { 'Authorization': 'Key ' + key, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) return new Response(JSON.stringify({ error: 'Fal API Error: ' + res.status }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify(await res.json()), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          case "fal_api_status": {
            const { statusUrl } = data;
            const key = env.FAL_API_KEY;
            const res = await fetch(statusUrl, { headers: { 'Authorization': 'Key ' + key } });
            if (!res.ok) return new Response(JSON.stringify({ error: 'Polling failed' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify(await res.json()), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          case "fal_api_result": {
            const { responseUrl } = data;
            const key = env.FAL_API_KEY;
            const res = await fetch(responseUrl, { headers: { 'Authorization': 'Key ' + key } });
            if (!res.ok) return new Response(JSON.stringify({ error: 'Fetch result failed' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify(await res.json()), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          case "update_product_image": {
            const { code, image } = data;
            if (code && image !== undefined) {
               await env.DB.prepare("UPDATE products SET image = ? WHERE code = ?").bind(image, code).run();
               return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          case "save_model": {
             const { name, url, height } = data;
             if (name && url) {
                 await env.DB.prepare("INSERT INTO custom_models (name, url, height) VALUES (?, ?, ?)").bind(name, url, height ? Number(height) : null).run();
                 return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
             }
             return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          case "save_gallery": {
             const { type: gType, url } = data;
             if (gType && url) {
                 await env.DB.prepare("INSERT INTO gallery (type, url) VALUES (?, ?)").bind(gType, url).run();
                 return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
             }
             return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          case "delete_gallery": {
             const { id } = data;
             if (id) {
                 await env.DB.prepare("DELETE FROM gallery WHERE id = ?").bind(id).run();
                 return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
             }
             return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Single product UPSERT (Optimized & concurrency-safe)
          case "save_product": {
            const item = data;
            if (item && item.code) {
              await env.DB.prepare(
                "INSERT OR REPLACE INTO products (code, brand, name, category, image, date, isMaster, colors, sizes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
              ).bind(
                item.code,
                item.brand || "",
                item.name || "",
                item.category || "",
                item.image || "",
                item.date || "",
                item.isMaster ? 1 : 0,
                item.colors || "",
                item.sizes || ""
              ).run();
              return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ success: false, message: "Missing item details" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Concurrency-safe rentals updates scoped by product code
          case "save_product_rentals": {
            const { code, rentals } = data;
            if (code) {
              const statements = [env.DB.prepare("DELETE FROM rentals WHERE code = ?").bind(code)];
              if (rentals && rentals.length > 0) {
                const stmt = env.DB.prepare("INSERT INTO rentals (code, renter, color, size, qty, date) VALUES (?, ?, ?, ?, ?, ?)");
                rentals.forEach(r => {
                  statements.push(stmt.bind(code, r.renter, r.color || "", r.size || "", r.qty || 1, r.date || ""));
                });
              }
              for (let i = 0; i < statements.length; i += 100) {
                await env.DB.batch(statements.slice(i, i + 100));
              }
              return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Concurrency-safe outfits updates scoped by product code
          case "save_product_outfits": {
            const { code, outfits } = data;
            if (code) {
              const statements = [env.DB.prepare("DELETE FROM outfits WHERE code = ?").bind(code)];
              if (outfits && outfits.length > 0) {
                const stmt = env.DB.prepare("INSERT INTO outfits (code, host, size) VALUES (?, ?, ?)");
                outfits.forEach(o => {
                  statements.push(stmt.bind(code, o.host, o.size || ""));
                });
              }
              for (let i = 0; i < statements.length; i += 100) {
                await env.DB.batch(statements.slice(i, i + 100));
              }
              return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Concurrency-safe single note update
          case "save_note": {
            const { code, text } = data;
            if (code) {
              const statements = [env.DB.prepare("DELETE FROM notes WHERE code = ?").bind(code)];
              if (text) {
                statements.push(env.DB.prepare("INSERT INTO notes (code, text) VALUES (?, ?)").bind(code, text));
              }
              await env.DB.batch(statements);
              return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Concurrency-safe single supply update
          case "save_supply": {
            const { code, text } = data;
            if (code) {
              const statements = [env.DB.prepare("DELETE FROM supplies WHERE code = ?").bind(code)];
              if (text) {
                statements.push(env.DB.prepare("INSERT INTO supplies (code, text) VALUES (?, ?)").bind(code, text));
              }
              await env.DB.batch(statements);
              return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Key-specific code-based clean delete-insert for inventory
          case "save_inventory": {
             const statements = [];
             if (data && data.length > 0) {
                 const codes = [...new Set(data.map(item => item.code))];
                 codes.forEach(code => {
                     statements.push(env.DB.prepare("DELETE FROM inventory WHERE code = ?").bind(code));
                 });
                 
                 const stmt = env.DB.prepare("INSERT INTO inventory (code, color, size, qty) VALUES (?, ?, ?, ?)");
                 data.forEach(item => {
                     statements.push(stmt.bind(item.code, item.color, item.size, item.qty));
                 });
             }
             for (let i = 0; i < statements.length; i += 100) {
                 await env.DB.batch(statements.slice(i, i + 100));
             }
             return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Bulk history log saving
          case "save_history": {
             const statements = [];
             if (data && data.length > 0) {
                 const stmt = env.DB.prepare("INSERT INTO inventory_history (code, color, size, type, qty, actor, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                 data.forEach(item => {
                     statements.push(stmt.bind(item.code, item.color, item.size, item.type, item.qty, item.actor || "", item.date || "", item.note || ""));
                 });
             }
             for (let i = 0; i < statements.length; i += 100) {
                 await env.DB.batch(statements.slice(i, i + 100));
             }
             return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Selective history logs updates
          case "update_history": {
             const statements = [];
             if (data && data.length > 0) {
                 const updateHistoryStmt = env.DB.prepare("UPDATE inventory_history SET qty = ?, date = ?, note = ? WHERE id = ?");
                 const updateInventoryStmt = env.DB.prepare("UPDATE inventory SET qty = qty + ? WHERE code = ? AND color = ? AND size = ?");
                 
                 data.forEach(item => {
                     statements.push(updateHistoryStmt.bind(item.qty, item.date || "", item.note || "", item.id));
                     if (item.deltaQty !== 0) {
                         statements.push(updateInventoryStmt.bind(item.deltaQty, item.code, item.color, item.size));
                     }
                 });
             }
             for (let i = 0; i < statements.length; i += 100) {
                 await env.DB.batch(statements.slice(i, i + 100));
             }
             return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // DEPRECATED / FALLBACK: Entire table write fallbacks (Safe versions)
          case "save_products": {
            if (data && data.length > 0) {
                const stmt = env.DB.prepare("INSERT OR REPLACE INTO products (code, brand, name, category, image, date, isMaster, colors, sizes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                const statements = data.map(item => stmt.bind(
                    item.code,
                    item.brand || "",
                    item.name || "",
                    item.category || "",
                    item.image || "",
                    item.date || "",
                    item.isMaster ? 1 : 0,
                    item.colors || "",
                    item.sizes || ""
                ));
                for (let i = 0; i < statements.length; i += 100) {
                    await env.DB.batch(statements.slice(i, i + 100));
                }
            }
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          case "save_rentals": {
             const statements = [env.DB.prepare("DELETE FROM rentals")];
             if (data && data.length > 0) {
                 const stmt = env.DB.prepare("INSERT INTO rentals (code, renter, color, size, qty, date) VALUES (?, ?, ?, ?, ?, ?)");
                 data.forEach(item => {
                     statements.push(stmt.bind(item.code, item.renter, item.color || "", item.size || "", item.qty || 1, item.date || ""));
                 });
             }
             for (let i = 0; i < statements.length; i += 100) {
                 await env.DB.batch(statements.slice(i, i + 100));
             }
             return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          case "save_outfits": {
             const statements = [env.DB.prepare("DELETE FROM outfits")];
             if (data && data.length > 0) {
                 const stmt = env.DB.prepare("INSERT INTO outfits (code, host, size) VALUES (?, ?, ?)");
                 data.forEach(item => {
                     statements.push(stmt.bind(item.code, item.host, item.size || ""));
                 });
             }
             for (let i = 0; i < statements.length; i += 100) {
                 await env.DB.batch(statements.slice(i, i + 100));
             }
             return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          case "save_notes": {
             const statements = [env.DB.prepare("DELETE FROM notes")];
             if (data && data.length > 0) {
                 const stmt = env.DB.prepare("INSERT INTO notes (code, text) VALUES (?, ?)");
                 data.forEach(item => {
                     statements.push(stmt.bind(item.code, item.text));
                 });
             }
             for (let i = 0; i < statements.length; i += 100) {
                 await env.DB.batch(statements.slice(i, i + 100));
             }
             return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          case "save_supplies": {
             const statements = [env.DB.prepare("DELETE FROM supplies")];
             if (data && data.length > 0) {
                 const stmt = env.DB.prepare("INSERT INTO supplies (code, text) VALUES (?, ?)");
                 data.forEach(item => {
                     statements.push(stmt.bind(item.code, item.text));
                 });
             }
             for (let i = 0; i < statements.length; i += 100) {
                 await env.DB.batch(statements.slice(i, i + 100));
             }
             return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          default:
            return new Response(JSON.stringify({ error: "Unknown request type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};
