// ==UserScript==
// @name         🎯 Roblox Low Ping Finder v9.0 (Modern UI)
// @version      9.0
// @description  Modern UI with fixed region filter — Orange/White theme, clear visibility
// @author       D & Claude Bro
// @match        https://www.roblox.com/games/*
// @connect      games.roblox.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    // ==============================
    //  CONFIG
    // ==============================
    const MAX_PAGES = 6;
    const MAX_PING = 350;
    const THROTTLE_MS = 900;
    const RETRY_ATTEMPTS = 4;
    const RETRY_BASE_DELAY = 1200;

    // Roblox datacenter regions
    const REGIONS = {
        'all': { label: 'All Regions', flag: '🌍', group: null },
        'sg': { label: 'Singapore', flag: '🇸🇬', group: 'Asia', keywords: ['singapore','|sg|',' sg ','sng'] },
        'jp': { label: 'Japan', flag: '🇯🇵', group: 'Asia', keywords: ['tokyo','japan','|jp|','nrt','hnd'] },
        'kr': { label: 'South Korea', flag: '🇰🇷', group: 'Asia', keywords: ['seoul','korea','|kr|','icn'] },
        'au': { label: 'Australia', flag: '🇦🇺', group: 'Asia', keywords: ['sydney','australia','|au|','syd'] },
        'us-east': { label: 'US East', flag: '🇺🇸', group: 'Americas', keywords: ['ashburn','virginia','us-east','iad'] },
        'us-central': { label: 'US Central', flag: '🇺🇸', group: 'Americas', keywords: ['dallas','texas','us-central','dfw'] },
        'us-west': { label: 'US West', flag: '🇺🇸', group: 'Americas', keywords: ['san jose','california','us-west','sjc'] },
        'br': { label: 'Brazil', flag: '🇧🇷', group: 'Americas', keywords: ['brazil','brasil','|br|','gru'] },
        'de': { label: 'Germany', flag: '🇩🇪', group: 'Europe', keywords: ['frankfurt','germany','|de|','fra'] },
        'gb': { label: 'UK', flag: '🇬🇧', group: 'Europe', keywords: ['london','united kingdom','|gb|','|uk|','lhr'] },
        'fr': { label: 'France', flag: '🇫🇷', group: 'Europe', keywords: ['paris','france','|fr|','cdg'] },
    };

    const GROUP_ORDER = ['Asia', 'Americas', 'Europe'];

    let state = {
        scanning: false,
        token: 0,
        pool: [],
        filter: 'all',
        sortBy: 'ping',
    };

    // ==============================
    //  RATE LIMITER
    // ==============================
    const RATE_LIMIT = {
        maxScans: 8,
        windowMs: 60000,
        scans: [],
    };

    function canScan() {
        const now = Date.now();
        RATE_LIMIT.scans = RATE_LIMIT.scans.filter(t => now - t < RATE_LIMIT.windowMs);
        return RATE_LIMIT.scans.length < RATE_LIMIT.maxScans;
    }

    function recordScan() {
        RATE_LIMIT.scans.push(Date.now());
    }

    function getTimeUntilNextScan() {
        const now = Date.now();
        if (RATE_LIMIT.scans.length < RATE_LIMIT.maxScans) return 0;
        const oldestScan = RATE_LIMIT.scans[0];
        const timeElapsed = now - oldestScan;
        const timeRemaining = RATE_LIMIT.windowMs - timeElapsed;
        return Math.max(0, Math.ceil(timeRemaining / 1000));
    }

    function updateRateLimitUI(ui) {
        const canGo = canScan();
        const timeLeft = getTimeUntilNextScan();
        const scansUsed = RATE_LIMIT.scans.length;

        if (canGo) {
            ui.scanBtn.disabled = false;
            ui.scanBtn.style.background = '#ff8c42';
            ui.scanBtn.style.color = 'white';
            ui.status.textContent = `Ready (${scansUsed}/${RATE_LIMIT.maxScans})`;
        } else {
            ui.scanBtn.disabled = true;
            ui.scanBtn.style.background = '#ddd';
            ui.scanBtn.style.color = '#666';
            ui.status.innerHTML = `⏱️ Wait <span style="color:#ff8c42; font-weight:700;">${timeLeft}s</span> (${scansUsed}/${RATE_LIMIT.maxScans})`;
        }
    }

    function startCooldownTimer(ui) {
        const interval = setInterval(() => {
            updateRateLimitUI(ui);
            if (getTimeUntilNextScan() <= 0) clearInterval(interval);
        }, 500);
    }

    // ==============================
    //  UTILITIES
    // ==============================
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function httpGet(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://www.roblox.com/',
                    'Origin': 'https://www.roblox.com',
                },
                onload: r => {
                    if (r.status === 429) reject('429');
                    else if (r.status === 403) reject('403');
                    else if (r.status === 401) reject('401');
                    else if (r.status < 400) {
                        try {
                            const data = JSON.parse(r.responseText);
                            resolve(data);
                        } catch (e) {
                            reject('PARSE_ERROR');
                        }
                    } else {
                        reject('HTTP_' + r.status);
                    }
                },
                onerror: () => reject('NETWORK_ERROR'),
                ontimeout: () => reject('TIMEOUT'),
            });
        });
    }

    async function httpGetWithRetry(url, maxRetries = RETRY_ATTEMPTS) {
        let lastError = '';
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await httpGet(url);
            } catch (err) {
                lastError = String(err);
                const isRetryable = ['429', '403', '401', 'TIMEOUT', 'NETWORK_ERROR'].includes(err);
                if (!isRetryable || attempt === maxRetries - 1) throw new Error(lastError);
                const waitMs = RETRY_BASE_DELAY * Math.pow(1.5, attempt);
                await delay(waitMs);
            }
        }
    }

    // ==============================
    //  REGION DETECTION (FIXED)
    // ==============================
    function detectRegion(server) {
        const raw = JSON.stringify(server).toLowerCase();
        for (const [key, info] of Object.entries(REGIONS)) {
            if (key === 'all') continue;
            if (info.keywords && info.keywords.some(k => raw.includes(k))) return key;
        }
        return 'unknown';
    }

    // ==============================
    //  SERVER INFO
    // ==============================
    function estimateServerAge(server) {
        const ratio = server.playing / server.maxPlayers;
        if (ratio < 0.2) return { label: 'Fresh', color: '#4CAF50' };
        if (ratio < 0.7) return { label: 'Active', color: '#ff9800' };
        return { label: 'Full', color: '#f44336' };
    }

    function getPingColor(ping) {
        if (ping <= 80) return '#4CAF50';
        if (ping <= 130) return '#8BC34A';
        if (ping <= 180) return '#ff9800';
        if (ping <= 240) return '#ff7043';
        return '#f44336';
    }

    function getPingLabel(ping) {
        if (ping <= 80) return 'Excellent';
        if (ping <= 130) return 'Good';
        if (ping <= 180) return 'Fair';
        if (ping <= 240) return 'Slow';
        return 'Poor';
    }

    // ==============================
    //  SCAN LOGIC
    // ==============================
    async function scan(ui, placeId) {
        if (!canScan()) {
            const timeLeft = getTimeUntilNextScan();
            ui.status.innerHTML = `⏱️ Wait <span style="color:#ff8c42; font-weight:700;">${timeLeft}s</span>`;
            return;
        }

        recordScan();
        state.scanning = true;
        state.token++;
        const token = state.token;
        state.pool = [];

        ui.scanBtn.disabled = true;
        ui.scanBtn.textContent = 'Scanning...';
        ui.status.textContent = 'Initializing...';
        ui.results.innerHTML = '';
        ui.bar.style.width = '0%';

        try {
            let cursor = '';
            let pageCount = 0;

            for (let i = 0; i < MAX_PAGES; i++) {
                if (!state.scanning || token !== state.token) break;

                if (i > 0) await delay(THROTTLE_MS);

                const pct = Math.round(((i + 1) / MAX_PAGES) * 100);
                ui.bar.style.width = pct + '%';
                ui.status.textContent = `📡 Page ${i + 1}/${MAX_PAGES}...`;

                const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100&cursor=${cursor}`;
                
                try {
                    const res = await httpGetWithRetry(url, RETRY_ATTEMPTS);
                    if (!res?.data?.length) break;

                    const servers = res.data
                        .map(s => ({
                            id: s.id,
                            ping: Number(s.ping) || 999,
                            playing: s.playing || 0,
                            maxPlayers: s.maxPlayers || 0,
                            fps: s.fps || 0,
                            regionTag: detectRegion(s),
                        }))
                        .filter(s => s.ping > 0 && s.ping <= MAX_PING && s.playing < s.maxPlayers);

                    state.pool.push(...servers);
                    pageCount++;
                    cursor = res.nextPageCursor || '';
                    if (!cursor) break;
                } catch (pageErr) {
                    console.error('Page error:', pageErr.message);
                    if (pageCount === 0) throw pageErr;
                    break;
                }
            }

            state.pool = [...new Map(state.pool.map(s => [s.id, s])).values()];
            ui.status.textContent = `✅ Found ${state.pool.length} servers`;
            renderResults(ui);
        } catch (e) {
            const errMsg = e.message || String(e);
            if (errMsg.includes('429')) {
                ui.status.textContent = '⏸️ Rate limited (429). Try again later.';
            } else if (errMsg.includes('403')) {
                ui.status.textContent = '🚫 Access denied (403). Refresh page.';
            } else {
                ui.status.textContent = `❌ Error: ${errMsg}`;
            }
        } finally {
            state.scanning = false;
            updateRateLimitUI(ui);
            startCooldownTimer(ui);
        }
    }

    // ==============================
    //  RENDER RESULTS (FIXED FILTER)
    // ==============================
    function renderResults(ui) {
        const f = state.filter;
        let list = [];

        if (f === 'all') {
            list = state.pool;
        } else {
            // FIXED: Direct filter by regionTag
            list = state.pool.filter(s => s.regionTag === f);
        }

        list = list.sort((a, b) =>
            state.sortBy === 'ping' ? a.ping - b.ping : b.playing - a.playing
        ).slice(0, 80);

        const placeId = window.location.pathname.split('/')[2];

        if (!list.length) {
            ui.results.innerHTML = `
                <div style="padding:60px 20px; text-align:center; color:#999; width:100%;">
                    <div style="font-size:48px; margin-bottom:12px;">📡</div>
                    <div style="font-size:16px; font-weight:600; color:#666;">No Servers Found</div>
                    <div style="font-size:13px; margin-top:8px; color:#aaa;">
                        Try <b>All Regions</b> or scan again
                    </div>
                </div>`;
            return;
        }

        ui.results.innerHTML = list.map((s, i) => {
            const pColor = getPingColor(s.ping);
            const pLabel = getPingLabel(s.ping);
            const age = estimateServerAge(s);
            const regionInfo = REGIONS[s.regionTag] || { label: s.regionTag, flag: '🌐' };
            const fillPct = Math.round((s.playing / s.maxPlayers) * 100);
            const rank = i + 1;

            return `
            <div class="server-card" style="
                background: white;
                border: 2px solid #f0f0f0;
                border-radius: 14px;
                width: 200px;
                padding: 16px;
                display: inline-flex;
                flex-direction: column;
                gap: 10px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                position: relative;
                transition: all 0.3s ease;
                cursor: default;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            " onmouseover="this.style.borderColor='${pColor}';this.style.boxShadow='0 8px 24px rgba(255,140,66,0.15)';this.style.transform='translateY(-4px)'"
               onmouseout="this.style.borderColor='#f0f0f0';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';this.style.transform='none'">

                <!-- Rank Badge -->
                <div style="position:absolute; top:12px; right:12px; background:#ff8c42; color:white; font-size:11px; font-weight:700; border-radius:6px; padding:4px 10px;">#${rank}</div>

                <!-- Region -->
                <div style="font-size:12px; color:#666; font-weight:500; display:flex; align-items:center; gap:6px;">
                    <span>${regionInfo.flag}</span>
                    <span>${regionInfo.label}</span>
                </div>

                <!-- Ping (Big) -->
                <div style="display:flex; align-items:baseline; gap:6px;">
                    <span style="font-size:32px; font-weight:700; color:${pColor}; line-height:1;">${s.ping}</span>
                    <span style="font-size:12px; color:#999;">ms</span>
                    <span style="font-size:11px; color:${pColor}; font-weight:600; margin-left:auto;">${pLabel}</span>
                </div>

                <!-- Player Bar -->
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; color:#666; margin-bottom:6px; font-weight:500;">
                        <span>👥 ${s.playing}/${s.maxPlayers}</span>
                        <span style="color:${age.color}; font-weight:700;">${age.label}</span>
                    </div>
                    <div style="height:6px; background:#e0e0e0; border-radius:3px; overflow:hidden;">
                        <div style="height:100%; width:${fillPct}%; background:${pColor}; border-radius:3px; transition:width 0.5s;"></div>
                    </div>
                </div>

                <!-- Info Row -->
                <div style="font-size:10px; color:#999; display:flex; justify-content:space-between; border-top:1px solid #f0f0f0; padding-top:8px;">
                    <span>FPS: <span style="color:#333; font-weight:600">${s.fps > 0 ? Math.round(s.fps) : '?'}</span></span>
                    <span>Free: <span style="color:#333; font-weight:600">${s.maxPlayers - s.playing}</span></span>
                </div>

                <!-- Join Button -->
                <button onclick="window.location.href='roblox://placeId=${placeId}&gameInstanceId=${s.id}'" style="
                    width: 100%;
                    background: ${pColor};
                    color: white;
                    border: none;
                    padding: 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 12px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    letter-spacing: 0.5px;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                " onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 6px 16px rgba(0,0,0,0.15)'"
                   onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1)'">
                    JOIN SERVER →
                </button>
            </div>`;
        }).join('');
    }

    // ==============================
    //  DROPDOWN
    // ==============================
    function buildDropdownOptions() {
        let html = '<option value="all">🌍 All Regions</option>';
        for (const group of GROUP_ORDER) {
            html += `<optgroup label="━━ ${group.toUpperCase()} ━━">`;
            for (const [key, info] of Object.entries(REGIONS)) {
                if (info.group === group) {
                    html += `<option value="${key}">${info.flag} ${info.label}</option>`;
                }
            }
            html += '</optgroup>';
        }
        return html;
    }

    // ==============================
    //  INIT UI
    // ==============================
    function init() {
        const placeId = window.location.pathname.split('/')[2];
        if (!placeId || document.getElementById('rb9-root')) return;

        const anchor = document.querySelector('.server-list-options')
            || document.querySelector('#rbx-running-games')
            || document.querySelector('.stack.section');
        if (!anchor) return;

        const root = document.createElement('div');
        root.id = 'rb9-root';
        root.style = `
            background: linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%);
            border: 2px solid #ff8c42;
            border-radius: 18px;
            padding: 28px;
            margin: 24px 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            box-shadow: 0 12px 40px rgba(255,140,66,0.12);
        `;

        root.innerHTML = `
            <!-- Header -->
            <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; flex-wrap:wrap;">
                <div>
                    <div style="font-size:22px; font-weight:700; letter-spacing:0.5px; color:#ff8c42;">
                        🎯 LOW PING FINDER
                    </div>
                    <div id="rb9-status" style="font-size:12px; color:#999; margin-top:4px; font-weight:500;">Ready to scan</div>
                </div>

                <div style="display:flex; gap:10px; margin-left:auto; flex-wrap:wrap; align-items:center;">
                    <!-- Region Select -->
                    <select id="rb9-region" style="
                        background: white;
                        color: #ff8c42;
                        border: 2px solid #ff8c42;
                        padding: 10px 14px;
                        border-radius: 10px;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        min-width: 180px;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='#ff8c42';this.style.color='white'"
                       onmouseout="this.style.background='white';this.style.color='#ff8c42'">
                        ${buildDropdownOptions()}
                    </select>

                    <!-- Sort Select -->
                    <select id="rb9-sort" style="
                        background: white;
                        color: #333;
                        border: 2px solid #ddd;
                        padding: 10px 14px;
                        border-radius: 10px;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.borderColor='#ff8c42';this.style.color='#ff8c42'"
                       onmouseout="this.style.borderColor='#ddd';this.style.color='#333'">
                        <option value="ping">📍 Ping ↑</option>
                        <option value="players">👥 Players ↓</option>
                    </select>

                    <!-- Scan Button -->
                    <button id="rb9-scan" style="
                        background: #ff8c42;
                        color: white;
                        border: none;
                        padding: 11px 28px;
                        border-radius: 10px;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        font-size: 13px;
                        font-weight: 700;
                        cursor: pointer;
                        letter-spacing: 0.5px;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 12px rgba(255,140,66,0.3);
                    " onmouseover="this.style.background='#ff7a33';this.style.boxShadow='0 6px 20px rgba(255,140,66,0.4)';this.style.transform='translateY(-2px)'"
                       onmouseout="this.style.background='#ff8c42';this.style.boxShadow='0 4px 12px rgba(255,140,66,0.3)';this.style.transform='none'">
                        🔍 SCAN
                    </button>
                </div>
            </div>

            <!-- Progress Bar -->
            <div style="height:4px; background:#e0e0e0; border-radius:2px; margin-bottom:20px; overflow:hidden;">
                <div id="rb9-bar" style="height:100%; width:0%; background:linear-gradient(90deg, #ff8c42, #ffa500); transition:width 0.4s ease;"></div>
            </div>

            <!-- Results Grid -->
            <div id="rb9-results" style="display:flex; flex-wrap:wrap; gap:14px; min-height:80px; margin-bottom:20px;"></div>

            <!-- Legend -->
            <div style="display:flex; gap:20px; flex-wrap:wrap; font-size:11px; color:#999; border-top:2px solid #f0f0f0; padding-top:16px; margin-top:20px;">
                <span><span style="color:#4CAF50; font-weight:700;">●</span> Excellent ≤80ms</span>
                <span><span style="color:#8BC34A; font-weight:700;">●</span> Good ≤130ms</span>
                <span><span style="color:#ff9800; font-weight:700;">●</span> Fair ≤180ms</span>
                <span><span style="color:#ff7043; font-weight:700;">●</span> Slow ≤240ms</span>
                <span><span style="color:#f44336; font-weight:700;">●</span> Poor 240ms+</span>
            </div>
        `;

        anchor.after(root);

        const ui = {
            scanBtn: root.querySelector('#rb9-scan'),
            status: root.querySelector('#rb9-status'),
            bar: root.querySelector('#rb9-bar'),
            results: root.querySelector('#rb9-results'),
            region: root.querySelector('#rb9-region'),
            sort: root.querySelector('#rb9-sort'),
        };

        ui.scanBtn.onclick = () => scan(ui, placeId);
        ui.region.onchange = e => {
            state.filter = e.target.value;
            if (state.pool.length) renderResults(ui);
        };
        ui.sort.onchange = e => {
            state.sortBy = e.target.value;
            if (state.pool.length) renderResults(ui);
        };

        updateRateLimitUI(ui);
        startCooldownTimer(ui);
    }

    // Wait for page
    let attempts = 0;
    const ticker = setInterval(() => {
        if (++attempts > 30) clearInterval(ticker);
        const anchor = document.querySelector('.server-list-options')
            || document.querySelector('#rbx-running-games')
            || document.querySelector('.stack.section');
        if (anchor) { clearInterval(ticker); init(); }
    }, 1500);

})();