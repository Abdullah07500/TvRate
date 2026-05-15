/**
 * modal-handler.js
 * Provides ReviewModal and WatchlistManager classes.
 * Loaded after movie-card.js on pages that need it.
 *
 * Exposes on window:
 *   window.openAddToListModal(id, type, title, poster, year)
 *   window.closeAddToListModal()
 *   window.addToWatchlist(id, type, title, poster, year)
 *   window.showToast(message, type)
 */

// ======================================================================
//  ReviewModal — wraps the #addToListModal HTML element
// ======================================================================

class ReviewModal {
    /**
     * @param {Function} authCheckFn - Returns true when the user is logged in.
     */
    constructor(authCheckFn) {
        this._isLoggedIn   = authCheckFn;
        this._currentMovie = null;

        // Cache frequently-used elements
        this._modal        = document.getElementById('addToListModal');
        this._movieInfo    = document.getElementById('modalMovieInfo');
        this._form         = document.getElementById('addToListForm');
        this._ratingInput  = document.getElementById('userRating');
        this._reviewInput  = document.getElementById('userReview');
        this._charCount    = document.getElementById('charCount');
        this._ratingStars  = document.getElementById('ratingStars');

        if (this._modal) {
            this._attachListeners();
        }

        // Expose on window so MovieCard buttons and other scripts can call these
        window.openAddToListModal  = (id, type, title, poster, year) =>
            this.open(id, type, title, poster, year);
        window.closeAddToListModal = () => this.close();
    }

    // ------------------------------------------------------------------ //
    //  Public methods
    // ------------------------------------------------------------------ //

    /**
     * Opens the modal for a given movie/show.
     * Redirects to /login if the user is not authenticated.
     *
     * @param {string|number} id
     * @param {string}        type   - 'movie' or 'tv'
     * @param {string}        title
     * @param {string}        poster - Full image URL
     * @param {string}        year
     */
    open(id, type, title, poster, year) {
        if (!this._isLoggedIn()) {
            const go = confirm(
                'You must be logged in to submit a review.\nGo to the login page?'
            );
            if (go) window.location.href = '/login';
            return;
        }

        this._currentMovie = { id, type, title, poster, year };

        // Populate the info panel at the top of the modal
        if (this._movieInfo) {
            this._movieInfo.innerHTML = `
                <img src="${MovieCard.sanitize(poster)}"
                     alt="${MovieCard.sanitize(title)}"
                     class="modal-movie-poster"
                     onerror="this.src='/assets/placeholder.svg'">
                <div class="modal-movie-details">
                    <h3 class="modal-movie-title">${MovieCard.sanitize(title)}</h3>
                    <p class="modal-movie-meta">
                        ${type === 'tv' ? '📺 TV Show' : '🎬 Movie'}
                        ${year ? ' • ' + MovieCard.sanitize(year) : ''}
                    </p>
                </div>`;
        }

        // Reset form to a clean state
        if (this._form)        this._form.reset();
        if (this._charCount)   this._charCount.textContent = '0';
        if (this._ratingStars) this._ratingStars.innerHTML = '';

        // Show the modal
        if (this._modal) {
            this._modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    /** Hides the modal and clears stored movie data. */
    close() {
        if (this._modal) {
            this._modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
        this._currentMovie = null;
    }

    // ------------------------------------------------------------------ //
    //  Private methods
    // ------------------------------------------------------------------ //

    _attachListeners() {
        // Close / cancel buttons
        const closeBtn  = document.getElementById('modalCloseBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        if (closeBtn)  closeBtn.addEventListener('click',  () => this.close());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());

        // Click on the backdrop (outside modal-content) closes the modal
        this._modal.addEventListener('click', (e) => {
            if (e.target === this._modal) this.close();
        });

        // Live star preview while typing the rating number
        if (this._ratingInput) {
            this._ratingInput.addEventListener('input', () => {
                this._updateStars(parseFloat(this._ratingInput.value) || 0);
            });
        }

        // Character counter for the review textarea
        if (this._reviewInput) {
            this._reviewInput.addEventListener('input', () => {
                const len = this._reviewInput.value.length;
                if (this._charCount) this._charCount.textContent = len;
                // Optional: add visual warning near the limit
                const counter = this._charCount ? this._charCount.parentElement : null;
                if (counter) {
                    counter.classList.toggle('warning', len > 400);
                    counter.classList.toggle('danger',  len > 480);
                }
            });
        }

        // Form submission
        if (this._form) {
            this._form.addEventListener('submit', (e) => this._handleSubmit(e));
        }

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this._modal.classList.contains('hidden')) {
                this.close();
            }
        });
    }

    /**
     * Renders 5 stars based on a 1–10 rating.
     * @param {number} rating - 1 through 10
     */
    _updateStars(rating) {
        if (!this._ratingStars) return;
        const filled = Math.round((rating / 10) * 5);
        let html = '';
        for (let i = 1; i <= 5; i++) {
            html += `<span class="star ${i <= filled ? 'filled' : 'empty'}">★</span>`;
        }
        this._ratingStars.innerHTML = html;
    }

    /**
     * Submits the review to /api/reviews/submit.
     * Shows a toast on success or error.
     * @param {Event} e - The form submit event
     */
    async _handleSubmit(e) {
        e.preventDefault();

        if (!this._currentMovie) return;

        const rating = parseFloat(this._ratingInput ? this._ratingInput.value : '');
        const review = this._reviewInput ? this._reviewInput.value.trim() : '';

        if (!rating || rating < 1 || rating > 10) {
            window.showToast('Please enter a valid rating between 1 and 10.', 'error');
            return;
        }
        if (review.length < 10) {
            window.showToast('Review must be at least 10 characters.', 'error');
            return;
        }

        const submitBtn = this._form
            ? this._form.querySelector('[type="submit"]')
            : null;

        try {
            if (submitBtn) {
                submitBtn.disabled    = true;
                submitBtn.textContent = 'Submitting...';
            }

            const res = await fetch('/api/reviews/submit', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    movieId:    this._currentMovie.id,
                    type:       this._currentMovie.type,
                    title:      this._currentMovie.title,
                    poster:     this._currentMovie.poster,
                    year:       this._currentMovie.year,
                    rating,
                    reviewText: review,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                this.close();
                window.showToast('Review submitted successfully!', 'success');
            } else {
                window.showToast(data.error || data.message || 'Failed to submit review.', 'error');
            }
        } catch (err) {
            window.showToast('Network error. Please try again.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled    = false;
                submitBtn.textContent = 'Submit Review';
            }
        }
    }
}

// ======================================================================
//  WatchlistManager — handles GET / POST / DELETE for /api/watchlist
// ======================================================================

class WatchlistManager {
    /**
     * @param {Function} authCheckFn - Returns true when the user is logged in.
     */
    constructor(authCheckFn) {
        this._isLoggedIn = authCheckFn;

        this._toastEl    = document.getElementById('toast');
        this._toastMsgEl = document.getElementById('toastMessage');
        this._toastTimer = null;

        // Expose on window
        window.addToWatchlist = (id, type, title, poster, year) =>
            this.add(id, type, title, poster, year);
        window.showToast = (message, type) =>
            this.showToast(message, type);
    }

    // ------------------------------------------------------------------ //
    //  Public API
    // ------------------------------------------------------------------ //

    /**
     * Adds an item to the signed-in user's watchlist via POST /api/watchlist.
     * @param {string|number} id
     * @param {string}        type   - 'movie' or 'tv'
     * @param {string}        title
     * @param {string}        poster - Full image URL
     * @param {string}        year
     */
    async add(id, type, title, poster, year) {
        if (!this._isLoggedIn()) {
            const go = confirm(
                'You must be logged in to use the watchlist.\nGo to the login page?'
            );
            if (go) window.location.href = '/login';
            return;
        }

        try {
            const res = await fetch('/api/watchlist', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movieId: id, type, title, poster, year }),
            });

            const data = await res.json();

            if (res.ok) {
                this.showToast(`"${title}" added to your watchlist!`, 'success');
            } else {
                const msg = data.error === 'Already in watchlist'
                    ? 'Already in your watchlist.'
                    : (data.error || data.message || 'Could not add to watchlist.');
                this.showToast(msg, 'info');
            }
        } catch (err) {
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    /**
     * Removes an item from the watchlist via DELETE /api/watchlist/:id?type=X.
     * @param {string|number} movieId
     * @param {string}        type - 'movie' or 'tv'
     */
    async remove(movieId, type) {
        try {
            const res = await fetch(
                `/api/watchlist/${movieId}?type=${encodeURIComponent(type)}`,
                { method: 'DELETE', credentials: 'include' }
            );

            const data = await res.json();

            if (res.ok) {
                this.showToast('Removed from your watchlist.', 'success');
            } else {
                this.showToast(data.error || data.message || 'Could not remove from watchlist.', 'error');
            }
        } catch (err) {
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    /**
     * Checks whether an item is already in the user's watchlist.
     * @param {string|number} movieId
     * @param {string}        type
     * @returns {Promise<boolean>}
     */
    async check(movieId, type) {
        try {
            const res = await fetch(
                `/api/watchlist/check/${movieId}?type=${encodeURIComponent(type)}`,
                { credentials: 'include' }
            );
            if (!res.ok) return false;
            const data = await res.json();
            return !!data.inWatchlist;
        } catch (err) {
            return false;
        }
    }

    /**
     * Displays a brief (#toast) notification for 3 seconds.
     * @param {string}                       message
     * @param {'success'|'error'|'info'}     type
     */
    showToast(message, type = 'info') {
        if (!this._toastEl || !this._toastMsgEl) return;

        // Cancel any running hide-timer so rapid calls don't stack
        if (this._toastTimer) clearTimeout(this._toastTimer);

        this._toastMsgEl.textContent = message;
        this._toastEl.className      = `toast toast-${type}`;

        this._toastTimer = setTimeout(() => {
            this._toastEl.className = 'toast hidden';
        }, 3000);
    }
}

// ======================================================================
//  Bootstrap — instantiates both classes once the DOM is ready
// ======================================================================

document.addEventListener('DOMContentLoaded', () => {
    // auth.js sets window.currentUser synchronously from cache, then
    // re-sets it asynchronously after the /api/auth/me fetch completes.
    // Using a closure that reads window.currentUser at call-time ensures
    // both classes always see the most up-to-date auth state.
    const authCheck = () => !!window.currentUser;

    new ReviewModal(authCheck);
    new WatchlistManager(authCheck);
});
