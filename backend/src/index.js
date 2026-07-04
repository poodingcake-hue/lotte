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
      if (request.method === "GET") {
        // Optimize reads by batching them into a single roundtrip!
        const batchResults = await env.DB.batch([
            env.DB.prepare("SELECT * FROM inventory"),
            env.DB.prepare("SELECT * FROM rentals"),
            env.DB.prepare("SELECT * FROM outfits"),
            env.DB.prepare("SELECT * FROM notes"),
            env.DB.prepare("SELECT * FROM supplies"),
            env.DB.prepare("SELECT * FROM products")
        ]);

        const inventoryResults = batchResults[0].results;
        const rentalsResults = batchResults[1].results;
        const outfitsResults = batchResults[2].results;
        const notesResults = batchResults[3].results;
        const suppliesResults = batchResults[4].results;
        const productsResults = batchResults[5].results;

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
          products: productsResults
        };

        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (request.method === "POST") {
        const body = await request.json();
        const { type, data } = body;

        if (type === "save_rentals") {
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
           const statements = [env.DB.prepare("DELETE FROM inventory")];
           if (data && data.length > 0) {
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
