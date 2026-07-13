import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { callFalRestApi } from '../api/falClient';
import './VtonPage.css';

const VtonPage = () => {
    const allItems = useAppStore(state => state.allItems);
    const allCustomModels = useAppStore(state => state.allCustomModels);
    const allGallery = useAppStore(state => state.allGallery);
    const saveCustomModelToBackend = useAppStore(state => state.saveCustomModelToBackend);
    const saveGalleryToBackend = useAppStore(state => state.saveGalleryToBackend);
    const deleteGalleryFromBackend = useAppStore(state => state.deleteGalleryFromBackend);
    
    const [model, setModel] = useState({ type: 'preset', url: '' });

    useEffect(() => {
        if (!model.url && allCustomModels && allCustomModels.length > 0) {
            setModel({ type: 'preset', url: allCustomModels[0].url });
        }
    }, [allCustomModels, model.url]);
    const [bottom, setBottom] = useState({ type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' });
    const [top, setTop] = useState({ type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' });
    const [outer, setOuter] = useState({ type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' });
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [progressText, setProgressText] = useState('');
    const [finalResult, setFinalResult] = useState('');
    
    const [characterSheetResult, setCharacterSheetResult] = useState('');
    const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);
    
    const [videoResult, setVideoResult] = useState('');
    const [isVideoGenerating, setIsVideoGenerating] = useState(false);
    const [videoProgressText, setVideoProgressText] = useState('');
    
    // Target Codes State
    const [targetCodesInput, setTargetCodesInput] = useState('');
    const [targetCodes, setTargetCodes] = useState([]);
    
    // Gallery Popup State
    const [selectedGalleryItem, setSelectedGalleryItem] = useState(null);
    
    // Selection Modal State
    const [modalConfig, setModalConfig] = useState({ isOpen: false, layer: null });
    const [modalTab, setModalTab] = useState('product'); // 'product' or 'prompt'
    const [searchTerm, setSearchTerm] = useState('');
    const [promptText, setPromptText] = useState('');
    const [isPromptGenerating, setIsPromptGenerating] = useState(false);

    // Upload Model Modal State
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadName, setUploadName] = useState('');
    const [uploadHeight, setUploadHeight] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // AI Body Analysis State
    const [bodyAnalysis, setBodyAnalysis] = useState(null); // { shoulderWidth: null, legLength: null, isAnalyzing: false }

    const openModal = (layer) => {
        setModalConfig({ isOpen: true, layer });
        setModalTab('product');
        setSearchTerm('');
        const currentState = layer === 'top' ? top : layer === 'bottom' ? bottom : outer;
        setPromptText(currentState.prompt || '');
    };

    const closeModal = () => setModalConfig({ isOpen: false, layer: null });

    const getProductImage = (item) => {
        if (!item || !item.image) return '';
        try {
            const imgObj = JSON.parse(item.image);
            if (imgObj.main) {
                const id = imgObj.main.match(/id=([a-zA-Z0-9_-]+)/);
                return id ? `https://lh3.googleusercontent.com/d/${id[1]}` : imgObj.main;
            }
            return '';
        } catch (e) {
            const id = item.image.match(/id=([a-zA-Z0-9_-]+)/);
            return id ? `https://lh3.googleusercontent.com/d/${id[1]}` : item.image;
        }
    };

    const selectProductColor = (item, colorCode) => {
        const layer = modalConfig.layer;
        let imgUrl = "";
        try {
            const imgObj = JSON.parse(item.image);
            if (colorCode && imgObj[colorCode]) {
                const id = imgObj[colorCode].match(/id=([a-zA-Z0-9_-]+)/);
                imgUrl = id ? `https://lh3.googleusercontent.com/d/${id[1]}` : imgObj[colorCode];
            } else {
                imgUrl = getProductImage(item);
            }
        } catch (e) {
            imgUrl = getProductImage(item);
        }

        const defaultSize = item.sizes ? (Array.isArray(item.sizes) ? item.sizes[0] : String(item.sizes).split(',')[0]?.trim()) : '';

        if (imgUrl) {
            if (layer === 'bottom') setBottom(prev => ({ ...prev, url: imgUrl, type: 'product', item, colorCode, sizeCode: defaultSize }));
            if (layer === 'top') setTop(prev => ({ ...prev, url: imgUrl, type: 'product', item, colorCode, sizeCode: defaultSize }));
            if (layer === 'outer') setOuter(prev => ({ ...prev, url: imgUrl, type: 'product', item, colorCode, sizeCode: defaultSize }));
            closeModal();
        } else {
            alert("해당 컬러의 이미지를 찾을 수 없습니다.");
        }
    };

    const changeColor = (layerName, direction) => {
        let currentState = layerName === 'top' ? top : layerName === 'bottom' ? bottom : outer;
        if (!currentState.item) return;
        
        let colors = [];
        let imgObj = null;
        try { 
            imgObj = JSON.parse(currentState.item.image); 
            colors = Object.keys(imgObj).filter(k => k !== 'main' && k !== 'size'); 
        } catch(e) { return; }
        
        if (colors.length === 0) return;
        
        let currentIndex = colors.indexOf(currentState.colorCode);
        if (currentIndex === -1) currentIndex = 0;
        
        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = colors.length - 1;
        if (newIndex >= colors.length) newIndex = 0;
        
        const newColorCode = colors[newIndex];
        let cUrl = imgObj[newColorCode];
        const idMatch = cUrl && cUrl.match(/id=([a-zA-Z0-9_-]+)/);
        const finalUrl = idMatch ? `https://lh3.googleusercontent.com/d/${idMatch[1]}` : cUrl;
        
        if (finalUrl) {
            if (layerName === 'top') setTop(prev => ({ ...prev, url: finalUrl, colorCode: newColorCode }));
            if (layerName === 'bottom') setBottom(prev => ({ ...prev, url: finalUrl, colorCode: newColorCode }));
            if (layerName === 'outer') setOuter(prev => ({ ...prev, url: finalUrl, colorCode: newColorCode }));
        }
    };

    const handleQuickSelect = (layerName, item) => {
        let defaultColor = null;
        try {
            const imgObj = JSON.parse(item.image);
            const colors = Object.keys(imgObj).filter(k => k !== 'main' && k !== 'size');
            if (colors.length > 0) defaultColor = colors[0];
        } catch(e) {}
        
        let imgUrl = "";
        try {
            const imgObj = JSON.parse(item.image);
            if (defaultColor && imgObj[defaultColor]) {
                const id = imgObj[defaultColor].match(/id=([a-zA-Z0-9_-]+)/);
                imgUrl = id ? `https://lh3.googleusercontent.com/d/${id[1]}` : imgObj[defaultColor];
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
            alert('이미지 생성 실패:\n' + e.message);
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
            const res = await fetch('https://lotte-backend.poodingcake.workers.dev', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success && data.imageUrl) {
                await saveCustomModelToBackend(uploadName, data.imageUrl, uploadHeight);
                alert('모델이 등록되었습니다.');
                setUploadModalOpen(false);
                setUploadName('');
                setUploadHeight('');
                setUploadFile(null);
                setModel({ type: 'preset', url: data.imageUrl });
            } else {
                throw new Error('Upload failed');
            }
        } catch (e) {
            console.error(e);
            alert('업로드 실패: ' + e.message);
        } finally {
            setIsUploading(false);
        }
    };

    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = (err) => reject(err);
            document.head.appendChild(script);
        });
    };

    const runPoseEstimation = async (imageUrl, heightCm) => {
        if (!imageUrl || !heightCm) return;
        setBodyAnalysis({ shoulderWidth: null, legLength: null, isAnalyzing: true });
        
        const fallbackProportions = (h) => {
            return {
                shoulderWidth: Math.round(h * 0.225 * 10) / 10,
                legLength: Math.round(h * 0.60 * 10) / 10,
                isAnalyzing: false
            };
        };

        try {
            // Clean up any previously loaded conflicting scripts or globals
            document.querySelectorAll('script[src*="tensorflow"]').forEach(s => s.remove());
            document.querySelectorAll('script[src*="posenet"]').forEach(s => s.remove());
            if (window.tf) {
                try {
                    delete window.tf;
                } catch(e) {
                    window.tf = undefined;
                }
            }
            if (window.posenet) {
                try {
                    delete window.posenet;
                } catch(e) {
                    window.posenet = undefined;
                }
            }

            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/posenet@2.2.2/dist/posenet.min.js');

            const isExternal = !imageUrl.includes('lotte-backend.poodingcake.workers.dev') && !imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:');
            const finalImageUrl = isExternal 
                ? `https://lotte-backend.poodingcake.workers.dev/proxy?url=${encodeURIComponent(imageUrl)}`
                : `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
            
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = finalImageUrl;
            img.onload = async () => {
                try {
                    const net = await window.posenet.load();
                    const pose = await net.estimateSinglePose(img, {
                        decodingMethod: 'single-person'
                    });

                    if (pose && pose.keypoints) {
                        const kp = {};
                        pose.keypoints.forEach(k => {
                            if (k.score > 0.3) {
                                kp[k.part] = k.position;
                            }
                        });

                        const nose = kp['nose'];
                        const leftAnkle = kp['leftAnkle'];
                        const rightAnkle = kp['rightAnkle'];
                        const leftKnee = kp['leftKnee'];
                        const rightKnee = kp['rightKnee'];
                        const leftHip = kp['leftHip'];
                        const rightHip = kp['rightHip'];

                        const ankleY = (leftAnkle && rightAnkle) ? (leftAnkle.y + rightAnkle.y) / 2 : (leftAnkle ? leftAnkle.y : (rightAnkle ? rightAnkle.y : null));
                        const kneeY = (leftKnee && rightKnee) ? (leftKnee.y + rightKnee.y) / 2 : (leftKnee ? leftKnee.y : (rightKnee ? rightKnee.y : null));
                        const hipY = (leftHip && rightHip) ? (leftHip.y + rightHip.y) / 2 : (leftHip ? leftHip.y : (rightHip ? rightHip.y : null));

                        let ratio = null;
                        if (nose) {
                            if (ankleY) {
                                const fullHeightPx = (ankleY - nose.y) * 1.15;
                                ratio = heightCm / fullHeightPx;
                            } else if (kneeY) {
                                const fullHeightPx = (kneeY - nose.y) * 1.45;
                                ratio = heightCm / fullHeightPx;
                            } else if (hipY) {
                                const fullHeightPx = (hipY - nose.y) * 2.0;
                                ratio = heightCm / fullHeightPx;
                            }
                        }

                        if (ratio) {
                            const leftShoulder = kp['leftShoulder'];
                            const rightShoulder = kp['rightShoulder'];
                            let shoulderWidthCm = null;
                            if (leftShoulder && rightShoulder) {
                                const shoulderDistPx = Math.sqrt(
                                    Math.pow(leftShoulder.x - rightShoulder.x, 2) +
                                    Math.pow(leftShoulder.y - rightShoulder.y, 2)
                                );
                                // PoseNet은 뼈대의 안쪽 관절 중심을 재기 때문에, 실제 의류 어깨 실측 치수(어깨 봉제선 끝과 끝)로 보정하기 위해 1.45배율을 적용합니다.
                                shoulderWidthCm = Math.round(shoulderDistPx * ratio * 1.45 * 10) / 10;
                            }

                            let legLengthCm = null;
                            if (hipY && ankleY) {
                                // 해부학적 골반-발목 거리를 의류 상세 치수표의 '바지 총장(허리선부터 밑단)' 기준에 맞추기 위해 1.35배율을 적용합니다.
                                legLengthCm = Math.round((ankleY - hipY) * ratio * 1.35 * 10) / 10;
                            } else if (hipY) {
                                legLengthCm = Math.round(heightCm * 0.60 * 10) / 10;
                            }

                            setBodyAnalysis({
                                shoulderWidth: shoulderWidthCm || Math.round(heightCm * 0.225 * 10) / 10, 
                                legLength: legLengthCm || Math.round(heightCm * 0.60 * 10) / 10,         
                                isAnalyzing: false
                            });
                            console.log(`🤖 Pose Estimation 완료: 어깨폭 ${shoulderWidthCm}cm, 다리길이 ${legLengthCm}cm`);
                            return;
                        }
                    }
                    throw new Error('관절 키포인트를 감지하지 못했습니다.');
                } catch(innerErr) {
                    console.error('PoseNet analysis inner error, falling back to standard proportions:', innerErr);
                    setBodyAnalysis(fallbackProportions(heightCm));
                }
            };
            img.onerror = () => {
                console.warn('Failed to load image for PoseNet analysis, falling back to standard proportions');
                setBodyAnalysis(fallbackProportions(heightCm));
            };
        } catch (e) {
            console.error('PoseNet load/init error, falling back to standard proportions:', e);
            setBodyAnalysis(fallbackProportions(heightCm));
        }
    };

    useEffect(() => {
        if (model.url && allCustomModels) {
            const matched = allCustomModels.find(m => m.url === model.url);
            const height = matched ? matched.height : 165; 
            runPoseEstimation(model.url, height);
        }
    }, [model.url, allCustomModels]);

    const handleSaveGallery = async (type, url) => {
        if (!url) return;
        try {
            await saveGalleryToBackend(type, url);
            alert('갤러리에 저장되었습니다! (하단에서 확인하세요)');
        } catch (e) {
            alert('저장 실패: ' + e.message);
        }
    };

    const startVtonProcess = async () => {
        if (!model.url) { alert('모델 이미지가 없습니다.'); return; }
        const layers = [];
        if (bottom.url) layers.push({ url: bottom.url, cat: 'bottoms', name: '하의' });
        if (top.url) layers.push({ url: top.url, cat: 'tops', name: '상의' });
        if (outer.url) layers.push({ url: outer.url, cat: 'tops', name: '아우터' });
        
        if (layers.length === 0) {
            alert('합성할 옷을 하나 이상 선택해주세요.');
            return;
        }
        
        setIsGenerating(true);
        setFinalResult('');
        let currentBaseImage = model.url;
        
        try {
            // Generate dynamic fit details based on physical size measurements
            let fitPromptAdditions = "";
            if (bodyAnalysis && !bodyAnalysis.isAnalyzing) {
                const modelShoulder = bodyAnalysis.shoulderWidth || 38.0;
                const modelLeg = bodyAnalysis.legLength || 90.0;
                
                // Analyze Top fit
                if (top.url && top.item) {
                    let garmentShoulder = 38.0; 
                    const sizeStr = String(top.sizeCode || '').trim();
                    if (sizeStr === 'S' || sizeStr === '55' || sizeStr === '85') garmentShoulder = 37.0;
                    else if (sizeStr === 'M' || sizeStr === '66' || sizeStr === '90') garmentShoulder = 39.0;
                    else if (sizeStr === 'L' || sizeStr === '77' || sizeStr === '95') garmentShoulder = 41.0;
                    else if (sizeStr === 'XL' || sizeStr === '88' || sizeStr === '100') garmentShoulder = 43.0;

                    if (garmentShoulder - modelShoulder > 3) {
                        fitPromptAdditions += " The top should fit loosely and oversized, with relaxed drop shoulders falling naturally.";
                    } else if (modelShoulder - garmentShoulder > 2) {
                        fitPromptAdditions += " The top fits tightly and slim-fit, hugging the model's body closely.";
                    } else {
                        fitPromptAdditions += " The top has a clean, neat regular fit.";
                    }
                }
                
                // Analyze Bottom fit
                if (bottom.url && bottom.item) {
                    let garmentLength = 95.0; 
                    const sizeStr = String(bottom.sizeCode || '').trim();
                    if (sizeStr === 'S' || sizeStr === '55' || sizeStr === '85') garmentLength = 92.0;
                    else if (sizeStr === 'M' || sizeStr === '66' || sizeStr === '90') garmentLength = 95.0;
                    else if (sizeStr === 'L' || sizeStr === '77' || sizeStr === '95') garmentLength = 98.0;

                    if (garmentLength - modelLeg > 5) {
                        fitPromptAdditions += " The pants are very long and baggy, draping down and slightly pooling or folding over the tops of the shoes.";
                    } else if (modelLeg - garmentLength > 10) {
                        fitPromptAdditions += " The pants have a cropped or ankle-length fit, ending slightly above the ankles.";
                    } else {
                        fitPromptAdditions += " The pants fit regularly, dropping straight down neatly to the ankles.";
                    }
                }
            }

            setProgressText(`룩시트 일괄 합성 중... (Nano Banana)`);
            const imageUrls = [currentBaseImage, ...layers.map(l => l.url)];
            
            const basePrompt = "A highly photorealistic image of the person in the first image wearing all the exact garments shown in the subsequent images. The person's identity, pose, and background must remain exactly the same. Synthesize the clothes naturally onto the person.";
            const finalPrompt = basePrompt + fitPromptAdditions;

            const payload = {
                image_urls: imageUrls,
                prompt: finalPrompt,
                output_format: "png"
            };
            const res = await callFalRestApi('fal-ai/nano-banana-pro/edit', payload);
            if (res && res.images && res.images[0]) {
                setFinalResult(res.images[0].url);
                setProgressText('합성 완료!');
            } else {
                throw new Error('결과 이미지를 받지 못했습니다.');
            }
        } catch (e) {
            console.error(e);
            alert('VTON 합성 중 에러 발생:\n' + e.message);
            setProgressText('합성 실패');
        } finally {
            setIsGenerating(false);
        }
    };

    const generateCharacterSheet = async () => {
        if (!finalResult) return;
        setIsGeneratingSheet(true);
        setCharacterSheetResult('');
        try {
            const payload = {
                image_urls: [finalResult],
                system_prompt: "You are an expert concept artist and fashion illustrator.",
                prompt: "A highly photorealistic character design sheet showing 3 different angles (front, side, and back) of this exact person wearing this exact outfit. They are standing against a solid white background. Preserve the facial identity, body proportions, and clothing details perfectly across all angles.",
                aspect_ratio: "16:9",
                resolution: "2K",
                output_format: "png"
            };
            const res = await callFalRestApi('fal-ai/nano-banana-pro/edit', payload);
            if (res && res.images && res.images[0]) {
                setCharacterSheetResult(res.images[0].url);
            } else {
                throw new Error('결과 이미지를 받지 못했습니다.');
            }
        } catch (e) {
            console.error(e);
            alert('에러 발생:\n' + e.message);
        } finally {
            setIsGeneratingSheet(false);
        }
    };

    const generateVideo = async () => {
        if (!finalResult) return;
        setIsVideoGenerating(true);
        setVideoResult('');
        setVideoProgressText('씨댄스 영상 생성 중... (1~3분 소요)');
        try {
            const payload = {
                image_url: finalResult,
                prompt: "A seamless looping fashion lookbook video. A young female model stands centered in a pure white studio with no accessories, no bags, no props. She begins facing the camera with a natural, gentle smile and arms relaxed at her sides. She then performs a smooth, continuous full 360-degree rotation in place, turning right: front view, right profile, back view showing outfit details, left profile, and returning to the exact same front-facing starting pose with the same gentle smile and arm position. The rotation speed is constant and even throughout. The first frame and last frame must be identical in pose, expression, and body position to create a perfect infinite loop. Camera is completely static at eye-level, full-body framing. Bright, even studio lighting with no shadows. Clean white background.",
                duration: 5
            };
            const res = await callFalRestApi('fal-ai/minimax-video/image-to-video', payload);
            if (res && res.video && res.video.url) {
                setVideoResult(res.video.url);
                setVideoProgressText('영상 생성 완료!');
            } else {
                throw new Error('비디오 URL을 받지 못했습니다.');
            }
        } catch (e) {
            console.error(e);
            alert('비디오 생성 에러:\n' + e.message);
            setVideoProgressText('생성 실패');
        } finally {
            setIsVideoGenerating(false);
        }
    };

    const renderLayerBox = (layerName, layerTitle, state) => {
        let matchedItems = [];
        if (targetCodes.length > 0) {
            matchedItems = allItems.filter(i => i.isMaster && targetCodes.includes(i.code));
            if (layerName === 'top') matchedItems = matchedItems.filter(i => i.category === '상의');
            else if (layerName === 'bottom') matchedItems = matchedItems.filter(i => i.category === '하의' || i.category === '팬츠');
            else if (layerName === 'outer') matchedItems = matchedItems.filter(i => i.category === '아우터');
        }

        let sizeImageUrl = '';
        if (state.item && state.item.image) {
            try {
                const imgObj = JSON.parse(state.item.image);
                if (imgObj.size) {
                    sizeImageUrl = imgObj.size;
                }
            } catch(e) {}
        }

        return (
            <div className="p-2 border rounded h-100 bg-white d-flex flex-column align-items-center shadow-sm">
                <h5 className="fw-bold mb-2 text-dark text-center" style={{fontSize:'15px'}}>{layerTitle}</h5>
                {matchedItems.length > 0 && (
                    <div className="w-100 mb-2">
                        <select className="form-select form-select-sm w-100 text-primary border-primary fw-bold" style={{fontSize:'11px'}} onChange={(e) => {
                            const selected = matchedItems.find(i => i.code === e.target.value);
                            if (selected) handleQuickSelect(layerName, selected);
                            e.target.value = "";
                        }}>
                            <option value="">{layerTitle} 선택</option>
                            {matchedItems.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                        </select>
                    </div>
                )}
                
                <div className="vton-tooltip-container w-100 flex-grow-1 d-flex flex-column">
                    <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center w-100 mb-2 position-relative" style={{minHeight: '180px', background: '#f8f9fa', borderRadius: '8px', border: '2px dashed #e0e0e0', overflow:'hidden'}}>
                        {state.url ? (
                            <>
                                <img src={state.url} alt={layerTitle} style={{maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', padding: '5px'}} />
                                {state.item && (
                                    <>
                                        <button className="btn btn-sm btn-dark position-absolute border border-white" style={{left: 5, top: '50%', transform:'translateY(-50%)', opacity:0.8, padding:'2px 6px', borderRadius:'50%'}} onClick={() => changeColor(layerName, -1)}>{"<"}</button>
                                        <button className="btn btn-sm btn-dark position-absolute border border-white" style={{right: 5, top: '50%', transform:'translateY(-50%)', opacity:0.8, padding:'2px 6px', borderRadius:'50%'}} onClick={() => changeColor(layerName, 1)}>{">"}</button>
                                        <div className="position-absolute bottom-0 w-100 text-center text-white bg-dark bg-opacity-75 small fw-bold" style={{fontSize:'11px', padding:'4px 0'}}>
                                            {state.colorCode || '기본 색상'} {state.sizeCode ? `| ${state.sizeCode}` : ''}
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="text-muted fw-bold" style={{fontSize:'13px'}}>이미지 없음</div>
                        )}
                    </div>
                    {state.item && (
                        <div className={layerName === 'outer' ? 'vton-tooltip-content-left' : 'vton-tooltip-content-right'}>
                            <div className="fw-bold mb-1" style={{fontSize: '12px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{state.item.name}</div>
                            <div className="small mb-1 text-light bg-dark bg-opacity-50 p-1 rounded" style={{fontSize: '10.5px'}}>전체 사이즈: {state.item.sizes || '없음'}</div>
                            {sizeImageUrl ? (
                                <>
                                    <div className="small text-warning fw-bold" style={{fontSize: '10.5px', marginTop: '6px'}}>📏 상세 사이즈 스펙표</div>
                                    <img src={sizeImageUrl} alt="상세사이즈 표" className="vton-tooltip-image" />
                                </>
                            ) : (
                                <div className="small text-muted" style={{fontSize: '10px', marginTop: '6px'}}>등록된 상세 사이즈 표 없음</div>
                            )}
                        </div>
                    )}
                </div>

                {state.item && state.item.sizes && (
                    <div className="w-100 mb-2">
                        <select 
                            className="form-select form-select-sm text-center fw-bold text-secondary" 
                            style={{fontSize:'11.5px', padding:'4px 8px'}}
                            value={state.sizeCode || ''}
                            onChange={(e) => {
                                const newSize = e.target.value;
                                if (layerName === 'top') setTop(prev => ({ ...prev, sizeCode: newSize }));
                                if (layerName === 'bottom') setBottom(prev => ({ ...prev, sizeCode: newSize }));
                                if (layerName === 'outer') setOuter(prev => ({ ...prev, sizeCode: newSize }));
                            }}
                        >
                            {(Array.isArray(state.item.sizes) ? state.item.sizes : String(state.item.sizes).split(',')).map(s => {
                                const trimmed = String(s).trim();
                                return <option key={trimmed} value={trimmed}>{trimmed} 사이즈</option>;
                            })}
                        </select>
                    </div>
                )}

                <div className="w-100 d-flex gap-1 mt-auto">
                    <button className="btn btn-sm btn-outline-primary flex-grow-1 fw-bold py-1" style={{fontSize:'12px'}} onClick={() => openModal(layerName)}>
                        {state.url ? '검색/변경' : '전체 검색'}
                    </button>
                    {state.url && (
                        <button className="btn btn-sm btn-outline-danger fw-bold py-1 px-2" style={{fontSize:'12px'}} onClick={() => {
                            if (layerName === 'top') setTop({ type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' });
                            if (layerName === 'bottom') setBottom({ type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' });
                            if (layerName === 'outer') setOuter({ type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' });
                        }}>삭제</button>
                    )}
                </div>
            </div>
        );
    };

    // Modal Content filters
    const layerNames = { top: '상의', bottom: '하의', outer: '아우터' };
    
    let items = allItems.filter(i => i.isMaster);
    if (targetCodes.length > 0) {
        items = items.filter(i => targetCodes.includes(i.code));
    }
    
    items = items.filter(i => (searchTerm === '' || (i.brand && i.brand.includes(searchTerm)) || (i.name && i.name.includes(searchTerm))));
    
    if (modalConfig.isOpen && modalConfig.layer) {
        if (modalConfig.layer === 'top') {
            items = items.filter(i => i.category === '상의');
        } else if (modalConfig.layer === 'bottom') {
            items = items.filter(i => i.category === '하의' || i.category === '팬츠');
        } else if (modalConfig.layer === 'outer') {
            items = items.filter(i => i.category === '아우터');
        }
    }

    items = items.sort((a, b) => {
        const codeA = a.code || '';
        const codeB = b.code || '';
        return codeB.localeCompare(codeA, undefined, { numeric: true, sensitivity: 'base' });
    });

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
                <button className="btn btn-success fw-bold px-4 py-1" onClick={startVtonProcess} disabled={isGenerating}>
                    {isGenerating ? '합성 중...' : '▶ 가상착장 시작'}
                </button>
            </div>
            
            <div className="d-flex flex-nowrap gap-2 mb-4 w-100" style={{ minHeight: '75vh', overflowX: 'auto' }}>
                {/* 1. Model Selection */}
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>
                    <div className="vton-model-section p-3 border rounded h-100 bg-white d-flex flex-column shadow-sm">
                        <h5 className="fw-bold mb-3 text-center text-dark">모델 선택</h5>
                        <div className="vton-mode-tabs mb-3 d-flex flex-column gap-2">
                            <div className="d-flex gap-2">
                                <button className={`btn btn-sm flex-grow-1 ${model.type === 'preset' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`} onClick={() => setModel(prev => ({...prev, type: 'preset'}))}>모델 선택</button>
                                <button className={`btn btn-sm flex-grow-1 ${model.type === 'url' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`} onClick={() => setModel(prev => ({...prev, type: 'url'}))}>URL 입력</button>
                            </div>
                        </div>
                        {model.type === 'preset' ? (
                            <div className="d-flex flex-column gap-2 mb-3">
                                <select className="form-select form-select-sm" value={model.url} onChange={(e) => setModel(prev => ({...prev, url: e.target.value}))}>
                                    {allCustomModels && allCustomModels.length > 0 ? (
                                        allCustomModels.map(m => (
                                            <option key={m.id} value={m.url}>[내 모델] {m.name}{m.height ? ` (${m.height}cm)` : ''}</option>
                                        ))
                                    ) : (
                                        <option value="">등록된 모델이 없습니다</option>
                                    )}
                                </select>
                                <button className="btn btn-sm btn-outline-primary fw-bold text-nowrap w-100" onClick={() => setUploadModalOpen(true)} title="모델 등록">+ 내 모델 등록하기</button>
                            </div>
                        ) : (
                            <input type="text" className="form-control form-control-sm mb-3" placeholder="이미지 URL 입력" value={model.url} onChange={(e) => setModel(prev => ({...prev, url: e.target.value}))} />
                        )}
                        <div className="flex-grow-1 d-flex justify-content-center align-items-center mt-2" style={{minHeight: '220px', background: '#f8f9fa', borderRadius: '8px', border: '2px dashed #e0e0e0'}}>
                            {model.url ? <img src={model.url} alt="Model" style={{maxWidth: '100%', maxHeight: '250px', objectFit: 'contain', padding: '10px'}} /> : <div className="text-muted fw-bold">이미지 없음</div>}
                        </div>
                        
                        {/* AI Body Analysis Result Panel */}
                        {bodyAnalysis && (
                            <div className="mt-3 p-2 rounded bg-light border" style={{ fontSize: '11.5px' }}>
                                <div className="fw-bold mb-1 text-primary d-flex align-items-center gap-1">
                                    <span>🤖</span> 모델 체형분석
                                    {bodyAnalysis.isAnalyzing ? (
                                        <span className="spinner-border spinner-border-sm text-primary ms-auto" style={{ width: '10px', height: '10px' }}></span>
                                    ) : (
                                        <span className="badge bg-success ms-auto" style={{ fontSize: '9px', padding: '2px 4px' }}>완료</span>
                                    )}
                                </div>
                                {bodyAnalysis.isAnalyzing ? (
                                    <div className="text-muted text-center py-2" style={{fontSize: '11px'}}>관절 위치 인식 및 픽셀 비율 계산 중...</div>
                                ) : (
                                    <div className="d-flex flex-column gap-1">
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted">어깨너비:</span>
                                            <span className="fw-bold text-dark">{bodyAnalysis.shoulderWidth} cm</span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted">다리길이:</span>
                                            <span className="fw-bold text-dark">{bodyAnalysis.legLength} cm</span>
                                        </div>
                                        <div className="text-muted text-center mt-1" style={{ fontSize: '9.5px', borderTop: '1px dashed #ddd', paddingTop: '4px' }}>
                                            실시간 핏 매핑 작동 중 ⚡
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>{renderLayerBox('top', '상의', top)}</div>
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>{renderLayerBox('bottom', '하의', bottom)}</div>
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>{renderLayerBox('outer', '아우터', outer)}</div>
                
                {/* Right Side: 35% Width for Final Result */}
                <div className="d-flex flex-column" style={{ flex: '0 0 35%', minWidth: '450px' }}>
                    <div className="vton-result-section p-4 border rounded bg-white h-100 d-flex flex-column align-items-center justify-content-start shadow-sm position-relative">
                        <h4 className="fw-bold w-100 text-center mb-4 text-primary border-bottom pb-2">최종 시뮬레이션 결과</h4>
                        <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center w-100 overflow-auto">
                            {isGenerating && (
                                <div className="text-center my-3">
                                    <div className="spinner-border spinner-border-sm text-primary mb-2"></div>
                                    <div className="text-muted fw-bold small">{progressText}</div>
                                </div>
                            )}
                            {!isGenerating && finalResult && (
                                <div className="d-flex flex-column align-items-center w-100">
                                    <div style={{position: 'relative', display: 'inline-block'}}>
                                        <img src={finalResult} alt="VTON Result" style={{maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain', border: '3px solid var(--primary)', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)'}} />
                                        <button className="btn btn-sm btn-light shadow-sm position-absolute" style={{top: 5, right: 5, fontSize: '12px', padding: '2px 6px'}} onClick={() => handleSaveGallery('vton', finalResult)}>💾 저장</button>
                                    </div>
                                    <div className="d-flex gap-2 w-100 mt-2">
                                        <button className="btn btn-sm btn-warning fw-bold flex-grow-1" onClick={generateCharacterSheet} disabled={isGeneratingSheet} style={{fontSize: '11px'}}>
                                            {isGeneratingSheet ? '시트 생성 중...' : '캐릭터 시트 생성'}
                                        </button>
                                        <button className="btn btn-sm btn-dark fw-bold flex-grow-1" onClick={generateVideo} disabled={isVideoGenerating} style={{fontSize: '11px'}}>
                                            {isVideoGenerating ? '영상 렌더링 중...' : '🎬 영상 렌더링'}
                                        </button>
                                    </div>
                                    
                                    {(characterSheetResult || videoResult) && <hr className="w-100 my-2" />}

                                    <div className="d-flex gap-2 w-100 justify-content-center">
                                        {characterSheetResult && (
                                            <div className="w-50 text-center">
                                                <h6 className="fw-bold mb-1" style={{fontSize:'11px'}}>캐릭터 시트</h6>
                                                <div style={{position: 'relative'}}>
                                                    <img src={characterSheetResult} style={{width: '100%', border: '1px solid #ccc', borderRadius: '4px'}} />
                                                    <button className="btn btn-sm btn-light shadow-sm position-absolute" style={{bottom: 5, right: 5, fontSize: '10px', padding: '1px 4px'}} onClick={() => handleSaveGallery('sheet', characterSheetResult)}>💾 저장</button>
                                                </div>
                                            </div>
                                        )}
                                        {videoResult && (
                                            <div className="w-50 text-center">
                                                <h6 className="fw-bold mb-1" style={{fontSize:'11px'}}>화보 영상</h6>
                                                <div style={{position: 'relative'}}>
                                                    <video src={videoResult} controls autoPlay loop muted style={{width: '100%', border: '1px solid #ccc', borderRadius: '4px'}} />
                                                    <button className="btn btn-sm btn-light shadow-sm position-absolute" style={{top: 5, right: 5, fontSize: '10px', padding: '1px 4px', zIndex: 10}} onClick={() => handleSaveGallery('video', videoResult)}>💾 저장</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {!isGenerating && !finalResult && (
                                <div className="text-muted text-center p-3 border rounded small" style={{background: '#f8f9fa'}}>
                                    모델과 의상을 선택한 후<br/>가상착장 시작을 누르세요.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Gallery Section */}
            <hr className="my-4 border-2" />
            <div style={{marginTop: '100px'}}></div>
            <h4 className="fw-bold mb-4 border-bottom pb-2" style={{color: 'var(--primary)'}}>📸 갤러리</h4>
            <div className="row g-2 mb-4">
                {allGallery && allGallery.map(g => (
                    <div key={g.id} className="col-4 col-md-3 col-lg-2">
                        <div 
                            className="border rounded overflow-hidden shadow-sm gallery-item-container" 
                            style={{aspectRatio: '1', position: 'relative', background: '#f8f9fa', cursor: 'pointer'}}
                            onClick={() => setSelectedGalleryItem(g)}
                        >
                            {g.type === 'video' ? (
                                <video src={g.url} style={{width: '100%', height: '100%', objectFit: 'cover'}} loop muted autoPlay playsInline />
                            ) : (
                                <img src={g.url} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                            )}
                            <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', padding: '3px 6px', textAlign: 'center', fontWeight: 'bold'}}>
                                {g.type === 'vton' ? '가상착장' : g.type === 'sheet' ? '캐릭터시트' : '🎬 화보영상'}
                            </div>
                            <button 
                                className="btn btn-sm btn-danger delete-btn position-absolute" 
                                style={{top: 5, right: 5, padding: '2px 6px', fontSize: '10px', opacity: 0, transition: 'opacity 0.2s', borderRadius: '50%'}}
                                onClick={(e) => { e.stopPropagation(); if(window.confirm('정말 삭제하시겠습니까?')) deleteGalleryFromBackend(g.id); }}
                            >
                                ❌
                            </button>
                        </div>
                    </div>
                ))}
                {allGallery.length === 0 && <div className="text-muted small w-100 p-3 bg-light rounded text-center">저장된 갤러리 항목이 없습니다. 결과 창에서 [저장] 버튼을 눌러보세요.</div>}
            </div>

            {/* Upload Modal */}
            {uploadModalOpen && (
                <div className="modal-backdrop" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                    <div className="modal-content bg-white rounded shadow p-4" style={{width: '90%', maxWidth: '400px'}}>
                        <h5 className="fw-bold mb-3">내 모델 등록하기</h5>
                        <div className="mb-2">
                            <label className="form-label small fw-bold">모델 이름</label>
                            <input type="text" className="form-control form-control-sm" value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="예: 봄 시즌 신규 모델" />
                        </div>
                        <div className="mb-2">
                            <label className="form-label small fw-bold">모델 키 (cm)</label>
                            <input type="number" className="form-control form-control-sm" value={uploadHeight} onChange={e => setUploadHeight(e.target.value)} placeholder="예: 170" />
                        </div>
                        <div className="mb-3">
                            <label className="form-label small fw-bold">이미지 파일 (WebP 권장)</label>
                            <input type="file" className="form-control form-control-sm" accept="image/*" onChange={e => setUploadFile(e.target.files[0])} />
                        </div>
                        <div className="d-flex gap-2">
                            <button className="btn btn-secondary flex-grow-1" onClick={() => setUploadModalOpen(false)}>취소</button>
                            <button className="btn btn-primary flex-grow-1 fw-bold" onClick={handleUploadModel} disabled={isUploading}>
                                {isUploading ? '업로드 중...' : '등록하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Selection Modal */}
            {modalConfig.isOpen && (
                <div className="modal-backdrop" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1050, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                    <div className="modal-content bg-white rounded shadow" style={{width: '90%', maxWidth: '850px', maxHeight: '85vh', display: 'flex', flexDirection: 'column'}}>
                        <div className="modal-header p-3 border-bottom d-flex justify-content-between align-items-center">
                            <h5 className="m-0 fw-bold">{layerNames[modalConfig.layer]} 선택</h5>
                            <button className="btn-close" onClick={closeModal}></button>
                        </div>
                        <div className="modal-body p-3 overflow-auto" style={{flexGrow: 1}}>
                            <div className="d-flex gap-2 mb-3">
                                <button className={`btn flex-grow-1 ${modalTab === 'product' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setModalTab('product')}>내 상품</button>
                                <button className={`btn flex-grow-1 ${modalTab === 'prompt' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setModalTab('prompt')}>프롬프트</button>
                            </div>
                            {modalTab === 'product' && (
                                <div>
                                    <input type="text" placeholder="브랜드 또는 상품명 검색" className="form-control mb-3" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                    <div className="vton-modal-product-list" style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                        {items.slice(0, 30).map((item, idx) => {
                                            let colors = [];
                                            let imgObj = null;
                                            try { imgObj = JSON.parse(item.image); colors = Object.keys(imgObj).filter(k => k !== 'main' && k !== 'size'); } catch(e) {}
                                            return (
                                                <div key={idx} className="p-3 border rounded d-flex align-items-center mb-2">
                                                    <div style={{ width: '40%', paddingRight: '15px' }}>
                                                        <div className="fw-bold" style={{fontSize: '14px', color: 'var(--primary)'}}>{item.brand}</div>
                                                        <div style={{fontSize: '15px', fontWeight: 'bold', wordBreak: 'keep-all', margin: '4px 0'}}>{item.name}</div>
                                                        <div className="text-muted" style={{fontSize: '12px'}}>{item.code}</div>
                                                    </div>
                                                    <div style={{ width: '60%', display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '5px', alignItems: 'center' }}>
                                                        {colors.map((c, i) => {
                                                            let cUrl = imgObj[c];
                                                            const idMatch = cUrl && cUrl.match(/id=([a-zA-Z0-9_-]+)/);
                                                            const finalUrl = idMatch ? `https://lh3.googleusercontent.com/d/${idMatch[1]}` : cUrl;
                                                            return (
                                                                <div key={i} onClick={() => selectProductColor(item, c)} style={{ cursor: 'pointer', textAlign: 'center', minWidth: '70px', transition: 'opacity 0.2s' }} onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'} onMouseOut={(e) => e.currentTarget.style.opacity = '1'}>
                                                                    <div style={{ width: '70px', height: '90px', background: '#f8f9fa', borderRadius: '4px', overflow: 'hidden', border: '1px solid #eee' }}>
                                                                        {finalUrl ? <img src={finalUrl} alt={c} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <div style={{fontSize:'10px', color:'#999', lineHeight:'90px'}}>No Img</div>}
                                                                    </div>
                                                                    <div style={{ fontSize: '11px', marginTop: '6px', color: '#555', fontWeight: 'bold' }}>{c}</div>
                                                                </div>
                                                            );
                                                        })}
                                                        {colors.length === 0 && <div className="text-muted small p-2">등록된 색상 이미지가 없습니다.</div>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {items.length === 0 && <div className="text-center text-muted p-4 border rounded">검색 결과가 없습니다.</div>}
                                    </div>
                                </div>
                            )}
                            {modalTab === 'prompt' && (
                                <div>
                                    <div className="mb-2 fw-bold text-secondary">원하는 옷의 스타일을 영문으로 입력하세요</div>
                                    <textarea className="form-control mb-3" rows="4" placeholder="예: red leather jacket, white t-shirt" value={promptText} onChange={(e) => setPromptText(e.target.value)} />
                                    <button className="btn btn-primary w-100 py-2 fw-bold" onClick={handleGeneratePromptImage} disabled={isPromptGenerating}>
                                        {isPromptGenerating ? '이미지 생성 중...' : '이미지 생성 및 적용하기'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Gallery Popup Modal */}
            {selectedGalleryItem && (
                <div 
                    style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'}}
                    onClick={() => setSelectedGalleryItem(null)}
                >
                    <div style={{position: 'relative', maxWidth: '90vw', maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                        <button 
                            className="btn btn-close btn-close-white position-absolute" 
                            style={{top: -40, right: -10, fontSize: '20px'}}
                            onClick={() => setSelectedGalleryItem(null)}
                        ></button>
                        {selectedGalleryItem.type === 'video' ? (
                            <video src={selectedGalleryItem.url} style={{maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px'}} loop autoPlay playsInline controls />
                        ) : (
                            <img src={selectedGalleryItem.url} style={{maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px'}} />
                        )}
                    </div>
                </div>
            )}
            
            <style>{`
                .gallery-item-container:hover .delete-btn { opacity: 1 !important; }
            `}</style>
        </div>
    );
};

export default VtonPage;
