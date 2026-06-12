const API_BASE = "http://127.0.0.1:5000";
let editingId = null;
async function apiFetch(path, options = {}) {
  const res  = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data;
}
async function loadStats() {
  try {
    const s = await apiFetch("/books/stats");
    document.getElementById("statTotal").textContent   = s.total_books;
    document.getElementById("statGenres").textContent  = s.genres.length;
    document.getElementById("statOldest").textContent  = s.oldest_book ? s.oldest_book.year : "—";
    document.getElementById("statNewest").textContent  = s.newest_book ? s.newest_book.year : "—";
    const sel = document.getElementById("genreFilter");
    const current = sel.value;
    sel.innerHTML = '<option value="">All Genres</option>';
    s.genres.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.genre;
      opt.textContent = `${g.genre} (${g.count})`;
      if (g.genre === current) opt.selected = true;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("Stats error:", err.message);
  }
}
function renderBooks(books) {
  const container = document.getElementById("booksContainer");
  container.innerHTML = "";

  if (books.length === 0) {
    container.innerHTML =
      `<p class="empty-msg">No books found — try a different search or add one above!</p>`;
    return;
  }
  books.forEach(book => {
    const card = document.createElement("div");
    card.className = "book-card";
    card.innerHTML = `
      <div class="book-info">
        <h3>${escHtml(book.title)}</h3>
        <p><span class="label">Author</span> ${escHtml(book.author)}</p>
        <p><span class="label">Genre</span>  <span class="genre-tag">${escHtml(book.genre)}</span></p>
        <p><span class="label">Year</span>   ${book.year}</p>
      </div>
      <div class="book-actions">
        <button class="edit-btn"   onclick="startEdit(${book.id}, '${escJs(book.title)}', '${escJs(book.author)}', '${escJs(book.genre)}', ${book.year})">✏️ Edit</button>
        <button class="delete-btn" onclick="deleteBook(${book.id}, '${escJs(book.title)}')">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });
}
async function loadBooks(search = "", genre = "") {
  const container = document.getElementById("booksContainer");
  container.innerHTML = `<p class="loading-msg">Loading…</p>`;
  try {
    let query = "/books?";
    if (search) query += `search=${encodeURIComponent(search)}&`;
    if (genre)  query += `genre=${encodeURIComponent(genre)}`;
    const data = await apiFetch(query);
    renderBooks(data.books);
  } catch (err) {
    container.innerHTML = `<p class="error-msg">Could not load books: ${err.message}</p>`;
  }
}
function handleSearch() {
  const search = document.getElementById("searchInput").value.trim();
  const genre  = document.getElementById("genreFilter").value;
  loadBooks(search, genre);
}
async function handleSubmit() {
  const title  = document.getElementById("title").value.trim();
  const author = document.getElementById("author").value.trim();
  const genre  = document.getElementById("genre").value.trim();
  const year   = parseInt(document.getElementById("year").value, 10);
  const msg    = document.getElementById("formMsg");

  if (!title || !author || !genre || !year) {
    showMsg(msg, "Please fill in all fields.", "warn");
    return;
  }
  const payload = { title, author, genre, year };
  try {
    if (editingId) {
      await apiFetch(`/books/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      showMsg(msg, "Book updated!", "ok");
    } else {
      await apiFetch("/books", { method: "POST", body: JSON.stringify(payload) });
      showMsg(msg, "Book added!", "ok");
    }
    resetForm();
    await loadBooks();
    await loadStats();
  } catch (err) {
    showMsg(msg, `${err.message}`, "error");
  }
}
function startEdit(id, title, author, genre, year) {
  editingId = id;
  document.getElementById("title").value  = title;
  document.getElementById("author").value = author;
  document.getElementById("genre").value  = genre;
  document.getElementById("year").value   = year;
  document.getElementById("formTitle").textContent = "Edit Book";
  document.getElementById("submitBtn").textContent = "Save Changes";
  document.getElementById("cancelBtn").classList.remove("hidden");
  document.querySelector(".book-form").scrollIntoView({ behavior: "smooth" });
}
function cancelEdit() {
  resetForm();
}
function resetForm() {
  editingId = null;
  document.getElementById("title").value  = "";
  document.getElementById("author").value = "";
  document.getElementById("genre").value  = "";
  document.getElementById("year").value   = "";
  document.getElementById("formTitle").textContent = "Add New Book";
  document.getElementById("submitBtn").textContent = "Add Book";
  document.getElementById("cancelBtn").classList.add("hidden");
  document.getElementById("formMsg").textContent = "";
}
async function deleteBook(id, title) {
  if (!confirm(`Delete "${title}"?`)) return;
  try {
    await apiFetch(`/books/${id}`, { method: "DELETE" });
    await loadBooks(
      document.getElementById("searchInput").value.trim(),
      document.getElementById("genreFilter").value
    );
    await loadStats();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function escJs(str) {
  return String(str).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
}
function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `form-msg msg-${type}`;
  setTimeout(() => { el.textContent = ""; el.className = "form-msg"; }, 4000);
}
loadBooks();
loadStats();