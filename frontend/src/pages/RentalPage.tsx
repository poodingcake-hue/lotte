import { useMemo, useState } from 'react';
import html2canvas from 'html2canvas';
import { useAppStore } from '../store/useAppStore';
import { getProductImage } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';

const pad = (n: number) => String(n).padStart(2, '0');

// 대여현황은 날짜만 다룬다(시각은 표시하지 않음). <input type="date">가 요구하는
// 로컬 기준 YYYY-MM-DD 문자열로 변환한다.
const toDateInputValue = (dateString: string) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// 날짜만 바꾸고 시각은 원본 그대로 유지한다. 이력 정렬과 같은 날 안에서의 순서가
// 시각에 의존하므로, 날짜 수정 때문에 시각이 00:00으로 밀리면 순서가 뒤엉킨다.
const withDatePart = (originalIso: string, ymd: string) => {
  const [y, m, day] = ymd.split('-').map(Number);
  if (!y || !m || !day) return null;
  const base = new Date(originalIso);
  const d = isNaN(base.getTime()) ? new Date(y, m - 1, day) : new Date(base);
  d.setFullYear(y, m - 1, day);
  return d.toISOString();
};

interface RentalItem {
  id: string;
  code: string;
  name: string;
  size: string;
  color: string;
  qty: number;
  rawQty: number;
  note: string;
  renter: string;
  date: string;
}

interface ProductRentalGroup {
  code: string;
  name: string;
  product: any;
  imageUrl: string;
  earliestDate: string;
  totalQty: number;
  items: RentalItem[];
}

const RentalPage = () => {
  const { allHistory, allItems, allStockMap, saveHistoryToBackend, updateHistoryInBackend } = useAppStore();
  const navigate = useNavigate();
  const [selectedBrand, setSelectedBrand] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isReturning, setIsReturning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [savingDateId, setSavingDateId] = useState<string | null>(null);
  const [savingActorId, setSavingActorId] = useState<string | null>(null);
  const [selectedStockProduct, setSelectedStockProduct] = useState<ProductRentalGroup | null>(null);
  const [capturingCode, setCapturingCode] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const codeToProduct = useMemo(() => {
    const map: Record<string, any> = {};
    allItems.forEach(i => { if (i.isMaster) map[String(i.code)] = i; });
    return map;
  }, [allItems]);

  // 실시간 재고 모달용 매트릭스 계산
  const stockModalData = useMemo(() => {
    if (!selectedStockProduct) return null;
    const pCode = selectedStockProduct.code;
    const stockList = allStockMap[pCode] || [];
    const product = selectedStockProduct.product;

    // 히스토리 삽입 순서로 사이즈 정렬
    const logs = [...(allHistory || [])]
      .filter((l: any) => String(l.code) === String(pCode))
      .sort((a: any, b: any) => {
        const d = (new Date(a.date) as any) - (new Date(b.date) as any);
        return d !== 0 ? d : Number(a.id || 0) - Number(b.id || 0);
      });
    const stockEntryOrder: string[] = [];
    logs.forEach((l: any) => {
      const s = String(l.size || '').trim();
      if (s && !stockEntryOrder.includes(s)) stockEntryOrder.push(s);
    });

    const isGhost = (key: 'size' | 'color', v: string) =>
      (!v || v.trim() === '' || v.trim() === '-') &&
      stockList
        .filter((x: any) => x[key] === v)
        .reduce((a: number, b: any) => a + Number(b.qty || 0), 0) === 0;

    const stockSizes: string[] = [];
    const colorList: string[] = [];
    stockList.forEach((s: any) => {
      if (s.size && !stockSizes.includes(s.size) && !isGhost('size', s.size)) stockSizes.push(s.size);
      if (s.color && !colorList.includes(s.color) && !isGhost('color', s.color)) colorList.push(s.color);
    });

    const masterSizes = (product?.sizes ? String(product.sizes).split(',') : [])
      .map((s: string) => s.trim())
      .filter(Boolean);
    const ordered = masterSizes.filter((s: string) => stockSizes.includes(s));
    const rest = stockSizes
      .filter(s => !ordered.includes(s))
      .sort((a, b) => {
        const ia = stockEntryOrder.indexOf(a), ib = stockEntryOrder.indexOf(b);
        if (ia === ib) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

    const finalSizes = [...ordered, ...rest];
    const finalColors = colorList;

    const matrix: Record<string, number> = {};
    let totalStock = 0;
    stockList.forEach((item: any) => {
      const qty = Number(item.qty || 0);
      matrix[`${item.color}||${item.size}`] = qty;
      totalStock += qty;
    });

    return {
      productName: selectedStockProduct.name,
      productCode: pCode,
      sizes: finalSizes,
      colors: finalColors,
      matrix,
      totalStock
    };
  }, [selectedStockProduct, allStockMap, allHistory]);

  // 미반납(대여중) RENT 로그 = 자신을 ref_id로 가리키는 RETURN 로그가 아직 없는 것.
  // 별도 rentals 테이블 없이 inventory_history만으로 파생.
  const closedRentIds = useMemo(() => {
    return new Set(
      (allHistory || [])
        .filter(h => h.type === 'RETURN' && h.ref_id !== undefined && h.ref_id !== null)
        .map(h => String(h.ref_id))
    );
  }, [allHistory]);

  const outstandingRentLogs = useMemo(() => {
    return (allHistory || []).filter(h => h.type === 'RENT' && !closedRentIds.has(String(h.id)));
  }, [allHistory, closedRentIds]);

  // 현재 대여중인 항목이 하나라도 있는 브랜드만 선택 가능하게 노출
  const activeBrands = useMemo(() => {
    const brands = new Set<string>();
    outstandingRentLogs.forEach(h => {
      const brand = codeToProduct[String(h.code)]?.brand;
      if (brand) brands.add(brand);
    });
    return Array.from(brands).sort();
  }, [outstandingRentLogs, codeToProduct]);

  // 선택한 브랜드의 대여중(미반납) 내역을 상품별로 그룹화하고 날짜 빠른 순으로 정렬
  const groupedProducts = useMemo<ProductRentalGroup[]>(() => {
    if (!selectedBrand) return [];

    const brandRentals = outstandingRentLogs.filter(
      h => codeToProduct[String(h.code)]?.brand === selectedBrand
    );

    const groupsMap = new Map<string, ProductRentalGroup>();

    brandRentals.forEach(h => {
      const code = String(h.code);
      const product = codeToProduct[code] || null;
      const name = product?.name || '미등록 상품';
      const imageUrl = getProductImage(product || { code });

      const item: RentalItem = {
        id: String(h.id),
        code,
        name,
        size: h.size || '',
        color: h.color || '',
        qty: Math.abs(Number(h.qty)),
        rawQty: Number(h.qty),
        note: h.note || '',
        renter: h.actor || '',
        date: h.date || '',
      };

      if (!groupsMap.has(code)) {
        groupsMap.set(code, {
          code,
          name,
          product,
          imageUrl,
          earliestDate: item.date,
          totalQty: item.qty,
          items: [item]
        });
      } else {
        const group = groupsMap.get(code)!;
        group.items.push(item);
        group.totalQty += item.qty;
        if (new Date(item.date).getTime() < new Date(group.earliestDate).getTime()) {
          group.earliestDate = item.date;
        }
      }
    });

    // 각 상품 그룹 내의 대여 항목들을 날짜 빠른 순(오름차순)으로 정렬
    groupsMap.forEach(group => {
      group.items.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeA !== timeB) return timeA - timeB; // 날짜 빠른 순
        const sizeCmp = a.size.localeCompare(b.size, undefined, { numeric: true });
        if (sizeCmp !== 0) return sizeCmp;
        return a.color.localeCompare(b.color);
      });
    });

    // 상품 그룹들도 가장 빠른 반출일(earliestDate) 기준 빠른 순으로 정렬
    return Array.from(groupsMap.values()).sort((a, b) => {
      const timeA = new Date(a.earliestDate).getTime();
      const timeB = new Date(b.earliestDate).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });
  }, [outstandingRentLogs, selectedBrand, codeToProduct]);

  // 전체 대여 항목 목록 (선택/반납 처리용)
  const allCurrentItems = useMemo(() => {
    return groupedProducts.flatMap(g => g.items);
  }, [groupedProducts]);

  const handleSelectBrand = (brand: string) => {
    setSelectedBrand(brand);
    setCheckedIds(new Set());
    setConfirming(false);
  };

  const toggleChecked = (id: string) => {
    setConfirming(false);
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroupChecked = (group: ProductRentalGroup) => {
    setConfirming(false);
    const groupIds = group.items.map(i => i.id);
    const allGroupChecked = groupIds.every(id => checkedIds.has(id));

    setCheckedIds(prev => {
      const next = new Set(prev);
      if (allGroupChecked) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleAllChecked = () => {
    setConfirming(false);
    if (checkedIds.size === allCurrentItems.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(allCurrentItems.map(i => i.id)));
    }
  };

  const handleDateChange = async (item: RentalItem, ymd: string) => {
    if (!ymd) return;
    const nextIso = withDatePart(item.date, ymd);
    if (!nextIso || nextIso === item.date) return;

    setSavingDateId(item.id);
    try {
      await updateHistoryInBackend([{
        id: Number(item.id),
        code: item.code, color: item.color, size: item.size,
        qty: item.rawQty,      // 부호 있는 원본 값 그대로 (재고 영향 없음)
        deltaQty: 0,          // 수량은 안 바꾸므로 재고 델타 없음
        date: nextIso,
        note: item.note,
        actor: item.renter,
      }]);
    } catch (err) {
      console.error(err);
      alert('날짜 수정 중 오류가 발생했습니다.');
    } finally {
      setSavingDateId(null);
    }
  };

  const handleActorChange = async (item: RentalItem, newActor: string) => {
    const trimmed = newActor.trim();
    if (trimmed === item.renter) return;

    setSavingActorId(item.id);
    try {
      await updateHistoryInBackend([{
        id: Number(item.id),
        code: item.code,
        color: item.color,
        size: item.size,
        qty: item.rawQty,
        deltaQty: 0,
        date: item.date,
        note: item.note,
        actor: trimmed,
      }]);
    } catch (err) {
      console.error(err);
      alert('대여자 수정 중 오류가 발생했습니다.');
    } finally {
      setSavingActorId(null);
    }
  };

  const handleCaptureCard = async (group: ProductRentalGroup) => {
    const cardEl = document.getElementById(`rental-card-${group.code}`);
    if (!cardEl) return;

    setCapturingCode(group.code);
    try {
      cardEl.classList.add('capturing-mode');

      // 캡처 전용 스타일 반영을 위해 잠시 대기
      await new Promise(r => setTimeout(r, 60));

      const canvas = await html2canvas(cardEl, {
        scale: 2, // 고해상도 (카카오톡 모바일/PC 전송 시 선명)
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      cardEl.classList.remove('capturing-mode');

      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Blob generation failed');

        let copied = false;
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            copied = true;
          } catch (clipErr) {
            console.warn('Clipboard write failed:', clipErr);
          }
        }

        // 이미지 파일 다운로드도 함께 제공
        const link = document.createElement('a');
        const nowStr = new Date().toISOString().slice(0, 10);
        const safeName = group.name.replace(/[/\\?%*:|"<>]/g, '').slice(0, 20);
        link.download = `${selectedBrand || '대여현황'}_${safeName}_${group.code}_${nowStr}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        if (copied) {
          showToast('📸 캡처 완료! 클립보드에 복사되었습니다. 카톡에 바로 Ctrl+V 붙여넣기 하세요.');
        } else {
          showToast('📸 대여현황 이미지가 저장되었습니다.');
        }
      }, 'image/png');
    } catch (err) {
      console.error('Capture error:', err);
      cardEl.classList.remove('capturing-mode');
      alert('이미지 캡처 중 오류가 발생했습니다.');
    } finally {
      setCapturingCode(null);
    }
  };

  const handleReturn = async () => {
    const targets = allCurrentItems.filter(r => checkedIds.has(r.id));
    if (targets.length === 0) return;

    setIsReturning(true);
    try {
      const timestamp = new Date().toISOString();
      const newLogs = targets.map(r => ({
        code: r.code, color: r.color, size: r.size,
        type: 'RETURN', qty: r.qty, date: timestamp,
        actor: r.renter, note: '대여 반납', ref_id: r.id
      }));
      await saveHistoryToBackend(newLogs);
      setCheckedIds(new Set());
      setConfirming(false);
      alert('반납 처리가 완료되었습니다.');
    } catch (err) {
      console.error(err);
      alert('반납 처리 중 오류가 발생했습니다.');
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <section className="page-section active" id="page-rental">
      <style>{`
        .capturing-mode {
          background-color: #ffffff !important;
          padding: 24px 20px !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 16px !important;
          box-shadow: none !important;
          width: 560px !important;
          max-width: 560px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }
        .capturing-mode .row {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          width: 100% !important;
          margin: 0 !important;
          gap: 12px !important;
        }
        .capturing-mode .col-12 {
          width: 100% !important;
          max-width: 100% !important;
          padding: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }
        .capturing-mode .p-code-overlay {
          display: none !important;
        }
        .capturing-mode .p-title-row {
          max-width: 100% !important;
          width: 100% !important;
          white-space: nowrap !important;
          text-align: center !important;
          font-size: 20px !important;
          font-weight: 800 !important;
          color: #0f172a !important;
          letter-spacing: -0.3px !important;
          margin-top: 14px !important;
          margin-bottom: 8px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .capturing-mode .p-title-row .p-code-prefix {
          display: inline-block !important;
          font-size: 18px !important;
          font-weight: 800 !important;
          color: #2563eb !important;
          margin-right: 6px !important;
        }
        .capturing-mode .table-responsive {
          width: 100% !important;
          overflow: visible !important;
        }
        .capturing-mode table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin-top: 6px !important;
        }
        .capturing-mode th, .capturing-mode td {
          padding: 11px 8px !important;
          text-align: center !important;
          vertical-align: middle !important;
          border-bottom: 1px solid #e2e8f0 !important;
          font-size: 16px !important;
          color: #0f172a !important;
        }
        .capturing-mode thead th {
          background-color: #f1f5f9 !important;
          color: #1e293b !important;
          font-weight: 800 !important;
          font-size: 15px !important;
          border-bottom: 2px solid #cbd5e1 !important;
        }
        .capturing-mode td .text-danger {
          font-size: 18px !important;
          font-weight: 800 !important;
        }
        .capturing-mode .hide-on-capture {
          display: none !important;
        }
        .capturing-mode .show-on-capture {
          display: flex !important;
        }
        .capturing-mode input.form-control {
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
          font-weight: 700 !important;
          font-size: 16px !important;
          color: #0f172a !important;
          text-align: center !important;
          box-shadow: none !important;
          max-width: 100% !important;
          margin: 0 auto !important;
        }
      `}</style>

      {/* Toast Alert */}
      {toastMsg && (
        <div
          className="position-fixed bottom-0 start-50 translate-middle-x mb-4 bg-dark text-white px-4 py-2.5 rounded-pill shadow-lg"
          style={{ zIndex: 9999, fontSize: '14px', fontWeight: 500, letterSpacing: '0.2px' }}
        >
          {toastMsg}
        </div>
      )}

      {/* Brand Selection Bar */}
      <div className="card border-0 shadow-sm p-3 mb-3 rounded-3 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <select
              id="rentalBrandSel"
              className="form-select form-select-sm border-0 bg-light fw-bold text-dark"
              style={{ padding: '8px 12px', fontSize: '14px' }}
              value={selectedBrand}
              onChange={(e) => handleSelectBrand(e.target.value)}
            >
              <option value="">
                {activeBrands.length === 0 ? '현재 대여중인 브랜드 없음' : '브랜드를 선택하세요'}
              </option>
              {activeBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {selectedBrand && allCurrentItems.length > 0 && (
            <div className="col-12 col-md-7 d-flex justify-content-md-end align-items-center gap-2">
              <span className="badge bg-light text-secondary border px-2.5 py-2" style={{ fontSize: '12.5px' }}>
                총 <strong className="text-dark">{groupedProducts.length}</strong>개 상품 · <strong className="text-danger">{allCurrentItems.length}</strong>건 대여중
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary px-3 py-1"
                onClick={toggleAllChecked}
              >
                {checkedIds.size === allCurrentItems.length ? '전체 선택 해제' : '전체 선택'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedBrand ? (
        <div className="card border-0 shadow-sm p-5 rounded-4 text-center text-muted bg-white">
          <span className="material-icons text-secondary mb-2" style={{ fontSize: '40px' }}>inventory_2</span>
          <div className="fw-medium">상단에서 브랜드를 선택하면 대여중인 상품과 상세 내역이 표시됩니다.</div>
        </div>
      ) : groupedProducts.length === 0 ? (
        <div className="card border-0 shadow-sm p-5 rounded-4 text-center text-muted bg-white">
          <span className="material-icons text-success mb-2" style={{ fontSize: '40px' }}>check_circle</span>
          <div className="fw-medium">선택한 브랜드에 현재 대여중인 상품이 없습니다.</div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3 mb-5">
          {groupedProducts.map(group => {
            const groupItemIds = group.items.map(i => i.id);
            const isAllGroupChecked = groupItemIds.length > 0 && groupItemIds.every(id => checkedIds.has(id));
            const isPartialGroupChecked = !isAllGroupChecked && groupItemIds.some(id => checkedIds.has(id));

            return (
              <div
                key={group.code}
                id={`rental-card-${group.code}`}
                className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white"
                style={{ border: '1px solid #e9ecef', transition: 'box-shadow 0.2s ease' }}
              >
                {/* Header for Capture (Only visible during capture) */}
                <div className="show-on-capture d-none justify-content-between align-items-center w-100 pb-2.5 mb-2 border-bottom" style={{ borderColor: '#e2e8f0' }}>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary px-2.5 py-1 font-monospace" style={{ fontSize: '13px' }}>
                      {selectedBrand}
                    </span>
                    <span className="fw-bold text-dark" style={{ fontSize: '16px' }}>대여 현황</span>
                  </div>
                  <div className="text-muted small" style={{ fontSize: '12px' }}>
                    총 <strong className="text-danger">{group.items.length}건</strong> 대여중 · {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })} 기준
                  </div>
                </div>

                <div className="row g-4 align-items-center">
                  {/* Left Column: Big Image with Code on Bottom-Left + Product Name Below */}
                  <div className="col-12 col-md-4 col-lg-3 d-flex flex-column align-items-center text-center">
                    {/* Large Image Box */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: '180px',
                        height: '200px',
                        borderRadius: '14px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                      }}
                      onClick={() => navigate(`/detail/${group.code}`)}
                      title="상품 상세 페이지로 이동"
                    >
                      {/* Product Code on Bottom-Left (Pretendard font, text only, hidden in capture mode) */}
                      <div
                        className="p-code-overlay"
                        style={{
                          position: 'absolute',
                          bottom: '6px',
                          left: '8px',
                          color: '#64748b',
                          fontSize: '12px',
                          fontWeight: 700,
                          fontFamily: "'Pretendard', sans-serif",
                          letterSpacing: '0.2px',
                          zIndex: 2,
                          pointerEvents: 'none'
                        }}
                      >
                        {group.code}
                      </div>

                      {group.imageUrl ? (
                        <img
                          src={group.imageUrl}
                          alt={group.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="material-icons text-muted" style={{ fontSize: '36px' }}>image</span>
                      )}
                    </div>

                    {/* Product Name & Code Below Image (Single line during capture) */}
                    <div
                      className="p-title-row fw-bold text-dark px-1 text-center"
                      style={{
                        marginTop: '16px',
                        fontSize: '15px',
                        lineHeight: '1.45',
                        cursor: 'pointer',
                        wordBreak: 'keep-all',
                        maxWidth: '200px'
                      }}
                      onClick={() => navigate(`/detail/${group.code}`)}
                      title={group.name}
                    >
                      <span
                        className="p-code-prefix show-on-capture d-none font-monospace me-1.5"
                        style={{ fontSize: '15px', color: '#475569', fontWeight: 700 }}
                      >
                        [{group.code}]
                      </span>
                      <span className="p-name-text">{group.name}</span>
                    </div>
                  </div>

                  {/* Right Column: Top Actions (전체선택 + 총건수/현재 재고/캡처) + Rental Table */}
                  <div className="col-12 col-md-8 col-lg-9">
                    {/* Top Action Bar */}
                    <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom hide-on-capture" style={{ borderColor: '#f1f3f5' }}>
                      <label
                        className="d-inline-flex align-items-center gap-2 fw-semibold text-secondary user-select-none mb-0"
                        style={{ cursor: 'pointer', fontSize: '13px' }}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input mt-0"
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          checked={isAllGroupChecked}
                          ref={el => { if (el) el.indeterminate = isPartialGroupChecked; }}
                          onChange={() => toggleGroupChecked(group)}
                        />
                        <span>전체선택</span>
                      </label>

                      <div className="d-flex align-items-center gap-3">
                        <span className="text-muted small" style={{ fontSize: '13px' }}>
                          총 <strong className="text-dark">{group.items.length}</strong>건
                        </span>

                        <div className="d-flex align-items-center gap-2">
                          {/* Current Stock Button */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary px-2.5 py-1"
                            style={{ fontSize: '12px', borderRadius: '6px', fontWeight: 600 }}
                            onClick={() => setSelectedStockProduct(group)}
                            title="실시간 재고 매트릭스 확인"
                          >
                            현재 재고
                          </button>

                          {/* Capture Button for KakaoTalk */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary px-2.5 py-1 d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '12px', borderRadius: '6px', fontWeight: 600 }}
                            disabled={capturingCode === group.code}
                            onClick={() => handleCaptureCard(group)}
                            title="카카오톡 공유용 이미지 캡처 (클립보드 복사 & 다운로드)"
                          >
                            {capturingCode === group.code ? (
                              <>
                                <span className="spinner-border spinner-border-sm text-secondary" role="status" style={{ width: '12px', height: '12px' }} />
                                <span>캡처중</span>
                              </>
                            ) : (
                              <span>캡처</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Rental Details Sub-Table */}
                    <div className="table-responsive">
                      <table className="table table-sm table-hover align-middle mb-0 text-center" style={{ fontSize: '14px' }}>
                        <thead className="text-muted" style={{ fontSize: '13px', borderBottom: '2px solid #f1f3f5' }}>
                          <tr>
                            <th className="hide-on-capture" style={{ width: '38px', textAlign: 'center' }}></th>
                            <th style={{ width: '80px', textAlign: 'center' }}>사이즈</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>컬러</th>
                            <th style={{ width: '65px', textAlign: 'center' }}>수량</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>대여자</th>
                            <th style={{ minWidth: '135px', textAlign: 'center' }}>반출일</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map(item => (
                            <tr
                              key={item.id}
                              className={checkedIds.has(item.id) ? 'table-primary-subtle' : ''}
                              style={{ transition: 'background-color 0.15s ease' }}
                            >
                              <td className="hide-on-capture" style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  className="form-check-input mt-0"
                                  style={{ width: '17px', height: '17px', cursor: 'pointer' }}
                                  checked={checkedIds.has(item.id)}
                                  onChange={() => toggleChecked(item.id)}
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="fw-bold text-dark" style={{ fontSize: '14.5px' }}>{item.size || '-'}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="fw-medium text-dark" style={{ fontSize: '14.5px' }}>
                                  {item.color || '-'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="fw-bold text-danger" style={{ fontSize: '15px' }}>
                                  {item.qty}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div className="d-flex align-items-center justify-content-center gap-1">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm border bg-white text-center mx-auto"
                                    style={{ maxWidth: '100px', fontSize: '13.5px', padding: '4px 6px' }}
                                    defaultValue={item.renter || ''}
                                    key={`${item.id}-${item.renter}`}
                                    disabled={savingActorId === item.id}
                                    placeholder="대여자"
                                    onBlur={(e) => handleActorChange(item, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                  {savingActorId === item.id && (
                                    <span className="spinner-border spinner-border-sm text-primary hide-on-capture" role="status" />
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div className="d-flex align-items-center justify-content-center gap-1">
                                  <input
                                    type="date"
                                    className="form-control form-control-sm border bg-white text-center mx-auto"
                                    style={{ maxWidth: '135px', fontSize: '13px', padding: '4px 6px' }}
                                    value={toDateInputValue(item.date)}
                                    disabled={savingDateId === item.id}
                                    onChange={(e) => handleDateChange(item, e.target.value)}
                                  />
                                  {savingDateId === item.id && (
                                    <span className="spinner-border spinner-border-sm text-primary hide-on-capture" role="status" />
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating / Bottom Return Action Bar */}
      {checkedIds.size > 0 && (
        <div
          className="fixed-bottom bg-white border-top shadow-lg p-3 d-flex justify-content-between align-items-center"
          style={{ zIndex: 1050 }}
        >
          <div className="container d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary fs-6 px-3 py-2">
                선택된 항목: {checkedIds.size}건
              </span>
              {confirming && (
                <span className="text-danger fw-bold ms-2">
                  선택한 {checkedIds.size}건을 반납 처리할까요?
                </span>
              )}
            </div>

            <div className="d-flex align-items-center gap-2">
              {confirming ? (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary px-3"
                    disabled={isReturning}
                    onClick={() => setConfirming(false)}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger px-4 fw-bold"
                    disabled={isReturning}
                    onClick={handleReturn}
                  >
                    {isReturning ? '반납 처리 중...' : '예, 반납 처리합니다'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger px-4 fw-bold"
                  disabled={isReturning}
                  onClick={() => setConfirming(true)}
                >
                  선택 {checkedIds.size}건 반납 처리
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Realtime Stock Matrix Modal */}
      {selectedStockProduct && stockModalData && (
        <div
          className="modal fade show"
          style={{ display: 'block', backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 2100 }}
          onClick={() => setSelectedStockProduct(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-light bg-opacity-75 px-4 py-3 border-bottom d-flex align-items-center justify-content-between">
                <div>
                  <div className="fw-bold text-dark fs-5 d-flex align-items-center gap-2">
                    <span>실시간 재고 현황</span>
                    <span className="badge bg-primary-subtle text-primary font-monospace fs-6 px-2.5 py-1">
                      {stockModalData.productCode}
                    </span>
                  </div>
                  <div className="text-muted small mt-1">{stockModalData.productName}</div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedStockProduct(null)}
                  aria-label="Close"
                />
              </div>

              <div className="modal-body p-4">
                {stockModalData.colors.length === 0 || stockModalData.sizes.length === 0 ? (
                  <div className="text-center text-muted p-4">등록된 실시간 재고가 없습니다.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-bordered align-middle text-center mb-0" style={{ fontSize: '14px' }}>
                      <thead className="table-light">
                        <tr>
                          <th style={{ minWidth: '100px', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>색상</th>
                          {stockModalData.sizes.map(s => (
                            <th key={s} style={{ minWidth: '70px', fontWeight: 'bold' }}>{s}</th>
                          ))}
                          <th style={{ minWidth: '80px', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockModalData.colors.map(color => {
                          const rowSum = stockModalData.sizes.reduce((acc, size) => {
                            return acc + (stockModalData.matrix[`${color}||${size}`] || 0);
                          }, 0);

                          return (
                            <tr key={color}>
                              <td className="fw-bold bg-light-subtle">{color}</td>
                              {stockModalData.sizes.map(size => {
                                const qty = stockModalData.matrix[`${color}||${size}`] || 0;
                                return (
                                  <td
                                    key={size}
                                    className={qty > 0 ? 'fw-bold text-primary' : 'text-muted opacity-50'}
                                    style={{ fontSize: '15px' }}
                                  >
                                    {qty}
                                  </td>
                                );
                              })}
                              <td className="fw-bold text-dark bg-light-subtle">{rowSum}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="table-light fw-bold">
                        <tr>
                          <td className="bg-light-subtle">합계</td>
                          {stockModalData.sizes.map(size => {
                            const colSum = stockModalData.colors.reduce((acc, color) => {
                              return acc + (stockModalData.matrix[`${color}||${size}`] || 0);
                            }, 0);
                            return (
                              <td key={size} className={colSum > 0 ? 'text-primary' : 'text-muted'}>
                                {colSum}
                              </td>
                            );
                          })}
                          <td className="text-primary fs-6">{stockModalData.totalStock}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light bg-opacity-50 px-4 py-2.5 border-top d-flex justify-content-between">
                <div className="text-muted small">
                  총 보유 재고: <strong className="text-primary fs-6">{stockModalData.totalStock}</strong>개
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm px-3"
                  onClick={() => setSelectedStockProduct(null)}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default RentalPage;

