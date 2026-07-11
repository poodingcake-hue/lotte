import asyncio
import re
import sys
import os
import csv
import json
from datetime import datetime, timedelta, timezone
from playwright.async_api import async_playwright

# --- [1] 라이브러리 버전에 따른 호환성 처리 ---
try:
    from playwright_stealth import Stealth
    USE_NEW_STEALTH = True
except ImportError:
    try:
        from playwright_stealth import stealth_async
        USE_NEW_STEALTH = False
    except ImportError:
        USE_NEW_STEALTH = None


# 한국 시간(KST) 기준 오늘 날짜 구하기
def get_kst_today():
    kst = timezone(timedelta(hours=9))
    return datetime.now(kst).strftime("%Y-%m-%d")

# 상품코드 정제 함수 (완벽한 숫자로 변환)
def clean_product_code(code_str):
    if not code_str:
        return "코드없음"
    # 숫자 이외의 모든 문자 제거
    cleaned = re.sub(r'[^0-9]', '', str(code_str))
    try:
        # 숫자로 변환하여 반환 (시트에서 ' 표시가 사라짐)
        return int(cleaned)
    except:
        return "코드없음"



async def scrape_lotte_schedule():
    all_results = []
    today_str = get_kst_today()
    print(f"시스템 알림: 오늘 날짜({today_str}) 기준 7일치 수집 시작 (02:00~05:59 제외)")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        if USE_NEW_STEALTH is True:
            stealth = Stealth()
            await stealth.apply_stealth_async(context)
        
        page = await context.new_page()
        
        if USE_NEW_STEALTH is False:
            await stealth_async(page)

        try:
            await page.goto("https://www.lotteimall.com/main/viewMain.lotte#/main/tvschedule.lotte", 
                            wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_selector("ul.time_list", timeout=30000)
        except Exception as e:
            print(f"로딩 실패: {e}")
            await browser.close()
            return []

        all_tabs = await page.query_selector_all("li.swiper-slide[data-date]")
        start_idx = 0
        for idx, tab in enumerate(all_tabs):
            if await tab.get_attribute("data-date") == today_str:
                start_idx = idx
                break

        for d_offset in range(7):
            target_idx = start_idx + d_offset
            if target_idx >= len(all_tabs): break
            
            current_tabs = await page.query_selector_all("li.swiper-slide[data-date]")
            tab = current_tabs[target_idx]
            date_val = await tab.get_attribute("data-date")
            
            print(f"[{d_offset+1}/7] {date_val} 수집 중...")
            
            try:
                await tab.evaluate("el => el.click()") 
                await asyncio.sleep(4) 
                await page.wait_for_selector("ul.time_list", timeout=20000)
                
                time_list = await page.query_selector_all("ul.time_list > li")
                started_today = False 
                
                for i, li in enumerate(time_list):
                    time_elem = await li.query_selector(".time")
                    if not time_elem: continue
                    time_text = await time_elem.inner_text()
                    time_only = re.findall(r'\d{2}:\d{2}', time_text)[-1] if re.findall(r'\d{2}:\d{2}', time_text) else "00:00"
                    
                    hour = int(time_only.split(':')[0])
                    
                    # 전날 밤 방송 제외 로직
                    if not started_today:
                        if hour >= 12: continue
                        else: started_today = True
                    
                    # 02:00 ~ 05:59 방송 제외 로직
                    if 2 <= hour <= 4:
                        continue
                    
                    broadcast_datetime = f"{date_val} {time_only}"
                    class_attr = await li.get_attribute("class")
                    p_match = re.search(r'time_(\d+)', class_attr)
                    if not p_match: continue
                    program_id = p_match.group(1)
                    
                    program_container = await page.query_selector(f".program_{program_id}")
                    if not program_container: continue
                        
                    main_name_elem = await program_container.query_selector("h3.name")
                    main_name = (await main_name_elem.inner_text()).strip() if main_name_elem else "상품명 없음"
                    
                    noti_btn = await program_container.query_selector("button.noti")
                    main_code = "코드없음"
                    if noti_btn:
                        bdct_class = await noti_btn.get_attribute("data-bdct-classnm")
                        if bdct_class:
                            code_m = re.search(r'(\d{8,})', bdct_class)
                            if code_m: 
                                main_code = clean_product_code(code_m.group(1))
                    
                    # [순서 변경] 상품코드, 방송일시, 상품명
                    all_results.append([main_code, broadcast_datetime, main_name])

                    # 관련 상품 처리
                    related_sections = await program_container.query_selector_all(".related")
                    for section in related_sections:
                        title_elem = await section.query_selector("h4.title")
                        if title_elem and "함께 방송하는 상품" in (await title_elem.inner_text()):
                            more_btn = await section.query_selector("button.more")
                            if more_btn and await more_btn.is_visible():
                                try:
                                    await more_btn.evaluate("el => el.click()")
                                    await asyncio.sleep(2)
                                    modal = await program_container.query_selector(".modal_wrap")
                                    if modal:
                                        items = await modal.query_selector_all(".modal_body .swiper_slide > div")
                                        for item in items:
                                            r_name_e = await item.query_selector(".name")
                                            r_name = (await r_name_e.inner_text()).strip() if r_name_e else "상품명 없음"
                                            img_elem = await item.query_selector("img")
                                            r_code = "코드없음"
                                            if img_elem:
                                                src = await img_elem.get_attribute("data-src") or await img_elem.get_attribute("src")
                                                code_m2 = re.search(r'/(\d{8,})_', src) if src else None
                                                if code_m2: 
                                                    r_code = clean_product_code(code_m2.group(1))
                                            # [순서 변경] 상품코드, 방송일시, 상품명
                                            all_results.append([r_code, broadcast_datetime, r_name])
                                        await (await modal.query_selector("button.close")).evaluate("el => el.click()")
                                except: pass
                            else:
                                rel_lis = await section.query_selector_all("ul.related_list > li")
                                for item in rel_lis:
                                    r_name_e = await item.query_selector(".name")
                                    r_name = (await r_name_e.inner_text()).strip() if r_name_e else "상품명 없음"
                                    img_elem = await item.query_selector("img")
                                    r_code = "코드없음"
                                    if img_elem:
                                        src = await img_elem.get_attribute("data-src") or await img_elem.get_attribute("src")
                                        code_m3 = re.search(r'/(\d{8,})_', src) if src else None
                                        if code_m3: 
                                            r_code = clean_product_code(code_m3.group(1))
                                    # [순서 변경] 상품코드, 방송일시, 상품명
                                    all_results.append([r_code, broadcast_datetime, r_name])
                            break
            except Exception as e:
                print(f"{date_val} 오류: {e}")
                continue

        await browser.close()
        return all_results


def save_to_data_json(scraped_data):
    import json
    data_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'data.json')
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print('data.json not found!')
        return

    # Keep only master items
    items = data.get('items', [])
    master_items = [i for i in items if i.get('isMaster') == True]
    
    # Format scraped data into schedule items
    new_schedules = []
    for row in scraped_data:
        code, dt_str, name = row
        date_key = dt_str.split(' ')[0] # YYYY-MM-DD
        new_schedules.append({
            'code': str(code),
            'image': '',
            'brand': '',
            'name': name,
            'category': '',
            'colors': '',
            'sizes': '',
            'date': dt_str,
            'dateKey': date_key,
            'location': '-',
            'isMaster': False
        })
    
    # Merge
    data['items'] = master_items + new_schedules
    
    with open(data_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f'성공: 총 {len(new_schedules)}개의 편성표를 data.json에 병합했습니다.')

if __name__ == "__main__":
    try:
        scraped_data = asyncio.run(scrape_lotte_schedule())
        if scraped_data:
            save_to_data_json(scraped_data)
        else:
            print('수집 데이터 없음.')
    except Exception as e:
        print(f'치명적 오류: {e}')
