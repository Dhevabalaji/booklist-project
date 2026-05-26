const bookForm = document.getElementById("bookForm");
const booksContainer = document.getElementById("booksContainer");
let books = [];
bookForm.addEventListener("submit", function(e) {
  e.preventDefault();
  const title = document.getElementById("title").value;
  const author = document.getElementById("author").value;
  const genre = document.getElementById("genre").value;
  const year = document.getElementById("year").value;
  const book = {
    id: Date.now(),
    title,
    author,
    genre,
    year
  };
  books.push(book);
  displayBooks();
  bookForm.reset();
});
function displayBooks() {
  booksContainer.innerHTML = "";
  books.forEach(book => {
    const bookCard = document.createElement("div");
    bookCard.classList.add("book-card");
    bookCard.innerHTML = `
      <h3>${book.title}</h3>
      <p><strong>Author:</strong> ${book.author}</p>
      <p><strong>Genre:</strong> ${book.genre}</p>
      <p><strong>Year:</strong> ${book.year}</p>
      <button class="delete-btn" onclick="deleteBook(${book.id})">
        Delete
      </button>
    `;
    booksContainer.appendChild(bookCard);
  });
}
function deleteBook(id) {
  books = books.filter(book => book.id !== id);

  displayBooks();
}