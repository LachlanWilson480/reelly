'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function SettingsPage() {
  const router = useRouter()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<'profile' | 'account' | 'notifications' | 'billing' | 'danger'>('profile')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [logoUrl, setLogoUrl] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [businessName, setBusinessName] = useState('')
  const [industry, setIndustry] = useState('')
  const [suburb, setSuburb] = useState('')
  const [tone, setTone] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [coreServices, setCoreServices] = useState('')
  const [filmingComfort, setFilmingComfort] = useState('')
  const [locationType, setLocationType] = useState('fixed')
  const [videosPerWeek, setVideosPerWeek] = useState(3)
  const [onCameraPeople, setOnCameraPeople] = useState('')

  const [website, setWebsite] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')
  const [tiktokHandle, setTiktokHandle] = useState('')
  const [yearsInBusiness, setYearsInBusiness] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [brandPersonality, setBrandPersonality] = useState('')
  const [wordsToAvoid, setWordsToAvoid] = useState('')
  const [referenceBrand, setReferenceBrand] = useState('')
  const [taglines, setTaglines] = useState('')
  const [brandColors, setBrandColors] = useState('')
  const [customerProblem, setCustomerProblem] = useState('')
  const [customerSource, setCustomerSource] = useState('')
  const [commonObjections, setCommonObjections] = useState('')
  const [signatureService, setSignatureService] = useState('')
  const [pricePositioning, setPricePositioning] = useState('')
  const [currentPromotions, setCurrentPromotions] = useState('')
  const [upcomingLaunches, setUpcomingLaunches] = useState('')
  const [pastContent, setPastContent] = useState('')
  const [worstContent, setWorstContent] = useState('')
  const [postingFrequency, setPostingFrequency] = useState('')
  const [preferredFormats, setPreferredFormats] = useState('')
  const [competitorContent, setCompetitorContent] = useState('')
  const [bestFilmingTimes, setBestFilmingTimes] = useState('')
  const [equipment, setEquipment] = useState('')
  const [localSeasonalContext, setLocalSeasonalContext] = useState('')
  const [communityTies, setCommunityTies] = useState('')
  const [notes, setNotes] = useState('')
  const [showOptional, setShowOptional] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const [notifyRenderComplete, setNotifyRenderComplete] = useState(true)
  const [notifyWeeklyReminder, setNotifyWeeklyReminder] = useState(true)
  const [savingNotifications, setSavingNotifications] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getUser()
      const user = sessionData.user

      if (!user) {
        router.push('/login')
        return
      }

      setEmail(user.email || '')
      setUserId(user.id)

      const { data } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setLogoUrl(data.logo_url || '')
        setBusinessName(data.business_name || '')
        setIndustry(data.industry || '')
        setSuburb(data.suburb || '')
        setTone(data.tone || '')
        setTargetAudience(data.target_audience || '')
        setCoreServices(data.core_services || '')
        setFilmingComfort(data.filming_comfort || '')
        setLocationType(data.location_type || 'fixed')
        setVideosPerWeek(data.videos_per_week || 3)
        setOnCameraPeople(data.on_camera_people || '')
        setWebsite(data.website || '')
        setInstagramHandle(data.instagram_handle || '')
        setTiktokHandle(data.tiktok_handle || '')
        setYearsInBusiness(data.years_in_business || '')
        setTeamSize(data.team_size || '')
        setBrandPersonality(data.brand_personality || '')
        setWordsToAvoid(data.words_to_avoid || '')
        setReferenceBrand(data.reference_brand || '')
        setTaglines(data.taglines || '')
        setBrandColors(data.brand_colors || '')
        setCustomerProblem(data.customer_problem || '')
        setCustomerSource(data.customer_source || '')
        setCommonObjections(data.common_objections || '')
        setSignatureService(data.signature_service || '')
        setPricePositioning(data.price_positioning || '')
        setCurrentPromotions(data.current_promotions || '')
        setUpcomingLaunches(data.upcoming_launches || '')
        setPastContent(data.past_content || '')
        setWorstContent(data.worst_content || '')
        setPostingFrequency(data.posting_frequency || '')
        setPreferredFormats(data.preferred_formats || '')
        setCompetitorContent(data.competitor_content || '')
        setBestFilmingTimes(data.best_filming_times || '')
        setEquipment(data.equipment || '')
        setLocalSeasonalContext(data.local_seasonal_context || '')
        setCommunityTies(data.community_ties || '')
        setNotes(data.notes || '')
        setNotifyRenderComplete(data.notify_render_complete ?? true)
        setNotifyWeeklyReminder(data.notify_weekly_reminder ?? true)
      }

      setLoading(false)
    }
    load()
  }, [router])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    setUploadingLogo(true)
    const path = `${userId}/logo-${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage.from('business-logos').upload(path, file, { upsert: true })

    if (uploadError) {
      setMessage('Failed to upload logo.')
      setUploadingLogo(false)
      return
    }

    const { data: urlData } = supabase.storage.from('business-logos').getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    await supabase.from('business_profiles').update({ logo_url: publicUrl }).eq('user_id', userId)

    setLogoUrl(publicUrl)
    setUploadingLogo(false)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('business_profiles')
      .update({
        business_name: businessName,
        industry,
        suburb,
        tone,
        target_audience: targetAudience,
        core_services: coreServices,
        filming_comfort: filmingComfort,
        location_type: locationType,
        videos_per_week: videosPerWeek,
        on_camera_people: onCameraPeople,
        website,
        instagram_handle: instagramHandle,
        tiktok_handle: tiktokHandle,
        years_in_business: yearsInBusiness,
        team_size: teamSize,
        brand_personality: brandPersonality,
        words_to_avoid: wordsToAvoid,
        reference_brand: referenceBrand,
        taglines,
        brand_colors: brandColors,
        customer_problem: customerProblem,
        customer_source: customerSource,
        common_objections: commonObjections,
        signature_service: signatureService,
        price_positioning: pricePositioning,
        current_promotions: currentPromotions,
        upcoming_launches: upcomingLaunches,
        past_content: pastContent,
        worst_content: worstContent,
        posting_frequency: postingFrequency,
        preferred_formats: preferredFormats,
        competitor_content: competitorContent,
        best_filming_times: bestFilmingTimes,
        equipment,
        local_seasonal_context: localSeasonalContext,
        community_ties: communityTies,
        notes,
      })
      .eq('user_id', userId)

    setSaving(false)
    setMessage(error ? 'Something went wrong saving your profile.' : 'Saved.')
  }

  const handleChangePassword = async () => {
    if (!newPassword) return
    setChangingPassword(true)
    setPasswordMessage('')

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    setChangingPassword(false)
    setPasswordMessage(error ? error.message : 'Password updated.')
    if (!error) setNewPassword('')
  }

  const handleSaveNotifications = async () => {
    setSavingNotifications(true)

    await supabase
      .from('business_profiles')
      .update({
        notify_render_complete: notifyRenderComplete,
        notify_weekly_reminder: notifyWeeklyReminder,
      })
      .eq('user_id', userId)

    setSavingNotifications(false)
  }

  const handleExportData = async () => {
    const { data } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    const exportData = { email, business_profile: data }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reelly-my-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    setDeleteMessage('')

    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })

    const ok = res.ok

    if (!ok) {
      setDeleting(false)
      setDeleteMessage('Something went wrong deleting your account. Please try again or contact support.')
      return
    }

    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />
  }

  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.25)', background: 'var(--card-bg)', fontSize: 14, fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' as const, color: 'var(--ink)', marginBottom: 14 }
  const labelStyle = { fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 5, display: 'block' as const }
  const sectionTitle = { fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 10, opacity: 0.85 }

  const Field = ({ label, value, onChange, placeholder, textarea }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder} style={{ ...inputStyle, resize: 'vertical' as const }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
      )}
    </div>
  )

  const Toggle = ({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
      <div style={{ paddingRight: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          border: 'none',
          background: checked ? 'var(--coral)' : 'rgba(128,128,128,0.3)',
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: checked ? 20 : 2, transition: 'left 0.15s ease' }} />
      </button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)', padding: '48px', maxWidth: 700, margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 24 }}>
          Settings
        </h1>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(128,128,128,0.15)', marginBottom: 28, flexWrap: 'wrap' }}>
          {(['profile', 'account', 'notifications', 'billing', 'danger'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: section === s ? '2px solid var(--coral)' : '2px solid transparent',
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: section === s ? 600 : 500,
                color: section === s ? 'var(--ink)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                textTransform: 'capitalize',
              }}
            >
              {s === 'danger' ? 'Danger zone' : s}
            </button>
          ))}
        </div>

        {section === 'profile' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--sand)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Business logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No logo</span>
                )}
              </div>
              <div>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}
                >
                  {uploadingLogo ? 'Uploading...' : 'Upload logo'}
                </button>
              </div>
            </div>

            <Field label="Business name" value={businessName} onChange={setBusinessName} />
            <Field label="Industry" value={industry} onChange={setIndustry} />
            <Field label="Suburb" value={suburb} onChange={setSuburb} />
            <Field label="Tone of voice" value={tone} onChange={setTone} />
            <Field label="Ideal customer" value={targetAudience} onChange={setTargetAudience} textarea />
            <Field label="Core services or products" value={coreServices} onChange={setCoreServices} textarea />
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>Do customers come to you, or do you travel to them?</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { value: "fixed", label: "Fixed location (shop/studio)" },
                  { value: "mobile", label: "Mobile (I travel to customers)" },
                  { value: "both", label: "Both" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLocationType(opt.value)}
                    style={{ padding: "10px 16px", borderRadius: 8, border: locationType === opt.value ? "2px solid var(--coral)" : "1px solid rgba(128,128,128,0.25)", background: locationType === opt.value ? "rgba(216,90,48,0.08)" : "var(--card-bg)", fontSize: 13, color: "var(--ink)", cursor: "pointer" }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Filming comfort level" value={filmingComfort} onChange={setFilmingComfort} />
            <Field label="Who appears on camera?" value={onCameraPeople} onChange={setOnCameraPeople} />

            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: '9px 14px', color: 'var(--ink)', fontSize: 13, fontFamily: "'Inter', sans-serif", cursor: 'pointer', marginTop: 4, marginBottom: 8 }}
            >
              {showOptional ? '− Hide additional details' : '+ Show more details (improves your idea and filming generations)'}
            </button>

            {showOptional && (
              <div>
                <p style={sectionTitle}>Business basics</p>
                <Field label="Website" value={website} onChange={setWebsite} />
                <Field label="Instagram handle" value={instagramHandle} onChange={setInstagramHandle} />
                <Field label="TikTok handle" value={tiktokHandle} onChange={setTiktokHandle} />
                <Field label="Years in business" value={yearsInBusiness} onChange={setYearsInBusiness} />
                <Field label="Team size" value={teamSize} onChange={setTeamSize} />

                <p style={sectionTitle}>Brand identity</p>
                <Field label="Brand personality in 3 words" value={brandPersonality} onChange={setBrandPersonality} />
                <Field label="Words/phrases to avoid" value={wordsToAvoid} onChange={setWordsToAvoid} />
                <Field label="A brand whose style you admire" value={referenceBrand} onChange={setReferenceBrand} />
                <Field label="Taglines you use" value={taglines} onChange={setTaglines} />
                <Field label="Brand colors/aesthetic" value={brandColors} onChange={setBrandColors} />

                <p style={sectionTitle}>Audience</p>
                <Field label="What problem/desire brings customers to you?" value={customerProblem} onChange={setCustomerProblem} textarea />
                <Field label="Where do customers usually find you?" value={customerSource} onChange={setCustomerSource} />
                <Field label="Common objections before booking" value={commonObjections} onChange={setCommonObjections} textarea />

                <p style={sectionTitle}>Services & offerings</p>
                <Field label="Signature/hero service" value={signatureService} onChange={setSignatureService} />
                <Field label="Price positioning" value={pricePositioning} onChange={setPricePositioning} />
                <Field label="Current promotions" value={currentPromotions} onChange={setCurrentPromotions} />
                <Field label="Upcoming launches" value={upcomingLaunches} onChange={setUpcomingLaunches} />

                <p style={sectionTitle}>Content history</p>
                <Field label="Best-performing past content" value={pastContent} onChange={setPastContent} textarea />
                <Field label="Worst-performing / what to avoid" value={worstContent} onChange={setWorstContent} textarea />
                <Field label="Posting frequency" value={postingFrequency} onChange={setPostingFrequency} />
                <Field label="Preferred content formats" value={preferredFormats} onChange={setPreferredFormats} />
                <Field label="Competitor content you admire" value={competitorContent} onChange={setCompetitorContent} />

                <p style={sectionTitle}>Logistics & filming</p>
                <Field label="Best days/times to film" value={bestFilmingTimes} onChange={setBestFilmingTimes} />
                <Field label="Equipment you already have" value={equipment} onChange={setEquipment} />

                <p style={sectionTitle}>Local & seasonal context</p>
                <Field label="Notable local events/seasons" value={localSeasonalContext} onChange={setLocalSeasonalContext} textarea />
                <Field label="Community ties" value={communityTies} onChange={setCommunityTies} />

                <p style={sectionTitle}>Notes</p>
                <Field label="Anything else" value={notes} onChange={setNotes} textarea />
              </div>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, marginTop: 16, display: 'block' }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            {message && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>{message}</p>}
          </div>
        )}

        {section === 'account' && (
          <div>
            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px', marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                Email
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{email}</p>
            </div>

            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px' }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
                Change password
              </h3>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                style={inputStyle}
              />
              <button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword}
                style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: changingPassword || !newPassword ? 'not-allowed' : 'pointer', opacity: changingPassword || !newPassword ? 0.5 : 1 }}
              >
                {changingPassword ? 'Updating...' : 'Update password'}
              </button>
              {passwordMessage && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10 }}>{passwordMessage}</p>}
            </div>
          </div>
        )}

        {section === 'notifications' && (
          <div>
            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px' }}>
              <Toggle
                label="Render complete"
                desc="Get an email when your video finishes rendering."
                checked={notifyRenderComplete}
                onChange={setNotifyRenderComplete}
              />
              <Toggle
                label="Weekly content reminder"
                desc="A gentle nudge if you haven't generated content in a while."
                checked={notifyWeeklyReminder}
                onChange={setNotifyWeeklyReminder}
              />
            </div>
            <button
              onClick={handleSaveNotifications}
              disabled={savingNotifications}
              style={{ backgroundColor: 'var(--coral)', color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: 16, opacity: savingNotifications ? 0.7 : 1 }}
            >
              {savingNotifications ? 'Saving...' : 'Save preferences'}
            </button>
          </div>
        )}

        {section === 'billing' && (
          <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Billing management is coming soon.
            </p>
          </div>
        )}

        {section === 'danger' && (
          <div>
            <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px', marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
                Export your data
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                Download a copy of your account and business profile data as a JSON file.
              </p>
              <button
                onClick={handleExportData}
                style={{ background: 'none', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: '10px 18px', fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}
              >
                Export my data
              </button>
            </div>

            <div style={{ background: 'rgba(216,90,48,0.08)', border: '1px solid rgba(216,90,48,0.3)', borderRadius: 16, padding: '24px' }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--coral)' }}>
                Delete account
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                This permanently deletes your account and business profile. This cannot be undone. Type DELETE to confirm.
              </p>
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE"
                style={{ ...inputStyle, maxWidth: 200 }}
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                style={{
                  backgroundColor: 'var(--coral)',
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: deleteConfirm !== 'DELETE' ? 'not-allowed' : 'pointer',
                  opacity: deleteConfirm !== 'DELETE' ? 0.5 : 1,
                  display: 'block',
                }}
              >
                {deleting ? 'Deleting...' : 'Delete my account'}
              </button>
              {deleteMessage && <p style={{ fontSize: 13, color: 'var(--coral)', marginTop: 10 }}>{deleteMessage}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
