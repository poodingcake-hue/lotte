import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getProductImage } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 40;

const InventoryPage = () => {
  const { allItems, allStockMap, isLoading, allSupplies } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCate, setSelectedCate] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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
    if (selectedBrand && selectedBrand !== '전체') {
      items = items.filter(i => i.brand === selectedBrand);
    }
    if (selectedCate && selectedCate !== '전체') {
      items = items.filter(i => i.category === selectedCate);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      items = items.filter(i =>
        (i.name && i.name.toLowerCase().includes(lower)) ||
        (i.code && String(i.code).toLowerCase().includes(lower)) ||
        (i.brand && i.brand.toLowerCase().includes(lower))
      );
    }
    return items;
  }, [masterItems, selectedBrand, selectedCate, searchTerm]);

  const handleResetFilter = useCallback(() => {
    setSelectedBrand('');
    setSelectedCate('');
    setSearchTerm('');
    setVisibleCount(PAGE_SIZE);
  }, []);

  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredItems.length;

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
              value={selectedBrand}
              onChange={(e) => { setSelectedBrand(e.target.value); setVisibleCount(PAGE_SIZE); }}
            >
              {brands.map(b => <option key={b} value={b === '전체' ? '' : b}>{b}</option>)}
            </select>
          </div>
          <div className="col-6">
            <select
              id="cateSel"
              className="form-select form-select-sm border-0 bg-light"
              value={selectedCate}
              onChange={(e) => { setSelectedCate(e.target.value); setVisibleCount(PAGE_SIZE); }}
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
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(PAGE_SIZE); }}
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
            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
          >
            더보기 ({filteredItems.length - visibleCount}개 남음)
          </button>
        )}
      </div>
    </section>
  );
};

export default InventoryPage;
