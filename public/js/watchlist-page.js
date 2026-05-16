class WatchlistPage {
    constructor() {
        this._init();
    }

    async _init() {
        await authManager.ready;
        if (!window.currentUser) {
            document.getElementById('loginPrompt').style.display = 'block';
            return;
        }
        await this._load();
    }

    async _load() {
        try {
            const res = await fetch('/api/watchlist', { credentials: 'include' });
            const data = await res.json();
            if (data.success) this._render(data.watchlist);
        } catch (e) { console.error(e); }
    }

    _render(items) {
        const grid = document.getElementById('watchlistGrid');
        if (!items.length) {
            document.getElementById('emptyState').style.display = 'block';
            return;
        }
        items.forEach(item => grid.appendChild(this._createCard(item)));
    }

    _createCard(item) {
        const card = document.createElement('div');
        card.className = 'watchlist-card';
        card.id = `card-${item.movie_id}-${item.movie_type}`;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `${item.title} - ${item.movie_type}`);

        const img = document.createElement('img');
        img.src = item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '/assets/placeholder.svg';
        img.alt = item.title;
        img.loading = 'lazy';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '✕';
        removeBtn.title = 'Remove from watchlist';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._remove(item.movie_id, item.movie_type);
        });

        const info = document.createElement('div');
        info.className = 'card-info';
        const title = document.createElement('div'); title.className = 'card-title'; title.textContent = item.title;
        const meta = document.createElement('div'); meta.className = 'card-meta'; meta.textContent = item.year || '';
        const badge = document.createElement('span');
        badge.className = `type-badge type-${item.movie_type}`;
        badge.textContent = item.movie_type === 'movie' ? 'Movie' : 'TV Show';
        info.append(title, meta, badge);

        card.append(img, removeBtn, info);

        // Make card clickable to open review modal
        const openModal = () => {
            if (typeof window.openAddToListModal === 'function') {
                const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '/assets/placeholder.svg';
                window.openAddToListModal(item.movie_id, item.movie_type, item.title, poster, item.year || '');
            }
        };

        // Click and keyboard support
        card.addEventListener('click', openModal);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                openModal();
            }
        });

        return card;
    }

    async _remove(movieId, type) {
        try {
            const res = await fetch(`/api/watchlist/${movieId}?type=${type}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                const card = document.getElementById(`card-${movieId}-${type}`);
                if (card) card.remove();
                const grid = document.getElementById('watchlistGrid');
                if (!grid.children.length) document.getElementById('emptyState').style.display = 'block';
            }
        } catch (e) { console.error(e); }
    }
}

document.addEventListener('DOMContentLoaded', () => new WatchlistPage());
