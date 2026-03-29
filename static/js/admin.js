let currentActiveTab = 'library';
  let currentActiveSection = 'library';

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