import requests
import json
from datetime import datetime, timedelta
import pytz

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
        'serviceKey': SERVICE_KEY,
        'pageNo': '1',
        'numOfRows': '1000',
        'dataType': 'JSON',
        'base_date': search_date,
        'base_time': search_time,
        'nx': '58',
        'ny': '126'
    }

    try:
        response = requests.get(BASE_URL, params=params)
        res_data = response.json()
        
        if res_data['response']['header']['resultCode'] != '00':
            print("KMA API Error:", res_data['response']['header']['resultMsg'])
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

        with open('weather.json', 'w', encoding='utf-8') as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
            print("Successfully updated weather.json")

    except Exception as e:
        print("Error fetching weather:", e)

if __name__ == "__main__":
    get_kma_weather()
