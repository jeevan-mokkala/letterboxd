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
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, movie_id)
  );
`);

// Migrate ratings column from INTEGER to REAL if needed
const colInfo = db.prepare("PRAGMA table_info(ratings)").all();
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
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, movie_id)
    );
    INSERT INTO ratings (id, user_id, movie_id, rating) SELECT id, user_id, movie_id, CAST(rating AS REAL) FROM ratings_old;
    DROP TABLE ratings_old;
  `);
  db.pragma('foreign_keys = ON');
}

// Prepared statements
const findUserByGoogleId = db.prepare('SELECT * FROM users WHERE google_id = ?');
const insertUser = db.prepare('INSERT INTO users (google_id, name, email, picture) VALUES (?, ?, ?, ?)');
const findUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const selectRatings = db.prepare('SELECT movie_id, rating FROM ratings WHERE user_id = ?');
const upsertRating = db.prepare(`
  INSERT INTO ratings (user_id, movie_id, rating) VALUES (?, ?, ?)
  ON CONFLICT(user_id, movie_id) DO UPDATE SET rating = excluded.rating
`);
const removeRating = db.prepare('DELETE FROM ratings WHERE user_id = ? AND movie_id = ?');
const selectAllRatings = db.prepare('SELECT r.movie_id, r.rating, u.name AS user_name, u.picture AS user_picture FROM ratings r JOIN users u ON r.user_id = u.id ORDER BY r.id DESC');

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
  const rows = selectRatings.all(userId);
  const map = {};
  for (const row of rows) {
    map[row.movie_id] = row.rating;
  }
  return map;
}

function setRating(userId, movieId, rating) {
  upsertRating.run(userId, movieId, rating);
}

function deleteRating(userId, movieId) {
  const result = removeRating.run(userId, movieId);
  return result.changes > 0;
}

function getAllRatings() {
  return selectAllRatings.all();
}

module.exports = { findOrCreateUser, getUserById, getRatingsForUser, setRating, deleteRating, getAllRatings };
