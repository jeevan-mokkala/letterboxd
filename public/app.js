let movies = [];
let ratings = {};
let selectedMovieId = null;

const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const searchInput = document.getElementById('search');
const movieList = document.getElementById('movie-list');
const ratingsList = document.getElementById('ratings-list');
const modal = document.getElementById('rating-modal');
const modalTitle = document.getElementById('modal-title');
const closeModalBtn = document.getElementById('close-modal');
const stars = document.querySelectorAll('.star');

async function init() {
  try {
    const meRes = await fetch('/api/me');
    const user = await meRes.json();

    if (!user) {
      loginScreen.classList.remove('hidden');
      return;
    }

    // Show user info
    document.getElementById('user-name').textContent = user.name;
    const avatar = document.getElementById('user-avatar');
    if (user.picture) {
      avatar.src = user.picture;
    } else {
      avatar.style.display = 'none';
    }

    appContainer.classList.remove('hidden');

    const [moviesRes, ratingsRes] = await Promise.all([
      fetch('/api/movies'),
      fetch('/api/ratings')
    ]);
    movies = await moviesRes.json();
    ratings = await ratingsRes.json();
    renderMovies();
    renderRatings();
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

function renderMovies(filter = '') {
  const filtered = movies.filter(m =>
    m.title.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    movieList.innerHTML = '<li class="no-results">No movies found</li>';
    return;
  }

  movieList.innerHTML = filtered.map(movie => {
    const rating = ratings[movie.id];
    const ratingDisplay = rating ? `<span class="movie-rating">${'★'.repeat(rating)}</span>` : '';
    return `
      <li data-id="${movie.id}">
        <span class="movie-title">${movie.title}</span>
        <span class="movie-year">(${movie.year})</span>
        ${ratingDisplay}
      </li>
    `;
  }).join('');
}

function renderRatings() {
  const ratedMovies = movies.filter(m => ratings[m.id]);

  if (ratedMovies.length === 0) {
    ratingsList.innerHTML = '<li class="no-results">No ratings yet</li>';
    return;
  }

  ratingsList.innerHTML = ratedMovies.map(movie => `
    <li class="rated-item">
      <span>
        <span class="movie-title">${movie.title}</span>
        <span class="movie-year">(${movie.year})</span>
        <span class="movie-rating">${'★'.repeat(ratings[movie.id])}</span>
      </span>
      <button class="delete-btn" data-id="${movie.id}">remove</button>
    </li>
  `).join('');
}

function openModal(movieId) {
  const movie = movies.find(m => m.id === movieId);
  if (!movie) return;

  selectedMovieId = movieId;
  modalTitle.textContent = movie.title;
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  selectedMovieId = null;
}

async function saveRating(movieId, rating) {
  try {
    await fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId, rating })
    });
    ratings[movieId] = rating;
    renderMovies(searchInput.value);
    renderRatings();
    closeModal();
  } catch (err) {
    console.error('Error saving rating:', err);
  }
}

async function deleteRating(movieId) {
  try {
    await fetch(`/api/ratings/${movieId}`, { method: 'DELETE' });
    delete ratings[movieId];
    renderMovies(searchInput.value);
    renderRatings();
  } catch (err) {
    console.error('Error deleting rating:', err);
  }
}

// Event listeners
searchInput.addEventListener('input', (e) => {
  renderMovies(e.target.value);
});

movieList.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (li && li.dataset.id) {
    openModal(parseInt(li.dataset.id));
  }
});

ratingsList.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const movieId = parseInt(e.target.dataset.id);
    deleteRating(movieId);
  }
});

stars.forEach(star => {
  star.addEventListener('click', () => {
    const rating = parseInt(star.dataset.rating);
    if (selectedMovieId) {
      saveRating(selectedMovieId, rating);
    }
  });
});

closeModalBtn.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

// Initialize
init();
