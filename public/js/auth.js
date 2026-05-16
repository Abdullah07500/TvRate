class AuthManager {
    constructor() {
        this.currentUser = null;
        this._ready = this._init();
    }

    async _init() {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            const data = await res.json();
            if (data.loggedIn) this.currentUser = data.user;
        } catch (e) {}
        window.currentUser = this.currentUser;
        this._renderNav();
        window.dispatchEvent(new CustomEvent('auth-ready', { detail: { user: this.currentUser } }));
    }

    get ready() { return this._ready; }
    isLoggedIn() { return !!this.currentUser; }

    _renderNav() {
        const nav = document.getElementById('site-nav');
        if (!nav) return;
        const active = window.ACTIVE_NAV || '';
        const links = [
            { href: '/list', label: 'Review Space', key: 'list' },
            { href: '/browse', label: 'Browse', key: 'browse' },
            { href: '/top10', label: 'Top Movies', key: 'top10' },
            { href: '/upcoming', label: 'Coming Soon', key: 'upcoming' },
        ];
        const mainLinks = links.map(l =>
            `<a href="${l.href}" class="nav-item${active === l.key ? ' active' : ''}">${l.label}</a>`
        ).join('');
        const authLinks = this.currentUser
            ? `<a href="/watchlist" class="nav-item${active === 'watchlist' ? ' active' : ''}">My List</a>
               <a href="/profile/${this.currentUser.username}" class="nav-item${active === 'profile' ? ' active' : ''}">@${this.currentUser.username}</a>
               <button id="logoutBtn" class="nav-btn-logout">Logout</button>`
            : `<a href="/login" class="nav-item${active === 'login' ? ' active' : ''}">Login</a>
               <a href="/register" class="nav-btn-register${active === 'register' ? ' active' : ''}">Register</a>`;
        nav.innerHTML = `
            <div class="header-content">
                <div class="logo-section">
                    <a href="/list" style="text-decoration:none"><h1 class="site-logo">🎬 TvRate</h1></a>
                    <p class="site-tagline">Community-powered movie ratings</p>
                </div>
                <nav class="main-nav">${mainLinks}</nav>
                <div class="auth-nav">${authLinks}</div>
            </div>`;
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());
    }

    async logout() {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login';
    }
}

const authManager = new AuthManager();
