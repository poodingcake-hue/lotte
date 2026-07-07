const FAL_API_KEY = "ab9ebfbb-06b6-464a-bd70-76a37275c52c:07e2021c9c1306e2aa3c52323b23772a";

export async function callFalRestApi(modelUrl, payload) {
    const key = FAL_API_KEY;
    const res = await fetch(`https://queue.fal.run/${modelUrl}`, {
        method: 'POST',
        headers: {
            'Authorization': 'Key ' + key,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        throw new Error('Fal API Error: ' + res.status);
    }

    const data = await res.json();
    
    // Polling if request is queued
    if (data.status_url && data.response_url) {
        return await pollFalRequest(data.status_url, data.response_url, key);
    }
    
    return data;
}

async function pollFalRequest(statusUrl, responseUrl, key) {
    while (true) {
        await new Promise(r => setTimeout(r, 1000));
        
        const statusRes = await fetch(statusUrl, {
            headers: { 'Authorization': 'Key ' + key }
        });
        
        if (!statusRes.ok) throw new Error('Polling failed');
        
        const statusData = await statusRes.json();
        
        if (statusData.status === 'COMPLETED') {
            const finalRes = await fetch(responseUrl, {
                headers: { 'Authorization': 'Key ' + key }
            });
            return await finalRes.json();
        } else if (statusData.status === 'FAILED' || statusData.status === 'CANCELED') {
            throw new Error('Fal API Processing Failed: ' + statusData.status);
        }
        // If IN_QUEUE or IN_PROGRESS, continue while loop
    }
}
