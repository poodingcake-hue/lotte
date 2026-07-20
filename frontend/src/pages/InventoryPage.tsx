import { useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getProductImage } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';

const InventoryPage = () => {
  const { 
    allItems, allStockMap, isLoading, allSupplies,
    invSearchTerm, invSelectedBrand, invSelectedCate,
    setInvSearchTerm, setInvSelectedBrand, setInvSelectedCate
  } = useAppStore();
  const navigate = useNavigate();

  const masterItems = useMemo(() => allItems.filter(i => i.isMaster), [allItems]);

  const brands = useMemo(() => {
    const bSet = new Set(masterItems.map(i => i.brand).filter(Boolean));
    return ['전체', ...Array.from(bSet).sort()];
  }, [masterItems]);

  const categories = useMemo(() => {
    const cSet = new Set(masterItems.map(i => i.category).filter(Boolean));
    return ['전체', ...Array.from(cSet).sort()];
  }, [masterItems]);

  const filteredItems = useMemo(() => {
    let items = masterItems;
    
    // 카테고리가 '반출'인 상품은 카테고리 필터에서 명시적으로 '반출'을 선택했을 때만 노출
    if (invSelectedCate !== '반출') {
      items = items.filter(i => i.category !== '반출');
    }
    
    if (invSelectedBrand && invSelectedBrand !== '전체') {
      items = items.filter(i => i.brand === invSelectedBrand);
    }
    if (invSelectedCate && invSelectedCate !== '전체') {
      items = items.filter(i => i.category === invSelectedCate);
    }
    if (invSearchTerm.trim()) {
      const lower = invSearchTerm.toLowerCase();
      items = items.filter(i =>
        (i.name && i.name.toLowerCase().includes(lower)) ||
        (i.code && String(i.code).toLowerCase().includes(lower)) ||
        (i.brand && i.brand.toLowerCase().includes(lower))
      );
    }
    // 상품코드가 높은 순서대로 정렬
    return [...items].sort((a, b) => String(b.code).localeCompare(String(a.code), undefined, { numeric: true }));
  }, [masterItems, invSelectedBrand, invSelectedCate, invSearchTerm]);

  const handleResetFilter = useCallback(() => {
    setInvSelectedBrand('');
    setInvSelectedCate('');
    setInvSearchTerm('');
  }, [setInvSelectedBrand, setInvSelectedCate, setInvSearchTerm]);

  if (isLoading) {
    return (
      <div id="loading-overlay" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="spinner"></div>
        <div className="mt-2 fw-bold small">LOTTE PB 데이터 동기화</div>
      </div>
    );
  }

  const handleCardClick = (item: any) => {
    navigate(`/detail/${item.code}`);
  };

  return (
    <section className="page-section active" id="page-inventory">
      {/* Filter Bar */}
      <div className="card border-0 shadow-sm p-2 mb-2 rounded-3">
        <div className="row g-2">
          <div className="col-6">
            <select
              id="brandSel"
              className="form-select form-select-sm border-0 bg-light"
              value={invSelectedBrand}
              onChange={(e) => setInvSelectedBrand(e.target.value)}
            >
              {brands.map(b => <option key={b} value={b === '전체' ? '' : b}>{b}</option>)}
            </select>
          </div>
          <div className="col-6">
            <select
              id="cateSel"
              className="form-select form-select-sm border-0 bg-light"
              value={invSelectedCate}
              onChange={(e) => setInvSelectedCate(e.target.value)}
            >
              {categories.map(c => <option key={c} value={c === '전체' ? '' : c}>{c}</option>)}
            </select>
          </div>
          <div className="col-12">
            <input
              type="text"
              id="invSearch"
              className="form-control form-control-sm border-0 bg-light"
              placeholder="상품명, 브랜드, 코드 검색"
              value={invSearchTerm}
              onChange={(e) => setInvSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div id="inventoryContainer" className="product-grid" style={{ paddingBottom: '20px' }}>
        {filteredItems.map(item => {
          const supplyObj = allSupplies?.find(s => String(s.code) === String(item.code));
          const overlay = (supplyObj && supplyObj.text)
            ? <div className="supplies-overlay">{supplyObj.text}</div>
            : null;

          return (
            <div key={item.code} className="p-card" onClick={() => handleCardClick(item)}>
              <div className="p-img-box">
                <img
                  src={getProductImage(item) || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f8f9fa"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23adb5bd">No Image</text></svg>'}
                  className="p-img"
                  alt={item.name}
                />
                {overlay}
              </div>
              <div className="p-info">
                <div className="p-brand">{item.brand || ''}</div>
                <div className="p-name">{item.name || ''}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default InventoryPage;
