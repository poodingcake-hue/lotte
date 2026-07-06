import { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { getProductImage } from '../../utils/helpers';

const ProductSearchModal = ({ isOpen, onClose, onSelect }) => {
  const { allItems } = useAppStore();
  const [keyword, setKeyword] = useState('');

  const masterItems = useMemo(() => {
    return allItems.filter(i => i.isMaster);
  }, [allItems]);

  const filteredItems = useMemo(() => {
    if (!keyword.trim()) return [];
    const lower = keyword.toLowerCase();
    return masterItems.filter(i => 
      (i.name && i.name.toLowerCase().includes(lower)) ||
      (i.code && i.code.toLowerCase().includes(lower)) ||
      (i.brand && i.brand.toLowerCase().includes(lower))
    ).slice(0, 50); // Limit to 50 for performance
  }, [masterItems, keyword]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '90%', maxWidth: '800px', height: '80vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>등록된 상품 검색</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
        </div>
        
        <div style={{ padding: '20px' }}>
          <input 
            type="text" 
            placeholder="검색어 (브랜드, 상품명, 코드 등)" 
            className="search-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoFocus
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', alignContent: 'start' }}>
          {filteredItems.map(item => (
            <div 
              key={item.code} 
              onClick={() => { onSelect(item); onClose(); }}
              style={{ border: '1px solid #eee', borderRadius: '8px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
              className="p-card-hover"
            >
              <div style={{ width: '100%', paddingBottom: '100%', position: 'relative', marginBottom: '10px', background: '#f8f9fa', borderRadius: '4px', overflow: 'hidden' }}>
                <img 
                  src={getProductImage(item) || 'https://via.placeholder.com/200?text=No+Img'} 
                  alt={item.name} 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} 
                />
              </div>
              <div style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>{item.brand}</div>
              <div style={{ fontSize: '14px', margin: '4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: 'auto' }}>{item.code}</div>
            </div>
          ))}
          {keyword.trim() && filteredItems.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#999' }}>검색 결과가 없습니다.</div>
          )}
          {!keyword.trim() && (
             <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#999' }}>검색어를 입력해주세요.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductSearchModal;
