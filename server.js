require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('./auth');
const movies = require('./movies');
const db = require('./db');

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

// Get all movies (public)
app.get('/api/movies', (req, res) => {
  res.json(movies);
});

// Get ratings for current user
app.get('/api/ratings', ensureAuth, (req, res) => {
  const ratings = db.getRatingsForUser(req.user.id);
  res.json(ratings);
});

// Save a rating
app.post('/api/ratings', ensureAuth, (req, res) => {
  const { movieId, rating } = req.body;

  if (!movieId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Invalid movieId or rating (1-5)' });
  }

  db.setRating(req.user.id, movieId, rating);
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
