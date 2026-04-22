// ==UserScript==
// @name         🎯 Roblox Low Ping Finder v8.1 (Stable)
// @version      8.1
// @description  Find low ping servers with clean UI — Region filter, player count, server age
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
    const THROTTLE_MS = 900;  // Throttle between requests (stable)
    const RETRY_ATTEMPTS = 4;
    const RETRY_BASE_DELAY = 1200; // Start at 1.2s

    // Roblox actual datacenter regions
    const REGIONS = {
        'all': { label: 'All Regions', flag: '🌍', group: null },
        // Asia
        'sg': { label: 'Singapore', flag: '🇸🇬', group: 'Asia', keywords: ['singapore','|sg|',' sg ','sng'] },
        'jp': { label: 'Japan', flag: '🇯🇵', group: 'Asia', keywords: ['tokyo','japan','|jp|','nrt','hnd'] },
        'kr': { label: 'South Korea', flag: '🇰🇷', group: 'Asia', keywords: ['seoul','korea','|kr|','icn'] },
        'au': { label: 'Australia', flag: '🇦🇺', group: 'Asia', keywords: ['sydney','australia','|au|','syd'] },
        // US
        'us-east': { label: 'US East (Ashburn)', flag: '🇺🇸', group: 'Americas', keywords: ['ashburn','virginia','us-east','iad'] },
        'us-central': { label: 'US Central (Dallas)', flag: '🇺🇸', group: 'Americas', keywords: ['dallas','texas','us-central','dfw'] },
        'us-west': { label: 'US West (San Jose)', flag: '🇺🇸', group: 'Americas', keywords: ['san jose','california','us-west','sjc'] },
        'br': { label: 'Brazil', flag: '🇧🇷', group: 'Americas', keywords: ['brazil','brasil','|br|','gru'] },
        // Europe
        'de': { label: 'Germany (Frankfurt)', flag: '🇩🇪', group: 'Europe', keywords: ['frankfurt','germany','|de|','fra'] },
        'gb': { label: 'UK (London)', flag: '🇬🇧', group: 'Europe', keywords: ['london','united kingdom','|gb|','|uk|','lhr'] },
        'fr': { label: 'France (Paris)', flag: '🇫🇷', group: 'Europe', keywords: ['paris','france','|fr|','cdg'] },
    };

    const GROUP_ORDER = ['Asia', 'Americas', 'Europe'];

    // ==============================
    //  STATE
    // ==============================
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
        maxScans: 8,        // Max scans per minute
        windowMs: 60000,    // 1 minute window
        scans: [],          // Timestamps of recent scans
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
            ui.scanBtn.style.background = '#7c3aed';
            ui.status.textContent = `Ready (${scansUsed}/${RATE_LIMIT.maxScans} used today)`;
        } else {
            ui.scanBtn.disabled = true;
            ui.scanBtn.style.background = '#4b5563';
            ui.status.innerHTML = `⏱️ Cooldown: <span style="color:#f87171; font-weight:700;">${timeLeft}s</span> remaining (${scansUsed}/${RATE_LIMIT.maxScans})`;
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
                
                if (!isRetryable || attempt === maxRetries - 1) {
                    throw new Error(lastError);
                }

                const waitMs = RETRY_BASE_DELAY * Math.pow(1.5, attempt);
                console.log(`[Retry ${attempt + 1}/${maxRetries}] ${lastError} - Wait ${Math.round(waitMs)}ms`);
                await delay(waitMs);
            }
        }
    }

    // ==============================
    //  REGION DETECTION
    // ==============================
    function detectRegion(server) {
        const raw = JSON.stringify(server).toLowerCase();
        for (const [key, info] of Object.entries(REGIONS)) {
            if (key === 'all') continue;
            if (info.keywords.some(k => raw.includes(k))) return key;
        }
        return 'unknown';
    }

    // ==============================
    //  SERVER INFO
    // ==============================
    function estimateServerAge(server) {
        const ratio = server.playing / server.maxPlayers;
        if (ratio < 0.2) return { label: 'Fresh', color: '#4ade80' };
        if (ratio < 0.7) return { label: 'Active', color: '#facc15' };
        return { label: 'Full', color: '#f87171' };
    }

    function getPingColor(ping) {
        if (ping <= 80) return '#4ade80';
        if (ping <= 130) return '#a3e635';
        if (ping <= 180) return '#facc15';
        if (ping <= 240) return '#fb923c';
        return '#f87171';
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
        // Check rate limit FIRST
        if (!canScan()) {
            const timeLeft = getTimeUntilNextScan();
            ui.status.innerHTML = `⏱️ Cooldown! Wait <span style="color:#f87171; font-weight:700;">${timeLeft}s</span>`;
            return;
        }

        recordScan(); // Mark this scan timestamp
        state.scanning = true;
        state.token++;
        const token = state.token;
        state.pool = [];

        ui.scanBtn.disabled = true;
        ui.scanBtn.textContent = 'Scanning...';
        ui.status.textContent = 'Initializing scan...';
        ui.results.innerHTML = '';
        ui.bar.style.width = '0%';

        try {
            let cursor = '';
            let pageCount = 0;

            for (let i = 0; i < MAX_PAGES; i++) {
                if (!state.scanning || token !== state.token) break;

                // Throttle before request
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
                    if (pageCount === 0) throw pageErr; // Fail if first page fails
                    break; // Stop scanning but use what we got
                }
            }

            // Deduplicate
            state.pool = [...new Map(state.pool.map(s => [s.id, s])).values()];
            ui.status.textContent = `✅ Found ${state.pool.length} servers`;
            renderResults(ui);
        } catch (e) {
            const errMsg = e.message || String(e);
            console.error('Scan error:', errMsg);
            
            if (errMsg.includes('429')) {
                ui.status.textContent = '⏸️ Rate limited (429). Wait 1-2 min & retry.';
            } else if (errMsg.includes('403')) {
                ui.status.textContent = '🚫 Access denied (403). Try refreshing page.';
            } else if (errMsg.includes('NETWORK')) {
                ui.status.textContent = '🌐 Network error. Check connection.';
            } else {
                ui.status.textContent = `❌ Error: ${errMsg}`;
            }
        } finally {
            state.scanning = false;
            updateRateLimitUI(ui); // Update button status
            startCooldownTimer(ui); // Start countdown timer
        }
    }

    // ==============================
    //  RENDER RESULTS
    // ==============================
    function renderResults(ui) {
        const f = state.filter;
        let list = f === 'all'
            ? state.pool
            : state.pool.filter(s => s.regionTag === f || (s.regionTag === 'unknown' && f === 'unknown'));

        list = list.sort((a, b) =>
            state.sortBy === 'ping' ? a.ping - b.ping : b.playing - a.playing
        ).slice(0, 80);

        const placeId = window.location.pathname.split('/')[2];

        if (!list.length) {
            ui.results.innerHTML = `
                <div style="padding:40px 20px; text-align:center; color:#6b7280; font-family:'IBM Plex Mono',monospace; width:100%;">
                    <div style="font-size:32px; margin-bottom:8px;">📡</div>
                    <div>No servers found for <b style="color:#a78bfa">${f.toUpperCase()}</b></div>
                    <div style="font-size:12px; margin-top:6px;">Try scanning again or switch to All Regions</div>
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
            <div class="rb8-card" data-id="${s.id}" style="
                background: #111318;
                border: 1px solid #1f2230;
                border-radius: 12px;
                width: 180px;
                padding: 14px;
                display: inline-flex;
                flex-direction: column;
                gap: 8px;
                font-family: 'IBM Plex Mono', monospace;
                position: relative;
                transition: border-color 0.2s, transform 0.15s;
                cursor: default;
            " onmouseover="this.style.borderColor='${pColor}';this.style.transform='translateY(-2px)'"
               onmouseout="this.style.borderColor='#1f2230';this.style.transform='none'">

                <div style="position:absolute; top:10px; right:10px; background:#1f2230; color:#4b5563; font-size:10px; border-radius:4px; padding:1px 5px;">#${rank}</div>

                <div style="font-size:11px; color:#6b7280; display:flex; align-items:center; gap:4px;">
                    <span>${regionInfo.flag}</span>
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px;">${regionInfo.label}</span>
                </div>

                <div style="display:flex; align-items:baseline; gap:6px;">
                    <span style="font-size:26px; font-weight:700; color:${pColor}; letter-spacing:-1px;">${s.ping}</span>
                    <span style="font-size:11px; color:#4b5563;">ms</span>
                    <span style="font-size:10px; color:${pColor}; margin-left:auto;">${pLabel}</span>
                </div>

                <div>
                    <div style="display:flex; justify-content:space-between; font-size:10px; color:#6b7280; margin-bottom:4px;">
                        <span>👥 ${s.playing}/${s.maxPlayers}</span>
                        <span style="color:${age.color}">${age.label}</span>
                    </div>
                    <div style="height:4px; background:#1f2230; border-radius:2px; overflow:hidden;">
                        <div style="height:100%; width:${fillPct}%; background:${pColor}; border-radius:2px; transition:width 0.5s;"></div>
                    </div>
                </div>

                <div style="font-size:10px; color:#4b5563; display:flex; justify-content:space-between;">
                    <span>FPS: <span style="color:#6b7280">${s.fps > 0 ? Math.round(s.fps) : '?'}</span></span>
                    <span>Free: <span style="color:#6b7280">${s.maxPlayers - s.playing}</span></span>
                </div>

                <button onclick="window.location.href='roblox://placeId=${placeId}&gameInstanceId=${s.id}'" style="
                    width: 100%;
                    background: transparent;
                    color: ${pColor};
                    border: 1px solid ${pColor};
                    padding: 7px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 11px;
                    font-family: 'IBM Plex Mono', monospace;
                    letter-spacing: 0.5px;
                    transition: background 0.2s, color 0.2s;
                " onmouseover="this.style.background='${pColor}';this.style.color='#000'"
                   onmouseout="this.style.background='transparent';this.style.color='${pColor}'">
                    JOIN →
                </button>
            </div>`;
        }).join('');
    }

    // ==============================
    //  DROPDOWN OPTIONS
    // ==============================
    function buildDropdownOptions() {
        let html = '<option value="all">🌍 All Regions</option>';
        for (const group of GROUP_ORDER) {
            html += `<optgroup label="── ${group} ──">`;
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
        if (!placeId || document.getElementById('rb8-root')) return;

        const anchor = document.querySelector('.server-list-options')
            || document.querySelector('#rbx-running-games')
            || document.querySelector('.stack.section');
        if (!anchor) return;

        // Inject Google Font
        if (!document.getElementById('rb8-font')) {
            const link = document.createElement('link');
            link.id = 'rb8-font';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap';
            document.head.appendChild(link);
        }

        const root = document.createElement('div');
        root.id = 'rb8-root';
        root.style = `
            background: #0c0e13;
            border: 1px solid #1f2230;
            border-radius: 16px;
            padding: 20px;
            margin: 20px 0;
            font-family: 'IBM Plex Mono', monospace;
            color: white;
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        `;

        root.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
                <div>
                    <div style="font-size:15px; font-weight:700; letter-spacing:1px; color:#a78bfa;">
                        LOW PING FINDER v8.1
                    </div>
                    <div id="rb8-status" style="font-size:11px; color:#4b5563; margin-top:2px;">Ready</div>
                </div>

                <div style="display:flex; gap:8px; margin-left:auto; flex-wrap:wrap; align-items:center;">
                    <select id="rb8-region" style="
                        background: #111318;
                        color: #c4b5fd;
                        border: 1px solid #2d2f40;
                        padding: 7px 10px;
                        border-radius: 8px;
                        font-family: 'IBM Plex Mono', monospace;
                        font-size: 12px;
                        cursor: pointer;
                        min-width: 160px;
                    ">${buildDropdownOptions()}</select>

                    <select id="rb8-sort" style="
                        background: #111318;
                        color: #9ca3af;
                        border: 1px solid #2d2f40;
                        padding: 7px 10px;
                        border-radius: 8px;
                        font-family: 'IBM Plex Mono', monospace;
                        font-size: 12px;
                        cursor: pointer;
                    ">
                        <option value="ping">Sort: Ping ↑</option>
                        <option value="players">Sort: Players ↓</option>
                    </select>

                    <button id="rb8-scan" style="
                        background: #7c3aed;
                        color: white;
                        border: none;
                        padding: 8px 18px;
                        border-radius: 8px;
                        font-family: 'IBM Plex Mono', monospace;
                        font-size: 12px;
                        font-weight: 700;
                        cursor: pointer;
                        letter-spacing: 0.5px;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#6d28d9'"
                       onmouseout="this.style.background='#7c3aed'">
                        🔍 Scan
                    </button>
                </div>
            </div>

            <div style="height:3px; background:#1f2230; border-radius:2px; margin-bottom:16px; overflow:hidden;">
                <div id="rb8-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#7c3aed,#a78bfa); transition:width 0.4s;"></div>
            </div>

            <div id="rb8-results" style="display:flex; flex-wrap:wrap; gap:10px; min-height:60px;"></div>

            <div style="margin-top:14px; display:flex; gap:16px; flex-wrap:wrap; font-size:10px; color:#374151; border-top:1px solid #1f2230; padding-top:12px;">
                <span><span style="color:#4ade80">●</span> Excellent ≤80ms</span>
                <span><span style="color:#a3e635">●</span> Good ≤130ms</span>
                <span><span style="color:#facc15">●</span> Fair ≤180ms</span>
                <span><span style="color:#fb923c">●</span> Slow ≤240ms</span>
                <span><span style="color:#f87171">●</span> Poor 240ms+</span>
            </div>
        `;

        anchor.after(root);

        const ui = {
            scanBtn: root.querySelector('#rb8-scan'),
            status: root.querySelector('#rb8-status'),
            bar: root.querySelector('#rb8-bar'),
            results: root.querySelector('#rb8-results'),
            region: root.querySelector('#rb8-region'),
            sort: root.querySelector('#rb8-sort'),
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

        // Initialize rate limit UI
        updateRateLimitUI(ui);
        startCooldownTimer(ui);
    }

    // Wait for page to be ready
    let attempts = 0;
    const ticker = setInterval(() => {
        if (++attempts > 30) clearInterval(ticker);
        const anchor = document.querySelector('.server-list-options')
            || document.querySelector('#rbx-running-games')
            || document.querySelector('.stack.section');
        if (anchor) { clearInterval(ticker); init(); }
    }, 1500);

})();