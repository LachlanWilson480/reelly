'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', fontSize: 14, fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' as const, color: '#F1EFE8', marginBottom: 16 }
const labelStyle = { fontSize: 13, fontWeight: 600, color: '#F1EFE8', marginBottom: 6, display: 'block' as const }
const sectionTitle = { fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginTop: 24, marginBottom: 12 }

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

  // Required
  const [businessName, setBusinessName] = useState('')
  const [industry, setIndustry] = useState('')
  const [suburb, setSuburb] = useState('')
  const [country, setCountry] = useState('AU')
  const [coreServices, setCoreServices] = useState('')

  // Optional
  const [tone, setTone] = useState('')
  const [customerDescription, setCustomerDescription] = useState('')
  const [keySellingPoint, setKeySellingPoint] = useState('')
  const [filmingComfort, setFilmingComfort] = useState('')
  const [onCameraPeople, setOnCameraPeople] = useState('')
  const [locationType, setLocationType] = useState('fixed')
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
    if (!businessName.trim() || !industry.trim() || !suburb.trim() || !coreServices.trim()) {
      setMessage('Please fill in your business name, industry, suburb and core services.')
      return
    }
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
      country,
      core_services: coreServices,
      tone,
      target_audience: customerDescription,
      key_selling_point: keySellingPoint,
      filming_comfort: filmingComfort,
      on_camera_people: onCameraPeople,
      location_type: locationType,
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
      router.push('/dashboard/ideas')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
        <Link href="/" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
          Reelezy
        </Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px 24px 64px' }}>
        <div style={{ maxWidth: 520, width: '100%' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 30, fontWeight: 700, marginBottom: 10, color: 'var(--ink)' }}>
              Let&apos;s get you set up
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Four quick fields and you&apos;re generating content ideas in under a minute.
            </p>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Required fields */}
            <div style={{ background: 'linear-gradient(135deg, #26215C 0%, #712B13 100%)', borderRadius: 16, padding: '24px', marginBottom: 16, border: 'none' }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(241,239,232,0.5)', marginBottom: 20 }}>The essentials</p>

              <Field label="Business name *" value={businessName} onChange={setBusinessName} placeholder="e.g. Jake's Plumbing" />
              <Field label="Industry *" value={industry} onChange={setIndustry} placeholder="e.g. hair salon, electrician, personal trainer" />
              <Field label="Core services or products *" value={coreServices} onChange={setCoreServices} placeholder="e.g. cuts, colours, balayage, extensions" textarea />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Country *</label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle}>
                    <option value="AU">Australia</option>
                    <option value="UK">United Kingdom</option>
                    <option value="US">United States</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Suburb / City *</label>
                  <input value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="e.g. Newtown" style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Optional section toggle */}
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              style={{ width: '100%', background: 'var(--sand)', border: '1px solid rgba(128,128,128,0.15)', borderRadius: 12, padding: '14px', color: 'var(--ink)', fontSize: 13, fontFamily: "'Inter', sans-serif", cursor: 'pointer', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>
                <span style={{ fontWeight: 600 }}>{showOptional ? '− Hide' : '+ Add'} additional details</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>optional - improves idea quality</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>can do this later in Settings</span>
            </button>

            {showOptional && (
              <div style={{ background: 'var(--sand)', borderRadius: 16, padding: '24px', marginBottom: 16, border: 'none' }}>

                <p style={sectionTitle}>Voice & audience</p>
                <Field label="Tone of voice" value={tone} onChange={setTone} placeholder="e.g. playful, professional, edgy" />
                <Field label="Ideal customer" value={customerDescription} onChange={setCustomerDescription} placeholder="Age range, lifestyle, what they're looking for" textarea />
                <Field label="What sells your business best?" value={keySellingPoint} onChange={setKeySellingPoint} placeholder="e.g. award-winning chef, handmade pasta, 20 years experience" textarea />

                <p style={sectionTitle}>Filming setup</p>
                <Field label="Filming comfort level" value={filmingComfort} onChange={setFilmingComfort} placeholder="e.g. just my phone, have a tripod and ring light" />
                <Field label="Who appears on camera?" value={onCameraPeople} onChange={setOnCameraPeople} placeholder="Names or roles" />
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block', color: '#F1EFE8' }}>Do customers come to you, or do you travel to them?</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[{ value: 'fixed', label: 'Fixed location' }, { value: 'mobile', label: 'Mobile' }, { value: 'both', label: 'Both' }].map((opt) => (
                      <button key={opt.value} type="button" onClick={() => setLocationType(opt.value)} style={{ padding: '9px 16px', borderRadius: 8, border: locationType === opt.value ? '2px solid var(--coral)' : '1px solid rgba(255,255,255,0.2)', background: locationType === opt.value ? 'rgba(216,90,48,0.15)' : 'var(--card-bg)', fontSize: 13, color: '#F1EFE8', cursor: 'pointer' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

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
                <Field label="What problem brings customers to you?" value={customerProblem} onChange={setCustomerProblem} textarea />
                <Field label="Where do customers usually find you?" value={customerSource} onChange={setCustomerSource} placeholder="Referrals, Instagram, Google, walk-ins" />
                <Field label="Common objections before booking" value={commonObjections} onChange={setCommonObjections} textarea />

                <p style={sectionTitle}>Services & offerings</p>
                <Field label="Signature/hero service" value={signatureService} onChange={setSignatureService} />
                <Field label="Price positioning" value={pricePositioning} onChange={setPricePositioning} placeholder="Budget, mid-range, premium" />
                <Field label="Current promotions" value={currentPromotions} onChange={setCurrentPromotions} />
                <Field label="Upcoming launches" value={upcomingLaunches} onChange={setUpcomingLaunches} />

                <p style={sectionTitle}>Content history</p>
                <Field label="Best-performing past content" value={pastContent} onChange={setPastContent} textarea />
                <Field label="Worst-performing / what to avoid" value={worstContent} onChange={setWorstContent} textarea />
                <Field label="Posting frequency" value={postingFrequency} onChange={setPostingFrequency} />
                <Field label="Preferred content formats" value={preferredFormats} onChange={setPreferredFormats} placeholder="Talking head, behind-the-scenes, tutorials" />
                <Field label="Competitor content you admire" value={competitorContent} onChange={setCompetitorContent} />

                <p style={sectionTitle}>Logistics</p>
                <Field label="Best days/times to film" value={bestFilmingTimes} onChange={setBestFilmingTimes} />
                <Field label="Equipment you have" value={equipment} onChange={setEquipment} placeholder="Ring light, tripod, mic, etc." />

                <p style={sectionTitle}>Local & seasonal</p>
                <Field label="Notable local events/seasons" value={localSeasonalContext} onChange={setLocalSeasonalContext} textarea />
                <Field label="Community ties" value={communityTies} onChange={setCommunityTies} placeholder="Local partnerships, sponsorships" />

                <p style={sectionTitle}>Anything else</p>
                <Field label="Notes" value={notes} onChange={setNotes} textarea />
              </div>
            )}

            {message && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' }}>{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '15px', borderRadius: 10, border: 'none', backgroundColor: 'var(--coral)', color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: "'Outfit', sans-serif", cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Setting up...' : 'Start generating ideas →'}
            </button>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 12 }}>
              You can update all of this anytime in Settings.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
