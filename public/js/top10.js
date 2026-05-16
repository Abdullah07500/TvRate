class TopMoviesPage {
    constructor() {
        this._grid    = document.getElementById('moviesGrid');
        this._loading = document.getElementById('loadingIndicator');
        this._error   = document.getElementById('errorMessage');
        this._title   = document.getElementById('pageTitle');
        this._desc    = document.getElementById('pageDesc');
        this._tabs    = document.querySelectorAll('.top-tab-btn');
        this._current = 'top10';

        this._tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.tab === this._current) return;
                this._tabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._current = btn.dataset.tab;
                this._load(this._current);
            });
        });

        this._load('top10');
    }

    async _load(tab) {
        this._showLoading();
        this._hideError();
        this._grid.innerHTML = '';

        try {
            if (tab === 'top10') {
                this._title.textContent = '🔥 Top 10 This Week';
                this._desc.textContent  = 'The most trending movies — click a poster to review';
                const data = await this._fetch('/api/trending/movie/week');
                this._render((data.results || []).slice(0, 10), 'movie', true);

            } else if (tab === 'top100') {
                this._title.textContent = '🏆 Top 100 Movies of All Time';
                this._desc.textContent  = 'The highest-rated movies — click a poster to review';
                const pages = await Promise.all(
                    [1,2,3,4,5].map(p => this._fetch(`/api/top-rated/movie?page=${p}`))
                );
                const movies = pages.flatMap(d => d.results || []).slice(0, 100);
                this._render(movies, 'movie', true);

            } else {
                this._title.textContent = '🎬 Popular Movies';
                this._desc.textContent  = 'What people are watching right now — click a poster to review';
                const pages = await Promise.all(
                    [1,2,3,4,5].map(p => this._fetch(`/api/top-rated/movie?page=${p}`))
                );
                const movies = pages.flatMap(d => d.results || []).slice(0, 200);
                this._render(movies, 'movie', false);
            }
        } catch (err) {
            console.error('TopMoviesPage load error:', err);
            this._showError('Unable to load movies. Please try again later.');
        } finally {
            this._hideLoading();
        }
    }

    async _fetch(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
    }

    _render(movies, type, ranked) {
        if (!this._grid) return;
        this._grid.innerHTML = '';
        movies.forEach((movie, i) => {
            const card = new MovieCard(movie, type, ranked ? { rank: i + 1 } : {});
            this._grid.appendChild(card.render());
        });
    }

    _showLoading() { this._loading && this._loading.classList.remove('hidden'); }
    _hideLoading() { this._loading && this._loading.classList.add('hidden'); }
    _hideError()   { this._error  && this._error.classList.add('hidden'); }
    _showError(msg) {
        if (this._error) { this._error.textContent = msg; this._error.classList.remove('hidden'); }
    }
}

document.addEventListener('DOMContentLoaded', () => { new TopMoviesPage(); });
