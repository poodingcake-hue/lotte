import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { getProductImage } from '../utils/helpers';
import OutfitModal from '../components/modals/OutfitModal';

const isSameRental = (a, b) => {
  if (!a || !b) return false;
  if (a.id !== undefined && a.id !== null && b.id !== undefined && b.id !== null) {
    return String(a.id) === String(b.id);
  }
  return String(a.code) == String(b.code) &&
         String(a.renter || '') == String(b.renter || '') &&
         String(a.color || '') == String(b.color || '') &&
         String(a.size || '') == String(b.size || '') &&
         String(a.date || '') == String(b.date || '');
};

const DetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    allItems, allStockMap, allSupplies, allNotes,
    allRentals, allOutfits,
    saveToGitHub,
    setAllRentals, setAllOutfits, setAllNotes, setAllSupplies, setAllStockMap,
    apiClient, setIsLoading, isLoading,
  } = useAppStore();

  // ─── 상품 정보 ───────────────────────────────────────────────
  const item = useMemo(() => {
    const found = allItems.find(i => String(i.code) === String(id));
    if (!found) return null;
    if (!found.isMaster) {
      const master = allItems.find(m => m.isMaster && String(m.code) === String(found.code));
      if (master) return { ...found, brand: master.brand || found.brand, name: master.name || found.name, image: master.image || found.image };
    }
    return found;
  }, [allItems, id]);

  const stockMap = useMemo(() => allStockMap[id] || [], [allStockMap, id]);

  const { sizes, colors } = useMemo(() => {
    const sList = [], cList = [];
    stockMap.forEach(s => {
      if (s.size && !sList.includes(s.size)) sList.push(s.size);
      if (s.color && !cList.includes(s.color)) cList.push(s.color);
    });
    return { sizes: sList, colors: cList };
  }, [stockMap]);

  // ─── 컬러별 이미지 파싱 ──────────────────────────────────────
  const colorImages = useMemo(() => {
    if (!item?.image) return {};
    try { return JSON.parse(item.image); } catch { return {}; }
  }, [item]);

  const toThumb = (url) => {
    return url;
  };

  // ─── 관련 데이터 ─────────────────────────────────────────────
  const supplyObj  = useMemo(() => allSupplies?.find(s => String(s.code) === String(id)), [allSupplies, id]);
  const noteObj    = useMemo(() => allNotes?.find(n => String(n.code) === String(id)),    [allNotes,    id]);
  const itemOutfits = useMemo(() => allOutfits?.filter(o => String(o.code) === String(id)) || [], [allOutfits, id]);
  const itemRentals = useMemo(() => allRentals?.filter(r => String(r.code) === String(id)) || [], [allRentals, id]);

  // ─── Local state ─────────────────────────────────────────────
  const [supplyText, setSupplyText] = useState('');
  const [noteText,   setNoteText]   = useState('');
  useEffect(() => setSupplyText(supplyObj?.text || ''), [supplyObj]);
  useEffect(() => setNoteText(noteObj?.text || ''),     [noteObj]);

  // 대여 바구니
  const [cart,    setCart]    = useState([]);
  const [renter,  setRenter]  = useState('');
  // 대여 반납 체크박스
  const [checked, setChecked] = useState([]);
  // 재고 수정 모드
  const [editMode, setEditMode]     = useState(false);
  const [stockEdits, setStockEdits] = useState({});
  const [newSizeName, setNewSizeName] = useState('');
  // 착장 모달
  const [outfitOpen, setOutfitOpen] = useState(false);
  // 커스텀 확인 모달 상태
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    message: '',
    onConfirm: null
  });
  // 선택된 컬러 이미지 (메인 교체용)
  const [activeImg, setActiveImg] = useState(null);

  // ─── 재고 숫자 클릭 → 바구니 ─────────────────────────────────
  const addToCart = useCallback((color, size) => {
    setCart(prev => {
      const ex = prev.find(x => x.color === color && x.size === size);
      if (ex) return prev.map(x => x.color === color && x.size === size ? { ...x, qty: x.qty + 1 } : x);
      return [...prev, { color, size, qty: 1 }];
    });
  }, []);

  // ─── 저장 함수들 ─────────────────────────────────────────────
  const handleSaveNote = async () => {
    const newNotes = [...(allNotes || [])];
    const idx = newNotes.findIndex(n => String(n.code) === String(id));
    if (idx > -1) { if (noteText) newNotes[idx] = { ...newNotes[idx], text: noteText }; else newNotes.splice(idx, 1); }
    else if (noteText) newNotes.push({ code: String(id), text: noteText });
    setAllNotes(newNotes);
    await saveToGitHub('notes.json', newNotes);
    alert('특이사항이 저장되었습니다.');
  };

  const handleSaveSupply = async () => {
    const newSup = [...(allSupplies || [])];
    const idx = newSup.findIndex(s => String(s.code) === String(id));
    if (idx > -1) { if (supplyText) newSup[idx] = { ...newSup[idx], text: supplyText }; else newSup.splice(idx, 1); }
    else if (supplyText) newSup.push({ code: String(id), text: supplyText });
    setAllSupplies(newSup);
    await saveToGitHub('supplies.json', newSup);
    alert('준비물이 저장되었습니다.');
  };

  const handleDeleteOutfit = (host) => {
    setConfirmModal({
      isOpen: true,
      message: `${host} 님의 착장 정보를 삭제하시겠습니까?`,
      onConfirm: async () => {
        const next = (allOutfits || []).filter(o => !(String(o.code) === String(id) && o.host === host));
        setAllOutfits(next);
        await saveToGitHub('outfits.json', next);
      }
    });
  };

  const handleDeleteRental = (r) => {
    setConfirmModal({
      isOpen: true,
      message: `${r.renter} 님의 대여 내역 (${r.color} / ${r.size})을 삭제하시겠습니까?`,
      onConfirm: async () => {
        try {
          const next = (allRentals || []).filter(x => !isSameRental(x, r));
          setAllRentals(next);
          await saveToGitHub('rentals.json', next);
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleReturnRentals = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setConfirmModal({
      isOpen: true,
      message: `선택한 ${checked.length}개의 대여 항목을 반납 처리하시겠습니까?`,
      onConfirm: async () => {
        try {
          let next = [...(allRentals || [])];
          const newLogs = [];
          const timestamp = new Date().toISOString();
          
          checked.forEach(r => {
            next = next.filter(x => !isSameRental(x, r));
            newLogs.push({
              code: r.code, color: r.color, size: r.size,
              type: 'IN', qty: Number(r.qty || 1), date: timestamp,
              actor: r.renter, note: '대여 반납'
            });
          });
          setAllRentals(next);
          setChecked([]);
          await saveToGitHub('rentals.json', next);
          if (newLogs.length > 0) {
            await useAppStore.getState().saveHistoryToBackend(newLogs);
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleSubmitRental = async () => {
    if (!renter.trim()) { alert('대여자 성함을 입력해주세요.'); return; }
    if (cart.length === 0) return;
    try {
      const next = [...(allRentals || [])];
      const newLogs = [];
      const timestamp = new Date().toISOString();
      
      cart.forEach(c => {
        next.push({ code: String(id), renter: renter.trim(), color: c.color, size: c.size, qty: c.qty, date: timestamp });
        newLogs.push({
          code: String(id), color: c.color, size: c.size,
          type: 'OUT', qty: -Number(c.qty || 1), date: timestamp,
          actor: renter.trim(), note: '방송 대여(반출)'
        });
      });
      
      setAllRentals(next);
      await saveToGitHub('rentals.json', next);
      if (newLogs.length > 0) {
        await useAppStore.getState().saveHistoryToBackend(newLogs);
      }
      setCart([]);
      setRenter('');
      alert('대여 등록이 완료되었습니다.');
    } catch (err) {
      console.error(err);
      alert('대여 등록 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleAddOutfits = async (entries) => {
    const next = [...(allOutfits || [])];
    entries.forEach(({ host, size }) => { if (host && size) next.push({ code: String(id), host, size }); });
    setAllOutfits(next); await saveToGitHub('outfits.json', next);
  };

  const handleSubmitStock = async () => {
    const matrix = [];
    Object.entries(stockEdits).forEach(([key, qty]) => {
      const [color, size] = key.split('||');
      const actualSize = size === '__new__' ? newSizeName : size;
      if (qty && actualSize) matrix.push({ color, size: actualSize, qty: Number(qty) });
    });
    if (matrix.length === 0) { alert('입력된 수량이 없습니다.'); return; }
    setIsLoading(true);
    try {
      const newMap = { ...allStockMap };
      if (!newMap[id]) newMap[id] = [];
      
      const newLogs = [];
      const timestamp = new Date().toISOString();
      
      matrix.forEach(m => {
        const ex = newMap[id].find(x => x.color === m.color && x.size === m.size);
        if (ex) ex.qty = Number(ex.qty) + Number(m.qty);
        else newMap[id].push({ color: m.color, size: m.size, qty: m.qty });
        
        newLogs.push({
          code: String(id), color: m.color, size: m.size,
          type: 'ADJUST', qty: Number(m.qty), date: timestamp,
          actor: '관리자', note: '재고 추가/조정 (수기입력)'
        });
      });
      setAllStockMap(newMap);
      const flat = [];
      Object.keys(newMap).forEach(code => newMap[code].forEach(s => flat.push({ code, ...s })));
      await apiClient.post('?action=save_inventory', { type: 'save_inventory', data: flat });
      
      if (newLogs.length > 0) {
        await useAppStore.getState().saveHistoryToBackend(newLogs);
      }
      
      alert('입고 저장이 완료되었습니다.');
      setEditMode(false); setStockEdits({}); setNewSizeName('');
    } catch (e) { alert('오류가 발생했습니다.'); }
    finally { setIsLoading(false); }
  };

  const handleDownloadExcel = () => {
    if (!window.XLSX) { alert('Excel 라이브러리가 로드되지 않았습니다.'); return; }
    if (stockMap.length === 0) { alert('재고 데이터가 없습니다.'); return; }
    const colorOrder = [];
    stockMap.forEach(s => { if (s.color && !colorOrder.includes(s.color)) colorOrder.push(s.color); });
    const data = stockMap.filter(s => s.color && s.size).map(s => {
      const rented = itemRentals.filter(r => r.color === s.color && r.size === s.size).reduce((a, b) => a + Number(b.qty), 0);
      return { '상품코드': id, '상품명': item ? `${item.brand} ${item.name}` : id, '색상': s.color, '사이즈': s.size, '현재재고': Number(s.qty) - rented };
    }).sort((a, b) => colorOrder.indexOf(a['색상']) - colorOrder.indexOf(b['색상']));
    const wb = (window as any).XLSX.utils.book_new();
    const ws = (window as any).XLSX.utils.json_to_sheet(data);
    (window as any).XLSX.utils.book_append_sheet(wb, ws, '재고현황');
    (window as any).XLSX.writeFile(wb, `[${item?.brand}] ${item?.name}(${id}).xlsx`);
  };

  // ─── 메인 이미지 URL ─────────────────────────────────────────
  const mainImgUrl = activeImg || getProductImage(item) || '';

  if (isLoading) {
    return (
      <div id="loading-overlay" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="spinner"></div>
        <div className="mt-2 fw-bold small">LOTTE PB 데이터 동기화</div>
      </div>
    );
  }

  if (!item) return (
    <section className="page-section active">
      <div style={{ padding: '20px' }}>
        <button className="m-btn m-btn-cancel" style={{ width: 'auto', padding: '8px 16px', fontSize: '14px' }} onClick={() => navigate(-1)}>← 뒤로</button>
        <p style={{ marginTop: '16px', color: '#999' }}>상품 정보를 불러오는 중...</p>
      </div>
    </section>
  );

  return (
    <section id="page-detail" className="page-section active">
      <div className="dash-layout">

        {/* ============================================================
            LEFT: 이미지 + 특이사항
        ============================================================ */}
        <div className="dash-left">
          {/* 뒤로 가기 */}
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '800', fontSize: '13px', cursor: 'pointer', marginBottom: '8px', padding: '0' }}
          >
            ← 뒤로
          </button>

          <div className="integrated-section">
            {/* 상품명 + 코드 + 버튼 */}
            <div className="img-header-overlay">
              <h1 className="det-product-name" id="det-name">{item.brand} {item.name}</h1>
              <div className="det-sub-info">
                <span id="det-code" className="badge-item badge-code">{item.code}</span>
                <span id="det-loc" className="badge-item badge-loc">{item.location || '-'}</span>
                <button className="btn-excel" onClick={handleDownloadExcel}>
                  <span className="material-icons-round" style={{ fontSize: '14px' }}>description</span>
                  Excel
                </button>
              </div>
            </div>

            {/* 메인 이미지 */}
            <div className="img-container">
              <img
                id="det-img"
                src={mainImgUrl || 'https://via.placeholder.com/400'}
                alt="상품이미지"
                className="det-main-img"
                onClick={() => window.open(`https://www.lotteimall.com/goods/viewGoodsDetail.lotte?goods_no=${item.code}`, '_blank')}
              />
            </div>
          </div>

          {/* 특이사항 */}
          <div className="notes-section">
            <div className="notes-title">
              상품 특이사항
              <button className="notes-save-btn" onClick={handleSaveNote}>저장하기</button>
            </div>
            <textarea
              id="det-notes"
              className="notes-area"
              placeholder="상품에 대한 특이사항 입력"
              spellCheck={false}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
          </div>
        </div>

        {/* ============================================================
            RIGHT: 재고 / 착장 / 대여 / 준비물 / 바구니
        ============================================================ */}
        <div className="dash-right">

          {/* 실시간 재고 현황 */}
          <div className="dash-card" id="stock-card">
            <div className="dash-title-row">
              <span className="dash-title" id="stock-card-title" style={{ color: editMode ? 'var(--primary)' : '' }}>
                {editMode ? '신규 재고 등록 모드' : '실시간 재고 현황'}
              </span>
              <button
                className="btn-plus"
                id="stock-toggle-btn"
                style={{ background: editMode ? '#999' : '' }}
                onClick={() => { setEditMode(e => !e); setStockEdits({}); setNewSizeName(''); }}
              >
                {editMode ? '×' : '+'}
              </button>
            </div>

            {/* ── 보기 모드 ── */}
            {!editMode && (
              <div id="v-stock-table" className="compact-table">
                {colors.length === 0
                  ? <p style={{ color: '#999', textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>등록된 재고가 없습니다.</p>
                  : (
                    <table className="st-table">
                      <thead>
                        <tr>
                          <th>색상</th>
                          {sizes.map(s => <th key={s}>{s}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {colors.map(c => (
                          <tr key={c}>
                            <td className="bg-light fw-bold">{c}</td>
                            {sizes.map(s => {
                              const base   = stockMap.filter(x => x.color === c && x.size === s).reduce((a, b) => a + Number(b.qty), 0);
                              const rented = itemRentals.filter(r => r.color === c && r.size === s).reduce((a, b) => a + Number(b.qty), 0);
                              const qty    = base - rented;
                              return (
                                <td key={s}
                                  onClick={() => addToCart(c, s)}
                                  style={{ cursor: 'pointer', color: qty > 0 ? 'var(--primary) !important' : undefined, opacity: qty > 0 ? 1 : 0.3 }}
                                >
                                  {qty}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                }
              </div>
            )}

            {/* ── 편집 모드 ── */}
            {editMode && (
              <>
                <div className="compact-table" style={{ overflowX: 'auto' }}>
                  <table className="st-table" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '70px' }}>색상</th>
                        {sizes.map(s => <th key={s}>{s}</th>)}
                        <th style={{ background: '#fff3f8', border: '1px solid #ffccd5', width: '80px' }}>
                          <input type="text" placeholder="+사이즈" value={newSizeName} onChange={e => setNewSizeName(e.target.value)}
                            style={{ width: '100%', fontSize: '10px', border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', fontWeight: '800' }} />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {colors.map(c => (
                        <tr key={c}>
                          <td className="bg-light fw-bold" style={{ fontSize: '11px' }}>{c}</td>
                          {sizes.map(s => (
                            <td key={s} style={{ padding: 0 }}>
                              <input type="number" className="matrix-input"
                                value={stockEdits[`${c}||${s}`] || ''}
                                onChange={e => setStockEdits(p => ({ ...p, [`${c}||${s}`]: e.target.value }))}
                                style={{ width: '100%', height: '32px', border: 'none', textAlign: 'center', outline: 'none', fontSize: '13px', fontWeight: '800', color: 'var(--primary)' }} />
                            </td>
                          ))}
                          <td style={{ background: '#fff9fb', padding: 0 }}>
                            <input type="number" className="matrix-input"
                              value={stockEdits[`${c}||__new__`] || ''}
                              onChange={e => setStockEdits(p => ({ ...p, [`${c}||__new__`]: e.target.value }))}
                              style={{ width: '100%', height: '32px', border: 'none', textAlign: 'center', outline: 'none', background: 'transparent', fontSize: '13px' }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div id="stock-edit-actions" style={{ display: 'flex', marginTop: '10px', gap: '8px' }}>
                  <button className="m-btn m-btn-cancel" style={{ fontSize: '12px', padding: '8px' }}
                    onClick={() => { setEditMode(false); setStockEdits({}); }}>취소</button>
                  <button className="m-btn m-btn-confirm" style={{ fontSize: '12px', padding: '8px' }}
                    onClick={handleSubmitStock}>입고 저장</button>
                </div>
              </>
            )}
          </div>

          {/* 착장 정보 */}
          <div className="dash-card">
            <div className="dash-title-row">
              <span className="dash-title">착장 정보</span>
              <button className="btn-plus" onClick={() => setOutfitOpen(true)}>+</button>
            </div>
            <div id="v-outfit-container" className="info-card-grid">
              {itemOutfits.length === 0
                ? <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#aaa', fontSize: '13px', padding: '8px 0' }}>내역 없음</div>
                : itemOutfits.map(o => (
                  <div key={`${o.host}-${o.size}`} className="info-item-card">
                    <button className="delete-btn" onClick={() => handleDeleteOutfit(o.host)}>×</button>
                    <span className="info-card-top">{o.host}</span>
                    <span className="info-card-bottom">{o.size}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* 실시간 대여 현황 */}
          <div className="dash-card">
            <div className="dash-title-row" id="rental-btn-container">
              {checked.length > 0
                ? <button type="button" className="btn btn-primary btn-sm fw-bold px-3 py-1" onClick={e => handleReturnRentals(e)}>반납하기</button>
                : <span className="dash-title">실시간 대여 현황</span>
              }
            </div>
            <div id="v-rental-list">
              <table className="list-table">
                <thead>
                  <tr>
                    <th style={{ width: '35px' }}>선택</th>
                    <th style={{ width: '55px' }}>대여자</th>
                    <th>상품 정보</th>
                    <th style={{ width: '35px' }}>수량</th>
                    <th style={{ width: '75px' }}>대여일</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRentals.length === 0
                    ? <tr><td colSpan="5" style={{ padding: '16px 0', color: '#aaa', fontSize: '13px' }}>현재 대여 중인 내역이 없습니다.</td></tr>
                    : itemRentals.map((r, i) => {
                      const d = r.date ? r.date.substring(5, 10) : '-';
                      const isChk = checked.some(x => isSameRental(x, r));
                      return (
                        <tr key={i}>
                          <td>
                            <input type="checkbox" className="rental-check" checked={isChk}
                              onChange={e => {
                                if (e.target.checked) setChecked(p => [...p, r]);
                                else setChecked(p => p.filter(x => !isSameRental(x, r)));
                              }}
                              onClick={e => e.stopPropagation()} />
                          </td>
                          <td className="fw-bold">{r.renter}</td>
                          <td className="list-product-info">
                            <span className="list-product-desc">{r.color} / {r.size}</span>
                          </td>
                          <td><span className="qty-badge">{r.qty}</span></td>
                          <td>
                            <span className="date-text">{d}</span>
                            <button className="delete-btn" style={{ position: 'static', marginLeft: '5px' }} onClick={() => handleDeleteRental(r)}>×</button>
                          </td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>

          {/* 준비물 */}
          <div className="dash-card">
            <div className="dash-title-row">
              <span className="dash-title">준비물 (방송/협찬용)</span>
              <button className="notes-save-btn" onClick={handleSaveSupply}>저장하기</button>
            </div>
            <input
              type="text"
              id="det-supplies"
              className="form-control form-control-sm border-0 bg-light fw-bold"
              placeholder="이미지 위에 표시될 준비물 입력"
              value={supplyText}
              onChange={e => setSupplyText(e.target.value)}
            />
          </div>

          {/* 대여 바구니 (숫자 클릭 시 노출) */}
          {cart.length > 0 && (
            <div id="v-cart-section" className="dash-card" style={{ border: '1.5px solid var(--primary)' }}>
              <div className="dash-title-row">
                <span className="dash-title" style={{ color: 'var(--primary)' }}>대여 바구니 (등록 대기)</span>
                <button className="btn-plus" style={{ background: '#999' }} onClick={() => setCart([])}>×</button>
              </div>
              <div id="v-cart-list" className="mb-3">
                {cart.map((c, idx) => (
                  <div key={idx} className="cart-item">
                    <div className="cart-item-info">
                      {c.color} / {c.size}
                      <input type="number" className="cart-qty-input" value={c.qty} min="1"
                        onChange={e => setCart(p => p.map((x, i) => i === idx ? { ...x, qty: Number(e.target.value) } : x))} />
                    </div>
                    <button className="delete-btn" style={{ position: 'static', color: '#666' }}
                      onClick={() => setCart(p => p.filter((_, i) => i !== idx))}>×</button>
                  </div>
                ))}
              </div>
              <div className="d-flex gap-2">
                <input type="text" id="cart-renter" className="form-control form-control-sm border-primary"
                  placeholder="대여자 성함 입력" value={renter} onChange={e => setRenter(e.target.value)} />
                <button className="btn btn-primary btn-sm fw-bold px-3" style={{ whiteSpace: 'nowrap' }}
                  onClick={handleSubmitRental}>대여 완료</button>
              </div>
            </div>
          )}

        </div>{/* dash-right */}
      </div>{/* dash-layout */}

      {/* 착장 등록 모달 */}
      <OutfitModal isOpen={outfitOpen} onClose={() => setOutfitOpen(false)} onConfirm={handleAddOutfits} />

      {/* 커스텀 확인 창 모달 */}
      {confirmModal.isOpen && (
        <div className="custom-modal-overlay" style={{ display: 'flex', zIndex: 1000 }}>
          <div className="custom-modal" style={{ maxWidth: '400px', width: '90%', padding: '24px' }}>
            <h5 className="modal-title" style={{ marginBottom: '16px' }}>작업 확인</h5>
            <div style={{ fontSize: '14px', marginBottom: '24px', lineHeight: '1.5', color: '#333' }}>
              {confirmModal.message}
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', padding: 0, justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="m-btn m-btn-cancel" style={{ width: 'auto', padding: '8px 16px' }}
                onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })}>
                취소
              </button>
              <button type="button" className="m-btn m-btn-confirm" style={{ width: 'auto', padding: '8px 16px' }}
                onClick={async () => {
                  await confirmModal.onConfirm();
                  setConfirmModal({ isOpen: false, message: '', onConfirm: null });
                }}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default DetailPage;
