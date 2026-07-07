import { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import ProductSearchModal from '../components/modals/ProductSearchModal';
import HistoryModal from '../components/modals/HistoryModal';

const RegisterPage = () => {
  const { allStockMap, apiClient, saveProductToBackend } = useAppStore();
  const [formData, setFormData] = useState({
    code: '',
    brand: '',
    name: '',
    cate: '',
    colors: '',
    sizes: '',
    image: ''
  });

  const [matrixData, setMatrixData] = useState({});
  const [extraSizes, setExtraSizes] = useState(['', '']); 
  const [extraColors, setExtraColors] = useState(['']); 
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Active box for pasting images ('main' or color name)
  const [activeImageBox, setActiveImageBox] = useState('main');
  // URL input for web images
  const [webImageUrl, setWebImageUrl] = useState('');

  const fileInputRef = useRef(null);

  // Parse image string to object
  const imageObj = useMemo(() => {
    if (!formData.image) return { main: '' };
    try {
      const parsed = JSON.parse(formData.image);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
      return { main: formData.image };
    } catch (e) {
      return { main: formData.image };
    }
  }, [formData.image]);

  const updateImageObj = (key, url) => {
    const newObj = { ...imageObj, [key]: url };
    setFormData(prev => ({ ...prev, image: JSON.stringify(newObj) }));
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProductSelect = (item) => {
    const existingStock = allStockMap[String(item.code)] || [];
    let colorVal = '';
    let sizeVal = '';

    const sList = [];
    const cList = [];

    // Prioritize inventory colors and sizes by pushing them FIRST
    existingStock.forEach(s => {
      if (s.size && !sList.includes(String(s.size))) sList.push(String(s.size));
      if (s.color && !cList.includes(String(s.color))) cList.push(String(s.color));
    });

    // Then add master colors and sizes if not already present
    if (item.sizes) {
      const ms = Array.isArray(item.sizes) ? item.sizes : String(item.sizes).split(',');
      ms.forEach(s => {
        const trimmed = String(s).trim();
        if (trimmed && !sList.includes(trimmed)) sList.push(trimmed);
      });
    }
    if (item.colors) {
      const mc = Array.isArray(item.colors) ? item.colors : String(item.colors).split(',');
      mc.forEach(c => {
        const trimmed = String(c).trim();
        if (trimmed && !cList.includes(trimmed)) cList.push(trimmed);
      });
    }

    colorVal = cList.join(', ');
    sizeVal = sList.join(', ');

    setFormData({
      code: item.code || '',
      brand: item.brand || '',
      name: item.name || '',
      cate: item.category || '',
      colors: colorVal,
      sizes: sizeVal,
      image: item.image || ''
    });

    const newMatrixData = {};
    existingStock.forEach(stock => {
      newMatrixData[`${stock.color}_${stock.size}`] = stock.qty;
    });
    setMatrixData(newMatrixData);
  };

  const handleMatrixChange = (color, size, value) => {
    setMatrixData(prev => ({ ...prev, [`${color}_${size}`]: value }));
  };

  const handleExtraSizeChange = (index, value) => {
    const newSizes = [...extraSizes];
    newSizes[index] = value;
    setExtraSizes(newSizes);
  };

  const handleExtraColorChange = (index, value) => {
    const newColors = [...extraColors];
    newColors[index] = value;
    setExtraColors(newColors);
  };

  const colors = useMemo(() => formData.colors.split(',').map(s => s.trim()).filter(Boolean), [formData.colors]);
  const sizes = useMemo(() => formData.sizes.split(',').map(s => s.trim()).filter(Boolean), [formData.sizes]);

  const stockMap = allStockMap[String(formData.code)] || [];
  const isAdditional = stockMap.length > 0;

  // Handle uploading a file to Google Drive via backend
  const uploadFile = async (file) => {
    try {
      setIsUploading(true);
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const webpBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
      const webpFile = new File([webpBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });
      URL.revokeObjectURL(img.src);

      const uploadFormData = new FormData();
      uploadFormData.append('file', webpFile);

      const baseUrl = import.meta.env.VITE_API_URL || 'https://lotte-backend.poodingcake.workers.dev';
      const response = await fetch(baseUrl, { method: 'POST', body: uploadFormData });
      const data = await response.json();
      
      if (data.success) {
        updateImageObj(activeImageBox, data.imageUrl);
      } else {
        alert('업로드 실패: ' + data.message);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleLoadWebImage = () => {
    if (webImageUrl) {
      updateImageObj(activeImageBox, webImageUrl);
      setWebImageUrl('');
    }
  };

  // Paste Event Listener for Global document
  useEffect(() => {
    const handlePaste = async (e) => {
      // Don't intercept if typing in an input (except our webImageUrl input)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.target.name !== 'webImageInput') return; 
      }

      const items = e.clipboardData.items;
      let filePasted = false;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            filePasted = true;
            uploadFile(file);
            break;
          }
        }
      }

      // If text (URL) was pasted and we aren't in an input box
      if (!filePasted && e.target.tagName !== 'INPUT') {
        const text = e.clipboardData.getData('text');
        if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
          e.preventDefault();
          updateImageObj(activeImageBox, text);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [activeImageBox, imageObj]); // Dependencies ensure we use current activeImageBox

  const handleSaveProduct = async () => {
    if (!formData.code) {
       alert("상품코드를 먼저 입력해주세요!");
       return;
    }
    
    try {
        setIsUploading(true);
        const newProduct = {
           ...formData,
           image: JSON.stringify(imageObj),
           isMaster: true
        };
        await saveProductToBackend(newProduct);
        alert("상품 정보(마스터 및 이미지)가 성공적으로 저장되었습니다!");
    } catch (error) {
        alert("상품 정보 저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
        setIsUploading(false);
    }
  };

  // ... inventory save logic (truncated for brevity here, see full replacement below)
  const handleSaveInventory = async () => {
    if (!formData.code) { alert('상품을 먼저 불러오세요.'); return; }
    
    const newLogs = [];
    const newStockMap = { ...allStockMap };
    let currentStock = newStockMap[formData.code] || [];
    const timestamp = new Date().toISOString();
    const flat = [];
    
    colors.forEach(c => {
      sizes.forEach(s => {
        const key = `${c}_${s}`;
        if (matrixData[key] !== undefined) {
           const qty = Number(matrixData[key]);
           if (qty >= 0) {
             const existing = currentStock.find(x => x.color === c && x.size === s);
             const oldQty = existing ? existing.qty : 0;
             if (qty !== oldQty) {
               const delta = qty - oldQty;
               newLogs.push({ code: formData.code, color: c, size: s, type: isAdditional ? (delta > 0 ? 'IN' : 'ADJUST') : 'IN', qty: delta, date: timestamp, actor: '관리자', note: isAdditional ? '기존 재고 수정/추가' : '신규 재고 등록' });
             }
           }
        }
      });
      extraSizes.forEach(s => {
        if (!s) return;
        const key = `${c}_${s}`;
        if (matrixData[key] !== undefined) {
           const qty = Number(matrixData[key]);
           if (qty >= 0) {
             const existing = currentStock.find(x => x.color === c && x.size === s);
             const oldQty = existing ? existing.qty : 0;
             if (qty !== oldQty) {
               const delta = qty - oldQty;
               newLogs.push({ code: formData.code, color: c, size: s, type: isAdditional ? (delta > 0 ? 'IN' : 'ADJUST') : 'IN', qty: delta, date: timestamp, actor: '관리자', note: '신규 사이즈 추가' });
             }
           }
        }
      });
    });

    extraColors.forEach(c => {
      if (!c) return;
      sizes.forEach(s => {
        const key = `${c}_${s}`;
        if (matrixData[key] !== undefined) {
           const qty = Number(matrixData[key]);
           if (qty >= 0) {
             const existing = currentStock.find(x => x.color === c && x.size === s);
             const oldQty = existing ? existing.qty : 0;
             if (qty !== oldQty) {
               const delta = qty - oldQty;
               newLogs.push({ code: formData.code, color: c, size: s, type: 'IN', qty: delta, date: timestamp, actor: '관리자', note: '신규 색상 추가' });
             }
           }
        }
      });
      extraSizes.forEach(s => {
        if (!s) return;
        const key = `${c}_${s}`;
        if (matrixData[key] !== undefined) {
           const qty = Number(matrixData[key]);
           if (qty >= 0) {
             const existing = currentStock.find(x => x.color === c && x.size === s);
             const oldQty = existing ? existing.qty : 0;
             if (qty !== oldQty) {
               const delta = qty - oldQty;
               newLogs.push({ code: formData.code, color: c, size: s, type: 'IN', qty: delta, date: timestamp, actor: '관리자', note: '신규 색상/사이즈 추가' });
             }
           }
        }
      });
    });

    if (newLogs.length === 0 && isAdditional) { alert('변경된 재고 수량이 없습니다.'); return; }

    try {
      const updatedItemStock = [];
      Object.keys(matrixData).forEach(key => {
        const qty = Number(matrixData[key]);
        if (qty > 0) {
           const [color, size] = key.split('_');
           updatedItemStock.push({ color, size, qty });
        }
      });
      newStockMap[formData.code] = updatedItemStock;
      
      // Fix: Only send the inventory for the CURRENT product to avoid race conditions and database corruption
      if (newStockMap[formData.code]) {
        newStockMap[formData.code].forEach(s => flat.push({ code: formData.code, ...s }));
      }
      
      const { apiClient, saveHistoryToBackend, setAllStockMap } = useAppStore.getState();
      await apiClient.post('?action=save_inventory', { type: 'save_inventory', data: flat });
      if (newLogs.length > 0) { await saveHistoryToBackend(newLogs); }
      setAllStockMap(newStockMap);
      alert('재고 저장이 완료되었습니다.');
    } catch (e) {
      console.error(e);
      alert('재고 저장 중 오류가 발생했습니다.');
    }
  };

  
  // Compute Web Reference Image URL automatically
  const webReferenceUrl = useMemo(() => {
    if (formData.code && String(formData.code).length >= 8) {
       const code = String(formData.code);
       const p1 = code.substring(6, 8); // 7th, 8th
       const p2 = code.substring(4, 6); // 5th, 6th
       const p3 = code.substring(2, 4); // 3rd, 4th
       return `https://image2.lotteimall.com/goods/${p1}/${p2}/${p3}/${code}_L1.jpg`;
    }
    return '';
  }, [formData.code]);

  const renderImageBox = (boxKey, title) => {
    const isActive = activeImageBox === boxKey;
    const imgUrl = imageObj[boxKey];
    
    let displayUrl = imgUrl;
    if (imgUrl) {
       const match = imgUrl.match(/id=([a-zA-Z0-9_-]+)/);
       if (match) displayUrl = `https://lh3.googleusercontent.com/d/${match[1]}`;
    }

    return (
      <div 
        key={boxKey}
        onClick={() => setActiveImageBox(boxKey)}
        style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
          padding: '10px',
          border: isActive ? '2px solid #3b82f6' : '1px solid transparent',
          borderRadius: '8px',
          background: isActive ? '#eff6ff' : 'transparent',
          transition: 'all 0.2s',
          cursor: 'pointer'
        }}
        title="클릭하여 선택 후 Ctrl+V로 이미지 붙여넣기"
      >
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: isActive ? '#1d4ed8' : '#333' }}>
          {title} {isActive && '(선택됨)'}
        </span>
        
        <div 
          style={{ 
            width: '120px', height: '120px', 
            border: '1px dashed #ccc', borderRadius: '4px', 
            backgroundImage: displayUrl ? `url(${displayUrl})` : 'none',
            backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#fafafa'
          }}
        >
          {isUploading && isActive ? (
            <span style={{ color: '#007bff', fontSize: '12px', fontWeight: 'bold' }}>업로드 중...</span>
          ) : !displayUrl ? (
            <span style={{ color: '#999', fontSize: '20px' }}>+</span>
          ) : null}
        </div>

        
        
      </div>
    );
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
              <input type="text" name="cate" className="modal-input" placeholder="상의/하의/아우터/잡화" value={formData.cate} onChange={handleChange} style={{ flex: 1, margin: 0 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ width: '100px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>색상 (콤마)</span>
              <input type="text" name="colors" className="modal-input" placeholder="" value={formData.colors} onChange={handleChange} style={{ flex: 1, margin: 0 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ width: '100px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>사이즈 (콤마)</span>
              <input type="text" name="sizes" className="modal-input" placeholder="" value={formData.sizes} onChange={handleChange} style={{ flex: 1, margin: 0 }} />
            </div>
          </div>
        </div>

        {/* Right Column: Images & Matrix */}
        <div style={{ flex: 2.5, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="dash-card">
            <div className="dash-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="dash-title">이미지 등록 (클릭 후 Ctrl+V 로 복사/붙여넣기 가능)</span>
              <button className="m-btn m-btn-confirm" onClick={handleSaveProduct} style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '4px', fontWeight: 'bold', width: 'auto', flex: 'none' }}>저장</button>
            </div>
            
            

            
            <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: '10px', alignItems: 'flex-start', paddingBottom: '10px', width: '100%' }}>
              
              {/* Reference Web Image Box */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '10px', border: '1px solid transparent' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#888' }}>웹이미지(참고용)</span>
                <div 
                  onClick={() => {
                      if (formData.code) {
                          window.open(`https://www.lotteimall.com/goods/viewGoodsDetail.lotte?goods_no=${formData.code}`, '_blank');
                      }
                  }}
                  style={{ 
                    width: '120px', height: '120px', 
                    border: '1px solid #ddd', borderRadius: '4px', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#fff',
                    cursor: formData.code ? 'pointer' : 'default',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                  title={formData.code ? '클릭 시 해당 상품의 웹페이지 열기' : ''}
                >
                  {webReferenceUrl ? (
                      <img 
                          src={webReferenceUrl} 
                          alt="웹이미지" 
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                      />
                  ) : (
                      <span style={{ color: '#ccc', fontSize: '11px' }}>자동불러오기</span>
                  )}
                </div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#999' }}>클릭 시 웹 이동</div>
                
              </div>
              
              <div style={{ width: '1px', background: '#eee', margin: '0 5px' }}></div>
              {renderImageBox('main', '전체이미지')}
              {colors.map(c => renderImageBox(c, c))}
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="m-btn m-btn-confirm" style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '4px', fontWeight: 'bold', width: 'auto', flex: 'none', background: '#64748b' }} onClick={() => setIsHistoryOpen(true)}>재고 수정</button>
                  <button className="m-btn m-btn-confirm" onClick={handleSaveInventory} style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '4px', fontWeight: 'bold', width: 'auto', flex: 'none', background: '#047857' }}>재고 저장</button>
                </div>
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
                                <input type="number" min="0" className="matrix-input" placeholder={placeholder} value={matrixData[`${c}_${s}`] || ''} onChange={(e) => handleMatrixChange(c, s, e.target.value)} style={{ width: '60px', padding: '8px', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '14px' }} />
                              </td>
                            );
                          })}
                          {extraSizes.map((val, idx) => (
                             <td key={`extra-td-${idx}`} style={{ padding: '5px' }}>
                               {val ? <input type="number" min="0" className="matrix-input" value={matrixData[`${c}_${val}`] || ''} onChange={(e) => handleMatrixChange(c, val, e.target.value)} style={{ width: '60px', padding: '8px', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '14px' }} /> : null}
                             </td>
                          ))}
                        </tr>
                      ))}
                      {extraColors.map((cVal, cIdx) => (
                        <tr key={`extra-color-${cIdx}`} style={{ borderBottom: '1px solid #f1f1f1' }}>
                          <td style={{ padding: 0, background: '#fafafa', borderRight: '1px solid #f1f1f1' }}>
                            <input type="text" placeholder="+색상 추가" value={cVal} onChange={(e) => handleExtraColorChange(cIdx, e.target.value)} style={{ width: '100%', height: '50px', border: 'none', textAlign: 'center', fontWeight: 'bold', color: '#444', background: 'transparent', outline: 'none', fontSize: '13px' }} />
                          </td>
                          {sizes.map(s => (
                            <td key={`extra-td-${cIdx}-${s}`} style={{ padding: '5px' }}>
                              {cVal ? <input type="number" min="0" className="matrix-input" value={matrixData[`${cVal}_${s}`] || ''} onChange={(e) => handleMatrixChange(cVal, s, e.target.value)} style={{ width: '60px', padding: '8px', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '14px' }} /> : null}
                            </td>
                          ))}
                          {extraSizes.map((sVal, sIdx) => (
                             <td key={`extra-td-${cIdx}-extra-${sIdx}`} style={{ padding: '5px' }}>
                               {cVal && sVal ? <input type="number" min="0" className="matrix-input" value={matrixData[`${cVal}_${sVal}`] || ''} onChange={(e) => handleMatrixChange(cVal, sVal, e.target.value)} style={{ width: '60px', padding: '8px', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '14px' }} /> : null}
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

      <ProductSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={handleProductSelect} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} productCode={formData.code} />
    </section>
  );
};

export default RegisterPage;
