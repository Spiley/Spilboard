const express = require('express');
const fs = require('fs');
const path = require('path');
const si = require('systeminformation');
const app = express();
const PORT = 80;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'apps.json');

// --- API: STATS ---
app.get('/api/stats', async (req, res) => {
    try {
        const [cpu, mem, temp, fsList] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.cpuTemperature(),
            si.fsSize()
        ]);

        // --- DISK LOGICA ---
        // Zoek de schijf die gemount is op '/' (root) OF pak de grootste als '/' niet bestaat
        let disk = fsList.find(d => d.mount === '/') || fsList.sort((a, b) => b.size - a.size)[0];

        // Fallback als er echt niets gevonden wordt
        if (!disk) disk = { used: 0, size: 1 }; 

        res.json({
            cpu: Math.round(cpu.currentLoad) || 0,
            ram: {
                active: mem.active || 0,
                total: mem.total || 1 // Voorkom delen door 0
            },
            rom: {
                used: disk.used || 0,
                size: disk.size || 1 // Voorkom delen door 0
            },
            temp: Math.round(temp.main) || 0
        });
    } catch (error) {
        console.error("Stats Error:", error);
        // Stuur veilige nullen terug bij errors
        res.json({ cpu: 0, ram: { active: 0, total: 1 }, rom: { used: 0, size: 1 }, temp: 0 });
    }
});

// --- API: APPS (Ongewijzigd) ---
app.get('/api/apps', (req, res) => {
    if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
    if (!fs.existsSync(DATA_FILE)) return res.json({}); 
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({});
        try { res.json(JSON.parse(data)); } catch (e) { res.json({}); }
    });
});

app.post('/api/apps', (req, res) => {
    if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
    fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2), (err) => {
        if (err) return res.status(500).send('Error');
        res.json({ success: true });
    });
});

app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send('index.html not found');
});

app.listen(PORT, () => console.log(`Dashboard running on port ${PORT}`));