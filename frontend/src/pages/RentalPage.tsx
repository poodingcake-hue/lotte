import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

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

const RentalPage = () => {
  const { allHistory, allItems, saveHistoryToBackend, updateHistoryInBackend } = useAppStore();
  const [selectedBrand, setSelectedBrand] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isReturning, setIsReturning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [savingDateId, setSavingDateId] = useState<string | null>(null);

  const codeToProduct = useMemo(() => {
    const map: Record<string, any> = {};
    allItems.forEach(i => { if (i.isMaster) map[String(i.code)] = i; });
    return map;
  }, [allItems]);

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

  // 선택한 브랜드의 대여중(미반납) 내역만 상품코드 → 사이즈 → 컬러 → 날짜 순으로 개별 출력
  const rentalRows = useMemo(() => {
    if (!selectedBrand) return [];
    return outstandingRentLogs
      .filter(h => codeToProduct[String(h.code)]?.brand === selectedBrand)
      .map(h => ({
        id: String(h.id),
        code: h.code,
        name: codeToProduct[String(h.code)]?.name || '',
        size: h.size || '',
        color: h.color || '',
        qty: Math.abs(Number(h.qty)),
        // 화면에는 절대값을 보여주지만, 수정 저장 시에는 부호가 있는 원본 qty를 그대로
        // 돌려보내야 한다. update_history가 qty를 통째로 UPDATE하므로 절대값을 보내면
        // RENT(-1)가 +1로 뒤집혀 재고가 깨진다. note도 같이 덮어쓰므로 원본을 보존한다.
        rawQty: Number(h.qty),
        note: h.note || '',
        renter: h.actor || '',
        date: h.date,
      }))
      .sort((a, b) => {
        const codeCmp = String(a.code).localeCompare(String(b.code), undefined, { numeric: true });
        if (codeCmp !== 0) return codeCmp;
        const sizeCmp = String(a.size).localeCompare(String(b.size), undefined, { numeric: true });
        if (sizeCmp !== 0) return sizeCmp;
        const colorCmp = String(a.color).localeCompare(String(b.color));
        if (colorCmp !== 0) return colorCmp;
        return (new Date(a.date) as any) - (new Date(b.date) as any);
      });
  }, [outstandingRentLogs, selectedBrand, codeToProduct]);

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

  const handleDateChange = async (row: any, ymd: string) => {
    if (!ymd) return;
    const nextIso = withDatePart(row.date, ymd);
    if (!nextIso || nextIso === row.date) return;

    setSavingDateId(row.id);
    try {
      await updateHistoryInBackend([{
        id: Number(row.id),
        code: row.code, color: row.color, size: row.size,
        qty: row.rawQty,      // 부호 있는 원본 값 그대로 (재고 영향 없음)
        deltaQty: 0,          // 수량은 안 바꾸므로 재고 델타 없음
        date: nextIso,
        note: row.note,
      }]);
    } catch (err) {
      console.error(err);
      alert('날짜 수정 중 오류가 발생했습니다.');
    } finally {
      setSavingDateId(null);
    }
  };

  const handleReturn = async () => {
    const targets = rentalRows.filter(r => checkedIds.has(r.id));
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
      <div className="card border-0 shadow-sm p-2 mb-2 rounded-3">
        <div className="row g-2">
          <div className="col-12">
            <select
              id="rentalBrandSel"
              className="form-select form-select-sm border-0 bg-light"
              value={selectedBrand}
              onChange={(e) => handleSelectBrand(e.target.value)}
            >
              <option value="">
                {activeBrands.length === 0 ? '현재 대여중인 브랜드 없음' : '브랜드 선택'}
              </option>
              {activeBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm p-2 rounded-3">
        {!selectedBrand ? (
          <div className="text-center text-muted p-4">브랜드를 선택하면 대여중인 내역이 표시됩니다.</div>
        ) : rentalRows.length === 0 ? (
          <div className="text-center text-muted p-4">대여중인 내역이 없습니다.</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th></th>
                    <th>상품코드</th>
                    <th>상품명</th>
                    <th>사이즈</th>
                    <th>컬러</th>
                    <th>수량</th>
                    <th>대여자</th>
                    <th>날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {rentalRows.map(r => (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checkedIds.has(r.id)}
                          onChange={() => toggleChecked(r.id)}
                        />
                      </td>
                      <td>{r.code}</td>
                      <td>{r.name}</td>
                      <td>{r.size}</td>
                      <td>{r.color}</td>
                      <td>{r.qty}</td>
                      <td>{r.renter}</td>
                      <td>
                        <input
                          type="date"
                          className="form-control form-control-sm border-0 bg-light"
                          style={{ minWidth: '140px' }}
                          value={toDateInputValue(r.date)}
                          disabled={savingDateId === r.id}
                          onChange={(e) => handleDateChange(r, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {checkedIds.size > 0 && (
              <div className="p-2 text-end d-flex justify-content-end align-items-center gap-2">
                {confirming && (
                  <span className="text-danger small fw-bold">
                    선택한 {checkedIds.size}건을 반납 처리할까요?
                  </span>
                )}
                {confirming && (
                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={isReturning}
                    onClick={() => setConfirming(false)}
                  >
                    취소
                  </button>
                )}
                <button
                  className="btn btn-sm btn-danger"
                  disabled={isReturning}
                  onClick={() => confirming ? handleReturn() : setConfirming(true)}
                >
                  {isReturning ? '처리 중...' : confirming ? '예, 반납 처리' : `선택 ${checkedIds.size}건 반납 처리`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default RentalPage;
