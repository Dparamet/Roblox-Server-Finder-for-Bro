// ==UserScript==
// @name         Roblox Low Ping Finder (Surgical Optimized)
// @version      7.2
// @description  Full Fix: UI Dropdown + Deep Search Region + Ping Optimized for TH
// @author       D & Gemini Bro
// @match        https://www.roblox.com/games/*
// @connect      roblox.com
// @connect      games.roblox.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    const DASHBOARD_ID = 'rb-lowping-dashboard';
    
    // Mapping ภูมิภาค (Keywords ปรับให้ครอบคลุมตามที่นายเจอจริง)
    const REGION_MAP = {
        'asia-singapore': { label: 'Singapore', code: 'SG', keywords: ['singapore', '|sg|', ' sg ', 'sng', 'sentosa'] },
        'asia-tokyo': { label: 'Tokyo', code: 'JP-TYO', keywords: ['tokyo', 'japan', '|jp|', 'nrt', 'hnd'] },
        'us-ashburn': { label: 'US East (Ashburn)', code: 'US-ASB', keywords: ['ashburn', 'virginia', 'va', 'us-east'] },
        'us-dallas': { label: 'US Central (Dallas)', code: 'US-DAL', keywords: ['dallas', 'texas', 'us-central'] },
        'europe-frankfurt': { label: 'Germany (Frankfurt)', code: 'DE-FRA', keywords: ['frankfurt', 'germany', '|de|', 'fra'] }
    };

    let state = { scanning: false, latestPool: [], filter: 'all', scanToken: 0 };

    // --- Core API Logic ---
    async function fetchData(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET', url, timeout: 12000,
                onload: (res) => res.status < 400 ? resolve(JSON.parse(res.responseText)) : reject('HTTP ' + res.status),
                onerror: reject
            });
        });
    }

    // ระบบตรวจจับ Region แบบ Deep Search (สแกนทุกฟิลด์ใน JSON)
    function detectRegion(server) {
        const rawData = JSON.stringify(server).toLowerCase();
        for (const [tag, info] of Object.entries(REGION_MAP)) {
            if (info.keywords.some(k => rawData.includes(k))) return tag;
        }
        return 'unknown';
    }

    // --- Rendering Logic ---
    function renderResults(ui) {
        const filterValue = String(state.filter).toLowerCase().trim();
        const placeId = window.location.pathname.split('/')[2];

        const filtered = state.latestPool.filter(s => {
            if (filterValue === 'all') return true;
            const sTag = s.regionTag.toLowerCase();
            return sTag === filterValue || sTag.includes(filterValue) || filterValue.includes(sTag);
        }).sort((a, b) => a.ping - b.ping);

        ui.results.innerHTML = filtered.slice(0, 80).map(s => {
            const info = REGION_MAP[s.regionTag] || { code: '??', label: s.regionTag };
            // ไล่สีปิงตามเกรดที่นายบอก (สิงคโปร์เขียว, ญี่ปุ่นเหลือง, ยุโรปแดง)
            const pColor = s.ping <= 95 ? '#00f5c8' : s.ping <= 155 ? '#ffe066' : '#ff8b8b';
            
            return `
                <div class="rb-card" style="background:#2b2d30; padding:12px; border-radius:10px; border:1px solid #3c3f43; width:155px; display:inline-block; margin:6px; font-family:sans-serif;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span style="font-weight:bold; font-size:12px; color:#7ee7ff;">${info.code}</span>
                        <span style="color:${pColor}; font-weight:bold; font-size:13px;">${s.ping}ms</span>
                    </div>
                    <div style="color:#adb5bd; font-size:11px; margin-bottom:5px;">👤 ${s.playing}/${s.maxPlayers} Players</div>
                    <div style="font-size:9px; color:#555; margin-bottom:8px;">Loc: ${s.regionTag}</div>
                    <button onclick="window.location.href='roblox://placeId=${placeId}&gameInstanceId=${s.id}'" 
                            style="width:100%; background:#2f6fff; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:11px; transition:0.2s;">JOIN SERVER</button>
                </div>`;
        }).join('') || `<div style="padding:40px; color:#adb5bd; text-align:center; width:100%;">
                            ไม่พบเซิร์ฟเวอร์ในโซน "${filterValue.toUpperCase()}"<br>
                            <small style="color:#666;">ลองกด Scan อีกรอบ หรือเปลี่ยนเป็น All Regions</small>
                          </div>`;
    }

    // --- Scanning Logic ---
    async function startScan(ui) {
        const placeId = window.location.pathname.split('/')[2];
        if (!placeId || state.scanning) return;

        state.scanning = true;
        state.scanToken++;
        const token = state.scanToken;
        
        ui.scanBtn.disabled = true;
        ui.status.textContent = '🛰️ กำลังค้นหา...';
        ui.results.innerHTML = '';
        state.latestPool = [];

        try {
            let cursor = '';
            for (let i = 0; i < 8; i++) { // สแกน 8 หน้า
                if (!state.scanning || token !== state.scanToken) break;
                ui.bar.style.width = `${((i + 1) / 8) * 100}%`;
                ui.status.textContent = `📡 กำลังอ่านหน้า ${i+1}/8...`;

                const res = await fetchData(`https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100&cursor=${cursor}`);
                if (!res?.data) break;

                const servers = res.data.map(s => ({
                    ...s,
                    regionTag: detectRegion(s),
                    ping: Number(s.ping) || 999
                })).filter(s => s.ping > 0 && s.ping <= 260 && s.playing < s.maxPlayers); // ปรับ Filter ปิงให้เห็นถึงยุโรปตามที่นายบอก

                state.latestPool.push(...servers);
                cursor = res.nextPageCursor;
                if (!cursor) break;
            }
            
            state.latestPool = Array.from(new Map(state.latestPool.map(s => [s.id, s])).values());
            ui.status.textContent = `✅ เจอทั้งหมด ${state.latestPool.length} เซิร์ฟเวอร์`;
            renderResults(ui);
        } catch (e) {
            ui.status.textContent = '❌ Error: ' + e;
        } finally {
            state.scanning = false;
            ui.scanBtn.disabled = false;
        }
    }

    // --- UI Setup ---
    function init() {
        const target = document.querySelector('.server-list-options') || document.querySelector('#rbx-running-games') || document.querySelector('.stack.section');
        if (!target || document.getElementById(DASHBOARD_ID)) return;

        const dashboard = document.createElement('div');
        dashboard.id = DASHBOARD_ID;
        dashboard.style = "background:#1b1d1f; border:1px solid #3c3f43; color:white; padding:20px; border-radius:12px; margin:20px 0; box-shadow: 0 8px 32px rgba(0,0,0,0.5);";
        dashboard.innerHTML = `
            <div style="display:flex; gap:15px; align-items:center; margin-bottom:15px; flex-wrap:wrap;">
                <h3 style="margin:0; font-size:18px; color:#7ee7ff;">🎯 Low Ping Finder</h3>
                <select id="rb-region-select" style="background:#2b2d30; color:white; border:1px solid #4b4f54; padding:8px 15px; border-radius:8px; cursor:pointer; font-size:13px;">
                    <option value="all">-- ทุกโซน (All) --</option>
                    <optgroup label="Asia (70-150ms)">
                        <option value="asia-singapore">Singapore</option>
                        <option value="asia-tokyo">Tokyo</option>
                    </optgroup>
                    <optgroup label="US / Europe (200ms+)">
                        <option value="us-ashburn">Ashburn</option>
                        <option value="us-dallas">Dallas</option>
                        <option value="europe-frankfurt">Frankfurt</option>
                    </optgroup>
                </select>
                <span id="rb-status-text" style="font-size:12px; color:#adb5bd;">พร้อมสแกน</span>
                <button id="rb-btn-scan" style="margin-left:auto; background:#2f6fff; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold; transition:0.3s;">SCAN NOW</button>
            </div>
            <div style="height:8px; background:#111; border-radius:4px; margin-bottom:15px; overflow:hidden;">
                <div id="rb-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg, #00ccff, #00f7c2); transition:0.5s;"></div>
            </div>
            <div id="rb-results-grid" style="display:flex; flex-wrap:wrap; min-height:50px;"></div>
        `;

        target.after(dashboard);

        const ui = {
            dropdown: dashboard.querySelector('#rb-region-select'),
            status: dashboard.querySelector('#rb-status-text'),
            scanBtn: dashboard.querySelector('#rb-btn-scan'),
            bar: dashboard.querySelector('#rb-progress-bar'),
            results: dashboard.querySelector('#rb-results-grid')
        };

        ui.scanBtn.onclick = () => startScan(ui);
        ui.dropdown.onchange = (e) => {
            state.filter = e.target.value;
            if (state.latestPool.length > 0) renderResults(ui);
        };
    }

    const checkExist = setInterval(() => {
        if (document.querySelector('.server-list-options') || document.querySelector('#rbx-running-games')) {
            init();
        }
    }, 2000);
})();