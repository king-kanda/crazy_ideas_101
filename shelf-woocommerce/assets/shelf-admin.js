/**
 * Shelf for WooCommerce — Admin JavaScript
 *
 * Handles:
 *  - CSS tab switching on the Insights page
 *  - Fetching demand, store, and activity data from the Shelf API
 *  - Rendering Chart.js charts and populating data tables / UI widgets
 */

/* global SHELF_ADMIN */

(function () {
    'use strict';

    // =========================================================================
    // Guard: only run when SHELF_ADMIN is defined (i.e. Shelf pages only)
    // =========================================================================
    if (typeof SHELF_ADMIN === 'undefined') return;

    const { api_url, api_key, store_id } = SHELF_ADMIN;

    // =========================================================================
    // Utilities
    // =========================================================================

    /**
     * Fetch a Shelf API endpoint and return parsed JSON.
     * Rejects with an Error whose message is safe to display.
     *
     * @param {string} endpoint  Relative path, e.g. /insights/{storeId}/demand
     * @returns {Promise<any>}
     */
    async function shelfFetch(endpoint) {
        if (!api_key || !store_id) {
            throw new Error('Shelf is not configured. Please save your API key in Settings.');
        }
        const url = api_url.replace(/\/$/, '') + endpoint;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Shelf-API-Key': api_key,
                'Accept': 'application/json',
            },
        });
        if (!response.ok) {
            let msg = `HTTP ${response.status}`;
            try {
                const body = await response.json();
                if (body && body.message) msg = body.message;
            } catch (_) { /* ignore JSON parse errors */ }
            throw new Error(msg);
        }
        return response.json();
    }

    /**
     * Safely get an element, returns null if not found.
     * @param {string} id
     * @returns {HTMLElement|null}
     */
    function el(id) {
        return document.getElementById(id);
    }

    /**
     * Format a number with thousands separators.
     * @param {number} n
     * @returns {string}
     */
    function fmt(n) {
        if (n == null) return '—';
        return Number(n).toLocaleString();
    }

    /**
     * Format a monetary value.
     * @param {number} n
     * @param {string} [currency='USD']
     * @returns {string}
     */
    function fmtCurrency(n, currency = 'USD') {
        if (n == null) return '—';
        try {
            return new Intl.NumberFormat(navigator.language || 'en-US', {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
            }).format(n);
        } catch (_) {
            return '$' + fmt(n);
        }
    }

    /**
     * Render an error message inside a container element.
     * @param {HTMLElement} container
     * @param {string} message
     */
    function renderError(container, message) {
        if (!container) return;
        container.innerHTML = `<div class="shelf-error"><strong>Error:</strong> ${escHtml(message)}</div>`;
    }

    /**
     * Minimal HTML escaping to prevent XSS when inserting API strings.
     * @param {string} str
     * @returns {string}
     */
    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // =========================================================================
    // Tab switching
    // =========================================================================

    function initTabs() {
        const tabs = document.querySelectorAll('.shelf-tab');
        if (!tabs.length) return;

        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                // Deactivate all tabs and hide all panels.
                tabs.forEach(function (t) {
                    t.classList.remove('shelf-tab--active');
                    t.setAttribute('aria-selected', 'false');
                });
                document.querySelectorAll('.shelf-tab-panel').forEach(function (panel) {
                    panel.classList.add('shelf-tab-panel--hidden');
                });

                // Activate clicked tab and show its panel.
                tab.classList.add('shelf-tab--active');
                tab.setAttribute('aria-selected', 'true');
                const targetId = tab.getAttribute('data-tab');
                const panel = el(targetId);
                if (panel) panel.classList.remove('shelf-tab-panel--hidden');
            });
        });
    }

    // =========================================================================
    // Chart.js loader (CDN)
    // =========================================================================

    /** @type {Promise<void>} */
    let chartJsPromise = null;

    function loadChartJs() {
        if (chartJsPromise) return chartJsPromise;
        if (typeof Chart !== 'undefined') {
            chartJsPromise = Promise.resolve();
            return chartJsPromise;
        }
        chartJsPromise = new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = resolve;
            script.onerror = function () { reject(new Error('Failed to load Chart.js from CDN.')); };
            document.head.appendChild(script);
        });
        return chartJsPromise;
    }

    // =========================================================================
    // Demand tab
    // =========================================================================

    async function loadDemand() {
        if (!store_id) return;

        let data;
        try {
            data = await shelfFetch(`/insights/${encodeURIComponent(store_id)}/demand`);
        } catch (err) {
            renderError(document.querySelector('#tab-demand'), err.message);
            return;
        }

        renderTopSearches(data.top_searches || []);
        renderTrendChart(data.trend || []);
        renderGaps(data.gaps || []);
    }

    /**
     * Populate the #shelf-top-searches table.
     * @param {Array<{term:string, volume:number, avg_results:number, trend:string}>} searches
     */
    function renderTopSearches(searches) {
        const tbody = document.querySelector('#shelf-top-searches tbody');
        if (!tbody) return;

        if (!searches.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="shelf-empty">No search data yet.</td></tr>';
            return;
        }

        tbody.innerHTML = searches.map(function (s) {
            const trendArrow = s.trend === 'up'   ? '&#8593;' :
                               s.trend === 'down' ? '&#8595;' : '&#8212;';
            const trendColor = s.trend === 'up'   ? '#16a34a' :
                               s.trend === 'down' ? '#dc2626' : '#6b7280';
            return `<tr>
                <td><strong>${escHtml(s.term)}</strong></td>
                <td>${fmt(s.volume)}</td>
                <td>${fmt(s.avg_results)}</td>
                <td style="color:${trendColor};font-weight:700;">${trendArrow}</td>
            </tr>`;
        }).join('');
    }

    /**
     * Render a bar chart on #shelf-trend-chart.
     * @param {Array<{label:string, count:number}>} trend
     */
    async function renderTrendChart(trend) {
        const canvas = el('shelf-trend-chart');
        if (!canvas) return;

        if (!trend.length) {
            canvas.parentElement.innerHTML = '<p class="shelf-empty">No trend data yet.</p>';
            return;
        }

        try {
            await loadChartJs();
        } catch (err) {
            canvas.parentElement.innerHTML = `<div class="shelf-error">${escHtml(err.message)}</div>`;
            return;
        }

        // Destroy previous instance if any.
        if (canvas._shelfChart) canvas._shelfChart.destroy();

        canvas._shelfChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: trend.map(function (d) { return d.label; }),
                datasets: [{
                    label: 'Search Volume',
                    data: trend.map(function (d) { return d.count; }),
                    backgroundColor: 'rgba(92, 110, 232, 0.7)',
                    borderColor: 'rgba(92, 110, 232, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) { return ' ' + fmt(ctx.parsed.y) + ' searches'; },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                        grid: { color: 'rgba(0,0,0,.06)' },
                    },
                    x: {
                        grid: { display: false },
                    },
                },
            },
        });
    }

    /**
     * Render demand-gap alert cards in #shelf-gaps.
     * @param {Array<{term:string, volume:number, results:number, severity:'high'|'medium'|'low'}>} gaps
     */
    function renderGaps(gaps) {
        const container = el('shelf-gaps');
        if (!container) return;

        if (!gaps.length) {
            container.innerHTML = '<p class="shelf-empty">No demand gaps detected. Great catalog coverage!</p>';
            return;
        }

        container.innerHTML = gaps.map(function (g) {
            const sev = ['high', 'medium', 'low'].includes(g.severity) ? g.severity : 'low';
            return `<div class="shelf-gap shelf-gap--${escHtml(sev)}">
                <span class="shelf-gap-term">${escHtml(g.term)}</span>
                <span class="shelf-gap-meta">${fmt(g.volume)} searches &bull; ${fmt(g.results)} results</span>
                <span class="shelf-gap-badge">${escHtml(sev)}</span>
            </div>`;
        }).join('');
    }

    // =========================================================================
    // Store Health tab
    // =========================================================================

    async function loadStore() {
        if (!store_id) return;

        let data;
        try {
            data = await shelfFetch(`/insights/${encodeURIComponent(store_id)}/store`);
        } catch (err) {
            renderError(document.querySelector('#tab-store'), err.message);
            return;
        }

        renderFunnel(data.funnel || []);
        renderAbandonProducts(data.abandoned_products || []);
        renderTopSellers(data.top_sellers || []);
    }

    /**
     * Render the conversion funnel inside #shelf-funnel.
     * @param {Array<{stage:string, count:number}>} funnel
     */
    function renderFunnel(funnel) {
        const container = el('shelf-funnel');
        if (!container) return;

        if (!funnel.length) {
            container.innerHTML = '<p class="shelf-empty">No funnel data yet.</p>';
            return;
        }

        const max = funnel.reduce(function (m, s) { return Math.max(m, s.count); }, 1);

        container.innerHTML = funnel.map(function (step) {
            const pct = Math.round((step.count / max) * 100);
            return `<div class="shelf-funnel-step">
                <span class="shelf-funnel-label">${escHtml(step.stage)}</span>
                <div class="shelf-funnel-bar-wrap">
                    <div class="shelf-funnel-bar" style="width:${pct}%">
                        <span class="shelf-funnel-bar-value">${fmt(step.count)}</span>
                    </div>
                </div>
                <span class="shelf-funnel-pct">${pct}%</span>
            </div>`;
        }).join('');
    }

    /**
     * Populate #shelf-abandon-products table.
     * @param {Array<{name:string, abandons:number, cart_rate:number}>} products
     */
    function renderAbandonProducts(products) {
        const tbody = document.querySelector('#shelf-abandon-products tbody');
        if (!tbody) return;

        if (!products.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="shelf-empty">No abandonment data yet.</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(function (p) {
            return `<tr>
                <td>${escHtml(p.name)}</td>
                <td>${fmt(p.abandons)}</td>
                <td>${(+p.cart_rate).toFixed(1)}%</td>
            </tr>`;
        }).join('');
    }

    /**
     * Populate #shelf-top-sellers table.
     * @param {Array<{name:string, units:number, revenue:number, currency:string}>} products
     */
    function renderTopSellers(products) {
        const tbody = document.querySelector('#shelf-top-sellers tbody');
        if (!tbody) return;

        if (!products.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="shelf-empty">No sales data yet.</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(function (p) {
            return `<tr>
                <td>${escHtml(p.name)}</td>
                <td>${fmt(p.units)}</td>
                <td>${fmtCurrency(p.revenue, p.currency || 'USD')}</td>
            </tr>`;
        }).join('');
    }

    // =========================================================================
    // Activity tab
    // =========================================================================

    async function loadActivity() {
        if (!store_id) return;

        let data;
        try {
            data = await shelfFetch(`/insights/${encodeURIComponent(store_id)}/activity`);
        } catch (err) {
            renderError(document.querySelector('#tab-activity'), err.message);
            return;
        }

        renderActivityChart(data.hourly || []);
        renderPeakHours(data.hourly || []);
    }

    /**
     * Render the 24-hour activity heatmap bar chart on #shelf-activity-chart.
     * @param {Array<{hour:number, views:number, users:number}>} hourly  Array of 24 objects
     */
    async function renderActivityChart(hourly) {
        const canvas = el('shelf-activity-chart');
        if (!canvas) return;

        if (!hourly.length) {
            canvas.parentElement.innerHTML = '<p class="shelf-empty">No activity data yet.</p>';
            return;
        }

        try {
            await loadChartJs();
        } catch (err) {
            canvas.parentElement.innerHTML = `<div class="shelf-error">${escHtml(err.message)}</div>`;
            return;
        }

        if (canvas._shelfChart) canvas._shelfChart.destroy();

        // Build full 24-slot array (fill missing hours with 0).
        const slots = Array.from({ length: 24 }, function (_, i) { return i; }).map(function (h) {
            const found = hourly.find(function (d) { return Number(d.hour) === h; });
            return { hour: h, views: found ? found.views : 0, users: found ? found.users : 0 };
        });

        const labels = slots.map(function (s) {
            const ampm = s.hour < 12 ? 'am' : 'pm';
            const display = s.hour % 12 === 0 ? 12 : s.hour % 12;
            return display + ampm;
        });

        const maxViews = Math.max(...slots.map(function (s) { return s.views; }), 1);

        canvas._shelfChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Page Views',
                        data: slots.map(function (s) { return s.views; }),
                        backgroundColor: slots.map(function (s) {
                            const intensity = s.views / maxViews;
                            const r = Math.round(92  + (26  - 92)  * intensity);
                            const g = Math.round(110 + (31  - 110) * intensity);
                            const b = Math.round(232 + (54  - 232) * intensity);
                            return `rgba(${r},${g},${b},0.85)`;
                        }),
                        borderRadius: 3,
                        order: 1,
                    },
                    {
                        label: 'Unique Visitors',
                        data: slots.map(function (s) { return s.users; }),
                        type: 'line',
                        borderColor: 'rgba(234,88,12,0.9)',
                        backgroundColor: 'rgba(234,88,12,0.1)',
                        pointRadius: 3,
                        fill: false,
                        tension: 0.4,
                        order: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { boxWidth: 12, font: { size: 11 } },
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y);
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                        grid: { color: 'rgba(0,0,0,.05)' },
                    },
                    x: { grid: { display: false } },
                },
            },
        });
    }

    /**
     * Render peak hour badges in #shelf-peak-hours.
     * @param {Array<{hour:number, views:number, users:number}>} hourly
     */
    function renderPeakHours(hourly) {
        const container = el('shelf-peak-hours');
        if (!container) return;

        if (!hourly.length) {
            container.innerHTML = '<p class="shelf-empty">No activity data yet.</p>';
            return;
        }

        // Sort by views descending.
        const sorted = [...hourly].sort(function (a, b) { return b.views - a.views; });
        const topHours = new Set(sorted.slice(0, 5).map(function (d) { return Number(d.hour); }));

        // Build full 24-slot display.
        const slots = Array.from({ length: 24 }, function (_, i) { return i; }).map(function (h) {
            const found = hourly.find(function (d) { return Number(d.hour) === h; });
            return { hour: h, views: found ? found.views : 0 };
        });

        container.innerHTML = slots.map(function (s) {
            const isTop = topHours.has(s.hour);
            const ampm  = s.hour < 12 ? 'am' : 'pm';
            const label = (s.hour % 12 === 0 ? 12 : s.hour % 12) + ampm;
            return `<div class="shelf-peak-hour${isTop ? ' shelf-peak-hour--top' : ''}">
                <span class="shelf-peak-time">${label}</span>
                <span class="shelf-peak-count">${fmt(s.views)}</span>
            </div>`;
        }).join('');
    }

    // =========================================================================
    // Initialise
    // =========================================================================

    document.addEventListener('DOMContentLoaded', function () {
        initTabs();

        // Only load insights data if the insights page elements are present.
        if (el('tab-demand')) {
            loadDemand();
            loadStore();
            loadActivity();
        }
    });

}());
