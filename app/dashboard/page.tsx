'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

type Profile = {
  business_name: string
  industry: string
  suburb: string
  tone: string | null
  target_audience: string | null
  core_services: string | null
  custom_guidance: string | null
}

type Tab = 'overview' | 'ideas' | 'myideas' | 'filming' | 'calendar' | 'uploads'

type Idea = {
  id: string
  title: string
  hook: string
  description: string
  tags: string
  notes?: string
}

type FilmingItem = Idea & { checklist: string[] }

const FONT_OPTIONS = ['Montserrat ExtraBold', 'Inter', 'Roboto', 'Poppins', 'Oswald']

const CAPTION_PRESETS = [
  { id: 'word_by_word', label: 'Word by Word', desc: 'One word pops as it is spoken (karaoke)' },
  { id: 'bold_center', label: 'Bold Pop', desc: 'Large, punchy, scales on each word' },
  { id: 'minimal_bottom', label: 'Minimal', desc: 'Subtle fade-in, out of the way' },
  { id: 'coral_pop', label: 'Coral Bounce', desc: 'On-brand coral, bouncy' },
  { id: 'typewriter', label: 'Typewriter', desc: 'Words build up in sequence' },
]

export default function DashboardPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [filmingItems, setFilmingItems] = useState<FilmingItem[]>([])
  const [generatingFilming, setGeneratingFilming] = useState(false)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [dbSavedIdeas, setDbSavedIdeas] = useState<Idea[]>([])
  const [currentBatch, setCurrentBatch] = useState(0)
  const [previousBatch, setPreviousBatch] = useState<{ ideas: Idea[]; batchNumber: number } | null>(null)
  const [redoBatch, setRedoBatch] = useState<{ ideas: Idea[]; batchNumber: number } | null>(null)
  const [generatingIdeas, setGeneratingIdeas] = useState(false)
  const [ideaError, setIdeaError] = useState('')
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number } | null>(null)
  const [userPlan, setUserPlan] = useState<'basic' | 'mid'>('mid')
  const [refiningId, setRefiningId] = useState<string | null>(null)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [refineLoading, setRefineLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [renderId, setRenderId] = useState<string | null>(null)
  const [renderStatus, setRenderStatus] = useState<string | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')

  const [captionPreset, setCaptionPreset] = useState('bold_center')
  const [showAdvancedCaptions, setShowAdvancedCaptions] = useState(false)
  const [captionFontSize, setCaptionFontSize] = useState(36)
  const [captionFontFamily, setCaptionFontFamily] = useState('Montserrat ExtraBold')
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [speechClipIndex, setSpeechClipIndex] = useState<number | null>(0)
  const [lastRenderedPaths, setLastRenderedPaths] = useState<string[]>([])
  const [lastMusicPath, setLastMusicPath] = useState<string | null>(null)
  const musicInputRef = useRef<HTMLInputElement>(null)
  const [captionColor, setCaptionColor] = useState('#FFFFFF')
  const [captionBgColor, setCaptionBgColor] = useState('#000000')
  const [captionPosition, setCaptionPosition] = useState<'bottom' | 'top' | 'center'>('bottom')

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getUser()
      const user = sessionData.user

      if (!user) {
        const hasLoggedInBefore = localStorage.getItem('reelly-has-logged-in')
        router.push(hasLoggedInBefore ? '/login' : '/signup')
        return
      }

      setUserId(user.id)

      const { data } = await supabase
        .from('business_profiles')
        .select('business_name, industry, suburb, tone, target_audience, core_services, custom_guidance')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!data) {
        router.push('/onboarding')
        return
      }

      const { data: allIdeas } = await supabase
        .from("generated_ideas")
        .select("*")
        .eq("user_id", user.id)
        .order("batch_number", { ascending: false })

      if (allIdeas && allIdeas.length > 0) {
        const toIdea = (row: Record<string, unknown>): Idea => ({
          id: row.id as string,
          title: row.title as string,
          hook: row.hook as string,
          description: row.description as string,
          tags: row.tags as string,
          notes: (row.notes as string) || undefined,
        })

        const maxBatch = Math.max(...allIdeas.map((r) => r.batch_number as number))
        const currentRows = allIdeas.filter((r) => r.batch_number === maxBatch)
        const prevBatchNum = Math.max(...allIdeas.filter((r) => r.batch_number < maxBatch).map((r) => r.batch_number as number), -1)
        const prevRows = prevBatchNum >= 0 ? allIdeas.filter((r) => r.batch_number === prevBatchNum) : []
        const savedRows = allIdeas.filter((r) => r.saved)

        setIdeas(currentRows.map(toIdea))
        setCurrentBatch(maxBatch)
        if (prevRows.length > 0) setPreviousBatch({ ideas: prevRows.map(toIdea), batchNumber: prevBatchNum })
        setDbSavedIdeas(savedRows.map(toIdea))
        setSavedIds(new Set(savedRows.map((r) => r.id as string)))

        const filmingRows = savedRows.filter((r) => r.checklist)
        if (filmingRows.length > 0) {
          setFilmingItems(filmingRows.map((r) => ({ ...toIdea(r), checklist: r.checklist as string[] })))
        }
      }
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (!renderId || renderStatus === 'done' || renderStatus === 'failed') return

    const interval = setInterval(async () => {
      const res = await fetch('/api/render-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renderId }),
      })
      const data = await res.json()
      setRenderStatus(data.status)
      if (data.outputUrl) setOutputUrl(data.outputUrl)
    }, 4000)

    return () => clearInterval(interval)
  }, [renderId, renderStatus])

  const updateIdeaNotes = (id: string, notes: string) => {
    setIdeas((prev) => prev.map((idea) => (idea.id === id ? { ...idea, notes } : idea)))
    supabase.from("generated_ideas").update({ notes }).eq("id", id).then(() => {})
  }

  const refineIdea = async (idea: Idea) => {
    if (!profile || !refineInstruction.trim()) return
    setRefineLoading(true)
    try {
      const res = await fetch("/api/refine-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, instruction: refineInstruction, profile, userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to refine idea")

      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, ...data.idea } : i)))
      setRefiningId(null)
      setRefineInstruction("")
    } catch (err) {
      setIdeaError(err instanceof Error ? err.message : "Failed to refine idea")
    } finally {
      setRefineLoading(false)
    }
  }
  const toggleSave = (id: string) => {
    const idea = ideas.find((i) => i.id === id) || dbSavedIdeas.find((i) => i.id === id)
    const willBeSaved = !savedIds.has(id)

    setSavedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

    if (idea) {
      if (willBeSaved) {
        setDbSavedIdeas((prev) => [...prev, idea])
      } else {
        setDbSavedIdeas((prev) => prev.filter((i) => i.id !== id))
      }
    }

    supabase.from("generated_ideas").update({ saved: willBeSaved }).eq("id", id).then(() => {})
  }
  const generateIdeas = async () => {
    if (!profile || !userId) return
    setGeneratingIdeas(true)
    setIdeaError("")

    try {
      const res = await fetch("/api/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, customization: profile.custom_guidance, userId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")

      const nextBatch = currentBatch + 1
      const rowsToInsert = data.ideas.map((idea: Omit<Idea, "id">) => ({
        user_id: userId,
        title: idea.title,
        hook: idea.hook,
        description: idea.description,
        tags: idea.tags,
        batch_number: nextBatch,
        saved: false,
      }))

      const { data: inserted, error: insertError } = await supabase
        .from("generated_ideas")
        .insert(rowsToInsert)
        .select()

      if (insertError || !inserted) throw new Error("Failed to save generated ideas")

      const newIdeas: Idea[] = inserted.map((row) => ({
        id: row.id,
        title: row.title,
        hook: row.hook,
        description: row.description,
        tags: row.tags,
      }))

      if (ideas.length > 0) {
        setPreviousBatch({ ideas, batchNumber: currentBatch })
      }
      setRedoBatch(null)

      // Clean up old unsaved batches beyond one level of undo history
      if (currentBatch > 1) {
        await supabase
          .from("generated_ideas")
          .delete()
          .eq("user_id", userId)
          .lt("batch_number", currentBatch)
          .eq("saved", false)
      }

      setIdeas(newIdeas)
      setCurrentBatch(nextBatch)
      setUserPlan(data.plan || "mid")
      if (data.usage) setUsageInfo(data.usage)
    } catch (err) {
      setIdeaError(err instanceof Error ? err.message : "Something went wrong generating ideas. Please try again.")
    } finally {
      setGeneratingIdeas(false)
    }
  }

  const undoIdeas = () => {
    if (!previousBatch) return
    setRedoBatch({ ideas, batchNumber: currentBatch })
    setIdeas(previousBatch.ideas)
    setCurrentBatch(previousBatch.batchNumber)
    setPreviousBatch(null)
  }

  const redoIdeas = () => {
    if (!redoBatch) return
    setPreviousBatch({ ideas, batchNumber: currentBatch })
    setIdeas(redoBatch.ideas)
    setCurrentBatch(redoBatch.batchNumber)
    setRedoBatch(null)
  }

  const proceedToFilming = async (ideasToGenerate: Idea[]) => {
    if (!profile) return
    setGeneratingFilming(true)
    setTab('filming')

    try {
      const res = await fetch('/api/generate-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideas: ideasToGenerate, profile, customization: profile.custom_guidance, userId }),
      })

      if (!res.ok) throw new Error('Request failed')

      const data = await res.json()
      const merged: FilmingItem[] = ideasToGenerate.map((idea, i) => ({
        ...idea,
        checklist: data.checklists[i]?.checklist || [],
      }))
      setFilmingItems(merged)
    } catch {
      setFilmingItems([])
    } finally {
      setGeneratingFilming(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files))
      setSpeechClipIndex(0)
      setUploadError('')
    }
  }

  const startUploadAndRender = async () => {
    if (!userId || selectedFiles.length === 0) return
    setUploading(true)
    setUploadError('')
    setRenderId(null)
    setRenderStatus(null)
    setOutputUrl(null)

    try {
      const clipPaths: string[] = []

      for (const file of selectedFiles) {
        const path = `${userId}/${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('video-uploads').upload(path, file)
        if (error) throw new Error(error.message)
        clipPaths.push(path)
      }

      let musicPath: string | null = null
      if (musicFile) {
        const mPath = `${userId}/music-${Date.now()}-${musicFile.name}`
        const { error: musicError } = await supabase.storage.from('video-uploads').upload(mPath, musicFile)
        if (!musicError) musicPath = mPath
      }

      const captionStyle = showAdvancedCaptions
        ? {
            preset: captionPreset,
            custom: {
              font: { family: captionFontFamily, size: captionFontSize, color: captionColor },
              position: captionPosition,
            },
          }
        : captionPreset

      const res = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, clipPaths, captionStyle, musicPath, speechClipIndex }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Render failed to start')

      setRenderId(data.renderId)
      setRenderStatus('queued')
      setLastRenderedPaths(clipPaths)
      setLastMusicPath(musicPath)
      setSelectedFiles([])
      setMusicFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'ideas', label: 'Content Ideas' },
    { id: 'myideas', label: 'My Ideas' },
    { id: 'filming', label: 'Filming' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'uploads', label: 'Uploads' },
  ]

  const stats = [
    { label: 'Ideas generated', value: String(ideas.length) },
    { label: 'Posts this week', value: '0' },
    { label: 'Render minutes used', value: '0 / 2' },
  ]

  const savedIdeas = dbSavedIdeas

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' as const, color: 'var(--ink)' }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5, display: 'block' as const }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 56 }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600 }}>
            Reelly
          </span>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
          >
            Log out
          </button>
        </nav>

        <div style={{ padding: '0 48px 100px' }}>
          <div style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 24, padding: '40px 36px', marginBottom: 28 }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 600, color: '#F1EFE8', marginBottom: 4 }}>
              Welcome back, {profile?.business_name}
            </h1>
            <p style={{ fontSize: 14, color: '#D3D1C7', marginBottom: 24 }}>
              {profile?.industry} · {profile?.suburb}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
              {stats.map((s) => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
                  <p style={{ fontSize: 20, fontWeight: 600, fontFamily: "'Outfit', sans-serif", color: '#F1EFE8' }}>{s.value}</p>
                  <p style={{ fontSize: 12, color: '#D3D1C7' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(128,128,128,0.15)', marginBottom: 28, flexWrap: 'wrap' }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t.id ? '2px solid var(--coral)' : '2px solid transparent',
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: tab === t.id ? 600 : 500,
                  color: tab === t.id ? 'var(--ink)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {t.label}{t.id === 'myideas' && savedIdeas.length > 0 ? ` (${savedIdeas.length})` : ''}
              </button>
            ))}
            <button
              onClick={() => router.push("/editor")}
              style={{
                background: "none",
                border: "none",
                borderBottom: "2px solid transparent",
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--coral)",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              ✂ Editor
            </button>          </div>

          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px' }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Content ideas
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {ideas.length > 0 ? `You have ${ideas.length} ideas ready to review.` : `Head to Content Ideas to generate ideas for ${profile?.suburb}.`}
                </p>
              </div>
              <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px' }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Upload & edit
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Upload clips and get them stitched with captions and sound in the Uploads tab.
                </p>
              </div>
              <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px' }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Schedule
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Plan and post across Instagram and Facebook. Coming soon.
                </p>
              </div>
            </div>
          )}

          {tab === 'ideas' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Tap the star to save an idea for filming.
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={generateIdeas}
                  disabled={generatingIdeas}
                  style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: generatingIdeas ? 'not-allowed' : 'pointer', opacity: generatingIdeas ? 0.7 : 1 }}
                >
                  {generatingIdeas ? 'Generating...' : ideas.length > 0 ? 'Generate more' : 'Generate ideas'}
                </button>
                  <button
                    onClick={undoIdeas}
                    disabled={!previousBatch}
                    title="Undo: load previous set of ideas"
                    style={{ background: "none", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: previousBatch ? "var(--ink)" : "var(--text-muted)", cursor: previousBatch ? "pointer" : "not-allowed", opacity: previousBatch ? 1 : 0.5 }}
                  >
                    ↶ Undo
                  </button>
                  <button
                    onClick={redoIdeas}
                    disabled={!redoBatch}
                    title="Redo"
                    style={{ background: "none", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: redoBatch ? "var(--ink)" : "var(--text-muted)", cursor: redoBatch ? "pointer" : "not-allowed", opacity: redoBatch ? 1 : 0.5 }}
                  >
                    Redo ↷
                  </button>
                </div>
              {userPlan === 'basic' && usageInfo && (
                <div style={{ background: usageInfo.used >= usageInfo.limit ? 'rgba(216,90,48,0.1)' : 'var(--sand)', border: usageInfo.used >= usageInfo.limit ? '1px solid var(--coral)' : 'none', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {usageInfo.used} of {usageInfo.limit} idea generations used this week (Basic plan)
                  </p>
                  {usageInfo.used >= usageInfo.limit && (
                    <a href="/plans" style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600, textDecoration: 'none' }}>Upgrade to Mid →</a>
                  )}
                </div>
              )}
              </div>

              {ideaError && (
                <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 16 }}>{ideaError}</p>
              )}

              {ideas.length === 0 && !generatingIdeas && (
                <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    Click "Generate ideas" to get content ideas made for {profile?.business_name}.
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                {ideas.map((idea) => (
                  <div key={idea.id} style={{ background: 'var(--sand)', borderRadius: 16, padding: '22px', position: 'relative' }}>
                    <button
                      onClick={() => toggleSave(idea.id)}
                      style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 16,
                        color: savedIds.has(idea.id) ? 'var(--coral)' : 'var(--text-muted)',
                      }}
                    >
                      {savedIds.has(idea.id) ? '★' : '☆'}
                    </button>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 10, paddingRight: 24 }}>
                      {idea.title}
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                      {idea.hook}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 12 }}>
                      {idea.description}
                    </p>                    <p style={{ fontSize: 12, color: 'var(--coral)' }}>{idea.tags}</p>
                    {userPlan === "mid" && (
                      refiningId === idea.id ? (
                        <div style={{ marginTop: 12 }}>
                          <input
                            type="text"
                            value={refineInstruction}
                            onChange={(e) => setRefineInstruction(e.target.value)}
                            placeholder="e.g. make it funnier, shorter, more casual..."
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(128,128,128,0.25)", background: "var(--card-bg)", color: "var(--ink)", fontSize: 12, marginBottom: 8, boxSizing: "border-box" }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => refineIdea(idea)}
                              disabled={refineLoading}
                              style={{ background: "var(--coral)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: refineLoading ? "not-allowed" : "pointer" }}
                            >
                              {refineLoading ? "Refining..." : "Apply"}
                            </button>
                            <button
                              onClick={() => { setRefiningId(null); setRefineInstruction("") }}
                              style={{ background: "none", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 6, padding: "6px 12px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRefiningId(idea.id)}
                          style={{ marginTop: 10, background: "none", border: "1px dashed rgba(128,128,128,0.35)", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer" }}
                        >
                          ✎ Refine this idea
                        </button>
                      )
                    )}                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'myideas' && (
            <div>
              {savedIdeas.length === 0 ? (
                <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    No ideas saved yet. Star an idea in Content Ideas to see it here.
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                    Review your selected ideas, then proceed to generate filming instructions.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                    {savedIdeas.map((idea) => (
                      <div key={idea.id} style={{ background: 'var(--sand)', borderRadius: 16, padding: '22px', position: 'relative' }}>
                        <button
                          onClick={() => toggleSave(idea.id)}
                          style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: 'var(--text-muted)',
                          }}
                        >
                          Remove
                        </button>
                        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 10, paddingRight: 50 }}>
                          {idea.title}
                        </h3>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                          {idea.hook}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 12 }}>
                          {idea.description}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--coral)' }}>{idea.tags}</p>
                        {editingNotesId === idea.id ? (
                          <textarea
                            value={idea.notes || ''}
                            onChange={(e) => updateIdeaNotes(idea.id, e.target.value)}
                            onBlur={() => setEditingNotesId(null)}
                            autoFocus
                            placeholder="Add your own notes or tweaks for this idea..."
                            style={{ width: '100%', marginTop: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "'Inter', sans-serif", minHeight: 70, resize: 'vertical', boxSizing: 'border-box' }}
                          />
                        ) : idea.notes ? (
                          <div onClick={() => setEditingNotesId(idea.id)} style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--card-bg)', cursor: 'pointer' }}>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Your notes (click to edit)</p>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{idea.notes}</p>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingNotesId(idea.id)}
                            style={{ marginTop: 12, background: 'none', border: '1px dashed rgba(128,128,128,0.35)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
                          >
                            + Add notes
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => proceedToFilming(savedIdeas)}
                    style={{ display: 'block', marginTop: 24, backgroundColor: 'var(--coral)', color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                  >
                    Proceed to filming →
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'filming' && (
            <div>
              {generatingFilming && (
                <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Generating filming instructions...</p>
                </div>
              )}
              {!generatingFilming && filmingItems.length === 0 && (
                <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    Select ideas in My Ideas and proceed to generate filming instructions here.
                  </p>
                </div>
              )}
              {!generatingFilming && filmingItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {filmingItems.map((item) => (
                    <div key={item.id} style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px' }}>
                      <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                        {item.title}
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--coral)', marginBottom: 16 }}>{item.tags}</p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {item.checklist.map((step, i) => (
                          <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', gap: 8 }}>
                            <span style={{ color: 'var(--coral)', flexShrink: 0 }}>•</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'calendar' && (
            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Your content calendar will show up here — coming soon.
              </p>
            </div>
          )}

          {tab === 'uploads' && (
            <div>
              <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '32px', marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Upload your clips
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Select the video clips you filmed. Reelly will stitch them together, add captions, trim pauses, and add music.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    backgroundColor: "var(--coral)",
                    color: "#fff",
                    padding: "10px 20px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    marginBottom: 24,
                  }}
                >
                  Choose files
                </button>
                <input
                  ref={musicInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setMusicFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
                <div style={{ marginBottom: 24 }}>
                  <button
                    type="button"
                    onClick={() => musicInputRef.current?.click()}
                    style={{
                      background: "none",
                      border: "1px solid rgba(128,128,128,0.3)",
                      borderRadius: 8,
                      padding: "9px 16px",
                      fontSize: 13,
                      color: "var(--ink)",
                      cursor: "pointer",
                    }}
                  >
                    {musicFile ? `\u266a ${musicFile.name}` : "+ Add background music (optional)"}
                  </button>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                    Upload your own audio file. You are responsible for ensuring you have the rights to use it.
                  </p>
                </div>

                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Caption style</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {CAPTION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setCaptionPreset(preset.id)}
                      style={{
                        textAlign: 'left',
                        padding: '14px',
                        borderRadius: 10,
                        border: captionPreset === preset.id ? '2px solid var(--coral)' : '1px solid rgba(128,128,128,0.25)',
                        background: 'var(--card-bg)',
                        cursor: 'pointer',
                      }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{preset.label}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{preset.desc}</p>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvancedCaptions(!showAdvancedCaptions)}
                  style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--ink)', cursor: 'pointer', marginBottom: 20 }}
                >
                  {showAdvancedCaptions ? '− Hide advanced options' : '+ Advanced caption options'}
                </button>

                {showAdvancedCaptions && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 20, background: 'var(--card-bg)', padding: 16, borderRadius: 10 }}>
                    <div>
                      <label style={labelStyle}>Font</label>
                      <select value={captionFontFamily} onChange={(e) => setCaptionFontFamily(e.target.value)} style={inputStyle}>
                        {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Font size</label>
                      <input type="number" value={captionFontSize} onChange={(e) => setCaptionFontSize(Number(e.target.value))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Text color</label>
                      <input type="color" value={captionColor} onChange={(e) => setCaptionColor(e.target.value)} style={{ ...inputStyle, padding: 4, height: 38 }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Background color</label>
                      <input type="color" value={captionBgColor} onChange={(e) => setCaptionBgColor(e.target.value)} style={{ ...inputStyle, padding: 4, height: 38 }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Position</label>
                      <select value={captionPosition} onChange={(e) => setCaptionPosition(e.target.value as 'bottom' | 'top' | 'center')} style={inputStyle}>
                        <option value="bottom">Bottom</option>
                        <option value="center">Center</option>
                        <option value="top">Top</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedFiles.length > 0 && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                  </p>
                )}

                {selectedFiles.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Which clip has the speech to caption?</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {selectedFiles.map((file, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSpeechClipIndex(i)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: speechClipIndex === i ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)",
                            background: "var(--card-bg)",
                            fontSize: 12,
                            color: "var(--ink)",
                            cursor: "pointer",
                          }}
                        >
                          {file.name.length > 20 ? file.name.slice(0, 20) + "..." : file.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSpeechClipIndex(null)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: speechClipIndex === null ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)",
                          background: "var(--card-bg)",
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                        }}
                      >
                        No captions
                      </button>
                    </div>
                  </div>
                )}
                {uploadError && (
                  <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 16 }}>{uploadError}</p>
                )}

                <button
                  onClick={startUploadAndRender}
                  disabled={uploading || selectedFiles.length === 0}
                  style={{
                    backgroundColor: 'var(--coral)',
                    color: '#fff',
                    padding: '12px 24px',
                    marginTop: 24,
                    display: 'block',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    border: 'none',
                    cursor: uploading || selectedFiles.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: uploading || selectedFiles.length === 0 ? 0.5 : 1,
                  }}
                >
                  {uploading ? 'Uploading...' : 'Upload & create video'}
                </button>
              </div>

              {renderId && (
                <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '32px' }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    Your video
                  </h3>
                  {renderStatus !== 'done' && renderStatus !== 'failed' && (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Status: {renderStatus || 'starting'}... this usually takes a minute or two.
                    </p>
                  )}
                  {renderStatus === 'failed' && (
                    <p style={{ fontSize: 13, color: 'var(--coral)' }}>
                      Something went wrong rendering your video. Please try again.
                    </p>
                  )}
                  {renderStatus === 'done' && outputUrl && (
                    <>
                      <video
                        controls
                        src={outputUrl}
                        style={{ width: '100%', maxWidth: 400, borderRadius: 12, marginTop: 12 }}
                      />
                      <button
                        onClick={() => {
                          localStorage.setItem("reelly-editor-seed", JSON.stringify({
                            clipPaths: lastRenderedPaths,
                            musicPath: lastMusicPath,
                            speechClipIndex,
                            captionStyle: captionPreset,
                          }))
                          router.push("/editor")
                        }}
                        style={{
                          display: "block",
                          marginTop: 12,
                          background: "none",
                          border: "1px solid var(--coral)",
                          borderRadius: 8,
                          padding: "8px 16px",
                          fontSize: 13,
                          color: "var(--coral)",
                          cursor: "pointer",
                        }}
                      >
                        ✂ Edit this video
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
