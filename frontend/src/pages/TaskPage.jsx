import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getProductImage } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const parseTimeFromDateString = (dateStr) => {
  // e.g. "2026-07-02 01:00" -> "01:00"
  const parts = dateStr.split(' ');
  return parts.length > 1 ? parts[1] : null;
};

const TaskPage = () => {
  const { allItems, allStockMap } = useAppStore();
  const navigate = useNavigate();

  const masterCodes = useMemo(() => {
    const s = new Set(allItems.filter(i => i.isMaster).map(i => String(i.code)));
    Object.keys(allStockMap || {}).forEach(k => s.add(String(k)));
    return s;
  }, [allItems, allStockMap]);

  const isOurProduct = useCallback((code) => masterCodes.has(String(code)), [masterCodes]);

  // All schedule slots that are for our products
  const ourSlots = useMemo(() => {
    const s = new Set();
    allItems.forEach(i => {
      if (!i.isMaster && i.date && isOurProduct(i.code)) {
        s.add(i.date.trim());
      }
    });
    return s;
  }, [allItems, isOurProduct]);

  // Unique dates
  const uniqueDates = useMemo(() => {
    const dSet = new Set();
    ourSlots.forEach(slot => { const d = slot.split(' ')[0]; if (d) dSet.add(d); });
    return Array.from(dSet).sort();
  }, [ourSlots]);

  const [currentDate, setCurrentDate] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);
  const [hostsInput, setHostsInput] = useState('호스트1, 호스트2');
  const [sectionsCount, setSectionsCount] = useState(2);
  const [sectionsMap, setSectionsMap] = useState({}); // { "YYYY-MM-DD HH:MM": [{id, rows: []}] }
  const [dragItem, setDragItem] = useState(null);
  const [dragOverSection, setDragOverSection] = useState(null);

  const currentSlotKey = `${currentDate} ${currentTime}`;
  const sections = sectionsMap[currentSlotKey] || [];

  // Set default date
  useEffect(() => {
    if (uniqueDates.length > 0 && !currentDate) {
      const today = new Date().toISOString().split('T')[0];
      setCurrentDate(uniqueDates.includes(today) ? today : uniqueDates[0]);
    }
  }, [uniqueDates, currentDate]);

  // Unique times for current date
  const uniqueTimes = useMemo(() => {
    if (!currentDate) return [];
    const tSet = new Set();
    ourSlots.forEach(slot => {
      if (slot.startsWith(currentDate)) {
        const t = parseTimeFromDateString(slot);
        if (t) tSet.add(t);
      }
    });
    return Array.from(tSet).sort();
  }, [ourSlots, currentDate]);

  // Set default time
  useEffect(() => {
    if (uniqueTimes.length > 0 && (!currentTime || !uniqueTimes.includes(currentTime))) {
      setCurrentTime(uniqueTimes[0]);
    }
  }, [uniqueTimes, currentTime]);

  // Products for current date+time slot
  const slotItems = useMemo(() => {
    if (!currentDate || !currentTime) return [];
    return allItems.filter(i => !i.isMaster && i.date && i.date.trim() === currentSlotKey && isOurProduct(i.code));
  }, [allItems, currentDate, currentTime, isOurProduct, currentSlotKey]);

  const hosts = useMemo(() => {
    const arr = hostsInput.split(',').map(s => s.trim()).filter(Boolean);
    return [arr[0] || '호스트1', arr[1] || '호스트2'];
  }, [hostsInput]);

  const columns = useMemo(() => [
    { key: 'product', name: '상품', width: '300px' },
    { key: 'main', name: '메인', width: '75px' },
    { key: 'hanger', name: '행거', width: '75px' },
    { key: 'h1_hand', name: `${hosts[0]} 핸들링`, width: '75px' },
    { key: 'h2_hand', name: `${hosts[1]} 핸들링`, width: '75px' },
    { key: 'h1_wear', name: `${hosts[0]} 착장`, width: '75px' },
    { key: 'h2_wear', name: `${hosts[1]} 착장`, width: '75px' },
  ], [hosts]);

  const updateCurrentSections = (updater) => {
    if (!currentDate || !currentTime) return;
    setSectionsMap(prev => ({
      ...prev,
      [currentSlotKey]: updater(prev[currentSlotKey] || [])
    }));
  };

  const handleGenerateSections = () => {
    if (!currentDate || !currentTime) return;
    const count = Math.max(1, Math.min(10, Number(sectionsCount)));
    const newSections = Array.from({ length: count }, (_, i) => ({ id: i + 1, rows: [] }));
    updateCurrentSections(() => newSections);
  };

  const handleDragStart = (e, item) => {
    setDragItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverSection(null);
  };

  const handleDrop = (e, sectionId) => {
    e.preventDefault();
    if (!dragItem) return;
    
    // Check if the dragged item belongs to the current selected slot
    // Though practically impossible with our UI unless they somehow change the slot while dragging
    if (dragItem.date && dragItem.date.trim() !== currentSlotKey) {
        alert("선택된 방송 날짜와 시간의 상품만 해당 구간에 등록할 수 있습니다.");
        setDragOverSection(null);
        return;
    }

    updateCurrentSections(prev => prev.map(sec => {
      if (sec.id !== sectionId) return sec;
      // Don't add duplicate
      if (sec.rows.find(r => r.code === dragItem.code)) return sec;
      return { ...sec, rows: [...sec.rows, { ...dragItem, cells: {} }] };
    }));
    setDragOverSection(null);
  };

  const handleCellChange = (sectionId, rowCode, colKey, value) => {
    updateCurrentSections(prev => prev.map(sec => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        rows: sec.rows.map(row => {
          if (row.code !== rowCode) return row;
          return { ...row, cells: { ...(row.cells || {}), [colKey]: value } };
        })
      };
    }));
  };

  const handleRemoveRow = (sectionId, rowCode) => {
    updateCurrentSections(prev => prev.map(sec => {
      if (sec.id !== sectionId) return sec;
      return { ...sec, rows: sec.rows.filter(r => r.code !== rowCode) };
    }));
  };

  const handlePrint = () => window.print();

  // Get master item for a schedule entry
  const getMasterItem = useCallback((code) => {
    return allItems.find(i => i.isMaster && String(i.code) === String(code));
  }, [allItems]);

  return (
    <section className="page-section active" id="page-task">
      <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - var(--nav-height) - 40px)', minHeight: '540px' }}>

        {/* ===== LEFT PANEL ===== */}
        <div style={{ width: '310px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>

          {/* 일정 선택 */}
          <div className="dash-card" style={{ padding: '14px', flexShrink: 0 }}>
            <div className="dash-title" style={{ marginBottom: '12px', fontSize: '14px' }}>일정 선택</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* 날짜 스크롤러 */}
              <div id="taskDateScroller" style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '4px' }}>
                {uniqueDates.length === 0
                  ? <div style={{ padding: '20px', textAlign: 'center', color: '#999', width: '100%' }}>우리 상품이 편성된 일정이 없습니다.</div>
                  : uniqueDates.map(d => {
                    const parts = d.split('-');
                    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    return (
                      <button
                        key={d}
                        className={`date-btn ${d === currentDate ? 'active' : ''}`}
                        style={{ height: '54px', minWidth: '58px', flexDirection: 'column', gap: '2px' }}
                        onClick={() => { setCurrentDate(d); setCurrentTime(null); }}
                      >
                        <span style={{ fontSize: '12px', opacity: 0.8 }}>{parseInt(parts[1])}.{parseInt(parts[2])}</span>
                        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{DOW[dateObj.getDay()]}</span>
                      </button>
                    );
                  })
                }
              </div>

              {/* 시간 스크롤러 */}
              <div id="taskTimeScroller" style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '4px' }}>
                {uniqueTimes.length === 0
                  ? <div style={{ padding: '10px', color: '#999', fontSize: '13px', textAlign: 'center', width: '100%' }}>해당 날짜에 우리 상품이 편성된 시간이 없습니다.</div>
                  : uniqueTimes.map(t => (
                    <button
                      key={t}
                      className={`date-btn ${t === currentTime ? 'active' : ''}`}
                      style={{ height: '40px', minWidth: '70px', borderRadius: '20px' }}
                      onClick={() => setCurrentTime(t)}
                    >
                      {t}
                    </button>
                  ))
                }
              </div>
            </div>
          </div>

          {/* 방송 설정 */}
          <div className="dash-card" style={{ padding: '16px', flexShrink: 0 }}>
            <div className="dash-title" style={{ marginBottom: '14px', fontSize: '14px' }}>방송 설정</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                id="taskHosts"
                placeholder="호스트명 (쉼표로 구분)"
                value={hostsInput}
                onChange={e => setHostsInput(e.target.value)}
                style={{ flex: 1, padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', fontWeight: '700', boxSizing: 'border-box', outline: 'none', minWidth: '0' }}
              />
              <input
                type="number"
                id="taskSectionsCount"
                value={sectionsCount}
                min="1" max="10"
                onChange={e => setSectionsCount(e.target.value)}
                style={{ width: '45px', padding: '9px 4px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', fontWeight: '800', textAlign: 'center', outline: 'none' }}
              />
              <span style={{ fontSize: '13px', color: '#888', fontWeight: '700', whiteSpace: 'nowrap' }}>구간</span>
              <button
                onClick={handleGenerateSections}
                style={{ padding: '9px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                적용
              </button>
            </div>
          </div>

          {/* 상품 풀 */}
          <div className="dash-card" style={{ padding: '14px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div className="dash-title" style={{ marginBottom: '12px', flexShrink: 0, fontSize: '14px' }}>상품 풀</div>
            <div id="taskContainer" style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {slotItems.length === 0
                ? <div style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                    {!currentDate || !currentTime ? '날짜와 시간을 선택해주세요.' : '해당 시간대에 등록된 우리 상품이 없습니다.'}
                  </div>
                : slotItems.map(schedItem => {
                  const master = getMasterItem(schedItem.code);
                  const displayItem = master || schedItem;
                  return (
                    <div
                      key={`${schedItem.code}-${schedItem.date}`}
                      draggable
                      onDragStart={e => handleDragStart(e, { ...schedItem, brand: displayItem.brand, name: displayItem.name, image: displayItem.image })}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/detail/${schedItem.code}`)}
                      style={{ display: 'flex', gap: '10px', padding: '8px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'grab', alignItems: 'center' }}
                    >
                      <img
                        src={getProductImage(displayItem) || 'https://via.placeholder.com/50'}
                        alt={displayItem.name}
                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '800' }}>{displayItem.brand}</div>
                        <div style={{ fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayItem.name}</div>
                        <div style={{ fontSize: '11px', color: '#999' }}>{schedItem.code}</div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>

        {/* ===== RIGHT PANEL: Section Matrix ===== */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <div id="taskSectionsArea" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {sections.length === 0 && (
              <div style={{ textAlign: 'center', color: '#999', padding: '60px 0', fontSize: '14px' }}>
                좌측의 "방송 설정"에서 구간 수를 설정하고 "적용" 버튼을 눌러주세요.
              </div>
            )}
            {sections.map(sec => (
              <div
                key={sec.id}
                style={{ background: '#fff', border: `1px solid ${dragOverSection === sec.id ? 'var(--primary)' : '#e5e7eb'}`, borderRadius: '8px', padding: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '20px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#111', borderBottom: '2px solid var(--primary)', paddingBottom: '5px' }}>구간 {sec.id}</h4>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                    {columns.map(col => (
                      <div key={col.key} style={{ width: col.key === 'product' ? col.width : undefined, minWidth: col.width, flex: col.key === 'product' ? undefined : 1, padding: '10px', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', textAlign: 'center', background: '#f3f4f6', borderLeft: col.key !== 'product' ? '1px solid #e5e7eb' : undefined }}>
                        {col.name}
                      </div>
                    ))}
                  </div>

                  {/* Drop zone */}
                  <div
                    id={`section-${sec.id}-rows`}
                    onDragOver={e => { e.preventDefault(); setDragOverSection(sec.id); }}
                    onDragLeave={() => setDragOverSection(null)}
                    onDrop={e => handleDrop(e, sec.id)}
                    style={{ display: 'flex', flexDirection: 'column', background: dragOverSection === sec.id ? '#eef2ff' : '#f9fafb', minHeight: '80px', position: 'relative', transition: 'background 0.2s', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px' }}
                  >
                    {sec.rows.length === 0 && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#6b7280', fontSize: '13px', fontWeight: '500', pointerEvents: 'none' }}>
                        이곳에 상품을 드래그하여 상품 추가
                      </div>
                    )}
                    {sec.rows.map((row, rowIdx) => {
                      const master = getMasterItem(row.code);
                      const displayItem = master || row;
                      return (
                        <div key={`${row.code}-${rowIdx}`} style={{ display: 'flex', borderBottom: '1px solid #eee', background: '#fff' }}>
                          {/* Product cell */}
                          <div style={{ width: '300px', minWidth: '300px', padding: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button onClick={() => handleRemoveRow(sec.id, row.code)} style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: '16px', padding: '0 4px', flexShrink: 0 }}>×</button>
                            <img src={getProductImage(displayItem) || 'https://via.placeholder.com/40'} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '800' }}>{displayItem.brand}</div>
                              <div style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayItem.name}</div>
                            </div>
                          </div>
                          {/* Data cells */}
                          {columns.slice(1).map(col => (
                            <div key={col.key} style={{ flex: 1, minWidth: col.width, borderLeft: '1px solid #e5e7eb', padding: '4px' }}>
                              <input
                                type="text"
                                value={(row.cells || {})[col.key] || ''}
                                onChange={e => handleCellChange(sec.id, row.code, col.key, e.target.value)}
                                style={{ width: '100%', height: '100%', border: 'none', outline: 'none', textAlign: 'center', fontSize: '12px', background: 'transparent', fontWeight: '700' }}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {sections.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', marginBottom: '30px' }}>
                <button onClick={handlePrint} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', color: '#4b5563' }}>
                  인쇄 / PDF 저장
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TaskPage;
