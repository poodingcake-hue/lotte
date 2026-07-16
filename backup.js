const fs = require('fs');

async function backup() {
    const workerUrl = "https://lotte-backend.poodingcake.workers.dev?action=getAll";
    
    try {
        console.log("Fetching live data from Cloudflare D1...");
        const response = await fetch(workerUrl);
        if (!response.ok) throw new Error("Failed to fetch data from live database");
        
        const dbData = await response.json();
        
        // 1. rentals.json
        if (dbData.rentals) {
            fs.writeFileSync('rentals.json', JSON.stringify(dbData.rentals, null, 2), 'utf8');
            console.log(`- Backed up ${dbData.rentals.length} rentals to rentals.json`);
        }
        
        // 2. outfits.json
        if (dbData.outfits) {
            fs.writeFileSync('outfits.json', JSON.stringify(dbData.outfits, null, 2), 'utf8');
            console.log(`- Backed up ${dbData.outfits.length} outfits to outfits.json`);
        }
        
        // 3. notes.json
        if (dbData.notes) {
            fs.writeFileSync('notes.json', JSON.stringify(dbData.notes, null, 2), 'utf8');
            console.log(`- Backed up ${dbData.notes.length} notes to notes.json`);
        }
        
        // 4. supplies.json
        if (dbData.supplies) {
            fs.writeFileSync('supplies.json', JSON.stringify(dbData.supplies, null, 2), 'utf8');
            console.log(`- Backed up ${dbData.supplies.length} supplies to supplies.json`);
        }
        
        console.log("\nSuccess: Local backup files updated successfully!");
        
    } catch (e) {
        console.error("Backup failed:", e);
    }
}

backup();
