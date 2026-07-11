const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      
      // Serve images directly from R2
      if (request.method === "GET" && url.pathname.startsWith("/images/")) {
        const filename = url.pathname.split("/images/")[1];
        if (!filename) return new Response("Not found", { status: 404 });
        
        const object = await env.IMAGE_BUCKET.get(filename);
        if (!object) return new Response("Not found", { status: 404 });
        
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        // Add CORS headers for images too
        headers.set("Access-Control-Allow-Origin", "*");

        return new Response(object.body, { headers });
      }

      if (request.method === "GET" && url.pathname === "/listr2") {
        const list = await env.IMAGE_BUCKET.list({ limit: 1000 });
        return new Response(JSON.stringify(list.objects.map(o => o.key)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (request.method === "GET") {
        // Optimize reads by batching them into a single roundtrip!
        const batchResults = await env.DB.batch([
            env.DB.prepare("SELECT * FROM inventory"),
            env.DB.prepare("SELECT * FROM rentals"),
            env.DB.prepare("SELECT * FROM outfits"),
            env.DB.prepare("SELECT * FROM notes"),
            env.DB.prepare("SELECT * FROM supplies"),
            env.DB.prepare("SELECT * FROM products"),
            env.DB.prepare("SELECT * FROM inventory_history")
        ]);

        const inventoryResults = batchResults[0].results;
        const rentalsResults = batchResults[1].results;
        const outfitsResults = batchResults[2].results;
        const notesResults = batchResults[3].results;
        const suppliesResults = batchResults[4].results;
        const productsResults = batchResults[5].results;
        const historyResults = batchResults[6].results;

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
          history: historyResults
        };

        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (request.method === "POST") {
        const contentType = request.headers.get("content-type") || "";
        
        // Handle image uploads via multipart/form-data
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

        // Handle JSON RPC
        const body = await request.json();
        const { type, data } = body;

        if (type === "fal_api_proxy") {
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
        else if (type === "fal_api_status") {
          const { statusUrl } = data;
          const key = env.FAL_API_KEY;
          const res = await fetch(statusUrl, { headers: { 'Authorization': 'Key ' + key } });
          if (!res.ok) return new Response(JSON.stringify({ error: 'Polling failed' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          return new Response(JSON.stringify(await res.json()), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        else if (type === "fal_api_result") {
          const { responseUrl } = data;
          const key = env.FAL_API_KEY;
          const res = await fetch(responseUrl, { headers: { 'Authorization': 'Key ' + key } });
          if (!res.ok) return new Response(JSON.stringify({ error: 'Fetch result failed' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          return new Response(JSON.stringify(await res.json()), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        else if (type === "update_product_image") {
          const { code, image } = data;
          if (code && image !== undefined) {
             await env.DB.prepare("UPDATE products SET image = ? WHERE code = ?").bind(image, code).run();
             return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          return new Response(JSON.stringify({ success: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        else if (type === "save_rentals") {
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
        } 
        else if (type === "save_outfits") {
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
        }
        else if (type === "save_notes") {
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
        }
        else if (type === "save_supplies") {
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
        }
        else if (type === "save_inventory") {
           const statements = [];
           if (data && data.length > 0) {
               // Fix: Only delete the specific product codes being updated, NOT the entire table
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
        }
        else if (type === "save_products") {
           const statements = [env.DB.prepare("DELETE FROM products")];
           if (data && data.length > 0) {
               const stmt = env.DB.prepare("INSERT INTO products (code, brand, name, category, image, date, isMaster, colors, sizes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
               data.forEach(item => {
                   statements.push(stmt.bind(
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
               });
           }
           // Use maximum chunk size of 100 allowed by D1
           for (let i = 0; i < statements.length; i += 100) {
               await env.DB.batch(statements.slice(i, i + 100));
           }
        }
        else if (type === "save_history") {
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
        }
        else if (type === "update_history") {
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
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};
