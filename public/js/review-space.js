/**
 * review-space.js — Review Space feed for TvRate
 * Displays movie reviews from all users or only followed users
 * Loaded on list.html
 * Depends on: auth.js (loaded before)
 */

class ReviewSpaceFeed {
    constructor() {
        this.currentTab = 'everyone';
        this.allReviews = [];
        this.followingReviews = [];
        
        // DOM references
        this.container = document.getElementById('reviewSpaceContainer');
        this.feed = document.getElementById('reviewSpaceFeed');
        this.loading = document.getElementById('reviewSpaceLoading');
        this.emptyState = document.getElementById('reviewSpaceEmpty');
        this.emptyIcon = document.getElementById('emptyIcon');
        this.emptyMessage = document.getElementById('emptyMessage');
        this.tabs = document.querySelectorAll('.review-space-tab-btn');
        this.loginPrompt = document.getElementById('loginPrompt');
        
        this._init();
    }

    async _init() {
        await authManager.ready;
        
        if (!window.currentUser) {
            this.loginPrompt.style.display = 'block';
            return;
        }
        
        this.container.style.display = 'block';
        this._attachTabListeners();
        await this._loadReviews();
        this._render('everyone');
    }

    _attachTabListeners() {
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentTab = tab.dataset.tab;
                this._render(this.currentTab);
            });
        });
    }

    async _loadReviews() {
        try {
            this.loading.style.display = 'block';
            
            // Load all reviews
            const allRes = await fetch('/api/reviews/feed', { credentials: 'include' });
            if (allRes.ok) {
                const allData = await allRes.json();
                this.allReviews = allData.reviews || [];
            }
            
            // Load following reviews
            const followingRes = await fetch('/api/reviews/feed/following', { credentials: 'include' });
            if (followingRes.ok) {
                const followingData = await followingRes.json();
                this.followingReviews = followingData.reviews || [];
            }
        } catch (err) {
            console.error('Error loading reviews:', err);
            this.allReviews = [];
            this.followingReviews = [];
        } finally {
            this.loading.style.display = 'none';
        }
    }

    _render(tab) {
        const reviews = tab === 'everyone' ? this.allReviews : this.followingReviews;
        
        if (reviews.length === 0) {
            this._showEmpty(tab);
            return;
        }
        
        this._hideEmpty();
        this.feed.innerHTML = '';
        
        reviews.forEach(review => {
            const card = this._createReviewCard(review);
            this.feed.appendChild(card);
        });
    }

    _createReviewCard(review) {
        const div = document.createElement('div');
        div.className = 'review-card';
        
        // Poster image
        const poster = document.createElement('img');
        poster.className = 'review-card-poster';
        poster.src = this._posterUrl(review.poster_path);
        poster.alt = review.title;
        poster.loading = 'lazy';
        poster.onerror = () => { poster.src = '/assets/placeholder.svg'; };
        
        // Card body
        const body = document.createElement('div');
        body.className = 'review-card-body';
        
        // Header: username and date
        const header = document.createElement('div');
        header.className = 'review-card-header';
        
        const userLink = document.createElement('a');
        userLink.className = 'review-card-username';
        userLink.href = `/profile/${review.username}`;
        userLink.textContent = '@' + (review.username || 'Anonymous');
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'review-card-date';
        dateSpan.textContent = this._formatDate(review.submitted_date);
        
        header.appendChild(userLink);
        header.appendChild(dateSpan);
        
        // Title with type badge
        const titleDiv = document.createElement('div');
        titleDiv.className = 'review-card-title';
        
        const titleText = document.createElement('span');
        titleText.textContent = review.title;
        
        const typeBadge = document.createElement('span');
        typeBadge.className = `review-card-type-badge ${review.movie_type}`;
        typeBadge.textContent = review.movie_type === 'movie' ? 'Movie' : 'TV';
        
        titleDiv.appendChild(titleText);
        titleDiv.appendChild(typeBadge);
        
        // Rating
        const ratingDiv = document.createElement('div');
        ratingDiv.className = 'review-card-rating';
        ratingDiv.textContent = `⭐ ${review.rating}/10`;
        
        // Review text
        const reviewText = document.createElement('div');
        reviewText.className = 'review-card-text';
        reviewText.textContent = review.review_text;
        
        // Assemble body
        body.appendChild(header);
        body.appendChild(titleDiv);
        body.appendChild(ratingDiv);
        body.appendChild(reviewText);
        
        // Click on card opens review modal; skip clicks on profile links
        div.style.cursor = 'pointer';
        div.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            if (window.openAddToListModal) {
                window.openAddToListModal(
                    review.movie_id,
                    review.movie_type,
                    review.title,
                    this._posterUrl(review.poster_path),
                    review.year
                );
            }
        });

        // Assemble card
        div.appendChild(poster);
        div.appendChild(body);

        return div;
    }

    _posterUrl(path) {
        if (!path) return '/assets/placeholder.svg';
        if (path.startsWith('http')) return path;
        return `https://image.tmdb.org/t/p/w185${path}`;
    }

    _formatDate(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (err) {
            return 'Recently';
        }
    }

    _showEmpty(tab) {
        this.emptyState.style.display = 'block';
        this.feed.innerHTML = '';
        
        if (tab === 'everyone') {
            this.emptyIcon.textContent = '📝';
            this.emptyMessage.textContent = 'No reviews yet. Be the first to share your movie review.';
        } else {
            this.emptyIcon.textContent = '👥';
            this.emptyMessage.textContent = 'You are not following anyone yet. Follow users to see their reviews here.';
        }
    }

    _hideEmpty() {
        this.emptyState.style.display = 'none';
    }
}

// ======================================================================
//  Bootstrap
// ======================================================================

document.addEventListener('DOMContentLoaded', () => {
    new ReviewSpaceFeed();
});
