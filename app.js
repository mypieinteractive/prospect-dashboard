function updateShiftCursor(isShiftDown) {
    const wrap = document.getElementById('map-wrapper');
    if (wrap) {
        if (isShiftDown && !wrap.classList.contains('shift-down')) {
            wrap.classList.add('shift-down');
        } else if (!isShiftDown && wrap.classList.contains('shift-down')) {
            wrap.classList.remove('shift-down');
        }
    }
}
document.addEventListener('keydown', (e) => { if (e.key === 'Shift') updateShiftCursor(true); });
document.addEventListener('keyup', (e) => { if (e.key === 'Shift') updateShiftCursor(false); });
document.addEventListener('mousemove', (e) => { updateShiftCursor(e.shiftKey); });

const MAPBOX_TOKEN = 'pk.eyJ1IjoibXlwaWVpbnRlcmFjdGl2ZSIsImEiOiJjbWx2ajk5Z2MwOGZlM2VwcDBkc295dzI1In0.eGIhcRPrj_Hx_PeoFAYxBA';
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzgh2KCzfdWbOmdVq_edpuI_m6HxkfErzYAEHySfKkq1zgLtwuiUT3GCS5Xor9GgjFa/exec';

let COMPANY_SERVICE_DELAY = 1; 
let PERMISSION_MODIFY = true;
let PERMISSION_REOPTIMIZE = true;
let sortableInstance = null;
let currentRouteCount = 1; // Used for Routing View Divider

const params = new URLSearchParams(window.location.search);
const routeId = params.get('id');
const driverParam = params.get('driver');
const companyParam = params.get('company');
const viewMode = params.get('view') || 'driver'; 

document.body.className = `view-${viewMode}`;

if (viewMode === 'manager' || viewMode === 'routing') {
    document.getElementById('bulk-remove-btn').innerHTML = '<i class="fa-solid fa-trash-can"></i> Remove selected';
}

mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({ 
    container: 'map', 
    style: 'mapbox://styles/mapbox/dark-v11', 
    center: [-96.797, 32.776], 
    zoom: 11, 
    attributionControl: false,
    boxZoom: false 
});

let stops = [], originalStops = [], inspectors = [], markers = [], initialBounds = null, selectedIds = new Set(), currentDisplayMode = 'detailed', currentStartTime = "8:00 AM";
let currentSort = { col: null, asc: true };

const INSPECTOR_PALETTE = [
    { bg: '#2563eb', text: '#ffffff' }, 
    { bg: '#10b981', text: '#ffffff' }, 
    { bg: '#f1c40f', text: '#000000' }, 
    { bg: '#9b59b6', text: '#ffffff' }, 
    { bg: '#e67e22', text: '#000000' }, 
    { bg: '#1abc9c', text: '#000000' }, 
    { bg: '#e84393', text: '#ffffff' }, 
    { bg: '#00cec9', text: '#000000' }, 
    { bg: '#bcf60c', text: '#000000' }, 
    { bg: '#3f51b5', text: '#ffffff' }  
];

// Helper: Filters out stops depending on the view Mode.
function isActiveStop(s) {
    if (viewMode === 'routing') {
        return s.status && s.status.toLowerCase() === 'routed';
    }
    return s.status !== 'cancelled';
}

function getVisualStyle(stopData) {
    if (viewMode === 'routing' && stopData.hasOwnProperty('cluster')) {
        return INSPECTOR_PALETTE[stopData.cluster % INSPECTOR_PALETTE.length];
    } else {
        if (!stopData.driverId) return { bg: 'var(--red)', text: '#ffffff' };
        const index = inspectors.findIndex(i => i.id === stopData.driverId);
        if (index === -1) return { bg: 'var(--red)', text: '#ffffff' };
        return INSPECTOR_PALETTE[index % INSPECTOR_PALETTE.length];
    }
}

const resizerEl = document.getElementById('resizer');
const sidebarEl = document.getElementById('sidebar');
const mapWrapEl = document.getElementById('map-wrapper');
let isResizing = false;

resizerEl.addEventListener('mousedown', (e) => {
    if(viewMode !== 'manager' && viewMode !== 'routing') return;
    isResizing = true;
    resizerEl.classList.add('active');
    document.body.style.cursor = 'col-resize';
    mapWrapEl.style.pointerEvents = 'none'; 
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    let newWidth = window.innerWidth - e.clientX;
    if (newWidth < 300) newWidth = 300;
    if (newWidth > window.innerWidth - 300) newWidth = window.innerWidth - 300;
    sidebarEl.style.width = newWidth + 'px';
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        resizerEl.classList.remove('active');
        mapWrapEl.style.pointerEvents = 'auto';
        if(map) map.resize(); 
    }
});

async function loadData() {
    let queryParams = '';
    if (companyParam) queryParams = `?company=${companyParam}`;
    else if (driverParam) queryParams = `?driver=${driverParam}`;
    else if (routeId) queryParams = `?id=${routeId}`;
    else {
        const overlay = document.getElementById('processing-overlay');
        if (overlay) overlay.style.display = 'none';
        return;
    }

    try {
        const res = await fetch(`${WEB_APP_URL}${queryParams}`);
        const data = await res.json();
        let rawStops = Array.isArray(data) ? data : (data.stops || []);
        
        if (!Array.isArray(data)) {
            inspectors = data.inspectors || []; 
            if (data.serviceDelay !== undefined) COMPANY_SERVICE_DELAY = parseInt(data.serviceDelay); 
            if (data.permissions) {
                if (typeof data.permissions.modify !== 'undefined') PERMISSION_MODIFY = data.permissions.modify;
                if (typeof data.permissions.reoptimize !== 'undefined') PERMISSION_REOPTIMIZE = data.permissions.reoptimize;
            }
            
            const mapLogo = document.getElementById('brand-logo-map');
            const sidebarLogo = document.getElementById('brand-logo-sidebar');

            if (data.tier && data.companyLogo && (data.tier.toLowerCase() === 'company')) {
                if (mapLogo) mapLogo.src = data.companyLogo;
                if (sidebarLogo) sidebarLogo.src = data.companyLogo;
            } else {
                const sprouteLogoUrl = 'https://raw.githubusercontent.com/mypieinteractive/prospect-dashboard/809b30bc160d3e353020425ce349c77544ed0452/Sproute%20Logo.png';
                if (mapLogo) mapLogo.src = sprouteLogoUrl;
                if (sidebarLogo) sidebarLogo.src = sprouteLogoUrl;
            }
            
            let displayName = data.displayName || 'Sproute'; 
            const mapDriverEl = document.getElementById('map-driver-name');
            if (mapDriverEl) mapDriverEl.innerText = displayName;
            const sidebarDriverEl = document.getElementById('sidebar-driver-name');
            if (sidebarDriverEl) sidebarDriverEl.innerText = displayName;
        }
        
        const optBtn = document.getElementById('btn-reoptimize');
        if (optBtn) optBtn.style.display = PERMISSION_REOPTIMIZE ? 'flex' : 'none';
        
        stops = rawStops.map(s => ({
            ...s,
            id: s.rowId || s.id,
            cluster: 0, // Baseline K-Means assignment
            manualCluster: false // Locks nodes pushed by the user
        }));

        originalStops = JSON.parse(JSON.stringify(stops)); 
        if (stops.length > 0 && stops[0].eta) currentStartTime = stops[0].eta;
        
        if(viewMode === 'map' || viewMode === 'list' || viewMode === 'manager') {
            document.querySelector('.rocker').style.display = 'none';
        }

        render(); drawRoute(); updateSummary(); initSortable();
        
        if(viewMode === 'routing') {
            document.getElementById('routing-controls').style.display = 'flex';
            liveClusterUpdate();
        }

    } catch (e) { 
        console.error("Error loading data:", e); 
    } finally {
        const overlay = document.getElementById('processing-overlay');
        if (overlay) overlay.style.display = 'none';
    }
}

// --- ROUTING UI BINDINGS ---
function setRoutes(num) {
    currentRouteCount = num;
    for(let i=1; i<=3; i++) {
        const btn = document.getElementById(`rbtn-${i}`);
        if(btn) btn.classList.toggle('active', i === num);
    }
    // Wipe manual locks if we change the route divider entirely
    stops.forEach(s => s.manualCluster = false); 
    
    liveClusterUpdate();
    updateSelectionUI(); // hide unused manual move buttons
}

function moveSelectedToRoute(cIdx) {
    selectedIds.forEach(id => {
        const s = stops.find(st => st.id === id);
        if (s) {
            s.cluster = cIdx;
            s.manualCluster = true; // Lock it to avoid K-Means overriding it
        }
    });
    selectedIds.clear();
    updateSelectionUI();
    updateMarkerColors();
    updateRouteTimes();
}

function updateRouteTimes() {
    if(viewMode !== 'routing') return;
    const activeStops = stops.filter(s => isActiveStop(s) && s.lng && s.lat);
    for(let i=0; i<3; i++) {
        const count = activeStops.filter(s => s.cluster === i).length;
        const hrs = Math.ceil(count * 0.4);
        const timeEl = document.getElementById(`rtime-${i+1}`);
        if(timeEl) {
            timeEl.innerText = count > 0 ? `${hrs} hrs` : '-- hrs';
        }
    }
}

// --- FRONTEND SPATIO-TEMPORAL K-MEANS CLUSTERING ---
function liveClusterUpdate() {
    if(viewMode !== 'routing') return;
    
    const k = currentRouteCount;
    const w = parseInt(document.getElementById('slider-priority').value) / 100; // 0.0 to 1.0
    
    const activeStops = stops.filter(s => isActiveStop(s) && s.lng && s.lat);
    if(activeStops.length === 0) return;

    // Reset if K = 1
    if(k === 1) {
        activeStops.forEach(s => { s.cluster = 0; s.manualCluster = false; });
        updateMarkerColors();
        updateRouteTimes();
        return;
    }

    let centroids = [];
    for(let i=0; i<k; i++) {
        let idx = Math.floor(i * activeStops.length / k);
        centroids.push({ lat: activeStops[idx].lat, lng: activeStops[idx].lng });
    }

    let today = new Date(); 
    today.setHours(0,0,0,0);

    for(let iter=0; iter<10; iter++) {
        activeStops.forEach(s => {
            if (s.manualCluster) return; // Skip overrides

            let bestD = Infinity;
            let bestC = 0;
            let dueTime = s.dueDate ? new Date(s.dueDate).getTime() : Infinity;
            let daysUntilDue = Math.floor((dueTime - today.getTime()) / (1000*3600*24));

            centroids.forEach((c, cIdx) => {
                let dLat = s.lat - c.lat;
                let dLng = s.lng - c.lng;
                let geoDist = Math.sqrt(dLat*dLat + dLng*dLng);

                let timePenalty = 0;
                if(w > 0 && s.dueDate) {
                    if(daysUntilDue < cIdx) {
                        timePenalty = (cIdx - Math.max(0, daysUntilDue)) * 0.2; 
                    }
                }

                let totalDist = geoDist + (timePenalty * w);
                if(totalDist < bestD) { bestD = totalDist; bestC = cIdx; }
            });
            s.cluster = bestC;
        });

        for(let i=0; i<k; i++) {
            let clusterStops = activeStops.filter(s => s.cluster === i);
            if(clusterStops.length > 0) {
                let sumLat = 0, sumLng = 0;
                clusterStops.forEach(s => { sumLat+=s.lat; sumLng+=s.lng; });
                centroids[i].lat = sumLat / clusterStops.length;
                centroids[i].lng = sumLng / clusterStops.length;
            }
        }
    }
    
    updateMarkerColors();
    updateRouteTimes();
}

function updateMarkerColors() {
    markers.forEach(m => {
        const stopData = stops.find(st => st.id === m._stopId);
        if (stopData) {
            const visualStyle = getVisualStyle(stopData);
            const pin = m.getElement().querySelector('.pin-visual');
            if(pin) {
                pin.style.backgroundColor = visualStyle.bg;
                pin.style.color = visualStyle.text;
            }
        }
    });
}

async function processDeleteOrder(rowId) {
    try {
        if (viewMode === 'routing') {
            // Unroute visually immediately
            const idx = stops.findIndex(s => s.id === rowId);
            if (idx > -1) stops[idx].status = '';
            render(); drawRoute(); updateSummary(); updateRouteTimes();
            
            await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'unrouteOrder', rowId: rowId }) });
        } else {
            // Delete locally immediately
            stops = stops.filter(s => s.id !== rowId);
            render(); drawRoute(); updateSummary();
            
            await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteOrder', rowId: rowId }) });
        }
    } catch(e) { alert("Network error: Failed to modify order."); }
}

async function processReassignDriver(rowId, newDriverName, newDriverId) {
    const stopIdx = stops.findIndex(s => s.id === rowId);
    if (stopIdx > -1) { stops[stopIdx].driverName = newDriverName; stops[stopIdx].driverId = newDriverId; }
    const payload = { action: 'updateOrder', rowId: rowId, updates: { "HKAwZ": newDriverName, "xuPjx": newDriverId } };
    return fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
}

async function handleInspectorChange(e, rowId, selectEl) {
    e.stopPropagation(); 
    const newDriverId = selectEl.value;
    const newDriverName = selectEl.options[selectEl.selectedIndex].text;
    
    let idsToUpdate = [rowId];
    if (selectedIds.has(rowId) && selectedIds.size > 1) {
        if (confirm(`Reassign all ${selectedIds.size} selected orders to ${newDriverName}?`)) idsToUpdate = Array.from(selectedIds);
        else { render(); return; }
    }
    
    const overlay = document.getElementById('processing-overlay');
    if(overlay) overlay.style.display = 'flex';
    
    try { for (const id of idsToUpdate) await processReassignDriver(id, newDriverName, newDriverId); } 
    catch (err) { alert("Network error: Failed to update some orders."); }
    
    render(); 
    if(overlay) overlay.style.display = 'none';
}

function sortTable(col) {
    if (currentSort.col === col) currentSort.asc = !currentSort.asc;
    else { currentSort.col = col; currentSort.asc = true; }

    stops.sort((a, b) => {
        let valA = a[col] || ''; let valB = b[col] || '';
        if (col === 'dueDate') {
            valA = valA ? new Date(valA).getTime() : Number.MAX_SAFE_INTEGER;
            valB = valB ? new Date(valB).getTime() : Number.MAX_SAFE_INTEGER;
        } else {
            valA = String(valA).toLowerCase(); valB = String(valB).toLowerCase();
        }
        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
    });
    render(); 
}

function getSortIcon(col) {
    if (currentSort.col !== col) return '<i class="fa-solid fa-sort" style="opacity:0.3; margin-left:4px;"></i>';
    return currentSort.asc ? '<i class="fa-solid fa-sort-up" style="margin-left:4px; color:var(--blue);"></i>' : '<i class="fa-solid fa-sort-down" style="margin-left:4px; color:var(--blue);"></i>';
}

function setDisplayMode(mode) {
    currentDisplayMode = mode;
    document.getElementById('btn-detailed').classList.toggle('active', mode === 'detailed');
    document.getElementById('btn-compact').classList.toggle('active', mode === 'compact');
    render();
}

function render(isDraft = false) {
    const list = document.getElementById('stop-list');
    list.innerHTML = ''; 
    markers.forEach(m => m.remove()); 
    markers = [];
    const bounds = new mapboxgl.LngLatBounds();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (viewMode === 'list' || viewMode === 'manager') {
        const header = document.createElement('div');
        header.className = 'glide-table-header';
        header.innerHTML = `
            <div class="col-num"></div>
            <div class="col-due sortable" onclick="sortTable('dueDate')">Due ${getSortIcon('dueDate')}</div>
            <div class="col-insp sortable" onclick="sortTable('driverName')">Inspector ${getSortIcon('driverName')}</div>
            <div class="col-addr sortable" onclick="sortTable('address')">Address ${getSortIcon('address')}</div>
            <div class="col-app">App</div>
            <div class="col-client sortable" onclick="sortTable('client')">Client ${getSortIcon('client')}</div>
            <div class="col-type sortable" onclick="sortTable('type')">Order type ${getSortIcon('type')}</div>
        `;
        list.appendChild(header);
    }

    stops.filter(s => isActiveStop(s)).forEach((s, i) => {
        const item = document.createElement('div');
        item.id = `item-${s.id}`;
        item.setAttribute('data-search', `${(s.address||'').toLowerCase()} ${(s.client||'').toLowerCase()}`);
        
        const due = s.dueDate ? new Date(s.dueDate) : null;
        let urgencyClass = '';
        
        if (due) {
            const dueTime = new Date(due);
            dueTime.setHours(0, 0, 0, 0); 
            if (dueTime < today) urgencyClass = 'past-due'; 
            else if (dueTime.getTime() === today.getTime()) urgencyClass = 'due-today'; 
        }
        
        const dueFmt = due ? `${due.getMonth()+1}/${due.getDate()}` : "N/A";

        if (viewMode === 'list' || viewMode === 'manager') {
            item.className = `glide-row ${s.status}`;
            let inspectorHtml = `<div class="col-insp">${s.driverName || driverParam || 'Unassigned'}</div>`;
            
            if (viewMode === 'manager' && inspectors.length > 0) {
                const optionsHtml = inspectors.map(insp => `<option value="${insp.id}" ${s.driverId === insp.id ? 'selected' : ''}>${insp.name}</option>`).join('');
                const defaultPlaceholder = !s.driverId ? `<option value="" disabled selected hidden>Select Inspector...</option>` : '';
                const disableSelectAttr = !PERMISSION_MODIFY ? 'disabled' : '';

                inspectorHtml = `
                    <div class="col-insp" onclick="event.stopPropagation()">
                        <select class="insp-select" onchange="handleInspectorChange(event, '${s.id}', this)" ${disableSelectAttr}>
                            ${defaultPlaceholder}
                            ${optionsHtml}
                        </select>
                    </div>
                `;
            }

            const style = getVisualStyle(s);

            item.innerHTML = `
                <div class="col-num"><div class="num-badge" style="background-color: ${style.bg}; color: ${style.text};">${i + 1}</div></div>
                <div class="col-due ${urgencyClass}">${dueFmt}</div>
                ${inspectorHtml}
                <div class="col-addr">${(s.address||'').split(',')[0]}</div>
                <div class="col-app">IA</div>
                <div class="col-client">${s.client || '--'}</div>
                <div class="col-type">${s.type || '--'}</div>
            `;
        } else {
            item.className = `stop-item ${s.status} ${currentDisplayMode}`;
            const metaDisplay = isDraft ? '-- | --' : `${s.eta || '--'} | ${s.dist || '--'}`;
            const handleHtml = PERMISSION_MODIFY ? `<div class="handle">☰</div>` : ``;
            
            item.innerHTML = `
                <div class="stop-sidebar ${urgencyClass}">${i + 1}</div>
                ${handleHtml}
                <div class="csv-box">${(s.client||"??").substring(0,2).toUpperCase()}</div>
                <div class="stop-content">
                    <b>${(s.address||'').split(',')[0]}</b>
                    <div class="row-meta">${metaDisplay}</div>
                    <div class="row-details">${s.type || ''}</div>
                </div>
                <div class="due-date-container ${urgencyClass}">${dueFmt}</div>
                <div class="stop-actions">
                    <i class="fa-solid fa-circle-check icon-btn" style="color:var(--green)" onclick="toggleComplete(event, '${s.id}')"></i>
                    <i class="fa-solid fa-location-arrow icon-btn" style="color:var(--blue)" onclick="openNav(event, '${s.lat}','${s.lng}')"></i>
                </div>
            `;
        }
        
        item.onclick = (e) => {
            if (!e.shiftKey) selectedIds.clear();
            selectedIds.has(s.id) ? selectedIds.delete(s.id) : selectedIds.add(s.id);
            updateSelectionUI(); focusPin(s.id);
        };
        list.appendChild(item);

        if(s.lng && s.lat) {
            const el = document.createElement('div');
            el.className = `marker ${s.status}`; 
            
            const style = getVisualStyle(s);
            el.innerHTML = `<div class="pin-visual" style="background-color: ${style.bg}; color: ${style.text};"><span>${i + 1}</span></div>`;

            if (urgencyClass) {
                const w = document.createElement('div'); w.className = 'marker-warning'; 
                w.innerText = (urgencyClass === 'past-due') ? '⚠️' : '❕';
                el.appendChild(w);
            }
            
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!e.shiftKey) selectedIds.clear();
                selectedIds.has(s.id) ? selectedIds.delete(s.id) : selectedIds.add(s.id);
                updateSelectionUI(); focusTile(s.id);
            });
            
            const m = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([s.lng, s.lat]).addTo(map);
            m._stopId = s.id; markers.push(m); bounds.extend([s.lng, s.lat]);
        }
    });
    if (stops.filter(s=> isActiveStop(s) && s.lng && s.lat).length > 0) { initialBounds = bounds; map.fitBounds(bounds, { padding: 50, maxZoom: 15 }); }
    
    updateSelectionUI();
}

function updateSummary() {
    const active = stops.filter(s => isActiveStop(s) && s.status !== 'completed');
    let totalMi = 0;
    active.forEach(s => totalMi += parseFloat(s.dist || 0));
    document.getElementById('sum-dist').innerText = `${totalMi.toFixed(1)} mi`;
    document.getElementById('sum-time').innerText = `${Math.ceil(active.length * 0.4)} hrs`;
    
    const totalOrders = active.length;
    let dueToday = 0;
    let pastDue = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    active.forEach(s => {
        if(s.dueDate) {
            const dueTime = new Date(s.dueDate);
            dueTime.setHours(0, 0, 0, 0);
            if(dueTime < today) pastDue++;
            else if(dueTime.getTime() === today.getTime()) dueToday++;
        }
    });

    const statTotalEl = document.getElementById('stat-total');
    const statDueEl = document.getElementById('stat-due');
    const statPastEl = document.getElementById('stat-past');

    if(statTotalEl) statTotalEl.innerText = `${totalOrders} Orders`;
    if(statDueEl) statDueEl.innerText = `${dueToday} Due Today`;
    if(statPastEl) statPastEl.innerText = `${pastDue} Past Due`;
}

function formatTime(dateObj) {
    let h = dateObj.getHours();
    let m = dateObj.getMinutes();
    let ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; h = h ? h : 12;
    m = m < 10 ? '0'+m : m;
    return h + ':' + m + ' ' + ampm;
}

async function handleCalculate() {
    const overlay = document.getElementById('processing-overlay');
    if (overlay) overlay.style.display = 'flex';

    try {
        const activeStops = stops.filter(s => isActiveStop(s) && s.lng && s.lat);
        if (activeStops.length < 2) { alert("Not enough valid stops."); return; }

        const MAX_WAYPOINTS = 25; 
        let legs = []; 

        for (let i = 0; i < activeStops.length - 1; i += (MAX_WAYPOINTS - 1)) {
            const chunk = activeStops.slice(i, i + MAX_WAYPOINTS);
            const coords = chunk.map(s => `${s.lng},${s.lat}`).join(';');
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) throw new Error("Routing failed: " + data.message);
            legs.push(...data.routes[0].legs);
        }

        let time = new Date();
        let match = currentStartTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (match) {
            let hours = parseInt(match[1]), mins = parseInt(match[2]);
            if (match[3] && match[3].toUpperCase() === 'PM' && hours < 12) hours += 12;
            if (match[3] && match[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
            time.setHours(hours, mins, 0, 0);
        } else { time.setHours(8, 0, 0, 0); }

        let totalMeters = 0;
        activeStops.forEach((stop, index) => {
            if (index === 0) {
                stop.eta = formatTime(time); stop.dist = "0.0 mi"; stop.durationSecs = 0;
            } else {
                let leg = legs[index - 1];
                time = new Date(time.getTime() + (COMPANY_SERVICE_DELAY * 60 * 1000) + (leg.duration * 1000));
                stop.eta = formatTime(time);
                totalMeters += leg.distance;
                stop.dist = (totalMeters * 0.000621371).toFixed(1) + " mi";
                stop.durationSecs = leg.duration;
            }
        });

        if (routeId) {
            const saveRes = await fetch(WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'saveRoute', routeId: routeId, driver: driverParam, stops: stops })
            });
        }

        document.getElementById('controls').style.display = 'none';
        originalStops = JSON.parse(JSON.stringify(stops)); 
        render(); drawRoute(); updateSummary();

    } catch (e) { alert("Calculation failed: " + e.message); } 
    finally { if (overlay) overlay.style.display = 'none'; }
}

function handleOptimize() { showSyncOptions('optimize'); }

function handleUndo() {
    if(confirm("Discard all changes and revert to original route?")) {
        stops = JSON.parse(JSON.stringify(originalStops));
        document.getElementById('controls').style.display = 'none';
        render(); drawRoute(); updateSummary();
    }
}

function toggleComplete(e, id) {
    e.stopPropagation();
    const idx = stops.findIndex(s => s.id == id);
    stops[idx].status = (stops[idx].status === 'completed') ? '' : 'completed';
    render(); drawRoute(); updateSummary();
}

let start_pos, box_el;
map.on('click', (e) => { if (e.originalEvent.target.classList.contains('mapboxgl-canvas')) { selectedIds.clear(); updateSelectionUI(); } });
const canvas = map.getCanvasContainer();

canvas.addEventListener('mousedown', (e) => { 
    if (e.target.closest('.mapboxgl-marker')) return; 
    if(e.shiftKey) { 
        map.dragPan.disable(); start_pos = mousePos(e); 
        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); 
    } 
}, true);

function mousePos(e) { const r = canvas.getBoundingClientRect(); return new mapboxgl.Point(e.clientX-r.left, e.clientY-r.top); }

function onMouseMove(e) { 
    const curr = mousePos(e); 
    if(!box_el) { box_el=document.createElement('div'); box_el.className='boxdraw'; canvas.appendChild(box_el); } 
    const minX=Math.min(start_pos.x,curr.x), maxX=Math.max(start_pos.x,curr.x), minY=Math.min(start_pos.y,curr.y), maxY=Math.max(start_pos.y,curr.y); 
    box_el.style.left=minX+'px'; box_el.style.top=minY+'px'; box_el.style.width=(maxX-minX)+'px'; box_el.style.height=(maxY-minY)+'px'; 
}

function onMouseUp(e) { 
    document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); 
    if(box_el) { 
        const b=[start_pos, mousePos(e)]; 
        markers.filter(m => { 
            const pt=map.project(m.getLngLat()); 
            return pt.x>=Math.min(b[0].x,b[1].x) && pt.x<=Math.max(b[0].x,b[1].x) && pt.y>=Math.min(b[0].y,b[1].y) && pt.y<=Math.max(b[0].y,b[1].y); 
        }).forEach(m=>selectedIds.add(m._stopId)); 
        box_el.remove(); box_el=null; updateSelectionUI(); 
    } 
    map.dragPan.enable(); start_pos=null; 
}

function updateSelectionUI() { 
    document.querySelectorAll('.stop-item, .glide-row').forEach(el=>el.classList.remove('selected')); 
    markers.forEach(m=>{ 
        m.getElement().classList.toggle('bulk-selected', selectedIds.has(m._stopId)); 
        if(selectedIds.has(m._stopId)) { const row = document.getElementById(`item-${m._stopId}`); if (row) row.classList.add('selected'); } 
    }); 
    
    const has = selectedIds.size>0; 
    document.getElementById('bulk-remove-btn').style.display = (has && PERMISSION_MODIFY) ? 'block' : 'none'; 
    document.getElementById('bulk-complete-btn').style.display = (has && viewMode !== 'routing') ? 'block' : 'none'; 
    
    // Manage dynamic Move buttons for Routing view
    for(let i=1; i<=3; i++) {
        const btn = document.getElementById(`move-r${i}-btn`);
        if(btn) {
            if(viewMode === 'routing' && has && i <= currentRouteCount) {
                btn.style.display = 'block';
            } else {
                btn.style.display = 'none';
            }
        }
    }
}

function focusPin(id) { const tgt = stops.find(s=>s.id==id); if(tgt && tgt.lng && tgt.lat) map.flyTo({ center: [tgt.lng, tgt.lat] }); }
function focusTile(id) { document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
function resetMapView() { if (initialBounds) map.fitBounds(initialBounds, { padding: 50, maxZoom: 15 }); }
function filterList() { const q = document.getElementById('search-input').value.toLowerCase(); document.querySelectorAll('.stop-item, .glide-row').forEach(el => el.style.display = el.getAttribute('data-search').includes(q) ? 'flex' : 'none'); }

function drawRoute() { 
    if (viewMode === 'manager' || viewMode === 'routing') {
        if (map.getSource('route')) map.getSource('route').setData({ "type": "Feature", "geometry": { "type": "LineString", "coordinates": [] } });
        return;
    }
    const act = stops.filter(s => isActiveStop(s) && s.lng && s.lat); 
    if (act.length < 2) return; 
    const crd = act.map(s => [s.lng, s.lat]); 
    
    if (map.getSource('route')) {
        map.getSource('route').setData({ "type": "Feature", "geometry": { "type": "LineString", "coordinates": crd } }); 
    } else { 
        map.addSource('route', { "type": "geojson", "data": { "type": "Feature", "geometry": { "type": "LineString", "coordinates": crd } } }); 
        map.addLayer({ "id": "route", "type": "line", "source": "route", "layout": { "line-join": "round", "line-cap": "round" }, "paint": { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.5 } }); 
    } 
}

function openNav(e, la, ln) { e.stopPropagation(); let p = localStorage.getItem('navPref'); if (!p) { showNavChoice(la, ln); } else { launchMaps(p, la, ln); } }
function showNavChoice(la, ln) { const m = document.getElementById('modal-overlay'); m.style.display = 'flex'; document.getElementById('modal-content').innerHTML = `<h3>Maps Preference:</h3><div style="display:flex; flex-direction:column; gap:8px;"><button style="padding:12px; border:none; border-radius:6px; background:var(--blue); color:white; font-weight:bold;" onclick="setNavPref('google','${la}','${ln}')">Google Maps</button><button style="padding:12px; border:none; border-radius:6px; background:#444; color:#fff" onclick="setNavPref('apple','${la}','${ln}')">Apple Maps</button></div>`; }
function setNavPref(p, la, ln) { localStorage.setItem('navPref', p); document.getElementById('modal-overlay').style.display = 'none'; launchMaps(p, la, ln); }
function launchMaps(p, la, ln) { window.location.href = p === 'google' ? `comgooglemaps://?daddr=${la},${ln}` : `maps://maps.apple.com/?daddr=${la},${ln}`; }

async function triggerBulkDelete() { 
    if(confirm("Remove selected?")) { 
        const overlay = document.getElementById('processing-overlay');
        if(overlay) overlay.style.display = 'flex';

        const deletePromises = Array.from(selectedIds).map(id => processDeleteOrder(id));
        await Promise.all(deletePromises);
        
        selectedIds.clear(); updateSelectionUI(); document.getElementById('controls').style.display = 'flex'; 

        setTimeout(() => { if(overlay) overlay.style.display = 'none'; }, 3000);
    } 
}

function triggerBulkComplete() { 
    if(confirm("Mark completed?")) { 
        selectedIds.forEach(id => { stops.find(s => s.id == id).status = 'completed'; }); 
        selectedIds.clear(); render(); drawRoute(); updateSelectionUI(); 
        document.getElementById('controls').style.display = 'flex'; 
    } 
}

function showSyncOptions(type) {
    const modal = document.getElementById('modal-overlay'); modal.style.display = 'flex';
    const defS = stops.length ? stops[0].address : "", defE = stops.length ? stops[stops.length-1].address : "";
    document.getElementById('modal-content').innerHTML = `
        <h3 style="margin:0">Update Locations</h3>
        <p style="font-size:12px; color:var(--text-muted);">Start Time: ${currentStartTime}</p>
        <input type="text" id="start-addr" value="${defS}" placeholder="Start Address" style="width:100%; padding:8px; margin:5px 0; border-radius:4px;">
        <input type="text" id="end-addr" value="${defE}" placeholder="End Address" style="width:100%; padding:8px; margin:5px 0; border-radius:4px;">
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button style="flex:1; padding:10px; border:none; border-radius:6px; background:#444; color:#fff;" onclick="document.getElementById('modal-overlay').style.display='none'">Cancel</button>
            <button style="flex:1; padding:10px; border:none; border-radius:6px; background:var(--blue); color:white; font-weight:bold;" onclick="finalizeSync('${type}')">Submit</button>
        </div>`;
}

async function finalizeSync(type) {
    const startAddr = document.getElementById('start-addr').value, endAddr = document.getElementById('end-addr').value;
    document.getElementById('modal-overlay').style.display = 'none';
    
    // Prepare Payload 
    let payload = { 
        action: type, driver: driverParam, 
        startTime: currentStartTime, startAddr: startAddr, endAddr: endAddr 
    };

    if (viewMode === 'routing') {
        let clusteredArrays = [];
        for(let i = 0; i < currentRouteCount; i++) {
            let itemsInCluster = stops.filter(s => s.cluster === i);
            if (itemsInCluster.length > 0) clusteredArrays.push(itemsInCluster);
        }
        payload.routeClusters = clusteredArrays;
        payload.priorityLevel = document.getElementById('slider-priority').value;
    } else {
        payload.stops = stops;
    }

    try {
        const res = await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json(); 
        stops = data.updatedStops;
        
        document.getElementById('controls').style.display = 'none'; 
        render(); drawRoute(); updateSummary();
    } catch (e) { alert("Sync Failed."); }
}

function initSortable() {
    if (PERMISSION_MODIFY && viewMode !== 'list' && viewMode !== 'manager' && viewMode !== 'routing') {
        if (!sortableInstance) {
            sortableInstance = Sortable.create(document.getElementById('stop-list'), {
                handle: '.handle', animation: 150,
                onEnd: (evt) => {
                    const moved = stops.splice(evt.oldIndex, 1)[0];
                    stops.splice(evt.newIndex, 0, moved);
                    document.getElementById('controls').style.display = 'flex';
                    render(true); 
                }
            });
        }
    }
}

loadData();
