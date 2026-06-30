        // LOCAL STORAGE KEY
const STORAGE_KEY = 'codespace_planner_data';

const EWMA_ALPHA = 0.15;
const SESSION_DWELL_CAP_MS = 1_800_000;
const WARMUP_EVENTS = 10;
const PRIMARY_SLOT_BUDGET = 5;
const RECENT_MAX = 3;
const PROJECT_VISIBLE_MAX = 5;

const NAV_ITEMS = [
    {
        id: 'tasks',
        label: 'Tasks',
        badgeId: 'badge-tasks',
        icon: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>'
    },
    {
        id: 'projects',
        label: 'Projects',
        badgeId: 'badge-projects',
        icon: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>'
    },
    {
        id: 'calendar',
        label: 'Calendar',
        icon: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'
    },
    {
        id: 'skills',
        label: 'Skills Folder',
        badgeId: 'badge-skills',
        icon: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>'
    },
    {
        id: 'inbox',
        label: 'Inbox',
        badgeId: 'badge-inbox',
        icon: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>'
    },
    {
        id: 'daily_report',
        label: 'Daily Report',
        icon: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>'
    },
    {
        id: 'agent_runner',
        label: 'Agent Runner',
        icon: '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>'
    }
];

function createDefaultNavUsage() {
    return {
        lastView: 'tasks',
        recentViews: [],
        pins: ['tasks'],
        views: {},
        projects: {},
        moreExpanded: false,
        moreProjectsExpanded: false,
        totalEvents: 0
    };
}

// DEFAULT / INITIAL DATA
const DEFAULT_DATA = {
    theme: 'light-theme',
    dailyNotes: {},
    projects: [],
    skills: [],
    tasks: [],
    navUsage: createDefaultNavUsage()
};

// STATE MANAGEMENT
class AppState {
    constructor() {
        this.data = this.loadData();
        const validViews = NAV_ITEMS.map(n => n.id);
        const lastView = this.data.navUsage?.lastView;
        this.currentView = validViews.includes(lastView) ? lastView : 'tasks';
        this.taskViewMode = 'list';
        this.filters = { search: '', projectId: '' };
        this.calendarDate = new Date();
        this.draggedTaskId = null;
        this.projectMemory = null;
        this.inbox = [];
        this.agentRegistry = [];
        this.agentQueue = [];
        this.latestDigest = null;
        this._sidebarNavBuilt = false;
        this._sidebarProjectsBuilt = false;
        this._sidebarProjectCount = -1;
        this._viewEnteredAt = null;
        this._sessionDwellByView = {};
        this._navUsageSaveTimer = null;
        this.questionMode = false;
        this._lastEmptyEnterAt = 0;
        this._emptyEnterWindowMs = 400;

        this.init();
    }

    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    openModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove('hidden', 'closing');
        modalEl.classList.add('open');
    }

    closeModal(modalEl) {
        if (!modalEl || modalEl.classList.contains('hidden')) return;
        if (this.prefersReducedMotion()) {
            modalEl.classList.add('hidden');
            modalEl.classList.remove('open', 'closing');
            return;
        }
        modalEl.classList.remove('open');
        modalEl.classList.add('closing');
        const finish = () => {
            modalEl.classList.add('hidden');
            modalEl.classList.remove('closing');
        };
        const onEnd = (e) => {
            if (e.target !== modalEl) return;
            modalEl.removeEventListener('animationend', onEnd);
            clearTimeout(fallback);
            finish();
        };
        modalEl.addEventListener('animationend', onEnd);
        const fallback = setTimeout(finish, 280);
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => this.closeModal(m));
    }

    staggerChildren(container, selector = ':scope > *') {
        if (!container || this.prefersReducedMotion()) return;
        container.querySelectorAll(selector).forEach((el, i) => {
            el.classList.add('stagger-in');
            el.style.animationDelay = `${Math.min(i * 45, 450)}ms`;
        });
    }

    animateViewEnter(section) {
        if (!section || this.prefersReducedMotion()) return;
        section.classList.remove('view-enter');
        void section.offsetWidth;
        section.classList.add('view-enter');
        section.addEventListener('animationend', () => section.classList.remove('view-enter'), { once: true });
    }

    animateTitle(titleEl) {
        if (!titleEl || this.prefersReducedMotion()) return;
        titleEl.classList.remove('title-animate');
        void titleEl.offsetWidth;
        titleEl.classList.add('title-animate');
    }

    popBadge(badgeEl) {
        if (!badgeEl || this.prefersReducedMotion()) return;
        badgeEl.classList.remove('badge-pop');
        void badgeEl.offsetWidth;
        badgeEl.classList.add('badge-pop');
    }

    popMetric(metricEl) {
        if (!metricEl || this.prefersReducedMotion()) return;
        metricEl.classList.remove('metric-pop');
        void metricEl.offsetWidth;
        metricEl.classList.add('metric-pop');
    }

    createDefaultData() {
        return {
            theme: 'light-theme',
            dailyNotes: {},
            projects: [],
            skills: [],
            tasks: [],
            navUsage: createDefaultNavUsage()
        };
    }

    normalizeNavUsage(raw) {
        const defaults = createDefaultNavUsage();
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
        return {
            lastView: typeof raw.lastView === 'string' ? raw.lastView : defaults.lastView,
            recentViews: Array.isArray(raw.recentViews) ? raw.recentViews.filter(id => typeof id === 'string').slice(0, RECENT_MAX) : defaults.recentViews,
            pins: Array.isArray(raw.pins) && raw.pins.length ? raw.pins.filter(id => typeof id === 'string') : defaults.pins,
            views: raw.views && typeof raw.views === 'object' && !Array.isArray(raw.views) ? raw.views : defaults.views,
            projects: raw.projects && typeof raw.projects === 'object' && !Array.isArray(raw.projects) ? raw.projects : defaults.projects,
            moreExpanded: Boolean(raw.moreExpanded),
            moreProjectsExpanded: Boolean(raw.moreProjectsExpanded),
            totalEvents: typeof raw.totalEvents === 'number' && raw.totalEvents >= 0 ? raw.totalEvents : defaults.totalEvents
        };
    }

    normalizeData(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return this.createDefaultData();
        }
        return {
            theme: data.theme || 'light-theme',
            dailyNotes: data.dailyNotes && typeof data.dailyNotes === 'object' && !Array.isArray(data.dailyNotes) ? data.dailyNotes : {},
            projects: Array.isArray(data.projects) ? data.projects : [],
            skills: Array.isArray(data.skills) ? data.skills : [],
            tasks: Array.isArray(data.tasks) ? data.tasks : [],
            navUsage: this.normalizeNavUsage(data.navUsage)
        };
    }

    isLegacySampleData(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
        const sampleProjectIds = ['proj-1', 'proj-2', 'proj-3'];
        const sampleTaskIds = ['task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6'];
        const sampleSkillIds = ['skill-1', 'skill-2', 'skill-3'];
        const hasSampleProject = Array.isArray(data.projects) && data.projects.some(p => sampleProjectIds.includes(p.id));
        const hasSampleTask = Array.isArray(data.tasks) && data.tasks.some(t => sampleTaskIds.includes(t.id));
        const hasSampleSkill = Array.isArray(data.skills) && data.skills.some(s => sampleSkillIds.includes(s.id));
        return hasSampleProject || hasSampleTask || hasSampleSkill;
    }

    loadData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (this.isLegacySampleData(parsed)) {
                    console.info('Legacy sample data detected. Resetting workspace to an empty state.');
                    return this.createDefaultData();
                }
                return this.normalizeData(parsed);
            } catch (e) {
                console.error('Error parsing localStorage data, using defaults:', e);
            }
        }
        return this.createDefaultData();
    }

    async loadDashboard() {
        try {
            const res = await fetch('/api/dashboard');
            if (!res.ok) return;
            const apiData = await res.json();
            if (apiData.updated_at || (apiData.tasks && apiData.tasks.length) || (apiData.projects && apiData.projects.length)) {
                this.data = this.normalizeData(apiData);
                return;
            }
        } catch (e) {
            console.warn('Could not load dashboard from API:', e);
        }
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (!this.isLegacySampleData(parsed)) {
                    this.data = this.normalizeData(parsed);
                    await this.persistDashboard();
                }
            } catch (e) {
                console.warn('Could not migrate localStorage dashboard:', e);
            }
        }
    }

    async persistDashboard() {
        try {
            await fetch('/api/dashboard', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.data)
            });
        } catch (e) {
            console.warn('Could not persist dashboard:', e);
        }
    }

    async loadAgentRegistry() {
        try {
            const res = await fetch('/api/agents/registry');
            if (res.ok) {
                const data = await res.json();
                this.agentRegistry = Array.isArray(data.agents) ? data.agents : [];
            }
        } catch (e) {
            console.warn('Could not load agent registry:', e);
        }
    }

    async loadQueue() {
        try {
            const res = await fetch('/api/queue');
            if (res.ok) {
                const data = await res.json();
                this.agentQueue = Array.isArray(data.items) ? data.items : [];
            }
        } catch (e) {
            console.warn('Could not load agent queue:', e);
        }
    }

    async loadLatestDigest() {
        try {
            const res = await fetch('/api/digests/latest');
            if (res.ok) {
                this.latestDigest = await res.json();
            }
        } catch (e) {
            this.latestDigest = null;
        }
    }

    async loadProjectMemory() {
        try {
            const res = await fetch('/api/memory/cortex');
            if (res.ok) {
                this.projectMemory = await res.json();
            }
        } catch (e) {
            console.warn('Could not load project memory:', e);
        }
    }

    async loadInbox() {
        try {
            const res = await fetch('/api/inbox');
            if (res.ok) {
                const data = await res.json();
                this.inbox = Array.isArray(data.items) ? data.items : [];
            }
        } catch (e) {
            console.warn('Could not load inbox:', e);
        }
    }

    async addToInbox(content) {
        try {
            const res = await fetch('/api/inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            if (res.ok) {
                const item = await res.json();
                this.inbox.unshift(item);
                this.renderSidebar();
                if (this.currentView === 'inbox') this.renderInbox();
                if (this.currentView === 'daily_report') this.renderDailyReport();
                return item;
            }
        } catch (e) {
            console.warn('Could not save to inbox:', e);
        }
        return null;
    }

    async markInboxProcessed(id) {
        try {
            const res = await fetch(`/api/inbox/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'processed' })
            });
            if (res.ok) {
                const item = await res.json();
                const idx = this.inbox.findIndex(i => i.id === id);
                if (idx !== -1) this.inbox[idx] = item;
                this.renderSidebar();
                if (this.currentView === 'inbox') this.renderInbox();
                if (this.currentView === 'daily_report') this.renderDailyReport();
            }
        } catch (e) {
            console.warn('Could not update inbox item:', e);
        }
    }

    getYesterdayIso() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(23, 59, 59, 999);
        return d.toISOString();
    }

    getMemoryIdeasSince(isoDate) {
        if (!this.projectMemory || !Array.isArray(this.projectMemory.ideas)) return [];
        return this.projectMemory.ideas.filter(idea => idea.created_at > isoDate);
    }

    getOpenPainPoints() {
        if (!this.projectMemory || !Array.isArray(this.projectMemory.pain_points)) return [];
        return this.projectMemory.pain_points.filter(p => p.status === 'open' || p.status === 'in_progress');
    }

    getPendingInboxCount() {
        return this.inbox.filter(i => i.status === 'pending').length;
    }

    ensureNavUsage() {
        if (!this.data.navUsage) {
            this.data.navUsage = createDefaultNavUsage();
        }
        return this.data.navUsage;
    }

    ensureViewStats(nav, viewId) {
        if (!nav.views[viewId]) {
            nav.views[viewId] = { clicks: 0, dwellMs: 0, lastVisited: null, ewma: 0 };
        }
        return nav.views[viewId];
    }

    ensureProjectStats(nav, projectId) {
        if (!nav.projects[projectId]) {
            nav.projects[projectId] = { clicks: 0, dwellMs: 0, lastVisited: null, ewma: 0 };
        }
        return nav.projects[projectId];
    }

    saveNavUsage() {
        clearTimeout(this._navUsageSaveTimer);
        this._navUsageSaveTimer = setTimeout(() => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        }, 300);
    }

    getViewScore(viewId) {
        const nav = this.ensureNavUsage();
        const stats = nav.views[viewId];
        let score = stats?.ewma || 0;
        if (viewId === 'inbox' && this.getPendingInboxCount() > 0) score += 3;
        return score;
    }

    getProjectScore(projectId) {
        const nav = this.ensureNavUsage();
        return nav.projects[projectId]?.ewma || 0;
    }

    recordNavEvent(type, id, { isClick = false } = {}) {
        const nav = this.ensureNavUsage();
        const now = new Date().toISOString();

        if (type === 'view') {
            nav.recentViews = [id, ...(nav.recentViews || []).filter(v => v !== id)].slice(0, RECENT_MAX);
            nav.lastView = id;
            const stats = this.ensureViewStats(nav, id);
            if (isClick) {
                stats.clicks = (stats.clicks || 0) + 1;
                stats.ewma = (stats.ewma || 0) * (1 - EWMA_ALPHA) + 1.0 * EWMA_ALPHA;
                nav.totalEvents = (nav.totalEvents || 0) + 1;
            }
            stats.lastVisited = now;
        } else if (type === 'project') {
            const stats = this.ensureProjectStats(nav, id);
            if (isClick) {
                stats.clicks = (stats.clicks || 0) + 1;
                stats.ewma = (stats.ewma || 0) * (1 - EWMA_ALPHA) + 1.0 * EWMA_ALPHA;
                nav.totalEvents = (nav.totalEvents || 0) + 1;
            }
            stats.lastVisited = now;
        }

        this.saveNavUsage();
    }

    flushDwellTime() {
        if (!this._viewEnteredAt || document.hidden) return;

        const view = this.currentView;
        const now = Date.now();
        let elapsed = now - this._viewEnteredAt;
        this._viewEnteredAt = now;

        const already = this._sessionDwellByView[view] || 0;
        const cap = SESSION_DWELL_CAP_MS - already;
        if (cap <= 0) return;

        elapsed = Math.min(elapsed, cap);
        this._sessionDwellByView[view] = already + elapsed;

        const nav = this.ensureNavUsage();
        const stats = this.ensureViewStats(nav, view);
        stats.dwellMs = (stats.dwellMs || 0) + elapsed;
        const minutes = elapsed / 60000;
        stats.ewma = (stats.ewma || 0) * (1 - EWMA_ALPHA) + minutes * EWMA_ALPHA;

        this.saveNavUsage();
    }

    getNavLayout() {
        const nav = this.ensureNavUsage();
        const allIds = NAV_ITEMS.map(n => n.id);
        const defaultOrder = [...allIds];

        if ((nav.totalEvents || 0) < WARMUP_EVENTS) {
            return {
                showLabels: false,
                defaultOrder,
                recent: [],
                frequent: [],
                more: [],
                moreExpanded: false
            };
        }

        const primary = new Set();
        const pins = (nav.pins || ['tasks']).filter(id => allIds.includes(id));
        pins.forEach(id => primary.add(id));

        (nav.recentViews || []).slice(0, RECENT_MAX).forEach(id => {
            if (allIds.includes(id)) primary.add(id);
        });

        const candidates = allIds
            .filter(id => !primary.has(id))
            .map(id => ({ id, score: this.getViewScore(id) }))
            .sort((a, b) => b.score - a.score);

        for (const c of candidates) {
            if (primary.size >= PRIMARY_SLOT_BUDGET) break;
            primary.add(c.id);
        }

        const recent = (nav.recentViews || []).filter(id => primary.has(id)).slice(0, RECENT_MAX);
        const frequent = allIds
            .filter(id => primary.has(id) && !recent.includes(id))
            .sort((a, b) => {
                const aPin = pins.indexOf(a);
                const bPin = pins.indexOf(b);
                if (aPin !== -1 || bPin !== -1) {
                    if (aPin !== -1 && bPin !== -1) return aPin - bPin;
                    if (aPin !== -1) return -1;
                    return 1;
                }
                return this.getViewScore(b) - this.getViewScore(a);
            });
        const more = allIds.filter(id => !primary.has(id));
        const moreExpanded = more.includes(this.currentView) ? true : Boolean(nav.moreExpanded);

        return { showLabels: true, defaultOrder, recent, frequent, more, moreExpanded };
    }

    getProjectLayout() {
        const nav = this.ensureNavUsage();
        const projects = [...this.data.projects];
        const warmed = (nav.totalEvents || 0) >= WARMUP_EVENTS;

        if (!warmed || projects.length <= PROJECT_VISIBLE_MAX) {
            return {
                visible: projects,
                overflow: [],
                moreExpanded: false
            };
        }

        const sorted = projects
            .map(p => ({ project: p, score: this.getProjectScore(p.id) }))
            .sort((a, b) => b.score - a.score);

        const visible = sorted.slice(0, PROJECT_VISIBLE_MAX).map(s => s.project);
        const overflow = sorted.slice(PROJECT_VISIBLE_MAX).map(s => s.project);
        const overflowIds = overflow.map(p => p.id);
        const moreExpanded = overflowIds.includes(this.filters.projectId) ? true : Boolean(nav.moreProjectsExpanded);

        return { visible, overflow, moreExpanded };
    }

    renderNavItem(viewId) {
        const item = NAV_ITEMS.find(n => n.id === viewId);
        if (!item) return null;

        const a = document.createElement('a');
        a.href = '#';
        a.className = 'nav-item';
        if (this.currentView === viewId) a.classList.add('active');
        a.setAttribute('data-view', viewId);

        let badgeHtml = '';
        if (item.badgeId) {
            const hiddenClass = item.badgeId === 'badge-inbox' ? ' hidden' : '';
            badgeHtml = `<span id="${item.badgeId}" class="badge${hiddenClass}">0</span>`;
        }
        a.innerHTML = `${item.icon}<span>${item.label}</span>${badgeHtml}`;
        return a;
    }

    appendNavGroup(container, label, viewIds) {
        if (!viewIds.length) return;
        if (label) {
            const title = document.createElement('div');
            title.className = 'nav-group-label';
            title.textContent = label;
            container.appendChild(title);
        }
        viewIds.forEach(viewId => {
            const el = this.renderNavItem(viewId);
            if (el) container.appendChild(el);
        });
    }

    buildSidebarNav() {
        const layout = this.getNavLayout();
        const recentEl = document.getElementById('sidebar-nav-recent');
        const frequentEl = document.getElementById('sidebar-nav-frequent');
        const defaultEl = document.getElementById('sidebar-nav-default');
        const moreEl = document.getElementById('sidebar-nav-more');

        recentEl.innerHTML = '';
        frequentEl.innerHTML = '';
        defaultEl.innerHTML = '';
        moreEl.innerHTML = '';
        moreEl.classList.add('hidden');

        if (!layout.showLabels) {
            defaultEl.classList.remove('hidden');
            recentEl.classList.add('hidden');
            frequentEl.classList.add('hidden');
            layout.defaultOrder.forEach(viewId => {
                const el = this.renderNavItem(viewId);
                if (el) defaultEl.appendChild(el);
            });
            this.staggerChildren(defaultEl, '.nav-item');
        } else {
            defaultEl.classList.add('hidden');
            recentEl.classList.remove('hidden');
            frequentEl.classList.remove('hidden');

            if (layout.recent.length) {
                this.appendNavGroup(recentEl, 'Recent', layout.recent);
            }
            if (layout.frequent.length) {
                this.appendNavGroup(frequentEl, 'Frequent', layout.frequent);
            }

            if (layout.more.length) {
                moreEl.classList.remove('hidden');
                moreEl.classList.toggle('expanded', layout.moreExpanded);

                const toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'nav-more-toggle';
                toggle.setAttribute('aria-expanded', layout.moreExpanded ? 'true' : 'false');
                toggle.innerHTML = `
                    <svg class="nav-more-chevron" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    <span>More</span>
                    <span class="nav-more-count">${layout.more.length}</span>
                `;
                moreEl.appendChild(toggle);

                const itemsWrap = document.createElement('div');
                itemsWrap.className = 'nav-more-items';
                layout.more.forEach(viewId => {
                    const el = this.renderNavItem(viewId);
                    if (el) itemsWrap.appendChild(el);
                });
                moreEl.appendChild(itemsWrap);
            }
        }

        this._sidebarNavBuilt = true;
        this.updateNavBadges();
    }

    updateNavBadges() {
        const counts = {
            'badge-tasks': this.data.tasks.filter(t => t.status !== 'completed').length,
            'badge-projects': this.data.projects.filter(p => p.status === 'active').length,
            'badge-skills': (this.data.skills || []).length,
            'badge-inbox': this.getPendingInboxCount()
        };

        Object.entries(counts).forEach(([id, count]) => {
            const badge = document.getElementById(id);
            if (!badge) return;
            if (badge.textContent !== String(count)) this.popBadge(badge);
            badge.textContent = count;
            if (id === 'badge-inbox') {
                badge.classList.toggle('hidden', count === 0);
            }
        });
    }

    toggleNavMore() {
        const nav = this.ensureNavUsage();
        nav.moreExpanded = !nav.moreExpanded;
        const moreEl = document.getElementById('sidebar-nav-more');
        if (moreEl) {
            moreEl.classList.toggle('expanded', nav.moreExpanded);
            const toggle = moreEl.querySelector('.nav-more-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', nav.moreExpanded ? 'true' : 'false');
        }
        this.saveNavUsage();
    }

    toggleProjectsMore() {
        const nav = this.ensureNavUsage();
        nav.moreProjectsExpanded = !nav.moreProjectsExpanded;
        const moreEl = document.getElementById('sidebar-projects-more');
        if (moreEl) {
            moreEl.classList.toggle('expanded', nav.moreProjectsExpanded);
            const toggle = moreEl.querySelector('.project-more-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', nav.moreProjectsExpanded ? 'true' : 'false');
        }
        this.saveNavUsage();
    }

    renderProjectMiniItem(project) {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'project-mini-item';
        if (this.filters.projectId === project.id) item.classList.add('active');
        item.setAttribute('data-project-id', project.id);
        item.innerHTML = `
            <span class="project-dot" style="background-color: ${project.color}"></span>
            <span>${project.name}</span>
        `;
        return item;
    }

    renderSidebarProjects() {
        const projectCount = this.data.projects.length;
        if (!this._sidebarProjectsBuilt || projectCount !== this._sidebarProjectCount) {
            this.buildSidebarProjects();
            this._sidebarProjectCount = projectCount;
            return;
        }
        document.querySelectorAll('.project-mini-item').forEach(item => {
            const id = item.getAttribute('data-project-id');
            item.classList.toggle('active', id === this.filters.projectId);
        });
    }

    buildSidebarProjects() {
        const layout = this.getProjectLayout();
        const container = document.getElementById('sidebar-projects-container');
        const moreEl = document.getElementById('sidebar-projects-more');

        container.innerHTML = '';
        moreEl.innerHTML = '';
        moreEl.classList.add('hidden');

        layout.visible.forEach(p => container.appendChild(this.renderProjectMiniItem(p)));
        this.staggerChildren(container, '.project-mini-item');

        if (layout.overflow.length) {
            moreEl.classList.remove('hidden');
            moreEl.classList.toggle('expanded', layout.moreExpanded);

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'project-more-toggle';
            toggle.setAttribute('aria-expanded', layout.moreExpanded ? 'true' : 'false');
            toggle.innerHTML = `
                <svg class="nav-more-chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
                <span>More projects</span>
                <span class="nav-more-count">${layout.overflow.length}</span>
            `;
            moreEl.appendChild(toggle);

            const itemsWrap = document.createElement('div');
            itemsWrap.className = 'project-more-items';
            layout.overflow.forEach(p => itemsWrap.appendChild(this.renderProjectMiniItem(p)));
            moreEl.appendChild(itemsWrap);
        }

        this._sidebarProjectsBuilt = true;
    }

    startNavTracking() {
        this._viewEnteredAt = Date.now();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.flushDwellTime();
                this._viewEnteredAt = null;
            } else {
                this._viewEnteredAt = Date.now();
            }
        });

        window.addEventListener('pagehide', () => this.flushDwellTime());

        if (this._dwellInterval) clearInterval(this._dwellInterval);
        this._dwellInterval = setInterval(() => this.flushDwellTime(), 30000);
    }

    saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.persistDashboard();
        this.render();
    }

    async addQuickNote(text) {
        const todayStr = new Date().toISOString().split('T')[0];
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        if (!this.data.dailyNotes) this.data.dailyNotes = {};
        const entry = `[${timeStr}] ${text}`;
        const existing = this.data.dailyNotes[todayStr];
        this.data.dailyNotes[todayStr] = existing ? `${existing}\n${entry}` : entry;

        const notesInput = document.getElementById('daily-notes-input');
        if (notesInput) notesInput.value = this.data.dailyNotes[todayStr];

        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        await this.addToInbox(text);
        this.showGlobalChatFeedback('Saved to inbox & today\'s notes');
    }

    showGlobalChatFeedback(message = 'Saved to inbox & today\'s notes') {
        const feedback = document.getElementById('global-chat-feedback');
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.add('visible');
        clearTimeout(this._globalChatFeedbackTimer);
        this._globalChatFeedbackTimer = setTimeout(() => {
            feedback.classList.remove('visible');
        }, 2000);
    }

    enterQuestionMode() {
        this.questionMode = true;
        const wrapper = document.getElementById('global-chat-wrapper');
        const panel = document.getElementById('question-mode-panel');
        const input = document.getElementById('global-chat-input');
        const submitBtn = document.getElementById('btn-submit-global-chat');
        const feedback = document.getElementById('global-chat-feedback');

        if (wrapper) wrapper.classList.add('question-mode-active');
        if (panel) panel.classList.remove('hidden');
        if (input) {
            input.placeholder = 'Ask about tasks, projects, inbox…';
            input.value = '';
        }
        if (submitBtn) submitBtn.textContent = 'Ask';
        if (feedback) feedback.classList.remove('visible');

        const thread = document.getElementById('question-thread');
        if (thread && !thread.childElementCount) {
            this.renderQuestionMessage('assistant', 'Ask me anything about your projects, tasks, inbox, ideas, or blockers.');
        }

        this.focusGlobalChatInput({ force: true });
    }

    exitQuestionMode() {
        this.questionMode = false;
        this._lastEmptyEnterAt = 0;

        const wrapper = document.getElementById('global-chat-wrapper');
        const panel = document.getElementById('question-mode-panel');
        const input = document.getElementById('global-chat-input');
        const submitBtn = document.getElementById('btn-submit-global-chat');
        const thread = document.getElementById('question-thread');

        if (wrapper) wrapper.classList.remove('question-mode-active');
        if (panel) panel.classList.add('hidden');
        if (input) {
            input.placeholder = '';
            input.value = '';
        }
        if (submitBtn) submitBtn.textContent = 'Add';
        if (thread) thread.innerHTML = '';

        this.focusGlobalChatInput({ force: true });
    }

    handleEmptyEnter() {
        const now = Date.now();
        if (now - this._lastEmptyEnterAt < this._emptyEnterWindowMs) {
            if (this.questionMode) {
                this.exitQuestionMode();
            } else {
                this.enterQuestionMode();
            }
            this._lastEmptyEnterAt = 0;
        } else {
            this._lastEmptyEnterAt = now;
        }
    }

    renderQuestionMessage(role, content, { loading = false } = {}) {
        const thread = document.getElementById('question-thread');
        if (!thread) return null;

        const msg = document.createElement('div');
        msg.className = `question-message ${role}`;
        if (loading) msg.classList.add('loading');
        msg.textContent = content;

        if (role === 'assistant' && !loading) {
            const wrap = document.createElement('div');
            wrap.className = 'question-message-wrap assistant';
            wrap.appendChild(msg);
            this.attachQuestionCopyButton(wrap, msg);
            thread.appendChild(wrap);
        } else {
            thread.appendChild(msg);
        }

        thread.scrollTop = thread.scrollHeight;
        return msg;
    }

    attachQuestionCopyButton(wrap, msgEl) {
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn-icon-small question-copy-btn';
        copyBtn.title = 'Copy response';
        copyBtn.setAttribute('aria-label', 'Copy response');
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyQuestionResponse(msgEl.textContent, copyBtn);
        });
        wrap.appendChild(copyBtn);
    }

    finalizeAssistantMessage(msgEl, content) {
        if (!msgEl) return;
        msgEl.classList.remove('loading');
        msgEl.textContent = content;

        const wrap = document.createElement('div');
        wrap.className = 'question-message-wrap assistant';
        const parent = msgEl.parentNode;
        parent.insertBefore(wrap, msgEl);
        wrap.appendChild(msgEl);
        this.attachQuestionCopyButton(wrap, msgEl);
    }

    async copyQuestionResponse(text, btnEl) {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            if (btnEl) {
                btnEl.classList.add('copied');
                btnEl.title = 'Copied!';
                setTimeout(() => {
                    btnEl.classList.remove('copied');
                    btnEl.title = 'Copy response';
                }, 2000);
            }
        } catch {
            if (btnEl) btnEl.title = 'Copy failed';
        }
    }

    async submitQuestion(text) {
        const input = document.getElementById('global-chat-input');
        this.renderQuestionMessage('user', text);
        if (input) input.value = '';

        const loadingEl = this.renderQuestionMessage('assistant', 'Thinking…', { loading: true });

        const answer = await this.answerQuestion(text);

        if (loadingEl) {
            this.finalizeAssistantMessage(loadingEl, answer);
        }

        const thread = document.getElementById('question-thread');
        if (thread) thread.scrollTop = thread.scrollHeight;
        this.focusGlobalChatInput({ force: true });
    }

    buildSiteContext() {
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        return {
            tasks: this.data.tasks || [],
            projects: this.data.projects || [],
            skills: this.data.skills || [],
            dailyNotes: {
                today: (this.data.dailyNotes && this.data.dailyNotes[todayStr]) || '',
                yesterday: (this.data.dailyNotes && this.data.dailyNotes[yesterdayStr]) || ''
            },
            inboxPending: this.inbox.filter(i => i.status === 'pending'),
            ideas: this.projectMemory?.ideas || [],
            painPoints: this.getOpenPainPoints(),
            decisions: this.projectMemory?.decisions || [],
            agentRuns: (this.projectMemory?.agent_runs || []).slice(0, 5),
            todayStr
        };
    }

    matchQuestionIntent(question) {
        const q = question.toLowerCase();
        const intents = [];

        if (/\b(help|what can you|what do you)\b/.test(q)) intents.push('help');
        if (/\b(task|todo|overdue|completed)\b/.test(q)) intents.push('tasks');
        if (/\bproject/.test(q)) intents.push('projects');
        if (/\b(inbox|pending|captured)\b/.test(q)) intents.push('inbox');
        if (/\b(idea|research)\b/.test(q)) intents.push('ideas');
        if (/\b(blocker|pain|stuck|blocking)\b/.test(q)) intents.push('blockers');
        if (/\b(note|today|logged|journal)\b/.test(q)) intents.push('notes');
        if (/\b(focus|priority|priorities|what should i)\b/.test(q)) intents.push('focus');
        if (/\bskill/.test(q)) intents.push('skills');

        if (!intents.length) intents.push('overview');
        return intents;
    }

    ruleBasedAnswer(question, context) {
        const q = question.toLowerCase();
        const intents = this.matchQuestionIntent(question);
        const sections = [];

        for (const intent of intents) {
            const section = this.formatIntentAnswer(intent, q, context);
            if (section) sections.push(section);
        }

        if (sections.length === 1) return sections[0];

        return sections.join('\n\n');
    }

    formatIntentAnswer(intent, q, context) {
        const { tasks, projects, skills, dailyNotes, inboxPending, ideas, painPoints, todayStr } = context;
        const todayTime = new Date(todayStr).getTime();

        switch (intent) {
            case 'help':
                return [
                    'I can answer questions about:',
                    '• Tasks — pending, overdue, completed',
                    '• Projects — active and all projects',
                    '• Inbox — pending captures',
                    '• Ideas & blockers — from project memory',
                    '• Daily notes — today and yesterday',
                    '• Focus — suggested priorities for today',
                    '• Skills — your skills folder',
                    '',
                    'Try: "What tasks are overdue?" or "What should I focus on?"'
                ].join('\n');

            case 'tasks': {
                const isOverdue = /\boverdue\b/.test(q);
                const isCompleted = /\bcompleted\b/.test(q);
                const isPending = /\b(pending|todo|in progress)\b/.test(q);

                let filtered = tasks;
                if (isOverdue) {
                    filtered = tasks.filter(t => {
                        if (t.status === 'completed' || !t.dueDate) return false;
                        return new Date(t.dueDate).getTime() < todayTime;
                    });
                } else if (isCompleted) {
                    filtered = tasks.filter(t => t.status === 'completed');
                } else if (isPending) {
                    filtered = tasks.filter(t => t.status !== 'completed');
                } else {
                    filtered = tasks.filter(t => t.status !== 'completed');
                }

                if (!filtered.length) {
                    if (isOverdue) return 'No overdue tasks — you\'re on track.';
                    if (isCompleted) return 'No completed tasks yet.';
                    return 'No tasks found. Add one from the Tasks view.';
                }

                const label = isOverdue ? 'Overdue tasks' : isCompleted ? 'Completed tasks' : 'Open tasks';
                const lines = filtered.map(t => {
                    const project = this.getProjectForTask(t.projectId);
                    const projectTag = project ? ` [${project.name}]` : '';
                    const due = t.dueDate ? ` — due ${t.dueDate}` : '';
                    return `• ${t.title} (${t.status}${t.priority ? ', ' + t.priority : ''})${projectTag}${due}`;
                });
                return `${label} (${filtered.length}):\n${lines.join('\n')}`;
            }

            case 'projects': {
                const activeOnly = /\bactive\b/.test(q);
                const filtered = activeOnly
                    ? projects.filter(p => p.status === 'active')
                    : projects;

                if (!filtered.length) {
                    return activeOnly ? 'No active projects.' : 'No projects yet. Add one from the Projects view.';
                }

                const label = activeOnly ? 'Active projects' : 'All projects';
                const lines = filtered.map(p => {
                    const deadline = p.deadline ? ` — deadline ${p.deadline}` : '';
                    return `• ${p.name} (${p.status || 'active'})${deadline}`;
                });
                return `${label} (${filtered.length}):\n${lines.join('\n')}`;
            }

            case 'inbox': {
                if (!inboxPending.length) return 'Inbox is empty — nothing pending.';
                const lines = inboxPending.slice(0, 5).map(i => `• ${i.content}`);
                const more = inboxPending.length > 5 ? `\n…and ${inboxPending.length - 5} more` : '';
                return `Inbox (${inboxPending.length} pending):\n${lines.join('\n')}${more}`;
            }

            case 'ideas': {
                const activeIdeas = ideas.filter(i => i.status !== 'replaced' && i.status !== 'abandoned');
                if (!activeIdeas.length) return 'No ideas in project memory yet.';
                const lines = activeIdeas.map(i => {
                    const verdict = i.verdict ? ` [${i.verdict}]` : '';
                    return `• ${i.content}${verdict}`;
                });
                return `Ideas (${activeIdeas.length}):\n${lines.join('\n')}`;
            }

            case 'blockers': {
                if (!painPoints.length) return 'No open blockers — nothing blocking you right now.';
                const lines = painPoints.map(p => `• [${p.status}] ${p.description}`);
                return `Open blockers (${painPoints.length}):\n${lines.join('\n')}`;
            }

            case 'notes': {
                const parts = [];
                if (dailyNotes.today) {
                    parts.push(`Today's notes:\n${dailyNotes.today}`);
                } else {
                    parts.push('No notes logged for today.');
                }
                if (/\byesterday\b/.test(q) && dailyNotes.yesterday) {
                    parts.push(`Yesterday's notes:\n${dailyNotes.yesterday}`);
                }
                return parts.join('\n\n');
            }

            case 'focus': {
                const overdue = tasks.filter(t => {
                    if (t.status === 'completed' || !t.dueDate) return false;
                    return new Date(t.dueDate).getTime() <= todayTime;
                });
                const inProgress = tasks.filter(t => t.status === 'in_progress');
                const activeProjects = projects.filter(p => p.status === 'active');
                const parts = [];

                if (overdue.length) {
                    parts.push(`Urgent: ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} — ${overdue.map(t => t.title).join(', ')}`);
                }
                if (inProgress.length) {
                    parts.push(`In progress: ${inProgress.map(t => t.title).join(', ')}`);
                }
                if (painPoints.length) {
                    parts.push(`Blockers: ${painPoints.map(p => p.description).join('; ')}`);
                }
                if (inboxPending.length) {
                    parts.push(`Inbox: ${inboxPending.length} item${inboxPending.length > 1 ? 's' : ''} waiting to be processed`);
                }
                if (activeProjects.length) {
                    parts.push(`Active projects: ${activeProjects.map(p => p.name).join(', ')}`);
                }

                if (!parts.length) {
                    return 'Nothing urgent flagged. Review your task list or capture a new idea in Quick Add.';
                }
                return `Suggested focus for today:\n${parts.map(p => `• ${p}`).join('\n')}`;
            }

            case 'skills': {
                if (!skills.length) return 'Skills folder is empty.';
                const lines = skills.map(s => `• ${s.name}${s.description ? ' — ' + s.description : ''}`);
                return `Skills (${skills.length}):\n${lines.join('\n')}`;
            }

            case 'overview':
            default: {
                const openTasks = tasks.filter(t => t.status !== 'completed').length;
                const activeProjects = projects.filter(p => p.status === 'active').length;
                const parts = [
                    `Overview as of ${todayStr}:`,
                    `• ${openTasks} open task${openTasks !== 1 ? 's' : ''}`,
                    `• ${activeProjects} active project${activeProjects !== 1 ? 's' : ''}`,
                    `• ${inboxPending.length} inbox item${inboxPending.length !== 1 ? 's' : ''} pending`,
                    `• ${painPoints.length} open blocker${painPoints.length !== 1 ? 's' : ''}`,
                    `• ${ideas.filter(i => i.status !== 'replaced' && i.status !== 'abandoned').length} active idea${ideas.length !== 1 ? 's' : ''}`,
                    '',
                    'Try asking: "What tasks are overdue?", "What\'s in my inbox?", or "What should I focus on?"'
                ];
                return parts.join('\n');
            }
        }
    }

    async answerQuestion(question) {
        if (!this.projectMemory) await this.loadProjectMemory();
        const context = this.buildSiteContext();
        return this.ruleBasedAnswer(question, context);
    }

    shouldPreserveFocusTarget(target) {
        if (!target || !target.closest) return true;
        if (target.closest('.modal-overlay:not(.hidden)')) return true;
        return !!target.closest('input, textarea, select, button, a, label, [contenteditable]');
    }

    focusGlobalChatInput({ force = false } = {}) {
        const input = document.getElementById('global-chat-input');
        if (!input) return;
        if (document.querySelector('.modal-overlay:not(.hidden)')) return;

        const active = document.activeElement;
        const otherInputs = ['search-input', 'daily-notes-input', 'agent-prompt-input'];
        if (!force && active && otherInputs.includes(active.id)) return;

        input.focus();
    }

    setupGlobalChatFocus() {
        this.focusGlobalChatInput();

        document.querySelector('.app-container').addEventListener('mousedown', (e) => {
            if (this.shouldPreserveFocusTarget(e.target)) return;
            this.focusGlobalChatInput({ force: true });
        });

        window.addEventListener('focus', () => {
            this.focusGlobalChatInput();
        });
    }

    init() {
        document.body.className = 'light-theme';

        const topbarDateEl = document.querySelector('#topbar-date-display span');
        if (topbarDateEl) {
            const today = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            topbarDateEl.textContent = today.toLocaleDateString('en-US', options);
        }

        this.setupEventListeners();
        Promise.all([
            this.loadDashboard(),
            this.loadProjectMemory(),
            this.loadInbox(),
            this.loadAgentRegistry(),
            this.loadQueue(),
            this.loadLatestDigest()
        ]).then(() => {
            this._sidebarNavBuilt = false;
            this._sidebarProjectsBuilt = false;
            this._sidebarProjectCount = -1;
            this.renderSidebar();
            this.renderProjectSelects();
            this.switchView(this.currentView, { skipRecord: true });
            this.startNavTracking();
        });

        requestAnimationFrame(() => {
            document.body.classList.add('app-ready');
            document.body.classList.remove('page-enter');
        });
    }

    setupEventListeners() {
        // Sidebar Navigation (event delegation — nav items are rebuilt on load)
        document.querySelector('.sidebar-nav').addEventListener('click', (e) => {
            if (e.target.closest('#btn-sidebar-add-project')) return;

            const moreToggle = e.target.closest('.nav-more-toggle');
            if (moreToggle) {
                e.preventDefault();
                this.toggleNavMore();
                return;
            }

            const item = e.target.closest('.nav-item');
            if (item) {
                e.preventDefault();
                this.filters.projectId = '';
                this.switchView(item.getAttribute('data-view'));
            }
        });

        document.querySelector('.sidebar-projects-list').addEventListener('click', (e) => {
            if (e.target.closest('#btn-sidebar-add-project')) return;

            const moreToggle = e.target.closest('.project-more-toggle');
            if (moreToggle) {
                e.preventDefault();
                this.toggleProjectsMore();
                return;
            }

            const projectItem = e.target.closest('.project-mini-item');
            if (projectItem) {
                e.preventDefault();
                const projectId = projectItem.getAttribute('data-project-id');
                this.recordNavEvent('project', projectId, { isClick: true });
                this.filters.projectId = projectId;
                this.switchView('tasks');
            }
        });

        // Tasks View Mode Toggle (List vs Kanban)
        document.querySelectorAll('.btn-view-mode').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-view-mode').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.taskViewMode = btn.getAttribute('data-mode');
                this.renderTasks();
            });
        });

        // Search Input
        const searchInput = document.getElementById('search-input');
        const clearBtn = document.getElementById('btn-clear-search');
        searchInput.addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            if (this.filters.search) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }
            this.renderTasks();
        });
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.filters.search = '';
            clearBtn.classList.add('hidden');
            this.renderTasks();
        });

        // Add Task Button
        document.getElementById('btn-header-add-task').addEventListener('click', () => {
            this.openTaskModal();
        });

        // Add Project Buttons
        document.getElementById('btn-sidebar-add-project').addEventListener('click', () => {
            this.openProjectModal();
        });
        document.getElementById('btn-header-add-project').addEventListener('click', () => {
            this.openProjectModal();
        });

        // Add Skill Button
        document.getElementById('btn-header-add-skill').addEventListener('click', () => {
            this.openSkillModal();
        });

        // Modal Close Buttons
        document.querySelectorAll('.btn-close-modal, .btn-cancel-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
                this.focusGlobalChatInput();
            });
        });

        // Form Submit: Task
        document.getElementById('form-task').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTaskForm();
        });
        // Delete Task Button
        document.getElementById('btn-delete-task').addEventListener('click', () => {
            const id = document.getElementById('task-id').value;
            if (id && confirm('Are you sure you want to delete this task?')) {
                this.data.tasks = this.data.tasks.filter(t => t.id !== id);
                this.closeModal(document.getElementById('modal-task'));
                this.saveData();
                this.focusGlobalChatInput();
            }
        });

        // Form Submit: Project
        document.getElementById('form-project').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProjectForm();
        });
        // Delete Project Button
        document.getElementById('btn-delete-project').addEventListener('click', () => {
            const id = document.getElementById('project-id').value;
            if (id && confirm('Are you sure you want to delete this project? All associated tasks will lose their project association.')) {
                this.data.projects = this.data.projects.filter(p => p.id !== id);
                this.data.tasks.forEach(t => {
                    if (t.projectId === id) t.projectId = '';
                });
                this.closeModal(document.getElementById('modal-project'));
                this.saveData();
                this.focusGlobalChatInput();
            }
        });

        // Form Submit: Skill
        document.getElementById('form-skill').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSkillForm();
        });
        // Delete Skill Button
        document.getElementById('btn-delete-skill').addEventListener('click', () => {
            const id = document.getElementById('skill-id').value;
            if (id && confirm('Are you sure you want to delete this skill folder?')) {
                this.data.skills = this.data.skills.filter(s => s.id !== id);
                this.closeModal(document.getElementById('modal-skill'));
                this.saveData();
                this.focusGlobalChatInput();
            }
        });

        // Daily Notes Input Save
        const notesInput = document.getElementById('daily-notes-input');
        notesInput.addEventListener('input', (e) => {
            const todayStr = new Date().toISOString().split('T')[0];
            if (!this.data.dailyNotes) this.data.dailyNotes = {};
            this.data.dailyNotes[todayStr] = e.target.value;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        });

        // Global Quick-Add Input
        const globalChatInput = document.getElementById('global-chat-input');
        const submitGlobalChat = async () => {
            const text = globalChatInput.value.trim();
            if (!text) return;
            await this.addQuickNote(text);
            globalChatInput.value = '';
            this.focusGlobalChatInput({ force: true });
        };
        const handleGlobalChatSubmit = async () => {
            const text = globalChatInput.value.trim();
            if (!text) return;
            if (this.questionMode) {
                await this.submitQuestion(text);
            } else {
                await submitGlobalChat();
            }
        };
        document.getElementById('btn-submit-global-chat').addEventListener('click', handleGlobalChatSubmit);
        document.getElementById('btn-exit-question-mode').addEventListener('click', () => {
            this.exitQuestionMode();
        });
        globalChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.questionMode) {
                e.preventDefault();
                this.exitQuestionMode();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = globalChatInput.value.trim();
                if (!text) {
                    this.handleEmptyEnter();
                    return;
                }
                handleGlobalChatSubmit();
            }
        });
        this.setupGlobalChatFocus();

        // Copy Daily Summary Button
        const copyBtn = document.getElementById('btn-copy-daily-summary');
        copyBtn.addEventListener('click', () => {
            const todayStr = new Date().toISOString().split('T')[0];
            const completedTasks = this.data.tasks.filter(t => t.status === 'completed');
            const activeProjects = this.data.projects.filter(p => p.status === 'active');
            const notes = (this.data.dailyNotes && this.data.dailyNotes[todayStr]) || 'No notes logged for today.';
            const pendingInbox = this.getPendingInboxCount();
            const painPoints = this.getOpenPainPoints();
            const newIdeas = this.getMemoryIdeasSince(this.getYesterdayIso());

            let summaryText = `DAILY STANDUP REPORT — ${todayStr}\n\n`;
            summaryText += `TASKS COMPLETED (${completedTasks.length}):\n`;
            completedTasks.forEach(t => { summaryText += ` - ${t.title}\n`; });

            summaryText += `\nACTIVE PROJECTS (${activeProjects.length}):\n`;
            activeProjects.forEach(p => { summaryText += ` - ${p.name}\n`; });

            summaryText += `\nINBOX PENDING: ${pendingInbox}\n`;

            if (newIdeas.length > 0) {
                summaryText += `\nNEW IDEAS (since yesterday):\n`;
                newIdeas.forEach(i => { summaryText += ` - ${i.content}${i.verdict ? ` [${i.verdict}]` : ''}\n`; });
            }

            if (painPoints.length > 0) {
                summaryText += `\nOPEN BLOCKERS:\n`;
                painPoints.forEach(p => { summaryText += ` - [${p.status}] ${p.description}\n`; });
            }

            summaryText += `\nDAILY REFLECTION & NOTES:\n${notes}\n`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(summaryText).then(() => {
                    const originalText = copyBtn.querySelector('span').textContent;
                    copyBtn.querySelector('span').textContent = "Copied to Clipboard!";
                    setTimeout(() => { copyBtn.querySelector('span').textContent = originalText; }, 2000);
                }).catch(() => {
                    alert("Summary text:\n\n" + summaryText);
                });
            } else {
                alert("Summary text:\n\n" + summaryText);
            }
        });

        // Color picker display update
        const colorInput = document.getElementById('project-color');
        const colorDisplay = document.getElementById('color-hex-display');
        colorInput.addEventListener('input', (e) => {
            colorDisplay.textContent = e.target.value;
        });

        // Calendar Navigation Buttons
        document.getElementById('btn-calendar-prev').addEventListener('click', () => {
            this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
            this.renderCalendar();
        });
        document.getElementById('btn-calendar-next').addEventListener('click', () => {
            this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
            this.renderCalendar();
        });
        document.getElementById('btn-calendar-today').addEventListener('click', () => {
            this.calendarDate = new Date();
            this.renderCalendar();
        });

        // Setup Drag and Drop for Kanban Columns
        document.querySelectorAll('.kanban-column').forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });
            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });
            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                const newStatus = column.getAttribute('data-status');
                if (this.draggedTaskId && newStatus) {
                    const task = this.data.tasks.find(t => t.id === this.draggedTaskId);
                    if (task && task.status !== newStatus) {
                        task.status = newStatus;
                        this.saveData();
                    }
                }
            });
        });

        // AGENT RUNNER — delegated after dynamic render
        document.getElementById('agents-grid-container')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-run-agent-instance');
            if (!btn) return;
            const agentId = btn.getAttribute('data-agent-id');
            this.runAgentFromRegistry(agentId, btn);
        });

        document.getElementById('btn-process-queue')?.addEventListener('click', () => {
            this.processNextQueuedItem();
        });

        document.getElementById('btn-run-custom-agent')?.addEventListener('click', () => {
            this.triggerGlobalWorkspaceSynthesis();
        });

        document.getElementById('btn-submit-agent-prompt').addEventListener('click', () => {
            const inputEl = document.getElementById('agent-prompt-input');
            const prompt = inputEl.value.trim();
            if (!prompt) return;
            this.appendConsoleLog(`User Prompt: "${prompt}"`, 'system');
            inputEl.value = '';
            this.runCustomPromptSimulation(prompt);
        });
    }

    switchView(viewName, { skipRecord = false } = {}) {
        const viewChanged = viewName !== this.currentView;
        if (viewChanged) {
            this.flushDwellTime();
            this._viewEnteredAt = Date.now();
        }

        this.currentView = viewName;

        // Update navigation active states
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            if (item.getAttribute('data-view') === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        if (!skipRecord) {
            this.recordNavEvent('view', viewName, { isClick: true });
        } else {
            this.ensureNavUsage().lastView = viewName;
        }

        if (!this._viewEnteredAt || viewChanged) {
            this._viewEnteredAt = Date.now();
        }

        // Update topbar title and view controls
        const titleEl = document.getElementById('view-title');
        const searchBox = document.getElementById('global-search-container');
        const tasksControls = document.getElementById('tasks-view-controls');
        const addTaskBtn = document.getElementById('btn-header-add-task');
        const projectsControls = document.getElementById('projects-view-controls');
        const skillsControls = document.getElementById('skills-view-controls');

        document.querySelectorAll('.view-section').forEach(sec => {
            sec.classList.remove('active');
            sec.classList.add('hidden');
        });

        let activeSection = null;

        if (viewName === 'tasks') {
            titleEl.textContent = 'Tasks';
            searchBox.classList.remove('hidden');
            tasksControls.classList.remove('hidden');
            addTaskBtn.classList.remove('hidden');
            projectsControls.classList.add('hidden');
            skillsControls.classList.add('hidden');
            activeSection = document.getElementById('view-tasks');
            activeSection.classList.remove('hidden');
            activeSection.classList.add('active');
            this.renderTasks();
        } else if (viewName === 'projects') {
            titleEl.textContent = 'Projects';
            searchBox.classList.add('hidden');
            tasksControls.classList.add('hidden');
            addTaskBtn.classList.add('hidden');
            projectsControls.classList.remove('hidden');
            skillsControls.classList.add('hidden');
            activeSection = document.getElementById('view-projects');
            activeSection.classList.remove('hidden');
            activeSection.classList.add('active');
            this.renderProjects();
        } else if (viewName === 'calendar') {
            titleEl.textContent = 'Calendar';
            searchBox.classList.add('hidden');
            tasksControls.classList.add('hidden');
            addTaskBtn.classList.add('hidden');
            projectsControls.classList.add('hidden');
            skillsControls.classList.add('hidden');
            activeSection = document.getElementById('view-calendar');
            activeSection.classList.remove('hidden');
            activeSection.classList.add('active');
            this.renderCalendar();
        } else if (viewName === 'skills') {
            titleEl.textContent = 'Skills Folder';
            searchBox.classList.add('hidden');
            tasksControls.classList.add('hidden');
            addTaskBtn.classList.add('hidden');
            projectsControls.classList.add('hidden');
            skillsControls.classList.remove('hidden');
            activeSection = document.getElementById('view-skills');
            activeSection.classList.remove('hidden');
            activeSection.classList.add('active');
            this.renderSkills();
        } else if (viewName === 'daily_report') {
            titleEl.textContent = 'Daily Report';
            searchBox.classList.add('hidden');
            tasksControls.classList.add('hidden');
            addTaskBtn.classList.add('hidden');
            projectsControls.classList.add('hidden');
            skillsControls.classList.add('hidden');
            activeSection = document.getElementById('view-daily-report');
            activeSection.classList.remove('hidden');
            activeSection.classList.add('active');
            this.loadProjectMemory()
                .then(() => this.loadInbox())
                .then(() => this.loadLatestDigest())
                .then(() => this.renderDailyReport());
        } else if (viewName === 'inbox') {
            titleEl.textContent = 'Inbox';
            searchBox.classList.add('hidden');
            tasksControls.classList.add('hidden');
            addTaskBtn.classList.add('hidden');
            projectsControls.classList.add('hidden');
            skillsControls.classList.add('hidden');
            activeSection = document.getElementById('view-inbox');
            activeSection.classList.remove('hidden');
            activeSection.classList.add('active');
            this.loadInbox().then(() => this.renderInbox());
        } else if (viewName === 'agent_runner') {
            titleEl.textContent = 'Agent Runner';
            searchBox.classList.add('hidden');
            tasksControls.classList.add('hidden');
            addTaskBtn.classList.add('hidden');
            projectsControls.classList.add('hidden');
            skillsControls.classList.add('hidden');
            activeSection = document.getElementById('view-agent-runner');
            activeSection.classList.remove('hidden');
            activeSection.classList.add('active');
            this.loadAgentRegistry()
                .then(() => this.loadQueue())
                .then(() => this.renderAgentRunner());
        }

        this.animateTitle(titleEl);
        if (activeSection) {
            this.animateViewEnter(activeSection);
            if (viewName === 'daily_report') {
                document.querySelectorAll('.metric-value').forEach(el => this.popMetric(el));
            }
        }

        this.focusGlobalChatInput();
    }

    // MAIN RENDER FUNCTION
    render() {
        this.renderSidebar();
        this.renderProjectSelects();

        if (this.currentView === 'tasks') {
            this.renderTasks();
        } else if (this.currentView === 'projects') {
            this.renderProjects();
        } else if (this.currentView === 'calendar') {
            this.renderCalendar();
        } else if (this.currentView === 'skills') {
            this.renderSkills();
        } else if (this.currentView === 'daily_report') {
            this.renderDailyReport();
        } else if (this.currentView === 'inbox') {
            this.renderInbox();
        }
    }

    renderSidebar() {
        if (!this._sidebarNavBuilt) {
            this.buildSidebarNav();
        } else {
            this.updateNavBadges();
        }
        this.renderSidebarProjects();
    }

    renderProjectSelects() {
        // Modal Task Project Select
        const taskProjSelect = document.getElementById('task-project');
        const currentTaskProjVal = taskProjSelect.value;
        taskProjSelect.innerHTML = '<option value="">No Project</option>';
        this.data.projects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            taskProjSelect.appendChild(opt);
        });
        taskProjSelect.value = currentTaskProjVal || '';
    }

    renderTasks() {
        const listContainer = document.getElementById('tasks-list-container');
        const kanbanContainer = document.getElementById('tasks-kanban-container');

        if (this.taskViewMode === 'list') {
            listContainer.classList.remove('hidden');
            kanbanContainer.classList.add('hidden');
            this.renderTasksList();
            this.animateViewEnter(listContainer);
        } else {
            listContainer.classList.add('hidden');
            kanbanContainer.classList.remove('hidden');
            this.renderTasksKanban();
            this.animateViewEnter(kanbanContainer);
        }
    }

    filterTasks() {
        return this.data.tasks.filter(task => {
            if (this.filters.projectId && task.projectId !== this.filters.projectId) {
                return false;
            }
            if (this.filters.search) {
                const query = this.filters.search;
                const matchTitle = task.title.toLowerCase().includes(query);
                const matchDesc = (task.description || '').toLowerCase().includes(query);
                if (!matchTitle && !matchDesc) return false;
            }
            return true;
        });
    }

    getProjectForTask(projectId) {
        return this.data.projects.find(p => p.id === projectId);
    }

    renderTasksList() {
        const filtered = this.filterTasks();
        const todoTasks = filtered.filter(t => t.status === 'todo');
        const inprogressTasks = filtered.filter(t => t.status === 'in_progress');
        const completedTasks = filtered.filter(t => t.status === 'completed');

        document.getElementById('count-todo').textContent = todoTasks.length;
        document.getElementById('count-inprogress').textContent = inprogressTasks.length;
        document.getElementById('count-completed').textContent = completedTasks.length;

        const renderSection = (tasks, containerId) => {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            if (tasks.length === 0) {
                container.innerHTML = `<p class="text-muted" style="padding: 0.5rem 0;">No tasks found in this section.</p>`;
                return;
            }

            tasks.forEach(task => {
                const project = this.getProjectForTask(task.projectId);
                const card = document.createElement('div');
                card.className = `task-card-list ${task.status === 'completed' ? 'completed' : ''}`;
                
                let checkIcon = task.status === 'completed' ? `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>` : '';

                card.innerHTML = `
                    <button class="task-checkbox" title="Toggle Status">${checkIcon}</button>
                    <div class="task-list-info">
                        <div class="task-title">${task.title}</div>
                        ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                        <div class="task-tags-row">
                            <span class="badge-priority ${task.priority}">${task.priority}</span>
                            ${project ? `<span class="badge-tag" style="border-left: 3px solid ${project.color}">${project.name}</span>` : ''}
                            ${task.dueDate ? `<span class="task-due-date ${new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'overdue' : ''}">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                ${task.dueDate}
                            </span>` : ''}
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="btn-icon btn-edit-task" title="Edit Task">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </div>
                `;

                // Toggle Checkbox Click
                card.querySelector('.task-checkbox').addEventListener('click', () => {
                    card.classList.add('task-completing');
                    task.status = task.status === 'completed' ? 'todo' : 'completed';
                    setTimeout(() => this.saveData(), 180);
                });

                // Edit Task Click
                card.querySelector('.btn-edit-task').addEventListener('click', () => {
                    this.openTaskModal(task);
                });
                card.querySelector('.task-title').addEventListener('click', () => {
                    this.openTaskModal(task);
                });

                container.appendChild(card);
            });
        };

        renderSection(todoTasks, 'list-todo');
        renderSection(inprogressTasks, 'list-inprogress');
        renderSection(completedTasks, 'list-completed');

        ['list-todo', 'list-inprogress', 'list-completed'].forEach(id => {
            this.staggerChildren(document.getElementById(id), '.task-card-list');
        });
    }

    renderTasksKanban() {
        const filtered = this.filterTasks();
        const todoTasks = filtered.filter(t => t.status === 'todo');
        const inprogressTasks = filtered.filter(t => t.status === 'in_progress');
        const completedTasks = filtered.filter(t => t.status === 'completed');

        document.getElementById('kanban-count-todo').textContent = todoTasks.length;
        document.getElementById('kanban-count-inprogress').textContent = inprogressTasks.length;
        document.getElementById('kanban-count-completed').textContent = completedTasks.length;

        const renderColumn = (tasks, containerId) => {
            const container = document.getElementById(containerId);
            container.innerHTML = '';

            tasks.forEach(task => {
                const project = this.getProjectForTask(task.projectId);
                const card = document.createElement('div');
                card.className = `kanban-card ${task.status === 'completed' ? 'completed' : ''}`;
                card.setAttribute('draggable', 'true');
                
                card.innerHTML = `
                    <div class="kanban-card-header">
                        <div class="kanban-card-title">${task.title}</div>
                        <button class="btn-icon-small btn-edit-kanban-task" title="Edit Task">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </div>
                    ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                    <div class="task-tags-row" style="flex-wrap: wrap;">
                        <span class="badge-priority ${task.priority}">${task.priority}</span>
                        ${project ? `<span class="badge-tag" style="border-left: 3px solid ${project.color}">${project.name}</span>` : ''}
                    </div>
                    ${task.dueDate ? `
                    <div class="kanban-card-footer">
                        <span class="task-due-date ${new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'overdue' : ''}">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            ${task.dueDate}
                        </span>
                    </div>` : ''}
                `;

                // Drag Event Listeners
                card.addEventListener('dragstart', () => {
                    this.draggedTaskId = task.id;
                    card.classList.add('dragging');
                });
                card.addEventListener('dragend', () => {
                    this.draggedTaskId = null;
                    card.classList.remove('dragging');
                });

                // Edit Click
                card.querySelector('.btn-edit-kanban-task').addEventListener('click', () => {
                    this.openTaskModal(task);
                });
                card.querySelector('.kanban-card-title').addEventListener('click', () => {
                    this.openTaskModal(task);
                });

                container.appendChild(card);
            });
        };

        renderColumn(todoTasks, 'kanban-todo');
        renderColumn(inprogressTasks, 'kanban-inprogress');
        renderColumn(completedTasks, 'kanban-completed');

        ['kanban-todo', 'kanban-inprogress', 'kanban-completed'].forEach(id => {
            this.staggerChildren(document.getElementById(id), '.kanban-card');
        });
    }

    renderProjects() {
        const container = document.getElementById('projects-grid-container');
        container.innerHTML = '';

        if (this.data.projects.length === 0) {
            container.innerHTML = `<p class="text-muted">No projects created yet. Click "New Project" to start organizing.</p>`;
            return;
        }

        this.data.projects.forEach(project => {
            const projectTasks = this.data.tasks.filter(t => t.projectId === project.id);
            const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
            const totalTasks = projectTasks.length;
            const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            const card = document.createElement('div');
            card.className = 'project-card';
            
            card.innerHTML = `
                <div class="project-card-header">
                    <div class="project-title-group">
                        <span class="project-dot" style="background-color: ${project.color}; width: 14px; height: 14px;"></span>
                        <h3 class="project-card-title">${project.name}</h3>
                    </div>
                    <span class="project-status-badge ${project.status}">${project.status.replace('_', ' ')}</span>
                </div>
                ${project.description ? `<div class="project-card-desc">${project.description}</div>` : ''}
                <div class="project-progress-section">
                    <div class="progress-header">
                        <span>Progress (${completedTasks}/${totalTasks} tasks)</span>
                        <span>${progressPercent}%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${progressPercent}%; background-color: ${project.color};"></div>
                    </div>
                </div>
                <div class="project-card-footer">
                    <span>${project.deadline ? `Deadline: ${project.deadline}` : 'No deadline'}</span>
                    <div class="footer-actions">
                        <button class="btn-icon btn-add-proj-task" title="Add Task">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        <button class="btn-icon btn-edit-proj" title="Edit Project">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </div>
                </div>
            `;

            card.querySelector('.btn-add-proj-task').addEventListener('click', (e) => {
                e.stopPropagation();
                this.openTaskModal(null, '', project.id);
            });
            card.querySelector('.btn-edit-proj').addEventListener('click', () => {
                this.openProjectModal(project);
            });
            card.querySelector('.project-card-title').addEventListener('click', () => {
                this.openProjectModal(project);
            });

            container.appendChild(card);
        });
        this.staggerChildren(container, '.project-card');
    }

    renderSkills() {
        const container = document.getElementById('skills-grid-container');
        container.innerHTML = '';

        if (!this.data.skills || this.data.skills.length === 0) {
            container.innerHTML = `<p class="text-muted">No skills created yet. Click "New Skill" above to build your skills folder.</p>`;
            return;
        }

        this.data.skills.forEach(skill => {
            const card = document.createElement('div');
            card.className = 'skill-card';
            
            card.innerHTML = `
                <div class="skill-card-header">
                    <div class="skill-title-group">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" style="color: var(--primary);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        <h3 class="skill-card-title">${skill.name}</h3>
                    </div>
                    <span class="skill-level-badge ${skill.level}">${skill.level}</span>
                </div>
                ${skill.description ? `<div class="skill-card-desc">${skill.description}</div>` : ''}
                ${skill.notes ? `
                <div class="skill-notes-box">
                    <strong>Notes & Resources:</strong><br>
                    ${skill.notes}
                </div>` : ''}
                <div class="skill-card-footer">
                    <span>Folder Category: Knowledge Base</span>
                    <div class="footer-actions">
                        <button class="btn-icon btn-edit-skill" title="Edit Skill Folder">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </div>
                </div>
            `;

            // Edit Skill Click
            card.querySelector('.btn-edit-skill').addEventListener('click', () => {
                this.openSkillModal(skill);
            });
            card.querySelector('.skill-card-title').addEventListener('click', () => {
                this.openSkillModal(skill);
            });

            container.appendChild(card);
        });
        this.staggerChildren(container, '.skill-card');
    }

    renderAgentDigest() {
        const container = document.getElementById('daily-report-agent-digest');
        if (!container) return;

        if (!this.latestDigest) {
            container.innerHTML = '<p class="text-muted">No morning digest yet. Run <code>npm run digest</code> or daily-reporter in Cursor.</p>';
            return;
        }

        if (window.CortexRenderers && this.latestDigest.schema_type) {
            container.innerHTML = CortexRenderers.render(this.latestDigest.schema_type, this.latestDigest);
        } else if (this.latestDigest.focus) {
            container.innerHTML = `<p class="digest-focus"><strong>Focus:</strong> ${this.latestDigest.focus}</p>`;
        }
    }

    renderMemoryDigest() {
        this.renderAgentDigest();
        const container = document.getElementById('daily-report-memory-container');
        if (!container) return;

        const yesterdayIso = this.getYesterdayIso();
        const newIdeas = this.getMemoryIdeasSince(yesterdayIso);
        const painPoints = this.getOpenPainPoints();
        const pendingInbox = this.getPendingInboxCount();

        let html = '';

        if (pendingInbox > 0) {
            html += `<div class="memory-digest-block warning-block">
                <strong>Inbox (${pendingInbox} pending)</strong>
                <p>Items waiting for agent review. Open Inbox or run idea-creator-validator in Cursor.</p>
            </div>`;
        }

        if (newIdeas.length > 0) {
            html += `<div class="memory-digest-block"><strong>New ideas since yesterday</strong><ul>`;
            newIdeas.forEach(idea => {
                const verdict = idea.verdict ? ` [${idea.verdict}]` : '';
                html += `<li>${idea.content}${verdict}</li>`;
            });
            html += `</ul></div>`;
        }

        if (painPoints.length > 0) {
            html += `<div class="memory-digest-block"><strong>Open blockers</strong><ul>`;
            painPoints.forEach(p => {
                html += `<li><span class="badge-priority ${p.status === 'in_progress' ? 'medium' : 'high'}">${p.status}</span> ${p.description}</li>`;
            });
            html += `</ul></div>`;
        }

        if (!html) {
            html = `<p class="text-muted">No new ideas or open blockers in project memory since yesterday.</p>`;
        }

        container.innerHTML = html;
    }

    renderInbox() {
        const container = document.getElementById('inbox-items-container');
        if (!container) return;

        container.innerHTML = '';
        const pending = this.inbox.filter(i => i.status === 'pending');
        const processed = this.inbox.filter(i => i.status === 'processed');

        if (this.inbox.length === 0) {
            container.innerHTML = `<p class="text-muted">Inbox is empty. Use Quick Add below to capture ideas, notes, or questions.</p>`;
            return;
        }

        const renderGroup = (title, items) => {
            if (items.length === 0) return;
            const section = document.createElement('div');
            section.className = 'inbox-section';
            section.innerHTML = `<h3 class="section-header">${title} (${items.length})</h3>`;
            const list = document.createElement('div');
            list.className = 'inbox-list';

            items.forEach(item => {
                const card = document.createElement('div');
                card.className = `inbox-card ${item.status}`;
                const created = new Date(item.created_at).toLocaleString();
                const routeBadge = item.route && item.route !== 'unclassified'
                    ? `<span class="inbox-route-badge">${item.route} → ${item.target_agent || 'review'}</span>`
                    : '';
                card.innerHTML = `
                    <div class="inbox-card-content">${item.content}</div>
                    <div class="inbox-card-meta">
                        <span>${created}</span>
                        ${routeBadge}
                        <span class="inbox-status-badge ${item.status}">${item.status}</span>
                    </div>
                `;
                if (item.status === 'pending') {
                    const actions = document.createElement('div');
                    actions.className = 'inbox-card-actions';
                    if (item.target_agent) {
                        const runBtn = document.createElement('button');
                        runBtn.className = 'btn btn-primary btn-sm';
                        runBtn.textContent = 'Copy agent invocation';
                        runBtn.addEventListener('click', () => this.copyAgentInvocation(item.target_agent, item.id));
                        actions.appendChild(runBtn);
                    }
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-secondary btn-sm';
                    btn.textContent = 'Mark processed';
                    btn.addEventListener('click', () => this.markInboxProcessed(item.id));
                    actions.appendChild(btn);
                    card.appendChild(actions);
                }
                list.appendChild(card);
            });

            section.appendChild(list);
            container.appendChild(section);
        };

        renderGroup('Pending review', pending);
        renderGroup('Processed', processed);
        this.staggerChildren(container, '.inbox-card');
    }

    renderDailyReport() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dateTitleEl = document.getElementById('daily-report-date-title');

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateTitleEl.textContent = `Daily Summary — ${today.toLocaleDateString('en-US', options)}`;

        const completedCount = this.data.tasks.filter(t => t.status === 'completed').length;
        const pendingCount = this.data.tasks.filter(t => t.status !== 'completed').length;
        const activeProjectsCount = this.data.projects.filter(p => p.status === 'active').length;
        const inboxPending = this.getPendingInboxCount();

        document.getElementById('metric-completed').textContent = completedCount;
        document.getElementById('metric-pending').textContent = pendingCount;
        document.getElementById('metric-projects').textContent = activeProjectsCount;
        const metricInbox = document.getElementById('metric-inbox');
        if (metricInbox) metricInbox.textContent = inboxPending;

        const notesInput = document.getElementById('daily-notes-input');
        if (this.data.dailyNotes && this.data.dailyNotes[todayStr]) {
            notesInput.value = this.data.dailyNotes[todayStr];
        } else {
            notesInput.value = '';
        }

        this.renderMemoryDigest();

        const tasksContainer = document.getElementById('daily-report-tasks-container');
        tasksContainer.innerHTML = '';

        const actionTasks = this.data.tasks.filter(t => {
            if (t.status === 'completed') return false;
            if (!t.dueDate) return false;
            const dueTime = new Date(t.dueDate).getTime();
            const todayTime = new Date(todayStr).getTime();
            return dueTime <= todayTime;
        });

        if (actionTasks.length === 0) {
            tasksContainer.innerHTML = `<p class="text-muted" style="padding: 1rem 0;">No urgent or overdue tasks for today.</p>`;
            return;
        }

        actionTasks.forEach(task => {
            const project = this.getProjectForTask(task.projectId);
            const card = document.createElement('div');
            card.className = `task-card-list`;

            card.innerHTML = `
                <button class="task-checkbox" title="Mark Completed"></button>
                <div class="task-list-info">
                    <div class="task-title">${task.title}</div>
                    ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                    <div class="task-tags-row">
                        <span class="badge-priority ${task.priority}">${task.priority}</span>
                        ${project ? `<span class="badge-tag" style="border-left: 3px solid ${project.color}">${project.name}</span>` : ''}
                        <span class="task-due-date overdue">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            ${task.dueDate}
                        </span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon btn-edit-task" title="Edit Task">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                </div>
            `;

            // Checkbox Click
            card.querySelector('.task-checkbox').addEventListener('click', () => {
                task.status = 'completed';
                this.saveData();
                this.renderDailyReport();
            });

            // Edit Click
            card.querySelector('.btn-edit-task').addEventListener('click', () => {
                this.openTaskModal(task);
            });
            card.querySelector('.task-title').addEventListener('click', () => {
                this.openTaskModal(task);
            });

            tasksContainer.appendChild(card);
        });
        this.staggerChildren(tasksContainer, '.task-card-list');
    }

    renderCalendar() {
        const titleEl = document.getElementById('calendar-month-title');
        const daysContainer = document.getElementById('calendar-days-container');
        daysContainer.innerHTML = '';

        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        titleEl.textContent = `${monthNames[month]} ${year}`;

        const firstOfMonth = new Date(year, month, 1);
        const lastOfMonth = new Date(year, month + 1, 0);

        const start = new Date(firstOfMonth);
        const startDay = start.getDay();
        start.setDate(start.getDate() - (startDay === 0 ? 6 : startDay - 1));

        const end = new Date(lastOfMonth);
        const endDay = end.getDay();
        if (endDay === 6) end.setDate(end.getDate() - 1);
        else if (endDay === 0) end.setDate(end.getDate() - 2);
        else if (endDay !== 5) end.setDate(end.getDate() + (5 - endDay));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const current = new Date(start);
        while (current <= end) {
            const dow = current.getDay();
            if (dow < 1 || dow > 5) {
                current.setDate(current.getDate() + 1);
                continue;
            }

            const cellYear = current.getFullYear();
            const cellMonth = current.getMonth();
            const dayNumber = current.getDate();
            const currentCellDateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;

            const cell = document.createElement('div');
            cell.className = 'calendar-day-cell';
            if (cellMonth !== month) {
                cell.classList.add('other-month');
            }

            const cellDate = new Date(current);
            cellDate.setHours(0, 0, 0, 0);
            if (cellDate.getTime() === today.getTime()) {
                cell.classList.add('today');
            }

            // Day Top Bar (Day number + Add task button)
            cell.innerHTML = `
                <div class="calendar-day-top">
                    <span class="day-number">${dayNumber}</span>
                    <button class="btn-add-event" title="Add Task on this day">+</button>
                </div>
                <div class="calendar-events-container"></div>
            `;

            const eventsContainer = cell.querySelector('.calendar-events-container');

            // Find Projects with Deadline on this day
            const projectDeadlines = this.data.projects.filter(p => p.deadline === currentCellDateStr);
            projectDeadlines.forEach(p => {
                const pEl = document.createElement('div');
                pEl.className = 'calendar-event project-deadline';
                pEl.innerHTML = `ðŸŽ¯ [Deadline] ${p.name}`;
                pEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openProjectModal(p);
                });
                eventsContainer.appendChild(pEl);
            });

            // Find Tasks due on this day
            const dayTasks = this.data.tasks.filter(t => t.dueDate === currentCellDateStr);
            dayTasks.forEach(t => {
                const tEl = document.createElement('div');
                tEl.className = `calendar-event ${t.status === 'completed' ? 'completed' : ''}`;
                const project = this.getProjectForTask(t.projectId);
                if (project) {
                    tEl.style.borderLeftColor = project.color;
                }
                tEl.innerHTML = `â˜‘ï¸ ${t.title}`;
                tEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openTaskModal(t);
                });
                eventsContainer.appendChild(tEl);
            });

            // Click Add Task Button
            cell.querySelector('.btn-add-event').addEventListener('click', (e) => {
                e.stopPropagation();
                this.openTaskModal(null, currentCellDateStr);
            });

            daysContainer.appendChild(cell);
            current.setDate(current.getDate() + 1);
        }
        this.staggerChildren(daysContainer, '.calendar-day-cell');
    }

    // AGENT SIMULATION HANDLERS
    appendConsoleLog(text, type = '') {
        const linesContainer = document.getElementById('console-log-lines');
        const line = document.createElement('div');
        line.className = 'console-line line-enter';
        const timeStr = new Date().toTimeString().split(' ')[0];
        line.innerHTML = `
            <span class="console-time">[${timeStr}]</span>
            <span class="console-text ${type}">${text}</span>
        `;
        linesContainer.appendChild(line);
        linesContainer.scrollTop = linesContainer.scrollHeight;
    }

    renderAgentRunner() {
        const container = document.getElementById('agents-grid-container');
        const queueEl = document.getElementById('agent-queue-summary');
        if (!container) return;

        container.innerHTML = '';
        const pendingQueue = this.agentQueue.filter(q => q.status === 'pending');

        if (queueEl) {
            queueEl.textContent = pendingQueue.length > 0
                ? `${pendingQueue.length} item(s) queued for agents`
                : 'Queue empty — capture via Quick Add with idea:, pain:, research:, or task: prefix';
        }

        const tierLabels = { fast: 'Fast tier', mid: 'Mid tier', full: 'Full capability' };

        this.agentRegistry.forEach(agent => {
            const card = document.createElement('div');
            card.className = 'agent-card';
            const queued = pendingQueue.filter(q => q.target_agent === agent.id).length;
            card.innerHTML = `
                <div class="agent-card-header">
                    <div class="agent-title-group">
                        <h3 class="agent-card-title">${agent.name}</h3>
                    </div>
                    <span class="agent-status-badge idle" id="status-agent-${agent.id}">Idle</span>
                </div>
                <p class="agent-card-desc">${agent.description}</p>
                <div class="agent-card-footer">
                    <span class="agent-model-tag">${tierLabels[agent.model_tier] || agent.model_tier}</span>
                    ${queued > 0 ? `<span class="agent-queue-count">${queued} queued</span>` : ''}
                    <button class="btn btn-secondary btn-run-agent-instance" data-agent-id="${agent.id}">Copy invocation</button>
                </div>
            `;
            container.appendChild(card);
        });

        this.staggerChildren(container, '.agent-card');
    }

    buildAgentInvocation(agentId, inboxId) {
        const agent = this.agentRegistry.find(a => a.id === agentId);
        if (!agent) return '';
        let text = agent.invocation || `Run ${agentId}`;
        if (inboxId) text = text.replace('{inbox_id}', inboxId);
        return text.replace('{project_id}', 'cortex').replace('{topic}', 'your topic here');
    }

    async copyAgentInvocation(agentId, inboxId) {
        const text = this.buildAgentInvocation(agentId, inboxId);
        try {
            await navigator.clipboard.writeText(text);
            this.showGlobalChatFeedback('Agent invocation copied');
        } catch {
            alert(`Run in Cursor:\n${text}`);
        }
    }

    async processNextQueuedItem() {
        const next = this.agentQueue.find(q => q.status === 'pending');
        if (!next) {
            this.appendConsoleLog('No items in agent queue.', 'system');
            return;
        }
        await this.copyAgentInvocation(next.target_agent, next.inbox_id);
        this.appendConsoleLog(`[Queue] Copied invocation for ${next.target_agent}: ${next.content?.slice(0, 60) || next.id}`, 'success');
    }

    async runAgentFromRegistry(agentId, btnEl) {
        const agent = this.agentRegistry.find(a => a.id === agentId);
        if (!agent) return;

        const statusBadge = document.getElementById(`status-agent-${agentId}`);
        const queueItem = this.agentQueue.find(q => q.target_agent === agentId && q.status === 'pending');
        const invocation = this.buildAgentInvocation(agentId, queueItem?.inbox_id);

        if (statusBadge) {
            statusBadge.className = 'agent-status-badge running';
            statusBadge.textContent = 'Ready';
        }
        if (btnEl) btnEl.textContent = 'Copied';

        this.appendConsoleLog(`[${agent.name}] ${invocation}`, 'system');

        try {
            await navigator.clipboard.writeText(invocation);
            this.appendConsoleLog(`[${agent.name}] Invocation copied — paste in Cursor to run.`, 'success');
        } catch {
            this.appendConsoleLog(`[${agent.name}] Copy failed — run manually in Cursor.`, 'system');
        }

        setTimeout(() => {
            if (statusBadge) {
                statusBadge.className = 'agent-status-badge idle';
                statusBadge.textContent = 'Idle';
            }
            if (btnEl) btnEl.textContent = 'Copy invocation';
        }, 2500);
    }

    runAgentSimulation(agentId, btnEl) {
        this.runAgentFromRegistry(agentId, btnEl);
    }

    triggerGlobalWorkspaceSynthesis() {
        this.appendConsoleLog(`[Global Workspace Synthesis] Spawning multi-model agent cluster...`, 'system');
        setTimeout(() => this.appendConsoleLog(`[Synthesis] Analyzing active project milestones against daily report reflections...`, 'tool'), 1200);
        setTimeout(() => this.appendConsoleLog(`[Synthesis] Extracting key metrics: ${this.data.tasks.length} total tasks, ${this.data.projects.length} active projects...`, 'tool'), 2500);
        setTimeout(() => {
            this.appendConsoleLog(`[Synthesis] COMPLETE: Workspace health index is 98.4%. Ready for presentation.`, 'success');
            alert('ðŸŽ‰ Global Workspace Synthesis complete! All background agents report peak workspace health.');
        }, 4000);
    }

    runCustomPromptSimulation(prompt) {
        setTimeout(() => this.appendConsoleLog(`[Agent Mode] Invoking router for prompt...`, 'system'), 800);
        setTimeout(() => this.appendConsoleLog(`[Agent Mode] Inspecting project database for relevance to "${prompt.slice(0, 25)}..."`, 'tool'), 2000);
        setTimeout(() => {
            this.appendConsoleLog(`[Agent Mode] Autonomous execution complete. Action successfully synthesized into memory buffer.`, 'success');
        }, 3800);
    }

    // MODAL OPENERS & HANDLERS
    openTaskModal(task = null, initialDueDate = '', initialProjectId = '') {
        this.renderProjectSelects();
        const modal = document.getElementById('modal-task');
        const titleEl = document.getElementById('modal-task-title');
        const deleteBtn = document.getElementById('btn-delete-task');
        
        const idInput = document.getElementById('task-id');
        const titleInput = document.getElementById('task-title');
        const descInput = document.getElementById('task-desc');
        const projectSelect = document.getElementById('task-project');
        const dueInput = document.getElementById('task-due');
        const prioritySelect = document.getElementById('task-priority');
        const statusSelect = document.getElementById('task-status');

        if (task) {
            titleEl.textContent = 'Edit Task';
            deleteBtn.classList.remove('hidden');
            idInput.value = task.id;
            titleInput.value = task.title;
            descInput.value = task.description || '';
            projectSelect.value = task.projectId || '';
            dueInput.value = task.dueDate || '';
            prioritySelect.value = task.priority || 'medium';
            statusSelect.value = task.status || 'todo';
        } else {
            titleEl.textContent = 'New Task';
            deleteBtn.classList.add('hidden');
            idInput.value = '';
            titleInput.value = '';
            descInput.value = '';
            projectSelect.value = initialProjectId || '';
            dueInput.value = initialDueDate || '';
            prioritySelect.value = 'medium';
            statusSelect.value = 'todo';
        }

        this.openModal(modal);
        titleInput.focus();
    }

    saveTaskForm() {
        const id = document.getElementById('task-id').value;
        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-desc').value.trim();
        const projectId = document.getElementById('task-project').value;
        const dueDate = document.getElementById('task-due').value;
        const priority = document.getElementById('task-priority').value;
        const status = document.getElementById('task-status').value;

        if (!title) return;

        if (id) {
            // Edit existing
            const task = this.data.tasks.find(t => t.id === id);
            if (task) {
                task.title = title;
                task.description = description;
                task.projectId = projectId;
                task.dueDate = dueDate;
                task.priority = priority;
                task.status = status;
            }
        } else {
            // Create new
            const newTask = {
                id: 'task-' + Date.now(),
                title,
                description,
                projectId,
                dueDate,
                priority,
                status
            };
            this.data.tasks.unshift(newTask);
        }

        this.closeModal(document.getElementById('modal-task'));
        this.saveData();
        if (this.currentView === 'daily_report') this.renderDailyReport();
        this.focusGlobalChatInput();
    }

    openProjectModal(project = null) {
        const modal = document.getElementById('modal-project');
        const titleEl = document.getElementById('modal-project-title');
        const deleteBtn = document.getElementById('btn-delete-project');

        const idInput = document.getElementById('project-id');
        const nameInput = document.getElementById('project-name');
        const descInput = document.getElementById('project-desc');
        const colorInput = document.getElementById('project-color');
        const colorDisplay = document.getElementById('color-hex-display');
        const statusSelect = document.getElementById('project-status');
        const startInput = document.getElementById('project-start');
        const deadlineInput = document.getElementById('project-deadline');

        if (project) {
            titleEl.textContent = 'Edit Project';
            deleteBtn.classList.remove('hidden');
            idInput.value = project.id;
            nameInput.value = project.name;
            descInput.value = project.description || '';
            colorInput.value = project.color || '#6366f1';
            colorDisplay.textContent = project.color || '#6366f1';
            statusSelect.value = project.status || 'active';
            startInput.value = project.startDate || '';
            deadlineInput.value = project.deadline || '';
        } else {
            titleEl.textContent = 'New Project';
            deleteBtn.classList.add('hidden');
            idInput.value = '';
            nameInput.value = '';
            descInput.value = '';
            colorInput.value = '#6366f1';
            colorDisplay.textContent = '#6366f1';
            statusSelect.value = 'active';
            startInput.value = new Date().toISOString().split('T')[0];
            deadlineInput.value = '';
        }

        this.openModal(modal);
        nameInput.focus();
    }

    saveProjectForm() {
        const id = document.getElementById('project-id').value;
        const name = document.getElementById('project-name').value.trim();
        const description = document.getElementById('project-desc').value.trim();
        const color = document.getElementById('project-color').value;
        const status = document.getElementById('project-status').value;
        const startDate = document.getElementById('project-start').value;
        const deadline = document.getElementById('project-deadline').value;

        if (!name) return;

        if (id) {
            // Edit existing
            const project = this.data.projects.find(p => p.id === id);
            if (project) {
                project.name = name;
                project.description = description;
                project.color = color;
                project.status = status;
                project.startDate = startDate;
                project.deadline = deadline;
            }
        } else {
            // Create new
            const newProject = {
                id: 'proj-' + Date.now(),
                name,
                description,
                color,
                status,
                startDate,
                deadline
            };
            this.data.projects.push(newProject);
        }

        this.closeModal(document.getElementById('modal-project'));
        this.saveData();
        if (this.currentView === 'daily_report') this.renderDailyReport();
        this.focusGlobalChatInput();
    }

    openSkillModal(skill = null) {
        const modal = document.getElementById('modal-skill');
        const titleEl = document.getElementById('modal-skill-title');
        const deleteBtn = document.getElementById('btn-delete-skill');

        const idInput = document.getElementById('skill-id');
        const nameInput = document.getElementById('skill-name');
        const descInput = document.getElementById('skill-desc');
        const levelSelect = document.getElementById('skill-level');
        const notesInput = document.getElementById('skill-notes');

        if (skill) {
            titleEl.textContent = 'Edit Skill Folder';
            deleteBtn.classList.remove('hidden');
            idInput.value = skill.id;
            nameInput.value = skill.name;
            descInput.value = skill.description || '';
            levelSelect.value = skill.level || 'intermediate';
            notesInput.value = skill.notes || '';
        } else {
            titleEl.textContent = 'New Skill Folder';
            deleteBtn.classList.add('hidden');
            idInput.value = '';
            nameInput.value = '';
            descInput.value = '';
            levelSelect.value = 'intermediate';
            notesInput.value = '';
        }

        this.openModal(modal);
        nameInput.focus();
    }

    saveSkillForm() {
        const id = document.getElementById('skill-id').value;
        const name = document.getElementById('skill-name').value.trim();
        const description = document.getElementById('skill-desc').value.trim();
        const level = document.getElementById('skill-level').value;
        const notes = document.getElementById('skill-notes').value.trim();

        if (!name) return;

        if (id) {
            // Edit existing
            const skill = this.data.skills.find(s => s.id === id);
            if (skill) {
                skill.name = name;
                skill.description = description;
                skill.level = level;
                skill.notes = notes;
            }
        } else {
            // Create new
            const newSkill = {
                id: 'skill-' + Date.now(),
                name,
                description,
                level,
                notes
            };
            this.data.skills.push(newSkill);
        }

        this.closeModal(document.getElementById('modal-skill'));
        this.saveData();
        if (this.currentView === 'daily_report') this.renderDailyReport();
        this.focusGlobalChatInput();
    }
}

// Instantiate App
document.addEventListener('DOMContentLoaded', () => {
    window.appState = new AppState();
});

