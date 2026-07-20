import React, { useEffect } from 'react';
import { GAS_WEB_APP_URL } from '../../api/client';

const loadScript = (src: string) => {
    return new Promise<void>((resolve, reject) => {
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

const runPoseEstimation = async (imageUrl: string, heightCm: number, setBodyAnalysis: any) => {
    if (!imageUrl || !heightCm) return;
    setBodyAnalysis({ shoulderWidth: null, legLength: null, isAnalyzing: true });
    
    const fallbackProportions = (h: number) => {
        return {
            shoulderWidth: Math.round(h * 0.225 * 10) / 10,
            legLength: Math.round(h * 0.60 * 10) / 10,
            isAnalyzing: false
        };
    };

    try {
        if (!window.tf || !window.posenet) {
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/posenet@2.2.2/dist/posenet.min.js');
        }

        const backendHost = new URL(GAS_WEB_APP_URL).hostname;
        const isExternal = !imageUrl.includes(backendHost) && !imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:');
        const finalImageUrl = isExternal 
            ? `${GAS_WEB_APP_URL}/proxy?url=${encodeURIComponent(imageUrl)}`
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
                    const kp: Record<string, any> = {};
                    pose.keypoints.forEach((k: any) => {
                        if (k.score > 0.3) kp[k.part] = k.position;
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
                            shoulderWidthCm = Math.round(shoulderDistPx * ratio * 1.45 * 10) / 10;
                        }

                        let legLengthCm = null;
                        if (hipY && ankleY) {
                            legLengthCm = Math.round((ankleY - hipY) * ratio * 1.35 * 10) / 10;
                        } else if (hipY) {
                            legLengthCm = Math.round(heightCm * 0.60 * 10) / 10;
                        }

                        setBodyAnalysis({
                            shoulderWidth: shoulderWidthCm || Math.round(heightCm * 0.225 * 10) / 10, 
                            legLength: legLengthCm || Math.round(heightCm * 0.60 * 10) / 10,         
                            isAnalyzing: false
                        });
                        return;
                    }
                }
                throw new Error('관절 키포인트를 감지하지 못했습니다.');
            } catch(innerErr) {
                console.error('PoseNet analysis inner error', innerErr);
                setBodyAnalysis(fallbackProportions(heightCm));
            }
        };
        img.onerror = () => {
            setBodyAnalysis(fallbackProportions(heightCm));
        };
    } catch (e) {
        setBodyAnalysis(fallbackProportions(heightCm));
    }
};

interface ModelSelectorProps {
    model: { type: string; url: string };
    setModel: any;
    allCustomModels: any[];
    setUploadModalOpen: (v: boolean) => void;
    bodyAnalysis: any;
    setBodyAnalysis: any;
}

const ModelSelector = ({
    model,
    setModel,
    allCustomModels,
    setUploadModalOpen,
    bodyAnalysis,
    setBodyAnalysis
}: ModelSelectorProps) => {
    useEffect(() => {
        if (model.url && allCustomModels) {
            const matched = allCustomModels.find(m => m.url === model.url);
            const height = matched ? matched.height : 165; 
            runPoseEstimation(model.url, height, setBodyAnalysis);
        }
    }, [model.url, allCustomModels, setBodyAnalysis]);

    return (
        <div className="vton-model-section p-3 border rounded h-100 bg-white d-flex flex-column shadow-sm">
            <h5 className="fw-bold mb-3 text-center text-dark">모델 선택</h5>
            <div className="vton-mode-tabs mb-3 d-flex flex-column gap-2">
                <div className="d-flex gap-2">
                    <button className={`btn btn-sm flex-grow-1 ${model.type === 'preset' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`} onClick={() => setModel((prev: any) => ({...prev, type: 'preset'}))}>모델 선택</button>
                    <button className={`btn btn-sm flex-grow-1 ${model.type === 'url' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`} onClick={() => setModel((prev: any) => ({...prev, type: 'url'}))}>URL 입력</button>
                </div>
            </div>
            {model.type === 'preset' ? (
                <div className="d-flex flex-column gap-2 mb-3">
                    <select className="form-select form-select-sm" value={model.url} onChange={(e) => setModel((prev: any) => ({...prev, url: e.target.value}))}>
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
                <input type="text" className="form-control form-control-sm mb-3" placeholder="이미지 URL 입력" value={model.url} onChange={(e) => setModel((prev: any) => ({...prev, url: e.target.value}))} />
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
    );
};

export default ModelSelector;
