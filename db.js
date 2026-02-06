const Database = require('better-sqlite3');
const path = require('path');

const dataDir = process.env.DATA_DIR || __dirname;
const db = new Database(path.join(dataDir, 'letterboxd.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT,
    picture TEXT
  );
  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    movie_id INTEGER NOT NULL,
    rating REAL NOT NULL CHECK(rating >= 0.5 AND rating <= 5),
    movie_title TEXT NOT NULL DEFAULT '',
    movie_year INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, movie_id)
  );
`);

// Migrate: add movie_title/movie_year columns if missing
const colInfo = db.prepare("PRAGMA table_info(ratings)").all();
const hasTitle = colInfo.some(c => c.name === 'movie_title');
if (!hasTitle) {
  db.exec(`ALTER TABLE ratings ADD COLUMN movie_title TEXT NOT NULL DEFAULT ''`);
  db.exec(`ALTER TABLE ratings ADD COLUMN movie_year INTEGER`);
}

// Migrate ratings column from INTEGER to REAL if needed
const ratingCol = colInfo.find(c => c.name === 'rating');
if (ratingCol && ratingCol.type !== 'REAL') {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    ALTER TABLE ratings RENAME TO ratings_old;
    CREATE TABLE ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      movie_id INTEGER NOT NULL,
      rating REAL NOT NULL CHECK(rating >= 0.5 AND rating <= 5),
      movie_title TEXT NOT NULL DEFAULT '',
      movie_year INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, movie_id)
    );
    INSERT INTO ratings (id, user_id, movie_id, rating, movie_title, movie_year) SELECT id, user_id, movie_id, CAST(rating AS REAL), COALESCE(movie_title, ''), movie_year FROM ratings_old;
    DROP TABLE ratings_old;
  `);
  db.pragma('foreign_keys = ON');
}

// Prepared statements
const findUserByGoogleId = db.prepare('SELECT * FROM users WHERE google_id = ?');
const insertUser = db.prepare('INSERT INTO users (google_id, name, email, picture) VALUES (?, ?, ?, ?)');
const findUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const selectRatings = db.prepare('SELECT movie_id, rating, movie_title, movie_year FROM ratings WHERE user_id = ?');
const upsertRating = db.prepare(`
  INSERT INTO ratings (user_id, movie_id, rating, movie_title, movie_year) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id, movie_id) DO UPDATE SET rating = excluded.rating, movie_title = excluded.movie_title, movie_year = excluded.movie_year
`);
const removeRating = db.prepare('DELETE FROM ratings WHERE user_id = ? AND movie_id = ?');
const selectAllRatings = db.prepare('SELECT r.movie_id, r.rating, r.movie_title, r.movie_year, u.name AS user_name, u.picture AS user_picture FROM ratings r JOIN users u ON r.user_id = u.id ORDER BY r.id DESC');

function findOrCreateUser(profile) {
  const existing = findUserByGoogleId.get(profile.id);
  if (existing) return existing;

  const result = insertUser.run(profile.id, profile.displayName, profile.emails?.[0]?.value, profile.photos?.[0]?.value);
  return findUserById.get(result.lastInsertRowid);
}

function getUserById(id) {
  return findUserById.get(id);
}

function getRatingsForUser(userId) {
  return selectRatings.all(userId);
}

function setRating(userId, movieId, rating, movieTitle, movieYear) {
  upsertRating.run(userId, movieId, rating, movieTitle, movieYear || null);
}

function deleteRating(userId, movieId) {
  const result = removeRating.run(userId, movieId);
  return result.changes > 0;
}

function getAllRatings() {
  return selectAllRatings.all();
}

module.exports = { findOrCreateUser, getUserById, getRatingsForUser, setRating, deleteRating, getAllRatings };
