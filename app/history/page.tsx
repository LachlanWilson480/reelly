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
  checklist: string[] | null
  script: string | null
  caption: string | null
  created_at: string
}

type RenderRow = {
  id: string
  status: string
  output_url: string | null
  created_at: string
}

export default function HistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [ideas, setIdeas] = useState<IdeaRow[]>([])
  const [renders, setRenders] = useState<RenderRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getUser()
      const user = sessionData.user
      if (!user) {
        router.push('/login')
        return
      }

      const { data: ideaRows } = await supabase
        .from('generated_ideas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const { data: renderRows } = await supabase
        .from('renders')
        .select('id, status, output_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const parsedIdeas: IdeaRow[] = (ideaRows || []).map((row) => {
        const rawChecklist = row.checklist as { steps?: string[]; prep?: string[]; caption?: string; script?: string } | null
        return {
          ...row,
          checklist: rawChecklist?.steps || null,
          script: rawChecklist?.script || null,
          caption: rawChecklist?.caption || null,
        }
      })

      setIdeas(parsedIdeas)
      setRenders(renderRows || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />
  }

  const filmingItems = ideas.filter((i) => i.checklist && i.checklist.length > 0)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav style={{ padding: '24px 48px' }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600 }}>
            History
          </span>
        </nav>

        <div style={{ padding: '0 48px 80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'flex-start' }}>

          <div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Ideas Generated ({ideas.length})
            </h2>
            {ideas.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No ideas generated yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ideas.map((idea) => (
                <div key={idea.id} style={{ background: 'var(--sand)', borderRadius: 12, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedId(expandedId === idea.id ? null : idea.id)}
                    style={{ width: '100%', textAlign: 'left', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                        {idea.saved && '★ '}{idea.title}
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Filming Instructions ({filmingItems.length})
            </h2>
            {filmingItems.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No filming instructions generated yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filmingItems.map((idea) => (
                <div key={idea.id} style={{ background: 'var(--sand)', borderRadius: 12, overflow: 'hidden' }}>
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              Renders ({renders.length})
            </h2>
            {renders.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No videos rendered yet.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {renders.map((render) => (
                <div key={render.id} style={{ background: 'var(--sand)', borderRadius: 12, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedId(expandedId === `render-${render.id}` ? null : `render-${render.id}`)}
                    style={{ width: '100%', textAlign: 'left', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>
                        {render.status === 'done' ? '✓ Completed' : render.status === 'failed' ? '✕ Failed' : '⋯ ' + render.status}
                      </p>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {formatDate(render.created_at)}
                      </span>
                    </div>
                  </button>
                  {expandedId === `render-${render.id}` && render.output_url && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <video controls src={render.output_url} style={{ width: '100%', borderRadius: 8 }} />
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
