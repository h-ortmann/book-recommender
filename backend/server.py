from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from sqlalchemy.pool import NullPool
import anthropic
import datetime
import json
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)
CORS(app)

database_url = os.environ.get("DATABASE_URL", "sqlite:///book_recommender.db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"poolclass": NullPool}
db = SQLAlchemy(app)
migrate = Migrate(app, db)

claude = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from environment


class Book(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(200), nullable=False)
    genre = db.Column(db.String(100))
    tropes = db.Column(db.Text)       # stored as JSON string, e.g. '["enemies-to-lovers"]'
    mood = db.Column(db.Text)         # stored as JSON string, e.g. '["cozy", "dark"]'
    page_count = db.Column(db.Integer)
    description = db.Column(db.Text)
    format = db.Column(db.String(20))  # "physical" or "ebook"
    read_status = db.Column(db.String(20), default="want_to_read")
    date_added = db.Column(db.DateTime, default=datetime.datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "author": self.author,
            "genre": self.genre,
            "tropes": json.loads(self.tropes) if self.tropes else [],
            "mood": json.loads(self.mood) if self.mood else [],
            "page_count": self.page_count,
            "description": self.description,
            "format": self.format,
            "read_status": self.read_status,
            "date_added": self.date_added.isoformat() if self.date_added else None,
        }


# --- CRUD ---

@app.route("/books", methods=["GET"])
def get_books():
    books = Book.query.order_by(Book.date_added.desc()).all()
    return jsonify([book.to_dict() for book in books])


@app.route("/books", methods=["POST"])
def add_book():
    data = request.get_json()
    book = Book(
        title=data["title"],
        author=data["author"],
        genre=data.get("genre"),
        tropes=json.dumps(data.get("tropes", [])),
        mood=json.dumps(data.get("mood", [])),
        page_count=data.get("page_count"),
        description=data.get("description"),
        format=data.get("format", "physical"),
        read_status=data.get("read_status", "want_to_read"),
    )
    db.session.add(book)
    db.session.commit()
    return jsonify(book.to_dict()), 201


@app.route("/books/<int:id>", methods=["PATCH"])
def update_book_status(id):
    book = db.session.get(Book, id)
    if book is None:
        return jsonify({"error": "Book not found"}), 404
    data = request.get_json()
    if "read_status" in data:
        book.read_status = data["read_status"]
    db.session.commit()
    return jsonify(book.to_dict())


@app.route("/books/<int:id>", methods=["DELETE"])
def delete_book(id):
    book = db.session.get(Book, id)
    if book is None:
        return jsonify({"error": "Book not found"}), 404
    db.session.delete(book)
    db.session.commit()
    return jsonify({"deleted": id})


# --- AI: autofill metadata ---

@app.route("/books/autofill", methods=["POST"])
def autofill_book():
    data = request.get_json()
    title = data.get("title", "")
    author = data.get("author", "")

    response = claude.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        system="""You are a book metadata assistant. Given a title and author, return metadata as a JSON object with exactly these fields:
- genre: string (e.g. "Fantasy", "Literary Fiction", "Romance", "Thriller")
- tropes: array of strings (up to 5, e.g. ["enemies-to-lovers", "found family", "slow burn"])
- mood: array of strings (up to 4, e.g. ["cozy", "dark", "adventurous", "emotional"])
- page_count: integer (approximate) or null if genuinely unknown
- description: string (2-3 sentence summary, no spoilers)

Return only the JSON object. No explanation, no markdown code blocks.""",
        messages=[{"role": "user", "content": f"Book: {title} by {author}"}],
    )

    try:
        metadata = json.loads(response.content[0].text)
        return jsonify(metadata)
    except (json.JSONDecodeError, IndexError):
        return jsonify({"error": "Could not parse metadata from AI response"}), 500


# --- AI: recommend a book ---

@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.get_json()
    context = data.get("context", "")
    exclude_ids = data.get("exclude_ids", [])

    query = Book.query
    if exclude_ids:
        query = query.filter(~Book.id.in_(exclude_ids))
    all_books = query.all()
    if not all_books:
        return jsonify({"error": "No books in your library yet."}), 400

    library_lines = []
    for book in all_books:
        b = book.to_dict()
        tropes_str = ", ".join(b["tropes"]) if b["tropes"] else "none listed"
        mood_str = ", ".join(b["mood"]) if b["mood"] else "none listed"
        status_label = {"want_to_read": "unread", "reading": "currently reading", "read": "already read"}.get(b["read_status"], b["read_status"])
        library_lines.append(
            f"ID {b['id']}: {b['title']} by {b['author']} | Status: {status_label} | Genre: {b['genre'] or 'unknown'} | Tropes: {tropes_str} | Mood: {mood_str}"
        )
    library_text = "\n".join(library_lines)

    response = claude.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        thinking={"type": "adaptive"},
        system="""You are a personal book recommender. The user has a library with books at different stages: unread, currently reading, and already read.
Pick the single best book based on the user's context — if they mention wanting a re-read, pick from already read books; otherwise default to unread books.
Return a JSON object with exactly these fields:
- book_id: integer (the ID of the recommended book)
- title: string
- author: string
- reason: string (2-3 sentences explaining why this book fits their mood and context right now)

Return only the JSON object. No explanation, no markdown code blocks.""",
        messages=[{
            "role": "user",
            "content": f"My reading context: {context}\n\nMy unread books:\n{library_text}"
        }],
    )

    try:
        # With adaptive thinking enabled, there may be a thinking block before the text block
        text_block = next(b for b in response.content if b.type == "text")
        recommendation = json.loads(text_block.text)
        return jsonify(recommendation)
    except (json.JSONDecodeError, StopIteration):
        return jsonify({"error": "Could not generate a recommendation"}), 500


if __name__ == "__main__":
    app.run(debug=True)
