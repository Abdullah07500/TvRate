/**
 * movie-card.js
 * Reusable MovieCard component for TvRate.
 * Must be loaded before app.js, top10.js, top100.js, upcoming.js,
 * and modal-handler.js.
 */

class MovieCard {
    /**
     * @param {Object}   item               - Raw movie/TV object from the API
     * @param {string}   type               - 'movie' or 'tv'
     * @param {Object}   [options={}]
     * @param {number}   [options.rank]     - Rank number shown as a badge (e.g. Top 10)
     * @param {Function} [options.onReview]    - Callback(id, type, title, poster, year)
     * @param {Function} [options.onWatchlist] - Callback(id, type, title, poster, year)
     */
    constructor(item, type, options = {}) {
        this._item        = item;
        this._type        = type;
        this._rank        = options.rank        != null ? options.rank : null;
        this._onReview    = options.onReview    || null;
        this._onWatchlist = options.onWatchlist || null;
    }

    // ------------------------------------------------------------------ //
    //  Public API
    // ------------------------------------------------------------------ //

    /**
     * Builds and returns the card DOM element (div.movie-card).
     * @returns {HTMLDivElement}
     */
    render() {
        const { _item: item, _type: type } = this;

        const id     = item.id;
        const title  = MovieCard.sanitize(item.title || item.name || 'Unknown Title');
        const rating = item.vote_average != null
            ? parseFloat(item.vote_average).toFixed(1)
            : 'N/A';
        const year   = this._getYear(item);
        const poster = item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : '/assets/placeholder.svg';

        // Root element
        const card = document.createElement('div');
        card.className = 'movie-card';

        // Optional rank badge
        if (this._rank !== null) {
            const rankEl = document.createElement('div');
            rankEl.className   = 'movie-rank';
            rankEl.textContent = this._rank;
            card.appendChild(rankEl);
        }

        // ---- Poster wrapper ------------------------------------------ //
        const posterWrapper = document.createElement('div');
        posterWrapper.className = 'movie-poster-wrapper';
        posterWrapper.style.cursor = 'pointer';

        const img       = document.createElement('img');
        img.className   = 'movie-poster';
        img.src         = poster;
        img.alt         = title;
        img.loading     = 'lazy';
        img.onerror     = () => { img.src = '/assets/placeholder.svg'; };

        // Rating badge
        const ratingBadge       = document.createElement('span');
        ratingBadge.className   = `movie-rating ${MovieCard._ratingClass(rating)}`;
        ratingBadge.textContent = rating;

        // Card action buttons
        const actionsDiv      = document.createElement('div');
        actionsDiv.className  = 'card-actions';

        const reviewBtn       = document.createElement('button');
        reviewBtn.className   = 'add-to-list-btn';
        reviewBtn.textContent = '⭐ Review';
        reviewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._triggerReview(id, type, title, poster, year);
        });

        const watchlistBtn       = document.createElement('button');
        watchlistBtn.className   = 'watchlist-btn';
        watchlistBtn.textContent = '📋';
        watchlistBtn.title       = 'Add to Watchlist';
        watchlistBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._triggerWatchlist(id, type, title, poster, year);
        });

        actionsDiv.appendChild(reviewBtn);
        actionsDiv.appendChild(watchlistBtn);

        // Clicking the poster wrapper also opens the review modal
        posterWrapper.addEventListener('click', () => {
            this._triggerReview(id, type, title, poster, year);
        });

        posterWrapper.appendChild(img);
        posterWrapper.appendChild(ratingBadge);
        posterWrapper.appendChild(actionsDiv);

        // ---- Movie info section --------------------------------------- //
        const infoDiv     = document.createElement('div');
        infoDiv.className = 'movie-info';

        const titleEl       = document.createElement('h3');
        titleEl.className   = 'movie-title';
        titleEl.textContent = title;

        const metaDiv     = document.createElement('div');
        metaDiv.className = 'movie-meta';

        const yearSpan       = document.createElement('span');
        yearSpan.className   = 'movie-year';
        yearSpan.textContent = year || 'N/A';

        metaDiv.appendChild(yearSpan);
        infoDiv.appendChild(titleEl);
        infoDiv.appendChild(metaDiv);

        card.appendChild(posterWrapper);
        card.appendChild(infoDiv);

        return card;
    }

    // ------------------------------------------------------------------ //
    //  Static helpers
    // ------------------------------------------------------------------ //

    /**
     * Returns a safely-escaped plain-text string using the textContent trick.
     * Prevents XSS when inserting untrusted strings into the DOM.
     * @param {string} str
     * @returns {string}
     */
    static sanitize(str) {
        const el         = document.createElement('span');
        el.textContent   = String(str);
        return el.textContent;
    }

    /**
     * Determines a CSS colour class from a numeric rating.
     * @param {string|number} rating
     * @returns {'high'|'medium'|'low'}
     */
    static _ratingClass(rating) {
        const n = parseFloat(rating);
        if (isNaN(n)) return 'low';
        if (n >= 7)   return 'high';
        if (n >= 5)   return 'medium';
        return 'low';
    }

    // ------------------------------------------------------------------ //
    //  Private helpers
    // ------------------------------------------------------------------ //

    _getYear(item) {
        const raw = item.release_date || item.first_air_date || '';
        return raw ? raw.substring(0, 4) : '';
    }

    _triggerReview(id, type, title, poster, year) {
        if (typeof this._onReview === 'function') {
            this._onReview(id, type, title, poster, year);
        } else if (typeof window.openAddToListModal === 'function') {
            window.openAddToListModal(id, type, title, poster, year);
        }
    }

    _triggerWatchlist(id, type, title, poster, year) {
        if (typeof this._onWatchlist === 'function') {
            this._onWatchlist(id, type, title, poster, year);
        } else if (typeof window.addToWatchlist === 'function') {
            window.addToWatchlist(id, type, title, poster, year);
        }
    }
}
