let currentActiveTab = 'planned';
  let currentActiveSection = 'library';
  let tinderBooks = [];
  let currentTinderIndex = 0;

  document.addEventListener('DOMContentLoaded', function () {
      loadUserBooks('planned');
      loadUserBooks('reading');
      loadUserBooks('read');
      loadProfileData();
      const savedIndex = localStorage.getItem('currentTinderIndex');
      if (savedIndex) {
          currentTinderIndex = parseInt(savedIndex);
      }
  });

  function previewProfileImage(event) {
      const reader = new FileReader();
      reader.onload = function () {
          const preview = document.getElementById('profileImagePreview');
          preview.src = reader.result;
      };
      reader.readAsDataURL(event.target.files[0]);
  }

  function cancelEdit() {
      navigateTo('library');
  }

  function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');
      const icon = document.querySelector('.toggle-btn i');
      if (sidebar.classList.contains('collapsed')) {
          icon.classList.remove('fa-chevron-left');
          icon.classList.add('fa-chevron-right');
      } else {
          icon.classList.remove('fa-chevron-right');
          icon.classList.add('fa-chevron-left');
      }
  }

  function logout() {
      window.location.href = '/logout';
  }

  function showStatusMessage(message, isError = false) {
      const statusMessage = document.getElementById('statusMessage');
      statusMessage.textContent = message;
      statusMessage.style.backgroundColor = isError ? '#f44336' : '#4CAF50';
      statusMessage.classList.add('show');
      setTimeout(() => {
          statusMessage.classList.remove('show');
      }, 3000);
  }

  function openTab(tabName) {
      if (currentActiveSection !== 'library') return;
      currentActiveTab = tabName;
      document.querySelectorAll('#library-content .tab-content').forEach(tab => {
          tab.classList.remove('active');
      });
      document.querySelectorAll('#library-content .tab-button').forEach(button => {
          button.classList.remove('active');
      });
      document.getElementById(tabName).classList.add('active');
      document.querySelector(`#library-content .tab-button[onclick="openTab('${tabName}')"]`).classList.add('active');
  }

  function navigateTo(section) {
      currentActiveSection = section;
      document.getElementById('currentPassword').value = '';
      document.getElementById('editPassword').value = '';
      document.querySelectorAll('.nav-item').forEach(item => {
          item.classList.remove('active');
      });
      document.querySelector(`.nav-item[onclick="navigateTo('${section}')"]`).classList.add('active');
      document.querySelectorAll('.content > .tab-content').forEach(content => {
          content.classList.remove('active');
      });
      document.getElementById(`${section}-content`).classList.add('active');
      switch (section) {
          case 'library':
              loadUserBooks('planned');
              loadUserBooks('reading');
              loadUserBooks('read');
              break;
          case 'favorites':
              loadFavorites();
              break;
          case 'tinder':
              if (!tinderBooks || tinderBooks.length === 0) {
                  loadTinderBooks();
              } else {
                  showCurrentTinderBook();
              }
              break;
          case 'edit_profile':
              loadProfileData();
              break;
      }
  }

  function loadProfileData() {
      fetch('/get_profile_data')
          .then(response => response.json())
          .then(data => {
              document.getElementById('editUsername').value = data.username || '';
              document.getElementById('editEmail').value = data.email || '';
              const avatar = document.querySelector('.avatar');
              if (data.profile_image) {
                  avatar.src = '/static/uploads/' + data.profile_image;
              }
          })
          .catch(error => {
              console.error('Error loading profile data:', error);
          });
  }

  function updateProfile(event) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const avatar = document.querySelector('.avatar');
      const fileInput = document.getElementById('editProfileImage');
      const currentAvatar = avatar.src;
      if (fileInput.files.length > 0) {
          const reader = new FileReader();
          reader.onload = function (e) {
              avatar.src = e.target.result;
          };
          reader.readAsDataURL(fileInput.files[0]);
      }
      fetch('/update_profile', {
          method: 'POST',
          body: formData
      })
          .then(response => response.json())
          .then(data => {
              if (data.success) {
                  showStatusMessage('Профиль успешно обновлен');
                  const username = formData.get('username');
                  if (username) {
                      document.querySelector('.username').textContent = username;
                  }
                  document.getElementById('currentPassword').value = '';
                  document.getElementById('editPassword').value = '';
                  if (fileInput.files.length === 0) {
                      avatar.src = currentAvatar;
                  }
              } else {
                  showStatusMessage(data.message || 'Ошибка при обновлении профиля', true);
                  avatar.src = currentAvatar;
              }
          })
          .catch(error => {
              console.error('Error:', error);
              showStatusMessage('Ошибка при обновлении профиля', true);
              avatar.src = currentAvatar;
          });
      return false;
  }

  function loadTinderBooks() {
      const savedIndex = localStorage.getItem('tinderCurrentIndex');
      currentTinderIndex = savedIndex ? parseInt(savedIndex) : 0;
      localStorage.removeItem('tinderBooks');
      localStorage.removeItem('tinderViewedBooks');
      fetch('/get_tinder_books')
          .then(response => response.json())
          .then(data => {
              tinderBooks = data;
              localStorage.setItem('tinderBooks', JSON.stringify(tinderBooks));
              if (currentTinderIndex >= tinderBooks.length) {
                  currentTinderIndex = 0;
              }
              showCurrentTinderBook();
          })
          .catch(error => {
              console.error('Error loading tinder books:', error);
              document.getElementById('currentBook').innerHTML =
                  '<div class="no-books">Ошибка загрузки книг</div>';
          });
  }

  function showCurrentTinderBook() {
      if (currentTinderIndex >= tinderBooks.length) {
          document.getElementById('currentBook').innerHTML =
              '<div class="no-books">Вы просмотрели все книги</div>';
          return;
      }
      const book = tinderBooks[currentTinderIndex];
      const bookCard = document.getElementById('currentBook');
      bookCard.innerHTML = `
          <img class="tinder-card-image"
              src="${book.image_filename ? '/static/uploads/' + book.image_filename : 'https://via.placeholder.com/300x400?text=No+Image'}"
              alt="${book.title}">
          <div class="tinder-card-content">
              <h4 class="favorites-book-title">Название книги: ${book.title}</h4>
              <p class="favorites-book-meta"><strong>Автор:</strong> ${book.author}</p>
              ${book.year ? `<p class="favorites-book-meta"><strong>Год:</strong> ${book.year}</p>` : ''}
              ${book.description ? `
              <p class="favorites-book-meta"><strong>Описание:</strong></p>
              <p class="favorites-book-description">${book.description}</p>` : ''}
          </div>
      `;
  }

  function likeBook() {
      if (currentTinderIndex >= tinderBooks.length) return;
      const bookId = tinderBooks[currentTinderIndex].id;
      fetch('/add_to_favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ book_id: bookId })
      })
          .then(response => response.json())
          .then(data => {
              if (data.success) {
                  updateTinderViewedList(bookId);
                  showStatusMessage('Книга добавлена в избранное');
              } else {
                  showStatusMessage(data.message || 'Ошибка', true);
              }
          });
  }

  function dislikeBook() {
      const bookId = tinderBooks[currentTinderIndex].id;
      updateTinderViewedList(bookId);
  }

  function updateTinderViewedList(bookId) {
      let viewedBooks = JSON.parse(localStorage.getItem('tinderViewedBooks') || '[]');
      if (!viewedBooks.includes(bookId)) {
          viewedBooks.push(bookId);
          localStorage.setItem('tinderViewedBooks', JSON.stringify(viewedBooks));
      }
      currentTinderIndex++;
      localStorage.setItem('tinderCurrentIndex', currentTinderIndex);
      if (currentTinderIndex >= tinderBooks.length) {
          document.getElementById('currentBook').innerHTML =
              '<div class="no-books">Вы просмотрели все книги</div>';
      } else {
          showCurrentTinderBook();
      }
  }

  function loadFavorites() {
      fetch('/get_favorites')
          .then(response => response.json())
          .then(data => {
              const container = document.getElementById('favoritesBooks');
              if (data.length === 0) {
                  container.innerHTML = '<div class="no-books">Избранные книги не найдены</div>';
              } else {
                  displayBooks(data, container);
              }
          })
          .catch(error => {
              console.error('Error loading favorites:', error);
          });
  }

  function displayBooks(books, container) {
      container.innerHTML = '';
      if (books.length === 0) {
          container.innerHTML = '<div class="no-books">Избранные книги не найдены</div>';
          return;
      }
      books.forEach(book => {
          const bookCard = document.createElement('div');
          bookCard.className = 'favorites-book-card';
          bookCard.setAttribute('data-book-id', book.id);
          bookCard.innerHTML = `
              <img class="favorites-book-image"
                  src="${book.image_filename ? '/static/uploads/' + book.image_filename : 'https://via.placeholder.com/120x160?text=No+Image'}"
                  alt="${book.title}">
              <div class="favorites-book-info">
                  <h3 class="favorites-book-title">${book.title}</h3>
                  <p class="favorites-book-meta"><strong>Автор:</strong> ${book.author}</p>
                  <p class="favorites-book-meta"><strong>Жанр:</strong> ${book.genre}</p>
                  ${book.year ? `<p class="favorites-book-meta"><strong>Год:</strong> ${book.year}</p>` : ''}
                  ${book.description ? `<p class="favorites-book-description"><strong>Описание: </strong>${book.description}</p>` : ''}
              </div>
              <div class="favorites-book-options" onclick="toggleFavoritesBookActions(event, ${book.id})">
                  <i class="fas fa-ellipsis-v"></i>
                  <div class="favorites-book-actions">
                      <button onclick="addToCategory(${book.id}, 'planned')"><i class="fas fa-bookmark"></i> Планирую</button>
                      <button onclick="removeFromFavorites(${book.id})"><i class="fas fa-trash"></i> Удалить</button>
                  </div>
              </div>
          `;
          container.appendChild(bookCard);
      });
  }

  function toggleFavoritesBookActions(event, bookId) {
      event.stopPropagation();
      const bookActions = event.currentTarget.querySelector('.favorites-book-actions');
      if (bookActions.style.display === 'block') {
          bookActions.style.display = 'none';
      } else {
          bookActions.style.display = 'block';
      }
      document.querySelectorAll('.favorites-book-actions').forEach(actions => {
          if (actions !== bookActions) {
              actions.style.display = 'none';
          }
      });
  }

  function removeFromFavorites(bookId) {
      fetch('/remove_from_favorites', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ book_id: bookId })
      })
          .then(response => response.json())
          .then(data => {
              if (data.success) {
                  showStatusMessage('Книга удалена из избранного');
                  loadFavorites();
              } else {
                  showStatusMessage(data.message || 'Ошибка', true);
              }
          })
          .catch(error => {
              console.error('Error:', error);
              showStatusMessage('Ошибка при удалении из избранного', true);
          });
  }

  function loadUserBooks(status) {
      fetch(`/get_user_books?status=${status}`)
          .then(response => response.json())
          .then(data => {
              const container = document.getElementById(`${status}Books`);
              if (data.length === 0) {
                  container.innerHTML = '<div class="no-books">Книги не найдены</div>';
              } else {
                  displayUserBooks(data, status);
              }
          })
          .catch(error => {
              console.error('Error:', error);
              document.getElementById(`${status}Books`).innerHTML = '<div class="no-books">Ошибка загрузки книг</div>';
          });
  }

  function displayUserBooks(books, status) {
      const container = document.getElementById(`${status}Books`);
      const bookListContainer = document.createElement('div');
      bookListContainer.className = 'book-list';
      books.forEach(book => {
          const bookCard = document.createElement('div');
          bookCard.className = 'book-card';
          bookCard.setAttribute('data-book-id', book.id);
          bookCard.innerHTML = `
              <div class="book-image-container">
                  <img class="book-image" src="${book.image_filename ? '/static/uploads/' + book.image_filename : 'https://via.placeholder.com/180x240?text=No+Image'}" alt="${book.title}">
                  <div class="book-actions" onclick="toggleBookActions(event, ${book.id}, '${status}')">
                      <i class="fas fa-ellipsis-v"></i>
                      ${getActionsMenu(book.id, status)}
                  </div>
              </div>
              <div class="book-info">
                  <h3 class="book-title">${book.title}</h3>
                  <p class="book-author">${book.author}</p>
              </div>
          `;
          bookListContainer.appendChild(bookCard);
      });
      container.innerHTML = '';
      container.appendChild(bookListContainer);
  }

  function getActionsMenu(bookId, currentStatus) {
      let menuItems = '';
      if (currentStatus === 'planned') {
          menuItems = `
              <button onclick="moveBookToCategory(${bookId}, 'reading')">Читаю</button>
              <button onclick="moveBookToCategory(${bookId}, 'read')">Прочитано</button>
          `;
      } else if (currentStatus === 'reading') {
          menuItems = `
              <button onclick="moveBookToCategory(${bookId}, 'planned')">Планирую</button>
              <button onclick="moveBookToCategory(${bookId}, 'read')">Прочитано</button>
          `;
      } else if (currentStatus === 'read') {
          menuItems = `
              <button onclick="moveBookToCategory(${bookId}, 'planned')">Планирую</button>
              <button onclick="moveBookToCategory(${bookId}, 'reading')">Читаю</button>
          `;
      }
      return `
          <div class="book-actions-menu">
              ${menuItems}
          </div>
      `;
  }

  function displaySearchResults(books) {
      const resultsContainer = document.getElementById('searchResults');
      const bookListContainer = document.createElement('div');
      bookListContainer.className = 'book-list';
      books.forEach(book => {
          const bookCard = document.createElement('div');
          bookCard.className = 'book-card';
          bookCard.setAttribute('data-book-id', book.id);
          bookCard.innerHTML = `
              <div class="book-image-container">
                  <img class="book-image" src="${book.image_filename ? '/static/uploads/' + book.image_filename : 'https://via.placeholder.com/180x240?text=No+Image'}" alt="${book.title}">
                  <div class="book-actions" onclick="toggleBookActions(event, ${book.id}, 'search')">
                      <i class="fas fa-ellipsis-v"></i>
                      <div class="book-actions-menu">
                          <button onclick="addToCategory(${book.id}, 'planned')">Планирую</button>
                          <button onclick="addToCategory(${book.id}, 'reading')">Читаю</button>
                          <button onclick="addToCategory(${book.id}, 'read')">Прочитано</button>
                      </div>
                  </div>
              </div>
              <div class="book-info">
                  <h3 class="book-title">${book.title}</h3>
                  <p class="book-author">${book.author}</p>
              </div>
          `;
          bookListContainer.appendChild(bookCard);
      });
      resultsContainer.innerHTML = '';
      resultsContainer.appendChild(bookListContainer);
  }

  function toggleBookActions(event, bookId, context) {
      event.stopPropagation();
      const bookActions = event.currentTarget.querySelector('.book-actions-menu');
      if (bookActions.style.display === 'block') {
          bookActions.style.display = 'none';
      } else {
          bookActions.style.display = 'block';
          if (context !== 'search') {
              const menu = bookActions;
              menu.innerHTML = getActionsMenu(bookId, context).replace('<div class="book-actions-menu">', '').replace('</div>', '');
          }
      }
      document.querySelectorAll('.book-actions-menu').forEach(actions => {
          if (actions !== bookActions) {
              actions.style.display = 'none';
          }
      });
  }

  function addToCategory(bookId, category) {
      document.querySelectorAll('.favorites-book-actions').forEach(menu => {
          menu.style.display = 'none';
      });
      const bookCard = document.querySelector(`.favorites-book-card[data-book-id="${bookId}"]`) ||
          document.querySelector(`.book-card[data-book-id="${bookId}"]`);
      if (!bookCard) return;

      fetch('/add_to_category', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ book_id: bookId, category: category })
      })
          .then(response => {
              if (!response.ok) throw new Error('Network response was not ok');
              return response.json();
          })
          .then(data => {
              if (data.success) {
                  return fetch('/remove_from_favorites', {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ book_id: bookId })
                  });
              } else {
                  throw new Error(data.message || 'Не удалось добавить книгу');
              }
          })
          .then(response => {
              if (!response.ok) throw new Error('Network response was not ok');
              return response.json();
          })
          .then(data => {
              if (data.success) {
                  showStatusMessage(`Книга добавлена в "${getCategoryName(category)}"`);
                  const favoritesCard = document.querySelector(`.favorites-book-card[data-book-id="${bookId}"]`);
                  if (favoritesCard) {
                      favoritesCard.remove();
                  }
                  if (document.getElementById('favoritesBooks').children.length === 0) {
                      document.getElementById('favoritesBooks').innerHTML = '<div class="no-books">Избранные книги не найдены</div>';
                  }
                  loadUserBooks(category);
              } else {
                  throw new Error(data.message || 'Не удалось удалить из избранного');
              }
          })
          .catch(error => {
              console.error('Error:', error);
              showStatusMessage(error.message || 'Ошибка при добавлении книги', true);
          });
  }

  function getCategoryName(category) {
      const names = {
          'planned': 'Планирую',
          'reading': 'Читаю',
          'read': 'Прочитано'
      };
      return names[category] || category;
  }

  document.getElementById('bookSearch').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
          const searchTerm = this.value.trim();
          if (!searchTerm) {
              document.getElementById('searchResults').innerHTML = '';
          } else {
              searchBooks(event);
          }
      }
  });

  document.getElementById('bookSearch').addEventListener('input', function () {
      if (this.value.trim() === '') {
          document.getElementById('searchResults').innerHTML = '';
      }
  });

  function searchBooks(event) {
      event.preventDefault();
      const searchTerm = document.getElementById('bookSearch').value.trim();
      if (!searchTerm) {
          document.getElementById('searchResults').innerHTML = '';
          return;
      }
      fetch('/search_books', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ search_term: searchTerm })
      })
          .then(response => response.json())
          .then(data => {
              if (data.length === 0) {
                  document.getElementById('searchResults').innerHTML = '<div class="no-books">Книги не найдены</div>';
              } else {
                  displaySearchResults(data);
              }
          })
          .catch(error => {
              console.error('Error:', error);
              showStatusMessage('Ошибка при поиске книг', true);
          });
  }

  function moveBookToCategory(bookId, newCategory) {
      document.querySelectorAll('.book-actions-menu').forEach(menu => {
          menu.style.display = 'none';
      });
      const bookCard = document.querySelector(`.book-card[data-book-id="${bookId}"]`);
      if (!bookCard) return;
      const bookClone = bookCard.cloneNode(true);
      fetch('/move_to_category', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ book_id: bookId, new_category: newCategory })
      })
          .then(response => {
              if (!response.ok) throw new Error('Network response was not ok');
              return response.json();
          })
          .then(data => {
              if (data.success) {
                  bookCard.remove();
                  const newCategoryContainer = document.getElementById(`${newCategory}Books`);
                  const noBooksMessage = newCategoryContainer.querySelector('.no-books');
                  if (noBooksMessage) {
                      newCategoryContainer.innerHTML = '';
                      newCategoryContainer.appendChild(bookClone);
                  } else {
                      const lastBook = newCategoryContainer.querySelector('.book-card:last-child');
                      if (lastBook) {
                          lastBook.parentNode.insertBefore(bookClone, lastBook.nextSibling);
                      } else {
                          newCategoryContainer.appendChild(bookClone);
                      }
                  }
                  showStatusMessage(`Книга перемещена в "${getCategoryName(newCategory)}"`);
                  updateBookActions(bookClone, bookId, newCategory);
                  const oldCategory = findBookCategory(bookId);
                  if (oldCategory && document.getElementById(`${oldCategory}Books`).children.length === 0) {
                      document.getElementById(`${oldCategory}Books`).innerHTML = '<div class="no-books">Книги не найдены</div>';
                  }
              } else {
                  showStatusMessage('Не удалось переместить книгу', true);
              }
          })
          .catch(error => {
              console.error('Error:', error);
              showStatusMessage('Ошибка при перемещении книги', true);
          });
  }

  function findBookCategory(bookId) {
      const categories = ['planned', 'reading', 'read'];
      for (const category of categories) {
          const container = document.getElementById(`${category}Books`);
          if (container.querySelector(`.book-card[data-book-id="${bookId}"]`)) {
              return category;
          }
      }
      return null;
  }

  function updateBookActions(bookCard, bookId, category) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'book-actions';
      actionsDiv.innerHTML = `
          <i class="fas fa-ellipsis-v"></i>
          ${getActionsMenu(bookId, category)}
      `;
      actionsDiv.onclick = function (e) { toggleBookActions(e, bookId, category); };
      const imageContainer = bookCard.querySelector('.book-image-container');
      if (imageContainer) {
          imageContainer.appendChild(actionsDiv);
      }
  }

  function getDurationUnitText(value, unit) {
      const num = parseInt(value);
      if (unit === 'days') {
          return num === 1 ? 'день' : num < 5 ? 'дня' : 'дней';
      } else if (unit === 'months') {
          return num === 1 ? 'месяц' : num < 5 ? 'месяца' : 'месяцев';
      } else {
          return num === 1 ? 'год' : num < 5 ? 'года' : 'лет';
      }
  }

  function showProgressModal(marathonId) {
      document.getElementById('progressMarathonId').value = marathonId;
      document.getElementById('progressCount').value = '';
      document.getElementById('progressNotes').value = '';

      fetch(`/get_marathon_progress_info?marathon_id=${marathonId}`)
          .then(response => {
              if (!response.ok) {
                  throw new Error('Network response was not ok');
              }
              return response.json();
          })
          .then(data => {
              if (data.success) {
                  document.getElementById('marathonTotalBooks').textContent = data.book_count;
                  const progressInput = document.getElementById('progressCount');
                  progressInput.value = data.progress || 0;
                  progressInput.max = data.book_count;

                  if (data.notes) {
                      document.getElementById('progressNotes').value = data.notes;
                  }
              } else {
                  showStatusMessage(data.message || 'Ошибка загрузки данных марафона', true);
              }
          })
          .catch(error => {
              console.error('Error:', error);
              showStatusMessage('Ошибка загрузки данных марафона', true);
          });

      document.getElementById('progressModal').style.display = 'flex';
  }

  function hideProgressModal() {
      document.getElementById('progressModal').style.display = 'none';
  }

  function saveProgress() {
      const marathonId = document.getElementById('progressMarathonId').value;
      const progressCount = parseInt(document.getElementById('progressCount').value);
      const totalBooks = parseInt(document.getElementById('marathonTotalBooks').textContent);
      const notes = document.getElementById('progressNotes').value.trim();

      if (isNaN(progressCount) || progressCount < 0) {
          showStatusMessage('Введите корректное количество книг', true);
          return;
      }

      if (progressCount > totalBooks) {
          showStatusMessage('Количество прочитанных книг не может превышать общее количество книг в марафоне', true);
          return;
      }

      fetch('/update_marathon_progress', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              marathon_id: marathonId,
              progress_count: progressCount,
              notes: notes
          })
      })
      .then(response => {
          if (!response.ok) {
              throw new Error('Network response was not ok');
          }
          return response.json();
      })
      .then(data => {
          if (data.success) {
              showStatusMessage('Прогресс успешно сохранен!');
              hideProgressModal();

              const marathonCard = document.querySelector(`.marathon-card[data-marathon-id="${marathonId}"]`);
              if (marathonCard) {
                  const progressText = marathonCard.querySelector('.marathon-meta strong');
                  if (progressText && progressText.textContent.includes('Прогресс:')) {
                      progressText.parentNode.textContent = `Прогресс: ${progressCount}/${totalBooks}`;
                  }

                  const progressFill = marathonCard.querySelector('.progress-fill');
                  if (progressFill) {
                      const progressPercent = (progressCount / totalBooks) * 100;
                      progressFill.style.width = `${progressPercent}%`;
                  }
              }

              loadMarathons('active');
          } else {
              showStatusMessage(data.message || 'Ошибка при сохранении прогресса', true);
          }
      })
      .catch(error => {
          console.error('Error:', error);
          showStatusMessage('Произошла ошибка при сохранении прогресса', true);
      });
  }

  document.addEventListener('click', function () {
      document.querySelectorAll('.book-actions-menu, .marathon-actions-menu').forEach(menu => {
          menu.style.display = 'none';
      });
  });