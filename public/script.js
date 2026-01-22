// --- DATA MANAGEMENT ---
let dashboardData = {
    apps: [],
    widgetSettings: {
        weather: { enabled: true },
        cpu: { enabled: true },
        ram: { enabled: true, display: 'percent' }, // 'percent', 'value', 'both'
        rom: { enabled: true, display: 'both' },
        temp: { enabled: true }
    },

    settings: {
        weatherCity: 'Amsterdam',
        weatherLat: 52.3676,
        weatherLon: 4.9041,
        bgType: 'url',
        bgValue: 'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?q=80&w=2070&auto=format&fit=crop'
    }
};
let tempWeatherLoc = null; 
let searchTimeout = null;  
const widgetDefinitions = [
    { id: 'weather', name: 'Weather', icon: 'fas fa-cloud-sun', type: 'weather' },
    { id: 'cpu', name: 'CPU Load', icon: 'fas fa-microchip', type: 'bar' },
    { id: 'ram', name: 'RAM Usage', icon: 'fas fa-memory', type: 'storage' },
    { id: 'rom', name: 'Disk Storage', icon: 'fas fa-hdd', type: 'storage' },
    { id: 'temp', name: 'Temperature', icon: 'fas fa-thermometer-half', type: 'bar' }
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
        
        if (data && (data.apps || data.widgetSettings || data.settings)) {
            //  defaults
            dashboardData.apps = data.apps || [];
            if(data.widgetSettings) dashboardData.widgetSettings = { ...dashboardData.widgetSettings, ...data.widgetSettings };
            if(data.settings) dashboardData.settings = { ...dashboardData.settings, ...data.settings };
        } else {
         
            saveDataToServer();
        }
    } catch (error) {
        console.log("Offline mode or first load");
    }
    applyBackground();
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

// --- BACKGROUND LOGIC ---
function applyBackground() {
    const bg = document.getElementById('app-background');
    const type = dashboardData.settings.bgType || 'gradient';
    const val = dashboardData.settings.bgValue;

    // Reset
    bg.className = '';
    bg.style.backgroundImage = '';
    bg.style.boxShadow = '';

    if (type === 'gradient') {
        bg.classList.add('bg-gradient');
    } else if ((type === 'url' || type === 'upload') && val) {
        bg.style.backgroundImage = `url('${val}')`;
        // Dark overlay voor leesbaarheid
        bg.style.boxShadow = "inset 0 0 0 2000px rgba(0, 0, 0, 0.4)";
    }
}

function toggleBgInputs() {
    const type = document.getElementById('bgType').value;
    document.getElementById('bgInputUrlGroup').style.display = (type === 'url') ? 'block' : 'none';
    document.getElementById('bgInputFileGroup').style.display = (type === 'upload') ? 'block' : 'none';
}

function handleBgUpload(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('bgFileData').value = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
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
    
    widgetDefinitions.forEach(def => {
        if(!dashboardData.widgetSettings[def.id]) dashboardData.widgetSettings[def.id] = { enabled: true };
        
        const settings = dashboardData.widgetSettings[def.id];
        if (!settings.enabled) return;

        let content = '';
        let title = def.name;

        if(def.id === 'weather') {
            title = dashboardData.settings.weatherCity || 'Weather';
            content = `<div class="widget-value" id="weather-temp">--°C</div><div class="weather-desc" id="weather-desc">Loading...</div>`;
        } else {
            // Stats Widgets (CPU, RAM, ROM, TEMP)
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

    // Trigger updates
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
        section.setAttribute('data-category', cat); 
        
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

// --- WIDGET MODAL (Enable/Disable & Display Mode) ---
function openWidgetModal() {
    const list = document.getElementById('widget-options-list');
    list.innerHTML = '';
    
    widgetDefinitions.forEach(def => {
        if (!dashboardData.widgetSettings[def.id]) dashboardData.widgetSettings[def.id] = { enabled: false };
        const settings = dashboardData.widgetSettings[def.id];
        
        let configHTML = '';

        if (def.type === 'storage') {
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

function closeWidgetModal() {
    const selects = document.querySelectorAll('.setting-display');
    selects.forEach(sel => {
        const id = sel.dataset.id;
        dashboardData.widgetSettings[id].display = sel.value;
    });

    document.getElementById('widgetModal').style.display = 'none';
    saveDataToServer();
    renderWidgets();
}

// --- SETTINGS MODAL (Weather & Background) ---
function openSettingsModal() {
    // Weather
    document.getElementById('settingCity').value = dashboardData.settings.weatherCity || '';
    
    // Background
    const bgType = dashboardData.settings.bgType || 'gradient';
    document.getElementById('bgType').value = bgType;
    document.getElementById('bgUrl').value = (bgType === 'url') ? (dashboardData.settings.bgValue || '') : '';
    document.getElementById('bgFile').value = ''; 
    
    toggleBgInputs();
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() { document.getElementById('settingsModal').style.display = 'none'; }

async function saveSettings() {
    // 1. Weather Logic
    const inputCity = document.getElementById('settingCity').value;
    

    if (tempWeatherLoc && tempWeatherLoc.name === inputCity) {

        dashboardData.settings.weatherCity = tempWeatherLoc.name;
        dashboardData.settings.weatherLat = tempWeatherLoc.lat;
        dashboardData.settings.weatherLon = tempWeatherLoc.lon;
    } 
   
    else if (inputCity && inputCity !== dashboardData.settings.weatherCity) {
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${inputCity}&count=1&language=en&format=json`);
            const data = await res.json();
            if(data.results && data.results.length > 0) {
                const loc = data.results[0];
                dashboardData.settings.weatherCity = loc.name;
                dashboardData.settings.weatherLat = loc.latitude;
                dashboardData.settings.weatherLon = loc.longitude;
            } else {
                alert("City not found. Please try selecting from the list.");
                return; 
            }
        } catch(e) {
            alert("Error searching city.");
            return;
        }
    }

    // 2. Background Logic 
    const bgType = document.getElementById('bgType').value;
    dashboardData.settings.bgType = bgType;

    if (bgType === 'url') {
        dashboardData.settings.bgValue = document.getElementById('bgUrl').value;
    } else if (bgType === 'upload') {
        const fileData = document.getElementById('bgFileData').value;
        if (fileData) dashboardData.settings.bgValue = fileData;
    } else {
        dashboardData.settings.bgValue = ''; 
    }

    applyBackground();
    saveDataToServer();
    closeSettingsModal();
    renderWidgets(); 
}

// --- CITY AUTOCOMPLETE LOGIC ---
function handleCityInput(input) {
    const query = input.value;
    const list = document.getElementById('city-suggestions');

    
    tempWeatherLoc = null;

    
    if (query.length < 2) {
        list.style.display = 'none';
        return;
    }

   
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => fetchCitySuggestions(query), 300);
}

async function fetchCitySuggestions(query) {
    const list = document.getElementById('city-suggestions');
    try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=en&format=json`);
        const data = await res.json();

        list.innerHTML = ''; 

        if (data.results && data.results.length > 0) {
            list.style.display = 'block';
            data.results.forEach(loc => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                
                
                const extraInfo = [loc.admin1, loc.country].filter(Boolean).join(', ');
                
                item.innerHTML = `
                    <span>${loc.name}</span>
                    <span class="suggestion-detail">${extraInfo}</span>
                `;

                
                item.onclick = () => selectCity(loc);
                list.appendChild(item);
            });
        } else {
            list.style.display = 'none';
        }
    } catch (e) {
        console.error("Search error", e);
    }
}

function selectCity(loc) {
    const input = document.getElementById('settingCity');
    const list = document.getElementById('city-suggestions');

    
    input.value = loc.name;
    tempWeatherLoc = {
        name: loc.name,
        lat: loc.latitude,
        lon: loc.longitude
    };

    list.style.display = 'none'; 
}


document.addEventListener('click', (e) => {
    const list = document.getElementById('city-suggestions');
    const input = document.getElementById('settingCity');
    if (e.target !== list && e.target !== input) {
        list.style.display = 'none';
    }
});

// --- UTILS ---
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

// --- LIVE UPDATES ---
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
    const lat = dashboardData.settings.weatherLat || 52.3676;
    const lon = dashboardData.settings.weatherLon || 4.9041;
    
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

        // Helper RAM & ROM
        const updateStorageWidget = (id, current, total) => {
            const elVal = document.getElementById(`${id}-val`);
            const elSub = document.getElementById(`${id}-sub`);
            const elBar = document.getElementById(`${id}-bar`);
            
            if(!elVal) return;

            // NAN Safety Check
            if (!total || total <= 0) {
                elVal.innerText = "-";
                elBar.style.width = "0%";
                return;
            }

            const mode = dashboardData.widgetSettings[id].display || 'percent';
            let percent = Math.round((current / total) * 100);
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
        if(data.ram && dashboardData.widgetSettings.ram.enabled) {
            updateStorageWidget('ram', data.ram.active, data.ram.total);
        }
        
        // ROM
        if(data.rom && dashboardData.widgetSettings.rom.enabled) {
            updateStorageWidget('rom', data.rom.used, data.rom.size);
        }

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