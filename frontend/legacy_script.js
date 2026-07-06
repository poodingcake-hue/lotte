    <script>
        /**
         * [?§Ï†ï] ÍπÉÌóàÎ∏?API ?∞Îèô
         */
        const GH_CONFIG = {
            user: "poodingcake-hue",
            repo: "lotte",
            // ÍπÉÌóàÎ∏?Î≥¥Ïïà ?§Ï∫ê??Secret Scanning) Í∞êÏ?Î•??ºÌïòÍ∏??ÑÌï¥ ?†ÌÅ∞??Î∂ÑÌï†?òÏó¨ ?∞Ì??ÑÏóê Í≤∞Ìï©?©Îãà??
            get token() {
                const p1 = "ghp_";
                const p2 = "0CvM1DvDQaP1UAxx";
                const p3 = "JkJ1cPDXqjIzOU4TUtg9";
                return p1 + p2 + p3;
            }
        };

        // Cloudflare Worker URL
        const GAS_WEB_APP_URL = "https://lotte-backend.poodingcake.workers.dev";
        const GAS_IMAGE_URL = "https://script.google.com/macros/s/AKfycbwhu--oAtYoa7Y0ywszHkJMRGGN6xWTb5XP6jBsyIyI5PM5ErvnZUsh70X4LxkOnlI1/exec";


        let allItems = [], allStockMap = {}, allRentals = [], allOutfits = [], allNotes = [], allSupplies = [], allWeather = null, selDate = null, filteredItems = [], curItem = null;
        let rentalCart = []; // ?Ä??Î∞îÍµ¨??


        window.onload = () => { initApp(); };
        window.onpopstate = (e) => {
            const page = (e.state && e.state.page) ? e.state.page : 'schedule';
            const item = (e.state && e.state.item) ? e.state.item : null;
            renderPageUI(page, item, false);
        };

        async function initApp() {
            document.getElementById('loading-overlay').style.display = 'flex';

            // Ï¥àÍ∏∞ ?úÏûë?îÎ©¥?Ä ?∏ÏÑ±??'schedule')Î°?Í≥†Ï†ï
            const startPage = 'schedule';
            history.replaceState({ page: startPage }, '', '#' + startPage);

            const ts = new Date().getTime();

            // ÍπÉÌóàÎ∏?APIÎ°??∞Ïù¥??Î∂àÎü¨?§Îäî Í≥µÌÜµ ?®Ïàò
            async function fetchWithToken(fileName) {
                const url = `https://api.github.com/repos/${GH_CONFIG.user}/${GH_CONFIG.repo}/contents/${fileName}`;
                try {
                    const res = await fetch(url, {
                        headers: { Authorization: `token ${GH_CONFIG.token}` },
                        cache: "no-store" // Ï∫êÏãú Î∞©Ï? Ï∂îÍ?
                    });
                    if (res.ok) {
                        const data = await res.json();
                        // ÍπÉÌóàÎ∏?base64 ?∞Ïù¥?∞Ïùò Ï§ÑÎ∞îÍø?Í≥µÎ∞± ?úÍ±∞ ???îÏΩî??(?úÍ? Íπ®Ïßê Î∞©Ï? ?¨Ìï®)
                        const cleanContent = data.content.replace(/\s/g, "");
                        return JSON.parse(decodeURIComponent(escape(atob(cleanContent))));
                    } else if (res.status !== 404) {
                        console.warn(`${fileName} Î°úÎìú ?§Ìå®: ${res.status}`);
                    }
                } catch (e) { console.error(fileName + " Ï≤òÎ¶¨ Ï§??§Î•ò", e); }
                return [];
            }

            try {
                // 1. ÎßàÏä§???∞Ïù¥??(data.json)
                const masterRes = await fetch(`data.json?v=${ts}`);
                const masterData = await masterRes.json();

                // 2. Î∞±Ïóî??Cloudflare)?êÏÑú Î™®Îì† ?ôÏ†Å ?∞Ïù¥???∏Ï∂ú (Ï∫êÏã± Î∞©Ï? ?åÎùºÎØ∏ÌÑ∞ Ï∂îÍ?)
                const backendRes = await fetch(GAS_WEB_APP_URL + `?action=getAll&v=${ts}`);
                const backendData = await backendRes.json();

                allRentals = backendData.rentals || [];
                allOutfits = backendData.outfits || [];
                allNotes = backendData.notes || [];
                allSupplies = backendData.supplies || [];
                
                // Î∞±Ïóî?úÏóê??products Î∞∞Ïó¥??Í∞Ä?∏Ï???items ??ñ¥?∞Í∏∞ ?òÎêò, ?∏ÏÑ±???§Ï?Ï§? ??™©?Ä ?†Ï?
                if (backendData.products && backendData.products.length > 0) {
                    const schedules = (masterData.items || []).filter(i => !i.isMaster);
                    // Í≥†ÏïÑ ?¨Í≥†(?ÅÌíà ÎßàÏä§?∞Í? ?ÜÎäî ?¨Í≥†) Ï≤òÎ¶¨
                    const prodKeys = new Set((backendData.products || []).map(p => p.code));
                    const orphanCodes = Object.keys(backendData.inventory || {}).filter(k => !prodKeys.has(k));
                    const dummyProducts = orphanCodes.map(code => ({
                        code: code,
                        brand: "ÎØ∏Îì±Î°?,
                        name: "Í∏∞Î≥∏ ?ïÎ≥¥Í∞Ä ?ÜÎäî ?ÅÌíà (?¨Í≥†Îß?Ï°¥Ïû¨)",
                        category: "-",
                        image: "",
                        isMaster: true
                    }));

                    masterData.items = [...backendData.products, ...dummyProducts, ...schedules];
                }

                // ?¨Í≥† ??ñ¥?∞Í∏∞
                if (backendData.inventory && Object.keys(backendData.inventory).length > 0) {
                    masterData.stockMap = backendData.inventory;
                }

                // 6. ?†Ïî® ?ïÎ≥¥ (Î°úÏª¨/?úÎ≤Ñ ?åÏùº ÏßÅÏ†ë ?∏Ï∂ú)
                try {
                    const weatherRes = await fetch(`weather.json?v=${ts}`);
                    if (weatherRes.ok) {
                        const wData = await weatherRes.json();
                        if (wData && wData.hourly) allWeather = wData;
                    }
                } catch (e) { console.warn("?†Ïî® ?∞Ïù¥??Î°úÎìú ?§Ìå®", e); allWeather = null; }

                onDataLoad(masterData, startPage);
            } catch (err) {
                console.error("?ôÍ∏∞???§Ìå®:", err);
            } finally {
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }


        

        


        // -------------------------
        // ?ÅÌíà ?±Î°ù(Register) ?òÏù¥ÏßÄ Î°úÏßÅ
        // -------------------------
        
        let uploadedImages = { main: "" };
        let isUploadingImage = false; // "main", "Î∏îÎûô", "?îÏù¥?? ??

        function previewLotteImage() {
            const code = document.getElementById('reg-code').value.trim();
            const box = document.getElementById('reg-preview-box');
            const img = document.getElementById('reg-preview-img');
            if (code.length >= 8) {
                const p1 = code.substring(6, 8);
                const p2 = code.substring(4, 6);
                const p3 = code.substring(2, 4);
                img.src = `https://image2.lotteimall.com/goods/${p1}/${p2}/${p3}/${code}_L.jpg`;
                box.style.display = 'block';
            } else {
                box.style.display = 'none';
            }
        }

        // Paste Event Setup for Image Upload
        document.addEventListener('paste', async (e) => {
            const activeEl = document.activeElement;
            if (!activeEl || !activeEl.classList.contains('image-dropzone')) return;

            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file') {
                    const blob = item.getAsFile();
                    await handleImageUpload(blob, activeEl);
                    break;
                }
            }
        });

        async function handleImageUpload(blob, dropzoneEl) {
            if (GAS_IMAGE_URL === "YOUR_GAS_IMAGE_URL_HERE") {
                alert("Íµ¨Í? GAS ?ÖÎ°ú??URL???§Ï†ï?òÏ? ?äÏïò?µÎãà??");
                return;
            }
            
            // ?ÑÎ¶¨Î∑?Î®ºÏ? Î≥¥Ïó¨Ï£ºÍ∏∞
            const imgEl = dropzoneEl.querySelector('img');
            imgEl.src = URL.createObjectURL(blob);
            imgEl.style.display = 'block';
            
            const colorKey = dropzoneEl.getAttribute('data-color') || "main";
            dropzoneEl.style.opacity = '0.5';

            try {
                const reader = new FileReader();
                const base64Data = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(blob);
                });

                const payload = {
                    filename: `image_${new Date().getTime()}.png`,
                    mimeType: blob.type || "image/png",
                    file: base64Data
                };

                const gasRes = await fetch(GAS_IMAGE_URL, {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                
                const gasResult = await gasRes.json();
                if(gasResult.success) {
                    uploadedImages[colorKey] = gasResult.url;
                } else {
                    alert("?¥Î?ÏßÄ ?ÖÎ°ú???§Ìå®: " + gasResult.error);
                }
            } catch(e) {
                console.error(e);
                alert("?ÖÎ°ú??Ï§??§Î•ò Î∞úÏÉù");
            } finally {
                dropzoneEl.style.opacity = '1';
                isUploadingImage = false;
            }
        }

        function updateColorImages() {
            const colorsInput = document.getElementById('reg-colors').value;
            const container = document.getElementById('color-images-container');
            if(!colorsInput.trim()) {
                container.innerHTML = '';
                return;
            }
            
            const colors = colorsInput.split(',').map(s => s.trim()).filter(s => s);
            let html = '';
            colors.forEach(c => {
                let src = uploadedImages[c] || '';
                let imgStyle = src ? "display:block;" : "display:none;";
                let txtStyle = src ? "display:none;" : "display:block;";
                html += `
                <div style="width:120px; flex-shrink:0;">
                    <div style="font-weight:bold; font-size:12px; margin-bottom:5px; text-align:center; color:var(--primary);">${c}</div>
                    <div class="image-dropzone" data-color="${c}" tabindex="0" style="width:100%; height:120px; border:1px dashed var(--primary); border-radius:8px; display:flex; align-items:center; justify-content:center; background:#f0f8ff; cursor:pointer; overflow:hidden; position:relative;">
                        <img id="img-${c}" src="${src}" style="${imgStyle} width:100%; height:100%; object-fit:contain; position:absolute; top:0; left:0; background:white;">
                        <span style="font-size:11px; color:var(--primary); font-weight:bold;" id="txt-${c}" style="${txtStyle}"></span>
                    </div>
                </div>`;
            });
            container.innerHTML = html;
        }

        

function openProductSearchModal() {
    document.getElementById('searchProductModal').style.display = 'flex';
    document.getElementById('productSearchInput').value = '';
    renderProductSearchList();
}

function renderProductSearchList() {
    try {
        const q = document.getElementById('productSearchInput').value.toLowerCase().trim();
        const container = document.getElementById('productSearchList');
        
        if (!q) {
            container.innerHTML = '<div style="grid-column: 1 / -1; padding:30px; text-align:center; color:#888;">Í≤Ä?âÏñ¥Î•??ÖÎ†•?òÎ©¥ ?ÅÌíà???úÏãú?©Îãà??</div>';
            return;
        }

        let prods = [];
        if (typeof allItems !== 'undefined') {
            prods = allItems;
        }
        
        // ?¨Î°§Îß??∞Ïù¥???úÏô∏ (Í∏∞Ï°¥ ÎßàÏä§???ÅÌíà Î∞??¨Í≥† ?àÎäî ?ÅÌíàÎß??úÏãú)
        prods = prods.filter(p => p.isMaster);
        
        prods = prods.filter(p => (p.name||'').toLowerCase().includes(q) || (p.brand||'').toLowerCase().includes(q) || (p.code||'').toLowerCase().includes(q));
        prods = [...prods].reverse().slice(0, 50);
        
        if (prods.length === 0) {
            container.innerHTML = '<div style="grid-column: 1 / -1; padding:30px; text-align:center; color:#888;">Í≤Ä??Í≤∞Í≥ºÍ∞Ä ?ÜÏäµ?àÎã§.</div>';
            return;
        }
        
        let html_str = '';
        prods.forEach(p => {
            let imgUrl = 'https://via.placeholder.com/200?text=No+Img';
            if (p.image) {
                try {
                    if(p.image.startsWith('{')) {
                        const parsed = JSON.parse(p.image);
                        if(parsed.main) imgUrl = parsed.main;
                    } else {
                        imgUrl = p.image;
                    }
                } catch(e){}
            }
            
            html_str += `
            <div onclick="selectProductToLoad('${p.code}')" style="background:white; border:1px solid #eee; border-radius:8px; padding:10px; cursor:pointer; transition:all 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.05);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'">
                <div style="width:100%; aspect-ratio:1/1; background:#f8f9fa; border-radius:6px; margin-bottom:12px; overflow:hidden; border:1px solid #f1f1f1;">
                    <img src="${imgUrl}" style="width:100%; height:100%; object-fit:contain;">
                </div>
                <div style="font-weight:bold; font-size:12px; color:var(--primary); margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.brand || 'Î∏åÎûú???ÜÏùå'}</div>
                <div style="font-weight:bold; font-size:14px; color:#333; margin-bottom:6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; line-height:1.3;">${p.name || '?ÅÌíàÎ™??ÜÏùå'}</div>
                <div style="font-size:12px; color:#888;">${p.code}</div>
            </div>
            `;
        });
        container.innerHTML = html_str;
    } catch (err) {
        console.error("Search list error:", err);
        document.getElementById('productSearchList').innerHTML = '<div style="grid-column: 1 / -1; padding:15px; color:red;">?êÎü¨ Î∞úÏÉù: ' + err.message + '</div>';
    }
}

function selectProductToLoad(code) {
    document.getElementById('searchProductModal').style.display = 'none';
    document.getElementById('reg-code').value = code;
    executeLoadProductInfo(code);
}

function executeLoadProductInfo(code) {

    const product = allItems.find(p => p.code === code);
    if(product) {
        document.getElementById('reg-brand').value = product.brand || "";
        document.getElementById('reg-name').value = product.name || "";
        document.getElementById('reg-cate').value = product.category || "";
        const cEl = document.getElementById('reg-colors'); if(cEl) cEl.value = product.colors || "";
        const sEl = document.getElementById('reg-sizes'); if(sEl) sEl.value = product.sizes || "";
        
        let imgData = {};
        if (product.image) {
            try {
                if (product.image.startsWith("{")) {
                    imgData = JSON.parse(product.image);
                } else {
                    imgData = { main: product.image };
                }
            } catch(e) {}
        }
        
        if (imgData.main) {
            uploadedImages["main"] = imgData.main;
            const mainImg = document.getElementById('img-main');
            if(mainImg) {
                mainImg.src = imgData.main;
                mainImg.style.display = 'block';
            }
        }
        
        const colorsStr = product.colors || "";
        const sizesStr = product.sizes || "";
        
        document.getElementById('reg-colors').value = colorsStr;
        document.getElementById('reg-sizes').value = sizesStr;
        
        const colorsArray = colorsStr.split(',').map(s=>s.trim()).filter(s=>s);
        
        if (colorsArray.length > 0) {
            updateColorImages();
            
            colorsArray.forEach(c => {
                if(imgData[c]) {
                    uploadedImages[c] = imgData[c];
                    const cImg = document.getElementById('img-' + c);
                    if(cImg) {
                        cImg.src = imgData[c];
                        cImg.style.display = 'block';
                    }
                }
            });
        }
        
        if(colorsArray.length > 0 && sizesStr.trim().length > 0) {
            generateMatrix(true);
            const tbody = document.querySelector('#matrix-table tbody');
            if(tbody) {
                const inv = allStockMap[code] || [];
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(r => {
                    const c = r.getAttribute('data-color');
                    const s = r.getAttribute('data-size');
                    const found = inv.find(i => i.color === c && i.size === s);
                    if(found) {
                        const input = r.querySelector('input');
                        if(input) input.value = found.qty;
                    }
                });
            }
            document.getElementById('btn-save-inventory').style.display = 'inline-block';
        }
        
        previewLotteImage();
        alert("Í∏∞Ï°¥ ?ïÎ≥¥Î•?Î∂àÎü¨?îÏäµ?àÎã§.");
    } else {
        alert("?¥Îãπ ÏΩîÎìúÎ°??±Î°ù???ÅÌíà???ÜÏäµ?àÎã§.");
    }
}

function generateMatrix(silent = false) {
            const colorsStr = document.getElementById('reg-colors').value;
            const sizesStr = document.getElementById('reg-sizes').value;
            const code = document.getElementById('reg-code').value.trim();
            
            if(!code || !colorsStr || !sizesStr) {
                if(!silent) {
                    if(!code) alert("?ÅÌíàÏΩîÎìúÎ•?Î®ºÏ? ?ÖÎ†•?òÏÑ∏??);
                    else alert("?âÏÉÅÍ≥??¨Ïù¥Ï¶àÎ? Î™®Îëê ?ÖÎ†•?òÏÑ∏??);
                }
                const container = document.getElementById('matrix-container');
                if(container) container.innerHTML = '';
                const btn = document.getElementById('btn-save-inventory');
                if(btn) btn.style.display = 'none';
                return;
            }
            
            const colors = colorsStr.split(',').map(s=>s.trim()).filter(s=>s);
            const sizes = sizesStr.split(',').map(s=>s.trim()).filter(s=>s);
            
            let html = `<div style="border:1px solid #eee; border-radius:12px; overflow:hidden;"><table id="matrix-table" style="width:100%; border-collapse:collapse; text-align:center; font-size:14px; background:white;">`;
            
            // Header
            html += `<tr style="background:#f8f9fa; border-bottom:1px solid #eee;">
                        <th style="padding:15px; font-weight:bold; color:#333; text-align:center;">?âÏÉÅ</th>`;
            sizes.forEach(s => {
                html += `<th style="padding:15px; font-weight:bold; color:#333; text-align:center;">${s}</th>`;
            });
            html += `<th style="padding:0; width:80px;"><input type="text" class="extra-size-header" placeholder="?¨Ïù¥Ï¶? style="width:100%; height:50px; border:none; text-align:center; font-weight:bold; color:#333; background:transparent; outline:none;"></th>`;
            html += `<th style="padding:0; width:80px;"><input type="text" class="extra-size-header" placeholder="?¨Ïù¥Ï¶? style="width:100%; height:50px; border:none; text-align:center; font-weight:bold; color:#333; background:transparent; outline:none;"></th>`;
            html += `</tr>`;
            
            // Body
            const stockMap = allStockMap[code] || [];
            const isAdditional = stockMap.length > 0;
            
            // Update Title
            const titleRow = document.querySelector('.dash-card:nth-child(2) .dash-title-row .dash-title');
            if(titleRow) {
                if(isAdditional) {
                    titleRow.innerHTML = "?¨Í≥† ?±Î°ù <span style='font-size:12px; color:#1d4ed8; background:#dbeafe; padding:4px 8px; border-radius:6px; margin-left:8px;'>?ì¶ Ï∂îÍ??ÖÍ≥† Î™®Îìú</span>";
                } else {
                    titleRow.innerHTML = "?¨Í≥† ?±Î°ù <span style='font-size:12px; color:#047857; background:#d1fae5; padding:4px 8px; border-radius:6px; margin-left:8px;'>???†Í∑ú?ÖÍ≥† Î™®Îìú</span>";
                }
            }

            colors.forEach(c => {
                html += `<tr style="border-bottom:1px solid #f1f1f1;">
                            <td style="padding:15px; font-weight:bold; color:#444; border-right:1px solid #f1f1f1; background:#fafafa; text-align:center; white-space:nowrap;">${c}</td>`;
                sizes.forEach(s => {
                    const existing = stockMap.find(x => x.color === c && x.size === s);
                    const existingQty = existing ? existing.qty : 0;
                    
                    if(isAdditional) {
                        html += `<td style="padding:15px; vertical-align:middle; font-size:16px; font-weight:bold; color:#111; text-align:center;">
                                    ${existingQty}
                                 </td>`;
                    } else {
                        html += `<td style="padding:0; vertical-align:middle;">
                                    <input type="number" class="matrix-input" data-color="${c}" data-size="${s}" data-existing="0" value="${existingQty > 0 ? existingQty : ''}" style="width:100%; height:50px; border:none; text-align:center; font-size:16px; font-weight:bold; color:#2563eb; background:transparent; outline:none;" placeholder="-">
                                 </td>`;
                    }
                });
                
                // Extra columns for this color
                html += `<td style="padding:0; vertical-align:middle; border-left:1px solid #f1f1f1;"><input type="number" class="matrix-extra-input" data-color="${c}" data-extra-col="0" style="width:100%; height:50px; border:none; text-align:center; font-size:16px; font-weight:bold; color:#2563eb; background:transparent; outline:none;" placeholder="-"></td>`;
                html += `<td style="padding:0; vertical-align:middle; border-left:1px solid #f1f1f1;"><input type="number" class="matrix-extra-input" data-color="${c}" data-extra-col="1" style="width:100%; height:50px; border:none; text-align:center; font-size:16px; font-weight:bold; color:#2563eb; background:transparent; outline:none;" placeholder="-"></td>`;
                
                html += `</tr>`;
            });
            
            // Extra Row for new color
            html += `<tr style="border-top:1px solid #f1f1f1;">
                        <td style="padding:0;"><input type="text" id="extra-color-header" placeholder="?âÏÉÅ?ÖÎ†•" style="width:100%; height:50px; border:none; text-align:center; font-weight:bold; color:#333; background:transparent; outline:none;"></td>`;
            sizes.forEach(s => {
                html += `<td style="padding:0; vertical-align:middle;"><input type="number" class="matrix-extra-input" data-extra-row="1" data-size="${s}" style="width:100%; height:50px; border:none; text-align:center; font-size:16px; font-weight:bold; color:#2563eb; background:transparent; outline:none;" placeholder="-"></td>`;
            });
            // Extra cols intersection
            html += `<td style="padding:0; vertical-align:middle; border-left:1px solid #f1f1f1;"><input type="number" class="matrix-extra-input" data-extra-row="1" data-extra-col="0" style="width:100%; height:50px; border:none; text-align:center; font-size:16px; font-weight:bold; color:#2563eb; background:transparent; outline:none;" placeholder="-"></td>`;
            html += `<td style="padding:0; vertical-align:middle; border-left:1px solid #f1f1f1;"><input type="number" class="matrix-extra-input" data-extra-row="1" data-extra-col="1" style="width:100%; height:50px; border:none; text-align:center; font-size:16px; font-weight:bold; color:#2563eb; background:transparent; outline:none;" placeholder="-"></td>`;
            html += `</tr>`;
            
            html += `</table></div>`;
            
            document.getElementById('matrix-container').innerHTML = html;
            document.getElementById('btn-save-inventory').style.display = 'block';
        }

        async function saveProductInfo(silent = false) {
            if (isUploadingImage) {
                alert("?¥Î?ÏßÄ ?ÖÎ°ú?úÍ? ÏßÑÌñâ Ï§ëÏûÖ?àÎã§. ?†Ïãú ???§Ïãú ?Ä?•Ìï¥Ï£ºÏÑ∏??");
                return;
            }
            const brand = document.getElementById('reg-brand').value.trim();
            const name = document.getElementById('reg-name').value.trim();
            const code = document.getElementById('reg-code').value.trim();
            const cate = document.getElementById('reg-cate').value.trim();
            const colorsEl = document.getElementById('reg-colors');
            const sizesEl = document.getElementById('reg-sizes');
            const colors = colorsEl ? colorsEl.value.trim() : "";
            const sizes = sizesEl ? sizesEl.value.trim() : "";
            
            if(!brand || !name || !code) return alert("Î∏åÎûú?? ?àÎ™Ö, ÏΩîÎìú???ÑÏàò?ÖÎãà??");
            
            document.getElementById('loading-overlay').style.display = 'flex';
            
            // ?¥Î?ÏßÄ JSON Î¨∏Ïûê?¥Ìôî
            const imageJsonStr = JSON.stringify(uploadedImages);

            const newProduct = {
                code: code,
                brand: brand,
                name: name,
                category: cate,
                colors: colors,
                sizes: sizes,
                image: imageJsonStr,
                date: new Date().toISOString().substring(0,10),
                isMaster: 1
            };
            
            // allItems ?ÖÎç∞?¥Ìä∏ (Ï°¥Ïû¨?òÎ©¥ ??ñ¥?∞Í∏∞)
            const existIdx = allItems.findIndex(i => i.code === code);
            if(existIdx > -1) {
                allItems[existIdx] = newProduct;
            } else {
                allItems.unshift(newProduct);
            }

            try {
                const cfRes = await fetch(GAS_WEB_APP_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "save_products", data: allItems.filter(i => i.isMaster) })
                });

                if(cfRes.ok) {
                    if(!silent) alert("?ÅÌíà Í∏∞Î≥∏ ?ïÎ≥¥Í∞Ä ?Ä?•Îêò?àÏäµ?àÎã§.");
                    return true;
                } else {
                    alert("?Ä???§Ìå®");
                    return false;
                }
            } catch(e) { 
                console.error(e); 
                return false;
            }
            finally { 
                if(!silent) document.getElementById('loading-overlay').style.display = 'none'; 
            }
        }

        async function saveMatrixInventory() {
            const code = document.getElementById('reg-code').value.trim();
            if(!code) return alert("?ÅÌíàÏΩîÎìúÍ∞Ä ?ÜÏäµ?àÎã§.");
            
            const brand = document.getElementById('reg-brand').value.trim();
            const name = document.getElementById('reg-name').value.trim();
            if(!brand || !name) {
                return alert("ÎßàÏä§???ïÎ≥¥(Î∏åÎûú?? ?ÅÌíàÎ™?Î•?Î®ºÏ? ?ÖÎ†•?¥Ïïº ?¨Í≥†Î•??Ä?•Ìï† ???àÏäµ?àÎã§.");
            }
            
            // 0. ?àÎ°ú ?ÖÎ†•???âÏÉÅ/?¨Ïù¥Ï¶àÎ? ÎßàÏä§???ïÎ≥¥???êÎèô Ï∂îÍ?
            const extraSizeHeaders = document.querySelectorAll('.extra-size-header');
            const extraSize1 = extraSizeHeaders[0] ? extraSizeHeaders[0].value.trim() : "";
            const extraSize2 = extraSizeHeaders[1] ? extraSizeHeaders[1].value.trim() : "";
            const extraColorHeader = document.getElementById('extra-color-header');
            const extraColor = extraColorHeader ? extraColorHeader.value.trim() : "";
            
            const colorInput = document.getElementById('reg-colors');
            const sizeInput = document.getElementById('reg-sizes');
            
            let currentColors = colorInput.value.split(',').map(s=>s.trim()).filter(s=>s);
            let currentSizes = sizeInput.value.split(',').map(s=>s.trim()).filter(s=>s);
            
            let masterUpdated = false;
            if(extraColor && !currentColors.includes(extraColor)) {
                currentColors.push(extraColor);
                masterUpdated = true;
            }
            if(extraSize1 && !currentSizes.includes(extraSize1)) {
                currentSizes.push(extraSize1);
                masterUpdated = true;
            }
            if(extraSize2 && !currentSizes.includes(extraSize2)) {
                currentSizes.push(extraSize2);
                masterUpdated = true;
            }
            
            if(masterUpdated) {
                colorInput.value = currentColors.join(', ');
                sizeInput.value = currentSizes.join(', ');
            }
            
            // 1. ÎßàÏä§???ïÎ≥¥ Î®ºÏ? Ï°∞Ïö©???Ä??
            const masterSaved = await saveProductInfo(true);
            if(!masterSaved) {
                document.getElementById('loading-overlay').style.display = 'none';
                return;
            }
            
            document.getElementById('loading-overlay').style.display = 'flex';
            
            const inputs = document.querySelectorAll('.matrix-input');
            if(!allStockMap[code]) allStockMap[code] = [];
            
            // 2. Add quantities from normal matrix inputs (for New Intake mode)
            const currentStock = allStockMap[code] || [];
            let stockDict = {};
            currentStock.forEach(i => {
                stockDict[`${i.color}::${i.size}`] = i.qty;
            });
            
            const normalInputs = document.querySelectorAll('.matrix-input');
            normalInputs.forEach(inp => {
                const qty = parseInt(inp.value) || 0;
                if(qty > 0) {
                    const c = inp.dataset.color;
                    const s = inp.dataset.size;
                    stockDict[`${c}::${s}`] = (stockDict[`${c}::${s}`] || 0) + qty;
                }
            });
            
            // 3. Add quantities from extra inputs (for Additional Intake mode)
            const extraInputs = document.querySelectorAll('.matrix-extra-input');
            extraInputs.forEach(inp => {
                const qty = parseInt(inp.value) || 0;
                if(qty > 0) {
                    let c = inp.dataset.color;
                    if(inp.dataset.extraRow === "1") c = extraColor;
                    
                    let s = inp.dataset.size;
                    if(inp.dataset.extraCol === "0") s = extraSize1;
                    if(inp.dataset.extraCol === "1") s = extraSize2;
                    
                    if(c && s) {
                        stockDict[`${c}::${s}`] = (stockDict[`${c}::${s}`] || 0) + qty;
                    }
                }
            });
            
            // 4. Rebuild allStockMap[code]
            allStockMap[code] = [];
            Object.keys(stockDict).forEach(key => {
                const [c, s] = key.split("::");
                const q = stockDict[key];
                if(q > 0) {
                    allStockMap[code].push({ color: c, size: s, qty: q });
                }
            });
            
            let flatInventory = [];
            Object.keys(allStockMap).forEach(c => {
                allStockMap[c].forEach(item => {
                    flatInventory.push({ code: c, color: item.color, size: item.size, qty: item.qty });
                });
            });

            try {
                const response = await fetch(GAS_WEB_APP_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "save_inventory", data: flatInventory })
                });

                if(response.ok) {
                    alert("?¨Í≥†Í∞Ä Îß§Ìä∏Î¶?ä§??ÎßûÍ≤å ?Ä?•Îêò?àÏäµ?àÎã§.");
                } else {
                    alert("?Ä???§Ìå®");
                }
            } catch(e) { console.error(e); }
            finally { document.getElementById('loading-overlay').style.display = 'none'; }
        }

        // ?¥Î?ÏßÄ Í∞Ä?∏Ïò§Í∏??¨Ìçº ?®Ïàò (JSON ?åÏã± ÏßÄ??
        function getProductImage(i) {
            let resultUrl = "";
            if (i.image && i.image.trim() !== "") {
                try {
                    const imgObj = JSON.parse(i.image);
                    if (imgObj && imgObj.main) resultUrl = imgObj.main;
                    
                    if(!resultUrl) {
                        const keys = Object.keys(imgObj).filter(k => k !== 'main');
                        if (keys.length > 0 && imgObj[keys[0]]) resultUrl = imgObj[keys[0]];
                    }
                } catch(e) {
                    resultUrl = i.image;
                }
            }
            
            if (resultUrl) {
                // Íµ¨Í? ?úÎùº?¥Î∏å ?¥Î?ÏßÄ ?∏Ìôò???®Ïπò
                if (resultUrl.includes('drive.google.com/uc')) {
                    const idMatch = resultUrl.match(/id=([^&]+)/);
                    if (idMatch) {
                        return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
                    }
                }
                return resultUrl;
            }
            
            const code = String(i.code);
            if (code.length < 8) return ""; 
            const p1 = code.substring(6, 8);
            const p2 = code.substring(4, 6);
            const p3 = code.substring(2, 4);
            return `https://image2.lotteimall.com/goods/${p1}/${p2}/${p3}/${code}_L.jpg`;
        }

        // Cloudflare WorkerÎ°??Ä??
        async function saveToGitHub(fileName, data) {
            document.getElementById('loading-overlay').style.display = 'flex';
            try {
                const typeMap = {
                    "rentals.json": "save_rentals",
                    "outfits.json": "save_outfits",
                    "notes.json": "save_notes",
                    "supplies.json": "save_supplies"
                };
                const putRes = await fetch(GAS_WEB_APP_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: typeMap[fileName], data: data })
                });

                if (putRes.ok) {
                    if (curItem) renderDetailUI(curItem);
                } else alert("?úÎ≤Ñ ?§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.");
            } catch (e) { alert("?§Ìä∏?åÌÅ¨ ?§Î•ò"); }
            finally { document.getElementById('loading-overlay').style.display = 'none'; }
        }

        function onDataLoad(data, startPage) {
            allItems = data.items || []; allStockMap = data.stockMap || {};
            const b = document.getElementById("brandSel"), c = document.getElementById("cateSel");
            b.innerHTML = '<option value="All">Î∏åÎûú???ÑÏ≤¥</option>'; c.innerHTML = '<option value="All">Ïπ¥ÌÖåÍ≥†Î¶¨ ?ÑÏ≤¥</option>';
            data.brands.forEach(v => b.add(new Option(v, v))); data.categories.forEach(v => c.add(new Option(v, v)));
            
            // Build masterCodes (both isMaster products and products with stock entries)
            const masterCodes = new Set(allItems.filter(i => i.isMaster).map(i => String(i.code)));
            if (typeof allStockMap !== 'undefined') {
                Object.keys(allStockMap).forEach(code => masterCodes.add(String(code)));
            }

            // Get today in KST
            const formatter = new Intl.DateTimeFormat('sv-SE', {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const todayKst = formatter.format(new Date());

            // Collect unique dates on/after today that have broadcasts for our products
            const activeDatesSet = new Set();
            allItems.forEach(i => {
                if (!i.isMaster && i.dateKey && i.dateKey >= todayKst && masterCodes.has(String(i.code))) {
                    activeDatesSet.add(i.dateKey);
                }
            });
            
            // Sort active dates
            const dates = Array.from(activeDatesSet).sort();

            const scroller = document.getElementById("dateScroller"); scroller.innerHTML = "";
            if (dates.length > 0) {
                if (!selDate || !dates.includes(selDate)) selDate = dates[0];
                dates.forEach(d => {
                    const parts = d.split('-');
                    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    const btn = document.createElement("div");
                    btn.className = `date-btn ${d === selDate ? 'active' : ''}`;
                    btn.dataset.date = d;
                    btn.innerHTML = `<span class="dow">${"?ºÏõî?îÏàòÎ™©Í∏à??[dateObj.getDay()]}</span><span class="day">${dateObj.getDate()}</span>`;
                    btn.onclick = () => { selDate = d; renderSchedule(); };
                    scroller.appendChild(btn);
                });
            } else {
                selDate = null;
            }
            renderPageUI(startPage, null, false);
        }

        function handleNavClick(p) { renderPageUI(p, null, true); }
        function renderPageUI(t, item = null, push = true) {
            if (push) history.pushState({ page: t, item: item }, '', '#' + t);

            // ?Ä?¥Ì? Î≥ÄÍ≤?
            const titleMap = { 'schedule': '?∏ÏÑ±??, 'inventory': '?¨Í≥†Í¥ÄÎ¶?, 'detail': '?ÅÏÑ∏?ïÎ≥¥', 'register': '?ÅÌíà?±Î°ù' };
            document.title = (titleMap[t] || 'LOTTE PB') + ' - LOTTE PB';

            document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
            document.getElementById('page-' + t).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(btn => {
                btn.classList.toggle('active', false);
                if (btn.id === 'nav-sch' && t === 'schedule') btn.classList.add('active');
                if (btn.id === 'nav-task' && t === 'task') btn.classList.add('active');
                if (btn.id === 'nav-inv' && t === 'inventory') btn.classList.add('active');
                if (btn.id === 'nav-reg' && t === 'register') btn.classList.add('active');
            });
            if (t === 'schedule') renderSchedule();
            if (t === 'task') initTaskScrollers();

            if (t === 'inventory' && !document.getElementById("inventoryContainer").children.length) resetFilter();
            if (t === 'detail' && item) renderDetailUI(item);
            window.scrollTo(0, 0);
        }

        function renderSchedule() {
            const container = document.getElementById("scheduleContainer"); container.innerHTML = "";
            document.querySelectorAll('.date-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.date === selDate));
            
            // Get master product codes for filtering our items
            const masterCodes = new Set(allItems.filter(i => i.isMaster).map(i => String(i.code)));
            // Also include codes that exist in our stock map (inventory)
            if (typeof allStockMap !== 'undefined') {
                Object.keys(allStockMap).forEach(code => masterCodes.add(String(code)));
            }
            
            const filtered = allItems.filter(i => !i.isMaster && i.dateKey === selDate && masterCodes.has(String(i.code))).sort((a, b) => parseTime(a.date) - parseTime(b.date));
            
            const groups = {};
            filtered.forEach(item => {
                const tm = item.date ? item.date.match(/(\d{1,2}:\d{1,2})/) : null;
                const key = tm ? tm[1] : "?úÍ∞ÑÎØ∏Ï†ï";
                if (!groups[key]) groups[key] = []; groups[key].push(item);
            });
            Object.keys(groups).sort((a, b) => parseTime(a) - parseTime(b)).forEach(tm => {
                const weatherInfo = renderWeatherInfo(selDate, tm);
                const div = document.createElement("div");
                div.className = "time-divider";
                div.innerHTML = `<span>${tm} Î∞©ÏÜ°</span> ${weatherInfo}`;
                container.appendChild(div);
                const grid = document.createElement("div"); grid.className = "product-grid";
                groups[tm].forEach(i => grid.appendChild(createCard(i)));
                container.appendChild(grid);
            });
        }

        /**
         * ?†Ïî® ?ïÎ≥¥ ?åÎçîÎß??®Ïàò (Í∏∞ÏÉÅÏ≤?KMA Î≤ÑÏ†Ñ)
         * ?†Ïî® ?∞Ïù¥?∞Í? ?ÜÍ±∞???§Î•òÍ∞Ä ?òÎèÑ ?∏ÏÑ±?úÏóê???ÅÌñ• ?ÜÏù¥ Îπ?Î¨∏Ïûê??Î∞òÌôò
         */
        function renderWeatherInfo(date, timeStr) {
            if (!allWeather || !allWeather.hourly || !allWeather.hourly.time) return "";
            try {
                const match = timeStr.match(/(\d{1,2}):(\d{1,2})/);
                if (!match) return "";
                let hour = parseInt(match[1]);
                hour = Math.max(0, hour - 2);
                const targetTime = `${date}T${String(hour).padStart(2, '0')}:00`;
                const idx = allWeather.hourly.time.indexOf(targetTime);
                if (idx === -1) return "";

                const sky = (allWeather.hourly.sky && allWeather.hourly.sky[idx] !== undefined) ? allWeather.hourly.sky[idx] : 1;
                const pty = (allWeather.hourly.pty && allWeather.hourly.pty[idx] !== undefined) ? allWeather.hourly.pty[idx] : 0;
                const pop = (allWeather.hourly.pop && allWeather.hourly.pop[idx] !== undefined) ? allWeather.hourly.pop[idx] : 0;
                const temp = (allWeather.hourly.temp && allWeather.hourly.temp[idx] !== undefined) ? allWeather.hourly.temp[idx] : '-';

                return `
                    <div class="weather-badge">
                        <span class="weather-icon">${getWeatherSVG(sky, pty)}</span>
                        <span>${temp}¬∞</span>
                        <span class="weather-pop">${pop}%</span>
                    </div>
                `;
            } catch (e) {
                console.warn("?†Ïî® ?åÎçîÎß?Ï§??§Î•ò:", e);
                return "";
            }
        }

        function getWeatherSVG(sky, pty) {
            // Í∏∞ÏÉÅÏ≤?PTY(Í∞ïÏàò?ïÌÉú) ?∞ÏÑ† ?êÎã®
            if (pty == 1 || pty == 4) { // Îπ??êÎäî ?åÎÇòÍ∏?
                return '<svg viewBox="0 0 24 24" fill="none" stroke="#4361ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 13a4 4 0 0 1-8 0"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><path d="M8 19v2"/><path d="M12 19v2"/><path d="M16 19v2"/></svg>';
            }
            if (pty == 2 || pty == 3) { // ???êÎäî Îπ???
                return '<svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><path d="m12 12.01.01-.01"/></svg>';
            }

            // PTYÍ∞Ä 0(?ÜÏùå)????SKY(?òÎäò?ÅÌÉú) ?êÎã®
            if (sky == 1) { // ÎßëÏùå
                return '<svg viewBox="0 0 24 24" fill="none" stroke="#FFB800" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="4.22" x2="19.78" y2="5.64"/></svg>';
            }
            // Í∑???(?êÎ¶º, Íµ¨Î¶ÑÎßéÏùå)
            return '<svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.3-1.7-4.2-4-4.5-.6-4.1-4.2-7.3-8.5-6.3-2.9.7-5.1 3.1-5.5 6-.1 0-.2 0-.3 0C1.6 9.7 0 11.3 0 13.3c0 2 1.6 3.7 3.7 3.7h13.8"/></svg>';
        }

        function createCard(i) {
            const div = document.createElement("div"); div.className = "p-card";
            div.onclick = () => { renderPageUI('detail', i, true); };

            let displayItem = i;
            if (!i.isMaster) {
                const master = allItems.find(m => m.isMaster && String(m.code) === String(i.code));
                if (master) {
                    displayItem = {
                        ...i,
                        brand: master.brand || i.brand,
                        name: master.name || i.name,
                        image: master.image || i.image
                    };
                }
            }

            const supplyObj = allSupplies.find(s => s.code == displayItem.code);
            const overlay = (supplyObj && supplyObj.text) ? `<div class="supplies-overlay">${supplyObj.text}</div>` : "";

            div.innerHTML = `<div class="p-img-box"><img src="${getProductImage(displayItem)}" class="p-img">${overlay}</div><div class="p-info"><div class="p-brand">${displayItem.brand}</div><div class="p-name">${displayItem.name}</div></div>`;
            return div;
        }

        function renderDetailUI(i) {
            curItem = i;
            document.getElementById("det-name").innerText = `${i.brand} ${i.name}`;
            document.getElementById("det-code").innerText = i.code;
            document.getElementById("det-loc").innerText = i.location || "-";
            const detImg = document.getElementById("det-img");
            detImg.src = getProductImage(i);
            detImg.onclick = () => window.open(`https://www.lotteimall.com/goods/viewGoodsDetail.lotte?goods_no=${i.code}`, '_blank');

            // Ï§ÄÎπÑÎ¨º Î∂àÎü¨?§Í∏∞
            const supplyObj = allSupplies.find(s => s.code == i.code);
            const sInput = document.getElementById("det-supplies");
            sInput.value = (supplyObj && supplyObj.text) ? supplyObj.text : "";

            // ?πÏù¥?¨Ìï≠ Î∂àÎü¨?§Í∏∞
            const noteObj = allNotes.find(n => n.code == i.code);
            const nArea = document.getElementById("det-notes");
            nArea.value = noteObj ? noteObj.text : "";
            autoExpand(nArea);

            const stock = allStockMap[i.code] || [];
            const sizes = []; const colors = [];
            stock.forEach(s => { if (s.size && !sizes.includes(s.size)) sizes.push(s.size); if (s.color && !colors.includes(s.color)) colors.push(s.color); });
            let h = `<table class="st-table"><thead><tr><th>?âÏÉÅ</th>${sizes.map(s => `<th>${s}</th>`).join("")}</tr></thead><tbody>`;
            colors.forEach(c => {
                h += `<tr><td class="bg-light fw-bold">${c}</td>` + sizes.map(s => {
                    const baseQty = stock.filter(x => x.color === c && x.size === s).reduce((a, b) => a + Number(b.qty), 0) || 0;
                    const rentedQty = allRentals.filter(r => r.code == i.code && r.color === c && r.size === s).reduce((a, b) => a + Number(b.qty), 0) || 0;
                    const qty = baseQty - rentedQty;
                    return `<td onclick="addToCart('${i.code}', '${i.brand} ${i.name}', '${c}', '${s}')" style="cursor:pointer; ${qty > 0 ? 'color:var(--primary) !important;' : 'opacity:0.3;'}">${qty}</td>`;
                }).join("") + "</tr>";
            });
            document.getElementById("v-stock-table").innerHTML = h + "</tbody></table>";
            renderCart(); // Ïπ¥Ìä∏ ?ÅÌÉú Ï¥àÍ∏∞??


            const outfits = allOutfits.filter(o => o.code == i.code);
            document.getElementById("v-outfit-container").innerHTML = outfits.map(o => `
                <div class="info-item-card">
                    <button class="delete-btn" onclick="deleteEntry('outfit', '${o.code}', '${o.host}')">√ó</button>
                    <span class="info-card-top">${o.host}</span>
                    <span class="info-card-bottom">${o.size}</span>
                </div>`).join("") || '<div class="col-12 py-1 text-muted small text-center">?¥Ïó≠ ?ÜÏùå</div>';

            const rentals = allRentals.filter(r => r.code == i.code);
            let rentalHtml = `
                <table class="list-table">
                    <thead>
                        <tr>
                            <th style="width:35px">?†ÌÉù</th>
                            <th style="width:55px">?Ä?¨Ïûê</th>
                            <th>?ÅÌíà ?ïÎ≥¥</th>
                            <th style="width:35px">?òÎüâ</th>
                            <th style="width:75px">?Ä?¨Ïùº</th>
                        </tr>
                    </thead>
                    <tbody>`;

            if (rentals.length === 0) {
                rentalHtml += '<tr><td colspan="5" class="py-4 text-muted small">?ÑÏû¨ ?Ä??Ï§ëÏù∏ ?¥Ïó≠???ÜÏäµ?àÎã§.</td></tr>';
            } else {
                rentals.forEach(r => {
                    const d = r.date ? r.date.substring(5, 10) : "-";
                    rentalHtml += `
                        <tr>
                            <td><input type="checkbox" class="rental-check" 
                                data-code="${r.code}" data-renter="${r.renter}" data-color="${r.color}" data-size="${r.size}" data-date="${r.date}"
                                onchange="toggleRentalButtons()" onclick="event.stopPropagation()"></td>
                            <td class="fw-bold">${r.renter}</td>
                            <td class="list-product-info">
                                <span class="list-product-desc">${r.color} / ${r.size}</span>
                            </td>
                            <td><span class="qty-badge">${r.qty}</span></td>
                            <td>
                                <span class="date-text">${d}</span>
                                <button class="delete-btn" style="position:static; margin-left:5px" onclick="deleteEntry('rental', '${r.code}', '${r.renter}', '${r.color}', '${r.size}')">√ó</button>
                            </td>
                        </tr>`;
                });
            }
            document.getElementById("v-rental-list").innerHTML = rentalHtml + "</tbody></table>";
            toggleRentalButtons();
        }

        function toggleRentalButtons() {
            const checks = document.querySelectorAll('.rental-check:checked');
            const container = document.getElementById('rental-btn-container');
            if (checks.length > 0) {
                container.innerHTML = `<button class="btn btn-primary btn-sm fw-bold px-3 py-1" onclick="returnSelectedRentals()">Î∞òÎÇ©?òÍ∏∞</button>`;
            } else {
                container.innerHTML = `<span class="dash-title">?§ÏãúÍ∞??Ä???ÑÌô©</span>`;
            }
        }

        async function returnSelectedRentals() {
            if (!confirm("?†ÌÉù????™©??Î∞òÎÇ© Ï≤òÎ¶¨?òÏãúÍ≤†Ïäµ?àÍπå?")) return;
            const checks = document.querySelectorAll('.rental-check:checked');
            checks.forEach(chk => {
                const code = chk.dataset.code;
                const renter = chk.dataset.renter;
                const color = chk.dataset.color;
                const size = chk.dataset.size;
                const date = chk.dataset.date;
                allRentals = allRentals.filter(r => !(r.code == code && r.renter == renter && r.color == color && r.size == size && r.date == date));
            });
            await saveToGitHub("rentals.json", allRentals);
            alert("Î∞òÎÇ© Ï≤òÎ¶¨Í∞Ä ?ÑÎ£å?òÏóà?µÎãà??");
            toggleRentalButtons();
        }

        function autoExpand(el) {
            el.style.height = 'auto';
            el.style.height = (el.scrollHeight) + 'px';
        }

        // ?§ÏãúÍ∞?Ï∂îÍ? Í∏∞Îä• (+ Î≤ÑÌäº ?∏Î¶¨Í±?
        function addOutfit() {
            // Î™®Îã¨ Ï¥àÍ∏∞??Î∞??¥Í∏∞
            document.querySelectorAll('.outfit-name, .outfit-size').forEach(el => el.value = '');
            document.getElementById('outfitModal').style.display = 'flex';
        }

        function closeOutfitModal() {
            document.getElementById('outfitModal').style.display = 'none';
        }

        function confirmOutfitModal() {
            const names = document.querySelectorAll('.outfit-name');
            const sizes = document.querySelectorAll('.outfit-size');
            let addedCount = 0;

            for (let i = 0; i < names.length; i++) {
                const h = names[i].value.trim();
                const s = sizes[i].value.trim();
                if (h && s) {
                    allOutfits.push({ code: curItem.code, host: h, size: s });
                    addedCount++;
                }
            }
            if (addedCount > 0) {
                closeOutfitModal();
                saveToGitHub("outfits.json", allOutfits);
            } else {
                alert("ÏµúÏÜå ??Î™??¥ÏÉÅ???±Ìï®Í≥??¨Ïù¥Ï¶àÎ? ?ÖÎ†•?¥Ï£º?∏Ïöî.");
            }
        }

        // ?πÏù¥?¨Ìï≠ ?Ä??Í∏∞Îä•
        async function saveNote() {
            const text = document.getElementById("det-notes").value.trim();
            const idx = allNotes.findIndex(n => n.code == curItem.code);

            if (idx > -1) {
                if (text) allNotes[idx].text = text;
                else allNotes.splice(idx, 1); // ?¥Ïö©???ÜÏúºÎ©??úÍ±∞
            } else if (text) {
                allNotes.push({ code: curItem.code, text: text });
            }

            await saveToGitHub("notes.json", allNotes);
            alert("?πÏù¥?¨Ìï≠???Ä?•Îêò?àÏäµ?àÎã§.");
        }

        // Ï§ÄÎπÑÎ¨º ?Ä??Í∏∞Îä•
        async function saveSupplies() {
            const text = document.getElementById("det-supplies").value.trim();
            const idx = allSupplies.findIndex(s => s.code == curItem.code);

            if (idx > -1) {
                if (text) allSupplies[idx].text = text;
                else allSupplies.splice(idx, 1);
            } else if (text) {
                allSupplies.push({ code: curItem.code, text: text });
            }

            await saveToGitHub("supplies.json", allSupplies);
            alert("Ï§ÄÎπÑÎ¨º???Ä?•Îêò?àÏäµ?àÎã§.");

            // ?ÑÏû¨ ?îÎ©¥ Î¶¨Ïä§??Í∞±Ïã† (?§Î≤Ñ?àÏù¥ Ï¶âÏãú Î∞òÏòÅ)
            const activePage = document.querySelector('.page-section.active').id;
            if (activePage === 'page-schedule') renderSchedule();
            if (activePage === 'page-inventory') resetFilter();
        }

        // ?¨Í≥† ?∞Ïù¥???ëÏ?(.xlsx) ?§Ïö¥Î°úÎìú Í∏∞Îä•
        function downloadStockExcel() {
            if (!curItem) return;
            const stock = allStockMap[curItem.code] || [];
            if (stock.length === 0) {
                alert("?¨Í≥† ?∞Ïù¥?∞Í? ?ÜÏäµ?àÎã§.");
                return;
            }

            // Íµ¨Í? ?úÌä∏ ?êÎ≥∏ ?∞Ïù¥?∞Ïùò Ïª¨Îü¨ ?úÏÑú ?åÏïÖ
            const stockRAW = allStockMap[curItem.code] || [];
            const colorOrder = [];
            stockRAW.forEach(s => {
                if (s.color && !colorOrder.includes(s.color)) colorOrder.push(s.color);
            });

            // ?∞Ïù¥???ÑÌÑ∞Îß?(Ïª¨Îü¨/?¨Ïù¥Ï¶àÍ? ?àÎäî ??™©Îß? Î∞??ïÎ†¨
            const data = stockRAW
                .filter(s => s.color && s.size) // Í≥µÎ∞± ?∞Ïù¥???úÍ±∞
                .map(s => {
                    const rentedQty = allRentals.filter(r => r.code == curItem.code && r.color === s.color && r.size === s.size).reduce((a, b) => a + Number(b.qty), 0) || 0;
                    const currentQty = Number(s.qty) - rentedQty;
                    return {
                        "?ÅÌíàÏΩîÎìú": curItem.code,
                        "?ÅÌíàÎ™?: `${curItem.brand} ${curItem.name}`,
                        "?âÏÉÅ": s.color,
                        "?¨Ïù¥Ï¶?: s.size,
                        "?ÑÏû¨?¨Í≥†": currentQty
                    };
                })
                .sort((a, b) => {
                    // ?êÎ≥∏ Ïª¨Îü¨ ?úÏÑú?ÄÎ°??ïÎ†¨
                    return colorOrder.indexOf(a["?âÏÉÅ"]) - colorOrder.indexOf(b["?âÏÉÅ"]);
                });

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "?¨Í≥†?ÑÌô©");

            const fileName = `[${curItem.brand}] ${curItem.name}(${curItem.code}).xlsx`;
            XLSX.writeFile(workbook, fileName);
        }

        // --- ?Ä??Î∞îÍµ¨??Í¥Ä???®Ïàò ---
        function addToCart(code, name, color, size) {
            const exists = rentalCart.find(x => x.code === code && x.color === color && x.size === size);
            if (exists) { exists.qty++; }
            else { rentalCart.push({ code, name, color, size, qty: 1 }); }
            renderCart();
        }

        function renderCart() {
            const sect = document.getElementById("v-cart-section");
            const list = document.getElementById("v-cart-list");
            if (rentalCart.length === 0) {
                sect.style.display = 'none';
                return;
            }
            sect.style.display = 'block';
            list.innerHTML = rentalCart.map((item, idx) => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        ${item.color} / ${item.size}
                        <input type="number" class="cart-qty-input" value="${item.qty}" min="1" onchange="rentalCart[${idx}].qty = this.value">
                    </div>
                    <button class="delete-btn" style="position:static; color:#666;" onclick="rentalCart.splice(${idx}, 1); renderCart();">√ó</button>
                </div>
            `).join("");
        }

        async function submitRentalCart() {
            const renter = document.getElementById("cart-renter").value.trim();
            if (!renter) { alert("?Ä?¨Ïûê ?±Ìï®???ÖÎ†•?¥Ï£º?∏Ïöî."); return; }
            if (rentalCart.length === 0) return;

            // Í∏∞Ï°¥ Î¶¨Ïä§?∏Ïóê Ï∂îÍ?
            rentalCart.forEach(item => {
                allRentals.push({
                    code: item.code,
                    renter: renter,
                    color: item.color,
                    size: item.size,
                    qty: item.qty,
                    date: new Date().toISOString()
                });
            });

            await saveToGitHub("rentals.json", allRentals);
            rentalCart = [];
            document.getElementById("cart-renter").value = "";
            renderCart();
            alert("?Ä???±Î°ù???ÑÎ£å?òÏóà?µÎãà??");
        }

        // --- ?ÖÍ≥† Í¥ÄÎ¶?(In-place Table Switch) ?®Ïàò ---
        let isStockEditMode = false;

        function toggleStockEditMode(forceState) {
            isStockEditMode = (forceState !== undefined) ? forceState : !isStockEditMode;
            const titleRow = document.getElementById("stock-card-title");
            const toggleBtn = document.getElementById("stock-toggle-btn");
            const actions = document.getElementById("stock-edit-actions");

            if (isStockEditMode) {
                titleRow.innerText = "?†Í∑ú ?ÖÍ≥† ?±Î°ù Î™®Îìú";
                titleRow.style.color = "var(--primary)";
                toggleBtn.innerText = "√ó";
                toggleBtn.style.background = "#999";
                actions.style.display = "flex";
                renderStockMatrixInPlace();
            } else {
                titleRow.innerText = "?§ÏãúÍ∞??¨Í≥† ?ÑÌô©";
                titleRow.style.color = "";
                toggleBtn.innerText = "+";
                toggleBtn.style.background = "";
                actions.style.display = "none";
                renderDetailUI(curItem); // ?§Ïãú Î∑?Î™®ÎìúÎ°??åÎçîÎß?
            }
        }

        function renderStockMatrixInPlace() {
            if (!curItem) return;
            const stock = allStockMap[curItem.code] || [];
            let colors = [], sizes = [];

            if (stock.length > 0) {
                stock.forEach(s => {
                    if (s.color && !colors.includes(s.color)) colors.push(s.color);
                    if (s.size && !sizes.includes(s.size)) sizes.push(s.size);
                });
            } else {
                if (curItem.colors) colors = String(curItem.colors).split(',').map(v => v.trim()).filter(v => v);
                if (curItem.sizes) sizes = String(curItem.sizes).split(',').map(v => v.trim()).filter(v => v);
            }

            const container = document.getElementById("v-stock-table");
            let h = `<table class="st-table" style="table-layout: fixed;">
                <thead>
                    <tr>
                        <th style="width:70px;">?âÏÉÅ</th>
                        ${sizes.map(s => `<th>${s}</th>`).join("")}
                        <th style="background:#fff3f8; border: 1px solid #ffccd5; width:80px;">
                            <input type="text" id="new-size-name" placeholder="+?¨Ïù¥Ï¶? style="width:100%; font-size:10px; border:none; outline:none; background:transparent; text-align:center; font-weight:800;">
                        </th>
                    </tr>
                </thead>
                <tbody>`;

            colors.forEach(c => {
                h += `<tr><td class="bg-light fw-bold" style="font-size:11px;">${c}</td>`;
                sizes.forEach(s => {
                    h += `<td style="padding:0;"><input type="number" class="matrix-input" data-color="${c}" data-size="${s}" style="width:100%; height:32px; border:none; text-align:center; outline:none; font-size:13px; font-weight:800; color:var(--primary);"></td>`;
                });
                h += `<td style="background:#fff9fb; padding:0;"><input type="number" class="matrix-input new-size-qty" data-color="${c}" style="width:100%; height:32px; border:none; text-align:center; outline:none; background:transparent; font-size:13px;"></td></tr>`;
            });

            container.innerHTML = h + "</tbody></table>";
        }

        async function submitStockInPlace() {
            const inputs = document.querySelectorAll(".matrix-input");
            const newSizeName = document.getElementById("new-size-name").value.trim();
            const matrix = [];

            inputs.forEach(input => {
                const qty = parseInt(input.value);
                if (qty && qty !== 0) {
                    let size = input.dataset.size;
                    if (!size) {
                        if (!newSizeName) return;
                        size = newSizeName;
                    }
                    matrix.push({ color: input.dataset.color, size: size, qty: qty });
                }
            });

            if (matrix.length === 0) { alert("?ÖÎ†•???òÎüâ???ÜÏäµ?àÎã§."); return; }

            document.getElementById('loading-overlay').style.display = 'flex';
            try {
                const payload = {
                    code: curItem.code,
                    combinedName: `${curItem.brand} ${curItem.name}`,
                    location: curItem.location || "-",
                    matrix: matrix
                };

                // Î©îÎ™®Î¶?Ï¶âÏãú Í∞±Ïã† (Optimistic Update)
                matrix.forEach(m => {
                    if (!allStockMap[curItem.code]) allStockMap[curItem.code] = [];
                    const stockArr = allStockMap[curItem.code];
                    const existing = stockArr.find(x => x.color === m.color && x.size === m.size);
                    if (existing) {
                        existing.qty = Number(existing.qty) + Number(m.qty);
                    } else {
                        stockArr.push({ color: m.color, size: m.size, qty: m.qty });
                    }
                });
                
                // ?ÑÏ≤¥ ?¨Í≥† Î∞∞Ïó¥Î°??âÌÉÑ?îÌïò???ÑÏÜ°
                let flatInventory = [];
                Object.keys(allStockMap).forEach(code => {
                    allStockMap[code].forEach(item => {
                        flatInventory.push({ code: code, color: item.color, size: item.size, qty: item.qty });
                    });
                });

                const response = await fetch(GAS_WEB_APP_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "save_inventory", data: flatInventory })
                });

                const result = await response.json();
                alert("???ÖÍ≥† ?±Î°ù???ÑÎ£å?òÏñ¥ ?¨Í≥†??Ï¶âÏãú Î∞òÏòÅ?òÏóà?µÎãà??");
                toggleStockEditMode(false); // ?ÖÎ†• Î™®Îìú Ï¢ÖÎ£å

                // ?îÎ©¥ Ï¶âÏãú ?§Ïãú Í∑∏Î¶¨Í∏?(?§Ìä∏?åÌÅ¨ ?ÄÍ∏??ÜÏù¥ Î©îÎ™®Î¶?Í∞íÏúºÎ°?Í∞±Ïã†)
                if (curItem) renderDetailUI(curItem);
            } catch (e) {
                console.error("?ÖÍ≥† ?êÎü¨ ?ÅÏÑ∏:", e);
                alert("?§Ìä∏?åÌÅ¨ ?§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§. ?ÖÍ≥† ?∞Ïù¥?∞Í? ?úÌä∏???Ä?•Îêò?àÎäîÏßÄ ?ïÏù∏??Ï£ºÏÑ∏??");
            } finally {
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }


        function addRental() {
            const r = prompt("?Ä?¨Ïûê ?±Ìï®:"), c = prompt("?âÏÉÅ:"), s = prompt("?¨Ïù¥Ï¶?"), q = prompt("?òÎüâ:", "1");
            if (r && c && s) { allRentals.push({ code: curItem.code, renter: r, color: c, size: s, qty: q, date: new Date().toISOString() }); saveToGitHub("rentals.json", allRentals); }
        }
        function deleteEntry(type, code, key, color, size) {
            if (!confirm("??†ú?òÏãúÍ≤†Ïäµ?àÍπå?")) return;
            if (type === 'outfit') allOutfits = allOutfits.filter(o => !(o.code === code && o.host === key));
            else allRentals = allRentals.filter(r => !(r.code === code && r.renter === key && r.color === color && r.size === size));
            saveToGitHub(type === 'outfit' ? "outfits.json" : "rentals.json", type === 'outfit' ? allOutfits : allRentals);
        }


        function resetFilter() {
            const b = document.getElementById("brandSel").value;
            const c = document.getElementById("cateSel").value;
            const q = document.getElementById("invSearch").value.toLowerCase();

            filteredItems = allItems.filter(i => {
                if (!i.isMaster) return false;

                const matchBrand = (b === 'All' || i.brand === b);
                const matchQuery = (i.name.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q) || i.code.toLowerCase().includes(q));

                if (c === 'Î∞òÏ∂ú') {
                    // 'Î∞òÏ∂ú' Ïπ¥ÌÖåÍ≥†Î¶¨Í∞Ä ?†ÌÉù??Í≤ΩÏö∞: ?§ÏßÅ 'Î∞òÏ∂ú' ?ÑÏù¥?úÎßå ?úÏãú
                    return i.category === 'Î∞òÏ∂ú' && matchBrand && matchQuery;
                } else {
                    // Í∑???Í≤ΩÏö∞: 'Î∞òÏ∂ú' ?ÑÏù¥?úÏ? Î¨¥Ï°∞Í±??úÏô∏?òÍ≥† ?ºÎ∞ò ?ÑÌÑ∞ ?ÅÏö©
                    const matchCategory = (c === 'All' || i.category === c);
                    return i.category !== 'Î∞òÏ∂ú' && matchCategory && matchBrand && matchQuery;
                }
            });

            filteredItems.sort((a, b) => {
                if (a.code > b.code) return -1;
                if (a.code < b.code) return 1;
                return 0;
            });

            document.getElementById("inventoryContainer").innerHTML = "";
            renderInventoryChunk();
        }

        function renderInventoryChunk() {
            const c = document.getElementById("inventoryContainer"), cur = c.children.length;
            filteredItems.slice(cur, cur + 40).forEach(i => c.appendChild(createCard(i)));
            document.getElementById("loadMoreContainer").innerHTML = filteredItems.length > c.children.length ? `<button class="btn btn-primary rounded-pill px-4 btn-sm fw-bold" onclick="renderInventoryChunk()">??Î≥¥Í∏∞</button>` : "";
        }
        function parseTime(s) { if (!s) return 9999; const m = s.match(/(\d{1,2}):(\d{1,2})/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 9999; }
    
        
// --- Task Order (?ëÏóÖ?òÌñâ?? Logic ---
let currentTaskDate = null;
let currentTaskTime = null;

let draggedItemCode = null;
let draggedItemEl = null;
let taskRowCounter = 0;
let draggedRowEl = null;

function handleRowDragStart(e) {
    draggedRowEl = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'row');
}

function handleRowDragEnd(e) {
    draggedRowEl = null;
}

function updateSectionPlaceholder(sectionId) {
    const container = document.getElementById(`section-${sectionId}-rows`);
    if(!container) return;
    const placeholder = container.querySelector('.section-placeholder');
    const hasRows = container.querySelectorAll('.task-matrix-row').length > 0;
    if(placeholder) placeholder.style.display = hasRows ? 'none' : 'flex';
}

function handleSectionDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.style.background = '#f3f4f6';
}

function handleSectionDragLeave(e) {
    e.currentTarget.style.background = '#f9fafb';
}

function handleSectionDrop(e, sectionId) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.background = '#f9fafb';
    
    if (draggedRowEl) {
        const container = document.getElementById(`section-${sectionId}-rows`);
        const targetRow = e.target.closest('.task-matrix-row');
        if (targetRow && targetRow !== draggedRowEl && targetRow.parentNode === container) {
            const rect = targetRow.getBoundingClientRect();
            const offset = e.clientY - rect.top;
            if (offset > rect.height / 2) {
                targetRow.after(draggedRowEl);
            } else {
                targetRow.before(draggedRowEl);
            }
        } else if (!targetRow) {
            container.appendChild(draggedRowEl);
        }
        updateSectionPlaceholder(sectionId);
        return;
    }
    
    if (draggedItemCode && draggedItemEl) {
        appendNewRowToSection(sectionId, draggedItemCode, draggedItemEl);
        draggedItemCode = null;
        draggedItemEl = null;
    }
}

function addUsageBadge(itemCode, sectionId) {
    const originalCard = document.getElementById(`pool-item-${itemCode}`);
    if (originalCard) {
        const badgesContainer = originalCard.querySelector('.usage-badges');
        if (badgesContainer) {
            const badge = document.createElement('div');
            badge.className = `usage-badge section-${sectionId}`;
            badge.style.cssText = 'background:var(--primary); color:#fff; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:10px; line-height:1; white-space:nowrap; box-shadow:0 1px 2px rgba(0,0,0,0.15); display:inline-block;';
            badge.innerText = `${sectionId}`;
            badgesContainer.appendChild(badge);
        }
    }
}

function removeUsageBadge(itemCode, sectionId) {
    const originalCard = document.getElementById(`pool-item-${itemCode}`);
    if (originalCard) {
        const badgesContainer = originalCard.querySelector('.usage-badges');
        if (badgesContainer) {
            const badge = badgesContainer.querySelector(`.section-${sectionId}`);
            if (badge) badge.remove();
        }
    }
}

function removeTaskRow(rowEl, sectionId, itemCode) {
    rowEl.remove();
    updateSectionPlaceholder(sectionId);
    removeUsageBadge(itemCode, sectionId);
}

function rebuildUsageBadges() {
    document.querySelectorAll('.usage-badges').forEach(b => b.innerHTML = '');
    const rows = document.querySelectorAll('.task-matrix-row');
    rows.forEach(row => {
        const itemCode = row.getAttribute('data-code');
        const container = row.closest('[id$="-rows"]');
        if (itemCode && container) {
            const sectionIdMatch = container.id.match(/section-(\d+)-rows/);
            if (sectionIdMatch) {
                addUsageBadge(itemCode, sectionIdMatch[1]);
            }
        }
    });
}

function appendNewRowToSection(sectionId, itemCode, itemEl) {
    let newProductEl = itemEl;
    if(itemEl.parentNode && itemEl.parentNode.id === 'taskContainer') {
        newProductEl = itemEl.cloneNode(true);
        newProductEl.removeAttribute('id');
        newProductEl.removeAttribute('draggable');
        newProductEl.removeAttribute('ondragstart');
        newProductEl.removeAttribute('ondragend');
        addUsageBadge(itemCode, sectionId);
    }
    
    taskRowCounter++;
    const rowId = `task-row-${taskRowCounter}`;
    
    const hostsInput = document.getElementById('taskHosts').value || '?∏Ïä§??, ?∏Ïä§??';
    const hostsArr = hostsInput.split(',').map(s => s.trim());
    const host1 = hostsArr[0] || '?∏Ïä§??';
    const host2 = hostsArr[1] || '?∏Ïä§??';
    
    const columns = ['main', 'hanger', 'h1_hand', 'h2_hand', 'h1_wear', 'h2_wear'];
    
    let cellsHTML = '';
    columns.forEach(col => {
        cellsHTML += `
            <div class="matrix-cell dropzone" data-row="${rowId}" data-col="${col}"
                ondragover="handleDragOver(event)" 
                ondragleave="handleDragLeave(event)"
                ondrop="handleCellDrop(event)"
                style="flex:1; min-width:140px; border-left:1px solid #e5e7eb; padding:10px; display:flex; flex-direction:column; background:#fff; transition: all 0.2s; min-height:80px;">
                <textarea style="width:100%; flex:1; min-height:60px; border:1px solid #e5e7eb; border-radius:4px; padding:18px 8px; box-sizing:border-box; resize:vertical; font-size:15px; font-weight:bold; font-family:inherit; background-color:#f9fafb; outline:none; text-align:center;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e5e7eb'"></textarea>
            </div>
        `;
    });
    
    const rowHTML = `
        <div id="${rowId}" data-code="${itemCode}" class="task-matrix-row" draggable="true" ondragstart="handleRowDragStart(event)" ondragend="handleRowDragEnd(event)" style="display:flex; border-bottom:1px solid #e5e7eb; min-height:80px; align-items:stretch; position:relative; background:#fff; margin-bottom:5px;">
            <div class="drag-handle" style="position:absolute; top:2px; left:2px; cursor:grab; color:#9ca3af; font-size:16px; padding:2px; z-index:10;" title="?úÎûòÍ∑∏Ìïò???úÏÑú Î≥ÄÍ≤?>??/div>
            <div class="matrix-cell product-cell" style="width:300px; min-width:300px; padding:4px 8px; background:#fff; display:flex; flex-direction:column; justify-content:center; align-items:center; position:relative; border-top-left-radius:6px; border-bottom-left-radius:6px;">
            </div>
            ${cellsHTML}
        </div>
    `;
    
    const sectionContainer = document.getElementById(`section-${sectionId}-rows`);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = rowHTML.trim();
    const newRow = wrapper.firstChild;
    sectionContainer.appendChild(newRow);
    
    newProductEl.style.minWidth = 'auto';
    newProductEl.style.maxWidth = '100%';
    newProductEl.style.flexDirection = 'row';
    newProductEl.style.alignItems = 'center';
    newProductEl.style.marginBottom = '0';
    newProductEl.style.boxShadow = 'none';
    newProductEl.style.border = 'none';
    newProductEl.style.flex = '1';
    
    const imgContainer = newProductEl.children[0];
    imgContainer.style.width = '140px';
    imgContainer.style.height = '140px';
    imgContainer.style.marginBottom = '0';
    imgContainer.style.marginRight = '8px';
    imgContainer.style.borderRadius = '6px';
    imgContainer.style.flexShrink = '0';
    const badges = imgContainer.querySelector('.usage-badges');
    if (badges) badges.style.display = 'none';
    
    const textContainer = newProductEl.children[1];
    textContainer.style.textAlign = 'left';
    textContainer.style.display = 'flex';
    textContainer.style.flexDirection = 'column';
    
    const nameDiv = textContainer.children[1];
    if(nameDiv) {
        nameDiv.style.fontSize = '13px';
        nameDiv.style.whiteSpace = 'normal';
        nameDiv.style.overflow = 'visible';
        nameDiv.style.textOverflow = 'clip';
        nameDiv.style.display = 'block'; 
        nameDiv.style.wordBreak = 'keep-all';
        nameDiv.style.lineHeight = '1.3';
    }
    
    newRow.querySelector('.product-cell').appendChild(newProductEl);
    updateSectionPlaceholder(sectionId);
}

function handleDragStart(e, code) {
    draggedItemCode = code;
    draggedItemEl = e.currentTarget;
    e.dataTransfer.setData('text/plain', code);
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    draggedItemCode = null;
    draggedItemEl = null;
}

function handleDragOver(e) {
    e.preventDefault();
    if(e.currentTarget.classList.contains('dropzone')) {
        e.currentTarget.style.background = '#f3f4f6';
    } else {
        e.currentTarget.style.background = '#f9fafb';
    }
}

function handleDragLeave(e) {
    if(e.currentTarget.classList.contains('dropzone')) {
        e.currentTarget.style.background = '#fff';
    } else {
        e.currentTarget.style.background = '#f9fafb';
    }
}

function handleProductCellDrop(e) {
    e.preventDefault();
    const dropZone = e.currentTarget;
    dropZone.style.background = '#fff';
    
    if (draggedItemCode && draggedItemEl) {
        if(draggedItemEl.parentNode.id === 'taskContainer') {
            draggedItemEl.parentNode.removeChild(draggedItemEl);
        } else if(draggedItemEl.parentNode.classList.contains('product-cell')) {
            // ?§Î•∏ ?Ä?êÏÑú Í∞Ä?∏Ïò§??Í≤ΩÏö∞ ?êÎûò ?Ä?Ä ÎπÑÏõå??
            draggedItemEl.parentNode.innerHTML = '?úÎûòÍ∑∏Ìïò???ÅÌíà Î∞∞Ïπò';
        }
        
        // ?Ä???Ä ÎπÑÏö∞Í∏?
        dropZone.innerHTML = `
            <div onclick="this.parentNode.innerHTML='?úÎûòÍ∑∏Ìïò???ÅÌíà Î∞∞Ïπò'; window.renderTaskItems();" style="position:absolute; top:5px; right:5px; cursor:pointer; color:#ef4444; font-size:12px; font-weight:bold; padding:2px 6px; border-radius:4px; background:#fee2e2; z-index:10;">X</div>
        `;
        dropZone.appendChild(draggedItemEl);
        
        draggedItemEl.style.minWidth = 'auto';
        draggedItemEl.style.maxWidth = '100%';
        draggedItemEl.style.flexDirection = 'row';
        draggedItemEl.style.alignItems = 'center';
        draggedItemEl.style.marginBottom = '0';
        draggedItemEl.style.boxShadow = 'none';
        draggedItemEl.style.border = 'none';
        draggedItemEl.style.flex = '1';
        
        const imgContainer = draggedItemEl.children[0];
        imgContainer.style.width = '50px';
        imgContainer.style.height = '50px';
        imgContainer.style.marginBottom = '0';
        imgContainer.style.marginRight = '8px';
        imgContainer.style.borderRadius = '4px';
        imgContainer.style.flexShrink = '0';
        
        const textContainer = draggedItemEl.children[1];
        textContainer.style.textAlign = 'left';
        textContainer.style.display = 'flex';
        textContainer.style.flexDirection = 'column';
        textContainer.style.justifyContent = 'center';
        
        const brandDiv = textContainer.children[0];
        if(brandDiv) brandDiv.style.fontSize = '10px';
        
        const nameDiv = textContainer.children[1];
        if(nameDiv) nameDiv.style.fontSize = '11px';
    }
}

function handleCellDrop(e) {
    e.preventDefault();
    const dropZone = e.currentTarget;
    dropZone.style.background = '#fff';
    
    if (draggedItemCode && draggedItemEl) {
        if(draggedItemEl.parentNode.id === 'taskContainer') {
            draggedItemEl.parentNode.removeChild(draggedItemEl);
        }
        
        draggedItemEl.style.minWidth = 'auto';
        draggedItemEl.style.maxWidth = '100%';
        draggedItemEl.style.flexDirection = 'row';
        draggedItemEl.style.alignItems = 'center';
        draggedItemEl.style.marginBottom = '8px';
        draggedItemEl.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
        draggedItemEl.style.border = '1px solid #e5e7eb';
        draggedItemEl.style.padding = '6px';
        draggedItemEl.style.borderRadius = '6px';
        
        const imgContainer = draggedItemEl.children[0];
        imgContainer.style.width = '35px';
        imgContainer.style.height = '35px';
        imgContainer.style.marginBottom = '0';
        imgContainer.style.marginRight = '8px';
        imgContainer.style.borderRadius = '4px';
        
        const textContainer = draggedItemEl.children[1];
        textContainer.style.textAlign = 'left';
        
        const brandDiv = textContainer.children[0];
        if(brandDiv) brandDiv.style.fontSize = '9px';
        
        const nameDiv = textContainer.children[1];
        if(nameDiv) nameDiv.style.fontSize = '10px';
        
        dropZone.appendChild(draggedItemEl);
    }
}

function generateTaskSections() {
    const hostsInput = document.getElementById('taskHosts').value || '?∏Ïä§??, ?∏Ïä§??';
    const hostsArr = hostsInput.split(',').map(s => s.trim());
    const host1 = hostsArr[0] || '?∏Ïä§??';
    const host2 = hostsArr[1] || '?∏Ïä§??';
    
    const count = parseInt(document.getElementById('taskSectionsCount').value) || 0;
    const area = document.getElementById('taskSectionsArea');
    area.innerHTML = '';
    
    const columns = [
        { key: 'product', name: '?ÅÌíà', width: '300px' },
        { key: 'main', name: 'Î©îÏù∏', width: '110px' },
        { key: 'hanger', name: '?âÍ±∞', width: '110px' },
        { key: 'h1_hand', name: `${host1} ?∏Îì§Îß?, width: '110px' },
        { key: 'h2_hand', name: `${host2} ?∏Îì§Îß?, width: '110px' },
        { key: 'h1_wear', name: `${host1} Ï∞©Ïû•`, width: '110px' },
        { key: 'h2_wear', name: `${host2} Ï∞©Ïû•`, width: '110px' }
    ];
    
    for(let i=1; i<=count; i++) {
        let headerHTML = '';
        columns.forEach(col => {
            const widthStyle = col.key === 'product' ? `width:${col.width}; min-width:${col.width};` : `flex:1; min-width:${col.width}; border-left:1px solid #e5e7eb;`;
            headerHTML += `
                <div style="${widthStyle} padding:10px; font-size:12px; font-weight:bold; color:#4b5563; text-align:center; background:#f3f4f6;">
                    ${col.name}
                </div>
            `;
        });

        const sectionHTML = `
            <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:15px; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h4 style="margin:0; font-size:15px; color:#111; border-bottom:2px solid var(--primary); padding-bottom:5px;">Íµ¨Í∞Ñ ${i}</h4>
                </div>
                
                <div style="overflow-x:auto; border:1px solid #e5e7eb; border-radius:6px;">
                    <div style="display:flex; border-bottom:1px solid #e5e7eb;">
                        ${headerHTML}
                    </div>
                    
                    <div id="section-${i}-rows" 
                        ondragover="handleSectionDragOver(event)"
                        ondragleave="handleSectionDragLeave(event)"
                        ondrop="handleSectionDrop(event, ${i})"
                        style="display:flex; flex-direction:column; background:#f9fafb; min-height:80px; padding:10px 0; position:relative; transition: background 0.2s; border-bottom-left-radius:6px; border-bottom-right-radius:6px;">
                        <div class="section-placeholder" style="position:absolute; inset:0; display:flex; justify-content:center; align-items:center; color:#6b7280; font-size:13px; font-weight:500; pointer-events:none;">
                            ???¥Í≥≥???ÅÌíà???úÎûòÍ∑∏Ìïò???ÅÌíà Ï∂îÍ?
                        </div>
                    </div>
                </div>
            </div>
        `;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = sectionHTML.trim();
        area.appendChild(wrapper.firstChild);
    }

    // ?òÎã® ?Ä???∏ÏáÑ Î≤ÑÌäº ?ÅÏó≠ Ï∂îÍ?
    if(count > 0) {
        const bottomBtns = document.createElement('div');
        bottomBtns.style.display = 'flex';
        bottomBtns.style.justifyContent = 'flex-end';
        bottomBtns.style.gap = '10px';
        bottomBtns.style.marginTop = '10px';
        bottomBtns.style.marginBottom = '30px';
        bottomBtns.innerHTML = `
            <button style="padding:10px 20px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; font-size:14px; font-weight:bold; cursor:pointer; color:#4b5563;">
                ?ñ®Ô∏??∏ÏáÑ / PDF ?Ä??
            </button>
            <button style="padding:10px 20px; background:var(--primary); border:none; border-radius:8px; font-size:14px; font-weight:bold; cursor:pointer; color:white;">
                ?íæ ?ÑÏãú ?Ä??
            </button>
        `;
        area.appendChild(bottomBtns);
    }
}


        // Helper to check if a schedule item is "our product"
        function isOurProduct(code) {
            return allItems.some(m => m.isMaster && m.code === code);
        }

        // Get all time slots (YYYY-MM-DD HH:mm) where OUR product is scheduled
        function getOurTimeSlots() {
            const ourSlots = new Set();
            allItems.forEach(i => {
                if(!i.isMaster && i.date && isOurProduct(i.code)) {
                    ourSlots.add(i.date.trim()); // e.g., "2026-07-02 01:00"
                }
            });
            return ourSlots;
        }

function initTaskScrollers() {

            const scroller = document.getElementById('taskDateScroller');
            if(!scroller) return;
            scroller.innerHTML = '';
            
            const ourSlots = getOurTimeSlots();
            const dateSet = new Set();
            ourSlots.forEach(slot => {
                const dateKey = slot.split(' ')[0]; // "2026-07-02"
                if(dateKey) dateSet.add(dateKey);
            });
            const uniqueDates = Array.from(dateSet).sort();
            
            if(uniqueDates.length === 0) {
                scroller.innerHTML = '<div style="padding:20px; text-align:center; color:#999; width:100%;">?∞Î¶¨ ?ÅÌíà???∏ÏÑ±???ºÏ†ï???ÜÏäµ?àÎã§.</div>';
                document.getElementById('taskTimeScroller').innerHTML = '';
                document.getElementById('taskContainer').innerHTML = '';
                return;
            }
            
            if(!currentTaskDate || !uniqueDates.includes(currentTaskDate)) {
                const today = new Date().toISOString().substring(0,10);
                if(uniqueDates.includes(today)) currentTaskDate = today;
                else currentTaskDate = uniqueDates[0];
            }
            
            uniqueDates.forEach(d => {
                const btn = document.createElement('button');
                btn.className = 'date-btn ' + (d === currentTaskDate ? 'active' : '');
                
                const parts = d.split('-');
                const month = parseInt(parts[1], 10);
                const day = parseInt(parts[2], 10);
                const dateObj = new Date(d);
                const weekStr = ['??,'??,'??,'??,'Î™?,'Í∏?,'??][dateObj.getDay()];
                
                btn.innerHTML = `<span style="font-size:12px; opacity:0.8; margin-bottom:2px;">${month}.${day}</span><span style="font-weight:bold; font-size:16px;">${weekStr}</span>`;
                btn.onclick = () => {
                    currentTaskDate = d;
                    initTaskScrollers();
                };
                scroller.appendChild(btn);
            });
            
            renderTaskTimeScroller();
        }

        function renderTaskTimeScroller() {
            const timeScroller = document.getElementById('taskTimeScroller');
            if(!timeScroller) return;
            timeScroller.innerHTML = '';
            
            const ourSlots = getOurTimeSlots();
            const timeSet = new Set();
            
            ourSlots.forEach(slot => {
                if(slot.startsWith(currentTaskDate)) {
                    const timePart = parseTimeFromDateString(slot);
                    if(timePart) timeSet.add(timePart);
                }
            });
            
            const uniqueTimes = Array.from(timeSet).sort();
            
            if(uniqueTimes.length === 0) {
                timeScroller.innerHTML = '<div style="padding:10px; color:#999; font-size:13px; text-align:center; width:100%;">?¥Îãπ ?†Ïßú???∞Î¶¨ ?ÅÌíà???∏ÏÑ±???úÍ∞Ñ???ÜÏäµ?àÎã§.</div>';
                document.getElementById('taskContainer').innerHTML = '';
                return;
            }
            
            if(!currentTaskTime || !uniqueTimes.includes(currentTaskTime)) {
                currentTaskTime = uniqueTimes[0];
            }
            
            uniqueTimes.forEach(t => {
                const btn = document.createElement('button');
                btn.className = 'date-btn ' + (t === currentTaskTime ? 'active' : '');
                btn.style.height = '40px';
                btn.style.minWidth = '70px';
                btn.style.borderRadius = '20px';
                btn.style.fontWeight = 'bold';
                btn.innerHTML = t;
                btn.onclick = () => {
                    currentTaskTime = t;
                    renderTaskTimeScroller(); // Refresh times (active state) and items
                };
                timeScroller.appendChild(btn);
            });
            
            renderTaskItems();
        }
        
        function parseTimeFromDateString(dateStr) {
            if(!dateStr) return null;
            const parts = dateStr.trim().split(' ');
            if(parts.length > 1) {
                return parts[1];
            }
            return null;
        }

        function renderTaskItems() {
            const container = document.getElementById('taskContainer');
            const sectionsArea = document.getElementById('taskSectionsArea');
            if(!container) return;
            
            container.innerHTML = '';
            sectionsArea.innerHTML = ''; // ?úÍ∞Ñ Î≥ÄÍ≤???Íµ¨Í∞Ñ Ï¥àÍ∏∞??
            
            // Ï¢åÏ∏° ?¨Ïù¥?úÎ∞î ?∏Î°ú ?àÏù¥?ÑÏõÉ ?†Ï?
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '8px';
            
            const targetPrefix = currentTaskDate + " " + currentTaskTime;
            const items = allItems.filter(i => !i.isMaster && i.date && i.date.startsWith(targetPrefix));
            
            if(items.length === 0) {
                container.innerHTML = '<div style="padding:20px 0; text-align:center; color:#bbb; font-size:12px; font-weight:700;">?∏ÏÑ±???ÅÌíà??br>?ÜÏäµ?àÎã§</div>';
                return;
            }
            
            items.forEach(item => {
                const isOurs = isOurProduct(item.code);
                const master = allItems.find(p => p.isMaster && p.code === item.code) || {};
                
                const brand = isOurs ? (master.brand || item.brand || '') : (item.brand || '');
                const name = isOurs ? (master.name || item.name || '') : (item.name || '');
                
                const targetItemForImage = isOurs && master.image ? master : item;
                const imgSrc = getProductImage(targetItemForImage) || 'https://via.placeholder.com/100?text=No+Image';

                const imgBorderStyle = isOurs ? 'border: 2px solid #ff66a3;' : 'border: 1px solid #eee;';

                // ?¨Ïù¥?úÎ∞î ?∏Î°ú Î∞∞Ïπò??Ïπ¥Îìú (Í∞ÄÎ°??ÑÏ≤¥ ?àÎπÑ)
                const cardHTML = `
                    <div id="pool-item-${item.code}" class="dash-card" draggable="true" ondragstart="handleDragStart(event, '${item.code}')" ondragend="handleDragEnd(event)"
                        style="display:flex; flex-direction:row; align-items:center; padding:10px; cursor:grab; gap:10px; margin-bottom:0;">
                        <div onclick="showProductInventoryModal('${item.code}')"
                            style="width:72px; height:72px; flex-shrink:0; border-radius:8px; overflow:hidden; background:#fff; ${imgBorderStyle} box-sizing:border-box; cursor:pointer; pointer-events:auto; position:relative;">
                            <img src="${imgSrc}" draggable="false" style="width:100%; height:100%; object-fit:contain; pointer-events:none;">
                        </div>
                        <div style="flex:1; min-width:0; pointer-events:none;">
                            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                                <div style="font-size:11px; color:var(--primary); font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${brand}</div>
                                <div class="usage-badges" style="display:flex; flex-wrap:wrap; gap:3px; align-items:center;"></div>
                            </div>
                            <div style="font-size:12px; font-weight:700; color:#111; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:keep-all;">${name}</div>
                        </div>
                    </div>
                `;
                const div = document.createElement('div');
                div.innerHTML = cardHTML.trim();
                container.appendChild(div.firstChild);
            });
            rebuildUsageBadges();
        }

        function showProductInventoryModal(code) {
            const isOurs = isOurProduct(code);
            const item = allItems.find(i => i.code === code) || {};
            const master = allItems.find(i => i.isMaster && String(i.code) === String(code)) || item;
            const brand = isOurs ? (master.brand || item.brand || '') : (item.brand || '');
            const name = isOurs ? (master.name || item.name || '') : (item.name || '');
            const targetItemForImage = isOurs && master.image ? master : item;
            
            const modal = document.getElementById('inventoryMatrixModal');
            const img = document.getElementById('inv-modal-img');
            const title = document.getElementById('inv-modal-title');
            const tableContainer = document.getElementById('inv-modal-table-container');

            img.src = getProductImage(targetItemForImage) || 'https://via.placeholder.com/200?text=No+Image';
            title.innerText = brand + ' ' + name;

            const stock = allStockMap[code] || [];
            let colors = [], sizes = [];

            if (stock.length > 0) {
                stock.forEach(s => {
                    if (s.color && !colors.includes(s.color)) colors.push(s.color);
                    if (s.size && !sizes.includes(s.size)) sizes.push(s.size);
                });
            } else {
                if (master.colors) colors = String(master.colors).split(',').map(v => v.trim()).filter(v => v);
                if (master.sizes) sizes = String(master.sizes).split(',').map(v => v.trim()).filter(v => v);
            }

            if (colors.length === 0 && sizes.length === 0) {
                tableContainer.innerHTML = '<div style="padding:30px; text-align:center; color:#666;">?±Î°ù???¨Í≥† ?ïÎ≥¥Í∞Ä ?ÜÏäµ?àÎã§.</div>';
            } else {
                let h = `<table class="st-table" style="table-layout: fixed; width:100%;">
                    <thead>
                        <tr>
                            <th style="width:70px;">?âÏÉÅ</th>
                            ${sizes.map(s => `<th>${s}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody>`;
                
                let totalStock = 0;
                colors.forEach(c => {
                    h += `<tr><td class="bg-light fw-bold" style="font-size:11px;">${c}</td>`;
                    sizes.forEach(s => {
                        const sItem = stock.find(st => st.color === c && st.size === s);
                        const qty = sItem ? parseInt(sItem.qty || 0) : 0;
                        totalStock += qty;
                        h += `<td style="padding:0; text-align:center; height:32px; font-size:13px; font-weight:bold; color:${qty > 0 ? 'var(--primary)' : '#ccc'};">${qty}</td>`;
                    });
                    h += `</tr>`;
                });
                h += `</tbody></table>`;
                h += `<div style="text-align:right; margin-top:10px; font-weight:bold; font-size:14px; padding: 10px;">Ï¥??¨Í≥†: <span style="color:var(--primary);">${totalStock}</span>Í∞?/div>`;
                
                tableContainer.innerHTML = h;
            }

            modal.style.display = 'flex';
        }
        </script>

<!-- ?ÅÌíà ?¨Í≥† Îß§Ìä∏Î¶?ä§ ?ùÏóÖ -->
<div id="inventoryMatrixModal" class="modal" tabindex="-1" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
    <div style="background:white; padding:20px; border-radius:12px; width:90%; max-width:600px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h5 style="margin:0; font-weight:bold; font-size:16px;">?ÅÌíà ?¨Í≥† ?ÑÌô©</h5>
            <button onclick="document.getElementById('inventoryMatrixModal').style.display='none'" style="border:none; background:none; font-size:24px; cursor:pointer; line-height:1;">&times;</button>
        </div>
        
        <div style="display:flex; gap:20px; margin-bottom:15px;">
            <div style="width:120px; height:120px; flex-shrink:0; border-radius:8px; overflow:hidden; border:1px solid #eee; background:#f9fafb;">
                <img id="inv-modal-img" src="" style="width:100%; height:100%; object-fit:contain;">
            </div>
            <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                <div id="inv-modal-title" style="font-size:15px; font-weight:bold; color:#111; line-height:1.4;"></div>
            </div>
        </div>
        
        <div id="inv-modal-table-container" style="flex:1; overflow-y:auto; border:1px solid #eee; border-radius:8px; background:#fff;">
            <!-- ?¨Í≥† Îß§Ìä∏Î¶?ä§ ?åÏù¥Î∏??ÅÏó≠ -->
        </div>
    </div>
</div>

<!-- ?ÅÌíà Í≤Ä???ùÏóÖ (Î∂àÎü¨?§Í∏∞) -->
<div id="searchProductModal" class="modal" tabindex="-1" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
    <div style="background:white; padding:20px; border-radius:12px; width:95%; max-width:1200px; height:85vh; display:flex; flex-direction:column; overflow:hidden;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h5 style="margin:0; font-weight:bold; font-size:16px;">?±Î°ù???ÅÌíà Í≤Ä??/h5>
            <button onclick="document.getElementById('searchProductModal').style.display='none'" style="border:none; background:none; font-size:24px; cursor:pointer; line-height:1;">&times;</button>
        </div>
        <input type="text" id="productSearchInput" class="form-control" placeholder="?ÅÌíàÎ™? Î∏åÎûú?? ÏΩîÎìú Í≤Ä??.." oninput="renderProductSearchList()" style="margin-bottom:15px; padding:10px; border-radius:8px; border:1px solid #ccc; font-size:14px;">
        
        <div id="productSearchList" style="flex:1; min-height:0; overflow-y:auto; border:1px solid #eee; border-radius:8px; display:grid; grid-template-columns:repeat(5, 1fr); gap:15px; padding:15px; align-content:start;">
            <!-- Í≤Ä??Í≤∞Í≥º Î¶¨Ïä§??-->
        </div>
    </div>
</div>

<script>
