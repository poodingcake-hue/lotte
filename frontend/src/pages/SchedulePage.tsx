import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getProductImage } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';

const parseTime = (timeStr: any) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{1,2})/);
  if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
  return 0;
};

const SchedulePage = () => {
  const { allItems, allStockMap, selDate, setSelDate, initApp, isLoading, allSupplies } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (allItems.length === 0 && !isLoading) {
      initApp();
    }
  }, [allItems, isLoading, initApp]);

  const dates = useMemo(() => {
    const masterCodes = new Set(allItems.filter(i => i.isMaster).map(i => String(i.code)));
    if (allStockMap) {
      Object.keys(allStockMap).forEach(code => masterCodes.add(String(code)));
    }

    const dSet = new Set<string>();
    const today = new Date();
    // Use local YYYY-MM-DD
    const todayKst = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    allItems.forEach(i => {
      if (!i.isMaster && i.dateKey && i.dateKey >= todayKst && masterCodes.has(String(i.code))) {
        dSet.add(i.dateKey);
      }
    });
    
    return Array.from(dSet).sort();
  }, [allItems, allStockMap]);

  useEffect(() => {
    if (!selDate && dates.length > 0) {
      setSelDate(dates[0]);
    }
  }, [dates, selDate, setSelDate]);

  const scheduleGroups = useMemo(() => {
    if (!selDate) return {};
    
    const masterCodes = new Set(allItems.filter(i => i.isMaster).map(i => String(i.code)));
    if (allStockMap) {
      Object.keys(allStockMap).forEach(code => masterCodes.add(String(code)));
    }

    const filtered = allItems
      .filter(i => !i.isMaster && i.dateKey === selDate && masterCodes.has(String(i.code)))
      .sort((a, b) => parseTime(a.date) - parseTime(b.date));

    const groups: Record<string, any[]> = {};
    filtered.forEach(item => {
      const tmMatch = item.date ? item.date.match(/(\d{1,2}:\d{1,2})/) : null;
      const key = tmMatch ? tmMatch[1] : "시간미상";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return groups;
  }, [allItems, allStockMap, selDate]);

  const sortedTimes = Object.keys(scheduleGroups).sort((a, b) => parseTime(a) - parseTime(b));

  if (isLoading) {
    return <div id="loading-overlay" style={{ display: 'flex' }}><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></div>;
  }

  const handleCardClick = (item: any) => {
    navigate(`/detail/${item.code}`);
  };

  const getDisplayItem = (item: any) => {
    if (!item.isMaster) {
      const master = allItems.find(m => m.isMaster && String(m.code) === String(item.code));
      if (master) {
        return {
          ...item,
          brand: master.brand || item.brand,
          name: master.name || item.name,
          image: master.image || item.image
        };
      }
    }
    return item;
  };

  return (
    <section className="page-section active" id="page-schedule">
      <div id="dateScroller" className="date-scroller">
        {dates.map(d => {
          const parsed = new Date(d);
          const days = ['일', '월', '화', '수', '목', '금', '토'];
          const dayName = isNaN(parsed.getDay()) ? '' : days[parsed.getDay()];
          const dateNum = isNaN(parsed.getDate()) ? d : parsed.getDate();
          
          return (
            <button 
              key={d} 
              className={`date-btn ${d === selDate ? 'active' : ''}`}
              onClick={() => setSelDate(d)}
            >
              {dayName}<br />{dateNum}
            </button>
          );
        })}
      </div>

      <div id="scheduleContainer">
        {sortedTimes.length === 0 ? (
          <p style={{ padding: '20px' }}>해당 날짜에 편성된 일정이 없습니다.</p>
        ) : (
          sortedTimes.map(time => (
            <div key={time}>
              <div className="time-divider">
                <span>{time} 방송</span>
              </div>
              <div className="product-grid">
                {(scheduleGroups[time] || []).map((rawItem: any) => {
                  const displayItem = getDisplayItem(rawItem);
                  const supplyObj = allSupplies?.find(s => String(s.code) === String(displayItem.code));
                  const overlay = (supplyObj && supplyObj.text) ? <div className="supplies-overlay">{supplyObj.text}</div> : null;
                  
                  return (
                    <div key={rawItem.code} className="p-card" onClick={() => handleCardClick(rawItem)}>
                      <div className="p-img-box">
                        <img src={getProductImage(displayItem) || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f8f9fa"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23adb5bd">No Image</text></svg>'} className="p-img" alt={displayItem.name} />
                        {overlay}
                      </div>
                      <div className="p-info">
                        <div className="p-brand">{displayItem.brand || ''}</div>
                        <div className="p-name">{displayItem.name || ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default SchedulePage;
