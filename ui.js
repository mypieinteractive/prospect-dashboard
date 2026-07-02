/* Dashboard - V20.16 */
/* FILE: ui.js */
/* Changes: */
/* 1. Splitting out modals/alerts into ui-modals.js and rendering functions into ui-render.js */

import { AppState, Config, pushToHistory, triggerFullRender, markRouteDirty, silentSaveRouteState, apiFetch, getActiveEndpoints, loadData } from './app.js';
import { isActiveStop, isStopVisible, getVisualStyle, MASTER_PALETTE, isRouteAssigned, isTrueInspector, minifyStop } from './logic.js';
import { drawRouteMap, resizeMap, focusMapPin, resetMapBounds, getMapInstance, renderMapMarkers, filterMarkersMap, updateMapSelectionStyles } from './map.js';

export * from './ui-modals.js';
export * from './ui-render.js';
import { showOverlay, hideOverlay, customAlert, nonDestructiveAlert, customConfirm, showAddOrderModal, showUploadModal, handleOpenEmailModal } from './ui-modals.js';
import { render, drawRoute, getSortIcon, createRouteSubheading, createEndpointRow } from './ui-render.js';

export function updateUndoUI() {
    const undoBtn = document.getElementById('btn-undo-incremental');
    if (undoBtn) {
        undoBtn.disabled = AppState.historyStack.length === 0;
        if (Config.viewMode === 'inspector' && !AppState.PERMISSION_MODIFY) {
            undoBtn.style.display = 'none';
        } else {
            undoBtn.style.display = 'flex';
        }
    }
}

export function updateHeaderUI() {
    if (Config.viewMode === 'inspector') {
        const inspNameEl = document.getElementById('insp-name');
        const inspDateEl = document.getElementById('insp-dispatch-date');
        const resetBtn = document.getElementById('btn-inspector-reset');
        
        if (inspNameEl) {
            let logoContainer = document.getElementById('insp-logo-container');
            if (logoContainer && AppState.companyLogo) {
                logoContainer.innerHTML = `<img src="${AppState.companyLogo}" style="height: 38px; border-radius: 4px; object-fit: contain;">`;
            }
            inspNameEl.innerHTML = `<span>${AppState.displayName || AppState.driverName || 'Inspector'}</span>`;
        }
        
        if (inspDateEl) {
            let displayDate = new Date();
            const activeStops = AppState.stops.filter(s => isStopVisible(s, true, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteViewFilter));
            if (activeStops.length > 0 && activeStops[0].dueDate) {
                const [y, m, d] = activeStops[0].dueDate.split('-');
                if (y && m && d) displayDate = new Date(y, m - 1, d);
            }
            const dateStr = displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            inspDateEl.innerText = `Dispatched: ${dateStr}`;
        }

        if (resetBtn) {
            resetBtn.style.display = AppState.isAltered ? 'flex' : 'none';
        }
    }

    if (!Config.isManagerView) return;
    const filterSelectWrap = document.getElementById('inspector-dropdown-wrapper');
    const isCompanyTier = document.body.classList.contains('tier-company');
    if (filterSelectWrap) {
        filterSelectWrap.style.display = isCompanyTier ? 'block' : 'none';
    }
}

export function updateInspectorDropdown() {
    const filterSelect = document.getElementById('inspector-filter');
    if (!filterSelect || !Config.isManagerView) return;

    const validInspectorIds = new Set();
    AppState.stops.forEach(s => {
        if (s.driverId && isActiveStop(s, Config.isManagerView)) {
            validInspectorIds.add(String(s.driverId));
        }
    });

    if (AppState.currentInspectorFilter !== 'all' && !validInspectorIds.has(String(AppState.currentInspectorFilter))) {
        AppState.currentInspectorFilter = 'all';
        sessionStorage.setItem('sproute_inspector_filter', 'all');
        document.body.classList.add('manager-all-inspectors');
        document.body.classList.remove('manager-single-inspector');
    }

    let filterHtml = '<option value="all" style="color: var(--text-main);">All Inspectors</option>';
    
    AppState.inspectors.forEach((i, idx) => { 
        if (validInspectorIds.has(String(i.id)) && isTrueInspector(i.isInspector)) {
            const color = MASTER_PALETTE[idx % MASTER_PALETTE.length];
            filterHtml += `<option value="${i.id}" style="color: ${color}; font-weight: 400;"></option>`; 
            filterHtml += `<option value="${i.id}" style="color: ${color}; font-weight: 400;">${i.name}</option>`; 
        }
    });
    
    filterSelect.innerHTML = filterHtml;
    filterSelect.value = AppState.currentInspectorFilter;
    
    if (AppState.currentInspectorFilter !== 'all') {
        const inspIdx = AppState.inspectors.findIndex(i => String(i.id) === String(AppState.currentInspectorFilter));
        if (inspIdx > -1) filterSelect.style.color = MASTER_PALETTE[inspIdx % MASTER_PALETTE.length];
    } else {
        filterSelect.style.color = 'var(--text-main)';
    }
}

export function updateRouteButtonColors() {
    if (!Config.isManagerView) return;
    
    let baseColor = MASTER_PALETTE[0];
    if (AppState.currentInspectorFilter !== 'all') {
        const inspIdx = AppState.inspectors.findIndex(i => String(i.id) === String(AppState.currentInspectorFilter));
        if (inspIdx > -1) baseColor = MASTER_PALETTE[inspIdx % MASTER_PALETTE.length];
    }

    const mr1 = document.getElementById('move-r1-btn');
    const mr2 = document.getElementById('move-r2-btn');
    const mr3 = document.getElementById('move-r3-btn');
    if (mr1) mr1.style.borderLeftColor = baseColor;
    if (mr2) mr2.style.borderLeftColor = '#000000';
    if (mr3) mr3.style.borderLeftColor = '#ffffff';
    
    const mmr1 = document.getElementById('mobile-move-r1-btn');
    const mmr2 = document.getElementById('mobile-move-r2-btn');
    const mmr3 = document.getElementById('mobile-move-r3-btn');
    if (mmr1) mmr1.style.borderLeftColor = baseColor;
    if (mmr2) mmr2.style.borderLeftColor = '#000000';
    if (mmr3) mmr3.style.borderLeftColor = '#ffffff';

    for(let i=1; i<=3; i++) {
        const btn = document.getElementById(`rbtn-${i}`);
        if (btn) btn.style.setProperty('--route-color', baseColor);
        
        const ind = document.getElementById(`rbtn-ind-${i}`);
        if (ind) {
            ind.innerHTML = '';
            for(let c=0; c<i; c++) {
                let bgHex = baseColor;
                if (c === 1) bgHex = '#000000';
                if (c === 2) bgHex = '#ffffff';
                
                const circle = document.createElement('div');
                circle.className = 'rbtn-circle';
                circle.style.backgroundColor = bgHex; 
                circle.style.border = `2px solid ${baseColor}`;
                ind.appendChild(circle);
            }
        }
    }
}

export function updatePrioritySliderUI() {
    const priorityContainer = document.getElementById('priority-container');
    const sliderPriority = document.getElementById('slider-priority');
    if (priorityContainer && sliderPriority) {
        if (AppState.currentRouteCount === 1) {
            priorityContainer.style.opacity = '0.4';
            priorityContainer.style.pointerEvents = 'none';
            sliderPriority.disabled = true;
        } else {
            priorityContainer.style.opacity = '1';
            priorityContainer.style.pointerEvents = 'auto';
            sliderPriority.disabled = false;
        }
    }
}

export function updateRoutingUI() {
    const routingControls = document.getElementById('routing-controls');
    const paramContainer = document.getElementById('parameters-container');
    const actionBtns = document.getElementById('routing-action-buttons');
    
    const btnPending = document.getElementById('action-group-pending');
    const btnStaging = document.getElementById('action-group-staging');
    const btnReady = document.getElementById('action-group-ready');

    if(routingControls) routingControls.style.display = 'none';
    if(paramContainer) paramContainer.style.display = 'none';
    if(btnPending) btnPending.style.display = 'none';
    if(btnStaging) btnStaging.style.display = 'none';
    if(btnReady) btnReady.style.display = 'none';
    if(actionBtns) actionBtns.style.borderLeft = 'none';
    
    updatePrioritySliderUI();

    if (Config.viewMode === 'inspector' && !AppState.PERMISSION_REOPTIMIZE) {
        return; 
    }

    if (Config.isManagerView && AppState.currentInspectorFilter === 'all') {
        const routeToggles = document.getElementById('route-view-toggles');
        if (routeToggles) routeToggles.style.display = 'none';
        AppState.currentRoutingState = 'Ready'; 
        return;
    }

    let targetStops = Config.isManagerView ? AppState.stops.filter(s => String(s.driverId) === String(AppState.currentInspectorFilter)) : AppState.stops;
    targetStops = targetStops.filter(s => isActiveStop(s, Config.isManagerView));

    if (targetStops.length === 0) {
        AppState.currentRoutingState = 'Pending';
        return;
    }

    const unroutedCount = targetStops.filter(s => !isRouteAssigned(s.status)).length;
    let isDirty = false;
    
    let inspKey = Config.isManagerView ? AppState.currentInspectorFilter : Config.driverParam;
    if (AppState.dirtyRoutes.has('all') || AppState.dirtyRoutes.has('endpoints_0')) {
        isDirty = true;
    } else {
        for (let i = 0; i <= AppState.currentRouteCount; i++) {
            if (AppState.dirtyRoutes.has(`${inspKey}_${i}`)) isDirty = true;
        }
    }

    if (!Config.isManagerView && AppState.isAltered) {
        isDirty = true;
    }

    let currentState = 'Ready';
    if (unroutedCount === targetStops.length) {
        currentState = 'Pending';
    } else if (isDirty) {
        currentState = 'Staging';
    }
    
    AppState.currentRoutingState = currentState;
    if (routingControls) routingControls.setAttribute('data-state', currentState);

    let maxCluster = -1;
    targetStops.forEach(s => {
        if (isRouteAssigned(s.status) && s.cluster !== 'X' && s.cluster > maxCluster) maxCluster = s.cluster;
    });
    
    const togglesEl = document.getElementById('route-view-toggles');
    if (maxCluster > 0) {
        if (togglesEl) {
            togglesEl.style.display = 'flex';
            togglesEl.style.borderBottom = 'none'; 
        }
        if (document.getElementById('view-r1-btn')) document.getElementById('view-r1-btn').style.display = maxCluster >= 1 ? 'block' : 'none';
        if (document.getElementById('view-r2-btn')) document.getElementById('view-r2-btn').style.display = maxCluster >= 2 ? 'block' : 'none';
    } else {
        if (togglesEl) {
            togglesEl.style.display = 'none';
            togglesEl.style.borderBottom = '1px solid var(--route-mod-border)';
        }
        if (AppState.currentRouteViewFilter !== 'all') {
            AppState.currentRouteViewFilter = 'all';
            document.getElementById('view-rall-btn')?.classList.add('active');
            for(let i = 0; i <= 2; i++) document.getElementById(`view-r${i}-btn`)?.classList.remove('active');
        }
    }

    const sendBtnText = document.getElementById('btn-header-send-route-text');
    if (sendBtnText) sendBtnText.innerText = AppState.currentRouteCount > 1 ? "Send Routes" : "Send Route";

    if (Config.isManagerView) {
        if (routingControls) routingControls.style.display = 'flex';
        if (currentState === 'Pending') {
            if (paramContainer) paramContainer.style.display = 'flex';
            if (actionBtns) { actionBtns.style.width = '140px'; actionBtns.style.borderLeft = 'none'; }
            if (btnPending) btnPending.style.display = 'flex';
        } else if (currentState === 'Staging') {
            if (actionBtns) actionBtns.style.width = '100%';
            if (btnStaging) btnStaging.style.display = 'flex';
        } else if (currentState === 'Ready') {
            if (actionBtns) actionBtns.style.width = '100%';
            if (btnReady) btnReady.style.display = 'flex';
            const restoreBtn = document.getElementById('btn-header-restore');
            if (restoreBtn) restoreBtn.style.display = AppState.isAltered ? 'flex' : 'none';
        }
    } else {
        if (!AppState.PERMISSION_REOPTIMIZE) {
            if (routingControls) routingControls.style.display = 'none';
        } else {
            if (currentState === 'Staging') {
                if (routingControls) routingControls.style.display = 'flex';
                if (actionBtns) actionBtns.style.width = '100%';
                if (btnStaging) {
                    btnStaging.style.display = 'flex';
                    const startOverBtn = btnStaging.querySelector('.danger-btn');
                    if (startOverBtn) startOverBtn.style.display = 'none';
                }
            } else {
                if (routingControls) routingControls.style.display = 'none';
            }
        }
    }
}

export function adjustSummaryTextSize() {
    const container = document.getElementById('global-summary-stats');
    if (!container || !document.body.classList.contains('view-managersmall')) return;

    const textElements = container.querySelectorAll('div, span');
    textElements.forEach(el => el.style.removeProperty('font-size'));

    requestAnimationFrame(() => {
        if (container.scrollWidth > container.clientWidth && container.clientWidth > 0) {
            const ratio = container.clientWidth / container.scrollWidth;
            textElements.forEach(el => {
                const currentSize = parseFloat(window.getComputedStyle(el).fontSize) || 14;
                const newSize = Math.max(9, currentSize * ratio * 0.95); 
                el.style.setProperty('font-size', `${newSize}px`, 'important');
            });
        }
    });
}

export function updateSummary() {
    const active = AppState.stops.filter(s => isStopVisible(s, true, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteViewFilter) && s.status !== 'Completed');

    let totalMi = 0, totalSecs = 0, dueToday = 0, pastDue = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    active.forEach(s => {
        const distVal = parseFloat(s.dist || 0);
        if (!isNaN(distVal)) totalMi += distVal;
        totalSecs += parseFloat(s.durationSecs || 0);
        
        if(s.dueDate) {
            const dueTime = new Date(s.dueDate); dueTime.setHours(0, 0, 0, 0);
            if(dueTime < today) pastDue++;
            else if(dueTime.getTime() === today.getTime()) dueToday++;
        }
    });
    
    let totalHrs = active.length > 0 ? ((totalSecs + (active.length * AppState.COMPANY_SERVICE_DELAY * 60)) / 3600).toFixed(1) : '--';
    
    if (document.getElementById('sum-dist')) document.getElementById('sum-dist').innerText = `${totalMi.toFixed(1)} mi`;
    if (document.getElementById('sum-time')) document.getElementById('sum-time').innerText = `${totalHrs} hrs`;
    if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = `${active.length} Orders`;
    if (document.getElementById('stat-due')) document.getElementById('stat-due').innerText = `${dueToday} Due Today`;
    if (document.getElementById('stat-past')) document.getElementById('stat-past').innerText = `${pastDue} Past Due`;

    const globalSummary = document.getElementById('global-summary-stats');
    if (globalSummary) {
        if (AppState.stops.length === 0) {
            globalSummary.style.visibility = 'hidden'; 
        } else {
            globalSummary.style.visibility = 'visible'; 
        }
    }

    const summaryMetrics = document.getElementById('summary-metrics');
    if (summaryMetrics) {
        if (Config.isManagerView && AppState.currentInspectorFilter === 'all') {
            summaryMetrics.style.display = 'none';
        } else {
            summaryMetrics.style.display = 'block';
            summaryMetrics.style.visibility = (AppState.currentRoutingState === 'Pending' || AppState.currentRoutingState === 'Staging') ? 'hidden' : 'visible';
        }
    }

    adjustSummaryTextSize();
}

export function updateRouteTimes() {
    if (Config.isManagerView && AppState.currentInspectorFilter === 'all') return;
    const activeStops = AppState.stops.filter(s => isStopVisible(s, false, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteViewFilter) && s.cluster !== 'X');
    for(let i=0; i<3; i++) {
        const clusterStops = activeStops.filter(s => String(s.cluster) === String(i));
        let totalSecs = 0;
        clusterStops.forEach(s => totalSecs += parseFloat(s.durationSecs || 0));
        const hrs = clusterStops.length > 0 ? ((totalSecs + (clusterStops.length * AppState.COMPANY_SERVICE_DELAY * 60)) / 3600).toFixed(1) : '--';
        if(document.getElementById(`rtime-${i+1}`)) document.getElementById(`rtime-${i+1}`).innerText = clusterStops.length > 0 ? `${hrs} hrs` : '-- hrs';
    }
}

export function prevMobilePreview(e) {
    e.stopPropagation();
    if (window.mobilePreviewIndex > 0) {
        window.mobilePreviewIndex--;
    } else {
        window.mobilePreviewIndex = AppState.selectedIds.size - 1;
    }
    updateSelectionUI();
}

export function nextMobilePreview(e) {
    e.stopPropagation();
    if (window.mobilePreviewIndex < AppState.selectedIds.size - 1) {
        window.mobilePreviewIndex++;
    } else {
        window.mobilePreviewIndex = 0;
    }
    updateSelectionUI();
}

export function updateSelectionUI() { 
    document.querySelectorAll('.stop-item, .glide-row').forEach(el=>el.classList.remove('selected')); 
    AppState.selectedIds.forEach(id => {
        const row = document.getElementById(`item-${id}`); 
        if (row) row.classList.add('selected');
    });

    if (typeof updateMapSelectionStyles === 'function') {
        updateMapSelectionStyles(AppState.selectedIds);
    }

    const has = AppState.selectedIds.size > 0; 
    let hasRouted = false;
    AppState.selectedIds.forEach(id => {
        const s = AppState.stops.find(st => String(st.id) === String(id));
        if (s && isRouteAssigned(s.status)) hasRouted = true;
    });

    const selectAllCb = document.getElementById('bulk-select-all');
    if (selectAllCb) {
        const activeStops = AppState.stops.filter(s => isStopVisible(s, true, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteViewFilter));
        selectAllCb.checked = (activeStops.length > 0 && AppState.selectedIds.size === activeStops.length);
    }
    
    if (document.getElementById('bulk-delete-btn')) document.getElementById('bulk-delete-btn').style.display = (has && AppState.PERMISSION_MODIFY && Config.isManagerView) ? 'block' : 'none'; 
    if (document.getElementById('bulk-unroute-btn')) document.getElementById('bulk-unroute-btn').style.display = (hasRouted && AppState.PERMISSION_MODIFY) ? 'block' : 'none'; 
    
    const mBtnDel = document.getElementById('mobile-bulk-delete-btn');
    if (mBtnDel) mBtnDel.style.display = (has && AppState.PERMISSION_MODIFY && Config.isManagerView) ? 'block' : 'none'; 
    const mBtnUnroute = document.getElementById('mobile-bulk-unroute-btn');
    if (mBtnUnroute) mBtnUnroute.style.display = (hasRouted && AppState.PERMISSION_MODIFY) ? 'block' : 'none'; 

    let hasUnrouted = false;
    AppState.selectedIds.forEach(id => {
        const s = AppState.stops.find(st => String(st.id) === String(id));
        if (s && !isRouteAssigned(s.status)) hasUnrouted = true;
    });

    for(let i=1; i<=3; i++) {
        const btn = document.getElementById(`move-r${i}-btn`);
        const mBtn = document.getElementById(`mobile-move-r${i}-btn`);
        let showMove = 'none';
        
        if(Config.isManagerView && AppState.currentInspectorFilter !== 'all' && has && i <= AppState.currentRouteCount) {
            if (AppState.currentRouteCount > 1 || (AppState.currentRouteCount === 1 && hasUnrouted)) {
                let allInTargetRoute = true;
                AppState.selectedIds.forEach(id => {
                    const s = AppState.stops.find(st => String(st.id) === String(id));
                    if (s && s.cluster !== (i - 1)) allInTargetRoute = false;
                });
                showMove = allInTargetRoute ? 'none' : 'block';
            }
        } 
        
        if (btn) btn.style.display = showMove;
        if (mBtn) mBtn.style.display = showMove;
    }

    if (Config.viewMode === 'managersmall') {
        const hasSelection = AppState.selectedIds.size > 0;
        document.body.classList.toggle('mobile-selection-active', hasSelection);
        
        const previewContainer = document.getElementById('mobile-map-selection-preview');
        if (previewContainer) {
            if (hasSelection) {
                if (window.lastSelectionSize === undefined) window.lastSelectionSize = 0;
                
                if (AppState.selectedIds.size > window.lastSelectionSize) {
                    window.mobilePreviewIndex = AppState.selectedIds.size - 1;
                }
                window.lastSelectionSize = AppState.selectedIds.size;
                
                if (window.mobilePreviewIndex === undefined || window.mobilePreviewIndex >= AppState.selectedIds.size) {
                    window.mobilePreviewIndex = 0;
                }
                
                const selectedArray = Array.from(AppState.selectedIds);
                const selectedId = selectedArray[window.mobilePreviewIndex];
                const s = AppState.stops.find(st => String(st.id) === String(selectedId));

                if (s) {
                    const activeStopsForIndex = AppState.stops.filter(st => isStopVisible(st, true, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteViewFilter));
                    const displayIndex = activeStopsForIndex.findIndex(st => String(st.id) === String(s.id)) + 1;

                    let urgencyClass = '';
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    if (s.dueDate) {
                        const dueTime = new Date(s.dueDate); dueTime.setHours(0, 0, 0, 0); 
                        if (dueTime < today) urgencyClass = 'past-due'; 
                        else if (dueTime.getTime() === today.getTime()) urgencyClass = 'due-today'; 
                    }
                    const dueFmt = s.dueDate ? `${new Date(s.dueDate).getMonth()+1}/${new Date(s.dueDate).getDate()}` : "N/A";
                    const isRoutedStop = isRouteAssigned(s.status);
                    const routeKey = `${s.driverId || 'unassigned'}_${s.cluster === 'X' ? 'X' : (s.cluster || 0)}`;
                    let etaTime = (!isRoutedStop || AppState.dirtyRoutes.has(routeKey) || AppState.dirtyRoutes.has('all')) ? '--' : (s.eta || '--');
                    const style = getVisualStyle(s, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteCount, AppState.stops, AppState.inspectors);
                    
                    let navArrows = '';
                    if (AppState.selectedIds.size === 1) {
                        navArrows = `
                            <div style="display:flex; justify-content:center; align-items:center; padding: 4px 8px; background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--border-color); border-radius: 8px 8px 0 0;">
                                <span style="font-size: 12px; font-weight: 500; color: var(--text-main);">1 of 1</span>
                            </div>
                        `;
                    } else if (AppState.selectedIds.size > 1) {
                        navArrows = `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding: 4px 8px; background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--border-color); border-radius: 8px 8px 0 0;">
                                <i class="fa-solid fa-chevron-left" onclick="prevMobilePreview(event)" style="padding: 4px 12px; cursor: pointer; color: var(--accent);"></i>
                                <span style="font-size: 12px; font-weight: 500; color: var(--text-main);">${window.mobilePreviewIndex + 1} of ${AppState.selectedIds.size}</span>
                                <i class="fa-solid fa-chevron-right" onclick="nextMobilePreview(event)" style="padding: 4px 12px; cursor: pointer; color: var(--accent);"></i>
                            </div>
                        `;
                    }

                    previewContainer.innerHTML = `
                        <div style="border:none; border-radius: 8px; margin: 0; box-shadow: 0 4px 15px rgba(0,0,0,0.6); background: var(--row-bg); overflow: hidden; pointer-events: auto;">
                            ${navArrows}
                            <div class="glide-row compact" style="padding: 10px 8px; border-bottom: none; background: transparent;">
                                <div class="col-num" style="margin-left: 0px; width: 26px;"><div class="num-badge" style="background-color: ${style.bg}; border: 3px solid ${style.border}; color: ${style.text}; width: 22px; height: 22px; font-size: 11px;">${displayIndex || '#'}</div></div>
                                <div class="col-app" style="width: 55px; font-size: 12px; display:flex; justify-content:center; align-items:center; color: var(--row-text-muted);">${s.app || '--'}</div>
                                <div class="col-due ${urgencyClass}" style="width: 45px; font-size: 12px; justify-content:center;">${dueFmt}</div>
                                <div class="col-addr" style="flex:1; border-right: none;"><div class="addr-text" style="font-size: 13px;">${(s.address||'').split(',')[0]}</div></div>
                            </div>
                        </div>
                    `;
                }
            } else {
                window.mobilePreviewIndex = 0;
                window.lastSelectionSize = 0;
                previewContainer.innerHTML = '';
            }
        }

        const selCountEl = document.getElementById('mobile-selection-count');
        if (selCountEl) selCountEl.innerText = `${AppState.selectedIds.size} Selected`;
    }
}

let sortableInstances = [];
let sortableUnrouted = null;

export function initSortable() {
    sortableInstances.forEach(inst => inst.destroy());
    sortableInstances = [];
    if (sortableUnrouted) { sortableUnrouted.destroy(); sortableUnrouted = null; }

    if (!AppState.PERMISSION_MODIFY) return;

    if (AppState.currentRoutingState === 'Pending') return;

    if (Config.isManagerView && AppState.currentInspectorFilter === 'all') {
        return; 
    } else if (Config.isManagerView && AppState.currentInspectorFilter !== 'all') {
        const unroutedEl = document.getElementById('unrouted-list');

        document.querySelectorAll('.routed-group-container').forEach(routedEl => {
            const inst = Sortable.create(routedEl, {
                group: 'manager-routes', delay: 200, delayOnTouchOnly: false, filter: '.static-endpoint, .list-subheading', animation: 150,
                onStart: () => pushToHistory(),
                onEnd: async (evt) => {
                    const hasActiveRoutes = AppState.stops.some(st => isRouteAssigned(st.status));
                    const stopId = evt.item.id.replace('item-', '');
                    const stop = AppState.stops.find(s => String(s.id) === String(stopId));
                    
                    if (stop) {
                        const dId = stop.driverId;
                        let matchOld = evt.from.id.match(/(routed|driver)-list-(\d+)/);
                        if (matchOld) markRouteDirty(dId, parseInt(matchOld[2]));
                        
                        let matchNew = evt.to.id.match(/(routed|driver)-list-(\d+)/);
                        if (matchNew) {
                            stop.cluster = parseInt(matchNew[2]);
                            stop.manualCluster = true;
                            if (hasActiveRoutes) {
                                stop.status = 'Routed'; stop.routeState = 'Staging';
                                markRouteDirty(dId, stop.cluster);
                            }
                        }
                    }

                    if (evt.to.id === 'unrouted-list') {
                        const idx = AppState.stops.findIndex(s => String(s.id) === String(stopId));
                        let dId = null;
                        if (idx > -1) {
                            dId = AppState.stops[idx].driverId;
                            AppState.stops[idx].status = 'Pending'; AppState.stops[idx].routeState = 'Pending';
                            AppState.stops[idx].cluster = 'X'; AppState.stops[idx].manualCluster = false;
                            AppState.stops[idx].eta = ''; AppState.stops[idx].dist = 0; AppState.stops[idx].durationSecs = 0;
                            if (Config.viewMode === 'inspector') AppState.stops[idx].hiddenInInspector = true;
                        }
                        
                        showOverlay();
                        try {
                            let unroutePayload = { 
                                action: 'updateOrder', rowId: stopId, driverId: dId, 
                                updates: { status: 'P', eta: '', dist: 0, durationSecs: 0, routeNum: 'X' }, adminId: Config.adminParam
                            };
                            if (!Config.isManagerView) unroutePayload.routeId = Config.routeId;
                            await apiFetch(unroutePayload);
                        } catch (e) { console.error(e); }
                        finally { hideOverlay(); }
                    }
                    
                    reorderStopsFromDOM(); triggerFullRender(); updateRouteTimes(); silentSaveRouteState();
                }
            });
            sortableInstances.push(inst);
        });
        
        if (unroutedEl) {
            sortableUnrouted = Sortable.create(unroutedEl, {
                group: 'manager-routes', sort: false, delay: 200, delayOnTouchOnly: false, filter: '.list-subheading', animation: 150, onStart: () => pushToHistory(),
                onEnd: async (evt) => {
                    const hasActiveRoutes = AppState.stops.some(st => isRouteAssigned(st.status));
                    const stopId = evt.item.id.replace('item-', '');
                    const stop = AppState.stops.find(s => String(s.id) === String(stopId));

                    if (stop) {
                        const dId = stop.driverId;
                        let matchOld = evt.from.id.match(/(routed|driver)-list-(\d+)/);
                        if (matchOld) markRouteDirty(dId, parseInt(matchOld[2]));

                        let matchNew = evt.to.id.match(/(routed|driver)-list-(\d+)/);
                        if (matchNew) {
                            stop.cluster = parseInt(matchNew[2]);
                            stop.manualCluster = true;
                            if (hasActiveRoutes) {
                                stop.status = 'Routed'; stop.routeState = 'Staging';
                                markRouteDirty(dId, stop.cluster);
                            }
                        }
                    }

                    if (evt.to.id === 'unrouted-list') {
                        const idx = AppState.stops.findIndex(s => String(s.id) === String(stopId));
                        let dId = null;
                        if (idx > -1) {
                            dId = AppState.stops[idx].driverId;
                            AppState.stops[idx].status = 'Pending'; AppState.stops[idx].routeState = 'Pending';
                            AppState.stops[idx].cluster = 'X'; AppState.stops[idx].manualCluster = false;
                            AppState.stops[idx].eta = ''; AppState.stops[idx].dist = 0; AppState.stops[idx].durationSecs = 0;
                            if (Config.viewMode === 'inspector') AppState.stops[idx].hiddenInInspector = true;
                        }

                        showOverlay();
                        try {
                            let unroutePayload = {
                                action: 'updateOrder', rowId: stopId, driverId: dId,
                                updates: { status: 'P', eta: '', dist: 0, durationSecs: 0, routeNum: 'X' }, adminId: Config.adminParam
                            };
                            if (!Config.isManagerView) unroutePayload.routeId = Config.routeId;
                            await apiFetch(unroutePayload);
                        } catch (e) { console.error(e); }
                        finally { hideOverlay(); }
                    }

                    reorderStopsFromDOM(); triggerFullRender(); updateRouteTimes(); silentSaveRouteState();
                }
            });
        }
    } else if (!Config.isManagerView) {
        document.querySelectorAll('.routed-group-container, #main-list-container').forEach(el => {
            const inst = Sortable.create(el, {
                delay: 200, delayOnTouchOnly: false, filter: '.static-endpoint, .list-subheading', animation: 150, onStart: () => pushToHistory(),
                onEnd: (evt) => {
                    const hasActiveRoutes = AppState.stops.some(st => isRouteAssigned(st.status));
                    const stopId = evt.item.id.replace('item-', '');
                    const stop = AppState.stops.find(s => String(s.id) === String(stopId));
                    if (stop) {
                        const dId = stop.driverId || (!Config.isManagerView ? Config.driverParam : null);
                        
                        markRouteDirty(dId, stop.cluster);

                        let matchOld = evt.from.id.match(/(routed|driver)-list-(\d+)/);
                        if (matchOld) markRouteDirty(dId, parseInt(matchOld[2]));
                        
                        let matchNew = evt.to.id.match(/(routed|driver)-list-(\d+)/);
                        if (matchNew) {
                            stop.cluster = parseInt(matchNew[2]); stop.manualCluster = true;
                            if (hasActiveRoutes) { stop.status = 'Routed'; stop.routeState = 'Staging'; markRouteDirty(dId, stop.cluster); }
                        }
                    }
                    
                    reorderStopsFromDOM(); triggerFullRender(); updateRouteTimes(); silentSaveRouteState();
                }
            });
            sortableInstances.push(inst);
        });
    }
}

export function reorderStopsFromDOM() {
    let unroutedIds = []; let routedIds = []; let completedIds = [];
    if (document.getElementById('unrouted-list')) unroutedIds = Array.from(document.getElementById('unrouted-list').children).map(el => el.id.replace('item-', '')).filter(Boolean);
    if (document.getElementById('completed-list')) completedIds = Array.from(document.getElementById('completed-list').children).map(el => el.id.replace('item-', '')).filter(Boolean);
    
    document.querySelectorAll('.routed-group-container').forEach(cont => {
        const rIds = Array.from(cont.children).map(el => el.id.replace('item-', '')).filter(Boolean);
        routedIds = routedIds.concat(rIds);
    });
    if (unroutedIds.length === 0 && routedIds.length === 0 && document.getElementById('main-list-container')) {
        routedIds = Array.from(document.getElementById('main-list-container').children).map(el => el.id.replace('item-', '')).filter(Boolean);
    }
    
    const visibleIds = new Set([...unroutedIds, ...routedIds, ...completedIds]);
    const otherStops = AppState.stops.filter(s => !visibleIds.has(s.id));
    
    const newUnrouted = unroutedIds.map(id => AppState.stops.find(s => String(s.id) === String(id))).filter(Boolean);
    const newRouted = routedIds.map(id => AppState.stops.find(s => String(s.id) === String(id))).filter(Boolean);
    const newCompleted = completedIds.map(id => AppState.stops.find(s => String(s.id) === String(id))).filter(Boolean);
    
    AppState.stops = [...otherStops, ...newCompleted, ...newUnrouted, ...newRouted];
}

let geocodeTimeout;

export async function handleEndpointInput(e, type) {
    clearTimeout(geocodeTimeout);
    const val = e.target.value;
    let dropdown = document.getElementById(`autocomplete-${type}`);
    
    if (!val.trim()) { 
        if (dropdown) dropdown.innerHTML = ''; 
        AppState.latestSuggestions[type] = null; return; 
    }
    
    geocodeTimeout = setTimeout(async () => {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json?access_token=${Config.MAPBOX_TOKEN}&country=us&types=address,poi`;
        try {
            AppState.frontEndApiUsage.geocode++;
            const res = await fetch(url);
            const data = await res.json();
            AppState.latestSuggestions[type] = data.features.length > 0 ? data.features[0] : null;
            renderAutocomplete(data.features, e.target, type);
        } catch (err) { console.error("Autocomplete Error:", err); }
    }, 300);
}

function renderAutocomplete(features, inputEl, type) {
    let dropdown = document.getElementById(`autocomplete-${type}`);
    if (!dropdown) {
        dropdown = document.createElement('div'); dropdown.id = `autocomplete-${type}`; dropdown.className = 'autocomplete-dropdown';
        dropdown.style.position = 'absolute'; dropdown.style.background = 'var(--bg-panel)'; dropdown.style.border = '1px solid var(--border-color)';
        dropdown.style.zIndex = '1000'; dropdown.style.width = '100%'; dropdown.style.maxHeight = '200px'; dropdown.style.overflowY = 'auto';
        dropdown.style.borderRadius = '4px'; dropdown.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        inputEl.parentNode.appendChild(dropdown);
    }
    dropdown.innerHTML = '';
    if (features.length === 0) return;
    
    features.forEach(f => {
        const item = document.createElement('div');
        item.style.padding = '8px 10px'; item.style.cursor = 'pointer'; item.style.borderBottom = '1px solid var(--border-color)';
        item.style.color = 'var(--text-main)'; item.style.fontSize = '13px'; item.innerText = f.place_name;
        
        item.onmouseenter = () => item.style.background = 'var(--bg-hover)';
        item.onmouseleave = () => item.style.background = 'transparent';
        item.onmousedown = (e) => {
            e.preventDefault(); 
            AppState.latestSuggestions[type] = f; 
            inputEl.value = f.place_name; dropdown.innerHTML = '';
            selectEndpoint(type, f.place_name, f.center[1], f.center[0], inputEl);
        };
        dropdown.appendChild(item);
    });
}

async function selectEndpoint(type, address, lat, lng, inputEl) {
    const inspId = Config.isManagerView ? AppState.currentInspectorFilter : Config.driverParam;
    const insp = AppState.inspectors.find(i => String(i.id) === String(inspId));
    
    let epObj = { address, lat, lng };
    if (type === 'start') AppState.routeStart = epObj;
    if (type === 'end') AppState.routeEnd = epObj;

    if (insp) {
        if (type === 'start') { insp.startAddress = address; insp.startLat = lat; insp.startLng = lng; }
        if (type === 'end') { insp.endAddress = address; insp.endLat = lat; insp.endLng = lng; }
    }
    
    markRouteDirty('endpoints', 0); 
    triggerFullRender();
    silentSaveRouteState();
    saveEndpointToBackend(type, address, lat, lng);
}

async function saveEndpointToBackend(type, address, lat, lng) {
    const inspId = Config.isManagerView ? AppState.currentInspectorFilter : Config.driverParam;
    const activeStops = AppState.stops.filter(s => isActiveStop(s, Config.isManagerView));
    const hasRouted = activeStops.some(s => String(s.driverId) === String(inspId) && isRouteAssigned(s.status));
    
    pushToHistory(); showOverlay();
    let payload = { action: hasRouted ? 'updateEndpoint' : 'updateInspectorDefault', type, address, lat, lng, driverId: inspId };
    if (!Config.isManagerView) payload.routeId = Config.routeId; 
    
    try {
        const res = await apiFetch(payload);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
    } catch (e) {
        console.error("Endpoint update failed:", e);
        await customAlert("Failed to sync new address to server. Ensure connection is stable.");
    } finally { hideOverlay(); }
}

// ---------------------------------------------------------
// CRITICAL REPAIR: RESTORED DOM AND PURE UI BINDINGS
// ---------------------------------------------------------

window.setDisplayMode = function(mode) {
    AppState.currentDisplayMode = mode;
    document.querySelectorAll('.stop-item:not(.static-endpoint), .glide-row').forEach(el => { el.classList.remove('compact', 'detailed'); el.classList.add(mode); });
    document.body.classList.remove('display-compact', 'display-detailed');
    document.body.classList.add(`display-${mode}`);
};

window.setRouteViewFilter = function(val) {
    AppState.currentRouteViewFilter = val;
    document.getElementById('view-rall-btn')?.classList.toggle('active', val === 'all');
    for(let i=0; i<=2; i++) document.getElementById(`view-r${i}-btn`)?.classList.toggle('active', val === i);
    if (val !== 'all') {
        const hiddenIds = [];
        AppState.selectedIds.forEach(id => {
            const s = AppState.stops.find(st => String(st.id) === String(id));
            if (s && isRouteAssigned(s.status) && s.cluster !== 'X' && String(s.cluster) !== String(val)) hiddenIds.push(id);
        });
        hiddenIds.forEach(id => AppState.selectedIds.delete(id));
    }
    triggerFullRender();
};

window.handleInspectorFilterChange = function(val) {
    AppState.currentInspectorFilter = val; sessionStorage.setItem('sproute_inspector_filter', val);
    document.body.classList.toggle('manager-all-inspectors', val === 'all'); document.body.classList.toggle('manager-single-inspector', val !== 'all');
    AppState.selectedIds.clear(); AppState.currentRouteViewFilter = 'all';
    document.getElementById('view-rall-btn')?.classList.add('active');
    for(let i=0; i<=2; i++) document.getElementById(`view-r${i}-btn`)?.classList.remove('active');
    
    // --- STATE MEMORY SYNC ---
    let maxCluster = 0;
    if (val !== 'all') {
        AppState.stops.forEach(s => {
            if (String(s.driverId) === String(val) && isRouteAssigned(s.status) && s.cluster !== 'X') {
                let c = parseInt(s.cluster);
                if (!isNaN(c) && c > maxCluster) maxCluster = c;
            }
        });
    } else {
        AppState.stops.forEach(s => {
            if (isRouteAssigned(s.status) && s.cluster !== 'X') {
                let c = parseInt(s.cluster);
                if (!isNaN(c) && c > maxCluster) maxCluster = c;
            }
        });
    }
    
    AppState.currentRouteCount = Math.max(1, maxCluster + 1);
    document.body.setAttribute('data-route-count', AppState.currentRouteCount);
    
    for(let i=1; i<=3; i++) {
        const btn = document.getElementById(`rbtn-${i}`);
        if(btn) btn.classList.toggle('active', i === AppState.currentRouteCount);
    }
    updatePrioritySliderUI(); 
    // -------------------------

    updateInspectorDropdown(); 
    updateRouteButtonColors(); triggerFullRender();
};

window.toggleSelectAll = function(cb) {
    AppState.selectedIds.clear();
    if (cb.checked) AppState.stops.filter(s => isStopVisible(s, true, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteViewFilter)).forEach(s => AppState.selectedIds.add(s.id));
    updateSelectionUI();
};

window.handleInspectorChange = async function(e, rowId, selectEl) {
    e.stopPropagation(); 
    const newDriverId = selectEl.value; const newDriverName = selectEl.options[selectEl.selectedIndex].text;
    let idsToUpdate = [rowId];
    if (AppState.selectedIds.has(rowId) && AppState.selectedIds.size > 1) {
        if (await customConfirm(`Reassign all ${AppState.selectedIds.size} selected orders to ${newDriverName}?`)) idsToUpdate = Array.from(AppState.selectedIds); else return;
    }
    pushToHistory(); showOverlay();
    
    let affectedDrivers = new Set();
    affectedDrivers.add(String(newDriverId)); 
    
    try { 
        idsToUpdate.forEach(id => {
            const s = AppState.stops.find(st => String(st.id) === String(id));
            if (s) {
                if (s.driverId) affectedDrivers.add(String(s.driverId)); 
                if (isRouteAssigned(s.status)) markRouteDirty(s.driverId, s.cluster); 
                s.driverName = newDriverName; s.driverId = newDriverId; s.status = 'Pending'; s.routeState = 'Pending'; s.cluster = 'X'; s.manualCluster = false; s.eta = ''; s.dist = 0; s.durationSecs = 0;
            }
        });
        let payload = { action: 'updateMultipleOrders', updatesList: idsToUpdate.map(id => ({ rowId: id })), sharedUpdates: { driverName: newDriverName, driverId: newDriverId, status: 'P', eta: '', dist: 0, durationSecs: 0, routeNum: 'X', cluster: 'X' }, adminId: Config.adminParam };
        if (!Config.isManagerView) payload.routeId = Config.routeId;
        
        await apiFetch(payload); 
        AppState.selectedIds.clear(); 
        updateInspectorDropdown(); 
        triggerFullRender(); 
        
        affectedDrivers.forEach(dId => silentSaveRouteState(dId));
    } catch (err) { 
        hideOverlay(); await customAlert("Error reassigning orders. Please try again."); 
    } finally { 
        hideOverlay(); 
    }
};

window.clearSelection = function() {
    AppState.selectedIds.clear();
    updateSelectionUI();
};

window.openNav = function(e, la, ln, addr) { 
    e.stopPropagation(); 
    let p = localStorage.getItem('navPref'); 
    if (!p) { 
        const m = document.getElementById('modal-overlay'); 
        m.style.display = 'flex'; 
        document.getElementById('modal-content').innerHTML = `<div style="background: var(--bg-panel); padding: 20px; border-radius: 8px; width: 400px; max-width: 90%; color: var(--text-main); text-align: left; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin: auto;"><h3 style="margin-top:0; font-weight:400;">Maps Preference:</h3><div style="display:flex; flex-direction:column; gap:8px;"><button class="modal-primary-btn" onclick="setNavPref('google','${la}','${ln}','${(addr||'').replace(/'/g,"\\'")}')">Google Maps</button><button style="padding:10px 24px; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-hover); color:var(--text-main); cursor:pointer; font-weight:400;" onclick="setNavPref('apple','${la}','${ln}','${(addr||'').replace(/'/g,"\\'")}')">Apple Maps</button></div></div>`; 
    } else { 
        window.launchMaps(p, la, ln, addr); 
    } 
};
window.setNavPref = function(p, la, ln, addr) { localStorage.setItem('navPref', p); document.getElementById('modal-overlay').style.display = 'none'; window.launchMaps(p, la, ln, addr); };
window.launchMaps = function(p, la, ln, addr) { let safeAddr = encodeURIComponent(addr || "Destination"); if (p === 'google') window.location.href = `comgooglemaps://?daddr=${la},${ln}+(${safeAddr})&directionsmode=driving`; else window.location.href = `http://maps.apple.com/?daddr=${la},${ln}&dirflg=d`; };

window.handleEndpointInput = handleEndpointInput;
window.handleEndpointKeyDown = function(e, type) { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } };
window.handleEndpointBlur = function(type, inputEl) { setTimeout(() => { document.getElementById(`autocomplete-${type}`)?.remove(); }, 200); };
window.resetMapView = resetMapBounds;
window.prevMobilePreview = prevMobilePreview;
window.nextMobilePreview = nextMobilePreview;

window.filterListDOM = function(val) {
    window.lastAddressSearchValue = val; 
    const q = val.toLowerCase();
    document.querySelectorAll('.stop-item, .glide-row').forEach(el => {
        const searchAttr = el.getAttribute('data-search') || '';
        el.style.display = searchAttr.includes(q) ? 'flex' : 'none';
    });
    const clearIcon = document.getElementById('clear-search-icon');
    const glassIcon = document.getElementById('search-glass-icon');
    const inspClearIcon = document.getElementById('inspector-clear-search-icon');
    if(clearIcon) clearIcon.style.display = q ? 'block' : 'none';
    if(glassIcon) glassIcon.style.display = q ? 'none' : 'block';
    if(inspClearIcon) inspClearIcon.style.display = q ? 'block' : 'none';
    filterMarkersMap(q);
};

window.clearAddressSearch = function() {
    window.lastAddressSearchValue = '';
    const inp = document.getElementById('address-search-input');
    const inspInp = document.getElementById('inspector-search-input');
    if(inp) inp.value = '';
    if(inspInp) inspInp.value = '';
    window.filterListDOM('');
};

const mainDropzone = document.getElementById('main-dropzone'); 
const mainInput = document.getElementById('main-file-input');
const hiddenFileInput = document.getElementById('hidden-global-file-input');

function handleFileSelection(file) {
    if (AppState.inspectors.length === 0 || AppState.availableCsvTypes.length === 0) { 
        customAlert("Before you can upload your first CSV file, you need to set up your Inspector and CSV Column Matching Settings.")
        .then(() => {
            window.top.location.href = "https://sproute.glide.page/dl/012f16/m/55cb4d";
        });
        return; 
    }
    if (file.name.toLowerCase().endsWith('.csv')) showUploadModal(file); else customAlert("Please upload a valid CSV file.");
}

if (mainDropzone && mainInput) {
    mainDropzone.onclick = () => mainInput.click();
    mainDropzone.ondragover = (e) => { e.preventDefault(); mainDropzone.style.borderColor = 'var(--accent)'; mainDropzone.style.backgroundColor = 'var(--bg-hover)'; };
    mainDropzone.ondragleave = (e) => { e.preventDefault(); mainDropzone.style.borderColor = 'var(--border-color)'; mainDropzone.style.backgroundColor = 'transparent'; };
    mainDropzone.ondrop = (e) => { e.preventDefault(); mainDropzone.style.borderColor = 'var(--border-color)'; mainDropzone.style.backgroundColor = 'transparent'; if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]); };
    mainInput.onchange = (e) => { if (e.target.files && e.target.files.length > 0) { handleFileSelection(e.target.files[0]); mainInput.value = ''; } };
}

if (hiddenFileInput) {
    hiddenFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
            hiddenFileInput.value = '';
        }
    });
}

let dragCounter = 0;
document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) document.body.classList.add('drag-override-empty');
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) document.body.classList.remove('drag-override-empty');
});

document.addEventListener('dragover', (e) => { e.preventDefault(); });

document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    document.body.classList.remove('drag-override-empty');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]);
});

const resizerEl = document.getElementById('resizer'); const sidebarEl = document.getElementById('sidebar'); const mapWrapEl = document.getElementById('map-wrapper');
let isResizing = false;
function startResize(e) { 
    if(!Config.isManagerView || Config.viewMode === 'managersmall') return; 
    if (e && e.cancelable && e.type !== 'touchstart') e.preventDefault();
    isResizing = true; 
    resizerEl.classList.add('active'); 
    document.body.style.cursor = 'col-resize'; 
    document.body.style.userSelect = 'none';
    mapWrapEl.style.pointerEvents = 'none'; 
}
if(resizerEl) {
    resizerEl.addEventListener('mousedown', startResize); resizerEl.addEventListener('touchstart', (e) => { startResize(e.touches[0]); }, {passive: false});
}

function performResize(e) {
    if (!isResizing) return;
    let clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0); 
    
    let newWidth = window.innerWidth - clientX; 
    
    let maxListWidth = Math.max(450, window.innerWidth - 620);
    if (newWidth > maxListWidth) newWidth = maxListWidth;
    if (newWidth < 450) newWidth = 450;
    
    sidebarEl.style.width = newWidth + 'px';
    
    const hlZone = document.getElementById('header-list-zone');
    if (hlZone) hlZone.style.width = newWidth + 'px';
}

document.addEventListener('mousemove', performResize); document.addEventListener('touchmove', performResize, {passive: false});
function stopResize() { 
    if (isResizing) { 
        isResizing = false; 
        document.body.style.cursor = ''; 
        document.body.style.userSelect = '';
        resizerEl.classList.remove('active'); 
        mapWrapEl.style.pointerEvents = 'auto'; 
        resizeMap(); 
    } 
}
document.addEventListener('mouseup', stopResize); document.addEventListener('touchend', stopResize);

window.currentMobileMapMode = 'pan';
window.handleMapModeChange = function(mode) {
    if (mode !== window.currentMobileMapMode) {
        if (typeof window.toggleMobileLasso === 'function') window.toggleMobileLasso();
        window.currentMobileMapMode = mode;
    }
};

window.syncBodyHeight = function() {
    const urlParams = new URLSearchParams(window.location.search);
    let viewParam = urlParams.get('view');
    
    if (!viewParam) viewParam = 'inspector';
    
    const isMobile = viewParam === 'managersmall' || document.body.classList.contains('view-managersmall');
    const isInspector = viewParam === 'inspector' || document.body.classList.contains('view-inspector');
    
    if (isMobile) {
        document.body.style.height = ''; 
    } else if (isInspector) {
        document.body.style.height = window.innerHeight + 'px';
    } else {
        document.body.style.height = (window.innerHeight - 320) + 'px';
    }
    
    const mapWrapper = document.getElementById('map-wrapper');
    const sidebar = document.getElementById('sidebar');
    if (mapWrapper) mapWrapper.style.minHeight = '0';
    if (sidebar) sidebar.style.minHeight = '0';
    
    if (typeof adjustSummaryTextSize === 'function') adjustSummaryTextSize();
}

window.addEventListener('resize', window.syncBodyHeight);
document.addEventListener('DOMContentLoaded', window.syncBodyHeight);
window.syncBodyHeight();
