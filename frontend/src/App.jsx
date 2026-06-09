import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

  async function handleRecommend() {
    if (!recommendContext) return
    setRecommendLoading(true)
    setRecommendation(null)
    try {
      const res = await fetch(`${API_URL}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: recommendContext }),
      })
      const data = await res.json()
      setRecommendation(data)
    } finally {
      setRecommendLoading(false)
    }
  }

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
              <div className="space-y-2 pt-2 border-t">
                <Input
                  placeholder="Genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                />
                <Input
                  placeholder="Tropes (comma-separated)"
                  value={tropes}
                  onChange={(e) => setTropes(e.target.value)}
                />
                <Input
                  placeholder="Mood (comma-separated)"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Page count"
                    value={pageCount}
                    onChange={(e) => setPageCount(e.target.value)}
                    type="number"
                    className="w-32"
                  />
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-background"
                  >
                    <option value="physical">Physical</option>
                    <option value="ebook">E-book</option>
                  </select>
                </div>
                <Textarea
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
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
            onChange={(e) => setRecommendContext(e.target.value)}
          />
          <Button
            onClick={handleRecommend}
            disabled={recommendLoading || !recommendContext || books.length === 0}
            className="w-full"
          >
            {recommendLoading ? "Thinking…" : "Recommend something ✦"}
          </Button>
          {recommendation && !recommendation.error && (
            <div className="pt-2 border-t space-y-1">
              <p className="font-semibold">
                {recommendation.title}{" "}
                <span className="font-normal text-muted-foreground">
                  by {recommendation.author}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
            </div>
          )}
          {recommendation?.error && (
            <p className="text-sm text-destructive">{recommendation.error}</p>
          )}
        </CardContent>
      </Card>

      {/* Library */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Library{" "}
          <span className="text-muted-foreground font-normal text-base">
            ({books.length} books)
          </span>
        </h2>

        {books.length === 0 ? (
          <p className="text-muted-foreground text-sm">No books yet — add one above.</p>
        ) : (
          books.map((book) => (
            <Card key={book.id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium leading-snug">{book.title}</p>
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                    {(book.genre || book.page_count) && (
                      <p className="text-xs text-muted-foreground">
                        {[
                          book.genre,
                          book.page_count ? `${book.page_count} pages` : null,
                          book.format,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {book.tropes?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {book.tropes.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {book.description && (
                      <p className="text-xs text-muted-foreground pt-1 line-clamp-2">
                        {book.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(book.id)}
                    className="shrink-0"
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
