interface WeatherBadgeProps {
  weather: any;
  date: string | null;
  time: string;
}

// 기상청 PTY(강수형태) / SKY(하늘상태) 코드에 대응하는 아이콘
const getWeatherIcon = (sky: number, pty: number) => {
  const base = {
    viewBox: '0 0 24 24',
    fill: 'none',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  // PTY(강수형태)를 먼저 판단
  if (pty === 1 || pty === 4) { // 비 또는 소나기
    return (
      <svg {...base} stroke="#4361ee">
        <path d="M16 13a4 4 0 0 1-8 0" />
        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
        <path d="M8 19v2" />
        <path d="M12 19v2" />
        <path d="M16 19v2" />
      </svg>
    );
  }
  if (pty === 2 || pty === 3) { // 눈 또는 비/눈
    return (
      <svg {...base} stroke="#94A3B8">
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
        <path d="m12 12.01.01-.01" />
      </svg>
    );
  }

  // PTY가 0(없음)이면 SKY(하늘상태)로 판단
  if (sky === 1) { // 맑음
    return (
      <svg {...base} stroke="#FFB800">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="4.22" x2="19.78" y2="5.64" />
      </svg>
    );
  }

  // 구름많음(3) / 흐림(4)
  return (
    <svg {...base} stroke="#94A3B8">
      <path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.3-1.7-4.2-4-4.5-.6-4.1-4.2-7.3-8.5-6.3-2.9.7-5.1 3.1-5.5 6-.1 0-.2 0-.3 0C1.6 9.7 0 11.3 0 13.3c0 2 1.6 3.7 3.7 3.7h13.8" />
    </svg>
  );
};

/**
 * 편성표 시간 옆에 붙는 날씨 뱃지.
 * 날씨 데이터가 없거나 해당 시간대 예보가 없으면 아무것도 렌더링하지 않는다.
 */
const WeatherBadge = ({ weather, date, time }: WeatherBadgeProps) => {
  const hourly = weather?.hourly;
  if (!hourly?.time || !date) return null;

  const match = time.match(/(\d{1,2}):(\d{1,2})/);
  if (!match) return null;

  // 방송 2시간 전 예보를 보여 준다 (기존 동작 유지)
  const hour = Math.max(0, parseInt(match[1], 10) - 2);
  const idx = hourly.time.indexOf(`${date}T${String(hour).padStart(2, '0')}:00`);
  if (idx === -1) return null;

  const sky = hourly.sky?.[idx] !== undefined ? hourly.sky[idx] : 1;
  const pty = hourly.pty?.[idx] !== undefined ? hourly.pty[idx] : 0;
  const pop = hourly.pop?.[idx] !== undefined ? hourly.pop[idx] : 0;
  const temp = hourly.temp?.[idx] !== undefined ? hourly.temp[idx] : null;

  return (
    <div className="weather-badge">
      <span className="weather-icon">{getWeatherIcon(sky, pty)}</span>
      <span>{temp === null ? '-' : `${temp}°`}</span>
      <span className="weather-pop">{pop}%</span>
    </div>
  );
};

export default WeatherBadge;
