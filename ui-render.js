import { AppState, Config, getActiveEndpoints, triggerFullRender } from './app.js';
import { isActiveStop, isStopVisible, getVisualStyle, MASTER_PALETTE, isRouteAssigned, isTrueInspector } from './logic.js';
import { drawRouteMap, resizeMap, getMapInstance, renderMapMarkers, filterMarkersMap } from './map.js';
import { showAddOrderModal } from './ui-modals.js';
import { updateHeaderUI, updateRoutingUI, updateSelectionUI, handleEndpointInput } from './ui.js';

export function getSortIcon(col) {
    if (AppState.currentSort.col !== col) return '<i class="fa-solid fa-sort" style="opacity:0.3; margin-left:4px;"></i>';
    return AppState.currentSort.asc ? '<i class="fa-solid fa-sort-up" style="margin-left:4px; color:var(--accent);"></i>' : '<i class="fa-solid fa-sort-down" style="margin-left:4px; color:var(--accent);"></i>';
}

export function drawRoute() {
    drawRouteMap({
        routedStops: Config.isManagerView ? AppState.stops.filter(s => isStopVisible(s, true, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteViewFilter) && isRouteAssigned(s.status)) : AppState.stops.filter(s => isStopVisible(s, true, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteViewFilter)),
        dirtyRoutes: AppState.dirtyRoutes,
        activeEndpoints: getActiveEndpoints(),
        isManagerView: Config.isManagerView,
        currentInspectorFilter: AppState.currentInspectorFilter,
        inspectors: AppState.inspectors,
        allStops: AppState.stops,
        currentRouteCount: AppState.currentRouteCount
    });
}

export function buildEndpointsToDraw(activeStops) {
    let endpointsToDraw = [];
    const pushEndpoint = (lng, lat, dId, type) => {
        if (lng && lat) {
            let existing = endpointsToDraw.find(e => e.lng === lng && e.lat === lat && String(e.driverId) === String(dId));
            if (existing) {
                if (type === 'start') existing.isStart = true;
                if (type === 'end') existing.isEnd = true;
            } else endpointsToDraw.push({ lng, lat, driverId: dId, isStart: type === 'start', isEnd: type === 'end' });
        }
    };

    if (Config.isManagerView && AppState.currentInspectorFilter === 'all') {
        const activeDriverIds = new Set(activeStops.map(s => String(s.driverId)));
        AppState.inspectors.forEach(insp => {
            if (activeDriverIds.has(String(insp.id))) {
                pushEndpoint(parseFloat(insp.startLng), parseFloat(insp.startLat), insp.id, 'start');
                pushEndpoint(parseFloat(insp.endLng || insp.startLng), parseFloat(insp.endLat || insp.startLat), insp.id, 'end');
            }
        });
    } else {
        let eps = getActiveEndpoints();
        let cInsp = AppState.inspectors.find(i => String(i.id) === String(Config.isManagerView ? AppState.currentInspectorFilter : Config.driverParam));
        if (eps.start && eps.start.lng && eps.start.lat) pushEndpoint(parseFloat(eps.start.lng), parseFloat(eps.start.lat), cInsp?.id, 'start');
        if (eps.end && eps.end.lng && eps.end.lat) pushEndpoint(parseFloat(eps.end.lng), parseFloat(eps.end.lat), cInsp?.id, 'end');
    }
    return endpointsToDraw;
}

export function createRouteSubheading(clusterNum, clusterStops) {
    let totalMi = 0, dueToday = 0, pastDue = 0, totalSecs = 0;
    const today = new Date(); today.setHours(0,0,0,0);

    clusterStops.forEach(s => {
        if (!isNaN(parseFloat(s.dist || 0))) totalMi += parseFloat(s.dist);
        totalSecs += parseFloat(s.durationSecs || 0);
        if(s.dueDate) {
            const dueTime = new Date(s.dueDate); dueTime.setHours(0, 0, 0, 0);
            if(dueTime < today) pastDue++;
            else if(dueTime.getTime() === today.getTime()) dueToday++;
        }
    });

    let hrs = clusterStops.length > 0 ? ((totalSecs + (clusterStops.length * AppState.COMPANY_SERVICE_DELAY * 60)) / 3600).toFixed(1) : 0;
    let dueText = pastDue > 0 ? `<span style="color:var(--red)">${pastDue} Past Due</span>` : (dueToday > 0 ? `<span style="color:var(--orange)">${dueToday} Due Today</span>` : `0 Due`);

    const el = document.createElement('div');
    el.className = 'list-subheading';
    el.innerHTML = `<span>ROUTE ${clusterNum + 1}</span><span class="route-summary-text">${totalMi.toFixed(1)} mi | ${hrs} hrs | ${clusterStops.length} stops | ${dueText}</span>`;
    return el;
}

export function createEndpointRow(type, endpointData) {
    const displayAddr = endpointData && endpointData.address ? endpointData.address : '';
    const placeholder = type === 'start' ? 'Search Start Address...' : 'Search End Address...';
    const disabledAttr = (Config.viewMode === 'inspector' && !AppState.PERMISSION_MODIFY) ? 'disabled' : '';

    const el = document.createElement('div');

    if (!Config.isManagerView) {
        const icon = type === 'start' ? '<i class="fa-solid fa-house"></i>' : '<i class="fa-solid fa-flag-checkered"></i>';
        el.className = 'stop-item static-endpoint';
        el.innerHTML = `
            <div class="stop-sidebar" style="background-color: transparent; color: var(--row-text-muted); font-size: 16px;">
                ${icon}
            </div>
            <div class="csv-box" style="border: none; margin: 0; width: 0; padding: 0;"></div>
            <div class="stop-content" style="padding-left: 12px; overflow: visible;">
                <div style="position:relative; display:flex; align-items:center; height:30px; width: 100%;">
                    <input type="text" id="input-endpoint-${type}" class="endpoint-input" data-nodrag="true" value="${displayAddr}" placeholder="${placeholder}" ${disabledAttr} onfocus="this.select()" oninput="handleEndpointInput(event, '${type}')" onkeydown="handleEndpointKeyDown(event, '${type}')" onblur="handleEndpointBlur('${type}', this)" style="padding-left: 0; background: transparent !important; font-size: 15px; font-weight: 400; color: var(--row-text-main) !important;">
                    <i class="fa-solid fa-pencil" style="position: absolute; right: 8px; color: var(--row-text-muted); font-size: 12px; pointer-events: none;"></i>
                </div>
            </div>
            <div class="due-date-container"></div>
            <div class="stop-actions" style="width: 58px;"></div>
        `;
        return el;
    }

    const icon = type === 'start' ? '<i class="fa-solid fa-location-dot"></i>' : '<i class="fa-solid fa-flag-checkered"></i>';
    const labelText = type === 'start' ? 'START' : 'END';
    const isAllInspectors = Config.isManagerView && AppState.currentInspectorFilter === 'all';

    el.className = 'stop-item static-endpoint';
    el.innerHTML = `
        <div class="col-num" style="display:flex; justify-content:center; align-items:center; color:var(--row-text-muted); font-size:16px;">
            ${icon}
        </div>
        <div class="col-eta" style="color:var(--row-text-muted); font-weight:400; display:${isAllInspectors ? 'none' : 'flex'}; justify-content:center; align-items:center; text-align:center;">
            ${labelText}
        </div>
        <div class="col-due"></div>
        <div class="col-addr" style="display:flex; align-items:center; flex-direction:row; padding-left:8px; padding-right:6px; flex:1 1 auto; min-width:0;">
            <div style="position:relative; flex: 1; display:flex; align-items:center; height:30px;">
                <input type="text" id="input-endpoint-${type}" class="endpoint-input" data-nodrag="true" value="${displayAddr}" placeholder="${placeholder}" ${disabledAttr} onfocus="this.select()" oninput="handleEndpointInput(event, '${type}')" onkeydown="handleEndpointKeyDown(event, '${type}')" onblur="handleEndpointBlur('${type}', this)">
                <i class="fa-solid fa-pencil" style="position: absolute; right: 8px; color: var(--row-text-muted); font-size: 12px; pointer-events: none;"></i>
            </div>
            <div style="margin-left:auto; padding:4px; flex-shrink:0; display:flex; align-items:center; visibility: hidden; width: 20px;"></div>
        </div>
        <div class="col-app"></div>
        <div class="col-client"></div>
        <div class="col-insp" style="display:${Config.isManagerView && AppState.currentInspectorFilter !== 'all' ? 'none' : 'flex'};"></div>
    `;
    return el;
}

export function render() {
    updateHeaderUI();
    document.body.classList.remove('display-compact', 'display-detailed');
    document.body.classList.add(`display-${AppState.currentDisplayMode || 'detailed'}`);

    const listContainer = document.getElementById('stop-list');
    const previousScrollTop = listContainer.scrollTop || 0;
    listContainer.innerHTML = '';

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isSingleInspector = Config.isManagerView && AppState.currentInspectorFilter !== 'all';
    const isAllInspectors = Config.isManagerView && AppState.currentInspectorFilter === 'all';
    const activeStops = AppState.stops.filter(s => isStopVisible(s, true, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteViewFilter));

    document.body.classList.toggle('empty-state-active', Config.isManagerView && activeStops.length === 0);
    document.body.classList.toggle('has-orders', activeStops.length > 0);

    if (Config.viewMode === 'inspector') {
        const rocker = document.getElementById('contextual-rocker-wrapper');
        const undo = document.getElementById('btn-undo-incremental');
        const zone = document.getElementById('inspector-action-buttons-zone');
        if (rocker && undo && zone) {
            if (rocker.parentElement !== zone) zone.appendChild(rocker);
            if (undo.parentElement !== zone) zone.appendChild(undo);
        }
    }

    const addMenuWrapper = document.getElementById('add-menu-wrapper');
    if (addMenuWrapper) {
        if (Config.viewMode === 'inspector') {
            addMenuWrapper.style.display = AppState.PERMISSION_MODIFY ? 'block' : 'none';
            const addMainBtn = addMenuWrapper.querySelector('.header-action-btn');
            if (addMainBtn) {
                addMainBtn.onclick = showAddOrderModal;
                addMainBtn.style.cursor = 'pointer';
            }
        } else {
            addMenuWrapper.style.display = 'block';
            const addMainBtn = addMenuWrapper.querySelector('.header-action-btn');
            if (addMainBtn) {
                addMainBtn.onclick = null;
                addMainBtn.style.cursor = 'default';
            }
        }
    }

    updateRoutingUI();

    if (Config.isManagerView) {
        const header = document.createElement('div');
        header.className = 'glide-table-header';

        const sortIcon = (col) => isAllInspectors ? getSortIcon(col) : '';
        const sortClass = isAllInspectors ? 'sortable' : '';
        const sortClick = (col) => isAllInspectors ? `onclick="sortTable('${col}')"` : '';

        header.innerHTML = `
            <div class="col-num"><input type="checkbox" id="bulk-select-all" class="grey-checkbox" onchange="toggleSelectAll(this)"></div>
            <div class="col-eta" style="display: ${isAllInspectors ? 'none' : 'flex'}; justify-content: center; text-align: center;">ETA</div>
            <div class="col-due ${sortClass}" ${sortClick('dueDate')}>Due ${sortIcon('dueDate')}</div>

            <div class="col-addr" style="display:flex; align-items:center; flex-direction:row; padding-left:8px; padding-right:6px; flex:1 1 auto; min-width:0;">
                <div class="address-search-wrapper" style="position:relative; flex: 1; display:flex; align-items:center; height:30px;">
                    <input type="text" id="address-search-input" placeholder="Search address or client..." oninput="filterListDOM(this.value)" class="address-header-input">
                    <i class="fa-solid fa-magnifying-glass search-icon" id="search-glass-icon" style="position: absolute; right: 8px; color: var(--row-text-muted); font-size: 12px; pointer-events: none;"></i>
                    <i class="fa-solid fa-xmark clear-search-icon" id="clear-search-icon" onclick="clearAddressSearch()" style="display:none; position: absolute; right: 8px; z-index: 5;"></i>
                    <div class="custom-tooltip">Click to search orders</div>
                </div>
                <div class="${sortClass}" ${sortClick('address')} style="margin-left:auto; padding:4px; flex-shrink:0; display:flex; align-items:center; width: 20px; justify-content: center;">${sortIcon('address')}</div>
            </div>

            <div class="col-app ${sortClass}" ${sortClick('app')}>App ${sortIcon('app')}</div>
            <div class="col-client ${sortClass}" ${sortClick('client')}>Client ${sortIcon('client')}</div>
            <div class="col-insp ${sortClass}" ${sortClick('driverName')} style="display: ${isSingleInspector ? 'none' : 'flex'}; justify-content: center;">Inspector ${sortIcon('driverName')}</div>
        `;

        const headerContainer = document.getElementById('list-header-container');
        if (headerContainer) {
            headerContainer.innerHTML = '';
            headerContainer.appendChild(header);
        } else {
            listContainer.appendChild(header);
        }

        const searchInput = document.getElementById('address-search-input');
        if (searchInput && window.lastAddressSearchValue) {
            searchInput.value = window.lastAddressSearchValue;
            const clearIcon = document.getElementById('clear-search-icon');
            const glassIcon = document.getElementById('search-glass-icon');
            if (clearIcon) clearIcon.style.display = window.lastAddressSearchValue ? 'block' : 'none';
            if (glassIcon) glassIcon.style.display = window.lastAddressSearchValue ? 'none' : 'block';
        }
    } else {
        const inspSearchInput = document.getElementById('inspector-search-input');
        if (inspSearchInput && window.lastAddressSearchValue) {
            inspSearchInput.value = window.lastAddressSearchValue;
            const inspClearIcon = document.getElementById('inspector-clear-search-icon');
            if (inspClearIcon) inspClearIcon.style.display = window.lastAddressSearchValue ? 'block' : 'none';
        }
    }

    // NEW SYNCHRONIZED DISPLAY INDEX CALCULATION
    const precalculatedIndexes = new Map();
    const clusterCounts = {};
    activeStops.forEach(s => {
        const routeKey = `${s.driverId || 'unassigned'}_${s.cluster === 'X' ? 'X' : (s.cluster || 0)}`;
        const isDirty = AppState.dirtyRoutes.has(routeKey) || AppState.dirtyRoutes.has('all') || AppState.dirtyRoutes.has('endpoints_0') || (!Config.isManagerView && AppState.isAltered);
        
        if (!isRouteAssigned(s.status) || isDirty) {
            // Unrouted or Staging (Pre-Optimization) - Lock list order static
            s._displayIndex = s._originalIndex || 1;
        } else {
            // Optimized (Routed/Drag-and-Drop) - Sequential Array order
            const key = `${s.driverId || 'unassigned'}_${s.cluster}`;
            if (!clusterCounts[key]) clusterCounts[key] = 0;
            clusterCounts[key]++;
            s._displayIndex = clusterCounts[key];
        }
        precalculatedIndexes.set(s.id, s._displayIndex);
    });

    const getDisplayIndex = (s) => {
        return precalculatedIndexes.get(s.id) || s._displayIndex || s._originalIndex || 1;
    };

    const processStop = (s, passedDisplayIndex) => {
        const displayIndex = passedDisplayIndex !== undefined ? passedDisplayIndex : getDisplayIndex(s);
        const item = document.createElement('div');
        item.id = `item-${s.id}`;
        item.setAttribute('data-search', `${(s.address||'').toLowerCase()} ${(s.client||'').toLowerCase()}`);
        if (Config.viewMode === 'inspector' && s.hiddenInInspector) item.classList.add('hidden-unrouted');

        let urgencyClass = '';
        if (s.dueDate) {
            const dueTime = new Date(s.dueDate); dueTime.setHours(0, 0, 0, 0);
            if (dueTime < today) urgencyClass = 'past-due';
            else if (dueTime.getTime() === today.getTime()) urgencyClass = 'due-today';
        }
        const dueFmt = s.dueDate ? `${new Date(s.dueDate).getMonth()+1}/${new Date(s.dueDate).getDate()}` : "N/A";
        const isRoutedStop = isRouteAssigned(s.status);
        const routeKey = `${s.driverId || 'unassigned'}_${s.cluster === 'X' ? 'X' : (s.cluster || 0)}`;
        let etaTime = (!isRoutedStop || AppState.dirtyRoutes.has(routeKey) || AppState.dirtyRoutes.has('all')) ? '--' : (s.eta || '--');

        if (Config.isManagerView) {
            item.className = `glide-row ${s.status.toLowerCase().replace(' ', '-')} ${AppState.currentDisplayMode}`;
            let inspectorHtml = `<div class="col-insp" style="display: ${isSingleInspector ? 'none' : 'flex'}; justify-content: center;">${s.driverName || Config.driverParam || 'Unassigned'}</div>`;

            if (AppState.inspectors.length > 0) {
                const optionsHtml = AppState.inspectors.filter(i => isTrueInspector(i.isInspector)).map((insp) => {
                    const originalIdx = AppState.inspectors.indexOf(insp);
                    const color = MASTER_PALETTE[originalIdx % MASTER_PALETTE.length];
                    return `<option value="${insp.id}" style="color: ${color}; font-weight: 400;" ${String(s.driverId) === String(insp.id) ? 'selected' : ''}>${insp.name}</option>`;
                }).join('');

                let currentInspColor = 'var(--text-main)';
                if (s.driverId) {
                    const dIdx = AppState.inspectors.findIndex(i => String(i.id) === String(s.driverId));
                    if (dIdx > -1) currentInspColor = MASTER_PALETTE[dIdx % MASTER_PALETTE.length];
                }

                inspectorHtml = `
                    <div class="col-insp" onclick="event.stopPropagation()" style="display: ${isSingleInspector ? 'none' : 'block'};">
                        <select class="insp-select" onchange="handleInspectorChange(event, '${s.id}', this)" style="color: ${currentInspColor}; font-weight: 400;" ${!AppState.PERMISSION_MODIFY ? 'disabled' : ''}>
                            ${!s.driverId ? `<option value="" disabled selected hidden>Select Inspector...</option>` : ''}
                            ${optionsHtml}
                        </select>
                    </div>
                `;
            }

            const style = getVisualStyle(s, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteCount, AppState.stops, AppState.inspectors);

            item.innerHTML = `
                <div class="col-num"><div class="num-badge" style="background-color: ${style.bg}; border: 3px solid ${style.border}; color: ${style.text};">${displayIndex}</div></div>
                <div class="col-eta" style="display: ${isAllInspectors ? 'none' : 'flex'}; justify-content: center; text-align: center;">${etaTime}</div>
                <div class="col-due ${urgencyClass}">${dueFmt}</div>
                <div class="col-addr">
                    <div class="addr-text">${(s.address||'').split(',')[0]}</div>
                    <div class="type-text">${s.type || ''}</div>
                </div>
                <div class="col-app">${s.app || '--'}</div>
                <div class="col-client">${s.client || '--'}</div>
                ${inspectorHtml}
            `;
        } else {
            item.className = `stop-item ${s.status.toLowerCase().replace(' ', '-')} ${AppState.currentDisplayMode}`;
            const distFmt = s.dist ? parseFloat(s.dist).toFixed(1) : "0.0";
            const metaDisplay = (!isRoutedStop || AppState.dirtyRoutes.has(routeKey) || AppState.dirtyRoutes.has('all')) ? `-- | ${distFmt} mi` : `${etaTime} | ${distFmt} mi`;

            item.innerHTML = `
                <div class="stop-sidebar ${urgencyClass}">${displayIndex}</div>
                <div class="csv-box">${(s.app || "--").substring(0,2).toUpperCase()}</div>
                <div class="stop-content">
                    <div class="stop-addr-title">${(s.address||'').split(',')[0]}</div>
                    <div class="row-meta">${metaDisplay}</div>
                    <div class="row-details">${s.type || ''}</div>
                </div>
                <div class="due-date-container ${urgencyClass}">${dueFmt}</div>
                <div class="stop-actions">
                    <i class="${s.status.toLowerCase() === 'completed' ? 'fa-solid' : 'fa-regular'} fa-circle-check icon-btn" style="color:var(--accent)" onclick="toggleComplete(event, '${s.id}')"></i>
                    <i class="fa-solid fa-location-arrow icon-btn" style="color:#1D92D6" onclick="openNav(event, '${s.lat}','${s.lng}', '${(s.address || '').replace(/'/g, "\\'")}')"></i>
                </div>
            `;
        }

        item.onclick = (e) => {
            const isMobile = Config.viewMode === 'managersmall';
            const isMacCmd = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? e.metaKey : e.ctrlKey;

            if (e.shiftKey && window.lastSelectedId && !isMobile) {
                const activeForSelection = AppState.stops.filter(st => isStopVisible(st, true, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteViewFilter));
                const idx1 = activeForSelection.findIndex(st => String(st.id) === String(window.lastSelectedId));
                const idx2 = activeForSelection.findIndex(st => String(st.id) === String(s.id));
                if (idx1 > -1 && idx2 > -1) {
                    const start = Math.min(idx1, idx2);
                    const end = Math.max(idx1, idx2);
                    AppState.selectedIds.clear();
                    for(let i = start; i <= end; i++) {
                        AppState.selectedIds.add(activeForSelection[i].id);
                    }
                }
            } else if (isMacCmd || isMobile) {
                AppState.selectedIds.has(s.id) ? AppState.selectedIds.delete(s.id) : AppState.selectedIds.add(s.id);
                window.lastSelectedId = s.id;
            } else {
                AppState.selectedIds.clear();
                AppState.selectedIds.add(s.id);
                window.lastSelectedId = s.id;
            }

            updateSelectionUI();

            if (!e.shiftKey && !isMacCmd && !isMobile) {
                document.getElementById(`item-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        };
        return item;
    };

    if (isSingleInspector || !Config.isManagerView) {
        const completedStops = activeStops.filter(s => s.status.toLowerCase() === 'completed');
        const unroutedStops = activeStops.filter(s => !isRouteAssigned(s.status) && s.status.toLowerCase() !== 'completed');
        const routedStops = activeStops.filter(s => isRouteAssigned(s.status) && s.status.toLowerCase() !== 'completed');
        let eps = getActiveEndpoints();

        if (completedStops.length > 0) {
            const completedDiv = document.createElement('div');
            completedDiv.id = 'completed-list';
            completedDiv.className = 'completed-group-container';
            completedDiv.style.minHeight = '30px';
            listContainer.appendChild(completedDiv);

            const compSub = document.createElement('div');
            compSub.className = 'list-subheading';
            compSub.innerHTML = `<span>COMPLETED ORDERS</span><span class="route-summary-text">${completedStops.length} stops</span>`;
            completedDiv.appendChild(compSub);
            completedStops.forEach((s) => { completedDiv.appendChild(processStop(s)); });
        }

        const startRow = createEndpointRow('start', eps.start);
        startRow.id = 'start-endpoint-row';
        listContainer.appendChild(startRow);

        if (unroutedStops.length > 0) {
            const unroutedDiv = document.createElement('div');
            unroutedDiv.id = 'unrouted-list'; unroutedDiv.style.minHeight = '30px';
            listContainer.appendChild(unroutedDiv);
            if (Config.isManagerView) {
                const el = document.createElement('div'); el.className = 'list-subheading'; el.innerText = 'UNROUTED ORDERS';
                unroutedDiv.appendChild(el);
            }
            unroutedStops.forEach((s, i) => { unroutedDiv.appendChild(processStop(s)); });
        }

        if (routedStops.length > 0) {
            const uniqueClusters = [...new Set(routedStops.map(s => s.cluster === 'X' ? 0 : (s.cluster || 0)))].sort();
            uniqueClusters.forEach(clusterId => {
                const cStops = routedStops.filter(s => (s.cluster === 'X' ? 0 : (s.cluster || 0)) === clusterId);
                if (cStops.length > 0) {
                    const routedDiv = document.createElement('div');
                    routedDiv.id = Config.isManagerView ? `routed-list-${clusterId}` : `driver-list-${clusterId}`;
                    routedDiv.className = 'routed-group-container'; routedDiv.style.minHeight = '30px';
                    listContainer.appendChild(routedDiv);
                    routedDiv.appendChild(createRouteSubheading(clusterId, cStops));
                    cStops.forEach((s, i) => { routedDiv.appendChild(processStop(s)); });
                }
            });
        }
        listContainer.appendChild(createEndpointRow('end', eps.end));
    } else {
        const mainDiv = document.createElement('div');
        mainDiv.id = 'main-list-container';
        listContainer.appendChild(mainDiv);
        if (activeStops.length > 0) activeStops.forEach((s, i) => mainDiv.appendChild(processStop(s)));
    }

    setTimeout(() => {
        const map = getMapInstance();
        if (map) map.resize();

        renderMapMarkers({
            activeStops,
            endpointsToDraw: buildEndpointsToDraw(activeStops),
            isManagerView: Config.isManagerView,
            currentInspectorFilter: AppState.currentInspectorFilter,
            currentRouteCount: AppState.currentRouteCount,
            allStops: AppState.stops,
            inspectors: AppState.inspectors,
            onMarkerClick: (id, isShift) => {
                const isMobile = Config.viewMode === 'managersmall';
                if (!isShift && !isMobile) AppState.selectedIds.clear();
                AppState.selectedIds.has(id) ? AppState.selectedIds.delete(id) : AppState.selectedIds.add(id);
                updateSelectionUI();
                if(!isMobile) document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        updateSelectionUI();

        if (window.lastAddressSearchValue) { window.filterListDOM(window.lastAddressSearchValue); }

        resizeMap();

        const hlZone = document.getElementById('header-list-zone');
        const sidebar = document.getElementById('sidebar');
        if (hlZone && sidebar) {
            if (document.body.classList.contains('empty-state-active') || sidebar.offsetWidth === 0) {
                hlZone.style.width = 'auto';
            } else {
                hlZone.style.width = sidebar.offsetWidth + 'px';
            }
        }

        if (Config.viewMode === 'managersmall') {
            if (!document.body.classList.contains('split-show-map') && !document.body.classList.contains('split-show-list')) {
                document.body.classList.add('split-show-list');
            }
            let fab = document.getElementById('mobile-fab-toggle');
            if (fab) {
                fab.onclick = () => {
                    const isMap = document.body.classList.contains('split-show-map');
                    if (isMap) {
                        document.body.classList.remove('split-show-map');
                        document.body.classList.add('split-show-list');
                        fab.innerHTML = '<i class="fa-solid fa-map"></i>';
                    } else {
                        document.body.classList.remove('split-show-list');
                        document.body.classList.add('split-show-map');
                        fab.innerHTML = '<i class="fa-solid fa-list"></i>';
                        setTimeout(() => { const m = getMapInstance(); if(m) m.resize(); }, 50);
                    }
                };
                const isMapMode = document.body.classList.contains('split-show-map');
                fab.innerHTML = isMapMode ? '<i class="fa-solid fa-list"></i>' : '<i class="fa-solid fa-map"></i>';
            }
        }

        if (window.isFirstLoadCompletedScroll === undefined) window.isFirstLoadCompletedScroll = true;

        if (window.isFirstLoadCompletedScroll && document.getElementById('completed-list')) {
            const scrollTarget = document.getElementById('start-endpoint-row');
            if (scrollTarget) {
                listContainer.scrollTop = scrollTarget.offsetTop;
            }
            window.isFirstLoadCompletedScroll = false;
        } else if (previousScrollTop > 0) {
            listContainer.scrollTop = previousScrollTop;
        }

    }, 20);
}
