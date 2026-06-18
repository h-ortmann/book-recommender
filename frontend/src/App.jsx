import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000"

export default function App() {
  const [books, setBooks] = useState([])

  // Add book form
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [genre, setGenre] = useState("")
  const [tropes, setTropes] = useState("")
  const [mood, setMood] = useState("")
  const [pageCount, setPageCount] = useState("")
  const [description, setDescription] = useState("")
  const [format, setFormat] = useState("physical")
  const [metadataVisible, setMetadataVisible] = useState(false)

  // AI states
  const [autofillLoading, setAutofillLoading] = useState(false)
  const [recommendContext, setRecommendContext] = useState("")
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [recommendation, setRecommendation] = useState(null)
  const [excludedIds, setExcludedIds] = useState([])
  const [groupBy, setGroupBy] = useState("none")
  const [librarySectionOpen, setLibrarySectionOpen] = useState(true)
  const [readSectionOpen, setReadSectionOpen] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Search state
  const [librarySearch, setLibrarySearch] = useState("")
  const [readSearch, setReadSearch] = useState("")

  useEffect(() => {
    fetchBooks()
  }, [])

  async function fetchBooks() {
    const res = await fetch(`${API_URL}/books`)
    const data = await res.json()
    setBooks(data)
  }

  async function handleAutofill() {
    if (!title || !author) return
    setAutofillLoading(true)
    try {
      const res = await fetch(`${API_URL}/books/autofill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author }),
      })
      const data = await res.json()
      setGenre(data.genre || "")
      setTropes(Array.isArray(data.tropes) ? data.tropes.join(", ") : "")
      setMood(Array.isArray(data.mood) ? data.mood.join(", ") : "")
      setPageCount(data.page_count ? String(data.page_count) : "")
      setDescription(data.description || "")
      setMetadataVisible(true)
    } finally {
      setAutofillLoading(false)
    }
  }

  async function handleAddBook(e) {
    e.preventDefault()
    await fetch(`${API_URL}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        author,
        genre,
        tropes: tropes.split(",").map((s) => s.trim()).filter(Boolean),
        mood: mood.split(",").map((s) => s.trim()).filter(Boolean),
        page_count: pageCount ? parseInt(pageCount) : null,
        description,
        format,
        read_status: "want_to_read",
      }),
    })
    setTitle(""); setAuthor(""); setGenre(""); setTropes("")
    setMood(""); setPageCount(""); setDescription(""); setFormat("physical")
    setMetadataVisible(false)
    fetchBooks()
  }

  async function handleDelete(id) {
    await fetch(`${API_URL}/books/${id}`, { method: "DELETE" })
    fetchBooks()
  }

  async function handleRecommend(excluded = []) {
    if (!recommendContext) return
    setRecommendLoading(true)
    setRecommendation(null)
    try {
      const res = await fetch(`${API_URL}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: recommendContext, exclude_ids: excluded }),
      })
      const data = await res.json()
      setRecommendation(data)
    } finally {
      setRecommendLoading(false)
    }
  }

  async function handleSuggestAnother() {
    const newExcluded = [...excludedIds, recommendation.book_id]
    setExcludedIds(newExcluded)
    await handleRecommend(newExcluded)
  }

  async function handleMarkRead(id) {
    await fetch(`${API_URL}/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read_status: "read" }),
    })
    fetchBooks()
  }

  async function handleMoveToWantToRead(id) {
    await fetch(`${API_URL}/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read_status: "want_to_read" }),
    })
    fetchBooks()
  }

  function handleEditStart(book) {
    setEditingId(book.id)
    setEditForm({
      title: book.title,
      author: book.author,
      genre: book.genre || "",
      tropes: book.tropes?.join(", ") || "",
      mood: book.mood?.join(", ") || "",
      page_count: book.page_count ? String(book.page_count) : "",
      description: book.description || "",
      format: book.format || "physical",
      rating: book.rating || null,
      notes: book.notes || "",
    })
  }

  function handleEditCancel() {
    setEditingId(null)
    setEditForm({})
  }

  async function handleEditSave(id) {
    await fetch(`${API_URL}/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        author: editForm.author,
        genre: editForm.genre,
        tropes: editForm.tropes.split(",").map((s) => s.trim()).filter(Boolean),
        mood: editForm.mood.split(",").map((s) => s.trim()).filter(Boolean),
        page_count: editForm.page_count ? parseInt(editForm.page_count) : null,
        description: editForm.description,
        format: editForm.format,
        rating: editForm.rating,
        notes: editForm.notes,
      }),
    })
    setEditingId(null)
    setEditForm({})
    fetchBooks()
  }

  async function handleLetsReadThat() {
    await fetch(`${API_URL}/books/${recommendation.book_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read_status: "reading" }),
    })
    setRecommendation(null)
    setExcludedIds([])
    fetchBooks()
  }

  function getGroupedBooks(bookList) {
    if (groupBy === "none") return { "": bookList }
    return bookList.reduce((acc, book) => {
      const key =
        groupBy === "genre"
          ? book.genre || "Unknown"
          : book.format === "ebook"
          ? "E-book"
          : book.format === "physical"
          ? "Physical"
          : "Other"
      if (!acc[key]) acc[key] = []
      acc[key].push(book)
      return acc
    }, {})
  }

  function renderEditForm(bookId) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">Title</p>
            <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">Author</p>
            <Input value={editForm.author} onChange={(e) => setEditForm({ ...editForm, author: e.target.value })} />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Genre</p>
          <Input value={editForm.genre} onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Tropes</p>
          <Input placeholder="comma-separated" value={editForm.tropes} onChange={(e) => setEditForm({ ...editForm, tropes: e.target.value })} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Mood</p>
          <Input placeholder="comma-separated" value={editForm.mood} onChange={(e) => setEditForm({ ...editForm, mood: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Page count</p>
            <Input type="number" className="w-32" value={editForm.page_count} onChange={(e) => setEditForm({ ...editForm, page_count: e.target.value })} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">Format</p>
            <select
              value={editForm.format}
              onChange={(e) => setEditForm({ ...editForm, format: e.target.value })}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="physical">Physical</option>
              <option value="ebook">E-book</option>
            </select>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
          <Textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Rating</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setEditForm({ ...editForm, rating: editForm.rating === star ? null : star })}
                className={`text-xl leading-none ${star <= (editForm.rating || 0) ? "text-yellow-400" : "text-muted-foreground"}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
          <Textarea rows={2} placeholder="Your thoughts on this book…" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => handleEditSave(bookId)} className="flex-1">Save</Button>
          <Button size="sm" variant="outline" onClick={handleEditCancel} className="flex-1">Cancel</Button>
        </div>
      </div>
    )
  }

  const currentlyReading = books.filter((b) => b.read_status === "reading")
  const wantToRead = books.filter((b) => b.read_status === "want_to_read")
  const allRead = books.filter((b) => b.read_status === "read")
  const filteredWantToRead = librarySearch
    ? wantToRead.filter((b) => b.title.toLowerCase().includes(librarySearch.toLowerCase()) || b.author.toLowerCase().includes(librarySearch.toLowerCase()))
    : wantToRead
  const filteredRead = readSearch
    ? allRead.filter((b) => b.title.toLowerCase().includes(readSearch.toLowerCase()) || b.author.toLowerCase().includes(readSearch.toLowerCase()))
    : allRead

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">My Book Library</h1>

      {/* Add a book */}
      <Card>
        <CardHeader>
          <CardTitle>Add a book</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddBook} className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Input
                placeholder="Author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAutofill}
                disabled={autofillLoading || !title || !author}
                className="shrink-0"
              >
                {autofillLoading ? "Filling…" : "Autofill ✦"}
              </Button>
            </div>

            {metadataVisible && (
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Genre</p>
                  <Input value={genre} onChange={(e) => setGenre(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Tropes</p>
                  <Input placeholder="comma-separated" value={tropes} onChange={(e) => setTropes(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Mood</p>
                  <Input placeholder="comma-separated" value={mood} onChange={(e) => setMood(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Page count</p>
                    <Input
                      value={pageCount}
                      onChange={(e) => setPageCount(e.target.value)}
                      type="number"
                      className="w-32"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Format</p>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                    >
                      <option value="physical">Physical</option>
                      <option value="ebook">E-book</option>
                    </select>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full">
              Add to library
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recommend */}
      <Card>
        <CardHeader>
          <CardTitle>What should I read next?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="e.g. I'm travelling and want something light and fun"
            value={recommendContext}
            onChange={(e) => { setRecommendContext(e.target.value); setExcludedIds([]); setRecommendation(null) }}
          />
          <Button
            onClick={() => handleRecommend(excludedIds)}
            disabled={recommendLoading || !recommendContext || books.length === 0}
            className="w-full"
          >
            {recommendLoading ? "Thinking…" : "Recommend something ✦"}
          </Button>
          {recommendation && !recommendation.error && (
            <div className="pt-2 border-t space-y-2">
              <p className="font-semibold">
                {recommendation.title}{" "}
                <span className="font-normal text-muted-foreground">
                  by {recommendation.author}
                </span>
              </p>
              {(() => {
                const tropes = books.find((b) => b.id === recommendation.book_id)?.tropes
                return tropes?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {tropes.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                ) : null
              })()}
              <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
              <div className="flex gap-2 pt-1">
                <Button onClick={handleLetsReadThat} className="flex-1">
                  Let's read that!
                </Button>
                <Button onClick={handleSuggestAnother} variant="outline" className="flex-1" disabled={recommendLoading}>
                  Suggest another
                </Button>
              </div>
            </div>
          )}
          {recommendation?.error && (
            <p className="text-sm text-destructive">{recommendation.error}</p>
          )}
        </CardContent>
      </Card>

      {/* Currently reading */}
      {currentlyReading.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Currently reading</h2>
          {currentlyReading.map((book) => (
            <Card key={book.id}>
              <CardContent className="pt-4">
                {editingId === book.id ? renderEditForm(book.id) : (
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium leading-snug">{book.title}</p>
                      <p className="text-sm text-muted-foreground">{book.author}</p>
                      {(book.genre || book.page_count) && (
                        <p className="text-xs text-muted-foreground">
                          {[book.genre, book.page_count ? `${book.page_count} pages` : null, book.format].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {book.tropes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {book.tropes.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                        </div>
                      )}
                      {book.description && (
                        <p className="text-xs text-muted-foreground pt-1 line-clamp-2">{book.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button size="sm" onClick={() => handleMarkRead(book.id)}>Finished</Button>
                      <Button size="sm" variant="outline" onClick={() => handleMoveToWantToRead(book.id)}>Not now</Button>
                      <Button size="sm" variant="outline" onClick={() => handleEditStart(book)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(book.id)}>Delete</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Library */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setLibrarySectionOpen((o) => !o)}
            className="flex items-center gap-2 text-lg font-semibold hover:text-muted-foreground transition-colors text-left"
          >
            {librarySectionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Library{" "}
            <span className="text-muted-foreground font-normal text-base">
              ({wantToRead.length} books)
            </span>
          </button>
          {librarySectionOpen && (
            <div className="flex gap-1">
              {["none", "genre", "format"].map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={groupBy === option ? "default" : "outline"}
                  onClick={() => setGroupBy(option)}
                  className="text-xs capitalize"
                >
                  {option === "none" ? "All" : option}
                </Button>
              ))}
            </div>
          )}
        </div>

        {librarySectionOpen && (
        <>
        <Input
          placeholder="Search by title or author…"
          value={librarySearch}
          onChange={(e) => setLibrarySearch(e.target.value)}
        />

        {wantToRead.length === 0 ? (
          <p className="text-muted-foreground text-sm">No books yet — add one above.</p>
        ) : filteredWantToRead.length === 0 ? (
          <p className="text-muted-foreground text-sm">No books match your search.</p>
        ) : (
          Object.entries(getGroupedBooks(filteredWantToRead)).map(([groupName, groupBooks]) => (
            <div key={groupName} className="space-y-2">
              {groupBy !== "none" && (
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
                  {groupName}
                </p>
              )}
              {groupBooks.map((book) => (
                <Card key={book.id}>
                  <CardContent className="pt-4">
                    {editingId === book.id ? renderEditForm(book.id) : (
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium leading-snug">{book.title}</p>
                          <p className="text-sm text-muted-foreground">{book.author}</p>
                          {(book.genre || book.page_count) && (
                            <p className="text-xs text-muted-foreground">
                              {[book.genre, book.page_count ? `${book.page_count} pages` : null, book.format].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {book.tropes?.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {book.tropes.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                            </div>
                          )}
                          {book.description && (
                            <p className="text-xs text-muted-foreground pt-1 line-clamp-2">{book.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => handleEditStart(book)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => handleMarkRead(book.id)}>Read</Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(book.id)}>Delete</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ))
        )}

        </>
        )}

        {/* Already read — collapsible */}
        {allRead.length > 0 && (
          <div className="pt-4 border-t">
            <button
              onClick={() => setReadSectionOpen((o) => !o)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            >
              {readSectionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Already read ({allRead.length})
            </button>
            {readSectionOpen && (
              <div className="space-y-2 mt-3">
                <Input
                  placeholder="Search by title or author…"
                  value={readSearch}
                  onChange={(e) => setReadSearch(e.target.value)}
                />
                {filteredRead.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No books match your search.</p>
                ) : (
                  filteredRead.map((book) => (
                    <Card key={book.id}>
                      <CardContent className="pt-4">
                        {editingId === book.id ? renderEditForm(book.id) : (
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-medium leading-snug">{book.title}</p>
                              <p className="text-sm text-muted-foreground">{book.author}</p>
                              {book.genre && <p className="text-xs text-muted-foreground">{book.genre}</p>}
                              {book.rating && (
                                <p className="text-sm text-yellow-400 leading-none">
                                  {"★".repeat(book.rating)}
                                  <span className="text-muted-foreground">{"★".repeat(5 - book.rating)}</span>
                                </p>
                              )}
                              {book.notes && (
                                <p className="text-xs text-muted-foreground line-clamp-2 pt-0.5">{book.notes}</p>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <Button variant="outline" size="sm" onClick={() => handleMoveToWantToRead(book.id)}>Re-read</Button>
                              <Button variant="outline" size="sm" onClick={() => handleEditStart(book)}>Edit</Button>
                              <Button variant="outline" size="sm" onClick={() => handleDelete(book.id)}>Delete</Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
