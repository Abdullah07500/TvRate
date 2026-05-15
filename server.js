const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const DOMPurify = require('isomorphic-dompurify');
const db = require('./database');
const User = require('./models/User');
const Review = require('./models/Review');
const Watchlist = require('./models/Watchlist');
const Follow = require('./models/Follow');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "https:", "data:"],
            connectSrc: ["'self'", "https://api.themoviedb.org", "https://image.tmdb.org"],
            fontSrc: ["'self'", "data:"]
        }
    }
}));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    skipSuccessfulRequests: true,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Too many registration attempts. Please try again later.' }
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'tvrate-local-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['http://localhost:3002']
        : ['http://localhost:3002', 'http://localhost:3000'],
    credentials: true
}));

app.use(express.json());

function sanitize(input) {
    if (typeof input !== 'string') return input;
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

function requireUser(req, res, next) {
    if (req.session && req.session.userId) return next();
    if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(401).json({ error: 'Login required' });
    }
    res.redirect('/login');
}

app.use('/api', apiLimiter);

// ── Auth ──────────────────────────────────────────────
app.post('/api/auth/register', registerLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password)
            return res.status(400).json({ error: 'All fields are required' });
        if (username.length < 3 || username.length > 20)
            return res.status(400).json({ error: 'Username must be 3-20 characters' });
        if (!/^[a-zA-Z0-9_]+$/.test(username))
            return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
        if (password.length < 6)
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        if (await User.findByEmail(email))
            return res.status(409).json({ error: 'Email already in use' });
        if (await User.findByUsername(username))
            return res.status(409).json({ error: 'Username already taken' });

        const hash = await bcrypt.hash(password, 10);
        const userId = await User.create(sanitize(username), sanitize(email.toLowerCase()), hash);

        req.session.userId = userId;
        req.session.username = sanitize(username);
        res.json({ success: true, user: { id: userId, username: sanitize(username) } });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ error: 'Email and password required' });

        const user = await User.findByEmail(email.toLowerCase());
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ success: true, user: { id: user.id, username: user.username } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ loggedIn: true, user: { id: req.session.userId, username: req.session.username } });
    } else {
        res.json({ loggedIn: false });
    }
});

// ── Reviews ───────────────────────────────────────────
app.get('/api/reviews', async (req, res) => {
    try {
        res.json({ success: true, reviews: await Review.getAll() });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

app.post('/api/reviews/submit', requireUser, async (req, res) => {
    try {
        const { movieId, type, title, poster, year, rating, reviewText } = req.body;
        if (!movieId || !type || !title || !rating || !reviewText)
            return res.status(400).json({ error: 'Missing required fields' });

        const ratingNum = parseFloat(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10)
            return res.status(400).json({ error: 'Rating must be 1-10' });
        if (reviewText.length < 10 || reviewText.length > 500)
            return res.status(400).json({ error: 'Review must be 10-500 characters' });

        const ipAddress = req.ip || req.connection.remoteAddress;

        const reviewId = await Review.add({
            userId: req.session.userId,
            movieId: parseInt(movieId),
            type: type === 'movie' ? 'movie' : 'tv',
            title: sanitize(title),
            poster: poster || null,
            year: year || 'N/A',
            rating: ratingNum,
            reviewText: sanitize(reviewText),
            ipAddress
        });

        res.json({ success: true, message: 'Review submitted successfully!', reviewId });
    } catch (err) {
        console.error('Submit review error:', err);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

app.get('/api/reviews/feed', async (req, res) => {
    try {
        const reviews = await Review.getAll();
        res.json({ success: true, reviews });
    } catch (err) {
        console.error('Get reviews feed error:', err);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

app.get('/api/reviews/feed/following', requireUser, async (req, res) => {
    try {
        const followingIds = await Follow.getFollowingIds(req.session.userId);
        const reviews = await Review.getFeedForFollowing(followingIds);
        res.json({ success: true, reviews });
    } catch (err) {
        console.error('Get following reviews feed error:', err);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// ── Watchlist ─────────────────────────────────────────
app.get('/api/watchlist', requireUser, async (req, res) => {
    try {
        res.json({ success: true, watchlist: await Watchlist.getByUser(req.session.userId) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
});

app.post('/api/watchlist', requireUser, async (req, res) => {
    try {
        const { movieId, type, title, poster, year } = req.body;
        if (!movieId || !type || !title) return res.status(400).json({ error: 'Missing required fields' });
        const added = await Watchlist.add(req.session.userId, {
            movieId: parseInt(movieId), type, title: sanitize(title),
            poster: poster || null, year: year || null
        });
        if (!added) return res.status(409).json({ error: 'Already in watchlist' });
        res.json({ success: true, message: 'Added to watchlist' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add to watchlist' });
    }
});

app.delete('/api/watchlist/:movieId', requireUser, async (req, res) => {
    try {
        const movieId = parseInt(req.params.movieId);
        const { type } = req.query;
        const ok = await Watchlist.remove(req.session.userId, movieId, type);
        ok ? res.json({ success: true }) : res.status(404).json({ error: 'Not in watchlist' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
});

app.get('/api/watchlist/check/:movieId', requireUser, async (req, res) => {
    try {
        const movieId = parseInt(req.params.movieId);
        const { type } = req.query;
        res.json({ inWatchlist: await Watchlist.isInList(req.session.userId, movieId, type) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check watchlist' });
    }
});

// ── Follow ────────────────────────────────────────────
app.post('/api/follow/:username', requireUser, async (req, res) => {
    try {
        const target = await User.findByUsername(req.params.username);
        if (!target) return res.status(404).json({ error: 'User not found' });
        if (target.id === req.session.userId) return res.status(400).json({ error: 'Cannot follow yourself' });
        const ok = await Follow.follow(req.session.userId, target.id);
        res.json({ success: true, followed: ok });
    } catch (err) {
        res.status(500).json({ error: 'Failed to follow user' });
    }
});

app.delete('/api/follow/:username', requireUser, async (req, res) => {
    try {
        const target = await User.findByUsername(req.params.username);
        if (!target) return res.status(404).json({ error: 'User not found' });
        await Follow.unfollow(req.session.userId, target.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to unfollow user' });
    }
});

// ── User profiles ─────────────────────────────────────
app.get('/api/users/search', async (req, res) => {
    try {
        const q = sanitize((req.query.q || '').trim()).slice(0, 50);
        if (!q) return res.json({ users: [] });
        const users = await User.search(q);
        const results = await Promise.all(users.map(async u => {
            const followers = await Follow.getFollowers(u.id);
            const isFollowing = req.session.userId
                ? await Follow.isFollowing(req.session.userId, u.id)
                : false;
            return {
                username: u.username,
                bio: u.bio,
                followerCount: followers.length,
                isFollowing,
                isOwnProfile: req.session.userId === u.id
            };
        }));
        res.json({ users: results });
    } catch (err) {
        console.error('User search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/api/users/:username', async (req, res) => {
    try {
        const user = await User.findByUsername(req.params.username);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const [reviews, watchlist, followers, following] = await Promise.all([
            Review.getByUser(user.id),
            Watchlist.getByUser(user.id),
            Follow.getFollowers(user.id),
            Follow.getFollowing(user.id)
        ]);

        const isFollowingUser = req.session.userId
            ? await Follow.isFollowing(req.session.userId, user.id)
            : false;

        res.json({
            success: true,
            user: { id: user.id, username: user.username, bio: user.bio, created_at: user.created_at },
            reviews,
            watchlist,
            followers,
            following,
            followerCount: followers.length,
            followingCount: following.length,
            isFollowing: isFollowingUser,
            isOwnProfile: req.session.userId === user.id
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.post('/api/users/bio', requireUser, async (req, res) => {
    try {
        const bio = sanitize(req.body.bio || '').slice(0, 200);
        await User.updateBio(req.session.userId, bio);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update bio' });
    }
});

// ── TMDb proxy ────────────────────────────────────────
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY || !TMDB_ACCESS_TOKEN) {
    console.error('ERROR: TMDb API credentials missing in .env file');
    process.exit(1);
}

async function fetchTMDB(url) {
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`, 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`TMDb API error: ${response.status}`);
    return response.json();
}

app.get('/api/search/movie', async (req, res) => {
    try {
        const data = await fetchTMDB(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(req.query.query || '')}`);
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Search failed' }); }
});

app.get('/api/search/tv', async (req, res) => {
    try {
        const data = await fetchTMDB(`${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(req.query.query || '')}`);
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Search failed' }); }
});

app.get('/api/search/multi', async (req, res) => {
    try {
        const data = await fetchTMDB(`${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(req.query.query || '')}`);
        data.results = (data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv');
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Search failed' }); }
});

app.get('/api/movie/:id', async (req, res) => {
    try {
        const data = await fetchTMDB(`${TMDB_BASE_URL}/movie/${req.params.id}?api_key=${TMDB_API_KEY}`);
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Fetch failed' }); }
});

app.get('/api/tv/:id', async (req, res) => {
    try {
        const data = await fetchTMDB(`${TMDB_BASE_URL}/tv/${req.params.id}?api_key=${TMDB_API_KEY}`);
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Fetch failed' }); }
});

app.get('/api/trending/:type/:timeWindow', async (req, res) => {
    try {
        const data = await fetchTMDB(`${TMDB_BASE_URL}/trending/${req.params.type}/${req.params.timeWindow}?api_key=${TMDB_API_KEY}`);
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Fetch failed' }); }
});

app.get('/api/top-rated/:type', async (req, res) => {
    try {
        const data = await fetchTMDB(`${TMDB_BASE_URL}/${req.params.type}/top_rated?api_key=${TMDB_API_KEY}&page=${req.query.page || 1}`);
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Fetch failed' }); }
});

app.get('/api/upcoming/movie', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const future = new Date(); future.setMonth(future.getMonth() + 6);
        const data = await fetchTMDB(`${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&primary_release_date.gte=${today}&primary_release_date.lte=${future.toISOString().split('T')[0]}&sort_by=popularity.desc&with_release_type=2|3`);
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Fetch failed' }); }
});

app.get('/api/popular/:type', async (req, res) => {
    try {
        const data = await fetchTMDB(`${TMDB_BASE_URL}/${req.params.type}/popular?api_key=${TMDB_API_KEY}&page=1`);
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Fetch failed' }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', port }));

// ── Page routes ───────────────────────────────────────
app.get('/list', (req, res) => res.sendFile(path.join(__dirname, 'public', 'list.html'))); // Review Space page
app.get('/top10', (req, res) => res.sendFile(path.join(__dirname, 'public', 'top10.html'))); // Weekly trending movies
app.get('/top100', (req, res) => res.redirect('/top10')); // All-time popular movies
app.get('/upcoming', (req, res) => res.sendFile(path.join(__dirname, 'public', 'upcoming.html')));
app.get('/browse', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/watchlist', (req, res) => res.sendFile(path.join(__dirname, 'public', 'watchlist.html')));
app.get('/feed', (req, res) => res.redirect('/list')); // Redirect legacy feed route to Review Space
app.get('/profile/:username', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));

app.get('/', (req, res) => res.redirect('/list')); // Default home route

app.get('/favicon.ico', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎬</text></svg>`);
});

app.use((req, res, next) => {
    if (req.url.endsWith('.js') || req.url.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ── Start ─────────────────────────────────────────────
db.connect()
    .then(() => {
        app.listen(port, () => {
            console.log(`\n=================================`);
            console.log(`TvRate Server Started!`);
            console.log(`=================================`);
            console.log(`Local:       http://localhost:${port}`);
            console.log(`=================================\n`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    });
