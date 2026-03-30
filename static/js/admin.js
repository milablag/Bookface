let currentActiveTab = 'library';
  let currentActiveSection = 'library';
  let currentMarathonTab = 'system';

  document.addEventListener('DOMContentLoaded', function() {
      if (currentActiveSection === 'library') {
          loadAllBooks();
      }
  });

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
      fetch('/logout')
          .then(() => window.location.href = '/login')
          .catch(() => window.location.href = '/login');
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

  function navigateTo(section) {
      currentActiveSection = section;

      document.querySelectorAll('.nav-item').forEach(item => {
          item.classList.remove('active');
      });
      document.querySelector(`.nav-item[onclick="navigateTo('${section}')"]`).classList.add('active');

      document.getElementById('libraryContent').style.display = 'none';
      document.getElementById('marathonsContent').style.display = 'none';

      if (section === 'library') {
          document.getElementById('libraryContent').style.display = 'block';
          loadAllBooks();
      } else if (section === 'marathons') {
          document.getElementById('marathonsContent').style.display = 'block';
          loadMarathons('system');
      }
  }

  function checkOtherGenre(selectElement) {
      const formId = selectElement.id === 'bookGenre' ? 'addBookForm' : 'editBookModal';
      const otherGenreInputId = selectElement.id === 'bookGenre' ? 'otherGenreInput' : 'editOtherGenreInput';
      const otherGenreInput = document.getElementById(otherGenreInputId);

      if (selectElement.value === "Другое") {
          otherGenreInput.style.display = 'block';
          otherGenreInput.required = true;
      } else {
          otherGenreInput.style.display = 'none';
          otherGenreInput.required = false;
          otherGenreInput.value = '';
      }
  }

  function loadAllBooks() {
      document.getElementById('searchResults').innerHTML = '';

      fetch('/get_all_books')
          .then(response => {
              if (!response.ok) {
                  throw new Error('Network response was not ok');
              }
              return response.json();
          })
          .then(data => {
              if (data.length === 0) {
                  document.getElementById('searchResults').innerHTML = '<div class="no-books">Книги не найдены</div>';
              } else {
                  displaySearchResults(data);
              }
          })
          .catch(error => {
              console.error('Error:', error);
              document.getElementById('searchResults').innerHTML = '<div class="no-books">Ошибка загрузки книг</div>';
          });
  }

  function showAllBooks() {
      document.getElementById('bookSearch').value = '';
      loadAllBooks();
  }

  function searchBooks(event) {
      event.preventDefault();
      const searchTerm = document.getElementById('bookSearch').value.trim();

      if (!searchTerm) {
          loadAllBooks();
          return;
      }

      document.getElementById('searchResults').innerHTML = '<div class="no-books">Поиск книг...</div>';

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
          document.getElementById('searchResults').innerHTML = '<div class="no-books">Ошибка поиска</div>';
      });
  }

  function displaySearchResults(books) {
      const resultsContainer = document.getElementById('searchResults');

      let html = '';
      books.forEach(book => {
          html += `
              <div class="book-card">
                  <img class="book-image" src="${book.image_filename ? '/static/uploads/' + book.image_filename : 'https://via.placeholder.com/120x160?text=No+Image'}" alt="${book.title}">
                  <div class="book-info">
                      <h3 class="book-title">${book.title}</h3>
                      <p class="book-meta"><strong>Автор:</strong> ${book.author}</p>
                      <p class="book-meta"><strong>Жанр:</strong> ${book.genre}</p>
                      ${book.year ? `<p class="book-meta"><strong>Год:</strong> ${book.year}</p>` : ''}
                      ${book.description ? `<p class="book-description"><strong>Описание: </strong>${book.description}</p>` : ''}
                  </div>
                  <div class="book-options" onclick="toggleBookActions(event, ${book.id})">
                      <i class="fas fa-ellipsis-v"></i>
                      <div class="book-actions">
                          <button onclick="showEditBookModal(${book.id})"><i class="fas fa-edit"></i> Редактировать</button>
                          <button onclick="deleteBook(${book.id})"><i class="fas fa-trash"></i> Удалить</button>
                      </div>
                  </div>
              </div>
          `;
      });

      resultsContainer.innerHTML = html;
  }

  function toggleBookActions(event, bookId) {
      event.stopPropagation();
      const bookActions = event.currentTarget.querySelector('.book-actions');
      if (bookActions.style.display === 'block') {
          bookActions.style.display = 'none';
      } else {
          bookActions.style.display = 'block';
      }

      document.querySelectorAll('.book-actions').forEach(actions => {
          if (actions !== bookActions) {
              actions.style.display = 'none';
          }
      });
  }

  function showAddBookForm() {
      document.getElementById('addBookForm').style.display = 'block';
      document.getElementById('bookTitle').focus();
      document.getElementById('otherGenreInput').style.display = 'none';
      document.getElementById('otherGenreInput').required = false;
  }

  function hideAddBookForm() {
      document.getElementById('addBookForm').style.display = 'none';
      document.getElementById('bookForm').reset();
  }

  function addBook() {
      const title = document.getElementById('bookTitle').value.trim();
      const author = document.getElementById('bookAuthor').value.trim();
      let genre = document.getElementById('bookGenre').value;
      const year = document.getElementById('bookYear').value;
      const description = document.getElementById('bookDescription').value.trim();
      const imageFile = document.getElementById('bookImage').files[0];

      if (genre === "Другое") {
          genre = document.getElementById('otherGenreInput').value.trim();
      }

      if (!title || !author || !genre) {
          alert('Пожалуйста, заполните обязательные поля: Название, Автор и Жанр');
          return;
      }

      const formData = new FormData();
      formData.append('title', title);
      formData.append('author', author);
      formData.append('genre', genre);
      if (year) formData.append('year', year);
      if (description) formData.append('description', description);
      if (imageFile) formData.append('image', imageFile);

      fetch('/add_book', {
          method: 'POST',
          body: formData
      })
      .then(response => response.json())
      .then(data => {
          if (data.success) {
              showStatusMessage(`Книга "${title}" успешно добавлена!`);
              hideAddBookForm();
              loadAllBooks();
          } else {
              showStatusMessage('Ошибка: ' + data.message, true);
          }
      })
      .catch(error => {
          console.error('Error:', error);
          showStatusMessage('Произошла ошибка при добавлении книги', true);
      });
  }

  function showEditBookModal(bookId) {
      document.getElementById('modalOverlay').style.display = 'block';
      document.body.style.overflow = 'hidden';

      fetch(`/get_book/${bookId}`)
          .then(response => response.json())
          .then(data => {
              if (data) {
                  document.getElementById('editBookId').value = data.id;
                  document.getElementById('editBookTitle').value = data.title;
                  document.getElementById('editBookAuthor').value = data.author;
                  document.getElementById('editBookGenre').value = data.genre;
                  document.getElementById('editBookYear').value = data.year || '';
                  document.getElementById('editBookDescription').value = data.description || '';

                  document.getElementById('editOtherGenreInput').style.display = 'none';
                  document.getElementById('editOtherGenreInput').required = false;

                  const standardGenres = ["Фантастика", "Детектив", "Роман", "Биография", "Поэзия", "Драма"];
                  if (!standardGenres.includes(data.genre)) {
                      document.getElementById('editBookGenre').value = "Другое";
                      document.getElementById('editOtherGenreInput').value = data.genre;
                      document.getElementById('editOtherGenreInput').style.display = 'block';
                      document.getElementById('editOtherGenreInput').required = true;
                  }

                  document.getElementById('editBookModal').style.display = 'block';
              }
          })
          .catch(error => {
              console.error('Error:', error);
              showStatusMessage('Произошла ошибка при загрузке данных книги', true);
          });
  }

  function hideEditBookModal() {
      document.getElementById('modalOverlay').style.display = 'none';
      document.body.style.overflow = 'auto';
      document.getElementById('editBookModal').style.display = 'none';
      document.getElementById('editBookForm').reset();
  }

  function updateBook() {
      const bookId = document.getElementById('editBookId').value;
      const title = document.getElementById('editBookTitle').value.trim();
      const author = document.getElementById('editBookAuthor').value.trim();
      let genre = document.getElementById('editBookGenre').value;
      const year = document.getElementById('editBookYear').value;
      const description = document.getElementById('editBookDescription').value.trim();
      const imageFile = document.getElementById('editBookImage').files[0];

      if (genre === "Другое") {
          genre = document.getElementById('editOtherGenreInput').value.trim();
      }

      if (!title || !author || !genre) {
          alert('Пожалуйста, заполните обязательные поля: Название, Автор и Жанр');
          return;
      }

      const formData = new FormData();
      formData.append('book_id', bookId);
      formData.append('title', title);
      formData.append('author', author);
      formData.append('genre', genre);
      if (year) formData.append('year', year);
      if (description) formData.append('description', description);
      if (imageFile) formData.append('image', imageFile);

      fetch('/update_book', {
          method: 'POST',
          body: formData
      })
      .then(response => response.json())
      .then(data => {
          if (data.success) {
              showStatusMessage(`Книга "${title}" успешно обновлена!`);
              hideEditBookModal();
              loadAllBooks();
          } else {
              showStatusMessage('Ошибка: ' + data.message, true);
          }
      })
      .catch(error => {
          console.error('Error:', error);
          showStatusMessage('Произошла ошибка при обновлении книги', true);
      });
  }

  function deleteBook(bookId) {
      fetch(`/delete_book/${bookId}`, {
          method: 'DELETE'
      })
      .then(response => response.json())
      .then(data => {
          if (data.success) {
              showStatusMessage('Книга успешно удалена!');
              loadAllBooks();
          } else {
              showStatusMessage('Ошибка: ' + data.message, true);
          }
      })
      .catch(error => {
          console.error('Error:', error);
          showStatusMessage('Произошла ошибка при удалении книги', true);
      });
  }

  function showAddMarathonForm() {
      document.getElementById('addMarathonForm').style.display = 'block';
      document.getElementById('marathonName').focus();
      document.getElementById('marathonBookCount').value = '1';
      document.getElementById('marathonDurationValue').value = '30';
  }

  function hideAddMarathonForm() {
      document.getElementById('addMarathonForm').style.display = 'none';
      document.getElementById('marathonForm').reset();
  }

  function addMarathon() {
      const name = document.getElementById('marathonName').value.trim();
      const bookCount = document.getElementById('marathonBookCount').value;
      const durationValue = document.getElementById('marathonDurationValue').value;
      const durationUnit = document.getElementById('marathonDurationUnit').value;
      const description = document.getElementById('marathonDescription').value.trim();

      if (!name || !bookCount || !durationValue) {
          showStatusMessage('Пожалуйста, заполните все обязательные поля', true);
          return;
      }

      const durationText = `${durationValue} ${getDurationUnitText(durationValue, durationUnit)}`;

      fetch('/add_marathon', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              name: name,
              book_count: bookCount,
              duration: durationText,
              description: description
          })
      })
      .then(response => response.json())
      .then(data => {
          if (data.success) {
              showStatusMessage(`Марафон "${name}" успешно добавлен!`);
              hideAddMarathonForm();
              loadMarathons(currentMarathonTab);
          } else {
              showStatusMessage('Ошибка: ' + (data.message || 'Неизвестная ошибка'), true);
          }
      })
      .catch(error => {
          console.error('Error:', error);
          showStatusMessage('Произошла ошибка при добавлении марафона', true);
      });
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

  function loadMarathons(type) {
      currentMarathonTab = type;
      const containerId = type === 'system' ? 'systemMarathonsList' : 'userMarathonsList';
      const container = document.getElementById(containerId);
      container.innerHTML = '';

      const endpoint = type === 'system' ? '/get_system_marathons' : '/get_user_marathons';

      fetch(endpoint)
          .then(response => response.json())
          .then(data => {
              if (data.length === 0) {
                  container.innerHTML = '<div class="no-books">Марафоны не найдены</div>';
              } else {
                  displayMarathons(data, container);
              }
          })
          .catch(error => {
              console.error('Error:', error);
              container.innerHTML = '<div class="no-books">Ошибка загрузки марафонов</div>';
          });
  }

  function openMarathonTab(tabName) {
    currentMarathonTab = tabName;

    document.querySelectorAll('.marathon-tab-button').forEach(button => {
        button.classList.remove('active');
    });
    document.querySelector(`.marathon-tab-button[onclick="openMarathonTab('${tabName}')"]`).classList.add('active');

    document.querySelectorAll('.marathon-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Marathons`).classList.add('active');

    if (tabName === 'system') {
        loadMarathons('system');
    } else if (tabName === 'user') {
        fetch('/get_user_marathons')
            .then(response => response.json())
            .then(data => {
                const container = document.getElementById('userMarathonsList');
                if (data.length === 0) {
                    container.innerHTML = '<div class="no-books">Пользовательские марафоны не найдены</div>';
                } else {
                    displayMarathons(data, container);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                document.getElementById('userMarathonsList').innerHTML = '<div class="no-books">Ошибка загрузки марафонов</div>';
            });
    }
  }

  function displayMarathons(marathons, container) {
      container.innerHTML = '';

      marathons.forEach(marathon => {
          const marathonCard = document.createElement('div');
          marathonCard.className = 'marathon-card';

          let actionsHtml = '';
          if (marathon.type === 'system' || (currentMarathonTab === 'system' && '{{ role }}' === 'admin')) {
              actionsHtml = `
                  <div class="marathon-actions" onclick="toggleMarathonActions(event, ${marathon.id})">
                      <i class="fas fa-ellipsis-v"></i>
                      <div class="marathon-actions-menu">
                          <button onclick="showEditMarathonModal(${marathon.id})"><i class="fas fa-edit"></i> Редактировать</button>
                          <button onclick="deleteMarathon(${marathon.id})"><i class="fas fa-trash"></i> Удалить</button>
                      </div>
                  </div>
              `;
          } else if (marathon.type === 'user' || currentMarathonTab === 'user') {
              actionsHtml = `
                  <div class="marathon-actions" onclick="toggleMarathonActions(event, ${marathon.id})">
                      <i class="fas fa-ellipsis-v"></i>
                      <div class="marathon-actions-menu">
                          <button onclick="deleteMarathon(${marathon.id})"><i class="fas fa-trash"></i> Удалить</button>
                      </div>
                  </div>
              `;
          }

          let creatorInfo = '';
          if (marathon.type === 'user' && marathon.creator_name) {
              creatorInfo = `<p class="marathon-meta"><strong>Автор:</strong> ${marathon.creator_name}</p>`;
          }

          marathonCard.innerHTML = `
              ${actionsHtml}
              <h3 class="marathon-title">${marathon.name}</h3>
              ${creatorInfo}
              <p class="marathon-meta"><strong>Книг:</strong> ${marathon.book_count}</p>
              ${marathon.duration ? `<p class="marathon-meta"><strong>Срок:</strong> ${marathon.duration}</p>` : ''}
              ${marathon.description ? `<p class="marathon-description"><strong>Описание:</strong> ${marathon.description}</p>` : ''}
              ${marathon.participants_count ? `<p class="marathon-meta"><strong>Участников:</strong> ${marathon.participants_count}</p>` : ''}
          `;
          container.appendChild(marathonCard);
      });
  }

  function toggleMarathonActions(event, marathonId) {
      event.stopPropagation();
      const marathonActions = event.currentTarget.querySelector('.marathon-actions-menu');
      if (marathonActions.style.display === 'block') {
          marathonActions.style.display = 'none';
      } else {
          document.querySelectorAll('.marathon-actions-menu').forEach(menu => {
              menu.style.display = 'none';
          });
          marathonActions.style.display = 'block';
      }
  }

  function deleteMarathon(marathonId) {
      fetch(`/delete_marathon/${marathonId}`, {
          method: 'DELETE'
      })
      .then(response => response.json())
      .then(data => {
          if (data.success) {
              showStatusMessage('Марафон успешно удален!');
              loadMarathons(currentMarathonTab);
          } else {
              showStatusMessage('Ошибка: ' + data.message, true);
          }
      })
      .catch(error => {
          console.error('Error:', error);
          showStatusMessage('Произошла ошибка при удалении марафона', true);
      });
  }

  function showEditMarathonModal(marathonId) {
      fetch(`/get_marathon/${marathonId}`)
          .then(response => response.json())
          .then(data => {
              if (data.id) {
                  document.getElementById('editMarathonId').value = data.id;
                  document.getElementById('editMarathonName').value = data.name;
                  document.getElementById('editMarathonBookCount').value = data.book_count;

                  if (data.duration) {
                      const durationMatch = data.duration.match(/^(\d+)\s(.+)/);
                      if (durationMatch) {
                          const value = durationMatch[1];
                          const unitText = durationMatch[2];

                          document.getElementById('editMarathonDurationValue').value = value;

                          let unit = 'days';
                          if (unitText.includes('месяц')) unit = 'months';
                          else if (unitText.includes('год')) unit = 'years';

                          document.getElementById('editMarathonDurationUnit').value = unit;
                      }
                  }

                  document.getElementById('editMarathonDescription').value = data.description || '';
                  document.getElementById('editMarathonModal').style.display = 'block';
              } else {
                  showStatusMessage(data.message || 'Ошибка при загрузке данных марафона', true);
              }
          })
          .catch(error => {
              console.error('Error:', error);
              showStatusMessage('Произошла ошибка при загрузке данных марафона', true);
          });
  }

  function hideEditMarathonModal() {
      document.getElementById('editMarathonModal').style.display = 'none';
      document.getElementById('editMarathonForm').reset();
  }

  function updateMarathon() {
      const marathonId = document.getElementById('editMarathonId').value;
      const name = document.getElementById('editMarathonName').value.trim();
      const bookCount = document.getElementById('editMarathonBookCount').value;
      const durationValue = document.getElementById('editMarathonDurationValue').value;
      const durationUnit = document.getElementById('editMarathonDurationUnit').value;
      const description = document.getElementById('editMarathonDescription').value.trim();

      if (!name || !bookCount || !durationValue) {
          showStatusMessage('Пожалуйста, заполните все обязательные поля', true);
          return;
      }

      const durationText = `${durationValue} ${getDurationUnitText(durationValue, durationUnit)}`;

      fetch('/update_marathon', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              marathon_id: marathonId,
              name: name,
              book_count: bookCount,
              duration: durationText,
              description: description
          })
      })
      .then(response => response.json())
      .then(data => {
          if (data.success) {
              showStatusMessage(`Марафон "${name}" успешно обновлен!`);
              hideEditMarathonModal();
              loadMarathons(currentMarathonTab);
          } else {
              showStatusMessage('Ошибка: ' + (data.message || 'Неизвестная ошибка'), true);
          }
      })
      .catch(error => {
          console.error('Error:', error);
          showStatusMessage('Произошла ошибка при обновлении марафона', true);
      });
  }

  document.addEventListener('click', function(event) {
      document.querySelectorAll('.book-actions, .marathon-actions-menu').forEach(menu => {
          if (menu.style.display === 'block' && !menu.contains(event.target) &&
              !event.target.closest('.book-options') && !event.target.closest('.marathon-actions')) {
              menu.style.display = 'none';
          }
      });

      const editMarathonModal = document.getElementById('editMarathonModal');
      if (editMarathonModal.style.display === 'block' && !editMarathonModal.contains(event.target) && event.target !== document.querySelector('#editMarathonModal .modal-content')) {
          hideEditMarathonModal();
      }
  });
  document.getElementById('modalOverlay').addEventListener('click', hideEditBookModal);