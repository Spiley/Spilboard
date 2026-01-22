const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 80;


app.use(express.json({ limit: '10mb' })); 
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data', 'apps.json');


app.get('/api/apps', (req, res) => {
    if (!fs.existsSync(DATA_FILE)) {
        
        return res.json([]); 
    }
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).send('Error reading data');
        res.json(JSON.parse(data));
    });
});


app.post('/api/apps', (req, res) => {
    const apps = req.body;
    fs.writeFile(DATA_FILE, JSON.stringify(apps, null, 2), (err) => {
        if (err) return res.status(500).send('Error saving data');
        res.json({ success: true });
    });
});

app.listen(PORT, () => console.log(`Dashboard running on port ${PORT}`));