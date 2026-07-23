import { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import ProductSearchModal from '../components/modals/ProductSearchModal';
import HistoryModal from '../components/modals/HistoryModal';
import { removeBackground } from '../api/falClient';
import { cropTransparentMargins } from '../utils/imageCrop';

const RegisterPage = () => {
  const { allStockMap, apiClient, saveProductToBackend } = useAppStore();
  const [formData, setFormData] = useState({
    code: '',
    brand: '',
    name: '',
    category: '',
    colors: '',
    sizes: '',
    image: ''
  });

  const [matrixData, setMatrixData] = useState<Record<string, string>>({});
  const [extraSizes, setExtraSizes] = useState(['', '']); 
  const [extraColors, setExtraColors] = useState(['']); 
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  
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

  // AI 치수분석 결과(카테고리별로 필드가 다름 — 하의는 허리둘레/엉덩이둘레/허벅지둘레, 상의·아우터는
  // 어깨너비/가슴둘레/소매기장 등)를 표로 보여주기 위해, 실제 들어있는 필드를 그대로 열로 사용한다.
  const sizeAnalysisFields = useMemo(() => {
    const sizes = imageObj.length_cm;
    if (!Array.isArray(sizes) || sizes.length === 0) return [];
    const fieldSet = new Set<string>();
    sizes.forEach((entry: any) => {
      Object.keys(entry || {}).forEach(k => { if (k !== 'category') fieldSet.add(k); });
    });
    return Array.from(fieldSet);
  }, [imageObj.length_cm]);

  const updateImageObj = (key: string, url: string) => {
    const newObj = { ...imageObj, [key]: url };
    setFormData(prev => ({ ...prev, image: JSON.stringify(newObj) }));
  };

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProductSelect = (item: any) => {
    const existingStock = allStockMap[String(item.code)] || [];
    let colorVal = '';
    let sizeVal = '';

    const sList: string[] = [];
    const cList: string[] = [];

    // Prioritize inventory colors and sizes by pushing them FIRST
    existingStock.forEach((s: any) => {
      if (s.size && !sList.includes(String(s.size))) sList.push(String(s.size));
      if (s.color && !cList.includes(String(s.color))) cList.push(String(s.color));
    });

    // Then add master colors and sizes if not already present
    if (item.sizes) {
      const ms = Array.isArray(item.sizes) ? item.sizes : String(item.sizes).split(',');
      ms.forEach((s: any) => {
        const trimmed = String(s).trim();
        if (trimmed && !sList.includes(trimmed)) sList.push(trimmed);
      });
    }
    if (item.colors) {
      const mc = Array.isArray(item.colors) ? item.colors : String(item.colors).split(',');
      mc.forEach((c: any) => {
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
      category: item.category || '',
      colors: colorVal,
      sizes: sizeVal,
      image: item.image || ''
    });

    // Matrix is always "how many to add now" — never prefilled with existing stock,
    // so it never doubles as an editable "current total" field.
    setMatrixData({});
  };

  const handleMatrixChange = (color: string, size: string, value: string) => {
    setMatrixData(prev => ({ ...prev, [`${color}_${size}`]: value }));
  };

  const handleExtraSizeChange = (index: number, value: string) => {
    const newSizes = [...extraSizes];
    newSizes[index] = value;
    setExtraSizes(newSizes);
  };

  const handleExtraColorChange = (index: number, value: string) => {
    const newColors = [...extraColors];
    newColors[index] = value;
    setExtraColors(newColors);
  };

  const colors = useMemo(() => formData.colors.split(',').map(s => s.trim()).filter(Boolean), [formData.colors]);
  const sizes = useMemo(() => formData.sizes.split(',').map(s => s.trim()).filter(Boolean), [formData.sizes]);

  const stockMap = allStockMap[String(formData.code)] || [];
  const isAdditional = stockMap.length > 0;

  // Handle uploading a file to Cloudflare Worker via backend
  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0);

      const webpBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
      if (!webpBlob) throw new Error('WebP conversion failed');
      const webpFile = new File([webpBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });
      URL.revokeObjectURL(img.src);

      const uploadFormData = new FormData();
      uploadFormData.append('file', webpFile);

      const res = await apiClient.post('', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      const data = res.data;
      
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
      if (fileInputRef.current) (fileInputRef.current as any).value = '';
    }
  };

  const handleImageUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleLoadWebImage = () => {
    if (webImageUrl) {
      updateImageObj(activeImageBox, webImageUrl);
      setWebImageUrl('');
    }
  };

  const handleAnalyzeSizeChart = async () => {
    const imageUrl = imageObj.size;
    if (!imageUrl) {
      alert('상세사이즈 이미지를 먼저 등록해주세요!');
      return;
    }
    if (!formData.code) {
      alert('상품코드를 먼저 입력해주세요!');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.substring(result.indexOf(',') + 1);
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const res = await apiClient.post('', {
        type: 'analyze_size_chart',
        data: {
          imageBase64: base64Data,
          mimeType: blob.type,
          category: formData.category
        }
      });
      
      if (res.data.success && res.data.data && res.data.data.sizes) {
        const parsedSizes = res.data.data.sizes;
        // 마스터 정보(사이즈 콤마)는 덮어쓰지 않고 내부 데이터(image.length_cm)에만 저장합니다.
        
        const newImageObj = {
          ...imageObj,
          length_cm: parsedSizes
        };
        const newImageStr = JSON.stringify(newImageObj);

        setFormData(prev => ({
          ...prev,
          image: newImageStr
        }));

        // 이미지등록 쪽 "상품 저장" 버튼을 누르지 않아도 치수분석 결과가 바로 DB에 반영되도록,
        // 여기서 현재 폼 데이터를 그대로 upsert한다 (이미지 누끼 처리는 하지 않음 — 그건 상품 저장의 몫).
        await saveProductToBackend({ ...formData, image: newImageStr, isMaster: true });

        alert('AI 치수 분석 완료! 사이즈 목록이 자동으로 입력되고 데이터베이스에 저장되었습니다.');
      } else {
        alert('치수 분석 실패: ' + (res.data.error || '알 수 없는 에러가 발생했습니다.'));
      }
    } catch (e: any) {
      console.error(e);
      alert('치수 분석 에러: ' + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };


  // Paste Event Listener for Global document
  useEffect(() => {
    const handlePaste = async (e: any) => {
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
        alert("저장을 시작합니다. (이미지 배경 제거(누끼) 작업이 포함되어 약 10~20초 정도 소요될 수 있습니다...)");
        
        // --- 1. 누끼(배경 제거) 작업 ---
        const processedImageObj = { ...imageObj };
        for (const key of Object.keys(processedImageObj)) {
            // web, size, size_chart, length_cm 등 옷 이미지가 아닌 데이터는 제외
            if (key !== 'web' && key !== 'size' && key !== 'size_chart' && key !== 'length_cm') {
                try {
                    let imgData = processedImageObj[key];
                    if (!imgData) continue;
                    
                    console.log(`[누끼] 키: ${key}, 데이터 시작: ${imgData.substring(0, 60)}...`);
                    
                    // 이미 누끼 처리된 R2 URL이면 건너뛰기 (파일명에 "nukki"가 포함)
                    if (imgData.includes('nukki')) {
                        console.log(`[누끼] ${key}: 이미 누끼 처리 완료 → 건너뜀`);
                        continue;
                    }
                    
                    // R2 URL 또는 외부 URL → 프록시로 Base64 변환
                    if (imgData.startsWith('http://') || imgData.startsWith('https://')) {
                        console.log(`[누끼] ${key}: URL 감지 → 프록시로 Base64 변환 시도`);
                        const proxyRes = await apiClient.post('', { type: 'proxy_image', data: { imageUrl: imgData } });
                        if (proxyRes.data && proxyRes.data.success) {
                            imgData = proxyRes.data.base64;
                            console.log(`[누끼] ${key}: 프록시 성공, Base64 길이: ${imgData.length}`);
                        } else {
                            throw new Error("프록시 변환 실패: " + proxyRes.data?.message);
                        }
                    }

                    // data:image 형태 → fal.ai 누끼 처리
                    if (imgData.startsWith('data:image')) {
                        console.log(`[누끼] ${key}: fal.ai 누끼 요청 시작...`);
                        let nukkiResult = await removeBackground(imgData);
                        console.log(`[누끼] ${key}: 누끼 완료! 결과: ${nukkiResult}`);

                        // 투명 여백 자동 크롭 & 총장(cm) 비례 이미지 리사이즈 (1cm = 8px)
                        try {
                            console.log(`[누끼] ${key}: 이미지 여백 크롭 & 총장 비례 리사이즈 시작...`);
                            
                            let targetLengthCm: number | undefined = undefined;
                            if (processedImageObj.length_cm && Array.isArray(processedImageObj.length_cm) && processedImageObj.length_cm.length > 0) {
                                const baseEntry = processedImageObj.length_cm[0]; // 가장 작은 사이즈
                                const parsedLen = parseFloat(baseEntry['총장']);
                                if (!isNaN(parsedLen) && parsedLen > 0) {
                                    targetLengthCm = parsedLen;
                                    console.log(`[누끼] ${key}: 기준 총장(cm): ${targetLengthCm}cm → 목표 높이: ${targetLengthCm * 8}px`);
                                }
                            }
                            
                            const croppedBase64 = await cropTransparentMargins(nukkiResult, targetLengthCm);
                            
                            // 크롭/리사이즈된 이미지를 R2에 업로드
                            const blob = await (await fetch(croppedBase64)).blob();
                            const formData = new FormData();
                            formData.append('file', blob, `nukki_cropped_${Date.now()}.png`);
                            
                            const uploadRes = await apiClient.post('', formData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            });
                            
                            if (uploadRes.data && uploadRes.data.success) {
                                nukkiResult = uploadRes.data.imageUrl;
                                console.log(`[누끼] ${key}: 여백 크롭 & 리사이즈 완료! R2 저장: ${nukkiResult}`);
                            }
                        } catch (cropErr) {
                            console.warn(`[누끼] ${key}: 크롭 과정 오류, 누끼 원본 유지:`, cropErr);
                        }

                        processedImageObj[key] = nukkiResult;
                    } else {
                        console.warn(`[누끼] ${key}: 처리 불가 (data:image로 시작하지 않음)`);
                    }
                } catch (e: any) {
                    console.error(`[누끼] ${key}: 실패!!!`, e);
                    alert(`누끼 실패 (${key}): ${e.message || e}. 원본 이미지로 저장합니다.`);
                    // 실패 시 원본 이미지를 그대로 사용
                }
            }
        }
        // 상태 업데이트하여 화면에도 반영
        setFormData(prev => ({ ...prev, image: JSON.stringify(processedImageObj) }));

        // --- 2. 상품 저장 ---
        const newProduct = {
           ...formData,
           image: JSON.stringify(processedImageObj),
           isMaster: true
        };
        await saveProductToBackend(newProduct);
        alert("상품 정보(마스터/이미지)가 성공적으로 등록되었습니다! 누끼 작업 완료!");
    } catch (error) {
        alert("상품 정보 저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
        setIsUploading(false);
    }
  };

  // Matrix cells are always "how many to add right now" — never a delta against
  // whatever the current total happens to be. Every positive cell becomes a
  // brand-new IN event in inventory_history; empty/0 cells are simply skipped.
  const handleSaveInventory = async () => {
    if (!formData.code) { alert('상품을 먼저 불러오세요.'); return; }

    const newLogs: any[] = [];
    const timestamp = new Date().toISOString();

    const addLog = (color: string, size: string, note: string) => {
      const raw = matrixData[`${color}_${size}`];
      if (raw === undefined) return;
      const qty = Number(raw);
      if (qty > 0) {
        newLogs.push({ code: formData.code, color, size, type: 'IN', qty, date: timestamp, actor: '관리자', note });
      }
    };

    colors.forEach(c => {
      sizes.forEach(s => addLog(c, s, isAdditional ? '재고 추가 입고' : '신규 재고 등록'));
      extraSizes.forEach(s => { if (s) addLog(c, s, '신규 사이즈 추가'); });
    });

    extraColors.forEach(c => {
      if (!c) return;
      sizes.forEach(s => addLog(c, s, '신규 색상 추가'));
      extraSizes.forEach(s => { if (s) addLog(c, s, '신규 색상/사이즈 추가'); });
    });

    if (newLogs.length === 0) { alert('입고할 수량을 입력해주세요.'); return; }

    try {
      // Optimistic local update: add the entered quantities on top of whatever's there.
      const newStockMap: Record<string, any[]> = { ...allStockMap };
      const currentStock = (newStockMap[formData.code] || []).map(x => ({ ...x }));
      newLogs.forEach(log => {
        const existing = currentStock.find(x => x.color === log.color && x.size === log.size);
        if (existing) existing.qty = Number(existing.qty) + log.qty;
        else currentStock.push({ color: log.color, size: log.size, qty: log.qty });
      });
      newStockMap[formData.code] = currentStock;

      // Inventory is derived from inventory_history — saving stock means only
      // appending the IN events above, never writing a stock snapshot directly.
      const { saveHistoryToBackend, setAllStockMap } = useAppStore.getState();
      await saveHistoryToBackend(newLogs);
      setAllStockMap(newStockMap);
      setMatrixData({});
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

  const renderImageBox = (boxKey: string, title: string) => {
    const isActive = activeImageBox === boxKey;
    const imgUrl = imageObj[boxKey];
    
    let displayUrl = imgUrl;

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
            backgroundColor: '#fafafa',
            ...(displayUrl && boxKey !== 'main' && boxKey !== 'size' ? {
              // Add checkerboard background to visualize transparency (nukki)
              backgroundImage: `url(${displayUrl}), repeating-linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), repeating-linear-gradient(45deg, #ccc 25%, #fafafa 25%, #fafafa 75%, #ccc 75%, #ccc)`,
              backgroundPosition: 'center, 0 0, 4px 4px',
              backgroundSize: 'contain, 8px 8px, 8px 8px'
            } : {}),
            position: 'relative'
          }}
        >
          {isUploading && isActive ? (
            <span style={{ color: '#007bff', fontSize: '12px', fontWeight: 'bold' }}>업로드 중...</span>
          ) : !displayUrl ? (
            <span style={{ color: '#999', fontSize: '20px' }}>+</span>
          ) : null}
        </div>

        {boxKey === 'size' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAnalyzeSizeChart();
            }}
            disabled={isAnalyzing}
            className="m-btn"
            style={{
              marginTop: '5px',
              padding: '4px 8px',
              fontSize: '11px',
              borderRadius: '4px',
              background: imgUrl ? '#0284c7' : '#94a3b8',
              color: '#fff',
              border: 'none',
              fontWeight: 'bold',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            {isAnalyzing ? '분석 및 저장 중...' : '🔍 AI 치수분석 및 저장'}
          </button>
        )}
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
              <input type="text" name="category" className="modal-input" placeholder="상의/하의/아우터/잡화" value={formData.category} onChange={handleChange} style={{ flex: 1, margin: 0 }} />
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

          {sizeAnalysisFields.length > 0 && (
            <div className="dash-card" style={{ marginTop: '20px' }}>
              <div className="dash-title-row">
                <span className="dash-title">AI 치수분석 결과</span>
              </div>
              <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={sizeThStyle}>사이즈</th>
                      {sizeAnalysisFields.map(f => <th key={f} style={sizeThStyle}>{f}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {imageObj.length_cm.map((entry: any, i: number) => (
                      <tr key={i}>
                        <td style={sizeTdStyle}>{entry.category}</td>
                        {sizeAnalysisFields.map(f => <td key={f} style={sizeTdStyle}>{entry[f] ?? '-'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
              {renderImageBox('size', '상세사이즈')}
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
                          {sizes.map(s => (
                              <td key={`${c}-${s}`} style={{ padding: '5px' }}>
                                <input type="number" min="0" className="matrix-input" placeholder="0" value={matrixData[`${c}_${s}`] || ''} onChange={(e) => handleMatrixChange(c, s, e.target.value)} style={{ width: '60px', padding: '8px', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', fontSize: '14px' }} />
                              </td>
                          ))}
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

const sizeThStyle = {
  padding: '6px 8px',
  textAlign: 'left' as const,
  fontWeight: 'bold' as const,
  color: '#334155',
  borderBottom: '2px solid #cbd5e1',
  whiteSpace: 'nowrap' as const
};

const sizeTdStyle = {
  padding: '6px 8px',
  color: '#475569',
  borderBottom: '1px solid #eee',
  whiteSpace: 'nowrap' as const
};

export default RegisterPage;
