import { useEffect } from 'react';
import { getProductImage } from '../../utils/helpers';

const NO_IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f8f9fa"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23adb5bd">No Image</text></svg>';

interface ScheduleFullListModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string | null;
  time: string;
  items: any[];
  registeredCodes: Set<string>;
  getDisplayItem: (item: any) => any;
  onSelect: (code: string) => void;
}

const formatDate = (date: string | null) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (isNaN(parsed.getDate())) return date;
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일 (${days[parsed.getDay()]})`;
};

/**
 * 특정 시간대에 편성된 상품 전체(미등록 상품 포함)를 보여 주는 모달.
 * 편성표 본문은 등록된 상품만 노출하므로, 방송 라인업 원본을 확인하는 용도.
 */
const ScheduleFullListModal = ({
  isOpen, onClose, date, time, items, registeredCodes, getDisplayItem, onSelect,
}: ScheduleFullListModalProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const registeredCount = items.filter(i => registeredCodes.has(String(i.code))).length;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', width: '92%', maxWidth: '800px', height: '80vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{time} 방송 전체내역</h3>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              {formatDate(date)} · 총 {items.length}개 (보유 {registeredCount}개)
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', flexShrink: 0 }} aria-label="닫기">&times;</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '15px', alignContent: 'start' }}>
          {items.map((rawItem, idx) => {
            const code = String(rawItem.code);
            const isRegistered = registeredCodes.has(code);
            const item = isRegistered ? getDisplayItem(rawItem) : rawItem;

            return (
              <div
                key={`${code}-${idx}`}
                onClick={isRegistered ? () => onSelect(code) : undefined}
                className={isRegistered ? 'p-card-hover' : undefined}
                style={{ border: '1px solid #eee', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', cursor: isRegistered ? 'pointer' : 'default' }}
              >
                <div style={{ width: '100%', paddingBottom: '100%', position: 'relative', marginBottom: '10px', background: '#f8f9fa', borderRadius: '4px', overflow: 'hidden' }}>
                  <img
                    src={getProductImage(item) || NO_IMAGE}
                    alt={item.name}
                    onError={(e) => { (e.target as HTMLImageElement).src = NO_IMAGE; }}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  <span style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', color: '#fff', background: isRegistered ? 'var(--primary)' : '#adb5bd' }}>
                    {isRegistered ? '보유' : '미등록'}
                  </span>
                </div>
                {item.brand && <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 800 }}>{item.brand}</div>}
                <div style={{ fontSize: '12.5px', fontWeight: 600, lineHeight: 1.3, margin: '2px 0 6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.name}</div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: 'auto' }}>{code}</div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#999' }}>해당 시간에 편성된 상품이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleFullListModal;
