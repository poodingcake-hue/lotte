import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useVtonStore } from '../../store/useVtonStore';
import { useVtonGeneration } from './hooks/useVtonGeneration';
import { callFalRestApi } from '../../api/falClient';
import { getProductImage } from './utils';
import ModelSelector from './ModelSelector';
import LayerBox from './LayerBox';
import ResultPanel from './ResultPanel';
import GallerySection from './GallerySection';
import UploadModal from './UploadModal';
import SelectionModal from './SelectionModal';
import GalleryPopup from './GalleryPopup';
import { apiClient } from '../../api/client';
import './VtonPage.css';

const VtonPage = () => {
    // App Store
    const allItems = useAppStore(state => state.allItems);
    
    // Vton Store
    const model = useVtonStore(state => state.model);
    const setModel = useVtonStore(state => state.setModel);
    const top = useVtonStore(state => state.top);
    const setTop = useVtonStore(state => state.setTop);
    const bottom = useVtonStore(state => state.bottom);
    const setBottom = useVtonStore(state => state.setBottom);
    const outer = useVtonStore(state => state.outer);
    const setOuter = useVtonStore(state => state.setOuter);
    
    const targetCodesInput = useVtonStore(state => state.targetCodesInput);
    const setTargetCodesInput = useVtonStore(state => state.setTargetCodesInput);
    const targetCodes = useVtonStore(state => state.targetCodes);
    const setTargetCodes = useVtonStore(state => state.setTargetCodes);
    
    const bodyAnalysis = useVtonStore(state => state.bodyAnalysis);
    const setBodyAnalysis = useVtonStore(state => state.setBodyAnalysis);

    const allCustomModels = useVtonStore(state => state.allCustomModels);
    const allGallery = useVtonStore(state => state.allGallery);
    const saveCustomModelToBackend = useVtonStore(state => state.saveCustomModelToBackend);
    const saveGalleryToBackend = useVtonStore(state => state.saveGalleryToBackend);
    const deleteGalleryFromBackend = useVtonStore(state => state.deleteGalleryFromBackend);
    
    // UI-only States
    const [selectedGalleryItem, setSelectedGalleryItem] = useState<any>(null);
    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; layer: 'top' | 'bottom' | 'outer' | null }>({ isOpen: false, layer: null });
    const [modalTab, setModalTab] = useState('product'); // 'product' or 'prompt'
    const [searchTerm, setSearchTerm] = useState('');
    const [promptText, setPromptText] = useState('');
    const [isPromptGenerating, setIsPromptGenerating] = useState(false);

    // Upload Model Modal State
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadName, setUploadName] = useState('');
    const [uploadHeight, setUploadHeight] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Generation Hooks
    const {
        isGenerating,
        progressText,
        finalResult,
        characterSheetResult,
        isGeneratingSheet,
        videoResult,
        isVideoGenerating,
        videoProgressText,
        startVtonProcess,
        generateCharacterSheet,
        generateVideo
    } = useVtonGeneration();

    useEffect(() => {
        if (!model.url && allCustomModels && allCustomModels.length > 0) {
            setModel({ type: 'preset', url: allCustomModels[0].url });
        }
    }, [allCustomModels, model.url]);

    // 상의/하의/아우터 박스가 각자 따로 박스 높이에 맞춰 그려지면, 실제로는 총장이 2배 가까이
    // 차이나는 옷들도 미리보기에서 비슷한 크기로 보여서 실제 크기 차이를 알 수 없었다. 그래서 세
    // 박스 중 가장 긴 총장을 기준으로 나머지를 비례해서 작게 그리도록, 여기서 공통 기준을 계산한다.
    const getBaseLengthCm = (item: any): number | null => {
        if (!item || !item.image) return null;
        try {
            const imgObj = typeof item.image === 'string' ? JSON.parse(item.image) : item.image;
            const sizes = imgObj?.length_cm;
            if (!Array.isArray(sizes) || sizes.length === 0) return null;
            const len = parseFloat(sizes[0]['총장']);
            return !isNaN(len) && len > 0 ? len : null;
        } catch (e) {
            return null;
        }
    };
    const topLengthCm = getBaseLengthCm(top.item);
    const bottomLengthCm = getBaseLengthCm(bottom.item);
    const outerLengthCm = getBaseLengthCm(outer.item);
    const availableLengths = [topLengthCm, bottomLengthCm, outerLengthCm].filter((v): v is number => v !== null);
    const maxLengthCm = availableLengths.length > 0 ? Math.max(...availableLengths) : null;

    const openModal = (layer: 'top' | 'bottom' | 'outer') => {
        setModalConfig({ isOpen: true, layer });
        setModalTab('product');
        setSearchTerm('');
        const currentState = layer === 'top' ? top : layer === 'bottom' ? bottom : outer;
        setPromptText(currentState.prompt || '');
    };

    const closeModal = () => setModalConfig({ isOpen: false, layer: null });

    const selectProductColor = (item: any, colorCode: string | null) => {
        const layer = modalConfig.layer;
        let imgUrl = "";
        try {
            const imgObj = JSON.parse(item.image);
            if (colorCode && imgObj[colorCode]) {
                imgUrl = imgObj[colorCode];
            } else {
                imgUrl = getProductImage(item);
            }
        } catch (e) {
            imgUrl = getProductImage(item);
        }

        const defaultSize = item.sizes ? (Array.isArray(item.sizes) ? item.sizes[0] : String(item.sizes).split(',')[0]?.trim()) : '';

        if (imgUrl) {
            if (layer === 'bottom') setBottom(prev => ({ ...prev, url: imgUrl, type: 'product', item, colorCode, sizeCode: defaultSize }));
            if (layer === 'top') setTop(prev => ({ ...prev, url: imgUrl, type: 'product', item, colorCode: defaultSize }));
            if (layer === 'outer') setOuter(prev => ({ ...prev, url: imgUrl, type: 'product', item, colorCode: defaultSize }));
            closeModal();
        } else {
            alert("해당 컬러의 이미지를 찾을 수 없습니다.");
        }
    };

    const changeColor = (layerName: 'top' | 'bottom' | 'outer', direction: number) => {
        let currentState = layerName === 'top' ? top : layerName === 'bottom' ? bottom : outer;
        if (!currentState.item) return;
        
        let colors: string[] = [];
        let imgObj: any = null;
        try { 
            imgObj = JSON.parse(currentState.item.image); 
            colors = Object.keys(imgObj).filter(k => k !== 'main' && k !== 'size' && k !== 'length_cm');
        } catch(e) { return; }
        
        if (colors.length === 0) return;
        
        let currentIndex = colors.indexOf(currentState.colorCode || "");
        if (currentIndex === -1) currentIndex = 0;
        
        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = colors.length - 1;
        if (newIndex >= colors.length) newIndex = 0;
        
        const newColorCode = colors[newIndex];
        let cUrl = imgObj[newColorCode];
        const finalUrl = cUrl;
        
        if (finalUrl) {
            if (layerName === 'top') setTop(prev => ({ ...prev, url: finalUrl, colorCode: newColorCode }));
            if (layerName === 'bottom') setBottom(prev => ({ ...prev, url: finalUrl, colorCode: newColorCode }));
            if (layerName === 'outer') setOuter(prev => ({ ...prev, url: finalUrl, colorCode: newColorCode }));
        }
    };

    const handleQuickSelect = (layerName: 'top' | 'bottom' | 'outer', item: any) => {
        let defaultColor: string | null = null;
        try {
            const imgObj = JSON.parse(item.image);
            const colors = Object.keys(imgObj).filter(k => k !== 'main' && k !== 'size' && k !== 'length_cm');
            if (colors.length > 0) defaultColor = colors[0];
        } catch(e) {}
        
        let imgUrl = "";
        try {
            const imgObj = JSON.parse(item.image);
            if (defaultColor && imgObj[defaultColor]) {
                imgUrl = imgObj[defaultColor];
            } else {
                imgUrl = getProductImage(item);
            }
        } catch (e) {
            imgUrl = getProductImage(item);
        }

        const defaultSize = item.sizes ? (Array.isArray(item.sizes) ? item.sizes[0] : String(item.sizes).split(',')[0]?.trim()) : '';

        if (imgUrl) {
            if (layerName === 'bottom') setBottom(prev => ({ ...prev, url: imgUrl, type: 'product', item, colorCode: defaultColor, sizeCode: defaultSize }));
            if (layerName === 'top') setTop(prev => ({ ...prev, url: imgUrl, type: 'product', item, colorCode: defaultColor, sizeCode: defaultSize }));
            if (layerName === 'outer') setOuter(prev => ({ ...prev, url: imgUrl, type: 'product', item, colorCode: defaultColor, sizeCode: defaultSize }));
        }
    };

    const handleGeneratePromptImage = async () => {
        const layer = modalConfig.layer;
        if (!promptText) { alert('프롬프트를 입력하세요.'); return; }
        
        setIsPromptGenerating(true);
        try {
            const payload = {
                prompt: `A highly detailed, clean studio photography of a clothing item laid flat on a solid white background. The item is: ${promptText}. Professional e-commerce style.`,
                image_size: "square",
                num_inference_steps: 28
            };
            const res = await callFalRestApi('fal-ai/flux-pro/v1.1', payload);
            if (res && res.images && res.images[0]) {
                const url = res.images[0].url;
                if (layer === 'bottom') setBottom(prev => ({ ...prev, url, prompt: promptText, type: 'prompt' }));
                if (layer === 'top') setTop(prev => ({ ...prev, url, prompt: promptText, type: 'prompt' }));
                if (layer === 'outer') setOuter(prev => ({ ...prev, url, prompt: promptText, type: 'prompt' }));
                closeModal();
            }
        } catch (e) {
            alert('이미지 생성 실패:\n' + (e as any).message);
        } finally {
            setIsPromptGenerating(false);
        }
    };

    const handleUploadModel = async () => {
        if (!uploadName || !uploadFile) {
            alert('모델 이름과 이미지를 모두 입력하세요.');
            return;
        }
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            const res = await apiClient.post('', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            const data = res.data;
            if (data.success && data.imageUrl) {
                await saveCustomModelToBackend(uploadName, data.imageUrl, uploadHeight);
                alert('모델이 등록되었습니다.');
                setUploadModalOpen(false);
                setUploadName('');
                setUploadHeight('');
                setUploadFile(null);
                setModel({ type: 'preset', url: data.imageUrl });
            } else {
                throw new Error(data.message || 'Upload failed');
            }
        } catch (e) {
            console.error(e);
            alert('업로드 실패: ' + (e as any).message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveGallery = async (type: string, url: string) => {
        if (!url) return;
        try {
            await saveGalleryToBackend(type, url);
            alert('갤러리에 저장되었습니다! (하단에서 확인하세요)');
        } catch (e) {
            alert('저장 실패: ' + (e as any).message);
        }
    };

    const handleApplyCodes = () => {
        const codes = targetCodesInput.split(/[, ]+/).map(c => c.trim()).filter(c => c);
        setTargetCodes(codes);
    };

    return (
        <div className="vton-container container-fluid p-3" style={{position: 'relative'}}>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-3">
                    <h4 className="fw-bold m-0" style={{color: 'var(--primary)', fontSize: '18px'}}>가상착장 스튜디오</h4>
                    <div className="d-flex align-items-center gap-1" style={{background:'#fff', border:'1px solid #ddd', borderRadius:'4px', padding:'2px 4px'}}>
                        <input type="text" className="form-control form-control-sm border-0" placeholder="상품코드 콤마로 다중입력" style={{width: '250px', fontSize:'12px', boxShadow:'none'}} value={targetCodesInput} onChange={e => setTargetCodesInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleApplyCodes()} />
                        <button className="btn btn-sm btn-dark fw-bold" style={{fontSize:'11px', whiteSpace:'nowrap'}} onClick={handleApplyCodes}>코드 적용</button>
                        <button className="btn btn-sm btn-outline-secondary fw-bold" style={{fontSize:'11px', whiteSpace:'nowrap'}} onClick={() => { 
                            setTargetCodesInput(''); 
                            setTargetCodes([]); 
                            setTop({ type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' });
                            setBottom({ type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' });
                            setOuter({ type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' });
                        }}>초기화</button>
                    </div>
                </div>
                <button className="btn btn-success fw-bold px-4 py-1" onClick={() => startVtonProcess(model, top, bottom, outer, bodyAnalysis)} disabled={isGenerating}>
                    {isGenerating ? '합성 중...' : '▶ 가상착장 시작'}
                </button>
            </div>
            
            <div className="d-flex flex-nowrap gap-2 mb-4 w-100" style={{ minHeight: '75vh', overflowX: 'auto' }}>
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>
                    <ModelSelector 
                        model={model} 
                        setModel={setModel} 
                        allCustomModels={allCustomModels} 
                        setUploadModalOpen={setUploadModalOpen} 
                        bodyAnalysis={bodyAnalysis} 
                        setBodyAnalysis={setBodyAnalysis} 
                    />
                </div>
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>
                    <LayerBox layerName="top" layerTitle="상의" state={top} setState={setTop} targetCodes={targetCodes} allItems={allItems} handleQuickSelect={handleQuickSelect} openModal={openModal} changeColor={changeColor} lengthCm={topLengthCm} maxLengthCm={maxLengthCm} />
                </div>
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>
                    <LayerBox layerName="bottom" layerTitle="하의" state={bottom} setState={setBottom} targetCodes={targetCodes} allItems={allItems} handleQuickSelect={handleQuickSelect} openModal={openModal} changeColor={changeColor} lengthCm={bottomLengthCm} maxLengthCm={maxLengthCm} />
                </div>
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>
                    <LayerBox layerName="outer" layerTitle="아우터" state={outer} setState={setOuter} targetCodes={targetCodes} allItems={allItems} handleQuickSelect={handleQuickSelect} openModal={openModal} changeColor={changeColor} lengthCm={outerLengthCm} maxLengthCm={maxLengthCm} />
                </div>
                <div className="d-flex flex-column" style={{ flex: '0 0 35%', minWidth: '450px' }}>
                    <ResultPanel 
                        isGenerating={isGenerating} 
                        progressText={progressText} 
                        finalResult={finalResult} 
                        generateCharacterSheet={generateCharacterSheet} 
                        isGeneratingSheet={isGeneratingSheet} 
                        characterSheetResult={characterSheetResult} 
                        generateVideo={generateVideo} 
                        isVideoGenerating={isVideoGenerating} 
                        videoProgressText={videoProgressText} 
                        videoResult={videoResult} 
                        handleSaveGallery={handleSaveGallery} 
                    />
                </div>
            </div>

            <GallerySection allGallery={allGallery} setSelectedGalleryItem={setSelectedGalleryItem} deleteGalleryFromBackend={deleteGalleryFromBackend} />
            
            <UploadModal 
                uploadModalOpen={uploadModalOpen} 
                setUploadModalOpen={setUploadModalOpen} 
                uploadName={uploadName} 
                setUploadName={setUploadName} 
                uploadHeight={uploadHeight} 
                setUploadHeight={setUploadHeight} 
                setUploadFile={setUploadFile} 
                handleUploadModel={handleUploadModel} 
                isUploading={isUploading} 
            />

            <SelectionModal 
                modalConfig={modalConfig} 
                closeModal={closeModal} 
                modalTab={modalTab} 
                setModalTab={setModalTab} 
                searchTerm={searchTerm} 
                setSearchTerm={setSearchTerm} 
                items={allItems} 
                selectProductColor={selectProductColor} 
                promptText={promptText} 
                setPromptText={setPromptText} 
                handleGeneratePromptImage={handleGeneratePromptImage} 
                isPromptGenerating={isPromptGenerating} 
            />

            <GalleryPopup selectedGalleryItem={selectedGalleryItem} setSelectedGalleryItem={setSelectedGalleryItem} />
        </div>
    );
};

export default VtonPage;
