/**
 * app.js  —  Browse / Search page for TvRate
 * Loaded on index.html (the Browse page).
 * Depends on: auth.js (loaded before), modal-handler.js (loaded after).
 */

class BrowsePage {
    constructor() {
        this._searchInput      = document.getElementById('searchInput');
        this._searchBtn        = document.getElementById('searchBtn');
        this._searchTypeRadios = document.querySelectorAll('input[name="searchType"]');
        this._resultsSection   = document.getElementById('resultsSection');
        this._resultsGrid      = document.getElementById('resultsGrid');
        this._loadingIndicator = document.getElementById('loadingIndicator');
        this._errorMessage     = document.getElementById('errorMessage');
        this._noResultsMessage = document.getElementById('noResultsMessage');

        this._attachListeners();
    }

    // ------------------------------------------------------------------ //
    //  Event wiring
    // ------------------------------------------------------------------ //

    _attachListeners() {
        if (this._searchBtn) {
            this._searchBtn.addEventListener('click', () => this._onSearchTriggered());
        }

        if (this._searchInput) {
            this._searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._onSearchTriggered();
            });
        }

        // Re-run the search when the user switches type if a query is present
        this._searchTypeRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                if (this._searchInput && this._searchInput.value.trim()) {
                    this._onSearchTriggered();
                }
            });
        });
    }

    _onSearchTriggered() {
        const query = this._searchInput ? this._searchInput.value.trim() : '';
        const type  = this._getSelectedType();
        if (query) {
            this.search(query, type);
        }
    }

    _getSelectedType() {
        const checked = document.querySelector('input[name="searchType"]:checked');
        return checked ? checked.value : 'multi';
    }

    // ------------------------------------------------------------------ //
    //  Data fetching
    // ------------------------------------------------------------------ //

    async search(query, type) {
        this._showLoading();
        this._hideError();
        this._hideNoResults();
        this._hideResults();

        try {
            if (type === 'users') {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                const data = await res.json();
                const users = data.users || [];
                if (users.length === 0) {
                    this._showNoResults();
                } else {
                    this._renderUserCards(users);
                    this._showResults();
                }
            } else {
                // type === 'multi': search both movies and TV shows via TMDB multi-search
                const res = await fetch(`/api/search/multi?query=${encodeURIComponent(query)}`);
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                const data = await res.json();
                const results = data.results || [];
                if (results.length === 0) {
                    this._showNoResults();
                } else {
                    this._renderCards(results);
                    this._showResults();
                }
            }
        } catch (err) {
            console.error('Search error:', err);
            this._showError('Could not complete the search. Please try again.');
        } finally {
            this._hideLoading();
        }
    }

    // ------------------------------------------------------------------ //
    //  Rendering — movie/TV cards
    // ------------------------------------------------------------------ //

    _renderCards(results) {
        if (!this._resultsGrid) return;
        this._resultsGrid.style.display = '';
        this._resultsGrid.innerHTML = '';

        results.forEach((item) => {
            // Each item from /api/search/multi carries its own media_type
            const type = item.media_type || 'movie';
            const card = new MovieCard(item, type);
            this._resultsGrid.appendChild(card.render());
        });
    }

    // ------------------------------------------------------------------ //
    //  Rendering — user cards
    // ------------------------------------------------------------------ //

    _renderUserCards(users) {
        if (!this._resultsGrid) return;
        this._resultsGrid.style.display = 'block';
        this._resultsGrid.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'user-result-grid';

        users.forEach((user) => {
            const card = document.createElement('div');
            card.className = 'user-result-card';

            const avatar = document.createElement('div');
            avatar.className = 'user-result-avatar';
            avatar.textContent = user.username[0].toUpperCase();

            const info = document.createElement('div');
            info.className = 'user-result-info';

            const name = document.createElement('a');
            name.className = 'user-result-name';
            name.href = `/profile/${encodeURIComponent(user.username)}`;
            name.textContent = '@' + user.username;

            const bio = document.createElement('div');
            bio.className = 'user-result-bio';
            bio.textContent = user.bio || '';

            const meta = document.createElement('div');
            meta.className = 'user-result-meta';
            meta.textContent = `${user.followerCount} follower${user.followerCount !== 1 ? 's' : ''}`;

            info.append(name, bio, meta);

            const actions = document.createElement('div');
            actions.className = 'user-result-actions';

            const profileLink = document.createElement('a');
            profileLink.className = 'user-result-profile-link';
            profileLink.href = `/profile/${encodeURIComponent(user.username)}`;
            profileLink.textContent = 'View Profile';
            actions.appendChild(profileLink);

            if (!user.isOwnProfile && window.currentUser) {
                const followBtn = document.createElement('button');
                followBtn.className = `user-result-follow-btn ${user.isFollowing ? 'unfollow' : 'follow'}`;
                followBtn.textContent = user.isFollowing ? 'Unfollow' : 'Follow';
                followBtn.addEventListener('click', () => this._toggleFollow(user.username, followBtn));
                actions.appendChild(followBtn);
            }

            card.append(avatar, info, actions);
            grid.appendChild(card);
        });

        this._resultsGrid.appendChild(grid);
    }

    async _toggleFollow(username, btn) {
        const isFollowing = btn.classList.contains('unfollow');
        try {
            const res = await fetch(`/api/follow/${encodeURIComponent(username)}`, {
                method: isFollowing ? 'DELETE' : 'POST',
                credentials: 'include'
            });
            if (res.ok) {
                btn.classList.toggle('follow');
                btn.classList.toggle('unfollow');
                btn.textContent = isFollowing ? 'Follow' : 'Unfollow';
            }
        } catch (err) {
            console.error('Follow toggle error:', err);
        }
    }

    // ------------------------------------------------------------------ //
    //  UI state helpers
    // ------------------------------------------------------------------ //

    _showLoading() {
        if (this._loadingIndicator) this._loadingIndicator.classList.remove('hidden');
    }

    _hideLoading() {
        if (this._loadingIndicator) this._loadingIndicator.classList.add('hidden');
    }

    _showError(msg) {
        if (this._errorMessage) {
            this._errorMessage.textContent = msg;
            this._errorMessage.classList.remove('hidden');
        }
    }

    _hideError() {
        if (this._errorMessage) this._errorMessage.classList.add('hidden');
    }

    _showNoResults() {
        if (this._noResultsMessage) this._noResultsMessage.classList.remove('hidden');
    }

    _hideNoResults() {
        if (this._noResultsMessage) this._noResultsMessage.classList.add('hidden');
    }

    _showResults() {
        if (this._resultsSection) this._resultsSection.classList.remove('hidden');
    }

    _hideResults() {
        if (this._resultsSection) this._resultsSection.classList.add('hidden');
    }
}

// ======================================================================
//  Bootstrap
// ======================================================================

document.addEventListener('DOMContentLoaded', () => {
    new BrowsePage();
});
