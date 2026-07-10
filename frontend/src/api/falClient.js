const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://lotte-backend.poodingcake.workers.dev';

export async function callFalRestApi(modelUrl, payload) {
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

async function pollFalRequest(statusUrl, responseUrl) {
    while (true) {
        await new Promise(r => setTimeout(r, 1000));
        
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
}
