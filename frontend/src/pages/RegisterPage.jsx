import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import ProductSearchModal from '../components/modals/ProductSearchModal';

const RegisterPage = () => {
  const { allStockMap } = useAppStore();
  const [formData, setFormData] = useState({
    code: '',
    brand: '',
    name: '',
    cate: '',
    colors: '',
    sizes: ''
  });

  const [matrixData, setMatrixData] = useState({});
  const [extraSizes, setExtraSizes] = useState(['', '']); // Two extra size columns
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProductSelect = (item) => {
    const colorVal = Array.isArray(item.colors)
      ? item.colors.join(', ')
      : (item.colors || '');

    const sizeVal = Array.isArray(item.sizes)
      ? item.sizes.join(', ')
      : (item.sizes || '');

    setFormData({
      code: item.code || '',
      brand: item.brand || '',
      name: item.name || '',
      cate: item.category || '',
      colors: colorVal,
      sizes: sizeVal
    });
  };

  const handleMatrixChange = (color, size, value) => {
    setMatrixData(prev => ({
      ...prev,
      [`${color}_${size}`]: value
    }));
  };

  const handleExtraSizeChange = (index, value) => {
    const newSizes = [...extraSizes];
    newSizes[index] = value;
    setExtraSizes(newSizes);
  };

  const colors = useMemo(() => formData.colors.split(',').map(s => s.trim()).filter(Boolean), [formData.colors]);
  const sizes = useMemo(() => formData.sizes.split(',').map(s => s.trim()).filter(Boolean), [formData.sizes]);

  const stockMap = allStockMap[formData.code] || [];
  const isAdditional = stockMap.length > 0;

  const lotteImageUrl = useMemo(() => {
    if (formData.code && formData.code.length >= 8) {
      const code = String(formData.code);
      const p1 = code.substring(0, 2);
      const p2 = code.substring(4, 6);
      const p3 = code.substring(2, 4);
      return `https://image2.lotteimall.com/goods/${p1}/${p2}/${p3}/${code}_L.jpg`;
    }
    return '';
  }, [formData.code]);

  const handleSaveProduct = async () => {
    // Implement save logic via store or api
    alert("상품 정보 저장 기능이 호출되었습니다 (API 연동 대기 중)");
  };

  const handleSaveInventory = async () => {
    // Implement inventory save logic
    alert("재고 저장 기능이 호출되었습니다 (API 연동 대기 중)");
  };

  return (
    <section className="page-section active" id="page-register">
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
        
        {/* Left Column: Product Info */}
        <div style={{ flex: 1, minWidth: '320px' }}>
          <div className="dash-card">
            <div className="dash-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="dash-title">상품 기본 정보</span>
              <button className="m-btn m-btn-confirm" onClick={handleSaveProduct} style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '4px', fontWeight: 'bold', width: 'auto', flex: 'none' }}>저장</button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '15px', marginBottom: '10px' }}>
              <span style={{ width: '100px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>상품코드</span>
              <input type="text" name="code" className="modal-input" value={formData.code} onChange={handleChange} style={{ flex: 1, margin: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }} />
              <button onClick={() => setIsSearchOpen(true)} style={{ padding: '0 10px', height: '38px', background: '#e9ecef', border: '1px solid #ced4da', borderLeft: 'none', borderTopRightRadius: '4px', borderBottomRightRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#495057', width: 'auto' }}>불러오기</button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ width: '100px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>브랜드</span>
              <input type="text" name="brand" className="modal-input" value={formData.brand} onChange={handleChange} style={{ flex: 1, margin: 0 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ width: '100px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>상품명</span>
              <input type="text" name="name" className="modal-input" value={formData.name} onChange={handleChange} style={{ flex: 1, margin: 0 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ width: '100px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>카테고리</span>
              <input type="text" name="cate" className="modal-input" placeholder="상의/하의/아우터/" value={formData.cate} onChange={handleChange} style={{ flex: 1, margin: 0 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ width: '100px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>색상 (콤마)</span>
              <input type="text" name="colors" className="modal-input" placeholder="블랙, 화이트" value={formData.colors} onChange={handleChange} style={{ flex: 1, margin: 0 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ width: '100px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>사이즈 (콤마)</span>
              <input type="text" name="sizes" className="modal-input" placeholder="S, M, L" value={formData.sizes} onChange={handleChange} style={{ flex: 1, margin: 0 }} />
            </div>
          </div>
        </div>

        {/* Right Column: Images & Matrix */}
        <div style={{ flex: 2.5, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="dash-card">
            <div className="dash-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="dash-title">이미지 등록</span>
              <button className="m-btn m-btn-confirm" onClick={handleSaveProduct} style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '4px', fontWeight: 'bold', width: 'auto', flex: 'none' }}>저장</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: '15px', alignItems: 'flex-start', paddingBottom: '10px', width: '100%' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>전체이미지</span>
                <div style={{ width: '120px', height: '120px', border: '1px dashed #ccc', borderRadius: '4px', cursor: 'pointer', backgroundImage: lotteImageUrl ? `url(${lotteImageUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {!lotteImageUrl && <span style={{ color: '#999', fontSize: '12px' }}>이미지 없음</span>}
                </div>
              </div>

              {colors.map(c => (
                <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>{c}</span>
                  <div style={{ width: '120px', height: '120px', border: '1px dashed #ccc', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                    <span style={{ color: '#999', fontSize: '20px' }}>+</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="dash-title">
                재고 등록
                {formData.code && (
                  isAdditional 
                  ? <span style={{ fontSize: '12px', color: '#1d4ed8', background: '#dbeafe', padding: '4px 8px', borderRadius: '6px', marginLeft: '8px' }}>🚀 추가 재고 모드</span>
                  : <span style={{ fontSize: '12px', color: '#047857', background: '#d1fae5', padding: '4px 8px', borderRadius: '6px', marginLeft: '8px' }}>✨ 신규 재고 모드</span>
                )}
              </span>
              {(colors.length > 0 && sizes.length > 0 && formData.code) && (
                <button className="m-btn m-btn-confirm" onClick={handleSaveInventory} style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '4px', fontWeight: 'bold', width: 'auto', flex: 'none', background: '#047857' }}>재고 저장</button>
              )}
            </div>
            <div id="reg-matrix-container" style={{ marginTop: '10px' }}>
              {(colors.length > 0 && sizes.length > 0 && formData.code) ? (
                <div style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '14px', background: 'white' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #eee' }}>
                        <th style={{ padding: '15px', fontWeight: 'bold', color: '#333' }}>색상</th>
                        {sizes.map(s => <th key={s} style={{ padding: '15px', fontWeight: 'bold', color: '#333' }}>{s}</th>)}
                        {extraSizes.map((val, idx) => (
                           <th key={`extra-${idx}`} style={{ padding: 0, width: '80px' }}>
                             <input type="text" placeholder="추가" value={val} onChange={(e) => handleExtraSizeChange(idx, e.target.value)} style={{ width: '100%', height: '50px', border: 'none', textAlign: 'center', fontWeight: 'bold', color: '#333', background: 'transparent', outline: 'none' }} />
                           </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {colors.map(c => (
                        <tr key={c} style={{ borderBottom: '1px solid #f1f1f1' }}>
                          <td style={{ padding: '15px', fontWeight: 'bold', color: '#444', borderRight: '1px solid #f1f1f1', background: '#fafafa', whiteSpace: 'nowrap' }}>{c}</td>
                          {sizes.map(s => {
                            const existing = stockMap.find(x => x.color === c && x.size === s);
                            const existingQty = existing ? existing.qty : 0;
                            const placeholder = existingQty > 0 ? `기존: ${existingQty}개` : "0";
                            return (
                              <td key={`${c}-${s}`} style={{ padding: '5px' }}>
                                <input type="number" min="0" className="matrix-input" placeholder={placeholder} value={matrixData[`${c}_${s}`] || ''} onChange={(e) => handleMatrixChange(c, s, e.target.value)} style={{ width: '60px', padding: '8px', textAlign: 'center', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }} />
                              </td>
                            );
                          })}
                          {extraSizes.map((val, idx) => (
                             <td key={`extra-td-${idx}`} style={{ padding: '5px' }}>
                               {val ? <input type="number" min="0" className="matrix-input" value={matrixData[`${c}_${val}`] || ''} onChange={(e) => handleMatrixChange(c, val, e.target.value)} style={{ width: '60px', padding: '8px', textAlign: 'center', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }} /> : null}
                             </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '13px' }}>상품코드, 색상(콤마 구분), 사이즈(콤마 구분)를 입력하시면 재고 등록 매트릭스가 나타납니다.</div>
              )}
            </div>
          </div>
          
        </div>

      </div>

      <ProductSearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onSelect={handleProductSelect} 
      />
    </section>
  );
};

export default RegisterPage;
