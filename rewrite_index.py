import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update GAS_WEB_APP_URL
content = re.sub(
    r'const GAS_WEB_APP_URL = "https://script.google.com[^"]+";',
    'const GAS_WEB_APP_URL = "https://lotte-backend.poodingcake.workers.dev";',
    content
)

# 2. Update initApp fetch logic
old_init_fetch = """// 1. 마스터 데이터 (data.json)
                const masterRes = await fetch(`data.json?v=${ts}`);
                const masterData = await masterRes.json();

                // 2. 실시간 대여 정보 (GitHub API)
                allRentals = await fetchWithToken("rentals.json");

                // 3. 실시간 착장 정보 (GitHub API)
                allOutfits = await fetchWithToken("outfits.json");

                // 4. 상품 특이사항 (GitHub API)
                allNotes = await fetchWithToken("notes.json");

                // 5. 준비물 정보 (GitHub API)
                allSupplies = await fetchWithToken("supplies.json");"""

new_init_fetch = """// 1. 마스터 데이터 (data.json)
                const masterRes = await fetch(`data.json?v=${ts}`);
                const masterData = await masterRes.json();

                // 2. 백엔드(Cloudflare)에서 모든 동적 데이터 호출
                const backendRes = await fetch(GAS_WEB_APP_URL + "?action=getAll");
                const backendData = await backendRes.json();

                allRentals = backendData.rentals || [];
                allOutfits = backendData.outfits || [];
                allNotes = backendData.notes || [];
                allSupplies = backendData.supplies || [];

                // 재고 덮어쓰기
                if (backendData.inventory && Object.keys(backendData.inventory).length > 0) {
                    masterData.stockMap = backendData.inventory;
                }"""
content = content.replace(old_init_fetch, new_init_fetch)

# 3. Update saveToGitHub
old_save = """// 깃허브 파일 저장 (SHA 자동갱신 로직 포함)
        async function saveToGitHub(fileName, data) {
            document.getElementById('loading-overlay').style.display = 'flex';
            const url = `https://api.github.com/repos/${GH_CONFIG.user}/${GH_CONFIG.repo}/contents/${fileName}`;
            try {
                // 기존 SHA 가져오기
                const getRes = await fetch(url, { headers: { Authorization: `token ${GH_CONFIG.token}` } });
                const fileInfo = await getRes.json();

                // 파일 업데이트
                const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
                const putRes = await fetch(url, {
                    method: "PUT",
                    headers: { Authorization: `token ${GH_CONFIG.token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ message: `Update ${fileName}`, content: content, sha: fileInfo.sha })
                });

                if (putRes.ok) {
                    // 페이지 전체를 새로고침하는 대신 UI만 즉시 갱신
                    if (curItem) renderDetailUI(curItem);
                }
                else alert("토큰 권한을 확인하세요. (repo 권한 필요)");
            } catch (e) { alert("네트워크 오류"); }
            finally { document.getElementById('loading-overlay').style.display = 'none'; }
        }"""

new_save = """// Cloudflare Worker로 저장
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
                } else alert("서버 오류가 발생했습니다.");
            } catch (e) { alert("네트워크 오류"); }
            finally { document.getElementById('loading-overlay').style.display = 'none'; }
        }"""
content = content.replace(old_save, new_save)

# 4. Update submitStockInPlace fetch
old_stock_post = """const response = await fetch(GAS_WEB_APP_URL, {
                    method: "POST",
                    mode: "cors",
                    headers: {
                        "Content-Type": "text/plain;charset=utf-8"
                    },
                    body: JSON.stringify({ action: "saveInventoryData", payload: payload })
                });

                const resText = await response.text();

                // 메모리 즉시 갱신 (Optimistic Update)
                matrix.forEach(m => {
                    if (!allStockMap[curItem.code]) allStockMap[curItem.code] = [];
                    const stockArr = allStockMap[curItem.code];
                    const existing = stockArr.find(x => x.color === m.color && x.size === m.size);
                    if (existing) {
                        existing.qty = Number(existing.qty) + Number(m.qty);
                    } else {
                        stockArr.push({ color: m.color, size: m.size, qty: m.qty });
                    }
                });"""

new_stock_post = """// 메모리 즉시 갱신 (Optimistic Update)
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
                
                // 전체 재고 배열로 평탄화하여 전송
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

                const result = await response.json();"""
content = content.replace(old_stock_post, new_stock_post)

# 5. Remove forceSync entirely or replace it
old_force = """        async function forceSync() {
            if (!confirm("구글 시트의 최신 데이터를 서버로 불러올까요?\\n(반영까지 약 1~2분 정도 소요됩니다.)")) return;

            document.getElementById('loading-overlay').style.display = 'flex';
            try {
                const response = await fetch(GAS_WEB_APP_URL, {
                    method: "POST",
                    mode: "cors",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "forceUpdate" })
                });

                const result = await response.json();

                if (result.error) {
                    alert("동기화 실패:\\n" + result.error);
                } else {
                    await initApp();
                    alert("서버 업데이트가 시작되었습니다.\\n1~2분 뒤에 화면을 다시 새로고침 해주세요.");
                }
            } catch (e) {
                console.error(e);
                alert("네트워크 오류 발생");
            } finally {
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }"""

new_force = """        async function forceSync() {
            if (!confirm("Cloudflare 서버의 최신 데이터를 불러올까요?")) return;
            document.getElementById('loading-overlay').style.display = 'flex';
            try {
                await initApp();
                alert("최신 동기화가 완료되었습니다.");
            } catch (e) {
                console.error(e);
                alert("네트워크 오류 발생");
            } finally {
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }"""
content = content.replace(old_force, new_force)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated index.html successfully.")
