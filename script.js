// ==UserScript==
// @name         🎯 Roblox Low Ping & Capacity Finder v10.0 (Modern UI)
// @version      10.0
// @description  Modern UI with Capacity Filter — Filter by small servers or free slots for your team.
// @author       D & Gemini Bro
// @match        https://www.roblox.com/games/*
// @connect      games.roblox.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    // ==============================
    //  CONFIG & STATE
    // ==============================
    const MAX_PAGES = 6;
    const MAX_PING = 350;
    const THROTTLE_MS = 900;
    const RETRY_ATTEMPTS = 4;
    const RETRY_BASE_DELAY = 1200;

    let state = {
        scanning: false,
        token: 0,
        pool: [],
        sortBy: 'ping',
        filterMode: 'all', // 'all', 'small', 'slots'
        targetCount: 1,    // Number of slots needed
        page: 1,
    };

    const PAGE_SIZE = 50;
    const CACHE_TTL_MS = 45000;
    let cooldownTimer = null;
    const activeRequests = new Set();
    const scanCache = new Map();

    const RATE_LIMIT = { maxScans: 8, windowMs: 60000, scans: [] };

    // ==============================
    //  UTILITIES & RATE LIMIT
    // ==============================
    function canScan() {
        const now = Date.now();
        RATE_LIMIT.scans = RATE_LIMIT.scans.filter(t => now - t < RATE_LIMIT.windowMs);
        return RATE_LIMIT.scans.length < RATE_LIMIT.maxScans;
    }

    function recordScan() { RATE_LIMIT.scans.push(Date.now()); }

    function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    function getPingColor(ping) {
        if (ping <= 80) return '#4CAF50';
        if (ping <= 130) return '#8BC34A';
        if (ping <= 180) return '#ff9800';
        if (ping <= 240) return '#ff7043';
        return '#f44336';
    }

    // ==============================
    //  CORE LOGIC (HTTP & SCAN)
    // ==============================
    function httpGet(url) {
        return new Promise((resolve, reject) => {
            const request = GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 15000,
                headers: {
                    'Accept': 'application/json',
                    'Referer': 'https://www.roblox.com/',
                },
                onload: r => {
                    if (r.status === 429) reject('429');
                    else if (r.status < 400) resolve(JSON.parse(r.responseText));
                    else reject('HTTP_' + r.status);
                },
                onerror: () => reject('NETWORK_ERROR'),
                onabort: () => reject('ABORTED'),
            });
            activeRequests.add(request);
        });
    }

    async function scan(ui, placeId) {
        if (!canScan()) return;

        state.scanning = true;
        state.token++;
        const token = state.token;
        state.pool = [];
        state.page = 1;
        recordScan();

        ui.scanBtn.disabled = true;
        ui.scanBtn.textContent = 'Scanning...';
        ui.bar.style.width = '0%';

        try {
            let cursor = '';
            for (let i = 0; i < MAX_PAGES; i++) {
                if (!state.scanning || token !== state.token) break;
                if (i > 0) await delay(THROTTLE_MS);

                ui.bar.style.width = Math.round(((i + 1) / MAX_PAGES) * 100) + '%';
                ui.status.textContent = `📡 Page ${i + 1}/${MAX_PAGES}...`;

                const res = await httpGet(`https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100&cursor=${cursor}`);
                if (!res?.data) break;

                const servers = res.data.map(s => ({
                    id: s.id,
                    ping: Number(s.ping) || 999,
                    playing: s.playing || 0,
                    maxPlayers: s.maxPlayers || 0,
                    fps: s.fps || 0
                })).filter(s => s.ping <= MAX_PING && s.playing < s.maxPlayers);

                state.pool.push(...servers);
                cursor = res.nextPageCursor || '';
                if (!cursor) break;
            }
            state.pool = [...new Map(state.pool.map(s => [s.id, s])).values()];
            ui.status.textContent = `✅ Found ${state.pool.length} servers`;
            renderResults(ui);
        } catch (e) {
            ui.status.textContent = `❌ Error: ${e}`;
        } finally {
            state.scanning = false;
            ui.scanBtn.disabled = false;
            ui.scanBtn.textContent = '🔍 SCAN';
        }
    }

    // ==============================
    //  RENDER & UI UPDATE
    // ==============================
    function renderResults(ui) {
        let list = [...state.pool];

        // 🔥 Capacity Filter Logic
        list = list.filter(s => {
            const slotsLeft = s.maxPlayers - s.playing;
            if (state.filterMode === 'small') return s.playing <= 3;
            if (state.filterMode === 'slots') return slotsLeft >= state.targetCount;
            return true;
        });

        // Sort Logic
        list.sort((a, b) => {
            if (state.sortBy === 'ping') return a.ping - b.ping;
            return b.playing - a.playing;
        });

        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const start = (state.page - 1) * PAGE_SIZE;
        const pageItems = list.slice(start, start + PAGE_SIZE);
        const placeId = window.location.pathname.split('/')[2];

        ui.results.innerHTML = pageItems.map((s, i) => {
            const pColor = getPingColor(s.ping);
            const slotsLeft = s.maxPlayers - s.playing;
            const fillPct = Math.round((s.playing / s.maxPlayers) * 100);

            return `
            <div class="server-card" style="background:white; border:2px solid #f0f0f0; border-radius:14px; width:200px; padding:16px; display:inline-flex; flex-direction:column; gap:10px; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                <div style="font-size:11px; color:#666; font-weight:600;">ID: ${s.id.slice(0,8)}...</div>
                <div style="display:flex; align-items:baseline; gap:6px;">
                    <span style="font-size:32px; font-weight:700; color:${pColor};">${s.ping}</span>
                    <span style="font-size:12px; color:#999;">ms</span>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:#666; margin-bottom:4px;">
                        <span>👥 ${s.playing}/${s.maxPlayers}</span>
                        <span style="font-weight:700; color:#ff8c42;">Free: ${slotsLeft}</span>
                    </div>
                    <div style="height:6px; background:#e0e0e0; border-radius:3px; overflow:hidden;">
                        <div style="height:100%; width:${fillPct}%; background:${pColor};"></div>
                    </div>
                </div>
                <button onclick="window.location.href='roblox://placeId=${placeId}&gameInstanceId=${s.id}'" style="width:100%; background:${pColor}; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:12px;">JOIN SERVER →</button>
            </div>`;
        }).join('') || '<div style="width:100%; text-align:center; padding:40px; color:#999;">No servers match your filter</div>';

        // Pager Simple Logic
        ui.pager.innerHTML = `<div style="font-size:12px; color:#777;">Showing ${list.length} results | Page ${state.page}/${totalPages}</div>`;
    }

    // ==============================
    //  INITIALIZATION
    // ==============================
    function init() {
        const placeId = window.location.pathname.split('/')[2];
        const anchor = document.querySelector('.server-list-options') || document.querySelector('#rbx-running-games') || document.querySelector('.stack.section');
        if (!anchor || document.getElementById('rb9-root')) return;

        const root = document.createElement('div');
        root.id = 'rb9-root';
        root.style = "background:#fff; border:2px solid #ff8c42; border-radius:18px; padding:25px; margin:20px 0; font-family:'Segoe UI'; box-shadow: 0 10px 30px rgba(255,140,66,0.15);";

        root.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:15px; flex-wrap:wrap;">
                <div style="font-size:20px; font-weight:700; color:#ff8c42;">🎯 SERVER FINDER PRO</div>
                <div id="rb9-status" style="font-size:12px; color:#999;">Ready</div>

                <div style="margin-left:auto; display:flex; gap:8px; align-items:center;">
                    <select id="rb9-filter" style="padding:8px; border-radius:8px; border:1px solid #ddd; font-weight:600;">
                        <option value="all">🌐 All Servers</option>
                        <option value="small">🍃 Small (1-3 pts)</option>
                        <option value="slots">👥 Min Free Slots</option>
                    </select>
                    <input type="number" id="rb9-target" value="1" min="1" style="width:45px; padding:7px; border:1px solid #ddd; border-radius:8px; display:none; font-weight:700;">
                    <select id="rb9-sort" style="padding:8px; border-radius:8px; border:1px solid #ddd; font-weight:600;">
                        <option value="ping">📍 Ping ↑</option>
                        <option value="players">👥 Players ↓</option>
                    </select>
                    <button id="rb9-scan" style="background:#ff8c42; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer; font-weight:700;">🔍 SCAN</button>
                </div>
            </div>
            <div style="height:4px; background:#eee; border-radius:2px; margin-bottom:15px;"><div id="rb9-bar" style="height:100%; width:0%; background:#ff8c42; transition:0.3s;"></div></div>
            <div id="rb9-pager" style="margin-bottom:10px;"></div>
            <div id="rb9-results" style="display:flex; flex-wrap:wrap; gap:12px;"></div>
        `;

        anchor.after(root);

        const ui = {
            scanBtn: root.querySelector('#rb9-scan'),
            status: root.querySelector('#rb9-status'),
            bar: root.querySelector('#rb9-bar'),
            results: root.querySelector('#rb9-results'),
            pager: root.querySelector('#rb9-pager'),
            filter: root.querySelector('#rb9-filter'),
            target: root.querySelector('#rb9-target'),
            sort: root.querySelector('#rb9-sort')
        };

        ui.scanBtn.onclick = () => scan(ui, placeId);
        ui.filter.onchange = (e) => {
            state.filterMode = e.target.value;
            ui.target.style.display = (state.filterMode === 'slots') ? 'inline-block' : 'none';
            if (state.pool.length) renderResults(ui);
        };
        ui.target.oninput = (e) => { state.targetCount = parseInt(e.target.value) || 1; renderResults(ui); };
        ui.sort.onchange = (e) => { state.sortBy = e.target.value; renderResults(ui); };
    }

    const ticker = setInterval(() => {
        const anchor = document.querySelector('.server-list-options') || document.querySelector('#rbx-running-games');
        if (anchor) { clearInterval(ticker); init(); }
    }, 1000);
})();