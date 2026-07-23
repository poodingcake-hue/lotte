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
            // Inventory is derived (SUM) from inventory_history, never stored/written directly.
            // inventory_history is the single source of truth for stock levels.
            env.DB.prepare("SELECT code, color, size, SUM(qty) as qty FROM inventory_history GROUP BY code, color, size"),
            env.DB.prepare("SELECT * FROM outfits"),
            env.DB.prepare("SELECT * FROM notes"),
            env.DB.prepare("SELECT * FROM supplies"),
            env.DB.prepare("SELECT * FROM products"),
            // Rental checkouts (type RENT) and returns (type RETURN, linked back via ref_id) also
            // live here — "who has what still outstanding" is derived from this, not a separate table.
            env.DB.prepare("SELECT * FROM inventory_history"),
            env.DB.prepare("SELECT * FROM custom_models ORDER BY created_at DESC"),
            env.DB.prepare("SELECT * FROM gallery ORDER BY created_at DESC")
        ]);

        const inventoryResults = batchResults[0].results;
        const outfitsResults = batchResults[1].results;
        const notesResults = batchResults[2].results;
        const suppliesResults = batchResults[3].results;
        const productsResults = batchResults[4].results;
        const historyResults = batchResults[5].results;
        const customModelsResults = batchResults[6].results;
        const galleryResults = batchResults[7].results;

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
          
          const originalName = file.name || 'upload.png';
          const filename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          
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
          case "analyze_size_chart": {
              const { imageBase64, mimeType, category } = data;
              const openaiKey = env.OPENAI_API_KEY;
              if (!openaiKey) {
                return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured on the server.", envKeys: Object.keys(env) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
              }

              // 실제 사이즈표를 카테고리별/MD별로 여러 건 비교한 결과, 원본 라벨 표기(총기장 vs
              // 총장(아웃심), 힙둘레 vs 힙(턱접고)/힙(턱펴고), 소매장 vs 소매기장 등)는 상품마다
              // 제각각이지만, 의미상 대응되는 항목은 카테고리별로 공통이었다. 그래서 카테고리별
              // 목표(canonical) 필드로 고정하고, GPT가 원본 라벨을 의미로 매핑해서 채우게 한다.
              const CATEGORY_FIELDS = {
                "하의": ["총장", "허리둘레", "엉덩이둘레", "허벅지둘레", "밑단둘레"],
                "상의": ["총장", "어깨너비", "가슴둘레", "소매기장", "밑단둘레"],
                "아우터": ["총장", "어깨너비", "가슴둘레", "소매기장", "밑단둘레"],
              };
              const fields = CATEGORY_FIELDS[category] || CATEGORY_FIELDS["상의"];
              const exampleObj = fields.reduce((acc, f, i) => ({ ...acc, [f]: String(60 + i) }), { category: "M" });

              const prompt = `This is a commercial clothing product size chart table image. Row labels vary by product even within the same garment type (e.g., "총기장" or "총장(아웃심)" instead of "총장"; "힙둘레" or separate "힙(턱접고)"/"힙(턱펴고)" instead of "엉덩이둘레"; "소매장" instead of "소매기장"; "허리" instead of "허리둘레").

Extract the numeric cm measurements for each size column, and map them SEMANTICALLY onto exactly these target fields: ${fields.join(", ")}.
Rules:
- Use the target field names exactly as given above, regardless of the original row label wording in the image.
- If a target field has no corresponding row in the image, omit that key for that size entry entirely — do not guess or invent a value.
- If a measurement appears as two variants (e.g., "힙(턱접고)" and "힙(턱펴고)"), prefer the "턱펴고" (unfolded) value; if only one variant exists, use that.
- Ignore any rows that don't correspond to one of the target fields (e.g., 무릎, 암홀, 소매통, 소매부리, 목넓이, 목깊이).

Return the result STRICTLY as a JSON object with this exact structure (example shape, not real values):
{
  "sizes": [
    ${JSON.stringify(exampleObj)}
  ]
}
Do not include any markdown formatting, code blocks, or extra text. Just the raw JSON object.`;

              try {
                const res = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${openaiKey}`,
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                      {
                        role: "user",
                        content: [
                          { type: "text", text: prompt },
                          {
                            type: "image_url",
                            image_url: {
                              url: `data:${mimeType || "image/png"};base64,${imageBase64}`
                            }
                          }
                        ]
                      }
                    ]
                  })
                });
  
                if (!res.ok) {
                    const errText = await res.text();
                    console.error("OpenAI Error:", res.status, errText);
                    return new Response(JSON.stringify({ error: `OpenAI API Error: ${errText}` }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
  
                const result = await res.json();
                console.log("OpenAI Result:", JSON.stringify(result, null, 2));
                const message = result.choices[0]?.message;
                
                if (message?.refusal) {
                  console.error("OpenAI Refusal:", message.refusal);
                  return new Response(JSON.stringify({ error: "OpenAI refused to process the image: " + message.refusal }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }

                const text = message?.content;

                if (!text) {
                  throw new Error("OpenAI returned empty text: " + JSON.stringify(result));
                }

                // Clean up markdown if any
                let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

                // GPT는 message.refusal 필드 없이, content 자리에 "I'm sorry, I can't assist
                // with that." 같은 자연어 거절 문구를 그냥 텍스트로 돌려줄 때가 있다. 이런 경우
                // JSON.parse가 실패해서 뭉뚱그린 "파싱 실패" 에러로만 보이던 걸, 여기서 먼저
                // 걸러내서 "AI가 거절했다"는 걸 명확히 알려준다.
                if (!cleanText.startsWith('{')) {
                  console.error("OpenAI Natural-language Refusal:", cleanText);
                  return new Response(JSON.stringify({ error: "AI가 이 이미지 분석을 거부했습니다. 다른 이미지로 다시 시도해보세요. (원문: " + cleanText.slice(0, 200) + ")" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }

                const parsed = JSON.parse(cleanText);
  
                return new Response(JSON.stringify({
                  success: true,
                  data: parsed
                }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
              } catch (e) {
                console.error("Parse Error:", e);
                return new Response(JSON.stringify({ error: "Failed to parse sizes." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
              }
            }

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

          case "upload_url_to_r2": {
            const { url: sourceUrl } = data;
            try {
              const imgRes = await fetch(sourceUrl);
              if (!imgRes.ok) throw new Error("Failed to fetch source image");
              
              const contentType = imgRes.headers.get("content-type") || "image/png";
              const filename = `${Date.now()}-nukki.png`;
              
              await env.IMAGE_BUCKET.put(filename, imgRes.body, {
                httpMetadata: { contentType }
              });
              
              const imageUrl = `${url.origin}/images/${filename}`;
              return new Response(JSON.stringify({ success: true, imageUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            } catch (e) {
              return new Response(JSON.stringify({ success: false, message: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }

          case "proxy_image": {
            const { imageUrl } = data;
            try {
              let arrayBuffer;
              let contentType = "image/png";

              // 우리 서버(R2) URL이면 R2에서 직접 읽기 (HTTP fetch 대신)
              const r2Match = imageUrl.match(/\/images\/(.+)$/);
              if (r2Match && (imageUrl.includes('lotte-backend') || imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1'))) {
                const filename = decodeURIComponent(r2Match[1]);
                const object = await env.IMAGE_BUCKET.get(filename);
                if (!object) throw new Error("R2 object not found: " + filename);
                arrayBuffer = await object.arrayBuffer();
                contentType = object.httpMetadata?.contentType || "image/png";
              } else {
                // 외부 URL은 HTTP fetch (User-Agent 및 Referer 헤더 추가하여 403/차단 방지)
                const imgRes = await fetch(imageUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Referer': 'https://www.lotteimall.com/'
                  }
                });
                if (!imgRes.ok) throw new Error("Failed to fetch image: " + imgRes.status);
                arrayBuffer = await imgRes.arrayBuffer();
                contentType = imgRes.headers.get("content-type") || "image/jpeg";
              }

              // Chunked base64 encoding to prevent V8 stack overflow on large images
              let binary = '';
              const bytes = new Uint8Array(arrayBuffer);
              const chunkSize = 8192;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
              }
              const base64Str = btoa(binary);

              return new Response(JSON.stringify({ success: true, base64: `data:${contentType};base64,${base64Str}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            } catch (e) {
              return new Response(JSON.stringify({ success: false, message: e.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
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
            if (!res.ok) {
              const text = await res.text();
              console.error('Fal API Result Fetch Failed:', text);
              return new Response(JSON.stringify({ error: 'Fetch result failed: ' + text }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
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

          // Bulk history log saving. Returns the auto-assigned id of each inserted row (same
          // order as `data`) so callers can immediately reference a row (e.g. a RETURN log's
          // ref_id pointing back at the RENT log it closes out) without waiting for a reload.
          case "save_history": {
             const ids = [];
             if (data && data.length > 0) {
                 const stmt = env.DB.prepare("INSERT INTO inventory_history (code, color, size, type, qty, actor, date, note, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                 const statements = data.map(item => stmt.bind(
                     item.code, item.color, item.size, item.type, item.qty,
                     item.actor || "", item.date || "", item.note || "",
                     item.ref_id !== undefined && item.ref_id !== null ? item.ref_id : null
                 ));
                 for (let i = 0; i < statements.length; i += 100) {
                     const batchResults = await env.DB.batch(statements.slice(i, i + 100));
                     batchResults.forEach(r => ids.push(r.meta.last_row_id));
                 }
             }
             return new Response(JSON.stringify({ success: true, ids }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Selective history logs updates
          // Inventory is derived from inventory_history, so editing a past log entry only
          // needs to update that row — the aggregated stock total reflects it automatically.
          case "update_history": {
             const statements = [];
             if (data && data.length > 0) {
                 const updateHistoryStmt = env.DB.prepare("UPDATE inventory_history SET qty = ?, date = ?, note = ? WHERE id = ?");
                 data.forEach(item => {
                     statements.push(updateHistoryStmt.bind(item.qty, item.date || "", item.note || "", item.id));
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
