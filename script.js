const API_BASE = "http://127.0.0.1:5000";
const bookForm       = document.getElementById("bookForm");
const booksContainer = document.getElementById("booksContainer");
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data;
}
function renderBooks(books) {
  booksContainer.innerHTML = "";
  if (books.length === 0) {
    booksContainer.innerHTML =
      `<p style="color:#888;text-align:center;padding:20px">No books yet — add one above!</p>`;
    return;
  }
  books.forEach(book => {
    const card = document.createElement("div");
    card.classList.add("book-card");
    card.innerHTML = `
      <h3>${book.title}</h3>
      <p><strong>Author:</strong> ${book.author}</p>
      <p><strong>Genre:</strong>  ${book.genre}</p>
      <p><strong>Year:</strong>   ${book.year}</p>
      <button class="delete-btn" data-id="${book.id}">Delete</button>
    `;
    card.querySelector(".delete-btn").addEventListener("click", () => deleteBook(book.id));
    booksContainer.appendChild(card);
  });
}
async function loadBooks() {
  try {
    const data = await apiFetch("/books");
    renderBooks(data.books);
  } catch (err) {
    booksContainer.innerHTML = `<p style="color:crimson">Could not load books: ${err.message}</p>`;
  }
}
async function addBook(payload) {
  await apiFetch("/books", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await loadBooks();
}
async function deleteBook(id) {
  if (!confirm("Delete this book?")) return;
  try {
    await apiFetch(`/books/${id}`, { method: "DELETE" });
    await loadBooks();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
bookForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  const payload = {
    title:  document.getElementById("title").value,
    author: document.getElementById("author").value,
    genre:  document.getElementById("genre").value,
    year:   parseInt(document.getElementById("year").value, 10),
  };
  try {
    await addBook(payload);
    bookForm.reset();
  } catch (err) {
    alert(`Could not add book: ${err.message}`);
  }
});
loadBooks();