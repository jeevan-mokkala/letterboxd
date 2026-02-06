let userRatings = []; // [{movie_id, rating, movie_title, movie_year}]
let feedData = [];
let selectedMovie = null; // {id, title, year}
let hoverRating = 0;
let searchTimer = null;

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
    if (rating >= i) type = 'full';
    else if (rating >= i - 0.5) type = 'half';
    else type = 'empty';
    const svg = wrapper.querySelector('svg');
    const temp = document.createElement('span');
    temp.innerHTML = starSVG(type);
    wrapper.replaceChild(temp.firstElementChild, svg);
  });
}

function getRatingForMovie(movieId) {
  const r = userRatings.find(r => r.movie_id === movieId);
  return r ? r.rating : 0;
}

async function init() {
  try {
    const meRes = await fetch('/api/me');
    const user = await meRes.json();

    if (!user) {
      loginScreen.classList.remove('hidden');
      return;
    }

    document.getElementById('user-name').textContent = user.name;
    const avatar = document.getElementById('user-avatar');
    if (user.picture) {
      avatar.src = user.picture;
    } else {
      avatar.style.display = 'none';
    }

    appContainer.classList.remove('hidden');

    const [ratingsRes, feedRes] = await Promise.all([
      fetch('/api/ratings'),
      fetch('/api/ratings/feed')
    ]);
    userRatings = await ratingsRes.json();
    feedData = await feedRes.json();
    renderRatings();
    renderFeed();
    buildStarRating(starRatingContainer);
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

async function searchMovies(query) {
  if (query.length < 2) {
    hideSearchResults();
    return;
  }

  try {
    const res = await fetch(`/api/movies/search?q=${encodeURIComponent(query)}`);
    const results = await res.json();

    if (results.length === 0) {
      searchResults.innerHTML = '<li class="no-results">No movies found</li>';
    } else {
      searchResults.innerHTML = results.map(movie => {
        const rating = getRatingForMovie(movie.id);
        const ratingDisplay = rating ? renderStarsHTML(rating) : '';
        const yearDisplay = movie.year ? `(${movie.year})` : '';
        return `
          <li data-id="${movie.id}" data-title="${movie.title.replace(/"/g, '&quot;')}" data-year="${movie.year || ''}">
            <span class="movie-title">${movie.title}</span>
            <span class="movie-year">${yearDisplay}</span>
            ${ratingDisplay}
          </li>
        `;
      }).join('');
    }

    searchResults.classList.remove('hidden');
  } catch (err) {
    console.error('Search error:', err);
  }
}

function hideSearchResults() {
  searchResults.classList.add('hidden');
  searchResults.innerHTML = '';
}

function renderRatings() {
  if (userRatings.length === 0) {
    ratingsList.innerHTML = '<li class="no-results">No ratings yet</li>';
    return;
  }

  ratingsList.innerHTML = userRatings.map(r => {
    const yearDisplay = r.movie_year ? `(${r.movie_year})` : '';
    return `
      <li class="rated-item">
        <span>
          <span class="movie-title">${r.movie_title}</span>
          <span class="movie-year">${yearDisplay}</span>
          ${renderStarsHTML(r.rating)}
        </span>
        <button class="delete-btn" data-id="${r.movie_id}">remove</button>
      </li>
    `;
  }).join('');
}

function renderFeed() {
  if (feedData.length === 0) {
    feedList.innerHTML = '<li class="no-results">No ratings yet</li>';
    return;
  }

  feedList.innerHTML = feedData.map(item => {
    const yearDisplay = item.movie_year ? `(${item.movie_year})` : '';
    const movieLabel = `${item.movie_title || 'Unknown'} ${yearDisplay}`;
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

function openModal(movieId, title, year) {
  hideSearchResults();
  selectedMovie = { id: movieId, title, year };
  modalTitle.textContent = title;

  const existing = getRatingForMovie(movieId);
  hoverRating = existing;
  updateStarDisplay(starRatingContainer, existing);

  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  selectedMovie = null;
  hoverRating = 0;
}

async function saveRating(movieId, rating, movieTitle, movieYear) {
  try {
    await fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId, rating, movieTitle, movieYear })
    });

    // Update local ratings
    const existing = userRatings.find(r => r.movie_id === movieId);
    if (existing) {
      existing.rating = rating;
      existing.movie_title = movieTitle;
      existing.movie_year = movieYear;
    } else {
      userRatings.unshift({ movie_id: movieId, rating, movie_title: movieTitle, movie_year: movieYear });
    }

    searchInput.value = '';
    hideSearchResults();

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
    userRatings = userRatings.filter(r => r.movie_id !== movieId);

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
  clearTimeout(searchTimer);
  if (query.length >= 2) {
    searchTimer = setTimeout(() => searchMovies(query), 300);
  } else {
    hideSearchResults();
  }
});

searchResults.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (li && li.dataset.id) {
    const id = parseInt(li.dataset.id);
    const title = li.dataset.title;
    const year = li.dataset.year ? parseInt(li.dataset.year) : null;
    openModal(id, title, year);
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
  const existing = selectedMovie ? getRatingForMovie(selectedMovie.id) : 0;
  hoverRating = existing;
  updateStarDisplay(starRatingContainer, existing);
});

starRatingContainer.addEventListener('click', (e) => {
  const zone = e.target.closest('.star-half-zone');
  if (!zone || !selectedMovie) return;
  const rating = parseFloat(zone.dataset.value);
  saveRating(selectedMovie.id, rating, selectedMovie.title, selectedMovie.year);
});

closeModalBtn.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrapper')) hideSearchResults();
});

init();
