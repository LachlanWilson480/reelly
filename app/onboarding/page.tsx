'use client'

import Link from 'next/link'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', fontSize: 14, fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' as const, color: '#F1EFE8', marginBottom: 16 }
const labelStyle = { fontSize: 13, fontWeight: 600, color: '#F1EFE8', marginBottom: 6, display: 'block' as const }
const sectionTitle = { fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: '#F1EFE8', marginTop: 24, marginBottom: 12, opacity: 0.9 }

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

export default function OnboardingPage() {
  const router = useRouter()
  const [showOptional, setShowOptional] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [businessName, setBusinessName] = useState('')
  const [industry, setIndustry] = useState('')
  const [suburb, setSuburb] = useState('')
  const [tone, setTone] = useState('')
  const [customerDescription, setCustomerDescription] = useState('')
  const [coreServices, setCoreServices] = useState('')
  const [filmingComfort, setFilmingComfort] = useState('')
  const [onCameraPeople, setOnCameraPeople] = useState('')
  const [locationType, setLocationType] = useState('fixed')
  const [videosPerWeek, setVideosPerWeek] = useState('3')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setMessage('You must be logged in to complete onboarding.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('business_profiles').insert({
      user_id: user.id,
      business_name: businessName,
      industry,
      suburb,
      tone,
      target_audience: customerDescription,
      core_services: coreServices,
      filming_comfort: filmingComfort,
      on_camera_people: onCameraPeople,
      location_type: locationType,
      videos_per_week: Math.max(1, Math.min(7, parseInt(videosPerWeek, 10) || 3)),
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

    setLoading(false)

    localStorage.setItem('reelezy-has-logged-in', 'true')

    if (error) {
      setMessage(error.message)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-offset, 56px)' }}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <Link href="/" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
            Reelezy
          </Link>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 24px 48px' }}>
          <div style={{ background: 'linear-gradient(135deg, #26215C, #712B13)', borderRadius: 24, padding: '48px 40px', maxWidth: 560, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 26, fontWeight: 600, color: '#F1EFE8', marginBottom: 8 }}>
              Tell us about your business
            </h1>
            <p style={{ fontSize: 14, color: '#D3D1C7', marginBottom: 28 }}>
              These help us generate content ideas made for you. The essentials below are required  -  everything else can be added now or later for even better results.
            </p>

            <form onSubmit={handleSubmit}>
              <Field label="Business name" value={businessName} onChange={setBusinessName} />
              <Field label="Industry" value={industry} onChange={setIndustry} placeholder="e.g. hair salon, tattoo studio, wedding vendor" />
              <Field label="Suburb" value={suburb} onChange={setSuburb} placeholder="e.g. Newtown, Bondi, Parramatta" />
              <Field label="Tone of voice" value={tone} onChange={setTone} placeholder="e.g. playful, professional, edgy" />
              <Field label="Who is your ideal customer?" value={customerDescription} onChange={setCustomerDescription} placeholder="Age range, lifestyle, what they're looking for" textarea />
              <Field label="Core services or products" value={coreServices} onChange={setCoreServices} textarea />
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>Do customers come to you, or do you travel to them? *</label>
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
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "block" }}>How many videos do you want to make per week?</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={videosPerWeek}
                  onChange={(e) => setVideosPerWeek(e.target.value)}
                  onBlur={() => {
                    const clamped = Math.max(1, Math.min(7, parseInt(videosPerWeek, 10) || 3))
                    setVideosPerWeek(String(clamped))
                  }}
                  style={{ width: 100, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(128,128,128,0.25)", background: "var(--card-bg)", fontSize: 14, color: "var(--ink)" }}
                />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Note: Basic plan generates a fixed 3 ideas per batch regardless of this number. Mid plan uses this number exactly.</p>
              </div>
              <Field label="Filming comfort level" value={filmingComfort} onChange={setFilmingComfort} placeholder="e.g. just my phone, hired videographer, studio setup" />
              <Field label="Who appears on camera?" value={onCameraPeople} onChange={setOnCameraPeople} placeholder="Names/roles" />

              <button
                type="button"
                onClick={() => setShowOptional(!showOptional)}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '10px 16px', color: '#F1EFE8', fontSize: 13, fontFamily: "'Inter', sans-serif", cursor: 'pointer', marginTop: 8, marginBottom: 8 }}
              >
                {showOptional ? '− Hide optional details' : '+ Add more details (optional, improves results)'}
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
                  <Field label="Where do customers usually find you?" value={customerSource} onChange={setCustomerSource} placeholder="Referrals, Instagram, Google, walk-ins" />
                  <Field label="Common objections before booking" value={commonObjections} onChange={setCommonObjections} textarea />

                  <p style={sectionTitle}>Services & offerings</p>
                  <Field label="Signature/hero service" value={signatureService} onChange={setSignatureService} />
                  <Field label="Price positioning" value={pricePositioning} onChange={setPricePositioning} placeholder="Budget, mid-range, premium" />
                  <Field label="Current promotions" value={currentPromotions} onChange={setCurrentPromotions} />
                  <Field label="Upcoming launches" value={upcomingLaunches} onChange={setUpcomingLaunches} />

                  <p style={sectionTitle}>Content history</p>
                  <Field label="Best-performing past content" value={pastContent} onChange={setPastContent} placeholder="Links or descriptions" textarea />
                  <Field label="Worst-performing / what to avoid" value={worstContent} onChange={setWorstContent} textarea />
                  <Field label="Current posting frequency" value={postingFrequency} onChange={setPostingFrequency} />
                  <Field label="Preferred content formats" value={preferredFormats} onChange={setPreferredFormats} placeholder="Talking head, behind-the-scenes, transformations, tutorials" />
                  <Field label="Competitor content you admire" value={competitorContent} onChange={setCompetitorContent} />

                  <p style={sectionTitle}>Logistics & filming</p>
                  <Field label="Best days/times to film" value={bestFilmingTimes} onChange={setBestFilmingTimes} />
                  <Field label="Equipment you already have" value={equipment} onChange={setEquipment} placeholder="Ring light, tripod, mic, etc." />

                  <p style={sectionTitle}>Local & seasonal context</p>
                  <Field label="Notable local events/seasons for your business" value={localSeasonalContext} onChange={setLocalSeasonalContext} placeholder="e.g. wedding season, formal season" textarea />
                  <Field label="Community ties" value={communityTies} onChange={setCommunityTies} placeholder="Local partnerships, sponsorships, charity work" />

                  <p style={sectionTitle}>Anything else</p>
                  <Field label="Notes" value={notes} onChange={setNotes} textarea />
                </div>
              )}

              <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: 8, border: 'none', backgroundColor: 'var(--coral)', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: 'pointer', opacity: loading ? 0.7 : 1, marginTop: 16 }}>
                {loading ? 'Saving...' : 'Complete setup'}
              </button>
            </form>
            {message && (
              <p style={{ marginTop: 20, fontSize: 13, color: '#F1EFE8', textAlign: 'center' }}>
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
