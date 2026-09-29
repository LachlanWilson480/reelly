'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useParams } from 'next/navigation'
import JSZip from 'jszip'
type Profile = {
  business_name: string
  industry: string
  suburb: string
  country: string | null
  tone: string | null
  target_audience: string | null
  core_services: string | null
  custom_guidance: string | null
  location_type: string | null
  local_seasonal_context: string | null
  brand_personality: string | null
  words_to_avoid: string | null
  signature_service: string | null
  common_objections: string | null
  current_promotions: string | null
  customer_problem: string | null
  key_selling_point: string | null
  on_camera_people: string | null
  video_people_count: number | null
  years_in_business: string | null
  team_size: string | null
  upcoming_launches: string | null
  past_content: string | null
  worst_content: string | null
  preferred_formats: string | null
  competitor_content: string | null
  equipment: string | null
  community_ties: string | null
  notes: string | null
  price_positioning: string | null
  customer_source: string | null
  filming_comfort: string | null}

type Tab = 'overview' | 'ideas' | 'myideas' | 'filming' | 'script' | 'uploads' | 'aiuploads' | 'carousel'

type Idea = {
  id: string
  title: string
  hook: string
  description: string
  tags: string
  notes?: string
  day_of_week?: number
}

type FilmingItem = Idea & { checklist: string[]; prep?: string[]; caption?: string; script?: string }

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
  const carouselInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [deletionScheduledAt, setDeletionScheduledAt] = useState<string | null>(null)
  const [keyEvents, setKeyEvents] = useState<{ id: string; event_text: string; created_at: string }[]>([])
  const [showKeyEventsPanel, setShowKeyEventsPanel] = useState(false)
  const [weeklyObjectives, setWeeklyObjectives] = useState('')
  const [seasonalMode, setSeasonalMode] = useState<'seasonal' | 'evergreen' | 'mix'>('mix')
  const [scriptTopic, setScriptTopic] = useState('')
  const [scriptLength, setScriptLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [scriptStyle, setScriptStyle] = useState('')
  const [generatedScript, setGeneratedScript] = useState<string | null>(null)
  const [generatingScript, setGeneratingScript] = useState(false)
  const [scriptGenError, setScriptGenError] = useState<string | null>(null)
  const [newKeyEvent, setNewKeyEvent] = useState('')
  const [savingKeyEvent, setSavingKeyEvent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTabState] = useState<Tab>('overview')
  const params = useParams()
  const setTab = (t: Tab) => {
    setTabState(t)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/dashboard/${t}`)
    }
  }
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [filmingItems, setFilmingItems] = useState<FilmingItem[]>([])
  const [selectedFilmingId, setSelectedFilmingId] = useState<string | null>(null)
  const [stepUploads, setStepUploads] = useState<Record<number, File>>({})
  const [aiUploading, setAiUploading] = useState(false)
  const [aiRenderId, setAiRenderId] = useState<string | null>(null)
  const [aiRenderProgress, setAiRenderProgress] = useState<number>(0)
  const [aiRenderStatus, setAiRenderStatus] = useState<string | null>(null)
  const [aiOutputUrl, setAiOutputUrl] = useState<string | null>(null)
  const [aiCaptionPreset, setAiCaptionPreset] = useState('bold_center')
  const [aiAddCaptions, setAiAddCaptions] = useState(false)
  const [aiSpeechSteps, setAiSpeechSteps] = useState<Set<number>>(new Set())
  const [aiLandscapeSteps, setAiLandscapeSteps] = useState<Set<number>>(new Set())
  const [showSpeechWarning, setShowSpeechWarning] = useState(false)
  const [aiLandscapeHandling, setAiLandscapeHandling] = useState<'crop' | 'blur' | 'landscape'>('blur')
  const [aiResolution, setAiResolution] = useState<'high' | 'low'>('high')
  const [uploadResolution, setUploadResolution] = useState<'high' | 'low'>('high')
  const [aiTransition, setAiTransition] = useState<string>('none')
  const [showMusicLibrary, setShowMusicLibrary] = useState<null | 'ai' | 'upload'>(null)
  const [libraryMusicUrl, setLibraryMusicUrl] = useState<string | null>(null)
  const [libraryMusicName, setLibraryMusicName] = useState<string | null>(null)
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const MUSIC_LIBRARY_TRACKS = [
    { id: 'placeholder-1', name: 'Upbeat Corporate', mood: 'Energetic', url: '' },
    { id: 'placeholder-2', name: 'Chill Lo-fi', mood: 'Relaxed', url: '' },
    { id: 'placeholder-3', name: 'Cinematic Build', mood: 'Dramatic', url: '' },
    { id: 'placeholder-4', name: 'Acoustic Warmth', mood: 'Cozy', url: '' },
    { id: 'placeholder-5', name: 'Trending Pop', mood: 'Fun', url: '' },
  ]
  const [carouselFiles, setCarouselFiles] = useState<File[]>([])
  const [carouselCaption, setCarouselCaption] = useState('')
  const [savingCarousel, setSavingCarousel] = useState(false)
  const [carouselError, setCarouselError] = useState('')
  const [savedCarousels, setSavedCarousels] = useState<{ id: string; image_paths: string[]; caption: string | null; created_at: string }[]>([])
  const [carouselThumbnails, setCarouselThumbnails] = useState<Record<string, string>>({})
  const [uploadTransition, setUploadTransition] = useState<string>('none')
  const [uploadSlots, setUploadSlots] = useState<number[]>([0])
  const [uploadSlotFiles, setUploadSlotFiles] = useState<Record<number, File>>({})
  const [uploadSpeechSlots, setUploadSpeechSlots] = useState<Set<number>>(new Set())
  const [uploadLandscapeSlots, setUploadLandscapeSlots] = useState<Set<number>>(new Set())
  const [uploadAddCaptions, setUploadAddCaptions] = useState(false)
  const [showUploadSpeechWarning, setShowUploadSpeechWarning] = useState(false)
  const [extractingAudio, setExtractingAudio] = useState(false)
  const [extractAudioError, setExtractAudioError] = useState('')
  const [generatingFilming, setGeneratingFilming] = useState(false)
  const [selectedIdeaIdsForFilming, setSelectedIdeaIdsForFilming] = useState<string[]>([])
  const [filmingError, setFilmingError] = useState<string | null>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [dbSavedIdeas, setDbSavedIdeas] = useState<Idea[]>([])
  const [totalIdeasGenerated, setTotalIdeasGenerated] = useState(0)
  const [totalFilmingGenerated, setTotalFilmingGenerated] = useState(0)
  const [totalRenders, setTotalRenders] = useState(0)
  const [totalRenderSeconds, setTotalRenderSeconds] = useState(0)
  const [showOverageModal, setShowOverageModal] = useState(false)
  const [pendingRenderAction, setPendingRenderAction] = useState<(() => void) | null>(null)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [weeklyBatches, setWeeklyBatches] = useState<{ batchNumber: number; ideas: Idea[] }[]>([])
  const [batchIndex, setBatchIndex] = useState<number>(-1)
  const [generatingIdeas, setGeneratingIdeas] = useState(false)
  const [ideaError, setIdeaError] = useState('')
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number } | null>(null)
  const [userPlan, setUserPlan] = useState<'basic' | 'mid' | 'top'>('basic')
  const [realSubPlan, setRealSubPlan] = useState<'basic' | 'mid' | 'top' | null>(null)
  const [realSubStatus, setRealSubStatus] = useState<string | null>(null)
  const [refiningId, setRefiningId] = useState<string | null>(null)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [refineLoading, setRefineLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [renderId, setRenderId] = useState<string | null>(null)
  const [renderProgress, setRenderProgress] = useState<number>(0)
  const [renderStatus, setRenderStatus] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')

  const [captionPreset, setCaptionPreset] = useState('bold_center')
  const [showAdvancedCaptions, setShowAdvancedCaptions] = useState(false)
  const [captionFontSize, setCaptionFontSize] = useState(36)
  const [captionFontFamily, setCaptionFontFamily] = useState('Montserrat ExtraBold')
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [landscapeHandling, setLandscapeHandling] = useState<'crop' | 'blur' | 'landscape'>('blur')
  const [landscapeTouched, setLandscapeTouched] = useState(false)
  const [captionTouched, setCaptionTouched] = useState(false)
  const [speechClipIndex, setSpeechClipIndex] = useState<number | null>(0)
  const [lastRenderedPaths, setLastRenderedPaths] = useState<string[]>([])
  const [lastMusicPath, setLastMusicPath] = useState<string | null>(null)
  const musicInputRef = useRef<HTMLInputElement>(null)
  const audioExtractInputRef = useRef<HTMLInputElement>(null)
  const [extractedMusicPath, setExtractedMusicPath] = useState<string | null>(null)
  const [captionColor, setCaptionColor] = useState('#FFFFFF')
  const [captionBgColor, setCaptionBgColor] = useState('#000000')
  const [captionPosition, setCaptionPosition] = useState<'bottom' | 'top' | 'center'>('bottom')

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getUser()
      const user = sessionData.user

      if (!user) {
        const hasLoggedInBefore = localStorage.getItem('reelezy-has-logged-in')
        router.push(hasLoggedInBefore ? '/login' : '/signup')
        return
      }

      setUserId(user.id)

      const { data: subRow } = await supabase
        .from('subscriptions')
        .select('deletion_scheduled_at, plan, status')
        .eq('user_id', user.id)
        .maybeSingle()
      if (subRow?.deletion_scheduled_at) setDeletionScheduledAt(subRow.deletion_scheduled_at)
      if (subRow && subRow.status === 'active' && subRow.plan) {
        setUserPlan(subRow.plan as 'basic' | 'mid' | 'top')
      } else {
        setUserPlan('basic') // no active subscription -> default to Basic, matches backend getPlan()
      }
      if (subRow?.plan) {
        setRealSubPlan(subRow.plan as 'basic' | 'mid' | 'top')
        setRealSubStatus(subRow.status)
      }

      const { data: eventsData } = await supabase
        .from('key_events')
        .select('id, event_text, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (eventsData) setKeyEvents(eventsData)

      const { data } = await supabase
        .from('business_profiles')
        .select('business_name, industry, suburb, country, tone, target_audience, core_services, custom_guidance, location_type, local_seasonal_context, brand_personality, words_to_avoid, signature_service, common_objections, current_promotions, customer_problem, key_selling_point, on_camera_people, video_people_count, years_in_business, team_size, upcoming_launches, past_content, worst_content, preferred_formats, competitor_content, equipment, community_ties, notes, price_positioning, customer_source, filming_comfort')
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

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const { count: ideaCount } = await supabase
        .from("generated_ideas")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart)
      setTotalIdeasGenerated(ideaCount || 0)

      const { count: filmingCount } = await supabase
        .from("generated_ideas")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("checklist", "is", null)
        .gte("created_at", monthStart)
      setTotalFilmingGenerated(filmingCount || 0)

      const { count: renderCount } = await supabase
        .from("renders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart)
      setTotalRenders(renderCount || 0)

      const { data: durationRows } = await supabase
        .from("renders")
        .select("duration_seconds")
        .eq("user_id", user.id)
        .gte("created_at", monthStart)
        .not("duration_seconds", "is", null)
      const summedSeconds = (durationRows || []).reduce((sum, row) => sum + (row.duration_seconds || 0), 0)
      setTotalRenderSeconds(summedSeconds)
      if (allIdeas && allIdeas.length > 0) {
        const toIdea = (row: Record<string, unknown>): Idea => ({
          id: row.id as string,
          title: row.title as string,
          hook: row.hook as string,
          description: row.description as string,
          tags: row.tags as string,
          notes: (row.notes as string) || undefined,
          day_of_week: row.day_of_week as number | undefined,
        })

        const maxBatch = Math.max(...allIdeas.map((r) => r.batch_number as number))
        const savedRows = allIdeas.filter((r) => r.saved)

        // Only ideas generated since the most recent Monday 12am are navigable via the page arrows,
        // matching the same weekly-reset boundary used for the ideas usage cap.
        const now = new Date()
        const dayOfWeek = now.getDay()
        const daysSinceMonday = (dayOfWeek + 6) % 7
        const mostRecentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday, 0, 0, 0, 0)

        const thisWeekRows = allIdeas.filter((r) => new Date(r.created_at as string).getTime() >= mostRecentMonday.getTime())
        const batchNumbersThisWeek = Array.from(new Set(thisWeekRows.map((r) => r.batch_number as number))).sort((a, b) => a - b)
        const groups = batchNumbersThisWeek.map((bn) => ({
          batchNumber: bn,
          ideas: thisWeekRows.filter((r) => r.batch_number === bn).map(toIdea),
        }))

        setWeeklyBatches(groups)
        setBatchIndex(groups.length - 1)
        setIdeas(groups.length > 0 ? groups[groups.length - 1].ideas : [])
        setCurrentBatch(maxBatch)
        setDbSavedIdeas(savedRows.map(toIdea))
        setSavedIds(new Set(savedRows.map((r) => r.id as string)))

        const filmingRows = savedRows.filter((r) => r.checklist && !r.filming_cleared)
        if (filmingRows.length > 0) {
          setFilmingItems(filmingRows.map((r) => { const c = r.checklist as { steps?: string[]; prep?: string[]; caption?: string; script?: string }; return { ...toIdea(r), checklist: c.steps || [], prep: c.prep || [], caption: c.caption || "", script: c.script || "" } }))
        }
      }

      const { data: carouselRows } = await supabase
        .from("carousels")
        .select("id, image_paths, caption, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      if (carouselRows) setSavedCarousels(carouselRows)

      setProfile(data)
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    const urlTab = params.tab as Tab | undefined
    const validTabs: Tab[] = ["overview", "ideas", "myideas", "filming", "script", "uploads", "aiuploads", "carousel"]
    if (urlTab && validTabs.includes(urlTab)) {
      setTabState(urlTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
      if (typeof data.progress === 'number') setRenderProgress(data.progress)
      if (data.error) setRenderError(data.error)
      if (data.outputUrl) setOutputUrl(data.outputUrl)
    }, 4000)

    return () => clearInterval(interval)
  }, [renderId, renderStatus])

  useEffect(() => {
    if (!aiRenderId || aiRenderStatus === "done" || aiRenderStatus === "failed") return

    const interval = setInterval(async () => {
      const res = await fetch("/api/render-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renderId: aiRenderId }),
      })
      const data = await res.json()
      setAiRenderStatus(data.status)
      if (typeof data.progress === 'number') setAiRenderProgress(data.progress)
      if (data.outputUrl) setAiOutputUrl(data.outputUrl)
    }, 4000)

    return () => clearInterval(interval)
  }, [aiRenderId, aiRenderStatus])

  useEffect(() => {
    const loadThumbnails = async () => {
      const missing = savedCarousels.filter((c) => c.image_paths.length > 0 && !carouselThumbnails[c.id])
      if (missing.length === 0) return
      const updates: Record<string, string> = {}
      for (const c of missing) {
        const { data, error } = await supabase.storage.from('video-uploads').createSignedUrl(c.image_paths[0], 3600)
        if (!error && data) updates[c.id] = data.signedUrl
      }
      if (Object.keys(updates).length > 0) {
        setCarouselThumbnails((prev) => ({ ...prev, ...updates }))
      }
    }
    loadThumbnails()
  }, [savedCarousels])

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
        body: JSON.stringify({ profile, customization: profile.custom_guidance, userId, peopleCountOverride: profile.video_people_count, weeklyObjectives: weeklyObjectives.trim() || null, seasonalMode, toneOverride }),
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
        day_of_week: null,
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
        day_of_week: row.day_of_week,
      }))

      setWeeklyBatches((prev) => {
        const updated = [...prev, { batchNumber: nextBatch, ideas: newIdeas }]
        setBatchIndex(updated.length - 1)
        return updated
      })

      setIdeas(newIdeas)
      setCurrentBatch(nextBatch)
      setUserPlan(data.plan || "top")
      if (data.usage) setUsageInfo(data.usage)
    } catch (err) {
      setIdeaError(err instanceof Error ? err.message : "Something went wrong generating ideas. Please try again.")
    } finally {
      setGeneratingIdeas(false)
    }
  }

  const addKeyEvent = async () => {
    if (!userId || !newKeyEvent.trim()) return
    setSavingKeyEvent(true)
    const { data, error } = await supabase
      .from('key_events')
      .insert({ user_id: userId, event_text: newKeyEvent.trim() })
      .select()
      .single()
    setSavingKeyEvent(false)
    if (!error && data) {
      setKeyEvents((prev) => [data, ...prev])
      setNewKeyEvent('')
    }
  }

  const deleteKeyEvent = async (id: string) => {
    setKeyEvents((prev) => prev.filter((ev) => ev.id !== id))
    const { error } = await supabase
      .from('key_events')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Failed to delete key event:', error)
    }
  }

  const handleCarouselFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setCarouselFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeCarouselFile = (index: number) => {
    setCarouselFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const moveCarouselFile = (index: number, direction: -1 | 1) => {
    setCarouselFiles((prev) => {
      const newIndex = index + direction
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const updated = [...prev]
      const temp = updated[index]
      updated[index] = updated[newIndex]
      updated[newIndex] = temp
      return updated
    })
  }

  const reorderCarouselFiles = (fromIndex: number, toIndex: number) => {
    setCarouselFiles((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) return prev
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })
  }

  const saveCarousel = async () => {
    if (!userId || carouselFiles.length === 0) return
    setSavingCarousel(true)
    setCarouselError('')

    try {
      const paths: string[] = []
      for (const file of carouselFiles) {
        const path = `${userId}/carousels/${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('video-uploads').upload(path, file)
        if (error) throw new Error(error.message)
        paths.push(path)
      }

      const { data, error: insertError } = await supabase
        .from('carousels')
        .insert({ user_id: userId, image_paths: paths, caption: carouselCaption || null })
        .select()
        .single()

      if (insertError || !data) throw new Error('Failed to save carousel')

      setSavedCarousels((prev) => [data, ...prev])
      setCarouselFiles([])
      setCarouselCaption('')
    } catch (err) {
      setCarouselError(err instanceof Error ? err.message : 'Failed to save carousel. Please try again.')
    } finally {
      setSavingCarousel(false)
    }
  }

  const deleteCarousel = async (id: string) => {
    setSavedCarousels((prev) => prev.filter((c) => c.id !== id))
    await supabase.from('carousels').delete().eq('id', id)
  }

  const fetchCarouselImageBlobs = async (imagePaths: string[]): Promise<{ filename: string; blob: Blob }[]> => {
    const results: { filename: string; blob: Blob }[] = []
    for (let i = 0; i < imagePaths.length; i++) {
      const path = imagePaths[i]
      const { data, error } = await supabase.storage.from('video-uploads').createSignedUrl(path, 3600)
      if (error || !data) continue
      const res = await fetch(data.signedUrl)
      const blob = await res.blob()
      const filename = `image-${i + 1}${path.slice(path.lastIndexOf('.'))}`
      results.push({ filename, blob })
    }
    return results
  }

  const downloadZip = async (files: { filename: string; blob: Blob }[], zipName: string) => {
    const zip = new JSZip()
    for (const f of files) {
      zip.file(f.filename, f.blob)
    }
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = zipName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadCarouselImages = async (imagePaths: string[], index?: number) => {
    const files = await fetchCarouselImageBlobs(imagePaths)
    if (files.length === 0) return
    await downloadZip(files, `carousel${typeof index === 'number' ? `-${index + 1}` : ''}.zip`)
  }

  const downloadAllCarousels = async () => {
    const allFiles: { filename: string; blob: Blob }[] = []
    for (let c = 0; c < savedCarousels.length; c++) {
      const files = await fetchCarouselImageBlobs(savedCarousels[c].image_paths)
      files.forEach((f, i) => {
        allFiles.push({ filename: `carousel-${c + 1}/image-${i + 1}${f.filename.slice(f.filename.lastIndexOf('.'))}`, blob: f.blob })
      })
    }
    if (allFiles.length === 0) return
    await downloadZip(allFiles, 'all-carousels.zip')
  }

  const togglePreviewTrack = (trackId: string, url: string) => {
    if (previewingTrackId === trackId) {
      previewAudioRef.current?.pause()
      setPreviewingTrackId(null)
      return
    }
    if (!url) return
    previewAudioRef.current?.pause()
    const audio = new Audio(url)
    audio.play()
    audio.onended = () => setPreviewingTrackId(null)
    previewAudioRef.current = audio
    setPreviewingTrackId(trackId)
  }

  const selectLibraryTrack = (trackId: string, name: string, url: string, target: 'ai' | 'upload') => {
    previewAudioRef.current?.pause()
    setPreviewingTrackId(null)
    setLibraryMusicUrl(url)
    setLibraryMusicName(name)
    setMusicFile(null)
    setShowMusicLibrary(null)
  }

  const clearFilming = async () => {
    if (filmingItems.length === 0) return
    const ids = filmingItems.map((i) => i.id)
    setFilmingItems([])
    await supabase.from("generated_ideas").update({ filming_cleared: true }).in("id", ids)
  }

  const undoIdeas = () => {
    if (batchIndex <= 0) return
    const newIndex = batchIndex - 1
    setBatchIndex(newIndex)
    setIdeas(weeklyBatches[newIndex].ideas)
    setCurrentBatch(weeklyBatches[newIndex].batchNumber)
  }

  const redoIdeas = () => {
    if (batchIndex >= weeklyBatches.length - 1) return
    const newIndex = batchIndex + 1
    setBatchIndex(newIndex)
    setIdeas(weeklyBatches[newIndex].ideas)
    setCurrentBatch(weeklyBatches[newIndex].batchNumber)
  }

  const proceedToFilming = async (ideasToGenerate: Idea[]) => {
    if (!profile) return
    setGeneratingFilming(true)
    setTab("filming")
    setFilmingError(null)

    try {
      const results = await Promise.allSettled(
        ideasToGenerate.map((idea) =>
          fetch("/api/generate-checklist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idea, profile, customization: profile.custom_guidance, userId, peopleCountOverride: profile.video_people_count }),
          }).then(async (res) => {
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Request failed")
            return { idea, data }
          })
        )
      )

      const merged: FilmingItem[] = []
      let failCount = 0

      for (const result of results) {
        if (result.status === "fulfilled") {
          const { idea, data } = result.value
          const item: FilmingItem = {
            ...idea,
            checklist: data.checklist || [],
            prep: data.prep || [],
            caption: data.caption || "",
            script: data.script || "",
          }
          merged.push(item)
          await supabase
            .from("generated_ideas")
            .update({ checklist: { steps: item.checklist, prep: item.prep, caption: item.caption, script: item.script }, filming_cleared: false })
            .eq("id", item.id)
        } else {
          failCount++
        }
      }

      setFilmingItems(merged)
      if (failCount > 0) {
        setFilmingError(`${failCount} of ${ideasToGenerate.length} idea${failCount > 1 ? "s" : ""} failed to generate. You can try again for those.`)
      }
    } catch (err) {
      setFilmingError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setGeneratingFilming(false)
    }
  }

  const generateFreeformScript = async () => {
    if (!scriptTopic.trim()) return
    setGeneratingScript(true)
    setScriptGenError(null)
    setGeneratedScript(null)

    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: scriptTopic, length: scriptLength, style: scriptStyle, profile, userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")

      setGeneratedScript(data.script || "")
    } catch (err) {
      setScriptGenError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setGeneratingScript(false)
    }
  }

  const downloadVideo = async (url: string, filename: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error("Download failed", err)
    }
  }

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src)
        resolve(video.duration || 5)
      }
      video.onerror = () => resolve(5)
      video.src = URL.createObjectURL(file)
    })
  }

  const isLandscapeVideo = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src)
        resolve(video.videoWidth > video.videoHeight)
      }
      video.onerror = () => resolve(false)
      video.src = URL.createObjectURL(file)
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files))
      setSpeechClipIndex(0)
      setUploadError('')
    }
  }

  const BASIC_CAP_MIN = 10
  const PRO_CAP_MIN = 25
  const PREMIUM_CAP_MIN = 60

  const isOverRenderCap = () => {
    const capMin = userPlan === "top" ? PREMIUM_CAP_MIN : userPlan === "mid" ? PRO_CAP_MIN : BASIC_CAP_MIN
    return totalRenderSeconds / 60 >= capMin
  }

  const gateRenderAction = (action: () => void) => {
    if (isOverRenderCap()) {
      setPendingRenderAction(() => action)
      setShowOverageModal(true)
    } else {
      action()
    }
  }

  const runAiEditorUploads = async () => {
    if (!userId) return
    const selectedItem = filmingItems.find((f) => f.id === selectedFilmingId)
    if (!selectedItem) return

    setAiUploading(true)
    setAiRenderId(null)
    setAiRenderStatus(null)
    setAiOutputUrl(null)

    try {
      const stepIndices = Object.keys(stepUploads).map(Number).sort((a, b) => a - b)
      const clipPaths: string[] = []
      const speechIndices: number[] = []
      const clipTrims: { duration: number }[] = []
      const clipSettings: { letterbox?: boolean }[] = []
      let anyLandscape = false

      for (const stepIndex of stepIndices) {
        const file = stepUploads[stepIndex]
        const path = `${userId}/${Date.now()}-step${stepIndex}-${file.name}`
        const { error } = await supabase.storage.from("video-uploads").upload(path, file)
        if (error) throw new Error(error.message)
        clipPaths.push(path)
        if (aiSpeechSteps.has(stepIndex)) speechIndices.push(clipPaths.length - 1)

        const duration = await getVideoDuration(file)
        clipTrims.push({ duration })

        const isLandscape = aiLandscapeSteps.has(stepIndex)
        if (isLandscape) {
          anyLandscape = true
          clipSettings.push(aiLandscapeHandling === "blur" ? { letterbox: true } : {})
        } else {
          clipSettings.push({})
        }
      }

      if (clipPaths.length === 0) throw new Error("Upload at least one clip before creating your video.")

      let musicPath: string | null = extractedMusicPath
      if (!musicPath && musicFile) {
        const mPath = `${userId}/music-${Date.now()}-${musicFile.name}`
        const { error: musicError } = await supabase.storage.from('video-uploads').upload(mPath, musicFile)
        if (!musicError) musicPath = mPath
      }

      const outputOrientation = anyLandscape && aiLandscapeHandling === "landscape" ? "landscape" : undefined

      const aiCaptionStyle = aiAddCaptions
        ? (showAdvancedCaptions
            ? {
                preset: aiCaptionPreset,
                custom: {
                  font: { family: captionFontFamily, size: captionFontSize, color: captionColor },
                  position: captionPosition,
                },
              }
            : aiCaptionPreset)
        : null

      const res = await fetch("/api/render-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          clipPaths,
          captionStyle: aiCaptionStyle,
          musicPath,
          musicUrl: libraryMusicUrl,
          speechClipIndices: speechIndices,
          clipTrims,
          clipSettings,
          outputOrientation,
          resolution: aiResolution,
          transition: aiTransition,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Render failed to start")

      setAiRenderId(data.renderId)
      setAiRenderStatus("queued")
      setMusicFile(null)
      setExtractedMusicPath(null)
    } catch (err) {
      setIdeaError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setAiUploading(false)
    }
  }
  const runUploadAndRender = async () => {
    if (!userId) return
    const slotIds = uploadSlots.filter((id) => uploadSlotFiles[id])
    if (slotIds.length === 0) return

    setUploading(true)
    setUploadError('')
    setRenderId(null)
    setRenderStatus(null)
    setOutputUrl(null)

    try {
      const clipPaths: string[] = []
      const clipTrims: { duration: number }[] = []
      const clipSettings: { letterbox?: boolean }[] = []
      const speechIndices: number[] = []
      let anyLandscape = false

      for (const slotId of slotIds) {
        const file = uploadSlotFiles[slotId]
        const path = `${userId}/${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('video-uploads').upload(path, file)
        if (error) throw new Error(error.message)
        clipPaths.push(path)
        if (uploadSpeechSlots.has(slotId)) speechIndices.push(clipPaths.length - 1)

        const duration = await getVideoDuration(file)
        clipTrims.push({ duration })

        const isLandscape = uploadLandscapeSlots.has(slotId)
        if (isLandscape) {
          anyLandscape = true
          clipSettings.push(landscapeHandling === "blur" ? { letterbox: true } : {})
        } else {
          clipSettings.push({})
        }
      }

      if (clipPaths.length === 0) throw new Error("Upload at least one clip before creating your video.")

      let musicPath: string | null = extractedMusicPath
      if (!musicPath && musicFile) {
        const mPath = `${userId}/music-${Date.now()}-${musicFile.name}`
        const { error: musicError } = await supabase.storage.from('video-uploads').upload(mPath, musicFile)
        if (!musicError) musicPath = mPath
      }

      const outputOrientation = anyLandscape && landscapeHandling === "landscape" ? "landscape" : undefined

      const captionStyle = uploadAddCaptions
        ? (showAdvancedCaptions
            ? {
                preset: captionPreset,
                custom: {
                  font: { family: captionFontFamily, size: captionFontSize, color: captionColor },
                  position: captionPosition,
                },
              }
            : captionPreset)
        : null

      const res = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, clipPaths, captionStyle, musicPath, musicUrl: libraryMusicUrl, speechClipIndices: speechIndices, clipSettings, outputOrientation, clipTrims, resolution: uploadResolution, transition: uploadTransition }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Render failed to start')

      setRenderId(data.renderId)
      setRenderStatus('queued')
      setLastRenderedPaths(clipPaths)
      setLastMusicPath(musicPath)
      setUploadSlots([0])
      setUploadSlotFiles({})
      setUploadSpeechSlots(new Set())
      setUploadLandscapeSlots(new Set())
      setMusicFile(null)
      setExtractedMusicPath(null)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setUploading(false)
    }
  }

  const submitAiEditorUploads = () => gateRenderAction(() => { runAiEditorUploads() })
  const startUploadAndRender = () => gateRenderAction(() => { runUploadAndRender() })

  const handleExtractAudio = async (file: File) => {
    if (!userId) return
    setExtractingAudio(true)
    setExtractAudioError('')
    setExtractedMusicPath(null)
    setMusicFile(null)

    try {
      const path = `${userId}/${Date.now()}-extract-source-${file.name}`
      const { error: uploadError } = await supabase.storage.from('video-uploads').upload(path, file)
      if (uploadError) throw new Error(uploadError.message)

      const startRes = await fetch('/api/extract-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: path }),
      })
      const startData = await startRes.json()
      if (!startRes.ok) throw new Error(startData.error || 'Failed to start audio extraction')

      const shotstackRenderId = startData.shotstackRenderId

      let done = false
      while (!done) {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        const statusRes = await fetch('/api/extract-audio-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shotstackRenderId, userId }),
        })
        const statusData = await statusRes.json()

        if (statusData.status === 'done') {
          setExtractedMusicPath(statusData.musicPath)
          done = true
        } else if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Audio extraction failed')
        }
      }
    } catch (err) {
      setExtractAudioError(err instanceof Error ? err.message : 'Something went wrong extracting audio')
    } finally {
      setExtractingAudio(false)
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
    { id: 'aiuploads', label: 'AI Editor' },
    { id: 'uploads', label: 'Editor For Any Video' },
    { id: 'carousel', label: 'Carousel Reels' },
    { id: 'script', label: 'Script Generator' },
  ]

  const isFreeTier = !realSubPlan || realSubStatus !== 'active'

  const renderCapMin = userPlan === 'top' ? 60 : userPlan === 'mid' ? 25 : 0

  const stats = [
    { label: 'Ideas generated', value: String(totalIdeasGenerated) },
    { label: 'Filming instructions generated', value: String(totalFilmingGenerated) },
    { label: 'Renders', value: isFreeTier ? 'N/A' : String(totalRenders), locked: isFreeTier },
    { label: 'Posts this week', value: '0' },
    { label: 'Render minutes used', value: isFreeTier ? 'N/A' : (() => {
      const usedMin = Math.floor(totalRenderSeconds / 60)
      const usedSec = totalRenderSeconds % 60
      return `${usedMin}:${String(usedSec).padStart(2, '0')} / ${renderCapMin}:00`
    })(), locked: isFreeTier },
  ]

  const savedIdeas = dbSavedIdeas



  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' as const, color: 'var(--ink)' }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5, display: 'block' as const }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      {showOverageModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "var(--sand)", borderRadius: 16, padding: "32px", maxWidth: 420, width: "100%" }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 12 }}>You&apos;ve reached your monthly render limit</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 24 }}>
              You&apos;ve used all your included render minutes for this month. Press Continue to keep rendering on overage fees, or Exit to stop here.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setShowOverageModal(false); setPendingRenderAction(null) }}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(128,128,128,0.3)", background: "transparent", fontSize: 14, color: "var(--ink)", cursor: "pointer" }}
              >
                Exit
              </button>
              <button
                onClick={() => {
                  setShowOverageModal(false)
                  if (pendingRenderAction) pendingRenderAction()
                  setPendingRenderAction(null)
                }}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "none", background: "var(--coral)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav className="dashboard-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600 }}>
            Reelezy
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href="/settings?section=billing" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--sand)", border: "1px solid rgba(128,128,128,0.2)", borderRadius: 999, padding: "6px 14px", textDecoration: "none", color: "var(--ink)", fontSize: 12, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)" }} />
              {realSubPlan && realSubStatus !== 'active'
                ? `${realSubPlan === "top" ? "Pro" : realSubPlan === "mid" ? "Basic" : "Basic"} Plan (${realSubStatus})`
                : realSubPlan
                ? `${userPlan === "top" ? "Pro" : userPlan === "mid" ? "Basic" : "Basic"} Plan`
                : "Free Plan"}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· Manage</span>
            </a>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
          >
            Log out
          </button>
          </div>
        </nav>

        <div style={{ padding: '0 48px 100px' }}>
          {deletionScheduledAt && (
            <div style={{ background: 'rgba(216,90,48,0.1)', border: '1px solid var(--coral)', borderRadius: 16, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--ink)' }}>
                Your account data is scheduled for deletion on <strong>{new Date(deletionScheduledAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Download a copy of your data or resubscribe before then to keep it.
              </p>
              <a href="/settings" style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Go to Settings
              </a>
            </div>
          )}
          <div style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 24, padding: '40px 36px', marginBottom: 28 }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 600, color: '#F1EFE8', marginBottom: 4 }}>
              Welcome back, {profile?.business_name}
            </h1>
            <p style={{ fontSize: 14, color: '#D3D1C7', marginBottom: 24 }}>
              {profile?.industry} · {profile?.suburb}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
              {stats.map((s) => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', opacity: s.locked ? 0.5 : 1 }}>
                  {s.locked ? (
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#F1EFE8', lineHeight: 1.4 }}>Upgrade to get access to our editor</p>
                  ) : (
                    <p style={{ fontSize: 20, fontWeight: 600, fontFamily: "'Outfit', sans-serif", color: '#F1EFE8' }}>{s.value}</p>
                  )}
                  <p style={{ fontSize: 12, color: '#D3D1C7' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-tabs-wrapper" style={{ display: 'flex', alignItems: 'stretch', marginBottom: 28, borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
            <div className="dashboard-tabs-scroll" style={{ display: 'flex', gap: 4, overflowX: 'auto', flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
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
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {t.label}{t.id === 'myideas' && savedIdeas.length > 0 ? ` (${savedIdeas.length})` : ''}
                </button>
              ))}
            </div>
            <div className="dashboard-tabs-arrow" style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: 28, flexShrink: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              →
            </div>
          </div>

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

              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
                {/* Weekly objectives textarea */}
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    This week&apos;s objectives (optional)
                  </label>
                  <textarea
                    value={weeklyObjectives}
                    onChange={(e) => setWeeklyObjectives(e.target.value)}
                    rows={2}
                    placeholder="e.g. Promote our new triple chocolate croissant for 2 videos, show behind-the-scenes baking, introduce Jacob our new apprentice baker"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "'Inter', sans-serif", resize: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {([
                      { id: 'seasonal', label: 'Seasonal', desc: 'Ideas tied to upcoming dates & events', icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="2.5" width="12" height="10.5" rx="1.5"/><line x1="1" y1="5.5" x2="13" y2="5.5"/><line x1="4.5" y1="1" x2="4.5" y2="4"/><line x1="9.5" y1="1" x2="9.5" y2="4"/></svg> },
                      { id: 'mix', label: 'Mix', desc: 'Blend of seasonal and timeless ideas', icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5" fill="currentColor" fillOpacity="0.15"/><line x1="7" y1="1.5" x2="7" y2="12.5"/></svg> },
                      { id: 'evergreen', label: 'Timeless', desc: 'Works any time of year', icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="5.5"/><polyline points="7,3.5 7,7 9.5,9"/></svg> },
                    ] as { id: 'seasonal' | 'mix' | 'evergreen'; label: string; desc: string; icon: React.ReactNode }[]).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSeasonalMode(opt.id)}
                        style={{
                          padding: '7px 13px',
                          borderRadius: 10,
                          border: seasonalMode === opt.id ? '1.5px solid var(--coral)' : '1px solid rgba(128,128,128,0.25)',
                          background: seasonalMode === opt.id ? 'rgba(216,90,48,0.1)' : 'var(--card-bg)',
                          cursor: 'pointer',
                          fontFamily: "'Inter', sans-serif",
                          textAlign: 'left' as const,
                          flex: 1,
                        }}
                      >
                        <p style={{ fontSize: 12, fontWeight: 600, color: seasonalMode === opt.id ? 'var(--coral)' : 'var(--ink)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>{opt.icon}{opt.label}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Action buttons + tone selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 22, flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={generateIdeas}
                    disabled={generatingIdeas}
                    style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: generatingIdeas ? 'not-allowed' : 'pointer', opacity: generatingIdeas ? 0.7 : 1, whiteSpace: 'nowrap' }}
                  >
                    {generatingIdeas ? 'Generating...' : ideas.length > 0 ? 'Generate more' : 'Generate ideas'}
                  </button>
                  <button
                    onClick={undoIdeas}
                    disabled={batchIndex <= 0}
                    title="Go to previous batch"
                    style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: '9px 12px', fontSize: 15, color: batchIndex > 0 ? 'var(--ink)' : 'var(--text-muted)', cursor: batchIndex > 0 ? 'pointer' : 'not-allowed', opacity: batchIndex > 0 ? 1 : 0.5, lineHeight: 1 }}
                  >
                    ←
                  </button>
                  {weeklyBatches.length > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '0 4px', display: 'flex', alignItems: 'center' }}>
                      {batchIndex + 1} of {weeklyBatches.length}
                    </span>
                  )}
                  <button
                    onClick={redoIdeas}
                    disabled={batchIndex >= weeklyBatches.length - 1}
                    title="Go to next batch"
                    style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: '9px 12px', fontSize: 15, color: batchIndex < weeklyBatches.length - 1 ? 'var(--ink)' : 'var(--text-muted)', cursor: batchIndex < weeklyBatches.length - 1 ? 'pointer' : 'not-allowed', opacity: batchIndex < weeklyBatches.length - 1 ? 1 : 0.5, lineHeight: 1 }}
                  >
                    →
                  </button>
                  </div>
                  {/* Tone selector */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 5 }}>Tone</p>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {([
                        { id: null, label: 'Default' },
                        { id: 'casual', label: 'Casual' },
                        { id: 'professional', label: 'Professional' },
                        { id: 'humorous', label: 'Humorous' },
                        { id: 'heartfelt', label: 'Heartfelt' },
                      ] as { id: string | null; label: string }[]).map((t) => (
                        <button
                          key={t.id ?? 'default'}
                          type="button"
                          onClick={() => setToneOverride(t.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 20,
                            border: toneOverride === t.id ? '1.5px solid var(--coral)' : '1px solid rgba(128,128,128,0.25)',
                            background: toneOverride === t.id ? 'rgba(216,90,48,0.1)' : 'var(--card-bg)',
                            color: toneOverride === t.id ? 'var(--coral)' : 'var(--text-secondary)',
                            fontSize: 11,
                            fontWeight: toneOverride === t.id ? 600 : 400,
                            cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif",
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {usageInfo && (
                <div style={{ background: usageInfo.used >= usageInfo.limit ? 'rgba(216,90,48,0.1)' : 'var(--sand)', border: usageInfo.used >= usageInfo.limit ? '1px solid var(--coral)' : 'none', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {usageInfo.used} of {usageInfo.limit} ideas generated this week ({userPlan === 'top' ? 'Pro' : userPlan === 'mid' ? 'Basic' : 'Basic'} plan)
                    {' · '}
                    <span style={{ color: 'var(--text-muted)' }}>
                      Resets {(() => {
                        const now = new Date()
                        const daysUntilMonday = (8 - now.getDay()) % 7 || 7
                        const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday)
                        return nextMonday.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
                      })()}
                    </span>
                  </p>
                  {usageInfo.used >= usageInfo.limit && userPlan !== 'top' && (
                    <a href="/plans" style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 600, textDecoration: 'none' }}>{userPlan === 'mid' ? 'Upgrade to Pro →' : 'Upgrade to Basic →'}</a>
                  )}
                </div>
              )}

              {showKeyEventsPanel && (
                <div style={{ background: 'var(--sand)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Log a key event</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    e.g. "New barista Jake started this week" - these get woven into future idea generations where relevant.
                  </p>
                  <textarea
                    value={newKeyEvent}
                    onChange={(e) => setNewKeyEvent(e.target.value)}
                    rows={2}
                    placeholder="What's happening in your business right now?"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "'Inter', sans-serif", resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }}
                  />
                  <button
                    onClick={addKeyEvent}
                    disabled={savingKeyEvent || !newKeyEvent.trim()}
                    style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: savingKeyEvent || !newKeyEvent.trim() ? 'not-allowed' : 'pointer', opacity: savingKeyEvent || !newKeyEvent.trim() ? 0.5 : 1, marginBottom: 14 }}
                  >
                    {savingKeyEvent ? 'Saving...' : 'Add event'}
                  </button>
                  {keyEvents.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {keyEvents.slice(0, 5).map((ev) => (
                        <div key={ev.id} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 10px', background: 'var(--card-bg)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span>{ev.event_text}</span>
                          <button
                            onClick={() => deleteKeyEvent(ev.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}
                            aria-label="Delete event"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(128,128,128,0.15)' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Weekly performance suggestions</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 10px', background: 'var(--card-bg)', borderRadius: 6 }}>
                      Coming soon: once scheduling and posting analytics are live, Reelezy will analyse last week's video performance and tailor this week's ideas and editing style to improve on it.
                    </p>
                  </div>
                </div>
              )}

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
                    {(userPlan === "mid" || userPlan === "top") && (
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
              {(userPlan === "mid" || userPlan === "top") && dbSavedIdeas.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Weekly Calendar</h3>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>Drag any idea below onto a day to schedule it.</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, padding: "12px", background: "var(--sand)", borderRadius: 10, border: "1px dashed rgba(128,128,128,0.25)" }}>
                    {dbSavedIdeas.filter((idea) => idea.day_of_week === undefined || idea.day_of_week === null).length === 0 && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>All ideas scheduled - drag a card between days below to reschedule.</p>
                    )}
                    {dbSavedIdeas.filter((idea) => idea.day_of_week === undefined || idea.day_of_week === null).map((idea) => (
                      <div
                        key={idea.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", idea.id)}
                        style={{
                          background: "var(--card-bg)",
                          borderLeft: "3px solid var(--coral)",
                          borderRadius: "4px 8px 8px 4px",
                          padding: "8px 12px",
                          cursor: "grab",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                          maxWidth: 220,
                        }}
                      >
                        <p style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{idea.title}</p>
                      </div>
                    ))}
                  </div>
                  <div className="weekly-calendar-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12 }}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, dayIndex) => {
                      const isToday = new Date().getDay() === dayIndex
                      const dayIdeas = dbSavedIdeas.filter((i) => i.day_of_week === dayIndex)
                      return (
                        <div
                          key={dayIndex}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault()
                            const ideaId = e.dataTransfer.getData("text/plain")
                            setDbSavedIdeas((prev) => prev.map((i) => (i.id === ideaId ? { ...i, day_of_week: dayIndex } : i)))
                            supabase.from("generated_ideas").update({ day_of_week: dayIndex }).eq("id", ideaId).then(() => {})
                          }}
                          style={{
                            background: isToday ? "linear-gradient(160deg, rgba(216,90,48,0.12), rgba(127,119,221,0.08))" : "var(--sand)",
                            border: isToday ? "1.5px solid var(--coral)" : "1px solid rgba(128,128,128,0.12)",
                            borderRadius: 12,
                            padding: "12px 10px",
                            minHeight: 180,
                            transition: "background 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: isToday ? "var(--coral)" : "var(--text-secondary)" }}>{dayName}</p>
                            {dayIdeas.length > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: "var(--coral)", color: "#fff", borderRadius: 999, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{dayIdeas.length}</span>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {dayIdeas.length === 0 && (
                              <div style={{ border: "1px dashed rgba(128,128,128,0.25)", borderRadius: 8, padding: "14px 6px", textAlign: "center" }}>
                                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Drop here</p>
                              </div>
                            )}
                            {dayIdeas.map((idea) => (
                              <div
                                key={idea.id}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData("text/plain", idea.id)}
                                style={{
                                  background: "var(--card-bg)",
                                  borderLeft: "3px solid var(--coral)",
                                  borderRadius: "4px 8px 8px 4px",
                                  padding: "8px 10px",
                                  cursor: "grab",
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                                }}
                              >
                                <p style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.35 }}>{idea.title}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {savedIdeas.length === 0 ? (
                <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    No ideas saved yet. Star an idea in Content Ideas to see it here.
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                    Review your selected ideas. Head to the Filming tab to generate instructions.
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
                </div>
              )}
            </div>
          )}

          {tab === 'filming' && (
            <div>
              {savedIdeas.length > 0 && (
                <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '22px', marginBottom: 24 }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                    Select ideas to film
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {savedIdeas.map((idea) => (
                      <label
                        key={idea.id}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--card-bg)', cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIdeaIdsForFilming.includes(idea.id)}
                          onChange={(e) => {
                            setSelectedIdeaIdsForFilming((prev) =>
                              e.target.checked ? [...prev, idea.id] : prev.filter((id) => id !== idea.id)
                            )
                          }}
                          style={{ marginTop: 3, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 13, lineHeight: 1.4 }}>{idea.title}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={() => proceedToFilming(savedIdeas.filter((idea) => selectedIdeaIdsForFilming.includes(idea.id)))}
                    disabled={selectedIdeaIdsForFilming.length === 0 || generatingFilming}
                    style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: selectedIdeaIdsForFilming.length === 0 || generatingFilming ? 'not-allowed' : 'pointer', opacity: selectedIdeaIdsForFilming.length === 0 || generatingFilming ? 0.6 : 1 }}
                  >
                    {generatingFilming ? 'Generating...' : 'Generate instructions'}
                  </button>
                </div>
              )}
              {filmingError && (
                <p style={{ fontSize: 13, color: "var(--coral)", marginBottom: 16 }}>{filmingError}</p>
              )}              {filmingItems.length > 0 && (
                <button
                  onClick={clearFilming}
                  style={{ marginBottom: 16, background: "none", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Clear
                </button>
              )}              {generatingFilming && (
                <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Generating filming instructions...</p>
                </div>
              )}
              {!generatingFilming && filmingItems.length === 0 && savedIdeas.length === 0 && (
                <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    Star an idea in Content Ideas to see it here for filming.
                  </p>
                </div>
              )}
              {!generatingFilming && filmingItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {filmingItems.map((item) => (
                    <div key={item.id} style={{ background: 'var(--sand)', borderRadius: 20, overflow: 'hidden' }}>
                      {/* Header */}
                      <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
                        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
                          {item.title}
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--coral)' }}>{item.tags}</p>
                      </div>

                      {/* What you'll need */}
                      {item.prep && item.prep.length > 0 && (
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(128,128,128,0.12)', background: 'rgba(128,128,128,0.04)' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>📦 What you'll need</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {item.prep.map((p, i) => (
                              <span key={i} style={{ fontSize: 12, color: 'var(--ink)', background: 'var(--card-bg)', border: '1px solid rgba(128,128,128,0.18)', borderRadius: 20, padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ color: 'var(--coral)', fontSize: 10 }}>✓</span> {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Filming steps */}
                      <div style={{ padding: '16px 24px', borderBottom: item.caption || item.script ? '1px solid rgba(128,128,128,0.12)' : 'none' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>🎬 Filming steps</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {item.checklist.map((step, i) => {
                            const dashIdx = step.indexOf(' - ')
                            const timeRange = dashIdx !== -1 ? step.slice(0, dashIdx).trim() : null
                            const instruction = dashIdx !== -1 ? step.slice(dashIdx + 3).trim() : step
                            return (
                              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--coral)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                  {i + 1}
                                </div>
                                <div style={{ flex: 1 }}>
                                  {timeRange && (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--coral)', background: 'rgba(216,90,48,0.1)', borderRadius: 4, padding: '2px 6px', marginBottom: 4, display: 'inline-block' }}>
                                      {timeRange}
                                    </span>
                                  )}
                                  <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.55 }}>{instruction}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Caption */}
                      {item.caption && (
                        <div style={{ padding: '16px 24px', borderBottom: item.script ? '1px solid rgba(128,128,128,0.12)' : 'none', background: 'rgba(128,128,128,0.04)' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>💬 Suggested caption</p>
                          <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{item.caption}</p>
                        </div>
                      )}

                      {/* Script */}
                      {item.script && (
                        <div style={{ padding: '16px 24px' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>🎙 Full script</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {(() => {
                              // Split script into sentences
                              const sentences = item.script
                                .split(/(?<=[.!?])\s+/)
                                .map((s: string) => s.trim())
                                .filter((s: string) => s.length > 0)
                              // Extract stage direction (camera/movement before "and say:") from each checklist step
                              const directions = item.checklist.map((step: string) => {
                                const dashIdx = step.indexOf(' - ')
                                const afterTime = dashIdx !== -1 ? step.slice(dashIdx + 3) : step
                                const sayPos = afterTime.toLowerCase().indexOf(' and say:')
                                if (sayPos !== -1) {
                                  return afterTime.slice(0, sayPos).trim().replace(/,\s*$/, '')
                                }
                                // fallback: try splitting on ", and " for steps without "say:"
                                const andPos = afterTime.toLowerCase().indexOf(', and ')
                                if (andPos !== -1) {
                                  return afterTime.slice(0, andPos).trim().replace(/,\s*$/, '')
                                }
                                return null
                              })
                              return sentences.map((sentence: string, i: number) => (
                                <div key={i} style={{ paddingTop: i === 0 ? 0 : 14, paddingBottom: 14, borderBottom: i < sentences.length - 1 ? '1px solid rgba(128,128,128,0.1)' : 'none' }}>
                                  <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.65, marginBottom: directions[i] ? 5 : 0 }}>{sentence}</p>
                                  {directions[i] && (
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>📷 {directions[i]}</p>
                                  )}
                                </div>
                              ))
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'carousel' && (
            <div>
              <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '32px', marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Create a carousel
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Upload multiple images and arrange their order. No video rendering involved - this creates a static carousel post.
                </p>

                <input
                  ref={carouselInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleCarouselFileSelect}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => carouselInputRef.current?.click()}
                  style={{
                    background: "var(--coral)",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#fff",
                    cursor: "pointer",
                    marginBottom: 16,
                  }}
                >
                  + Add images
                </button>

                {carouselFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Drag to reorder</p>
                    {carouselFiles.map((file, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move' }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
                          reorderCarouselFiles(fromIndex, i)
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--card-bg)', borderRadius: 8, cursor: 'grab' }}
                      >
                        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>⠿</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{i + 1}</span>
                        <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeCarouselFile(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Caption (optional)</label>
                <textarea
                  value={carouselCaption}
                  onChange={(e) => setCarouselCaption(e.target.value)}
                  rows={2}
                  placeholder="Write a caption for this carousel..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13, fontFamily: "'Inter', sans-serif", resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }}
                />

                {carouselError && (
                  <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 12 }}>{carouselError}</p>
                )}

                <button
                  onClick={saveCarousel}
                  disabled={savingCarousel || carouselFiles.length === 0}
                  style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: savingCarousel || carouselFiles.length === 0 ? 'not-allowed' : 'pointer', opacity: savingCarousel || carouselFiles.length === 0 ? 0.6 : 1 }}
                >
                  {savingCarousel ? 'Saving...' : 'Save carousel'}
                </button>
              </div>

              {savedCarousels.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600 }}>
                      Saved carousels
                    </h3>
                    <button
                      onClick={downloadAllCarousels}
                      style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--ink)', cursor: 'pointer' }}
                    >
                      Download all
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {savedCarousels.map((c, ci) => (
                      <div key={c.id} style={{ background: 'var(--sand)', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 96, gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', background: 'var(--card-bg)', flexShrink: 0 }}>
                            {carouselThumbnails[c.id] && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={carouselThumbnails[c.id]} alt="Carousel preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{c.image_paths.length} images</p>
                            {c.caption && <p style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.caption}</p>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                          <button
                            onClick={() => downloadCarouselImages(c.image_paths, ci)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--coral)', fontSize: 13, fontWeight: 600 }}
                          >
                            Download
                          </button>
                          <button
                            onClick={() => deleteCarousel(c.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'script' && userPlan === 'basic' && (
            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Script Generator
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                The Script Generator is available on the Basic and Pro plans.
              </p>
              <a href="/plans" style={{ fontSize: 13, color: '#fff', background: 'var(--coral)', padding: '10px 18px', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
                Upgrade to Basic →
              </a>
            </div>
          )}

          {tab === 'script' && userPlan !== 'basic' && (
            <div>
              <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '32px', marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Script Generator
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Type in any idea or topic, pick a length and style, and generate a full word-for-word script - no saved idea required.
                </p>

                <label style={labelStyle}>What's the video about?</label>
                <textarea
                  value={scriptTopic}
                  onChange={(e) => setScriptTopic(e.target.value)}
                  rows={3}
                  placeholder="e.g. Why our sourdough takes 3 days to make, and why it's worth the wait"
                  style={{ ...inputStyle, resize: 'vertical', marginBottom: 20 }}
                />

                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Length</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  {[
                    { id: "short", label: "Short (~15-20s)" },
                    { id: "medium", label: "Medium (~30-45s)" },
                    { id: "long", label: "Long (~60-90s)" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setScriptLength(opt.id as "short" | "medium" | "long")}
                      style={{ padding: "8px 14px", borderRadius: 8, border: scriptLength === opt.id ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)", background: "var(--card-bg)", fontSize: 12, color: "var(--ink)", cursor: "pointer" }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <label style={labelStyle}>Style (optional)</label>
                <input
                  value={scriptStyle}
                  onChange={(e) => setScriptStyle(e.target.value)}
                  placeholder="e.g. funny, professional, dramatic, warm and personal"
                  style={{ ...inputStyle, marginBottom: 20 }}
                />

                <button
                  onClick={generateFreeformScript}
                  disabled={generatingScript || !scriptTopic.trim()}
                  style={{ backgroundColor: "var(--coral)", color: "#fff", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, border: "none", cursor: generatingScript || !scriptTopic.trim() ? "not-allowed" : "pointer", opacity: generatingScript || !scriptTopic.trim() ? 0.5 : 1, marginBottom: 20, display: "block" }}
                >
                  {generatingScript ? "Generating script..." : "Generate script"}
                </button>

                {scriptGenError && (
                  <p style={{ fontSize: 13, color: "var(--coral)", marginBottom: 16 }}>{scriptGenError}</p>
                )}

                {generatedScript && (
                  <div style={{ background: "var(--card-bg)", borderRadius: 12, padding: "24px" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, color: "var(--text-secondary)" }}>SCRIPT</p>
                    <p style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.8 }}>{generatedScript}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === 'uploads' && (!realSubPlan || realSubStatus !== 'active') && (
            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Upload your clips
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Video rendering is not available on the Free plan.
              </p>
              <a href="/plans" style={{ fontSize: 13, color: '#fff', background: 'var(--coral)', padding: '10px 18px', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
                View paid plans →
              </a>
            </div>
          )}

          {tab === 'uploads' && realSubPlan && realSubStatus === 'active' && (
            <div>
              <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '32px', marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Upload your clips
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Add as many clips as you like. Reelezy will stitch them together, add captions, trim pauses, and add music.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  {uploadSlots.map((slotId) => (
                    <div key={slotId} style={{ background: "var(--card-bg)", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          type="file"
                          accept="video/*"
                          className="step-upload-input"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) setUploadSlotFiles((prev) => ({ ...prev, [slotId]: file }))
                          }}
                          style={{ fontSize: 11 }}
                        />
                        {uploadSlotFiles[slotId] && (
                          <span style={{ fontSize: 11, color: "var(--coral)" }}>✓ {uploadSlotFiles[slotId].name}</span>
                        )}
                        {uploadSlots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setUploadSlots((prev) => prev.filter((id) => id !== slotId))
                              setUploadSlotFiles((prev) => { const next = { ...prev }; delete next[slotId]; return next })
                              setUploadSpeechSlots((prev) => { const next = new Set(prev); next.delete(slotId); return next })
                              setUploadLandscapeSlots((prev) => { const next = new Set(prev); next.delete(slotId); return next })
                            }}
                            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", marginLeft: "auto" }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                        <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={uploadSpeechSlots.has(slotId)}
                            onChange={(e) => {
                              setUploadSpeechSlots((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(slotId)
                                else next.delete(slotId)
                                return next
                              })
                            }}
                          />
                          Has speech
                        </label>
                        <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={uploadLandscapeSlots.has(slotId)}
                            onChange={(e) => {
                              setUploadLandscapeSlots((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(slotId)
                                else next.delete(slotId)
                                return next
                              })
                            }}
                          />
                          Landscape
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setUploadSlots((prev) => [...prev, (prev[prev.length - 1] ?? -1) + 1])}
                  style={{ background: "none", border: "1px dashed rgba(128,128,128,0.35)", borderRadius: 8, padding: "8px 16px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", marginBottom: 24 }}
                >
                  + Add another video
                </button>

                <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, border: "1px solid rgba(128,128,128,0.2)" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Transition between clips</p>
                  <select value={uploadTransition} onChange={(e) => setUploadTransition(e.target.value)} style={inputStyle}>
                    <option value="fade">Fade</option>
                    <option value="none">Cut (no transition)</option>
                    <option value="wipeLeft">Wipe left</option>
                    <option value="wipeRight">Wipe right</option>
                    <option value="slideLeft">Slide left</option>
                    <option value="slideRight">Slide right</option>
                    <option value="zoom">Zoom</option>
                  </select>
                </div>

                <input
                  ref={musicInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setMusicFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
                <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, border: "1px solid rgba(128,128,128,0.2)" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Music</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                      {musicFile ? `\u266a ${musicFile.name}` : "+ Upload your own"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMusicLibrary('upload')}
                      style={{
                        background: "var(--coral)",
                        border: "none",
                        borderRadius: 8,
                        padding: "9px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {libraryMusicName ? `\u266a ${libraryMusicName}` : "Browse music library"}
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                    Upload your own audio file. You are responsible for ensuring you have the rights to use it.
                  </p>

                  <input
                    ref={audioExtractInputRef}
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleExtractAudio(file)
                    }}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => audioExtractInputRef.current?.click()}
                    disabled={extractingAudio}
                    style={{
                      background: "none",
                      border: "1px solid rgba(128,128,128,0.3)",
                      borderRadius: 8,
                      padding: "9px 16px",
                      fontSize: 13,
                      color: "var(--ink)",
                      cursor: extractingAudio ? "not-allowed" : "pointer",
                      marginTop: 8,
                      opacity: extractingAudio ? 0.6 : 1,
                    }}
                  >
                    {extractingAudio
                      ? "Extracting audio..."
                      : extractedMusicPath
                      ? "\u266a Extracted audio ready"
                      : "+ Extract audio from a video"}
                  </button>
                  {extractAudioError && (
                    <p style={{ fontSize: 11, color: "var(--coral)", marginTop: 6 }}>{extractAudioError}</p>
                  )}
                </div>

                {uploadLandscapeSlots.size > 0 && (
                  <>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Landscape clips - how should they be handled?</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                      {[
                        { id: "crop", label: "Crop & zoom" },
                        { id: "blur", label: "Blurred bars" },
                        { id: "landscape", label: "Keep landscape shape" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setLandscapeHandling(opt.id as "crop" | "blur" | "landscape")}
                          style={{ padding: "8px 14px", borderRadius: 8, border: landscapeHandling === opt.id ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)", background: "var(--card-bg)", fontSize: 12, color: "var(--ink)", cursor: "pointer" }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Resolution</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  {[
                    { id: "high", label: "High (1080p)" },
                    { id: "low", label: "Low (faster, smaller)" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setUploadResolution(opt.id as "high" | "low")}
                      style={{ padding: "8px 14px", borderRadius: 8, border: uploadResolution === opt.id ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)", background: "var(--card-bg)", fontSize: 12, color: "var(--ink)", cursor: "pointer" }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <label style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={uploadAddCaptions}
                    onChange={(e) => setUploadAddCaptions(e.target.checked)}
                  />
                  Add captions
                </label>

                {uploadAddCaptions && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
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
                )}

                {uploadAddCaptions && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedCaptions(!showAdvancedCaptions)}
                      style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--ink)', cursor: 'pointer', marginBottom: 20 }}
                    >
                      {showAdvancedCaptions ? '\u2212 Hide advanced options' : '+ Advanced caption options'}
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
                  </>
                )}

                {uploadError && (
                  <p style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 16 }}>{uploadError}</p>
                )}

                {showUploadSpeechWarning && (
                  <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 8, border: "1px solid var(--coral)", background: "rgba(216,90,48,0.08)" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink)" }}>
                      Please check which clips have speech (text-to-speech captions) before continuing. Confirm your selections are correct.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setShowUploadSpeechWarning(false)}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(128,128,128,0.3)", background: "transparent", fontSize: 13, cursor: "pointer" }}
                      >
                        Go back and check
                      </button>
                      <button
                        onClick={() => { setShowUploadSpeechWarning(false); startUploadAndRender() }}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--coral)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                      >
                        Confirm & create video
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    const hasAnyFile = uploadSlots.some((id) => uploadSlotFiles[id])
                    if (uploading || extractingAudio || !hasAnyFile) return
                    setShowUploadSpeechWarning(true)
                  }}
                  disabled={uploading || extractingAudio || !uploadSlots.some((id) => uploadSlotFiles[id])}
                  style={{
                    display: "block",
                    backgroundColor: "var(--coral)",
                    color: "#fff",
                    padding: "14px 28px",
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    border: "none",
                    boxShadow: uploading || extractingAudio || !uploadSlots.some((id) => uploadSlotFiles[id]) ? "none" : "0 4px 14px rgba(216,90,48,0.35)",
                    cursor: uploading || extractingAudio ? "not-allowed" : "pointer",
                    opacity: uploading || extractingAudio || !uploadSlots.some((id) => uploadSlotFiles[id]) ? 0.5 : 1,
                  }}
                >
                  {uploading ? "Uploading..." : extractingAudio ? "Waiting for audio extraction..." : "Create video"}
                </button>
              </div>

              {renderId && (
                <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '32px' }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    Your video
                  </h3>
                  {renderStatus !== 'done' && renderStatus !== 'failed' && (
                    <>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                        Status: {renderStatus || 'starting'}... this usually takes a minute or two.
                      </p>
                      <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(128,128,128,0.2)', overflow: 'hidden' }}>
                        <div style={{ width: `${renderProgress}%`, height: '100%', background: 'var(--coral)', borderRadius: 999, transition: 'width 0.4s ease' }} />
                      </div>
                    </>
                  )}
                  {renderStatus === "failed" && (
                    <div>
                      <p style={{ fontSize: 13, color: "var(--coral)" }}>
                        {renderError && renderError.includes("No spoken audio") 
                          ? "One of your clips was marked as having speech, but Reelezy could not detect any. Try unchecking \"Has speech\" for that clip and rendering again."
                          : renderError || "Something went wrong rendering your video. Please try again."}
                      </p>
                    </div>
                  )}
                  {renderStatus === 'done' && outputUrl && (
                    <>
                      <video
                        controls
                        src={outputUrl}
                        style={{ width: '100%', maxWidth: 400, borderRadius: 12, marginTop: 12 }}
                      />
                      <button
                        onClick={() => downloadVideo(outputUrl, "reelezy-video.mp4")}
                        title="Download video"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 12,
                          marginRight: 8,
                          backgroundColor: "var(--coral)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          width: 38,
                          height: 38,
                          fontSize: 16,
                          cursor: "pointer",
                        }}
                      >
                        {'\u2b07'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {tab === "aiuploads" && (!realSubPlan || realSubStatus !== 'active') && (
            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Upload clips per filming step</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Video rendering is not available on the Free plan.
              </p>
              <a href="/plans" style={{ fontSize: 13, color: '#fff', background: 'var(--coral)', padding: '10px 18px', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
                View paid plans →
              </a>
            </div>
          )}

          {tab === "aiuploads" && realSubPlan && realSubStatus === 'active' && (
            <div>
              <div style={{ background: "var(--sand)", borderRadius: 16, padding: "32px", marginBottom: 24 }}>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Upload clips per filming step</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                  Pick one of your filmed ideas below, then upload a clip for each instruction step. Reelezy will stitch them in order and edit automatically.
                </p>

                {filmingItems.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Generate filming instructions for an idea first, using the checklist at the top of this tab.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                    {filmingItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setSelectedFilmingId(item.id); setStepUploads({}); setAiSpeechSteps(new Set()) }}
                        style={{ padding: "8px 14px", borderRadius: 8, border: selectedFilmingId === item.id ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)", background: "var(--card-bg)", fontSize: 12, color: "var(--ink)", cursor: "pointer" }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                )}

                {selectedFilmingId && (() => {
                  const item = filmingItems.find((f) => f.id === selectedFilmingId)
                  if (!item) return null
                  return (
                    <div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                        {item.checklist.map((step, i) => (
                          <div key={i} style={{ background: "var(--card-bg)", borderRadius: 10, padding: "12px 14px" }}>
                            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: 8 }}>{step}</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <input
                                type="file"
                                accept="video/*"
                                className="step-upload-input"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) setStepUploads((prev) => ({ ...prev, [i]: file }))
                                }}
                                style={{ fontSize: 11 }}
                              />
                              {stepUploads[i] && (
                                <span style={{ fontSize: 11, color: "var(--coral)" }}>✓ {stepUploads[i].name}</span>
                              )}
                              <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                                <input
                                  type="checkbox"
                                  checked={aiSpeechSteps.has(i)}
                                  onChange={(e) => {
                                    setAiSpeechSteps((prev) => {
                                      const next = new Set(prev)
                                      if (e.target.checked) next.add(i)
                                      else next.delete(i)
                                      return next
                                    })
                                  }}
                                />
                                Has speech
                              </label>
                              <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                                <input
                                  type="checkbox"
                                  checked={aiLandscapeSteps.has(i)}
                                  onChange={(e) => {
                                    setAiLandscapeSteps((prev) => {
                                      const next = new Set(prev)
                                      if (e.target.checked) next.add(i)
                                      else next.delete(i)
                                      return next
                                    })
                                  }}
                                />
                                Landscape
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, border: "1px solid rgba(128,128,128,0.2)" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Transition between clips</p>
                        <select value={aiTransition} onChange={(e) => setAiTransition(e.target.value)} style={inputStyle}>
                          <option value="fade">Fade</option>
                          <option value="none">Cut (no transition)</option>
                          <option value="wipeLeft">Wipe left</option>
                          <option value="wipeRight">Wipe right</option>
                          <option value="slideLeft">Slide left</option>
                          <option value="slideRight">Slide right</option>
                          <option value="zoom">Zoom</option>
                        </select>
                      </div>

                      <input
                        ref={musicInputRef}
                        type="file"
                        accept="audio/*"
                        onChange={(e) => setMusicFile(e.target.files?.[0] || null)}
                        style={{ display: "none" }}
                      />
                      <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, border: "1px solid rgba(128,128,128,0.2)" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Music</p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                            {musicFile ? `\u266a ${musicFile.name}` : "+ Upload your own"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowMusicLibrary('ai')}
                            style={{
                              background: "var(--coral)",
                              border: "none",
                              borderRadius: 8,
                              padding: "9px 16px",
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            {libraryMusicName ? `\u266a ${libraryMusicName}` : "Browse music library"}
                          </button>
                        </div>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                          Upload your own audio file. You are responsible for ensuring you have the rights to use it.
                        </p>

                        <input
                          ref={audioExtractInputRef}
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleExtractAudio(file)
                          }}
                          style={{ display: "none" }}
                        />
                        <button
                          type="button"
                          onClick={() => audioExtractInputRef.current?.click()}
                          disabled={extractingAudio}
                          style={{
                            background: "none",
                            border: "1px solid rgba(128,128,128,0.3)",
                            borderRadius: 8,
                            padding: "9px 16px",
                            fontSize: 13,
                            color: "var(--ink)",
                            cursor: extractingAudio ? "not-allowed" : "pointer",
                            marginTop: 8,
                            opacity: extractingAudio ? 0.6 : 1,
                          }}
                        >
                          {extractingAudio
                            ? "Extracting audio..."
                            : extractedMusicPath
                            ? "\u266a Extracted audio ready"
                            : "+ Extract audio from a video"}
                        </button>
                        {extractAudioError && (
                          <p style={{ fontSize: 11, color: "var(--coral)", marginTop: 6 }}>{extractAudioError}</p>
                        )}
                      </div>

                      {aiLandscapeSteps.size > 0 && (
                        <>
                          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Landscape clips - how should they be handled?</p>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                            {[
                              { id: "crop", label: "Crop & zoom" },
                              { id: "blur", label: "Blurred bars" },
                              { id: "landscape", label: "Keep landscape shape" },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setAiLandscapeHandling(opt.id as "crop" | "blur" | "landscape")}
                                style={{ padding: "8px 14px", borderRadius: 8, border: aiLandscapeHandling === opt.id ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)", background: "var(--card-bg)", fontSize: 12, color: "var(--ink)", cursor: "pointer" }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Resolution</p>
                      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        {[
                          { id: "high", label: "High (1080p)" },
                          { id: "low", label: "Low (faster, smaller)" },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setAiResolution(opt.id as "high" | "low")}
                            style={{ padding: "8px 14px", borderRadius: 8, border: aiResolution === opt.id ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)", background: "var(--card-bg)", fontSize: 12, color: "var(--ink)", cursor: "pointer" }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <label style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={aiAddCaptions}
                          onChange={(e) => setAiAddCaptions(e.target.checked)}
                        />
                        Add captions
                      </label>

                      {aiAddCaptions && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
                          {CAPTION_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => setAiCaptionPreset(preset.id)}
                              style={{ textAlign: "left", padding: "10px", borderRadius: 8, border: aiCaptionPreset === preset.id ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)", background: "var(--card-bg)", cursor: "pointer" }}
                            >
                              <p style={{ fontSize: 11, fontWeight: 600 }}>{preset.label}</p>
                            </button>
                          ))}
                        </div>
                      )}

                      {aiAddCaptions && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowAdvancedCaptions(!showAdvancedCaptions)}
                            style={{ background: "none", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "var(--ink)", cursor: "pointer", marginBottom: 20 }}
                          >
                            {showAdvancedCaptions ? "− Hide advanced options" : "+ Advanced caption options"}
                          </button>

                          {showAdvancedCaptions && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 20, background: "var(--card-bg)", padding: 16, borderRadius: 10 }}>
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
                                <select value={captionPosition} onChange={(e) => setCaptionPosition(e.target.value as "bottom" | "top" | "center")} style={inputStyle}>
                                  <option value="bottom">Bottom</option>
                                  <option value="center">Center</option>
                                  <option value="top">Top</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {showSpeechWarning && (
                        <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 8, border: "1px solid var(--coral)", background: "rgba(216,90,48,0.08)" }}>
                          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink)" }}>
                            Please check which clips have speech (text-to-speech captions) before continuing. Confirm your selections are correct.
                          </p>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => setShowSpeechWarning(false)}
                              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(128,128,128,0.3)", background: "transparent", fontSize: 13, cursor: "pointer" }}
                            >
                              Go back and check
                            </button>
                            <button
                              onClick={() => { setShowSpeechWarning(false); submitAiEditorUploads() }}
                              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--coral)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                            >
                              Confirm & create video
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          if (aiUploading || extractingAudio || Object.keys(stepUploads).length === 0) return
                          setShowSpeechWarning(true)
                        }}
                        disabled={aiUploading || extractingAudio || Object.keys(stepUploads).length === 0}
                        style={{ display: "block", backgroundColor: "var(--coral)", color: "#fff", padding: "14px 28px", borderRadius: 8, fontSize: 15, fontWeight: 700, border: "none", boxShadow: aiUploading || extractingAudio || Object.keys(stepUploads).length === 0 ? "none" : "0 4px 14px rgba(216,90,48,0.35)", cursor: aiUploading || extractingAudio ? "not-allowed" : "pointer", opacity: aiUploading || extractingAudio || Object.keys(stepUploads).length === 0 ? 0.5 : 1 }}
                      >
                        {aiUploading ? "Uploading..." : extractingAudio ? "Waiting for audio extraction..." : "Create video"}
                      </button>
                    </div>
                  )
                })()}
              </div>

              {aiRenderId && (
                <div style={{ background: "var(--sand)", borderRadius: 16, padding: "32px" }}>
                  <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Your video</h3>
                  {aiRenderStatus !== "done" && aiRenderStatus !== "failed" && (
                    <>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>Status: {aiRenderStatus || "starting"}...</p>
                      <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(128,128,128,0.2)', overflow: 'hidden' }}>
                        <div style={{ width: `${aiRenderProgress}%`, height: '100%', background: 'var(--coral)', borderRadius: 999, transition: 'width 0.4s ease' }} />
                      </div>
                    </>
                  )}
                  {aiRenderStatus === "failed" && (
                    <p style={{ fontSize: 13, color: "var(--coral)" }}>Something went wrong rendering your video.</p>
                  )}
                  {aiRenderStatus === "done" && aiOutputUrl && (
                    <>
                      <video controls src={aiOutputUrl} style={{ width: "100%", maxWidth: 400, borderRadius: 12, marginTop: 12 }} />
                      <button
                        onClick={() => downloadVideo(aiOutputUrl, "reelezy-video.mp4")}
                        title="Download video"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 12,
                          backgroundColor: "var(--coral)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          width: 38,
                          height: 38,
                          fontSize: 16,
                          cursor: "pointer",
                        }}
                      >
                        ⬇
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showMusicLibrary && (
        <div
          onClick={() => { previewAudioRef.current?.pause(); setPreviewingTrackId(null); setShowMusicLibrary(null) }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--card-bg)", borderRadius: 20, padding: "32px", maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
          >
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
              Music library
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              Browse licensed tracks and preview before adding them to your video.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MUSIC_LIBRARY_TRACKS.map((track) => (
                <div key={track.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--sand)", borderRadius: 10 }}>
                  <button
                    type="button"
                    onClick={() => togglePreviewTrack(track.id, track.url)}
                    style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "var(--coral)", color: "#fff", fontSize: 14, cursor: "pointer", flexShrink: 0 }}
                  >
                    {previewingTrackId === track.id ? "⏸" : "▶"}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{track.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{track.mood}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectLibraryTrack(track.id, track.name, track.url, showMusicLibrary)}
                    style={{ background: "none", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}
                  >
                    Use this track
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
