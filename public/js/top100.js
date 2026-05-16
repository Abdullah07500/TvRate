/**
 * top100.js  —  Top 100 Movies of All Time page for TvRate
 * Fetches pages 1–5 of /api/top-rated/movie concurrently,
 * combines results, slices to 100, and renders with rank badges.
 *
 * Depends on: movie-card.js (loaded before), modal-handler.js (loaded after).
 */

class Top100Page {
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
        this._showLoadingMessage('Fetching top-rated movies (pages 1–5)…');

        try {
            // Fetch all 5 pages concurrently for better performance
            const pages = [1, 2, 3, 4, 5];
            const requests = pages.map((page) =>
                fetch(`/api/top-rated/movie?page=${page}`)
                    .then((res) => {
                        if (!res.ok) throw new Error(`Page ${page} failed: ${res.status}`);
                        return res.json();
                    })
            );

            const results = await Promise.all(requests);

            // Flatten all pages into a single array and take the first 100
            const allMovies = results.flatMap((data) => data.results || []);
            const top100    = allMovies.slice(0, 100);

            this._hideLoading();
            this._render(top100);
        } catch (err) {
            console.error('Top100Page load error:', err);
            this._hideLoading();
            this._showError('Unable to load Top 100 movies. Please try again later.');
        }
    }

    // ------------------------------------------------------------------ //
    //  Rendering
    // ------------------------------------------------------------------ //

    /**
     * Creates ranked MovieCard instances and appends them to #moviesGrid.
     * @param {Object[]} movies
     */
    _render(movies) {
        if (!this._grid) return;
        this._grid.innerHTML = '';

        movies.forEach((movie, index) => {
            const card = new MovieCard(movie, 'movie', { rank: index + 1 });
            this._grid.appendChild(card.render());
        });
    }

    // ------------------------------------------------------------------ //
    //  UI helpers
    // ------------------------------------------------------------------ //

    _showLoadingMessage(msg) {
        if (this._loadingIndicator) {
            // Update the text inside the existing loading indicator
            const p = this._loadingIndicator.querySelector('p');
            if (p) p.textContent = msg;
            this._loadingIndicator.classList.remove('hidden');
        }
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
}

// ======================================================================
//  Bootstrap
// ======================================================================

document.addEventListener('DOMContentLoaded', () => {
    new Top100Page();
});
