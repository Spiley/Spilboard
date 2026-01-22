// --- DATA MANAGEMENT ---
let dashboardData = {
    apps: [],
    
    widgetSettings: {
        weather: { enabled: true, city: 'Amsterdam' },
        cpu: { enabled: true },
        ram: { enabled: true, display: 'percent' }, // 'percent', 'value', 'both'
        rom: { enabled: true, display: 'both' },
        temp: { enabled: true }
    }
};

const widgetDefinitions = [
    { id: 'weather', name: 'Weather', icon: 'fas fa-cloud-sun', hasSettings: true, type: 'weather' },
    { id: 'cpu', name: 'CPU Load', icon: 'fas fa-microchip', hasSettings: false },
    { id: 'ram', name: 'RAM Usage', icon: 'fas fa-memory', hasSettings: true, type: 'storage' },
    { id: 'rom', name: 'Disk Storage', icon: 'fas fa-hdd', hasSettings: true, type: 'storage' },
    { id: 'temp', name: 'Temperature', icon: 'fas fa-thermometer-half', hasSettings: false }
];

// --- HELPERS ---
function formatBytes(bytes, decimals = 1) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// --- SERVER IO ---
async function loadData() {
    try {
        const response = await fetch('/api/apps');
        const data = await response.json();
        
        if (data && (data.apps || data.widgetSettings)) {
            // Merge loaded data with defaults to ensure new fields exist
            dashboardData.apps = data.apps || [];
            dashboardData.widgetSettings = { ...dashboardData.widgetSettings, ...data.widgetSettings };
            
            // Backwards compatibility migration (old activeWidgets array)
            if (data.activeWidgets) {
                data.activeWidgets.forEach(w => {
                    if (dashboardData.widgetSettings[w]) dashboardData.widgetSettings[w].enabled = true;
                });
                delete dashboardData.activeWidgets;
                saveDataToServer();
            }
        } else {
            saveDataToServer();
        }
    } catch (error) {
        console.log("Offline mode or first load");
    }
    renderAll();
}

async function saveDataToServer() {
    try {
        await fetch('/api/apps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dashboardData)
        });
    } catch (e) { console.error("Save failed", e); }
}

// --- RENDER LOGIC ---
let isEditMode = false;
let editingId = null;

function renderAll() {
    renderWidgets();
    renderApps();
    if (!isEditMode) checkAllPings();
}

// 1. Render Widgets
function renderWidgets() {
    const container = document.getElementById('widgets-area');
    container.innerHTML = '';
    
    // Loop through definitions to keep order
    widgetDefinitions.forEach(def => {
        const settings = dashboardData.widgetSettings[def.id];
        if (!settings || !settings.enabled) return;

        let content = '';
        let title = def.name;

        if(def.id === 'weather') {
            title = settings.city || 'Weather';
            content = `<div class="widget-value" id="weather-temp">--°C</div><div class="weather-desc" id="weather-desc">Loading...</div>`;
        } else {
            // Standard bar widget (CPU, RAM, ROM, TEMP)
            content = `
                <div class="widget-value" id="${def.id}-val">0%</div>
                <div class="widget-subtext" id="${def.id}-sub" style="font-size: 0.8rem; color: var(--text-secondary); height: 1.2em;"></div>
                <div class="progress-container"><div class="progress-bar" id="${def.id}-bar"></div></div>
            `;
        }

        const html = `
            <div class="widget-card">
                <div class="widget-title"><span>${title}</span><i class="${def.icon}"></i></div>
                ${content}
            </div>
        `;
        container.innerHTML += html;
    });

    updateWeather();
    updateRealStats();
}

// 2. Render Apps & Sections
function renderApps() {
    const container = document.getElementById('main-content');
    container.innerHTML = '';
    
    if(dashboardData.apps.length === 0) {
        container.innerHTML = `<div class="empty-state">No apps configured. Click <b>Edit</b> to add your first app!</div>`;
        return;
    }

    const categories = [...new Set(dashboardData.apps.map(a => a.category))].sort();

    categories.forEach(cat => {
        const catApps = dashboardData.apps.filter(a => a.category === cat);
        const section = document.createElement('div');
        section.className = 'section-container';
        
        if (isEditMode) {
            section.ondragover = (e) => { e.preventDefault(); section.classList.add('drag-over'); };
            section.ondragleave = () => section.classList.remove('drag-over');
            section.ondrop = (e) => handleDrop(e, cat);
        }

        section.innerHTML = `<div class="section-header">${cat}</div>`;
        const grid = document.createElement('div');
        grid.className = 'services-grid';

        catApps.forEach(app => {
            const tag = isEditMode ? 'div' : 'a';
            const href = isEditMode ? '' : `href="${app.url}" target="_blank"`;
            const draggableAttr = isEditMode ? 'draggable="true"' : '';
            
            let iconSrc = app.icon;
            if (!iconSrc.startsWith('http') && !iconSrc.startsWith('data:')) {
                iconSrc = `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${app.icon.toLowerCase()}.png`;
            }

            const card = document.createElement('div');
            card.innerHTML = `
                <${tag} ${href} class="service-card" id="card-${app.id}" ${draggableAttr}>
                    ${isEditMode ? `<button class="action-btn btn-delete" onclick="deleteApp(${app.id})"><i class="fas fa-times"></i></button>
                                    <button class="action-btn btn-edit" onclick="editApp(${app.id})"><i class="fas fa-pencil-alt"></i></button>` : ''}
                    <div class="service-icon"><img src="${iconSrc}" onerror="this.src='https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/dashboard.png'"></div>
                    <div class="service-info">
                        <span class="service-name">${app.name}</span>
                        <span class="service-desc">${app.desc}</span>
                        <div class="ping-badge"><span class="status-indicator" id="dot-${app.id}"></span><span id="txt-${app.id}">Check...</span></div>
                    </div>
                </${tag}>
            `;
            
            const el = card.firstElementChild;
            if(isEditMode) {
                el.ondragstart = (e) => {
                    e.dataTransfer.setData('text/plain', app.id);
                    e.dataTransfer.effectAllowed = "move";
                };
            }
            grid.appendChild(el);
        });
        section.appendChild(grid);
        container.appendChild(section);
    });
}

// --- HANDLERS (Drag & Drop) ---
function handleDrop(e, targetCategory) {
    e.preventDefault();
    document.querySelectorAll('.section-container').forEach(s => s.classList.remove('drag-over'));
    const appId = parseInt(e.dataTransfer.getData('text/plain'));
    const appIndex = dashboardData.apps.findIndex(a => a.id === appId);
    if (appIndex > -1) {
        dashboardData.apps[appIndex].category = targetCategory;
        saveDataToServer();
        renderApps();
    }
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    document.body.classList.toggle('editing', isEditMode);
    const editBtn = document.getElementById('editBtn');
    const editControls = document.getElementById('editControls');
    
    if(isEditMode) {
        editBtn.innerHTML = '<i class="fas fa-check"></i> Done';
        editBtn.classList.add('btn-primary');
        editControls.style.display = 'flex';
    } else {
        editBtn.innerHTML = '<i class="fas fa-pen"></i> Edit';
        editBtn.classList.remove('btn-primary');
        editControls.style.display = 'none';
        checkAllPings();
    }
    renderApps();
}

// --- APP MODAL ---
function openModal() {
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('modalTitle').innerText = editingId ? "Configure App" : "Add App";
    const dl = document.getElementById('category-suggestions');
    dl.innerHTML = '';
    [...new Set(dashboardData.apps.map(a => a.category))].forEach(c => dl.innerHTML += `<option value="${c}">`);
}
function closeModal() { document.getElementById('modal').style.display = 'none'; resetForm(); }
function resetForm() {
    editingId = null;
    document.getElementById('appCategory').value = '';
    document.getElementById('appName').value = '';
    document.getElementById('appDesc').value = '';
    document.getElementById('appUrl').value = '';
    document.getElementById('appIconFile').value = '';
    document.getElementById('finalIconData').value = '';
    document.getElementById('icon-preview').innerHTML = '<i class="fas fa-image"></i>';
}

function saveApp() {
    const cat = document.getElementById('appCategory').value || "General";
    const name = document.getElementById('appName').value;
    let url = document.getElementById('appUrl').value;
    const icon = document.getElementById('finalIconData').value || 'dashboard';

    if(!name || !url) { alert("Please enter a name and URL."); return; }
    if (!/^https?:\/\//i.test(url)) url = 'http://' + url;

    if(editingId) {
        const idx = dashboardData.apps.findIndex(a => a.id === editingId);
        if(idx > -1) dashboardData.apps[idx] = { ...dashboardData.apps[idx], category: cat, name, desc: document.getElementById('appDesc').value, url, icon };
    } else {
        dashboardData.apps.push({ id: Date.now(), category: cat, name, desc: document.getElementById('appDesc').value, url, icon });
    }
    saveDataToServer();
    closeModal();
    renderApps();
}

function editApp(id) {
    editingId = id;
    const app = dashboardData.apps.find(a => a.id === id);
    document.getElementById('appCategory').value = app.category;
    document.getElementById('appName').value = app.name;
    document.getElementById('appDesc').value = app.desc;
    document.getElementById('appUrl').value = app.url;
    
    let iconSrc = app.icon;
    if (!iconSrc.startsWith('http') && !iconSrc.startsWith('data:')) iconSrc = `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${app.icon.toLowerCase()}.png`;
    document.getElementById('icon-preview').innerHTML = `<img src="${iconSrc}">`;
    document.getElementById('finalIconData').value = app.icon;
    openModal();
}

function deleteApp(id) {
    if(confirm('Delete this app?')) {
        dashboardData.apps = dashboardData.apps.filter(a => a.id !== id);
        saveDataToServer();
        renderApps();
    }
}

// --- WIDGET MODAL LOGIC ---
function openWidgetModal() {
    const list = document.getElementById('widget-options-list');
    list.innerHTML = '';
    
    widgetDefinitions.forEach(def => {
        // Zorg dat er een default settings object is
        if (!dashboardData.widgetSettings[def.id]) {
            dashboardData.widgetSettings[def.id] = { enabled: false };
        }
        const settings = dashboardData.widgetSettings[def.id];
        
        let configHTML = '';

        // WEATHER CONFIG
        if (def.type === 'weather') {
            configHTML = `
                <div class="widget-config">
                    <label>City Name</label>
                    <input type="text" class="setting-city" data-id="${def.id}" value="${settings.city || 'Amsterdam'}" placeholder="London">
                    <label style="margin-top:5px; font-size:0.7rem; color:#aaa">Coordinates are fetched automatically on save.</label>
                </div>
            `;
        } 
        // RAM/ROM CONFIG
        else if (def.type === 'storage') {
            const currentMode = settings.display || 'percent';
            configHTML = `
                <div class="widget-config">
                    <label>Display Mode</label>
                    <select class="setting-display" data-id="${def.id}">
                        <option value="percent" ${currentMode === 'percent' ? 'selected' : ''}>Percentage (%)</option>
                        <option value="value" ${currentMode === 'value' ? 'selected' : ''}>Actual Value (GB)</option>
                        <option value="both" ${currentMode === 'both' ? 'selected' : ''}>Both</option>
                    </select>
                </div>
            `;
        }

        list.innerHTML += `
            <div class="widget-option-item ${settings.enabled ? 'selected' : ''}" id="widget-item-${def.id}">
                <div class="widget-header" onclick="toggleWidget(this, '${def.id}')">
                    <span style="display:flex; gap:10px; align-items:center"><i class="${def.icon}"></i> ${def.name}</span>
                    <div class="check-circle"></div>
                </div>
                ${configHTML}
            </div>
        `;
    });
    document.getElementById('widgetModal').style.display = 'flex';
}

function toggleWidget(headerEl, id) {
    const item = headerEl.parentElement;
    item.classList.toggle('selected');
    dashboardData.widgetSettings[id].enabled = item.classList.contains('selected');
}

async function closeWidgetModal() {
    // 1. Save all inputs from the modal
    const inputs = document.querySelectorAll('.setting-city');
    for (const input of inputs) {
        const id = input.dataset.id;
        const city = input.value;
        if(city && city !== dashboardData.widgetSettings[id].city) {
            // Fetch coords
            try {
                const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`);
                const data = await res.json();
                if(data.results && data.results.length > 0) {
                    dashboardData.widgetSettings[id].city = data.results[0].name;
                    dashboardData.widgetSettings[id].lat = data.results[0].latitude;
                    dashboardData.widgetSettings[id].lon = data.results[0].longitude;
                }
            } catch(e) {}
        }
    }

    const selects = document.querySelectorAll('.setting-display');
    selects.forEach(sel => {
        const id = sel.dataset.id;
        dashboardData.widgetSettings[id].display = sel.value;
    });

    document.getElementById('widgetModal').style.display = 'none';
    saveDataToServer();
    renderWidgets();
}

// --- UTILS (Icons, Pings, Stats) ---
function handleFileUpload(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('icon-preview').innerHTML = `<img src="${e.target.result}">`;
            document.getElementById('finalIconData').value = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}
function tryFetchIcon() {
    if(document.getElementById('appIconFile').files.length > 0) return;
    const name = document.getElementById('appName').value;
    if(name.length > 2) {
        const url = `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${name.toLowerCase()}.png`;
        document.getElementById('icon-preview').innerHTML = `<img src="${url}">`;
        document.getElementById('finalIconData').value = name;
    }
}
async function checkPing(app) {
    const dot = document.getElementById(`dot-${app.id}`);
    const txt = document.getElementById(`txt-${app.id}`);
    if(!dot) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const start = performance.now();
    try {
        await fetch(app.url, { mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeout);
        dot.className = 'status-indicator online';
        txt.innerText = `${Math.round(performance.now() - start)}ms`; txt.style.color = 'var(--status-online)';
    } catch {
        clearTimeout(timeout);
        dot.className = 'status-indicator offline';
        txt.innerText = 'Offline'; txt.style.color = 'var(--status-offline)';
    }
}
function checkAllPings() { dashboardData.apps.forEach(app => checkPing(app)); }

// --- UPDATES ---
function updateTime() {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleDateString('en-US', {weekday:'long', day:'numeric', month:'long'}) + ' • ' + now.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
    const h = now.getHours();
    let greeting = "Good evening";
    if(h < 12) greeting = "Good morning";
    else if(h < 18) greeting = "Good afternoon";
    document.getElementById('greeting').innerText = greeting;
}

async function updateWeather() {
    const settings = dashboardData.widgetSettings.weather;
    if(!settings || !settings.enabled || !document.getElementById('weather-temp')) return;
    
    // Default Amsterdam if missing
    const lat = settings.lat || 52.3676;
    const lon = settings.lon || 4.9041;
    
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
        const data = await res.json();
        document.getElementById('weather-temp').innerText = Math.round(data.current.temperature_2m) + "°C";
        const code = data.current.weather_code;
        let desc = "Clear";
        if(code > 2) desc = "Cloudy";
        if(code > 50) desc = "Rainy";
        document.getElementById('weather-desc').innerText = desc;
    } catch {}
}

async function updateRealStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        // CPU
        if(document.getElementById('cpu-bar')) {
            const val = data.cpu || 0;
            document.getElementById('cpu-val').innerText = val + "%";
            document.getElementById('cpu-bar').style.width = val + "%";
        }

        // TEMP
        if(document.getElementById('temp-bar')) {
            const val = data.temp || 0;
            document.getElementById('temp-val').innerText = val + "°C";
            document.getElementById('temp-bar').style.width = Math.min(val, 100) + "%";
        }

        // Helper voor RAM & ROM
        const updateStorageWidget = (id, current, total) => {
            const elVal = document.getElementById(`${id}-val`);
            const elSub = document.getElementById(`${id}-sub`);
            const elBar = document.getElementById(`${id}-bar`);
            
            if(!elVal) return;

            // NAN CHECK: Als total 0 of ongeldig is, zet alles op 0
            if (!total || total <= 0) {
                elVal.innerText = "-";
                elBar.style.width = "0%";
                return;
            }

            const mode = dashboardData.widgetSettings[id].display || 'percent';
            let percent = Math.round((current / total) * 100);
            
            // Extra veiligheid
            if (isNaN(percent)) percent = 0;

            elBar.style.width = percent + "%";
            if (percent > 85) elBar.style.background = 'linear-gradient(90deg, #ff9900, #ff3333)';
            else elBar.style.background = '';

            if (mode === 'percent') {
                elVal.innerText = percent + "%";
                elSub.innerText = "";
            } else if (mode === 'value') {
                elVal.innerText = formatBytes(current) + " / " + formatBytes(total);
                elSub.innerText = "";
            } else { // both
                elVal.innerText = percent + "%";
                elSub.innerText = formatBytes(current) + " / " + formatBytes(total);
            }
        };

        // RAM
        if(data.ram) updateStorageWidget('ram', data.ram.active, data.ram.total);
        
        // ROM
        if(data.rom) updateStorageWidget('rom', data.rom.used, data.rom.size);

    } catch (e) {
        console.error("Stats offline", e);
    }
}

// START
loadData();
updateTime();
setInterval(updateTime, 1000);
setInterval(updateRealStats, 2000);
setInterval(updateWeather, 600000);
setInterval(() => { if(!isEditMode) checkAllPings(); }, 10000);