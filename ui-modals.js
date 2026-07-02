/* Dashboard - V1.1 */
/* FILE: ui-modals.js */
/* Changes: */
/* 1. Added logic in handleOpenEmailModal to hide unrouted (Pending/Failed) map markers right before the html2canvas map snapshot is taken, and restore them right after. */

import { AppState, Config, apiFetch, loadData } from './app.js';
import { isTrueInspector, isStopVisible, isRouteAssigned } from './logic.js';
import { getMapInstance } from './map.js';
import { triggerFullRender } from './app.js';
import { updateInspectorDropdown } from './ui.js';

export function showOverlay(title = "Processing...", subtext = "Syncing data with the server") {
    const overlay = document.getElementById('processing-overlay');
    if (overlay) {
        const titleEl = overlay.querySelector('.loading-text');
        const subtextEl = overlay.querySelector('.loading-subtext');
        if (titleEl) titleEl.innerText = title;
        if (subtextEl) subtextEl.innerText = subtext;
        overlay.style.display = 'flex';
    }
}

export function hideOverlay() {
    const overlay = document.getElementById('processing-overlay');
    if (overlay) overlay.style.display = 'none';
}

export function customAlert(msg) {
    return new Promise(resolve => {
        const m = document.getElementById('modal-overlay');
        const mc = document.getElementById('modal-content');
        mc.style.padding = '0'; mc.style.background = 'transparent'; mc.style.border = 'none';
        m.style.display = 'flex';
        mc.innerHTML = `
            <div style="background: var(--bg-panel); padding: 20px; border-radius: 8px; width: 400px; max-width: 90%; color: var(--text-main); text-align: left; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin: auto;">
                <h3 style="margin-top:0; font-weight: 400;">Alert</h3>
                <p style="font-size: 15px; margin-bottom: 20px; font-weight: 400; line-height: 1.5;">${msg}</p>
                <div style="display:flex; justify-content:flex-end;">
                    <button class="modal-primary-btn" id="modal-alert-ok">OK</button>
                </div>
            </div>`;
        document.getElementById('modal-alert-ok').onclick = () => { m.style.display = 'none'; resolve(); };
    });
}

export function nonDestructiveAlert(msg) {
    return new Promise(resolve => {
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:2147483647; display:flex;";
        alertDiv.innerHTML = `
            <div style="background: var(--bg-panel); padding: 20px; border-radius: 8px; width: 400px; max-width: 90%; color: var(--text-main); text-align: left; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin: auto;">
                <h3 style="margin-top:0; font-weight: 400;">Alert</h3>
                <p style="font-size: 15px; margin-bottom: 20px; font-weight: 400; line-height: 1.5;">${msg}</p>
                <div style="display:flex; justify-content:flex-end;">
                    <button class="modal-primary-btn" id="temp-alert-ok">OK</button>
                </div>
            </div>`;
        document.body.appendChild(alertDiv);
        document.getElementById('temp-alert-ok').onclick = () => {
            alertDiv.remove();
            resolve();
        };
    });
}

export function customConfirm(msg) {
    return new Promise(resolve => {
        const m = document.getElementById('modal-overlay');
        const mc = document.getElementById('modal-content');
        mc.style.padding = '0'; mc.style.background = 'transparent'; mc.style.border = 'none';
        m.style.display = 'flex';
        mc.innerHTML = `
            <div style="background: var(--bg-panel); padding: 20px; border-radius: 8px; width: 400px; max-width: 90%; color: var(--text-main); text-align: left; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin: auto;">
                <h3 style="margin-top:0; font-weight: 400;">Confirm</h3>
                <p style="font-size: 15px; margin-bottom: 20px; font-weight: 400;">${msg}</p>
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button style="padding:10px 20px; border: 1px solid var(--border-color); border-radius:6px; background:var(--bg-hover); color:var(--text-main); cursor:pointer; font-weight: 400;" id="modal-confirm-cancel">Cancel</button>
                    <button class="modal-primary-btn" id="modal-confirm-ok">OK</button>
                </div>
            </div>`;
        document.getElementById('modal-confirm-ok').onclick = () => { m.style.display = 'none'; resolve(true); };
        document.getElementById('modal-confirm-cancel').onclick = () => { m.style.display = 'none'; resolve(false); };
    });
}

export function showAddOrderModal() {
    const m = document.getElementById('modal-overlay'); const mc = document.getElementById('modal-content');
    mc.style.padding = '0'; mc.style.background = 'transparent'; mc.style.border = 'none';

    let isIndividual = document.body.classList.contains('tier-individual');
    let selectedInspector = isIndividual ? (Config.adminParam || Config.driverParam) : (Config.isManagerView && AppState.currentInspectorFilter !== 'all' ? AppState.currentInspectorFilter : (!Config.isManagerView ? Config.driverParam : null));
    let selectedApp = null;

    let inspectorHtml = '';
    if (Config.isManagerView && !isIndividual) {
        let inspBtns = AppState.inspectors.filter(i => isTrueInspector(i.isInspector)).map(insp => {
            let activeClass = (AppState.currentInspectorFilter !== 'all' && String(insp.id) === String(AppState.currentInspectorFilter)) ? 'active' : '';
            return `<div class="pill-btn add-insp-pill ${activeClass}" data-val="${insp.id}">${insp.name}</div>`;
        }).join('');
        inspectorHtml = `<div class="form-group"><label>Inspector <span style="color: var(--red); font-size: 11px; margin-left: 6px; opacity: 0.8; font-weight: normal;">(Required)</span></label><div style="display: flex; gap: 10px; flex-wrap: wrap;" id="add-insp-container">${inspBtns}</div></div>`;
    }

    let appBtns = AppState.availableCsvTypes.map(app => `<div class="pill-btn add-app-pill" data-val="${app}">${app}</div>`).join('');
    let appHtml = `<div class="form-group"><label>App</label><div style="display: flex; gap: 10px; flex-wrap: wrap;" id="add-app-container">${appBtns}</div></div>`;

    mc.innerHTML = `
        <div style="background: var(--bg-panel); padding: 24px; border-radius: 8px; width: 600px; max-width: 90%; color: var(--text-main); text-align: left; box-sizing: border-box; font-family: sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;"><h3 style="margin: 0; font-size: 18px; font-weight: 400;">Add Order</h3><i class="fa-solid fa-xmark" style="cursor:pointer; color: var(--text-muted); font-size: 20px;" id="add-close-icon"></i></div>
            ${inspectorHtml} ${appHtml}
            <div class="form-group"><label>Address <span style="color: var(--red); font-size: 11px; margin-left: 6px; opacity: 0.8; font-weight: normal;">(Required)</span></label><input type="text" id="add-address" class="form-control" placeholder="123 Main St, City, ST 12345"></div>
            <div class="grid-2-col">
                <div class="form-group"><label>Latitude</label><input type="number" step="any" id="add-lat" class="form-control" placeholder="e.g. 32.776"></div>
                <div class="form-group"><label>Longitude</label><input type="number" step="any" id="add-lng" class="form-control" placeholder="e.g. -96.797"></div>
            </div>
            <div class="form-group"><label>Due Date <span style="color: var(--red); font-size: 11px; margin-left: 6px; opacity: 0.8; font-weight: normal;">(Required)</span></label><input type="date" id="add-due" class="form-control" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="grid-2-col">
                <div class="form-group"><label>Client</label><input type="text" id="add-client" class="form-control" placeholder="Client Name"></div>
                <div class="form-group"><label>Order Type</label><input type="text" id="add-type" class="form-control" placeholder="e.g. Install"></div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-start; margin-top: 10px;">
                <button id="btn-submit-add" class="modal-primary-btn" disabled>Add Order</button>
                <button id="btn-cancel-add" style="padding: 10px 24px; background: transparent; color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px; font-size: 14px; font-weight: 400; cursor: pointer; transition: 0.2s;">Cancel</button>
            </div>
        </div>`;
    m.style.display = 'flex';

    const checkValidity = () => {
        const btn = document.getElementById('btn-submit-add');
        if (selectedInspector && document.getElementById('add-address').value.trim() && document.getElementById('add-due').value) {
            btn.disabled = false;
        } else { btn.disabled = true; }
    };

    document.querySelectorAll('.add-insp-pill').forEach(el => { el.onclick = () => { document.querySelectorAll('.add-insp-pill').forEach(e => e.classList.remove('active')); el.classList.add('active'); selectedInspector = el.getAttribute('data-val'); checkValidity(); }; });
    document.querySelectorAll('.add-app-pill').forEach(el => { el.onclick = () => { if (el.classList.contains('active')) { el.classList.remove('active'); selectedApp = null; } else { document.querySelectorAll('.add-app-pill').forEach(e => e.classList.remove('active')); el.classList.add('active'); selectedApp = el.getAttribute('data-val'); } checkValidity(); }; });
    document.getElementById('add-address').addEventListener('input', checkValidity); document.getElementById('add-due').addEventListener('input', checkValidity);
    document.getElementById('add-close-icon').onclick = () => m.style.display = 'none'; document.getElementById('btn-cancel-add').onclick = () => m.style.display = 'none';

    document.getElementById('btn-submit-add').onclick = () => {
        m.style.display = 'none';
        const file = new File([['Address', 'Latitude', 'Longitude', 'Due Date', 'Client', 'Order Type'].join(',') + '\n' + [document.getElementById('add-address').value.trim(), document.getElementById('add-lat').value, document.getElementById('add-lng').value, document.getElementById('add-due').value, document.getElementById('add-client').value.trim(), document.getElementById('add-type').value.trim()].map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(',')], "manual_order.csv", { type: "text/csv" });

        const uploadEvent = new CustomEvent('sproute-trigger-upload', {
            detail: { file: file, inspectorId: selectedInspector, csvType: selectedApp || '' }
        });
        document.dispatchEvent(uploadEvent);
    };
    checkValidity();
}

export function showUploadModal(file) {
    const m = document.getElementById('modal-overlay'); const mc = document.getElementById('modal-content');
    mc.style.padding = '0'; mc.style.background = 'transparent'; mc.style.border = 'none';

    let isIndividual = document.body.classList.contains('tier-individual');
    let selectedInspector = isIndividual ? (Config.adminParam || Config.driverParam) : (Config.isManagerView && AppState.currentInspectorFilter !== 'all' ? AppState.currentInspectorFilter : (!Config.isManagerView ? Config.driverParam : null));
    let selectedCsvType = null;

    let inspectorHtml = '';
    if (Config.isManagerView && !isIndividual) {
        let inspBtns = AppState.inspectors.filter(i => isTrueInspector(i.isInspector)).map(insp => {
            let activeClass = (AppState.currentInspectorFilter !== 'all' && String(insp.id) === String(AppState.currentInspectorFilter)) ? 'active' : '';
            return `<div class="pill-btn insp-pill ${activeClass}" data-val="${insp.id}">${insp.name}</div>`;
        }).join('');
        inspectorHtml = `<div style="margin-bottom: 20px;"><div style="font-size: 14px; color: var(--text-muted); margin-bottom: 8px; font-weight: 400;">Inspector</div><div style="display: flex; gap: 10px; flex-wrap: wrap;" id="upload-insp-container">${inspBtns}</div></div>`;
    }

    let appBtns = AppState.availableCsvTypes.map(app => `<div class="pill-btn app-pill" data-val="${app}">${app}</div>`).join('');

    mc.innerHTML = `
        <div style="background: var(--bg-panel); padding: 24px; border-radius: 8px; width: 500px; max-width: 90%; color: var(--text-main); text-align: left; box-sizing: border-box; font-family: sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;"><h3 style="margin: 0; font-size: 18px; font-weight: 400;">CSV Import: ${file.name}</h3><i class="fa-solid fa-xmark" style="cursor:pointer; color: var(--text-muted); font-size: 20px;" id="upload-close-icon"></i></div>
            ${inspectorHtml}
            <div style="margin-bottom: 30px;"><div style="font-size: 14px; color: var(--text-muted); margin-bottom: 8px; font-weight: 400;">App</div><div style="display: flex; gap: 10px; flex-wrap: wrap;" id="upload-app-container">${appBtns}</div></div>
            <div style="display: flex; gap: 12px; justify-content: flex-start;">
                <button id="btn-submit-upload" class="modal-primary-btn" disabled>Submit</button>
                <button id="btn-cancel-upload" style="padding: 10px 24px; background: transparent; color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px; font-size: 14px; font-weight: 400; cursor: pointer; transition: 0.2s;">Cancel</button>
            </div>
        </div>`;
    m.style.display = 'flex';

    const checkValidity = () => {
        const btn = document.getElementById('btn-submit-upload');
        if (selectedInspector && selectedCsvType) { btn.disabled = false; }
        else { btn.disabled = true; }
    };

    document.querySelectorAll('.insp-pill').forEach(el => { el.onclick = () => { document.querySelectorAll('.insp-pill').forEach(e => e.classList.remove('active')); el.classList.add('active'); selectedInspector = el.getAttribute('data-val'); checkValidity(); }; });
    document.querySelectorAll('.app-pill').forEach(el => { el.onclick = () => { document.querySelectorAll('.app-pill').forEach(e => e.classList.remove('active')); el.classList.add('active'); selectedCsvType = el.getAttribute('data-val'); checkValidity(); }; });
    document.getElementById('upload-close-icon').onclick = () => m.style.display = 'none'; document.getElementById('btn-cancel-upload').onclick = () => m.style.display = 'none';

    document.getElementById('btn-submit-upload').onclick = () => {
        m.style.display = 'none';

        const uploadEvent = new CustomEvent('sproute-trigger-upload', {
            detail: { file: file, inspectorId: selectedInspector, csvType: selectedCsvType }
        });
        document.dispatchEvent(uploadEvent);
    };
}

export function handleOpenEmailModal() {
    if (AppState.currentRouteViewFilter !== 'all') { window.setRouteViewFilter('all'); }
    const insp = AppState.inspectors.find(i => String(i.id) === String(AppState.currentInspectorFilter));
    if (!insp) return;

    const m = document.getElementById('modal-overlay'); const mc = document.getElementById('modal-content');
    mc.style.padding = '0'; mc.style.background = 'transparent'; mc.style.border = 'none'; m.style.display = 'flex';

    let inspEmail = (insp.email || '').toLowerCase().trim();
    let compEmail = (AppState.companyEmail || '').toLowerCase().trim();
    let adminEmail = (AppState.adminEmail || '').toLowerCase().trim();

    let ccCompanyHtml = '';
    if (compEmail && inspEmail !== compEmail) {
        ccCompanyHtml = `<div style="margin-bottom: 24px; display: flex; align-items: flex-start; gap: 10px;"><input type="checkbox" id="cc-company-checkbox" ${AppState.ccCompanyDefault ? 'checked' : ''} style="margin-top: 4px; transform: scale(1.2);"><label for="cc-company-checkbox" style="font-size: 16px; cursor: pointer; color: var(--text-main);">CC the Company Email<br><span style="font-size: 14px; color: var(--text-muted);">${AppState.companyEmail}</span></label></div>`;
    }

    let ccMeHtml = '';
    if (adminEmail && inspEmail !== adminEmail && adminEmail !== compEmail) {
        ccMeHtml = `<div style="margin-bottom: 24px; display: flex; align-items: flex-start; gap: 10px;"><input type="checkbox" id="cc-me-checkbox" checked style="margin-top: 4px; transform: scale(1.2);"><label for="cc-me-checkbox" style="font-size: 16px; cursor: pointer; color: var(--text-main);">CC Me<br><span style="font-size: 14px; color: var(--text-muted);">${AppState.adminEmail}</span></label></div>`;
    }

    mc.innerHTML = `
        <style>
            #email-body-text::-webkit-scrollbar {
                width: 8px;
                background-color: var(--bg-panel);
            }
            #email-body-text::-webkit-scrollbar-thumb {
                background-color: var(--row-text-muted);
                border-radius: 4px;
            }
            #email-body-text::-webkit-scrollbar-track {
                background-color: var(--bg-base);
                border-radius: 4px;
            }
        </style>
        <div style="background: var(--bg-panel); padding: 24px; border-radius: 8px; width: 600px; max-width: 90%; color: var(--text-main); text-align: left; box-sizing: border-box; font-family: sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin: auto;">
            <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 400;">Customize Email Message</h3>
            <textarea id="email-body-text" style="width: 100%; min-height: 150px; background: var(--bg-base); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; font-family: inherit; font-size: 15px; line-height: 1.5; margin-bottom: 24px; box-sizing: border-box; resize: none; overflow-y: auto;">${AppState.defaultEmailMessage}</textarea>
            <div style="background: var(--bg-hover); border: 1px solid var(--border-color); padding: 16px; border-radius: 6px; font-size: 15px; color: var(--text-main); margin-bottom: 24px; line-height: 1.5;">A list of orders and the map image will be sent to <span style="color: var(--accent); font-weight: 400;">${insp.name}</span> at <span style="color: var(--accent); font-weight: 400;">${insp.email || '[Email not provided]'}</span>, along with a direct link to open the interactive map on their device.</div>
            ${ccCompanyHtml}
            ${ccMeHtml}
            <div style="margin-bottom: 24px; display: flex; flex-direction: column; gap: 10px;"><label for="additional-cc-email" style="font-size: 16px; color: var(--text-main);">Additional CC</label><input type="email" id="additional-cc-email" placeholder="email@example.com" style="width: 100%; background: var(--bg-base); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px 12px; font-size: 15px; box-sizing: border-box;"></div>
            <div style="display: flex; gap: 12px; justify-content: flex-start;"><button id="btn-submit-dispatch" class="modal-primary-btn">Submit</button><button id="btn-cancel-dispatch" style="padding: 12px 24px; background: transparent; color: var(--text-main); border: 1px solid var(--border-color); border-radius: 6px; font-size: 15px; font-weight: 400; cursor: pointer; transition: 0.2s;">Cancel</button></div>
        </div>`;

    const emailBody = document.getElementById('email-body-text');
    if (emailBody && Config.viewMode === 'managersmall') {
        emailBody.style.height = 'auto';
        emailBody.style.height = (emailBody.scrollHeight) + 'px';
        emailBody.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }

    document.getElementById('btn-cancel-dispatch').onclick = () => m.style.display = 'none';

    document.getElementById('btn-submit-dispatch').onclick = async () => {
        const btn = document.getElementById('btn-submit-dispatch');
        btn.innerText = 'Dispatching...'; btn.disabled = true;

        const mapContainer = document.getElementById('map-container');

        // Force map container to display so html2canvas can read it even if in mobile list view
        const isMobileListHidden = window.getComputedStyle(mapContainer).display === 'none';
        if (isMobileListHidden) {
            mapContainer.style.setProperty('display', 'flex', 'important');
        }

        const overlaysToHide = mapContainer.querySelectorAll('.map-overlay-btns, #map-hint');
        const unroutedMarkers = mapContainer.querySelectorAll('.marker.pending, .marker.validation-failed, .marker.optimization-failed');

        const originalDisplays = []; overlaysToHide.forEach((el, index) => { originalDisplays[index] = el.style.display; el.style.display = 'none'; });
        const originalMarkerDisplays = []; unroutedMarkers.forEach((el, index) => { originalMarkerDisplays[index] = el.style.display; el.style.display = 'none'; });

        // Add Sproute logo over the Mapbox attribution area
        const sprouteLogoBar = document.createElement('div');
        sprouteLogoBar.style.cssText = 'position: absolute; bottom: 0; left: 0; width: 140px; height: 40px; background-color: #171717; z-index: 10; display: flex; align-items: center; justify-content: center;';
        sprouteLogoBar.innerHTML = `<img src="https://raw.githubusercontent.com/mypieinteractive/Sproute/809b30bc160d3e353020425ce349c77544ed0452/Sproute%20Logo.png" style="height: 22px; opacity: 0.9;">`;
        mapContainer.appendChild(sprouteLogoBar);

        const bounds = new mapboxgl.LngLatBounds();
        let lats = [], lngs = [];
        AppState.stops.filter(s => isStopVisible(s, false, Config.isManagerView, AppState.currentInspectorFilter, AppState.currentRouteViewFilter) && String(s.driverId) === String(AppState.currentInspectorFilter) && isRouteAssigned(s.status)).forEach(s => { if(s.lng && s.lat) { bounds.extend([s.lng, s.lat]); lngs.push(s.lng); lats.push(s.lat); } });

        let finalWidth = 800, finalHeight = 450;
        if (lats.length > 1) {
            const dLat = Math.max(...lats) - Math.min(...lats); const dLng = (Math.max(...lngs) - Math.min(...lngs)) * Math.cos(((Math.max(...lats) + Math.min(...lats)) / 2) * Math.PI / 180);
            if (dLat > 0.00001 && dLng > 0.00001) { let ratio = dLng / dLat; if (ratio > 1) { finalWidth = 800; finalHeight = Math.max(350, Math.floor(800 / ratio)); } else { finalHeight = 800; finalWidth = Math.max(350, Math.floor(800 * ratio)); } }
        }

        const mapWrapper = document.getElementById('map-wrapper');
        const originalWrapperStyle = mapWrapper.style.cssText;
        mapWrapper.style.cssText = `width: ${finalWidth}px !important; height: ${finalHeight}px !important; position: absolute !important; top: 0; left: 0; z-index: 0;`;
        const map = getMapInstance();
        if (map) {
            map.resize(); if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, animate: false });
            await new Promise(resolve => { map.once('idle', resolve); setTimeout(resolve, 1200); });
        }

        let mapBase64 = '';
        try { mapBase64 = (await html2canvas(mapContainer, { useCORS: true, backgroundColor: '#171717', scale: 2 })).toDataURL('image/jpeg', 0.85); } catch(e) { console.error(e); }

        mapWrapper.style.cssText = originalWrapperStyle;
        if (map) { map.resize(); if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 50, animate: false }); }
        
        overlaysToHide.forEach((el, index) => el.style.display = originalDisplays[index]);
        unroutedMarkers.forEach((el, index) => el.style.display = originalMarkerDisplays[index]);
        
        sprouteLogoBar.remove();

        if (isMobileListHidden) {
            mapContainer.style.removeProperty('display');
        }

        let ccCompanyVal = false;
        const ccCompanyEl = document.getElementById('cc-company-checkbox');
        if (ccCompanyEl) ccCompanyVal = ccCompanyEl.checked;

        let addCcVal = '';
        const ccMeEl = document.getElementById('cc-me-checkbox');
        if (ccMeEl && ccMeEl.checked) addCcVal = AppState.adminEmail;

        const effectiveDriverId = Config.isManagerView ? AppState.currentInspectorFilter : Config.driverParam;

        try {
            const res = await apiFetch({
                action: "dispatchRoute",
                driverId: effectiveDriverId,
                companyId: Config.companyParam || '',
                routeId: Config.isManagerView ? null : Config.routeId,
                customBody: document.getElementById('email-body-text').value,
                ccCompany: ccCompanyVal,
                addCc: addCcVal,
                ccEmail: document.getElementById('additional-cc-email').value,
                mapBase64
            });
            const result = await res.json();

            if (result.success) {
                m.style.display = 'none';
                AppState.stops.forEach(s => { if (String(s.driverId) === String(effectiveDriverId) && isRouteAssigned(s.status)) { s.routeState = 'Dispatched'; s.status = 'Dispatched'; } });
                if (Config.isManagerView) {
                    const filterEl = document.getElementById('inspector-filter');
                    if (filterEl) filterEl.value = 'all';

                    window.handleInspectorFilterChange('all');
                } else {
                    triggerFullRender();
                }
                const toast = document.createElement('div'); toast.innerText = 'Route Sent!'; toast.style.cssText = 'position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 12px 24px; border-radius: 20px; font-weight: 400; font-size: 14px; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: opacity 0.3s;'; document.body.appendChild(toast);
                setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 1000);
            } else {
                throw new Error(result.error || result.message || "Dispatch API returned failure status.");
            }
        } catch (e) {
            btn.innerText = 'Submit'; btn.disabled = false;
            // Calls the new nonDestructiveAlert to keep the email text field untouched!
            await nonDestructiveAlert(`Failed to dispatch route: ${e.message}`);
        }
    };
}

export function openUnmatchedModal() {
    const modal = document.getElementById('unmatched-modal');
    document.getElementById('unmatched-modal-title').textContent = `Match Addresses (${AppState.currentUnmatchedIndex + 1} of ${AppState.unmatchedAddressesQueue.length})`;
    document.getElementById('unmatched-original-address').textContent = AppState.unmatchedAddressesQueue[AppState.currentUnmatchedIndex];
    document.getElementById('unmatched-lat').value = '';
    document.getElementById('unmatched-lng').value = '';
    document.getElementById('unmatched-corrected').value = '';
    document.getElementById('unmatched-error').style.display = 'none';
    document.getElementById('btn-unmatched-submit').textContent = 'Match Coordinates';
    modal.style.display = 'flex';
}

export async function nextUnmatchedAddress() {
    AppState.currentUnmatchedIndex++;
    if (AppState.currentUnmatchedIndex < AppState.unmatchedAddressesQueue.length) openUnmatchedModal();
    else {
        document.getElementById('unmatched-modal').style.display = 'none';
        const toast = document.createElement('div'); toast.innerText = 'Address matching complete.'; toast.style.cssText = 'position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 12px 24px; border-radius: 20px; font-weight: 400; font-size: 14px; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: opacity 0.3s;'; document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
        await loadData();
    }
}

// Map handlers to window to ensure global HTML event bindings work
if(typeof window !== "undefined") window.showAddOrderModal = showAddOrderModal;
if(typeof window !== "undefined") window.handleOpenEmailModal = handleOpenEmailModal;

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('unmatched-corrected')) document.getElementById('unmatched-corrected').addEventListener('input', (e) => { document.getElementById('btn-unmatched-submit').textContent = e.target.value.trim() !== '' ? 'Update Address' : 'Match Coordinates'; });
    if (document.getElementById('btn-unmatched-submit')) {
        document.getElementById('btn-unmatched-submit').addEventListener('click', async () => {
            document.getElementById('unmatched-error').style.display = 'none'; document.getElementById('unmatched-loading-overlay').style.display = 'flex';
            try {
                const response = await apiFetch({ action: 'resolveUnmatchedAddress', driverId: AppState.currentUploadDriverId, companyId: Config.companyParam || '', originalAddress: AppState.unmatchedAddressesQueue[AppState.currentUnmatchedIndex], lat: document.getElementById('unmatched-lat').value, lng: document.getElementById('unmatched-lng').value, correctedAddress: document.getElementById('unmatched-corrected').value });
                const result = await response.json();
                document.getElementById('unmatched-loading-overlay').style.display = 'none';
                if (result.success) nextUnmatchedAddress();
                else { document.getElementById('unmatched-error').textContent = result.unresolvable ? 'Address not found. Please try again or enter coordinates.' : (result.error || 'Invalid coordinates provided.'); document.getElementById('unmatched-error').style.display = 'block'; }
            } catch (err) { document.getElementById('unmatched-loading-overlay').style.display = 'none'; document.getElementById('unmatched-error').textContent = 'Network error. Please try again.'; document.getElementById('unmatched-error').style.display = 'block'; }
        });
    }
    if (document.getElementById('btn-unmatched-skip')) {
        document.getElementById('btn-unmatched-skip').addEventListener('click', async () => {
            if (await customConfirm("This order will be removed from the list.\\n\\nPress OK to delete.")) {
                document.getElementById('unmatched-loading-overlay').style.display = 'flex';
                try { await apiFetch({ action: 'resolveUnmatchedAddress', skip: true, driverId: AppState.currentUploadDriverId, originalAddress: AppState.unmatchedAddressesQueue[AppState.currentUnmatchedIndex] }); } catch(e) { console.error("Skip error:", e); }
                document.getElementById('unmatched-loading-overlay').style.display = 'none'; nextUnmatchedAddress();
            }
        });
    }
});
