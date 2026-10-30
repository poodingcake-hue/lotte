import requests
import json
import os
from datetime import datetime, timedelta
import pytz

# ─── 중기예보 (3~10일 뒤, 하루 단위) ────────────────────────────────
MID_BASE_URL = "http://apis.data.go.kr/1360000/MidFcstInfoService"
MID_LAND_REG_ID = "11B00000"  # 육상예보 구역: 서울·인천·경기
MID_TEMP_REG_ID = "11B10101"  # 기온 예보 구역: 서울 (선유도역 = 영등포구)


def get_mid_tmfc(now):
    """중기예보 발표시각(06시/18시) 중 가장 최근 것을 YYYYMMDDHH00 형식으로 반환."""
    if now.hour >= 19:
        return now.strftime('%Y%m%d') + "1800"
    if now.hour >= 7:
        return now.strftime('%Y%m%d') + "0600"
    return (now - timedelta(days=1)).strftime('%Y%m%d') + "1800"


def fetch_mid(service_key, endpoint, reg_id, tmfc):
    """중기예보 API 한 건 호출. 성공하면 item(dict), 실패하면 None."""
    url = (f"{MID_BASE_URL}/{endpoint}?serviceKey={service_key}"
           f"&pageNo=1&numOfRows=10&dataType=JSON&regId={reg_id}&tmFc={tmfc}")
    try:
        response = requests.get(url, timeout=15)
        if '<' in response.text[:100]:
            print(f"⚠️ 중기예보({endpoint}) 서버 응답 오류: {response.text[:120]}")
            return None
        res = response.json()
        header = res.get('response', {}).get('header', {})
        if header.get('resultCode') != '00':
            print(f"⚠️ 중기예보({endpoint}) API 오류: {header.get('resultMsg', 'Unknown Error')}")
            return None
        return res['response']['body']['items']['item'][0]
    except Exception as e:
        print(f"⚠️ 중기예보({endpoint}) 수집 실패:", e)
        return None


def wf_to_codes(wf):
    """중기예보 날씨 문구 → 단기예보와 같은 (sky, pty) 코드. (sky 1:맑음 3:구름많음 4:흐림 / pty 0:없음 1:비 2:비·눈 3:눈 4:소나기)"""
    wf = wf or ''
    if '비/눈' in wf:
        pty = 2
    elif '소나기' in wf:
        pty = 4
    elif '비' in wf:
        pty = 1
    elif '눈' in wf:
        pty = 3
    else:
        pty = 0
    if '맑' in wf:
        sky = 1
    elif '구름' in wf:
        sky = 3
    else:
        sky = 4
    return sky, pty


def build_daily(land, temp, tmfc):
    """육상예보 + 기온예보를 날짜별 한 줄로 합친다. (오늘+3일 ~ +10일)"""
    base = datetime.strptime(tmfc[:8], '%Y%m%d')
    daily = {"date": [], "tmin": [], "tmax": [], "pop": [], "sky": [], "pty": [], "wf": []}
    for n in range(3, 11):
        tmin, tmax = temp.get(f'taMin{n}'), temp.get(f'taMax{n}')
        if tmin is None or tmax is None:
            continue
        # 3~7일 뒤는 오전/오후, 8~10일 뒤는 하루 한 값
        if n <= 7:
            cands = [(land.get(f'rnSt{n}Am'), land.get(f'wf{n}Am')),
                     (land.get(f'rnSt{n}Pm'), land.get(f'wf{n}Pm'))]
        else:
            cands = [(land.get(f'rnSt{n}'), land.get(f'wf{n}'))]
        cands = [(int(p or 0), w) for p, w in cands if w]
        if not cands:
            continue
        # 강수확률이 높은 쪽을 대표로 쓴다 (같으면 오후)
        pop, wf = max(cands, key=lambda c: c[0])
        if len(cands) == 2 and cands[0][0] == cands[1][0]:
            pop, wf = cands[1]
        sky, pty = wf_to_codes(wf)
        daily["date"].append((base + timedelta(days=n)).strftime('%Y-%m-%d'))
        daily["tmin"].append(int(tmin))
        daily["tmax"].append(int(tmax))
        daily["pop"].append(pop)
        daily["sky"].append(sky)
        daily["pty"].append(pty)
        daily["wf"].append(wf)
    return daily


def get_mid_daily(service_key, now):
    tmfc = get_mid_tmfc(now)
    land = fetch_mid(service_key, 'getMidLandFcst', MID_LAND_REG_ID, tmfc)
    temp = fetch_mid(service_key, 'getMidTa', MID_TEMP_REG_ID, tmfc)
    if not land or not temp:
        return None
    daily = build_daily(land, temp, tmfc)
    return daily if daily["date"] else None


def get_kma_weather():
    # 기상청 API 설정 (선유도역 nx: 58, ny: 126)
    BASE_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
    SERVICE_KEY = "6f0a035ffe368377d1db54a7f55dbe3b1b338d4f10aebb7fcb33500c6ea82d8e"
    
    # 한국 시간 기준 현재 시간 계산
    kst = pytz.timezone('Asia/Seoul')
    now = datetime.now(kst)
    
    # 기상청 단기예보는 0210, 0510, 0810, 1110, 1410, 1710, 2010, 2310에 업데이트됩니다.
    # 안전하게 가장 최근 발표 시간을 계산합니다.
    base_times = [2, 5, 8, 11, 14, 17, 20, 23]
    cur_hour = now.hour
    
    # 현재 시간보다 이전의 가장 최근 발표 시간 찾기
    found_time = None
    for bt in reversed(base_times):
        if cur_hour > bt or (cur_hour == bt and now.minute >= 15):
            found_time = bt
            break
            
    if found_time is None: # 02시 이전이면 어제 23시 데이터 사용
        search_date = (now - timedelta(days=1)).strftime('%Y%m%d')
        search_time = "2300"
    else:
        search_date = now.strftime('%Y%m%d')
        search_time = f"{found_time:02d}00"

    params = {
        'pageNo': '1',
        'numOfRows': '1000',
        'dataType': 'JSON',
        'base_date': search_date,
        'base_time': search_time,
        'nx': '58',
        'ny': '126'
    }

    # requests의 params로 넘기면 서비스키가 인코딩되면서 거절당하는 경우가 많아, URL에 직접 붙여서 전달합니다.
    full_url = f"{BASE_URL}?serviceKey={SERVICE_KEY}"
    for k, v in params.items():
        full_url += f"&{k}={v}"

    try:
        response = requests.get(full_url, timeout=15)
        
        # 기상청 서버가 아직 키를 인식하지 못했을 경우 (동기화 대기 중)
        if response.status_code == 401:
            print("⏳ 기상청 API 키 동기화 대기 중입니다. (약 1시간 소요)")
            return None
            
        if '<' in response.text[:100]:
            print("⚠️ 서버 응답 오류가 발생했습니다. (잠시 후 다시 시도)")
            return None

        res_data = response.json()
        
        if 'response' not in res_data or res_data['response']['header']['resultCode'] != '00':
            msg = res_data.get('response', {}).get('header', {}).get('resultMsg', 'Unknown Error')
            print(f"⚠️ KMA API Error: {msg}")
            return None

        items = res_data['response']['body']['items']['item']
        
        # 데이터를 시간별로 재구성
        weather_map = {}
        for item in items:
            dt = f"{item['fcstDate'][:4]}-{item['fcstDate'][4:6]}-{item['fcstDate'][6:8]}T{item['fcstTime'][:2]}:00"
            if dt not in weather_map:
                weather_map[dt] = {}
            
            category = item['category']
            val = item['fcstValue']
            
            if category == 'TMP': weather_map[dt]['temp'] = int(val)
            if category == 'POP': weather_map[dt]['pop'] = int(val)
            if category == 'SKY': weather_map[dt]['sky'] = int(val) # 1:맑음, 3:흐림, 4:구름많음
            if category == 'PTY': weather_map[dt]['pty'] = int(val) # 0:없음, 1:비, 2:비/눈, 3:눈, 4:소나기

        # 최종 JSON 형식으로 변환
        final_data = {"hourly": {"time": [], "temp": [], "pop": [], "sky": [], "pty": []}}
        for time_key in sorted(weather_map.keys()):
            data = weather_map[time_key]
            if all(k in data for k in ['temp', 'pop', 'sky', 'pty']):
                final_data['hourly']['time'].append(time_key)
                final_data['hourly']['temp'].append(data['temp'])
                final_data['hourly']['pop'].append(data['pop'])
                final_data['hourly']['sky'].append(data['sky'])
                final_data['hourly']['pty'].append(data['pty'])

        weather_path = os.path.join(os.path.dirname(__file__), 'frontend', 'public', 'weather.json')

        # 중기예보(3~10일 뒤). 이번에 못 가져오면 직전 weather.json의 값을 그대로 유지한다.
        daily = get_mid_daily(SERVICE_KEY, now)
        if daily is None:
            try:
                with open(weather_path, 'r', encoding='utf-8') as f:
                    daily = json.load(f).get('daily')
            except Exception:
                daily = None
            print("ℹ️ 중기예보를 갱신하지 못해 기존 값을 유지합니다." if daily else "ℹ️ 중기예보 없음 (단기예보만 저장)")
        if daily:
            final_data['daily'] = daily

        with open(weather_path, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
            print("Successfully updated weather.json")

    except Exception as e:
        print("Error fetching weather:", e)

if __name__ == "__main__":
    get_kma_weather()
