// ==UserScript==
// @name         Roblox Low Ping Server Finder (Modern UI)
// @version      6.1
// @description  Find Roblox servers with lower ping, stronger stability, and region filters.
// @author       D
// @match        https://www.roblox.com/games/*
// @connect      roblox.com
// @connect      games.roblox.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    const DASHBOARD_ID = 'rb-lowping-dashboard';
    const STYLE_ID = 'rb-lowping-style';
    const SETTINGS_KEY = 'rb_lowping_settings_v2';
    const CACHE_TTL_MS = 45_000;
    const MAX_RENDER_ROWS = 80;

    const REGION_OPTIONS = [
        { value: 'all', label: 'All Regions' },
        { value: 'asia', label: 'Asia (All)' },
        { value: 'asia-singapore', label: 'Asia / Singapore' },
        { value: 'asia-japan', label: 'Asia / Japan' },
        { value: 'europe', label: 'Europe (All)' },
        { value: 'europe-denmark', label: 'Europe / Denmark' },
        { value: 'europe-italy', label: 'Europe / Italy' },
        { value: 'unknown', label: 'Unknown Region' },
    ];

    const defaultSettings = {
        maxPing: 100,
        maxPages: 6,
        minFreeSlots: 1,
        sortBy: 'ping',
        regionFilter: 'all',
    };

    const state = {
        scanning: false,
        scanToken: 0,
        latestPool: [],
        latestFiltered: [],
        latestScannedCount: 0,
        cache: null,
    };

    function getPlaceId() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        return parts.length >= 2 ? parts[1] : '';
    }

    function loadSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return { ...defaultSettings };
            const parsed = JSON.parse(raw);
            return { ...defaultSettings, ...parsed };
        } catch {
            return { ...defaultSettings };
        }
    }

    function saveSettings(settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${DASHBOARD_ID} {
                margin: 18px 0;
                padding: 16px;
                border-radius: 12px;
                border: 1px solid #3c3f43;
                background: linear-gradient(180deg, #2b2d30 0%, #222427 100%);
                color: #f2f4f6;
                font-family: "Gotham SSm A", "Gotham SSm B", "Helvetica Neue", Helvetica, Arial, sans-serif;
                box-shadow: 0 8px 30px rgba(0,0,0,.25);
            }
            #${DASHBOARD_ID} .rb-head {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
                flex-wrap: wrap;
            }
            #${DASHBOARD_ID} .rb-title {
                margin: 0;
                font-size: 16px;
                color: #7ee7ff;
                letter-spacing: .2px;
            }
            #${DASHBOARD_ID} .rb-sub {
                margin: 2px 0 0;
                font-size: 12px;
                color: #b6bcc4;
            }
            #${DASHBOARD_ID} .rb-actions {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }
            #${DASHBOARD_ID} button,
            #${DASHBOARD_ID} input,
            #${DASHBOARD_ID} select {
                border-radius: 8px;
                border: 1px solid #4b4f54;
                font-size: 12px;
            }
            #${DASHBOARD_ID} button {
                padding: 7px 12px;
                cursor: pointer;
                color: #fff;
                background: #2f6fff;
                border: none;
                font-weight: 700;
                transition: .18s ease;
            }
            #${DASHBOARD_ID} button:hover { filter: brightness(1.08); }
            #${DASHBOARD_ID} button:disabled {
                opacity: .55;
                cursor: not-allowed;
            }
            #${DASHBOARD_ID} .rb-btn-secondary {
                background: #3a3d42;
            }
            #${DASHBOARD_ID} .rb-btn-danger {
                background: #c04242;
            }
            #${DASHBOARD_ID} .rb-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 10px;
                margin: 12px 0;
            }
            #${DASHBOARD_ID} .rb-stat {
                padding: 10px;
                border: 1px solid #3d4146;
                border-radius: 10px;
                background: #1f2124;
            }
            #${DASHBOARD_ID} .rb-stat p { margin: 0; }
            #${DASHBOARD_ID} .rb-stat .k { font-size: 11px; color: #adb5bd; }
            #${DASHBOARD_ID} .rb-stat .v { margin-top: 3px; font-size: 15px; font-weight: 700; }
            #${DASHBOARD_ID} .rb-controls {
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                gap: 10px;
                margin-bottom: 12px;
            }
            #${DASHBOARD_ID} .rb-field label {
                display: block;
                margin-bottom: 4px;
                color: #b8bec6;
                font-size: 11px;
            }
            #${DASHBOARD_ID} .rb-field input,
            #${DASHBOARD_ID} .rb-field select {
                width: 100%;
                padding: 8px;
                background: #121315;
                color: #f4f6f8;
            }
            #${DASHBOARD_ID} .rb-progress {
                width: 100%;
                height: 6px;
                background: #17191b;
                border-radius: 999px;
                overflow: hidden;
                border: 1px solid #2e3236;
            }
            #${DASHBOARD_ID} .rb-progress-fill {
                width: 0;
                height: 100%;
                background: linear-gradient(90deg, #00ccff, #00f7c2);
                transition: width .2s ease;
            }
            #${DASHBOARD_ID} .rb-table-wrap {
                margin-top: 12px;
                border: 1px solid #33373b;
                border-radius: 10px;
                overflow: hidden;
                background: #17191b;
            }
            #${DASHBOARD_ID} table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
            }
            #${DASHBOARD_ID} th {
                background: #2c2f34;
                color: #cfd5db;
                text-align: left;
                padding: 10px;
            }
            #${DASHBOARD_ID} td {
                padding: 10px;
                border-top: 1px solid #26292d;
                color: #e7ebef;
            }
            #${DASHBOARD_ID} tr:hover td {
                background: #1f2226;
            }
            #${DASHBOARD_ID} .rb-right { text-align: right; }
            #${DASHBOARD_ID} .rb-empty {
                text-align: center;
                color: #9aa1a9;
                padding: 22px;
            }
            @media (max-width: 980px) {
                #${DASHBOARD_ID} .rb-grid,
                #${DASHBOARD_ID} .rb-controls {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }
            @media (max-width: 620px) {
                #${DASHBOARD_ID} .rb-grid,
                #${DASHBOARD_ID} .rb-controls {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function getPingBadgeColor(ping) {
        if (ping <= 60) return '#00f5c8';
        if (ping <= 90) return '#ffe066';
        return '#ff8b8b';
    }

    function sortServers(servers, sortBy) {
        const copy = [...servers];
        switch (sortBy) {
            case 'players':
                copy.sort((a, b) => a.playing - b.playing || a.ping - b.ping);
                break;
            case 'balanced':
                copy.sort((a, b) => {
                    const unknownPenaltyA = a.regionTag === 'unknown' ? 8 : 0;
                    const unknownPenaltyB = b.regionTag === 'unknown' ? 8 : 0;
                    const scoreA = (a.ping * 1.25) + (a.playing / Math.max(a.maxPlayers, 1)) * 35 + unknownPenaltyA;
                    const scoreB = (b.ping * 1.25) + (b.playing / Math.max(b.maxPlayers, 1)) * 35 + unknownPenaltyB;
                    return scoreA - scoreB;
                });
                break;
            default:
                copy.sort((a, b) => a.ping - b.ping || a.playing - b.playing);
        }
        return copy;
    }

    function normalizeText(value) {
        return String(value || '').trim().toLowerCase();
    }

    function detectRegionTag(server) {
        const merged = [
            server.region,
            server.location,
            server.serverLocation,
            server.regionName,
            server.country,
            server.countryCode,
            server.locale,
            server.locationType,
        ].map(normalizeText).join(' | ');

        if (!merged) return 'unknown';

        if (merged.includes('singapore') || merged.includes(' sg ') || merged.endsWith(' sg') || merged.includes('|sg|')) return 'asia-singapore';
        if (merged.includes('japan') || merged.includes('tokyo') || merged.includes('|jp|') || merged.endsWith(' jp')) return 'asia-japan';
        if (merged.includes('denmark') || merged.includes('copenhagen') || merged.includes('|dk|') || merged.endsWith(' dk')) return 'europe-denmark';
        if (merged.includes('italy') || merged.includes('italie') || merged.includes('milan') || merged.includes('rome') || merged.includes('|it|') || merged.endsWith(' it')) return 'europe-italy';
        if (merged.includes('asia') || merged.includes('apac')) return 'asia';
        if (merged.includes('europe') || merged.includes('eu ')) return 'europe';

        return 'unknown';
    }

    function getRegionLabel(regionTag) {
        switch (regionTag) {
            case 'asia-singapore':
                return 'Asia / Singapore';
            case 'asia-japan':
                return 'Asia / Japan';
            case 'asia':
                return 'Asia';
            case 'europe-denmark':
                return 'Europe / Denmark';
            case 'europe-italy':
                return 'Europe / Italy';
            case 'europe':
                return 'Europe';
            default:
                return 'Unknown';
        }
    }

    function matchRegionFilter(regionTag, filter) {
        if (filter === 'all') return true;
        if (filter === 'asia') return regionTag === 'asia' || regionTag.startsWith('asia-');
        if (filter === 'europe') return regionTag === 'europe' || regionTag.startsWith('europe-');
        return regionTag === filter;
    }

    function dedupeServers(servers) {
        const map = new Map();
        for (const server of servers) {
            if (!server?.id) continue;
            const existing = map.get(server.id);
            if (!existing || (server.ping || 9999) < (existing.ping || 9999)) {
                map.set(server.id, server);
            }
        }
        return [...map.values()];
    }

    function requestJson(url) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    timeout: 12000,
                    onload: (response) => {
                        if (response.status >= 400) {
                            reject(new Error(`HTTP ${response.status}`));
                            return;
                        }
                        try {
                            resolve(JSON.parse(response.responseText));
                        } catch {
                            reject(new Error('Invalid JSON response'));
                        }
                    },
                    onerror: () => reject(new Error('Request failed')),
                    ontimeout: () => reject(new Error('Request timeout')),
                });
                return;
            }

            fetch(url)
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(resolve)
                .catch(() => reject(new Error('Fetch failed')));
        });
    }

    async function requestJsonWithRetry(url, maxAttempt = 3) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempt; attempt += 1) {
            try {
                return await requestJson(url);
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempt) {
                    await new Promise((resolve) => setTimeout(resolve, 180 * attempt));
                }
            }
        }
        throw lastError || new Error('Request failed');
    }

    function getDashboardElements(root) {
        return {
            status: root.querySelector('#rb-status'),
            progressFill: root.querySelector('#rb-progress-fill'),
            tbody: root.querySelector('#rb-tbody'),
            scanBtn: root.querySelector('#rb-scan-btn'),
            cancelBtn: root.querySelector('#rb-cancel-btn'),
            rescanBtn: root.querySelector('#rb-rescan-btn'),
            maxPing: root.querySelector('#rb-max-ping'),
            maxPages: root.querySelector('#rb-max-pages'),
            minFreeSlots: root.querySelector('#rb-min-free-slots'),
            sortBy: root.querySelector('#rb-sort-by'),
            regionFilter: root.querySelector('#rb-region-filter'),
            statScanned: root.querySelector('#rb-stat-scanned'),
            statMatch: root.querySelector('#rb-stat-match'),
            statBest: root.querySelector('#rb-stat-best'),
            statAvg: root.querySelector('#rb-stat-avg'),
        };
    }

    function renderStats(elements, servers, scannedCount) {
        const avg = servers.length
            ? Math.round(servers.reduce((sum, s) => sum + (Number(s.ping) || 0), 0) / servers.length)
            : 0;
        const best = servers.length ? Math.min(...servers.map((s) => Number(s.ping) || 9999)) : 0;

        elements.statScanned.textContent = scannedCount.toString();
        elements.statMatch.textContent = servers.length.toString();
        elements.statBest.textContent = best ? `${best} ms` : '-';
        elements.statAvg.textContent = avg ? `${avg} ms` : '-';
    }

    function renderTable(elements, placeId, servers) {
        if (!servers.length) {
            elements.tbody.innerHTML = '<tr><td colspan="6" class="rb-empty">ไม่เจอเซิร์ฟเวอร์ที่ตรงเงื่อนไข ลองขยาย Max Ping หรือเปลี่ยน Region</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();
        const rows = servers.slice(0, MAX_RENDER_ROWS);
        elements.tbody.innerHTML = '';

        rows.forEach((server, index) => {
            const row = document.createElement('tr');
            const freeSlots = Math.max(0, (server.maxPlayers || 0) - (server.playing || 0));
            const pingColor = getPingBadgeColor(Number(server.ping) || 9999);
            const regionText = getRegionLabel(server.regionTag);

            row.innerHTML = `
                <td>#${index + 1}</td>
                <td>${server.playing}/${server.maxPlayers} <span style="color:#9ea5ad">(ว่าง ${freeSlots})</span></td>
                <td style="font-weight:700;color:${pingColor};">${server.ping} ms</td>
                <td>${regionText}</td>
                <td>${server.id}</td>
                <td class="rb-right">
                    <button data-instance="${server.id}" class="rb-join-btn">JOIN</button>
                </td>
            `;

            fragment.appendChild(row);
        });

        elements.tbody.dataset.placeId = placeId;
        elements.tbody.appendChild(fragment);

        if (servers.length > MAX_RENDER_ROWS) {
            const tail = document.createElement('tr');
            tail.innerHTML = `<td colspan="6" class="rb-empty">แสดง ${MAX_RENDER_ROWS} รายการแรกจากทั้งหมด ${servers.length} รายการ</td>`;
            elements.tbody.appendChild(tail);
        }
    }

    async function scanServers(placeId, settings, elements, isForcedRefresh) {
        if (!placeId) {
            elements.status.textContent = 'ไม่พบ Place ID ของเกมนี้';
            return;
        }

        const now = Date.now();
        if (
            !isForcedRefresh &&
            state.cache &&
            state.cache.placeId === placeId &&
            state.cache.maxPing === settings.maxPing &&
            state.cache.minFreeSlots === settings.minFreeSlots &&
            state.cache.maxPages === settings.maxPages &&
            now - state.cache.timestamp < CACHE_TTL_MS
        ) {
            state.latestPool = state.cache.pool;
            state.latestFiltered = sortServers(
                state.latestPool.filter((server) => matchRegionFilter(server.regionTag || 'unknown', settings.regionFilter)),
                settings.sortBy,
            );
            state.latestScannedCount = state.cache.scannedCount;
            renderStats(elements, state.latestFiltered, state.latestScannedCount);
            renderTable(elements, placeId, state.latestFiltered);
            elements.status.textContent = 'ใช้ข้อมูลล่าสุดจากแคช (ไม่เกิน 45 วินาที)';
            return;
        }

        state.scanning = true;
        state.scanToken += 1;
        const currentToken = state.scanToken;

        elements.scanBtn.disabled = true;
        elements.rescanBtn.disabled = true;
        elements.cancelBtn.disabled = false;
        elements.status.textContent = 'กำลังสแกนเซิร์ฟเวอร์...';
        elements.tbody.innerHTML = '<tr><td colspan="5" class="rb-empty">กำลังค้นหาเซิร์ฟเวอร์ปิงต่ำ โปรดรอสักครู่...</td></tr>';
        elements.progressFill.style.width = '0%';

        const maxPages = Math.max(1, Math.min(20, Number(settings.maxPages) || defaultSettings.maxPages));
        const maxPing = Math.max(1, Number(settings.maxPing) || defaultSettings.maxPing);
        const minFreeSlots = Math.max(0, Number(settings.minFreeSlots) || defaultSettings.minFreeSlots);
        const regionFilter = REGION_OPTIONS.some((r) => r.value === settings.regionFilter) ? settings.regionFilter : 'all';

        let cursor = '';
        let scannedCount = 0;
        let pool = [];

        try {
            for (let page = 0; page < maxPages; page += 1) {
                if (!state.scanning || currentToken !== state.scanToken) {
                    elements.status.textContent = 'ยกเลิกการสแกนแล้ว';
                    break;
                }

                const progress = Math.round(((page + 1) / maxPages) * 100);
                elements.progressFill.style.width = `${progress}%`;
                elements.status.textContent = `กำลังสแกนหน้า ${page + 1}/${maxPages}...`;

                const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100&cursor=${cursor}`;
                const payload = await requestJsonWithRetry(url, 3);

                if (!payload?.data || !Array.isArray(payload.data)) break;

                scannedCount += payload.data.length;

                const matched = payload.data.filter((server) => {
                    const ping = Number(server.ping);
                    const playing = Number(server.playing) || 0;
                    const maxPlayers = Number(server.maxPlayers) || 0;
                    const freeSlots = maxPlayers - playing;
                    const regionTag = detectRegionTag(server);

                    if (!Number.isFinite(ping) || ping <= 0 || ping > 1000) return false;
                    if (freeSlots < minFreeSlots || playing >= maxPlayers) return false;

                    server.regionTag = regionTag;
                    return ping <= maxPing;
                });

                pool = pool.concat(matched);

                cursor = payload.nextPageCursor;
                if (!cursor) break;
            }

            pool = dedupeServers(pool);
            const filtered = sortServers(
                pool.filter((server) => matchRegionFilter(server.regionTag || 'unknown', regionFilter)),
                settings.sortBy,
            );
            state.latestPool = pool;
            state.latestFiltered = filtered;
            state.latestScannedCount = scannedCount;
            state.cache = {
                placeId,
                timestamp: Date.now(),
                scannedCount,
                pool,
                maxPing,
                minFreeSlots,
                maxPages,
            };

            renderStats(elements, filtered, scannedCount);
            renderTable(elements, placeId, filtered);

            if (state.scanning) {
                const unknownCount = filtered.filter((s) => s.regionTag === 'unknown').length;
                elements.status.textContent = `สแกนเสร็จ: พบ ${filtered.length}/${scannedCount} | Unknown region ${unknownCount}`;
            }
        } catch (error) {
            elements.status.textContent = `เกิดข้อผิดพลาดระหว่างสแกน: ${error.message}`;
            elements.tbody.innerHTML = '<tr><td colspan="6" class="rb-empty">โหลดข้อมูลไม่สำเร็จ ลองกด Scan ใหม่อีกครั้ง</td></tr>';
        } finally {
            state.scanning = false;
            elements.scanBtn.disabled = false;
            elements.rescanBtn.disabled = false;
            elements.cancelBtn.disabled = true;
        }
    }

    function buildDashboard(target) {
        if (document.getElementById(DASHBOARD_ID)) return;
        ensureStyles();

        const settings = loadSettings();
        const placeId = getPlaceId();

        const root = document.createElement('section');
        root.id = DASHBOARD_ID;
        root.innerHTML = `
            <div class="rb-head">
                <div>
                    <h3 class="rb-title">🎯 Roblox Low Ping Server Finder</h3>
                    <p id="rb-status" class="rb-sub">พร้อมค้นหาเซิร์ฟเวอร์ที่ปิงต่ำและเข้าได้ไวขึ้น</p>
                </div>
                <div class="rb-actions">
                    <button id="rb-scan-btn">SCAN NOW</button>
                    <button id="rb-rescan-btn" class="rb-btn-secondary">FORCE REFRESH</button>
                    <button id="rb-cancel-btn" class="rb-btn-danger" disabled>CANCEL</button>
                </div>
            </div>

            <div class="rb-grid">
                <div class="rb-stat"><p class="k">Scanned Servers</p><p id="rb-stat-scanned" class="v">0</p></div>
                <div class="rb-stat"><p class="k">Matched Result</p><p id="rb-stat-match" class="v">0</p></div>
                <div class="rb-stat"><p class="k">Best Ping</p><p id="rb-stat-best" class="v">-</p></div>
                <div class="rb-stat"><p class="k">Average Ping</p><p id="rb-stat-avg" class="v">-</p></div>
            </div>

            <div class="rb-controls">
                <div class="rb-field">
                    <label for="rb-max-ping">Max Ping (ms)</label>
                    <input id="rb-max-ping" type="number" min="1" max="500" value="${settings.maxPing}" />
                </div>
                <div class="rb-field">
                    <label for="rb-max-pages">Scan Pages (1-20)</label>
                    <input id="rb-max-pages" type="number" min="1" max="20" value="${settings.maxPages}" />
                </div>
                <div class="rb-field">
                    <label for="rb-min-free-slots">Minimum Free Slots</label>
                    <input id="rb-min-free-slots" type="number" min="0" max="100" value="${settings.minFreeSlots}" />
                </div>
                <div class="rb-field">
                    <label for="rb-sort-by">Sort By</label>
                    <select id="rb-sort-by">
                        <option value="ping" ${settings.sortBy === 'ping' ? 'selected' : ''}>Lowest Ping</option>
                        <option value="players" ${settings.sortBy === 'players' ? 'selected' : ''}>Least Players</option>
                        <option value="balanced" ${settings.sortBy === 'balanced' ? 'selected' : ''}>Balanced</option>
                    </select>
                </div>
                <div class="rb-field">
                    <label for="rb-region-filter">Region</label>
                    <select id="rb-region-filter">
                        ${REGION_OPTIONS.map((option) => `<option value="${option.value}" ${settings.regionFilter === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="rb-progress"><div id="rb-progress-fill" class="rb-progress-fill"></div></div>

            <div class="rb-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th style="width:70px;">#</th>
                            <th>Players</th>
                            <th style="width:120px;">Ping</th>
                            <th style="width:170px;">Region</th>
                            <th>Instance ID</th>
                            <th class="rb-right" style="width:120px;">Action</th>
                        </tr>
                    </thead>
                    <tbody id="rb-tbody">
                        <tr><td colspan="6" class="rb-empty">ยังไม่มีข้อมูล กด Scan Now เพื่อเริ่มค้นหา</td></tr>
                    </tbody>
                </table>
            </div>
        `;

        target.after(root);
        const elements = getDashboardElements(root);

        const saveAndMaybeResort = () => {
            const newSettings = {
                maxPing: Math.max(1, Math.min(500, Number(elements.maxPing.value) || defaultSettings.maxPing)),
                maxPages: Math.max(1, Math.min(20, Number(elements.maxPages.value) || defaultSettings.maxPages)),
                minFreeSlots: Math.max(0, Math.min(100, Number(elements.minFreeSlots.value) || defaultSettings.minFreeSlots)),
                sortBy: ['ping', 'players', 'balanced'].includes(elements.sortBy.value) ? elements.sortBy.value : 'ping',
                regionFilter: REGION_OPTIONS.some((r) => r.value === elements.regionFilter.value)
                    ? elements.regionFilter.value
                    : 'all',
            };

            elements.maxPing.value = String(newSettings.maxPing);
            elements.maxPages.value = String(newSettings.maxPages);
            elements.minFreeSlots.value = String(newSettings.minFreeSlots);
            elements.sortBy.value = newSettings.sortBy;
            elements.regionFilter.value = newSettings.regionFilter;

            saveSettings(newSettings);

            if (state.latestPool.length) {
                const rerender = sortServers(
                    state.latestPool.filter((server) => matchRegionFilter(server.regionTag || 'unknown', newSettings.regionFilter)),
                    newSettings.sortBy,
                );
                state.latestFiltered = rerender;
                renderTable(elements, placeId, rerender);
                renderStats(elements, rerender, state.latestScannedCount);
            }

            return newSettings;
        };

        [elements.maxPing, elements.maxPages, elements.minFreeSlots, elements.sortBy, elements.regionFilter].forEach((input) => {
            input.addEventListener('change', saveAndMaybeResort);
        });

        elements.tbody.addEventListener('click', (event) => {
            const targetButton = event.target.closest('.rb-join-btn');
            if (!targetButton) return;
            const instanceId = targetButton.dataset.instance;
            const safePlaceId = elements.tbody.dataset.placeId || placeId;
            if (!instanceId || !safePlaceId) return;
            window.location.href = `roblox://placeId=${safePlaceId}&gameInstanceId=${instanceId}`;
        });

        elements.scanBtn.addEventListener('click', async () => {
            const activeSettings = saveAndMaybeResort();
            await scanServers(placeId, activeSettings, elements, false);
        });

        elements.rescanBtn.addEventListener('click', async () => {
            const activeSettings = saveAndMaybeResort();
            await scanServers(placeId, activeSettings, elements, true);
        });

        elements.cancelBtn.addEventListener('click', () => {
            state.scanning = false;
            state.scanToken += 1;
            elements.status.textContent = 'กำลังยกเลิกการสแกน...';
            elements.cancelBtn.disabled = true;
            elements.scanBtn.disabled = false;
            elements.rescanBtn.disabled = false;
        });
    }

    function tryInject() {
        const target = document.querySelector('.server-list-options') || document.querySelector('#rbx-running-games');
        if (!target) return;
        buildDashboard(target);
    }

    let lastUrl = window.location.href;
    setInterval(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            const old = document.getElementById(DASHBOARD_ID);
            if (old) old.remove();
            state.cache = null;
            state.latestPool = [];
            state.latestFiltered = [];
            state.latestScannedCount = 0;
        }
        tryInject();
    }, 1500);

    tryInject();
})();