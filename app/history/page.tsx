'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

type IdeaRow = {
  id: string
  title: string
  hook: string
  description: string
  tags: string
  notes: string | null
  saved: boolean
  filming_cleared?: boolean | null
  source?: string | null
  checklist: string[] | null
  script: string | null
  caption: string | null
  created_at: string
}

type ScriptRow = {
  id: string
  topic: string
  script: string
  length: string | null
  style: string | null
  created_at: string
}

type RenderRow = {
  id: string
  status: string
  output_url: string | null
  created_at: string
  title?: string | null
  caption?: string | null
  tags?: string | null
}

export default function HistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [ideas, setIdeas] = useState<IdeaRow[]>([])
  const [renders, setRenders] = useState<RenderRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingBackId, setAddingBackId] = useState<string | null>(null)
  const [scripts, setScripts] = useState<ScriptRow[]>([])
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getUser()
      const user = sessionData.user
      if (!user) {
        router.push('/login')
        return
      }
      // Anything made before the last "Clear history" stays hidden here. It is not deleted, so saved ideas,
      // videos in Publish and monthly usage are untouched.
      const clearedAt = typeof user.user_metadata?.history_cleared_at === 'string' ? user.user_metadata.history_cleared_at : null
      const after = <T extends { created_at: string }>(rows: T[] | null) => (rows || []).filter((r) => !clearedAt || r.created_at > clearedAt)

      const { data: ideaRows } = await supabase
        .from('generated_ideas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const { data: renderRows } = await supabase
        .from('renders')
        .select('id, status, output_url, created_at, title, caption, tags')
        .eq('user_id', user.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })

      const parsedIdeas: IdeaRow[] = after(ideaRows).map((row) => {
        const rawChecklist = row.checklist as { steps?: string[]; prep?: string[]; caption?: string; script?: string } | null
        return {
          ...row,
          checklist: rawChecklist?.steps || null,
          script: rawChecklist?.script || null,
          caption: rawChecklist?.caption || null,
        }
      })

      const { data: scriptRows } = await supabase
        .from('generated_scripts')
        .select('id, topic, script, length, style, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setIdeas(parsedIdeas)
      setRenders(after(renderRows))
      setScripts(after(scriptRows))
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />
  }

  const filmingItems = ideas.filter((i) => i.checklist && i.checklist.length > 0)

  // An idea is back in My Ideas when it is saved and its filming instructions have not been cleared
  const isInMyIdeas = (idea: IdeaRow) => idea.saved === true && !(idea.checklist && idea.checklist.length > 0 && idea.filming_cleared === true)

  const addBackToMyIdeas = async (idea: IdeaRow) => {
    setAddingBackId(idea.id)
    const { error } = await supabase.from('generated_ideas').update({ saved: true, filming_cleared: false }).eq('id', idea.id)
    if (error) {
      setAddingBackId(null)
      alert('Could not add this idea back. Please try again.')
      return
    }
    if (idea.source === 'script') {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) await supabase.from('generated_scripts').update({ dismissed: false }).eq('user_id', userData.user.id).eq('topic', idea.title)
    }
    setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, saved: true, filming_cleared: false } : i))
    setAddingBackId(null)
  }

  const renderAddBack = (idea: IdeaRow) => isInMyIdeas(idea) ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>In My Ideas</span>
      <button onClick={() => router.push('/dashboard/myideas')} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--coral)', cursor: 'pointer' }}>View my videos</button>
    </div>
  ) : (
    <button
      onClick={() => addBackToMyIdeas(idea)}
      disabled={addingBackId === idea.id}
      style={{ marginTop: 12, background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: addingBackId === idea.id ? 'not-allowed' : 'pointer', opacity: addingBackId === idea.id ? 0.7 : 1 }}
    >
      {addingBackId === idea.id ? 'Adding...' : 'Add back to my ideas'}
    </button>
  )

  const clearHistory = async () => {
    setClearing(true)
    setClearError('')
    const { error } = await supabase.auth.updateUser({ data: { history_cleared_at: new Date().toISOString() } })
    setClearing(false)
    if (error) { setClearError('Could not clear your history. Please try again.'); return }
    setIdeas([]); setRenders([]); setScripts([]); setExpandedId(null); setConfirmClear(false)
  }
  const nothingToClear = ideas.length === 0 && renders.length === 0 && scripts.length === 0

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav style={{ padding: '24px 48px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 22, fontWeight: 600 }}>
              History
            </span>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Scripts generated are shown at the bottom of the page.</p>
          </div>
          <button
            type="button"
            onClick={() => { setClearError(''); setConfirmClear(true) }}
            disabled={nothingToClear}
            style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: nothingToClear ? 'var(--text-muted)' : 'var(--ink)', cursor: nothingToClear ? 'not-allowed' : 'pointer', opacity: nothingToClear ? 0.6 : 1 }}
          >
            Clear history
          </button>
        </nav>
        {confirmClear && (
          <div role="dialog" aria-modal="true" aria-label="Clear history?" onClick={() => !clearing && setConfirmClear(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg, #fff)', color: 'var(--ink)', borderRadius: 4, padding: 24, width: '100%', maxWidth: 400 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Clear history?</p>
              <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                This wipes every idea, set of filming instructions, render and script from this page. It cannot be undone.
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                Ideas in My Ideas and videos in Publish stay where they are.
              </p>
              {clearError && <p role="alert" style={{ margin: '10px 0 0', fontSize: 12, color: '#d92d20' }}>{clearError}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button type="button" onClick={() => setConfirmClear(false)} disabled={clearing} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={() => void clearHistory()} disabled={clearing} style={{ background: '#d92d20', border: 'none', borderRadius: 4, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: clearing ? 'wait' : 'pointer', opacity: clearing ? 0.7 : 1 }}>{clearing ? 'Clearing...' : 'Clear history'}</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: '0 48px 80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'flex-start' }}>

          <div>
            <h2 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Ideas Generated ({ideas.length})
            </h2>
            {ideas.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No ideas generated yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ideas.map((idea) => (
                <div key={idea.id} style={{ background: 'var(--sand)', borderRadius: 4, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedId(expandedId === idea.id ? null : idea.id)}
                    style={{ width: '100%', textAlign: 'left', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                        {idea.title}
                      </p>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {formatDate(idea.created_at)}
                      </span>
                    </div>
                  </button>
                  {expandedId === idea.id && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>{idea.hook}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>{idea.description}</p>
                      <p style={{ fontSize: 11, color: 'var(--coral)' }}>{idea.tags}</p>
                      {idea.notes && (
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, fontStyle: 'italic' }}>Notes: {idea.notes}</p>
                      )}
                      {renderAddBack(idea)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Filming Instructions ({filmingItems.length})
            </h2>
            {filmingItems.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No filming instructions generated yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filmingItems.map((idea) => (
                <div key={idea.id} style={{ background: 'var(--sand)', borderRadius: 4, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedId(expandedId === `film-${idea.id}` ? null : `film-${idea.id}`)}
                    style={{ width: '100%', textAlign: 'left', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{idea.title}</p>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {formatDate(idea.created_at)}
                      </span>
                    </div>
                  </button>
                  {expandedId === `film-${idea.id}` && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {idea.checklist?.map((step, i) => (
                          <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', gap: 6 }}>
                            <span style={{ color: 'var(--coral)', flexShrink: 0 }}>•</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                      {renderAddBack(idea)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Renders ({renders.length})
            </h2>
            {renders.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No videos rendered yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {renders.map((render) => (
                <div key={render.id} style={{ background: 'var(--sand)', borderRadius: 4, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedId(expandedId === `render-${render.id}` ? null : `render-${render.id}`)}
                    style={{ width: '100%', textAlign: 'left', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>
                        {render.title || (render.status === 'done' ? 'Completed' : render.status === 'failed' ? 'Failed' : render.status === 'cleared' ? 'Removed from scheduler' : render.status)}
                      </p>
                      <p style={{ fontSize: 11, color: render.status === 'cleared' ? 'var(--text-muted)' : render.status === 'done' ? 'var(--coral)' : 'var(--text-secondary)' }}>
                        {render.status === 'cleared' ? 'Cleared' : render.status === 'done' ? 'Ready to post' : render.status}
                      </p>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {formatDate(render.created_at)}
                      </span>
                    </div>
                  </button>
                  {expandedId === `render-${render.id}` && (
                    <div style={{ padding: '0 16px 16px' }}>
                      {render.output_url && (
                        <video controls src={render.output_url} style={{ width: '100%', borderRadius: 4, marginBottom: 10 }} />
                      )}
                      {render.title && <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{render.title}</p>}
                      {render.caption && <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>{render.caption}</p>}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {render.output_url && (
                          <button
                            onClick={async () => {
                              const res = await fetch(render.output_url!)
                              const blob = await res.blob()
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = 'reelezy-video.mp4'
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              URL.revokeObjectURL(url)
                            }}
                            style={{ background: 'var(--coral)', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Download
                          </button>
                        )}
                        {render.status === 'cleared' && (
                          <button
                            onClick={async () => {
                              await supabase.from('renders').update({ status: 'done' }).eq('id', render.id)
                              setRenders((prev) => prev.map((r) => r.id === render.id ? { ...r, status: 'done' } : r))
                            }}
                            style={{ background: 'none', border: '1px solid var(--coral)', color: 'var(--coral)', borderRadius: 4, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Restore to scheduler
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontFamily: "var(--font-geist-sans), 'Inter', sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Scripts ({scripts.length})
            </h2>
            {scripts.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No scripts generated yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scripts.map((s) => (
                <div key={s.id} style={{ background: 'var(--sand)', borderRadius: 4, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedId(expandedId === `script-${s.id}` ? null : `script-${s.id}`)}
                    style={{ width: '100%', textAlign: 'left', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{s.topic}</p>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {formatDate(s.created_at)}
                      </span>
                    </div>
                    {(s.length || s.style) && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {[s.length, s.style].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </button>
                  {expandedId === `script-${s.id}` && (
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {s.script
                        .split(/(?<=[.!?])\s+/)
                        .map((sentence, i, arr) => (
                          <div key={i} style={{ paddingTop: i === 0 ? 0 : 10, paddingBottom: 10, borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{sentence}</p>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
