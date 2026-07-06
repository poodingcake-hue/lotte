import React, { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';

const HistoryModal = ({ isOpen, onClose, productCode }) => {
  const { allHistory } = useAppStore();

  const historyLogs = useMemo(() => {
    if (!productCode) return [];
    return (allHistory || [])
      .filter(log => String(log.code) === String(productCode))
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // descending
  }, [allHistory, productCode]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '90%', maxWidth: '700px', height: '70vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>재고/대여 변동 이력 (상품코드: {productCode})</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {historyLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>기록된 변동 이력이 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historyLogs.map((log, idx) => {
                const isOut = log.type === 'OUT';
                const isAdjust = log.type === 'ADJUST';
                const colorHex = isOut ? '#ef4444' : isAdjust ? '#f59e0b' : '#10b981';
                
                return (
                  <div key={idx} style={{ padding: '15px', border: '1px solid #eee', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: colorHex, flex: 'none' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                          {log.type === 'IN' ? '재고 입고/회수' : log.type === 'OUT' ? '대여/반출' : '재고 단순조정'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#888' }}>
                          {new Date(log.date).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', color: '#444' }}>
                        <span style={{ marginRight: '10px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{log.color} / {log.size}</span>
                        <span style={{ fontWeight: 'bold', color: log.qty > 0 ? '#10b981' : log.qty < 0 ? '#ef4444' : '#666' }}>
                          {log.qty > 0 ? `+${log.qty}` : log.qty}개
                        </span>
                        {log.actor && <span style={{ marginLeft: '10px', color: '#64748b' }}>(관련자: {log.actor})</span>}
                      </div>
                      {log.note && <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>비고: {log.note}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
