const express = require('express');
const fs = require('fs');
const path = require('path');
const si = require('systeminformation'); // New library
const app = express();
const PORT = 80;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'apps.json');

// --- API: STATS (NIEUW) ---
app.get('/api/stats', async (req, res) => {
    try {
        // Haal CPU, Geheugen en Temp op
        const [cpu, mem, temp] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.cpuTemperature()
        ]);

        res.json({
            cpu: Math.round(cpu.currentLoad),
            ram: Math.round((mem.active / mem.total) * 100),
            temp: Math.round(temp.main) || 0 // Fallback naar 0 als sensor faalt
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching stats' });
    }
});

// --- API: APPS ---
// --- API: STATS ---
app.get('/api/stats', async (req, res) => {
    try {
        // Haal CPU, Geheugen, Temp en Schijf op
        const [cpu, mem, temp, fs] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.cpuTemperature(),
            si.fsSize()
        ]);

        // We pakken de eerste schijf (meestal de root /). 
        // Of je kunt filteren op mount: '/'
        const disk = fs.length > 0 ? fs[0] : { used: 0, size: 0 };

        res.json({
            cpu: Math.round(cpu.currentLoad),
            ram: {
                active: mem.active,
                total: mem.total
            },
            rom: {
                used: disk.used,
                size: disk.size
            },
            temp: Math.round(temp.main) || 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching stats' });
    }
});

app.post('/api/apps', (req, res) => {
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
        fs.mkdirSync(path.join(__dirname, 'data'));
    }
    const apps = req.body;
    fs.writeFile(DATA_FILE, JSON.stringify(apps, null, 2), (err) => {
        if (err) return res.status(500).send('Error saving data');
        res.json({ success: true });
    });
});

// Vangnet route
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send('index.html not found');
});

app.listen(PORT, () => console.log(`Dashboard running on port ${PORT}`));