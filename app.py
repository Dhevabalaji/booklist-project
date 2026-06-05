import sqlite3
import json
from flask import Flask, request, jsonify, g
app = Flask(__name__)
DATABASE = "books.db"
def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row   # rows behave like dicts
    return db
@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()
def init_db():
    with app.app_context():
        db = get_db()
        db.execute("""
            CREATE TABLE IF NOT EXISTS books (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                title   TEXT    NOT NULL,
                author  TEXT    NOT NULL,
                genre   TEXT    NOT NULL,
                year    INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        db.commit()
    print("Database initialised — books table ready.")
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response
@app.route("/<path:path>", methods=["OPTIONS"])
@app.route("/", methods=["OPTIONS"])
def handle_options(path=""):
    return jsonify({}), 200
def row_to_dict(row):
    return dict(row) if row else None
def validate_book(data, require_all=True):
    fields = ["title", "author", "genre", "year"]
    cleaned = {}
    for field in fields:
        value = data.get(field)
        if require_all and value in (None, ""):
            return None, f"'{field}' is required."
        if value not in (None, ""):
            if field == "year":
                try:
                    y = int(value)
                    if y < 1000 or y > 2100:
                        return None, "'year' must be between 1000 and 2100."
                    cleaned[field] = y
                except (ValueError, TypeError):
                    return None, "'year' must be an integer."
            else:
                cleaned[field] = str(value).strip()
    return cleaned, None
@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "name": "BookList API",
        "version": "1.0.0",
        "endpoints": {
            "GET    /books":        "List all books",
            "POST   /books":        "Add a new book",
            "GET    /books/<id>":   "Get a single book",
            "PUT    /books/<id>":   "Update a book",
            "DELETE /books/<id>":   "Delete a book",
            "GET    /books/stats":  "Collection statistics",
        }
    })
@app.route("/books", methods=["GET"])
def list_books():
    db = get_db()
    genre  = request.args.get("genre")
    author = request.args.get("author")
    year   = request.args.get("year")
    search = request.args.get("search")
    query  = "SELECT * FROM books WHERE 1=1"
    params = []
    if genre:
        query += " AND LOWER(genre) = LOWER(?)"
        params.append(genre)
    if author:
        query += " AND LOWER(author) LIKE LOWER(?)"
        params.append(f"%{author}%")
    if year:
        try:
            query += " AND year = ?"
            params.append(int(year))
        except ValueError:
            return jsonify({"error": "'year' filter must be an integer."}), 400
    if search:
        query += " AND (LOWER(title) LIKE LOWER(?) OR LOWER(author) LIKE LOWER(?))"
        params.extend([f"%{search}%", f"%{search}%"])
    query += " ORDER BY created_at DESC"
    rows = db.execute(query, params).fetchall()
    return jsonify({"count": len(rows), "books": [row_to_dict(r) for r in rows]}), 200
@app.route("/books/stats", methods=["GET"])
def stats():
    db = get_db()
    total  = db.execute("SELECT COUNT(*) FROM books").fetchone()[0]
    genres = db.execute(
        "SELECT genre, COUNT(*) as count FROM books GROUP BY genre ORDER BY count DESC"
    ).fetchall()
    oldest = db.execute("SELECT * FROM books ORDER BY year ASC  LIMIT 1").fetchone()
    newest = db.execute("SELECT * FROM books ORDER BY year DESC LIMIT 1").fetchone()
    return jsonify({
        "total_books": total,
        "genres": [{"genre": r["genre"], "count": r["count"]} for r in genres],
        "oldest_book": row_to_dict(oldest),
        "newest_book": row_to_dict(newest),
    }), 200
@app.route("/books", methods=["POST"])
def create_book():
    data = request.get_json(silent=True) or {}
    cleaned, err = validate_book(data, require_all=True)
    if err:
        return jsonify({"error": err}), 400
    db  = get_db()
    cur = db.execute(
        "INSERT INTO books (title, author, genre, year) VALUES (?, ?, ?, ?)",
        (cleaned["title"], cleaned["author"], cleaned["genre"], cleaned["year"])
    )
    db.commit()
    new_book = row_to_dict(db.execute("SELECT * FROM books WHERE id = ?", (cur.lastrowid,)).fetchone())
    return jsonify({"message": "Book added successfully.", "book": new_book}), 201
@app.route("/books/<int:book_id>", methods=["GET"])
def get_book(book_id):
    row = get_db().execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    if not row:
        return jsonify({"error": f"Book with id {book_id} not found."}), 404
    return jsonify(row_to_dict(row)), 200
@app.route("/books/<int:book_id>", methods=["PUT"])
def update_book(book_id):
    db  = get_db()
    row = db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    if not row:
        return jsonify({"error": f"Book with id {book_id} not found."}), 404
    data = request.get_json(silent=True) or {}
    cleaned, err = validate_book(data, require_all=False)
    if err:
        return jsonify({"error": err}), 400
    if not cleaned:
        return jsonify({"error": "No updatable fields provided."}), 400
    set_clause = ", ".join(f"{k} = ?" for k in cleaned)
    values     = list(cleaned.values()) + [book_id]
    db.execute(f"UPDATE books SET {set_clause} WHERE id = ?", values)
    db.commit()
    updated = row_to_dict(db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone())
    return jsonify({"message": "Book updated successfully.", "book": updated}), 200
@app.route("/books/<int:book_id>", methods=["DELETE"])
def delete_book(book_id):
    db  = get_db()
    row = db.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    if not row:
        return jsonify({"error": f"Book with id {book_id} not found."}), 404
    db.execute("DELETE FROM books WHERE id = ?", (book_id,))
    db.commit()
    return jsonify({"message": f"Book '{row['title']}' deleted successfully."}), 200
if __name__ == "__main__":
    init_db()
    print("\n BookList API running at http://127.0.0.1:5000\n")
    app.run(debug=True, port=5000)