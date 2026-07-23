const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://lotte-backend.poodingcake.workers.dev';

export async function callFalRestApi(modelUrl: string, payload: any): Promise<any> {
    const res = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: "fal_api_proxy", data: { modelUrl, payload } })
    });

    if (!res.ok) {
        throw new Error('Fal API Error: ' + res.status);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    
    // Polling if request is queued
    if (data.status_url && data.response_url) {
        return await pollFalRequest(data.status_url, data.response_url);
    }
    
    return data;
}

async function pollFalRequest(statusUrl: string, responseUrl: string): Promise<any> {
    const maxRetries = 180; // Max 3 minutes
    let attempts = 0;

    while (attempts < maxRetries) {
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
        
        const statusRes = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: "fal_api_status", data: { statusUrl } })
        });
        
        if (!statusRes.ok) throw new Error('Polling failed');
        
        const statusData = await statusRes.json();
        if (statusData.error) throw new Error(statusData.error);
        
        if (statusData.status === 'COMPLETED') {
            const finalRes = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: "fal_api_result", data: { responseUrl } })
            });
            const finalData = await finalRes.json();
            if (finalData.error) throw new Error(finalData.error);
            return finalData;
        } else if (statusData.status === 'FAILED' || statusData.status === 'CANCELED') {
            throw new Error('Fal API Processing Failed: ' + statusData.status);
        }
        // If IN_QUEUE or IN_PROGRESS, continue while loop
    }
    throw new Error('Fal API Polling Timeout (3 minutes exceeded)');
}

export async function removeBackground(imageBase64: string): Promise<string> {
    try {
        const res = await callFalRestApi("fal-ai/birefnet", { image_url: imageBase64 });
        if (res && res.image && res.image.url) {
            // fal.ai returns a URL to the transparent PNG. 
            // We tell our backend to fetch it and upload it to our R2 bucket directly to avoid CORS and Base64 D1 limits.
            const uploadRes = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'upload_url_to_r2', data: { url: res.image.url } })
            });
            
            const uploadData = await uploadRes.json();
            if (uploadData.success) {
                return uploadData.imageUrl; // Returns R2 URL!
            }
            throw new Error(uploadData.message || "Failed to upload nukki image to R2");
        }
        throw new Error("Failed to get image url from fal.ai");
    } catch (e) {
        console.error("Background removal failed:", e);
        throw e;
    }
}

