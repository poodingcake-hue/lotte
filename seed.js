const fs = require('fs');

async function seed() {
    const workerUrl = "https://lotte-backend.poodingcake.workers.dev";
    
    // rentals
    if (fs.existsSync('rentals.json')) {
        const rentals = JSON.parse(fs.readFileSync('rentals.json', 'utf8'));
        await fetch(workerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "save_rentals", data: rentals }) });
        console.log("Seeded rentals");
    }
    // outfits
    if (fs.existsSync('outfits.json')) {
        const outfits = JSON.parse(fs.readFileSync('outfits.json', 'utf8'));
        await fetch(workerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "save_outfits", data: outfits }) });
        console.log("Seeded outfits");
    }
    // notes
    if (fs.existsSync('notes.json')) {
        const notes = JSON.parse(fs.readFileSync('notes.json', 'utf8'));
        await fetch(workerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "save_notes", data: notes }) });
        console.log("Seeded notes");
    }
    // supplies
    if (fs.existsSync('supplies.json')) {
        const supplies = JSON.parse(fs.readFileSync('supplies.json', 'utf8'));
        await fetch(workerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "save_supplies", data: supplies }) });
        console.log("Seeded supplies");
    }
    
    // inventory (from data.json)
    if (fs.existsSync('data.json')) {
        const master = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        let flatInventory = [];
        if (master.stockMap) {
            Object.keys(master.stockMap).forEach(code => {
                master.stockMap[code].forEach(item => {
                    flatInventory.push({ code: code, color: item.color, size: item.size, qty: item.qty });
                });
            });
        }
        await fetch(workerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "save_inventory", data: flatInventory }) });
        console.log("Seeded inventory");
    }
}
seed();
