let movies = [];
let ratings = {};
let feedData = [];
let selectedMovieId = null;
let hoverRating = 0;

const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const searchInput = document.getElementById('search');
const searchResults = document.getElementById('search-results');
const ratingsList = document.getElementById('ratings-list');
const feedList = document.getElementById('feed-list');
const modal = document.getElementById('rating-modal');
const modalTitle = document.getElementById('modal-title');
const closeModalBtn = document.getElementById('close-modal');
const starRatingContainer = document.getElementById('star-rating');

// SVG star path
const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
let clipIdCounter = 0;

function starSVG(fillType) {
  // fillType: 'full', 'half', 'empty'
  const gold = '#e6b800';
  const grey = '#ccc';

  if (fillType === 'full') {
    return `<svg viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="${gold}" stroke="${gold}" stroke-width="1"/></svg>`;
  }
  if (fillType === 'half') {
    const clipId = 'half-clip-' + (clipIdCounter++);
    return `<svg viewBox="0 0 24 24">
      <defs><clipPath id="${clipId}"><rect x="0" y="0" width="12" height="24"/></clipPath></defs>
      <path d="${STAR_PATH}" fill="${grey}" stroke="${grey}" stroke-width="1"/>
      <path d="${STAR_PATH}" fill="${gold}" stroke="${gold}" stroke-width="1" clip-path="url(#${clipId})"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="${grey}" stroke="${grey}" stroke-width="1"/></svg>`;
}

function renderStarsHTML(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      html += starSVG('full');
    } else if (rating >= i - 0.5) {
      html += starSVG('half');
    } else {
      html += starSVG('empty');
    }
  }
  return `<span class="stars-display">${html}</span>`;
}

// Build interactive star rating in the modal
function buildStarRating(container) {
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const wrapper = document.createElement('span');
    wrapper.className = 'star-wrapper';
    wrapper.innerHTML = starSVG('empty');

    const leftZone = document.createElement('span');
    leftZone.className = 'star-half-zone left';
    leftZone.dataset.value = String(i - 0.5);

    const rightZone = document.createElement('span');
    rightZone.className = 'star-half-zone right';
    rightZone.dataset.value = String(i);

    wrapper.appendChild(leftZone);
    wrapper.appendChild(rightZone);
    container.appendChild(wrapper);
  }
}

function updateStarDisplay(container, rating) {
  const wrappers = container.querySelectorAll('.star-wrapper');
  wrappers.forEach((wrapper, idx) => {
    const i = idx + 1;
    let type;
    if (rating >= i) {
      type = 'full';
    } else if (rating >= i - 0.5) {
      type = 'half';
    } else {
      type = 'empty';
    }
    // Replace SVG but keep the hover zones
    const svg = wrapper.querySelector('svg');
    const temp = document.createElement('span');
    temp.innerHTML = starSVG(type);
    wrapper.replaceChild(temp.firstElementChild, svg);
  });
}

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

    const [moviesRes, ratingsRes, feedRes] = await Promise.all([
      fetch('/api/movies'),
      fetch('/api/ratings'),
      fetch('/api/ratings/feed')
    ]);
    movies = await moviesRes.json();
    ratings = await ratingsRes.json();
    feedData = await feedRes.json();
    renderRatings();
    renderFeed();

    // Build interactive stars in the modal
    buildStarRating(starRatingContainer);
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

function showSearchResults(query) {
  const filtered = movies.filter(m =>
    m.title.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) {
    searchResults.innerHTML = '<li class="no-results">No movies found</li>';
  } else {
    searchResults.innerHTML = filtered.map(movie => {
      const rating = ratings[movie.id];
      const ratingDisplay = rating ? renderStarsHTML(rating) : '';
      return `
        <li data-id="${movie.id}">
          <span class="movie-title">${movie.title}</span>
          <span class="movie-year">(${movie.year})</span>
          ${ratingDisplay}
        </li>
      `;
    }).join('');
  }

  searchResults.classList.remove('hidden');
}

function hideSearchResults() {
  searchResults.classList.add('hidden');
  searchResults.innerHTML = '';
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
        ${renderStarsHTML(ratings[movie.id])}
      </span>
      <button class="delete-btn" data-id="${movie.id}">remove</button>
    </li>
  `).join('');
}

function renderFeed() {
  if (feedData.length === 0) {
    feedList.innerHTML = '<li class="no-results">No ratings yet</li>';
    return;
  }

  feedList.innerHTML = feedData.map(item => {
    const movie = movies.find(m => m.id === item.movie_id);
    const movieLabel = movie ? `${movie.title} (${movie.year})` : `Movie #${item.movie_id}`;
    const avatarHTML = item.user_picture
      ? `<img class="feed-avatar" src="${item.user_picture}" alt="">`
      : '';
    return `
      <li class="feed-item">
        ${avatarHTML}
        <span class="feed-user">${item.user_name || 'Anonymous'}</span>
        <span class="feed-movie">${movieLabel}</span>
        <span class="feed-stars">${renderStarsHTML(item.rating)}</span>
      </li>
    `;
  }).join('');
}

function openModal(movieId) {
  const movie = movies.find(m => m.id === movieId);
  if (!movie) return;

  hideSearchResults();
  selectedMovieId = movieId;
  modalTitle.textContent = movie.title;

  // Show existing rating if any
  const existing = ratings[movieId] || 0;
  hoverRating = existing;
  updateStarDisplay(starRatingContainer, existing);

  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  selectedMovieId = null;
  hoverRating = 0;
}

async function saveRating(movieId, rating) {
  try {
    await fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId, rating })
    });
    ratings[movieId] = rating;
    searchInput.value = '';
    hideSearchResults();

    // Re-fetch feed
    const feedRes = await fetch('/api/ratings/feed');
    feedData = await feedRes.json();

    renderRatings();
    renderFeed();
    closeModal();
  } catch (err) {
    console.error('Error saving rating:', err);
  }
}

async function deleteRating(movieId) {
  try {
    await fetch(`/api/ratings/${movieId}`, { method: 'DELETE' });
    delete ratings[movieId];

    // Re-fetch feed
    const feedRes = await fetch('/api/ratings/feed');
    feedData = await feedRes.json();

    renderRatings();
    renderFeed();
  } catch (err) {
    console.error('Error deleting rating:', err);
  }
}

// Event listeners
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  if (query.length >= 2) {
    showSearchResults(query);
  } else {
    hideSearchResults();
  }
});

searchResults.addEventListener('click', (e) => {
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

// Star hover & click in the modal
starRatingContainer.addEventListener('mouseover', (e) => {
  const zone = e.target.closest('.star-half-zone');
  if (!zone) return;
  hoverRating = parseFloat(zone.dataset.value);
  updateStarDisplay(starRatingContainer, hoverRating);
});

starRatingContainer.addEventListener('mouseleave', () => {
  const existing = selectedMovieId ? (ratings[selectedMovieId] || 0) : 0;
  hoverRating = existing;
  updateStarDisplay(starRatingContainer, existing);
});

starRatingContainer.addEventListener('click', (e) => {
  const zone = e.target.closest('.star-half-zone');
  if (!zone || !selectedMovieId) return;
  const rating = parseFloat(zone.dataset.value);
  saveRating(selectedMovieId, rating);
});

closeModalBtn.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

// Click outside search results to close dropdown
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrapper')) {
    hideSearchResults();
  }
});

// Initialize
init();
