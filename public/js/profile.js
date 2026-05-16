class ProfilePage {
    constructor() {
        this.username = location.pathname.split('/profile/')[1];
        this.profileData = null;
        this.followers = [];
        this.following = [];
        this._init();
    }

    async _init() {
        await authManager.ready;
        if (!this.username) { this._showNotFound(); return; }
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(this.username)}`, { credentials: 'include' });
            if (!res.ok) { this._showNotFound(); return; }
            this.profileData = await res.json();
            this.followers = this.profileData.followers || [];
            this.following = this.profileData.following || [];
            this._render();
            this._attachStatListeners();
        } catch (e) { console.error(e); }
    }

    _showNotFound() {
        document.getElementById('notFound').style.display = 'block';
    }

    _render() {
        const { user, reviews, watchlist, followerCount, followingCount, isFollowing, isOwnProfile } = this.profileData;
        document.title = `@${user.username} - TvRate`;
        document.getElementById('profileContent').style.display = 'block';
        document.getElementById('profileAvatar').textContent = user.username[0].toUpperCase();
        document.getElementById('profileUsername').textContent = '@' + user.username;
        document.getElementById('statReviews').textContent = reviews.length;
        document.getElementById('statWatchlist').textContent = watchlist.length;
        document.getElementById('statFollowers').textContent = followerCount;
        document.getElementById('statFollowing').textContent = followingCount;
        this._renderBio(user, isOwnProfile);
        this._renderFollowBtn(user, isFollowing, isOwnProfile);
        this._renderReviews(reviews);
        this._renderWatchlist(watchlist);
    }

    _attachStatListeners() {
        document.querySelectorAll('.stat').forEach(stat => {
            stat.addEventListener('click', () => {
                const statType = stat.dataset.stat;
                this._showStatModal(statType);
            });
        });
        
        // Close modal when clicking close button or outside
        document.getElementById('modalClose').addEventListener('click', () => this._closeModal());
        document.getElementById('statModal').addEventListener('click', (e) => {
            if (e.target.id === 'statModal') this._closeModal();
        });
    }

    _showStatModal(statType) {
        const modal = document.getElementById('statModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        switch (statType) {
            case 'reviews':
                modalTitle.textContent = 'Reviews';
                modalBody.innerHTML = this._renderReviewsModal(this.profileData.reviews);
                break;
            case 'watchlist':
                modalTitle.textContent = 'Watchlist';
                modalBody.innerHTML = this._renderWatchlistModal(this.profileData.watchlist);
                break;
            case 'followers':
                modalTitle.textContent = 'Followers';
                modalBody.innerHTML = this._renderFollowersModal();
                break;
            case 'following':
                modalTitle.textContent = 'Following';
                modalBody.innerHTML = this._renderFollowingModal();
                break;
        }

        modal.classList.add('active');

        // Attach click handlers to any movie items rendered in the modal
        modalBody.querySelectorAll('[data-movie-id]').forEach(card => {
            card.addEventListener('click', () => {
                this._openMovieModal(
                    card.dataset.movieId,
                    card.dataset.movieType,
                    card.dataset.movieTitle,
                    card.dataset.moviePoster,
                    card.dataset.movieYear
                );
            });
        });
    }

    _openMovieModal(id, type, title, posterPath, year) {
        this._closeModal();
        let posterUrl;
        if (!posterPath) {
            posterUrl = '/assets/placeholder.svg';
        } else if (posterPath.startsWith('http')) {
            posterUrl = posterPath;
        } else {
            posterUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
        }
        if (window.openAddToListModal) {
            window.openAddToListModal(id, type, title, posterUrl, year);
        }
    }

    _escapeAttr(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    _closeModal() {
        document.getElementById('statModal').classList.remove('active');
    }

    _renderReviewsModal(reviews) {
        if (!reviews.length) {
            return '<div class="empty-section">No reviews yet.</div>';
        }

        let html = '';
        reviews.forEach(r => {
            const dateStr = new Date(r.submitted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            html += `
                <div class="review-card"
                     style="cursor:pointer;transition:border-color .2s"
                     title="Click to review ${this._escapeAttr(r.title)}"
                     data-movie-id="${r.movie_id}"
                     data-movie-type="${this._escapeAttr(r.movie_type)}"
                     data-movie-title="${this._escapeAttr(r.title)}"
                     data-movie-poster="${this._escapeAttr(r.poster_path || '')}"
                     data-movie-year="${this._escapeAttr(r.year || '')}">
                    <img src="${r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : '/assets/placeholder.svg'}" alt="${this._escapeAttr(r.title)}">
                    <div>
                        <div class="r-title">${this._escapeAttr(r.title)}</div>
                        <div class="r-rating">⭐ ${r.rating}/10</div>
                        <div class="r-text">${this._escapeAttr(r.review_text)}</div>
                        <div class="r-date">${dateStr}</div>
                    </div>
                </div>
            `;
        });
        return html;
    }

    _renderWatchlistModal(items) {
        if (!items.length) {
            return '<div class="empty-section">No movies in the watchlist yet.</div>';
        }

        let html = '<div class="watchlist-grid">';
        items.forEach(item => {
            const yearStr = item.year ? ` • ${item.year}` : '';
            html += `
                <div class="wl-card"
                     title="${this._escapeAttr(item.title)}${this._escapeAttr(yearStr)}"
                     data-movie-id="${item.movie_id}"
                     data-movie-type="${this._escapeAttr(item.movie_type)}"
                     data-movie-title="${this._escapeAttr(item.title)}"
                     data-movie-poster="${this._escapeAttr(item.poster_path || '')}"
                     data-movie-year="${this._escapeAttr(item.year || '')}">
                    <img src="${item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : '/assets/placeholder.svg'}" alt="${this._escapeAttr(item.title)}" loading="lazy">
                    <div class="wl-title">${this._escapeAttr(item.title)}</div>
                    ${item.year ? `<div class="wl-year">${this._escapeAttr(item.year)}</div>` : ''}
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    _renderFollowersModal() {
        if (!this.followers.length) {
            return '<div class="empty-section">No followers yet.</div>';
        }
        
        let html = '';
        this.followers.forEach(user => {
            html += `
                <div class="user-item">
                    <div class="user-avatar-small">${user.username[0].toUpperCase()}</div>
                    <div class="user-info">
                        <a href="/profile/${user.username}" class="user-username">@${user.username}</a>
                        ${user.bio ? `<div class="user-bio">${user.bio}</div>` : ''}
                    </div>
                </div>
            `;
        });
        return html;
    }

    _renderFollowingModal() {
        if (!this.following.length) {
            return '<div class="empty-section">Not following anyone yet.</div>';
        }
        
        let html = '';
        this.following.forEach(user => {
            html += `
                <div class="user-item">
                    <div class="user-avatar-small">${user.username[0].toUpperCase()}</div>
                    <div class="user-info">
                        <a href="/profile/${user.username}" class="user-username">@${user.username}</a>
                        ${user.bio ? `<div class="user-bio">${user.bio}</div>` : ''}
                    </div>
                </div>
            `;
        });
        return html;
    }

    _renderBio(user, isOwnProfile) {
        const area = document.getElementById('profileBioArea');
        if (isOwnProfile) {
            const display = document.createElement('div');
            display.id = 'bioDisplay';
            display.style.cssText = 'color:#aaa;font-size:.9rem;min-height:20px';
            display.textContent = user.bio || 'No bio yet';
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-bio-btn';
            editBtn.textContent = 'Edit Bio';
            editBtn.addEventListener('click', () => this._editBio(user.bio || ''));
            area.innerHTML = '';
            area.append(display, editBtn);
        } else {
            area.textContent = user.bio || '';
            area.style.cssText = 'color:#aaa;font-size:.9rem';
        }
    }

    _editBio(current) {
        const area = document.getElementById('profileBioArea');
        const textarea = document.createElement('textarea');
        textarea.rows = 2; textarea.maxLength = 200; textarea.value = current;
        textarea.style.cssText = 'width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(1,180,228,.3);color:#fff;border-radius:8px;padding:8px 12px;font-size:.9rem;resize:vertical;box-sizing:border-box';
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-bio-btn'; saveBtn.textContent = 'Save'; saveBtn.style.marginTop = '8px';
        saveBtn.addEventListener('click', () => this._saveBio(textarea.value));
        area.innerHTML = '';
        area.append(textarea, saveBtn);
    }

    async _saveBio(bio) {
        await fetch('/api/users/bio', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bio }) });
        location.reload();
    }

    _renderFollowBtn(user, isFollowing, isOwnProfile) {
        if (isOwnProfile || !window.currentUser) return;
        const btn = document.createElement('button');
        btn.id = 'followBtn';
        btn.className = `follow-btn ${isFollowing ? 'unfollow' : 'follow'}`;
        btn.textContent = isFollowing ? 'Unfollow' : 'Follow';
        btn.addEventListener('click', () => this._toggleFollow(btn));
        document.getElementById('followArea').appendChild(btn);
    }

    async _toggleFollow(btn) {
        const following = btn.classList.contains('unfollow');
        const res = await fetch(`/api/follow/${this.username}`, { method: following ? 'DELETE' : 'POST', credentials: 'include' });
        if (res.ok) {
            btn.classList.toggle('follow'); btn.classList.toggle('unfollow');
            btn.textContent = following ? 'Follow' : 'Unfollow';
            const stat = document.getElementById('statFollowers');
            stat.textContent = parseInt(stat.textContent) + (following ? -1 : 1);
        }
    }

    _renderReviews(reviews) {
        const el = document.getElementById('tab-reviews');
        if (!reviews.length) { el.innerHTML = '<div class="empty-section">No approved reviews yet</div>'; return; }
        el.innerHTML = '';
        reviews.forEach(r => {
            const card = document.createElement('div');
            card.className = 'review-card';
            card.style.cursor = 'pointer';
            card.title = `Click to review ${r.title}`;
            card.addEventListener('click', () => this._openMovieModal(r.movie_id, r.movie_type, r.title, r.poster_path, r.year));
            const img = document.createElement('img');
            img.src = r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : '/assets/placeholder.svg';
            img.alt = r.title;
            const body = document.createElement('div');
            const title = document.createElement('div'); title.className = 'r-title'; title.textContent = r.title;
            const rating = document.createElement('div'); rating.className = 'r-rating'; rating.textContent = `⭐ ${r.rating}/10`;
            const text = document.createElement('div'); text.className = 'r-text'; text.textContent = r.review_text;
            body.append(title, rating, text);
            card.append(img, body);
            el.appendChild(card);
        });
    }

    _renderWatchlist(items) {
        const el = document.getElementById('tab-watchlist');
        if (!items.length) { el.innerHTML = '<div class="empty-section">Watchlist is empty</div>'; return; }
        const grid = document.createElement('div'); grid.className = 'watchlist-grid';
        items.forEach(item => {
            const card = document.createElement('div'); card.className = 'wl-card';
            card.addEventListener('click', () => this._openMovieModal(item.movie_id, item.movie_type, item.title, item.poster_path, item.year));
            const img = document.createElement('img');
            img.src = item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : '/assets/placeholder.svg';
            img.alt = item.title; img.loading = 'lazy';
            const titleEl = document.createElement('div'); titleEl.className = 'wl-title'; titleEl.textContent = item.title;
            card.append(img, titleEl);
            grid.appendChild(card);
        });
        el.appendChild(grid);
    }

    showTab(tab, btn) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-reviews').style.display = tab === 'reviews' ? 'block' : 'none';
        document.getElementById('tab-watchlist').style.display = tab === 'watchlist' ? 'block' : 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = new ProfilePage();
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() { page.showTab(this.dataset.tab, this); });
    });
});
