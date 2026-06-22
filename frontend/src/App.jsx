import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ChevronDown, ChevronUp, Plus, Trash2, Pencil, BookCheck, RotateCcw } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000"

export default function App() {
  const [books, setBooks] = useState([])

  // Add book modal
  const [addBookOpen, setAddBookOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [genre, setGenre] = useState("")
  const [tropes, setTropes] = useState("")
  const [mood, setMood] = useState("")
  const [pageCount, setPageCount] = useState("")
  const [description, setDescription] = useState("")
  const [format, setFormat] = useState("physical")
  const [coverUrl, setCoverUrl] = useState(null)
  const [metadataVisible, setMetadataVisible] = useState(false)

  // AI states
  const [autofillLoading, setAutofillLoading] = useState(false)
  const [recommendContext, setRecommendContext] = useState("")
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [recommendation, setRecommendation] = useState(null)
  const [streamingReason, setStreamingReason] = useState("")
  const [excludedIds, setExcludedIds] = useState([])
  const [groupBy, setGroupBy] = useState("none")
  const [libraryDisplayCount, setLibraryDisplayCount] = useState(4)
  const [readSectionOpen, setReadSectionOpen] = useState(false)

  // Edit state
  const [viewingBook, setViewingBook] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Search state
  const [librarySearch, setLibrarySearch] = useState("")
  const [readSearch, setReadSearch] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

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
      setCoverUrl(data.cover_url || null)
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
        cover_url: coverUrl,
      }),
    })
    setTitle(""); setAuthor(""); setGenre(""); setTropes("")
    setMood(""); setPageCount(""); setDescription(""); setFormat("physical")
    setCoverUrl(null)
    setMetadataVisible(false)
    setAddBookOpen(false)
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
    setStreamingReason("")
    try {
      const res = await fetch(`${API_URL}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: recommendContext, exclude_ids: excluded }),
      })
      const pick = await res.json()
      if (pick.error) { setRecommendation(pick); return }

      setRecommendation(pick)
      setRecommendLoading(false)

      const bookDetails = books.find((b) => b.id === pick.book_id)
      const reasonRes = await fetch(`${API_URL}/recommend-reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pick.title,
          author: pick.author,
          genre: bookDetails?.genre || "",
          tropes: bookDetails?.tropes || [],
          mood: bookDetails?.mood || [],
          context: recommendContext,
        }),
      })

      const reader = reasonRes.body.getReader()
      const decoder = new TextDecoder()
      let reason = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reason += decoder.decode(value, { stream: true })
        setStreamingReason(reason)
      }
    } finally {
      setRecommendLoading(false)
    }
  }

  async function handleSuggestAnother() {
    const newExcluded = [...excludedIds, recommendation.book_id]
    setExcludedIds(newExcluded)
    setStreamingReason("")
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
          : "Physical"
      if (!acc[key]) acc[key] = []
      acc[key].push(book)
      return acc
    }, {})
  }

  function renderEditForm(bookId) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Title</p>
            <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Author</p>
            <Input value={editForm.author} onChange={(e) => setEditForm({ ...editForm, author: e.target.value })} />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Genre</p>
          <Input value={editForm.genre} onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Tropes</p>
          <Input placeholder="comma-separated" value={editForm.tropes} onChange={(e) => setEditForm({ ...editForm, tropes: e.target.value })} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Mood</p>
          <Input placeholder="comma-separated" value={editForm.mood} onChange={(e) => setEditForm({ ...editForm, mood: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Page count</p>
            <Input type="number" className="w-32" value={editForm.page_count} onChange={(e) => setEditForm({ ...editForm, page_count: e.target.value })} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Format</p>
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
          <p className="text-xs font-medium text-muted-foreground mb-2">Description</p>
          <Textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Rating</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setEditForm({ ...editForm, rating: editForm.rating === star ? null : star })}
                className={`text-xl leading-none ${star <= (editForm.rating || 0) ? "text-yellow-500" : "text-muted-foreground"}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Notes</p>
          <Textarea rows={2} placeholder="Your thoughts on this book…" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={() => handleEditSave(bookId)} className="flex-1">Save</Button>
          <Button size="sm" variant="outline" onClick={handleEditCancel} className="flex-1">Cancel</Button>
        </div>
      </div>
    )
  }

  function BookCover({ url, title }) {
    if (url) {
      return (
        <img
          src={url}
          alt={`${title} cover`}
          className="w-24 rounded object-cover shrink-0 self-start shadow-sm"
          style={{ aspectRatio: "2/3" }}
        />
      )
    }
    return (
      <div
        className="w-24 rounded bg-muted shrink-0 self-start flex items-center justify-center"
        style={{ aspectRatio: "2/3" }}
      >
        <span className="text-muted-foreground text-xl">📖</span>
      </div>
    )
  }

  function BookDetailDialog() {
    if (!viewingBook) return null
    const b = viewingBook
    return (
      <Dialog open={!!viewingBook} onOpenChange={(open) => { if (!open) setViewingBook(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">{b.title}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[75vh] space-y-6">
          <div className="flex gap-4 pt-2">
            {b.cover_url ? (
              <img src={b.cover_url} alt="" className="w-28 rounded object-cover shrink-0 shadow-sm" style={{ aspectRatio: "2/3" }} />
            ) : (
              <div className="w-28 rounded bg-muted shrink-0 flex items-center justify-center" style={{ aspectRatio: "2/3" }}>
                <span className="text-3xl">📖</span>
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-2 pt-2">
              <h2 className="font-heading font-bold text-xl leading-snug">{b.title}</h2>
              <p className="text-muted-foreground text-sm">by {b.author}</p>
              <p className="text-xs text-muted-foreground">
                {[b.genre, b.page_count ? `${b.page_count} pages` : null, b.format === "ebook" ? "E-book" : b.format === "physical" ? "Physical" : null].filter(Boolean).join(" · ")}
              </p>
              {b.rating && (
                <p className="text-base text-yellow-500 leading-none pt-1">
                  {"★".repeat(b.rating)}
                  <span className="text-muted-foreground opacity-40">{"★".repeat(5 - b.rating)}</span>
                </p>
              )}
            </div>
          </div>
          <div className="space-y-6 pt-4">
            {b.tropes?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tropes</p>
                <div className="flex flex-wrap gap-1">
                  {b.tropes.map((t) => <Badge key={t} variant="secondary" className="text-xs border-0" style={{ background: "linear-gradient(135deg, #F2B6B6, #F2A0C6)" }}>{t}</Badge>)}
                </div>
              </div>
            )}
            {b.mood?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Mood</p>
                <div className="flex flex-wrap gap-1">
                  {b.mood.map((m) => <Badge key={m} variant="outline" className="text-xs">{m}</Badge>)}
                </div>
              </div>
            )}
            {b.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Description</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
              </div>
            )}
            {b.notes && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.notes}</p>
              </div>
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  function DeleteConfirmDialog() {
    const book = books.find((b) => b.id === confirmDeleteId)
    if (!book) return null
    return (
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this book?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">{book.title}</span> will be permanently removed from your library.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} className="flex-1">Cancel</Button>
            <Button
              onClick={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null) }}
              className="flex-1 bg-destructive text-white hover:bg-destructive/80"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const currentlyReading = books.filter((b) => b.read_status === "reading")
  const wantToRead = books.filter((b) => b.read_status === "want_to_read")
  const allRead = books.filter((b) => b.read_status === "read")
  const searchMatch = (b, q) => {
    const s = q.toLowerCase()
    return b.title.toLowerCase().includes(s) ||
      b.author.toLowerCase().includes(s) ||
      (b.genre && b.genre.toLowerCase().includes(s))
  }
  const filteredWantToRead = librarySearch ? wantToRead.filter((b) => searchMatch(b, librarySearch)) : wantToRead
  const filteredRead = readSearch ? allRead.filter((b) => searchMatch(b, readSearch)) : allRead

  return (
    <div className="max-w-4xl mx-auto px-8 py-12 space-y-12">
      <BookDetailDialog />
      <DeleteConfirmDialog />

      {/* Header */}
      <div className="border-b pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-5xl font-heading font-bold tracking-tight">Shelf'd</h1>
          <p className="text-muted-foreground mt-2 text-2xl italic font-heading">Where your TBR finally meets its match.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="shadow-sm rounded-lg px-3 py-1.5 text-sm font-medium" style={{ background: "linear-gradient(135deg, #F2B6B6, #F2A0C6)" }}>
              {books.length} books
            </div>
            <div className="shadow-sm rounded-lg px-3 py-1.5 text-sm font-medium" style={{ background: "linear-gradient(135deg, #F2B6B6, #F2A0C6)" }}>
              {wantToRead.length} to read
            </div>
            {currentlyReading.length > 0 && (
              <div className="shadow-sm rounded-lg px-3 py-1.5 text-sm font-medium" style={{ background: "linear-gradient(135deg, #F2B6B6, #F2A0C6)" }}>
                {currentlyReading.length} in progress
              </div>
            )}
          </div>
        </div>
        <Dialog open={addBookOpen} onOpenChange={(open) => {
          setAddBookOpen(open)
          if (!open) {
            setTitle(""); setAuthor(""); setGenre(""); setTropes("")
            setMood(""); setPageCount(""); setDescription(""); setFormat("physical")
            setCoverUrl(null)
            setMetadataVisible(false)
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <Plus size={15} />
              Add a book
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl">Add a book</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[75vh]">
            <form onSubmit={handleAddBook} className="space-y-4 pt-2">
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
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleAutofill}
                disabled={autofillLoading || !title || !author}
                className="w-full"
              >
                {autofillLoading ? "Filling…" : "Autofill with AI ✦"}
              </Button>

              {metadataVisible && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Genre</p>
                    <Input value={genre} onChange={(e) => setGenre(e.target.value)} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Tropes</p>
                    <Input placeholder="comma-separated" value={tropes} onChange={(e) => setTropes(e.target.value)} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Mood</p>
                    <Input placeholder="comma-separated" value={mood} onChange={(e) => setMood(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Page count</p>
                      <Input
                        value={pageCount}
                        onChange={(e) => setPageCount(e.target.value)}
                        type="number"
                        className="w-32"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Format</p>
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
                    <p className="text-xs font-medium text-muted-foreground mb-2">Description</p>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full">
                Add to library
              </Button>
            </form>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Recommendation panel */}
      <div className="border rounded-xl p-8 space-y-6" style={{ background: "linear-gradient(160deg, #EEE7D2 0%, #D9B0CA 100%)", borderColor: "#D9B0CA" }}>
        <h2 className="text-xl font-heading font-semibold">What should I read next?</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="e.g. I'm travelling and want something light and fun"
            value={recommendContext}
            onChange={(e) => {
              setRecommendContext(e.target.value)
              setExcludedIds([])
              setRecommendation(null)
            }}
            className="h-10 bg-white"
          />
          <Button
            onClick={() => handleRecommend(excludedIds)}
            disabled={recommendLoading || !recommendContext || books.length === 0}
            className="sm:shrink-0 w-full sm:w-auto"
          >
            {recommendLoading ? "Thinking…" : "Recommend ✦"}
          </Button>
        </div>
        <AnimatePresence>
        {recommendation && !recommendation.error && (
          <motion.div key="rec-result" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }} className="pt-4 border-t space-y-4">
            <div>
              <p className="font-heading font-semibold text-lg leading-snug">{recommendation.title}</p>
              <p className="text-sm">by {recommendation.author}</p>
            </div>
            {(() => {
              const bookTropes = books.find((b) => b.id === recommendation.book_id)?.tropes
              return bookTropes?.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {bookTropes.map((t) => (
                    <Badge key={t} variant="secondary" className="bg-white shadow-sm text-foreground text-xs">{t}</Badge>
                  ))}
                </div>
              ) : null
            })()}
            <p className="text-sm leading-relaxed">
              {streamingReason || "Finding out why…"}
            </p>
            <div className="flex gap-2">
              <Button onClick={handleLetsReadThat} className="flex-[4] gap-1.5">
                <BookCheck size={15} />Let's read that!
              </Button>
              <Button onClick={handleSuggestAnother} variant="outline" className="flex-1" disabled={recommendLoading}>
                Suggest another
              </Button>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
        {recommendation?.error && (
          <p className="text-sm text-destructive">{recommendation.error}</p>
        )}
      </div>

      {/* Currently reading */}
      {currentlyReading.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-heading font-semibold">Currently reading</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence>
            {currentlyReading.map((book) => (
              <motion.div key={book.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
              <Card className="shadow-sm flex flex-col relative h-full">
                {editingId !== book.id && (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(book.id) }} className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer z-10"><Trash2 size={14} /></button>
                )}
                <CardContent className="py-4 flex flex-col flex-1">
                  {editingId === book.id ? renderEditForm(book.id) : (
                    <>
                      <div className="flex gap-4 flex-1 cursor-pointer" onClick={() => setViewingBook(book)}>
                        <BookCover url={book.cover_url} title={book.title} />
                        <div className="flex-1 space-y-2 min-w-0">
                          <p className="font-semibold leading-snug">{book.title}</p>
                          <p className="text-sm text-muted-foreground">{book.author}</p>
                          {book.genre && (
                            <p className="text-xs text-muted-foreground">{book.genre}</p>
                          )}
                          {book.tropes?.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              {book.tropes.slice(0, 3).map((t) => (
                                <Badge key={t} variant="secondary" className="text-xs border-0" style={{ background: "linear-gradient(135deg, #F2B6B6, #F2A0C6)" }}>{t}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button onClick={() => handleMarkRead(book.id)} className="flex-[4] gap-1.5"><BookCheck size={15} />Finished</Button>
                        <Button variant="outline" onClick={() => handleMoveToWantToRead(book.id)} className="flex-1">Not now</Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Library */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold">
            Library
            <span className="text-muted-foreground font-normal text-base font-sans ml-2">
              ({wantToRead.length})
            </span>
          </h2>
          <div className="flex gap-3">
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
        </div>

        <Input
          placeholder="Search by title, author or genre…"
          value={librarySearch}
          onChange={(e) => { setLibrarySearch(e.target.value); setLibraryDisplayCount(4) }}
          className="bg-white h-10"
        />
        {wantToRead.length === 0 ? (
          <p className="text-muted-foreground text-sm">No books yet — add one above.</p>
        ) : filteredWantToRead.length === 0 ? (
          <p className="text-muted-foreground text-sm">No books match your search.</p>
        ) : (
          <>
            {Object.entries(getGroupedBooks(
              groupBy === "none" ? filteredWantToRead.slice(0, libraryDisplayCount) : filteredWantToRead
            )).map(([groupName, groupBooks]) => (
              <div key={groupName} className="space-y-4">
                {groupBy !== "none" && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-1">
                    {groupName}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AnimatePresence>
                  {groupBooks.map((book) => (
                    <motion.div key={book.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
                    <Card className="shadow-sm flex flex-col relative h-full">
                      {editingId !== book.id && (
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(book.id) }} className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer z-10"><Trash2 size={14} /></button>
                      )}
                      <CardContent className="py-4 flex flex-col flex-1">
                        {editingId === book.id ? renderEditForm(book.id) : (
                          <>
                            <div className="flex gap-4 flex-1 cursor-pointer" onClick={() => setViewingBook(book)}>
                              <BookCover url={book.cover_url} title={book.title} />
                              <div className="flex-1 space-y-2 min-w-0">
                                <p className="font-semibold leading-snug">{book.title}</p>
                                <p className="text-sm text-muted-foreground">{book.author}</p>
                                {(book.genre || book.page_count) && (
                                  <p className="text-xs text-muted-foreground">
                                    {[book.genre, book.page_count ? `${book.page_count}p` : null, book.format === "ebook" ? "E-book" : "Physical"].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                                {book.tropes?.length > 0 && (
                                  <div className="flex flex-wrap gap-2 pt-2">
                                    {book.tropes.slice(0, 3).map((t) => (
                                      <Badge key={t} variant="secondary" className="text-xs border-0" style={{ background: "linear-gradient(135deg, #F2B6B6, #F2A0C6)" }}>{t}</Badge>
                                    ))}
                                  </div>
                                )}
                                {book.description && (
                                  <p className="text-xs text-muted-foreground pt-2 line-clamp-2">{book.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 pt-4">
                              <Button onClick={() => handleMarkRead(book.id)} className="flex-[4] gap-1.5"><BookCheck size={15} />Mark read</Button>
                              <Button variant="outline" onClick={() => handleEditStart(book)} className="flex-1 gap-1.5"><Pencil size={13} />Edit</Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
            {groupBy === "none" && filteredWantToRead.length > libraryDisplayCount && (
              <Button
                variant="outline"
                className="w-full text-sm bg-white"
                onClick={() => setLibraryDisplayCount((n) => n + 4)}
              >
                Show {Math.min(4, filteredWantToRead.length - libraryDisplayCount)} more books
              </Button>
            )}
          </>
        )}

        {/* Already read */}
        {allRead.length > 0 && (
          <div className="pt-8 border-t">
            <button
              onClick={() => setReadSectionOpen((o) => !o)}
              className="flex items-center justify-between w-full text-left"
            >
              <h2 className="text-lg font-heading font-semibold">
                Already read
                <span className="text-muted-foreground font-normal text-base font-sans ml-2">
                  ({allRead.length})
                </span>
              </h2>
              {readSectionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {readSectionOpen && (
              <div className="space-y-4 mt-4">
                <Input
                  placeholder="Search by title, author or genre…"
                  value={readSearch}
                  onChange={(e) => setReadSearch(e.target.value)}
                  className="bg-white h-10"
                />
                {filteredRead.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No books match your search.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AnimatePresence>
                    {filteredRead.map((book) => (
                      <motion.div key={book.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
                      <Card className="shadow-sm flex flex-col relative h-full">
                        {editingId !== book.id && (
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(book.id) }} className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer z-10"><Trash2 size={14} /></button>
                        )}
                        <CardContent className="py-4 flex flex-col flex-1">
                          {editingId === book.id ? renderEditForm(book.id) : (
                            <>
                              <div className="flex gap-4 flex-1 cursor-pointer" onClick={() => setViewingBook(book)}>
                                <BookCover url={book.cover_url} title={book.title} />
                                <div className="flex-1 space-y-2 min-w-0">
                                  <p className="font-semibold leading-snug">{book.title}</p>
                                  <p className="text-sm text-muted-foreground">{book.author}</p>
                                  {book.genre && <p className="text-xs text-muted-foreground">{book.genre}</p>}
                                  {book.rating && (
                                    <p className="text-sm text-yellow-500 leading-none pt-1">
                                      {"★".repeat(book.rating)}
                                      <span className="text-muted-foreground opacity-40">{"★".repeat(5 - book.rating)}</span>
                                    </p>
                                  )}
                                  {book.notes && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 pt-1">{book.notes}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 pt-4">
                                <Button variant="secondary" onClick={() => handleEditStart(book)} className="flex-[4] gap-1.5 shadow-sm"><Pencil size={13} />Edit</Button>
                                <Button variant="outline" onClick={() => handleMoveToWantToRead(book.id)} className="flex-1 gap-1.5"><RotateCcw size={14} />Re-read</Button>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                      </motion.div>
                    ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
