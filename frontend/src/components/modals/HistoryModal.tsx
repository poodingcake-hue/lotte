import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productCode: string;
}

const HistoryModal = ({ isOpen, onClose, productCode }: HistoryModalProps) => {
  const { allHistory, allItems, updateHistoryInBackend } = useAppStore();
  const [editedLogs, setEditedLogs] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Find product name from master data
  const productName = useMemo(() => {
    if (!productCode) return '';
    const item = allItems.find(i => String(i.code) === String(productCode) && i.isMaster);
    return item ? item.name : '이름 없음';
  }, [allItems, productCode]);

  // Date formatter (YYYY-MM-DD)
  const formatDateForInput = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    try {
      return dateString.split('T')[0];
    } catch(e) {
      return dateString;
    }
  };

  // 로그 구분 라벨. RENT/RETURN 도입 이전(과거) 로그는 대여를 'OUT', 반납을 'IN'+note로만
  // 기록해뒀으므로, 그 과거 로그들도 note로 식별해서 '대여'/'반납'으로 표시한다.
  const getTypeLabel = (log: any) => {
    if (log.type === 'RETURN') return '반납';
    if (log.type === 'RENT') return '대여';
    if (log.type === 'OUT') return '대여';
    if (log.type === 'IN' && log.note === '대여 반납') return '반납';
    if (log.type === 'IN') return '입고';
    return '조정';
  };

  // 이 상품의 히스토리 로그만 추림 (아직 정렬 전)
  const productHistory = useMemo(() => {
    if (!productCode) return [];
    return (allHistory || []).filter(log => String(log.code) === String(productCode));
  }, [allHistory, productCode]);

  // 사이즈/컬러의 "등록 순서" = 등록일 오름차순으로 훑었을 때 각 사이즈/컬러가 처음 등장한 순서.
  // (allStockMap은 현재 집계된 재고 스냅샷일 뿐 등록 순서를 보장하지 않으므로 기준으로 쓰지 않는다)
  const { sizeOrder, colorOrder } = useMemo(() => {
    const byDateAsc = [...productHistory].sort((a, b) => (new Date(a.date) as any) - (new Date(b.date) as any));
    const sizes: any[] = [];
    const colors: any[] = [];
    byDateAsc.forEach(log => {
      if (!sizes.includes(log.size)) sizes.push(log.size);
      if (!colors.includes(log.color)) colors.push(log.color);
    });
    return { sizeOrder: sizes, colorOrder: colors };
  }, [productHistory]);

  const originalHistoryLogs = useMemo(() => {
    return [...productHistory].sort((a, b) => {
      // 1. 등록 시각(날짜+시간) 오름차순 — 같은 날이라도 대여/반납처럼 서로 다른 시각에
      //    일어난 이벤트는 실제 시간 순서 그대로 보여야 하므로 정확한 타임스탬프로 비교
      const dateDiff = (new Date(a.date) as any) - (new Date(b.date) as any);
      if (dateDiff !== 0) return dateDiff;

      // 2. 정확히 같은 시각(같은 저장 묶음, 예: 재고 등록 매트릭스 한 번에 저장)이면 사이즈순
      const sizeIdxA = sizeOrder.indexOf(a.size);
      const sizeIdxB = sizeOrder.indexOf(b.size);
      if (sizeIdxA !== sizeIdxB) return sizeIdxA - sizeIdxB;

      // 3. 그다음 컬러순
      return colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color);
    });
  }, [productHistory, sizeOrder, colorOrder]);

  // Reset edits when modal opens or closes
  useEffect(() => {
    setEditedLogs({});
  }, [isOpen]);

  const handleEdit = (id: string | number, field: string, value: any) => {
    setEditedLogs(prev => ({
      ...prev,
      [id]: {
        ...originalHistoryLogs.find(log => String(log.id) === String(id)),
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    const idsToUpdate = Object.keys(editedLogs);
    if (idsToUpdate.length === 0) {
      alert("수정된 내역이 없습니다.");
      return;
    }

    const payload = idsToUpdate.map(id => {
      const edited = editedLogs[id];
      const original = originalHistoryLogs.find(log => String(log.id) === String(id));
      if (!original) {
        throw new Error(`Original log not found for id: ${id}`);
      }
      const newQty = Number(edited.qty);
      const oldQty = Number(original.qty);
      
      return {
        id: Number(id),
        code: original.code,
        color: original.color,
        size: original.size,
        qty: newQty,
        deltaQty: newQty - oldQty,
        date: edited.date,
        note: edited.note
      };
    });

    setIsSaving(true);
    try {
      await updateHistoryInBackend(payload);
      alert("수정 내역이 성공적으로 저장되고, 재고 장부에 실시간 연동되었습니다!");
      setEditedLogs({});
      // Optionally close the modal
      // onClose();
    } catch (e) {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '95%', maxWidth: '1200px', height: '80vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>엑셀형 재고/대여 이력 관리</h3>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>{productName} ({productCode}) - 수량, 날짜, 비고를 수정하고 저장하면 실제 재고 장부에 자동 반영됩니다.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleSave} 
              disabled={isSaving || Object.keys(editedLogs).length === 0}
              style={{ padding: '8px 16px', background: isSaving ? '#ccc' : Object.keys(editedLogs).length > 0 ? '#10b981' : '#ccc', color: '#fff', border: 'none', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              {isSaving ? '저장 중...' : '수정 내용 저장'}
            </button>
            <button onClick={onClose} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>닫기</button>
          </div>
        </div>
        
        {/* Table Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f8fafc' }}>
          {originalHistoryLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>기록된 변동 이력이 없습니다.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={thStyle}>상품코드</th>
                  <th style={thStyle}>상품명</th>
                  <th style={thStyle}>색상</th>
                  <th style={thStyle}>사이즈</th>
                  <th style={thStyle}>구분</th>
                  <th style={thStyle}>수량 (수정가능)</th>
                  <th style={thStyle}>날짜 (수정가능)</th>
                  <th style={thStyle}>비고 (수정가능)</th>
                </tr>
              </thead>
              <tbody>
                {originalHistoryLogs.map((log) => {
                  const currentData = editedLogs[log.id] || log;
                  const isEdited = !!editedLogs[log.id];
                  
                  return (
                    <tr key={log.id} style={{ background: isEdited ? '#fefce8' : '#fff', borderBottom: '1px solid #eee' }}>
                      <td style={tdStyle}>{log.code}</td>
                      <td style={tdStyle}>{productName}</td>
                      <td style={tdStyle}>{log.color}</td>
                      <td style={tdStyle}>{log.size}</td>
                      <td style={tdStyle}>
                         {/* 색상은 실제 수량 부호(+입고/-반출) 기준 */}
                         <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', background: Number(log.qty) >= 0 ? '#d1fae5' : '#fee2e2', color: Number(log.qty) >= 0 ? '#065f46' : '#991b1b' }}>
                           {getTypeLabel(log)}
                         </span>
                      </td>
                      <td style={tdStyle}>
                        <input 
                          type="number" 
                          value={currentData.qty} 
                          onChange={(e) => handleEdit(log.id, 'qty', e.target.value)}
                          style={{ width: '60px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', textAlign: 'right' }}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input 
                          type="date" 
                          value={formatDateForInput(currentData.date)} 
                          onChange={(e) => handleEdit(log.id, 'date', e.target.value)}
                          style={{ width: '130px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input 
                          type="text" 
                          value={currentData.note || ''} 
                          onChange={(e) => handleEdit(log.id, 'note', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const thStyle = {
  padding: '12px 15px',
  textAlign: 'left' as any,
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#334155',
  borderBottom: '2px solid #cbd5e1'
};

const tdStyle = {
  padding: '12px 15px',
  fontSize: '14px',
  color: '#475569',
  verticalAlign: 'middle' as any
};

export default HistoryModal;
