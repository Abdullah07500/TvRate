/**
 * upcoming.js  —  Coming Soon page for TvRate
 * Fetches /api/upcoming/movie and renders movies without rank badges.
 *
 * Depends on: movie-card.js (loaded before), modal-handler.js (loaded after).
 */

class UpcomingPage {
    constructor() {
        this._grid             = document.getElementById('moviesGrid');
        this._loadingIndicator = document.getElementById('loadingIndicator');
        this._errorMessage     = document.getElementById('errorMessage');

        this.load();
    }

    // ------------------------------------------------------------------ //
    //  Data fetching
    // ------------------------------------------------------------------ //

    async load() {
        try {
            const res = await fetch('/api/upcoming/movie');

            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const data   = await res.json();
            const movies = data.results || [];

            this._hideLoading();
            this._render(movies);
        } catch (err) {
            console.error('UpcomingPage load error:', err);
            this._hideLoading();
            this._showError('Unable to load upcoming movies. Please try again later.');
        }
    }

    // ------------------------------------------------------------------ //
    //  Rendering
    // ------------------------------------------------------------------ //

    /**
     * Creates MovieCard instances (no rank) and appends them to #moviesGrid.
     * @param {Object[]} movies
     */
    _render(movies) {
        if (!this._grid) return;
        this._grid.innerHTML = '';

        movies.forEach((movie) => {
            const card = new MovieCard(movie, 'movie');
            this._grid.appendChild(card.render());
        });
    }

    // ------------------------------------------------------------------ //
    //  UI helpers
    // ------------------------------------------------------------------ //

    _hideLoading() {
        if (this._loadingIndicator) this._loadingIndicator.classList.add('hidden');
    }

    _showError(msg) {
        if (this._errorMessage) {
            this._errorMessage.textContent = msg;
            this._errorMessage.classList.remove('hidden');
        }
    }
}

// ======================================================================
//  Bootstrap
// ======================================================================

document.addEventListener('DOMContentLoaded', () => {
    new UpcomingPage();
});
