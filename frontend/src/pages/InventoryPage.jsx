import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getProductImage } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 40;

const InventoryPage = () => {
  const { 
    allItems, allStockMap, isLoading, allSupplies,
    invSearchTerm, invSelectedBrand, invSelectedCate, invVisibleCount,
    setInvSearchTerm, setInvSelectedBrand, setInvSelectedCate, setInvVisibleCount
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
    setInvVisibleCount(PAGE_SIZE);
  }, [setInvSelectedBrand, setInvSelectedCate, setInvSearchTerm, setInvVisibleCount]);

  const visibleItems = filteredItems.slice(0, invVisibleCount);
  const hasMore = invVisibleCount < filteredItems.length;

  if (isLoading) {
    return (
      <div id="loading-overlay" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="spinner"></div>
        <div className="mt-2 fw-bold small">LOTTE PB 데이터 동기화</div>
      </div>
    );
  }

  const handleCardClick = (item) => {
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
              onChange={(e) => { setInvSelectedBrand(e.target.value); setInvVisibleCount(PAGE_SIZE); }}
            >
              {brands.map(b => <option key={b} value={b === '전체' ? '' : b}>{b}</option>)}
            </select>
          </div>
          <div className="col-6">
            <select
              id="cateSel"
              className="form-select form-select-sm border-0 bg-light"
              value={invSelectedCate}
              onChange={(e) => { setInvSelectedCate(e.target.value); setInvVisibleCount(PAGE_SIZE); }}
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
              onChange={(e) => { setInvSearchTerm(e.target.value); setInvVisibleCount(PAGE_SIZE); }}
            />
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div id="inventoryContainer" className="product-grid">
        {visibleItems.map(item => {
          const supplyObj = allSupplies?.find(s => String(s.code) === String(item.code));
          const overlay = (supplyObj && supplyObj.text)
            ? <div className="supplies-overlay">{supplyObj.text}</div>
            : null;

          return (
            <div key={item.code} className="p-card" onClick={() => handleCardClick(item)}>
              <div className="p-img-box">
                <img
                  src={getProductImage(item) || 'https://via.placeholder.com/200?text=No+Img'}
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

      {/* Load More */}
      <div id="loadMoreContainer" className="text-center mt-3" style={{ paddingBottom: '20px' }}>
        {hasMore && (
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setInvVisibleCount(invVisibleCount + PAGE_SIZE)}
          >
            더보기 ({filteredItems.length - invVisibleCount}개 남음)
          </button>
        )}
      </div>
    </section>
  );
};

export default InventoryPage;
