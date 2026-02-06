require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('./auth');
const db = require('./db');

const TMDB_API_KEY = process.env.TMDB_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json());

const dataDir = process.env.DATA_DIR || __dirname;
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: dataDir }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));

// Auth middleware
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// Auth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/')
);

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// Current user
app.get('/api/me', (req, res) => {
  if (!req.isAuthenticated()) return res.json(null);
  const { name, email, picture } = req.user;
  res.json({ name, email, picture });
});

// Search movies via TMDB (public)
app.get('/api/movies/search', async (req, res) => {
  const query = req.query.q;
  if (!query || query.length < 2) return res.json([]);

  try {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`;
    const tmdbRes = await fetch(url);
    const data = await tmdbRes.json();
    const results = (data.results || []).map(m => ({
      id: m.id,
      title: m.title,
      year: m.release_date ? parseInt(m.release_date.substring(0, 4)) : null,
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : null,
    }));
    res.json(results);
  } catch (err) {
    console.error('TMDB search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Community feed — all ratings (public)
app.get('/api/ratings/feed', (req, res) => {
  res.json(db.getAllRatings());
});

// Get ratings for current user
app.get('/api/ratings', ensureAuth, (req, res) => {
  const ratings = db.getRatingsForUser(req.user.id);
  res.json(ratings);
});

// Save a rating
app.post('/api/ratings', ensureAuth, (req, res) => {
  const { movieId, rating, movieTitle, movieYear } = req.body;

  if (!movieId || !rating || rating < 0.5 || rating > 5 || (rating * 2) % 1 !== 0) {
    return res.status(400).json({ error: 'Invalid movieId or rating (0.5-5 in 0.5 increments)' });
  }

  db.setRating(req.user.id, movieId, rating, movieTitle || '', movieYear);
  res.json({ success: true, movieId, rating });
});

// Delete a rating
app.delete('/api/ratings/:movieId', ensureAuth, (req, res) => {
  const movieId = parseInt(req.params.movieId);
  const deleted = db.deleteRating(req.user.id, movieId);

  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Rating not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
