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
        const { results: inventoryResults } = await env.DB.prepare("SELECT * FROM inventory").all();
        const { results: rentalsResults } = await env.DB.prepare("SELECT * FROM rentals").all();
        const { results: outfitsResults } = await env.DB.prepare("SELECT * FROM outfits").all();
        const { results: notesResults } = await env.DB.prepare("SELECT * FROM notes").all();
        const { results: suppliesResults } = await env.DB.prepare("SELECT * FROM supplies").all();

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
          supplies: suppliesResults
        };

        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (request.method === "POST") {
        const body = await request.json();
        const { type, data } = body;

        if (type === "save_rentals") {
           await env.DB.prepare("DELETE FROM rentals").run();
           if (data && data.length > 0) {
               const stmt = env.DB.prepare("INSERT INTO rentals (code, renter, color, size, qty, date) VALUES (?, ?, ?, ?, ?, ?)");
               const batch = data.map(item => stmt.bind(item.code, item.renter, item.color || "", item.size || "", item.qty || 1, item.date || ""));
               await env.DB.batch(batch);
           }
        } 
        else if (type === "save_outfits") {
           await env.DB.prepare("DELETE FROM outfits").run();
           if (data && data.length > 0) {
               const stmt = env.DB.prepare("INSERT INTO outfits (code, host, size) VALUES (?, ?, ?)");
               const batch = data.map(item => stmt.bind(item.code, item.host, item.size || ""));
               await env.DB.batch(batch);
           }
        }
        else if (type === "save_notes") {
           await env.DB.prepare("DELETE FROM notes").run();
           if (data && data.length > 0) {
               const stmt = env.DB.prepare("INSERT INTO notes (code, text) VALUES (?, ?)");
               const batch = data.map(item => stmt.bind(item.code, item.text));
               await env.DB.batch(batch);
           }
        }
        else if (type === "save_supplies") {
           await env.DB.prepare("DELETE FROM supplies").run();
           if (data && data.length > 0) {
               const stmt = env.DB.prepare("INSERT INTO supplies (code, text) VALUES (?, ?)");
               const batch = data.map(item => stmt.bind(item.code, item.text));
               await env.DB.batch(batch);
           }
        }
        else if (type === "save_inventory") {
           // We need to completely replace the inventory or update it.
           // Since the UI might send the whole stock map or just add an item.
           // Let's assume it sends an array of all stock.
           await env.DB.prepare("DELETE FROM inventory").run();
           if (data && data.length > 0) {
               const stmt = env.DB.prepare("INSERT INTO inventory (code, color, size, qty) VALUES (?, ?, ?, ?)");
               const batch = data.map(item => stmt.bind(item.code, item.color, item.size, item.qty));
               await env.DB.batch(batch);
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
