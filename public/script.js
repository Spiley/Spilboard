 // --- DATA MANAGEMENT ---
        let dashboardData = {
            apps: [], // NO APPS BY DEFAULT
            activeWidgets: ['weather', 'cpu', 'ram', 'temp'],
            settings: {
                weatherCity: 'Amsterdam',
                weatherLat: 52.3676,
                weatherLon: 4.9041
            }
        };

        const availableWidgets = [
            { id: 'weather', name: 'Weather', icon: 'fas fa-cloud-sun' },
            { id: 'cpu', name: 'CPU Load (Sim)', icon: 'fas fa-microchip' },
            { id: 'ram', name: 'RAM Usage (Sim)', icon: 'fas fa-memory' },
            { id: 'temp', name: 'Temperature (Sim)', icon: 'fas fa-thermometer-half' }
        ];

        // --- SERVER IO ---
        async function loadData() {
            try {
                const response = await fetch('/api/apps');
                const data = await response.json();
                
                if (Array.isArray(data)) {
                    // Old format migration (array of apps only)
                    dashboardData.apps = data;
                    saveDataToServer(); 
                } else if (data && (data.apps || data.activeWidgets)) {
                    // New format
                    dashboardData = { ...dashboardData, ...data };
                    // Ensure settings object exists
                    if(!dashboardData.settings) {
                        dashboardData.settings = { weatherCity: 'Amsterdam', weatherLat: 52.3676, weatherLon: 4.9041 };
                    }
                } else {
                    // Empty or first run
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
            
            dashboardData.activeWidgets.forEach(widgetId => {
                const wInfo = availableWidgets.find(w => w.id === widgetId);
                if (!wInfo) return;

                let content = '';
                if(widgetId === 'weather') {
                    content = `<div class="widget-value" id="weather-temp">--°C</div><div class="weather-desc" id="weather-desc">Loading...</div>`;
                } else {
                    content = `<div class="widget-value" id="${widgetId}-val">0%</div><div class="progress-container"><div class="progress-bar" id="${widgetId}-bar"></div></div>`;
                }

                let title = wInfo.name;
                if(widgetId === 'weather') title = dashboardData.settings.weatherCity || 'Weather';

                const html = `
                    <div class="widget-card">
                        <div class="widget-title"><span>${title}</span><i class="${wInfo.icon}"></i></div>
                        ${content}
                    </div>
                `;
                container.innerHTML += html;
            });
            updateWeather();
            updateSimStats();
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

        // --- HANDLERS ---
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

        // --- WIDGET MODAL ---
        function openWidgetModal() {
            const list = document.getElementById('widget-options-list');
            list.innerHTML = '';
            availableWidgets.forEach(w => {
                const isActive = dashboardData.activeWidgets.includes(w.id);
                list.innerHTML += `
                    <div class="widget-option ${isActive ? 'selected' : ''}" onclick="toggleWidgetSelection(this, '${w.id}')">
                        <span style="display:flex; gap:10px; align-items:center"><i class="${w.icon}"></i> ${w.name}</span>
                        <div class="check-circle"></div>
                    </div>
                `;
            });
            document.getElementById('widgetModal').style.display = 'flex';
        }
        function toggleWidgetSelection(el, id) {
            el.classList.toggle('selected');
            if(dashboardData.activeWidgets.includes(id)) {
                dashboardData.activeWidgets = dashboardData.activeWidgets.filter(w => w !== id);
            } else {
                dashboardData.activeWidgets.push(id);
            }
        }
        function closeWidgetModal() {
            document.getElementById('widgetModal').style.display = 'none';
            saveDataToServer();
            renderWidgets();
        }

        // --- SETTINGS MODAL (WEATHER) ---
        function openSettingsModal() {
            document.getElementById('settingCity').value = dashboardData.settings.weatherCity || '';
            document.getElementById('settingsModal').style.display = 'flex';
        }
        function closeSettingsModal() { document.getElementById('settingsModal').style.display = 'none'; }
        
        async function saveSettings() {
            const city = document.getElementById('settingCity').value;
            if(city && city.length > 2) {
                // Fetch Geocoding
                try {
                    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`);
                    const data = await res.json();
                    if(data.results && data.results.length > 0) {
                        const loc = data.results[0];
                        dashboardData.settings.weatherCity = loc.name;
                        dashboardData.settings.weatherLat = loc.latitude;
                        dashboardData.settings.weatherLon = loc.longitude;
                        alert(`Found: ${loc.name}, ${loc.country}`);
                    } else {
                        alert("City not found. Please try again.");
                        return;
                    }
                } catch(e) {
                    alert("Error searching for city.");
                    return;
                }
            }
            saveDataToServer();
            closeSettingsModal();
            renderWidgets();
        }

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
            if(!document.getElementById('weather-temp')) return;
            // Use settings
            const lat = dashboardData.settings.weatherLat;
            const lon = dashboardData.settings.weatherLon;
            
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

        function updateSimStats() {
            const set = (id, bar, min, max) => {
                const elVal = document.getElementById(id);
                const elBar = document.getElementById(bar);
                if(elVal && elBar) {
                    const val = Math.floor(Math.random() * (max - min) + min);
                    elVal.innerText = val + (id.includes('temp') ? "°C" : "%");
                    elBar.style.width = val + "%";
                }
            };
            set('cpu-val', 'cpu-bar', 10, 40); set('ram-val', 'ram-bar', 30, 60); set('temp-val', 'temp-bar', 35, 55);
        }

        // START
        loadData();
        updateTime();
        setInterval(updateTime, 1000);
        setInterval(updateSimStats, 3000);
        setInterval(updateWeather, 600000);
        setInterval(() => { if(!isEditMode) checkAllPings(); }, 10000);