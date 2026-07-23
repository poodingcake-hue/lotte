import { useState } from 'react';
import { callFalRestApi } from '../../../api/falClient';

export const useVtonGeneration = () => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [progressText, setProgressText] = useState('');
    const [finalResult, setFinalResult] = useState('');
    
    const [characterSheetResult, setCharacterSheetResult] = useState('');
    const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);
    
    const [videoResult, setVideoResult] = useState('');
    const [isVideoGenerating, setIsVideoGenerating] = useState(false);
    const [videoProgressText, setVideoProgressText] = useState('');

    const startVtonProcess = async (model: any, top: any, bottom: any, outer: any, bodyAnalysis: any) => {
        if (!model.url) { alert('모델 이미지가 없습니다.'); return; }
        const layers: Array<{ url: string; cat: string; name: string }> = [];
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
                
            // Analyze Top fit with exact size chart scale ratios if available
            if (top.url && top.item) {
                let garmentShoulder = 38.0; 
                const sizeStr = String(top.sizeCode || '').trim();
                if (sizeStr === 'S' || sizeStr === '55' || sizeStr === '85') garmentShoulder = 37.0;
                else if (sizeStr === 'M' || sizeStr === '66' || sizeStr === '90') garmentShoulder = 39.0;
                else if (sizeStr === 'L' || sizeStr === '77' || sizeStr === '95') garmentShoulder = 41.0;
                else if (sizeStr === 'XL' || sizeStr === '88' || sizeStr === '100') garmentShoulder = 43.0;

                // Extract exact length_cm scaling if size chart data exists
                let topScaleRatio = 1.0;
                try {
                    const imgObj = typeof top.item.image === 'string' ? JSON.parse(top.item.image) : top.item.image;
                    if (imgObj && Array.isArray(imgObj.length_cm) && imgObj.length_cm.length > 0) {
                        const sizes = imgObj.length_cm;
                        const baseEntry = sizes[0]; // Smallest size
                        const selectedEntry = sizes.find((s: any) => String(s.category).trim() === sizeStr) || baseEntry;
                        
                        const baseLen = parseFloat(baseEntry.length);
                        const targetLen = parseFloat(selectedEntry.length);
                        if (!isNaN(baseLen) && !isNaN(targetLen) && baseLen > 0) {
                            topScaleRatio = targetLen / baseLen;
                        }
                    }
                } catch (e) {
                    console.warn('Failed to parse top length_cm:', e);
                }

                if (topScaleRatio > 1.02) {
                    const pct = Math.round((topScaleRatio - 1.0) * 100);
                    fitPromptAdditions += ` The top is size ${sizeStr}, which is ${pct}% larger in total length than the base size. Render the top with a proportionally longer hem and slightly relaxed fit.`;
                } else if (garmentShoulder - modelShoulder > 3) {
                    fitPromptAdditions += " The top should fit loosely and oversized, with relaxed drop shoulders falling naturally.";
                } else if (modelShoulder - garmentShoulder > 2) {
                    fitPromptAdditions += " The top fits tightly and slim-fit, hugging the model's body closely.";
                } else {
                    fitPromptAdditions += " The top has a clean, neat regular fit.";
                }
            }
            
            // Analyze Bottom fit with exact size chart scale ratios if available
            if (bottom.url && bottom.item) {
                let garmentLength = 95.0; 
                const sizeStr = String(bottom.sizeCode || '').trim();
                if (sizeStr === 'S' || sizeStr === '55' || sizeStr === '85') garmentLength = 92.0;
                else if (sizeStr === 'M' || sizeStr === '66' || sizeStr === '90') garmentLength = 95.0;
                else if (sizeStr === 'L' || sizeStr === '77' || sizeStr === '95') garmentLength = 98.0;

                // Extract exact length_cm scaling if size chart data exists
                let bottomScaleRatio = 1.0;
                try {
                    const imgObj = typeof bottom.item.image === 'string' ? JSON.parse(bottom.item.image) : bottom.item.image;
                    if (imgObj && Array.isArray(imgObj.length_cm) && imgObj.length_cm.length > 0) {
                        const sizes = imgObj.length_cm;
                        const baseEntry = sizes[0]; // Smallest size
                        const selectedEntry = sizes.find((s: any) => String(s.category).trim() === sizeStr) || baseEntry;
                        
                        const baseLen = parseFloat(baseEntry.length);
                        const targetLen = parseFloat(selectedEntry.length);
                        if (!isNaN(baseLen) && !isNaN(targetLen) && baseLen > 0) {
                            bottomScaleRatio = targetLen / baseLen;
                        }
                    }
                } catch (e) {
                    console.warn('Failed to parse bottom length_cm:', e);
                }

                if (bottomScaleRatio > 1.02) {
                    const pct = Math.round((bottomScaleRatio - 1.0) * 100);
                    fitPromptAdditions += ` The bottom is selected in size ${sizeStr}, which is ${pct}% longer than the smallest base size. Scale the pant leg length downwards by ${pct}% for a longer fit on the model.`;
                } else if (garmentLength - modelLeg > 5) {
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
            alert('VTON 합성 중 에러 발생:\n' + (e as any).message);
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
            alert('에러 발생:\n' + (e as any).message);
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
            alert('비디오 생성 에러:\n' + (e as any).message);
            setVideoProgressText('생성 실패');
        } finally {
            setIsVideoGenerating(false);
        }
    };

    return {
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
    };
};
