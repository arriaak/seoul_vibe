import { useState, useEffect, useRef } from 'react'
import VibeMap from './VibeMap'
import './App.css'

const VIBES = ['nightlife', 'chill', 'trendy']

const VIBE_SCORE_KEY = {
  nightlife: 'vibe_nightlife',
  chill: 'vibe_chill',
  trendy: 'vibe_trendy',
}

const VIBE_COLOR = {
  nightlife: '#a855f7',
  chill: '#38bdf8',
  trendy: '#f472b6',
}

const STOP_COLOR = { cafe: '#38bdf8', restaurant: '#f472b6', bar: '#a855f7' }
const STOP_ICON  = { cafe: '☕', restaurant: '🍽️', bar: '🍺' }

const TRANSLATIONS = {
  en: {
    subtitle: 'Explore Seoul neighborhoods by vibe',
    vibeLabels: { nightlife: 'Nightlife', chill: 'Chill', trendy: 'Trendy' },
    modeExplore: 'Explore',
    modePlan: 'Plan',
    stats: {
      day_pop: 'Daytime visitors', night_pop: 'Nighttime visitors',
      businesses: 'Businesses', young_ratio: 'Young ratio',
      cafes: 'Cafes', bars: 'Bars',
    },
    placesTitle:  (name) => `${name} — Top Picks`,
    findingSpots: 'Finding the best spots...',
    noPlaces:     'No places found.',
    openNaver:    'Open in Naver Maps',
    loading:      'Loading...',
    vibeKey: {
      heading:   'How vibe scores work',
      nightlife: { label: 'Nightlife', desc: 'Bar density + nighttime foot traffic. Higher = livelier after dark.' },
      chill:     { label: 'Chill',     desc: 'Café concentration across the district. Higher = more spots to slow down.' },
      trendy:    { label: 'Trendy',    desc: 'Young demographic share × business density. Higher = youthful, buzzing energy.' },
    },
    plan: {
      title:           'Plan Itinerary',
      energy:          'Energy',
      time:            'Time',
      mood:            'Mood',
      energyOpts:      [{ key: 'high', label: 'High' }, { key: 'medium', label: 'Medium' }, { key: 'low', label: 'Low' }],
      timeOpts:        [{ key: 'afternoon', label: 'Afternoon' }, { key: 'evening', label: 'Evening' }, { key: 'late', label: 'Late Night' }],
      moodOpts:        [{ key: 'food', label: 'Food' }, { key: 'coffee', label: 'Coffee' }, { key: 'explore', label: 'Explore' }, { key: 'party', label: 'Party' }],
      pickForMe:       'Pick for me',
      chooseOwn:       'Choose neighborhood',
      selectHood:      'Select a neighborhood',
      submit:          'Plan Itinerary',
      tryAgain:        'Try Another Plan',
      planning:        'Planning your night...',
      resultHeader:    (name) => `Your night in ${name}`,
      stopLabels:      { cafe: 'Cafe', restaurant: 'Restaurant', bar: 'Bar' },
    },
  },
  ko: {
    subtitle: '서울 동네를 분위기로 탐색하세요',
    vibeLabels: { nightlife: '나이트라이프', chill: '여유로움', trendy: '트렌디' },
    modeExplore: '탐색',
    modePlan: '플랜',
    stats: {
      day_pop: '주간 인구', night_pop: '야간 인구',
      businesses: '총 업체', young_ratio: '청년 비율',
      cafes: '카페', bars: '술집',
    },
    placesTitle:  (name) => `${name} 추천 장소`,
    findingSpots: '최고의 장소를 찾는 중...',
    noPlaces:     '장소를 찾을 수 없습니다.',
    openNaver:    '네이버 지도에서 열기',
    loading:      '로딩 중...',
    vibeKey: {
      heading:   '분위기 점수 기준',
      nightlife: { label: '나이트라이프', desc: '술집 밀도 + 야간 유동인구. 높을수록 밤에 활기찬 동네.' },
      chill:     { label: '여유로움',     desc: '구 내 카페 밀집도. 높을수록 여유롭게 시간 보내기 좋은 동네.' },
      trendy:    { label: '트렌디',       desc: '청년 인구 비율 × 사업체 밀집도. 높을수록 젊고 활기찬 에너지.' },
    },
    plan: {
      title:           '여정 계획',
      energy:          '에너지',
      time:            '시간대',
      mood:            '기분',
      energyOpts:      [{ key: 'high', label: '활발' }, { key: 'medium', label: '보통' }, { key: 'low', label: '여유' }],
      timeOpts:        [{ key: 'afternoon', label: '오후' }, { key: 'evening', label: '저녁' }, { key: 'late', label: '심야' }],
      moodOpts:        [{ key: 'food', label: '맛집' }, { key: 'coffee', label: '카페' }, { key: 'explore', label: '탐험' }, { key: 'party', label: '파티' }],
      pickForMe:       '추천 받기',
      chooseOwn:       '직접 선택',
      selectHood:      '동네 선택',
      submit:          '여정 계획하기',
      tryAgain:        '다시 추천',
      planning:        '플랜을 만드는 중...',
      resultHeader:    (name) => `${name}의 밤`,
      stopLabels:      { cafe: '카페', restaurant: '식당', bar: '술집' },
    },
  },
}

// ── Shared subcomponents ──────────────────────────────────────────────────────

function ScoreBar({ value, color }) {
  return (
    <div className="score-bar-track">
      <div className="score-bar-fill" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  )
}

function ButtonGroup({ options, value, onChange }) {
  return (
    <div className="btn-group">
      {options.map(({ key, label }) => (
        <button
          key={key}
          className={`btn-group-item ${value === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Vibe key / legend ─────────────────────────────────────────────────────────

function VibeKey({ t }) {
  const [open, setOpen] = useState(false)
  const k = t.vibeKey
  return (
    <div className="vibe-key">
      <button className="vibe-key-toggle" onClick={() => setOpen((o) => !o)}>
        <span>{k.heading}</span>
        <span className="vibe-key-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="vibe-key-body">
          {VIBES.map((v) => (
            <div key={v} className="vibe-key-row">
              <span className="vibe-key-dot" style={{ background: VIBE_COLOR[v] }} />
              <div className="vibe-key-text">
                <span className="vibe-key-label" style={{ color: VIBE_COLOR[v] }}>{k[v].label}</span>
                <span className="vibe-key-desc">{k[v].desc}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── District detail panel (map overlay) ──────────────────────────────────────

function DistrictPanel({ n, vibe, onClose, t }) {
  const scoreKey = VIBE_SCORE_KEY[vibe]
  const color = VIBE_COLOR[vibe]
  const score = n[scoreKey]
  const s = t.stats
  const vl = t.vibeLabels

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <span className="district">{n.district}</span>
          <span className="vibe-score" style={{ color }}>{score.toFixed(2)}</span>
        </div>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="score-row">
        <span className="score-label">{vl[vibe]}</span>
        <ScoreBar value={score} color={color} />
      </div>
      <div className="panel-vibes">
        {VIBES.map((v) => (
          <div key={v} className="mini-score">
            <span className="score-label">{vl[v]}</span>
            <ScoreBar value={n[VIBE_SCORE_KEY[v]]} color={VIBE_COLOR[v]} />
            <span className="mini-val" style={{ color: VIBE_COLOR[v] }}>
              {n[VIBE_SCORE_KEY[v]].toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="stats-grid">
        {[
          [s.day_pop,     Math.round(n.day_pop).toLocaleString()],
          [s.night_pop,   Math.round(n.night_pop).toLocaleString()],
          [s.businesses,  Math.round(n.total_business).toLocaleString()],
          [s.young_ratio, `${(n.young_ratio * 100).toFixed(1)}%`],
          [s.cafes,       Math.round(n.is_cafe).toLocaleString()],
          [s.bars,        Math.round(n.is_bar).toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="stat">
            <span className="stat-label">{label}</span>
            <span className="stat-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Places panel (sidebar section) ───────────────────────────────────────────

function PlacesPanel({ neighborhood, vibe, places, loading, t }) {
  const color = VIBE_COLOR[vibe] ?? '#e2e2ec'
  return (
    <div className="places-panel">
      <div className="places-header">
        <span className="places-title">{t.placesTitle(neighborhood)}</span>
        <span className="places-vibe-tag" style={{ color }}>{t.vibeLabels[vibe] ?? vibe}</span>
      </div>
      {loading && <p className="places-loading">{t.findingSpots}</p>}
      {!loading && places.length === 0 && <p className="places-empty">{t.noPlaces}</p>}
      {!loading && places.slice(0, 5).map((p, i) => (
        <div key={i} className="place-card">
          <span className="place-name">{p.name}</span>
          <span className="place-category">{p.category}</span>
          <span className="place-address">{p.address}</span>
          <a className="place-link" href={p.naver_link} target="_blank" rel="noreferrer">
            {t.openNaver}
          </a>
        </div>
      ))}
    </div>
  )
}

// ── Plan panel ────────────────────────────────────────────────────────────────

function PlanPanel({ neighborhoods, t, onResult, onClear, selectedStop, onStopSelect }) {
  const tp = t.plan
  const [form, setForm] = useState({
    energy: 'high', time: 'evening', mood: 'food',
    hoodMode: 'auto', neighborhood: '',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function submit() {
    setLoading(true)
    setResult(null)
    onClear()

    const body = {
      energy: form.energy,
      time: form.time === 'late' ? 'late night' : form.time,
      mood: form.mood,
    }
    if (form.hoodMode === 'pick' && form.neighborhood) {
      body.neighborhood = form.neighborhood
    }

    fetch('http://localhost:8000/plan-night', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data) => {
        setResult(data)
        onResult(data)
      })
      .catch((e) => console.error('Plan failed:', e))
      .finally(() => setLoading(false))
  }

  return (
    <div className="plan-panel">
      <h2 className="plan-title">{tp.title}</h2>

      {/* Energy */}
      <div className="plan-section">
        <span className="plan-section-label">{tp.energy}</span>
        <ButtonGroup options={tp.energyOpts} value={form.energy} onChange={(v) => set('energy', v)} />
      </div>

      {/* Time */}
      <div className="plan-section">
        <span className="plan-section-label">{tp.time}</span>
        <ButtonGroup options={tp.timeOpts} value={form.time} onChange={(v) => set('time', v)} />
      </div>

      {/* Mood */}
      <div className="plan-section">
        <span className="plan-section-label">{tp.mood}</span>
        <ButtonGroup options={tp.moodOpts} value={form.mood} onChange={(v) => set('mood', v)} />
      </div>

      {/* Neighborhood toggle */}
      <div className="plan-section">
        <div className="hood-toggle">
          {[['auto', tp.pickForMe], ['pick', tp.chooseOwn]].map(([key, label]) => (
            <button
              key={key}
              className={`hood-toggle-btn ${form.hoodMode === key ? 'active' : ''}`}
              onClick={() => set('hoodMode', key)}
            >
              {label}
            </button>
          ))}
        </div>
        {form.hoodMode === 'pick' && (
          <select
            className="hood-select"
            value={form.neighborhood}
            onChange={(e) => set('neighborhood', e.target.value)}
          >
            <option value="">{tp.selectHood}</option>
            {neighborhoods.map((n) => (
              <option key={n.district} value={n.district}>{n.district}</option>
            ))}
          </select>
        )}
      </div>

      {/* Submit */}
      <button className="plan-submit" onClick={submit} disabled={loading}>
        {loading ? tp.planning : result ? tp.tryAgain : tp.submit}
      </button>

      {/* Results */}
      {result && (
        <div className="plan-result">
          <p className="plan-result-header">{tp.resultHeader(result.neighborhood)}</p>
          {result.itinerary.map((stop, i) => (
            <div
              key={stop.type}
              className={`plan-stop-card ${selectedStop === i ? 'plan-stop-card--selected' : ''}`}
              onClick={() => onStopSelect(i)}
            >
              <div className="plan-stop-type" style={{ color: STOP_COLOR[stop.type] }}>
                <span>{STOP_ICON[stop.type]}</span>
                <span>{tp.stopLabels[stop.type]}</span>
              </div>
              <span className="place-name">{stop.name}</span>
              <span className="place-category">{stop.category}</span>
              <span className="place-address">{stop.address}</span>
              <a className="place-link" href={stop.naver_link} target="_blank" rel="noreferrer"
                 onClick={(e) => e.stopPropagation()}>
                {t.openNaver}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Neighborhood card (sidebar list) ─────────────────────────────────────────

function NeighborhoodCard({ n, vibe, selected, onClick, t }) {
  const scoreKey = VIBE_SCORE_KEY[vibe]
  const color = VIBE_COLOR[vibe]
  const score = n[scoreKey]
  const s = t.stats
  const vl = t.vibeLabels

  return (
    <div
      className={`card ${selected ? 'card-selected' : ''}`}
      onClick={onClick}
      style={selected ? { '--card-color': color } : {}}
    >
      <div className="card-header">
        <span className="district">{n.district}</span>
        <span className="vibe-score" style={{ color }}>{score.toFixed(2)}</span>
      </div>
      <div className="score-row">
        <span className="score-label">{vl[vibe]}</span>
        <ScoreBar value={score} color={color} />
      </div>
      <div className="stats-grid">
        {[
          [s.day_pop,     Math.round(n.day_pop).toLocaleString()],
          [s.night_pop,   Math.round(n.night_pop).toLocaleString()],
          [s.businesses,  Math.round(n.total_business).toLocaleString()],
          [s.young_ratio, `${(n.young_ratio * 100).toFixed(1)}%`],
          [s.cafes,       Math.round(n.is_cafe).toLocaleString()],
          [s.bars,        Math.round(n.is_bar).toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="stat">
            <span className="stat-label">{label}</span>
            <span className="stat-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState('explore')   // 'explore' | 'plan'
  const [vibe, setVibe] = useState('nightlife')
  const [lang, setLang] = useState('en')
  const [neighborhoods, setNeighborhoods] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [selected, setSelected] = useState(null)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null)
  const [places, setPlaces] = useState([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [selectedPlanStop, setSelectedPlanStop] = useState(null)

  const flyToRef = useRef(null)
  const markersRef = useRef(null)

  const t = TRANSLATIONS[lang]

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`http://localhost:8000/neighborhoods?vibe=${vibe}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setNeighborhoods)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [vibe])

  function fetchPlaces(neighborhoodName, currentVibe) {
    const params = new URLSearchParams({ neighborhood: neighborhoodName, vibe: currentVibe })
    setPlaces([])
    setPlacesLoading(true)
    markersRef.current?.clear()
    fetch(`http://localhost:8000/places?${params}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data) => { setPlaces(data); markersRef.current?.setMarkers(data) })
      .catch((e) => { console.error('Places fetch failed:', e); setPlaces([]) })
      .finally(() => setPlacesLoading(false))
  }

  function handleNeighborhoodClick(districtRow, neighborhoodName) {
    setSelected(districtRow)
    setSelectedNeighborhood(neighborhoodName)
    if (neighborhoodName) fetchPlaces(neighborhoodName, vibe)
  }

  function handleStopSelect(index) {
    setSelectedPlanStop(index)
    markersRef.current?.highlightMarker(index)
  }

  // Called when plan results arrive: fly to district + show itinerary markers
  function handlePlanResult(result) {
    setSelectedPlanStop(null)
    flyToRef.current?.(result.neighborhood)
    markersRef.current?.setMarkers(result.itinerary, { onMarkerClick: handleStopSelect })
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1>Seoul Vibe Map</h1>
          <button className="lang-toggle" onClick={() => setLang((l) => (l === 'en' ? 'ko' : 'en'))}>
            {lang === 'en' ? '한국어' : 'EN'}
          </button>
        </div>
        <p className="subtitle">{t.subtitle}</p>

        <div className="header-controls">
          {/* Mode toggle */}
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === 'explore' ? 'active' : ''}`}
              onClick={() => setMode('explore')}
            >
              {t.modeExplore}
            </button>
            <button
              className={`mode-btn ${mode === 'plan' ? 'active' : ''}`}
              style={mode === 'plan' ? { '--mode-color': '#f472b6' } : {}}
              onClick={() => setMode('plan')}
            >
              {t.modePlan}
            </button>
          </div>

          {/* Vibe selector — only in explore mode */}
          {mode === 'explore' && (
            <div className="vibe-selector">
              {VIBES.map((v) => (
                <button
                  key={v}
                  className={`vibe-btn ${vibe === v ? 'active' : ''}`}
                  style={vibe === v ? { '--btn-color': VIBE_COLOR[v] } : {}}
                  onClick={() => setVibe(v)}
                >
                  {t.vibeLabels[v]}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="body">
        <div className="map-wrap">
          {neighborhoods.length > 0 && (
            <VibeMap
              neighborhoods={neighborhoods}
              vibe={vibe}
              selectedDistrict={selected?.district ?? null}
              onNeighborhoodClick={mode === 'explore' ? handleNeighborhoodClick : () => {}}
              flyToRef={flyToRef}
              markersRef={markersRef}
            />
          )}
          {mode === 'explore' && selected && (
            <DistrictPanel
              n={selected}
              vibe={vibe}
              t={t}
              onClose={() => {
                setSelected(null)
                setSelectedNeighborhood(null)
                setPlaces([])
                markersRef.current?.clear()
              }}
            />
          )}
        </div>

        <aside className="sidebar">
          {mode === 'plan' ? (
            <PlanPanel
              neighborhoods={neighborhoods}
              t={t}
              onResult={handlePlanResult}
              onClear={() => { markersRef.current?.clear(); setSelectedPlanStop(null) }}
              selectedStop={selectedPlanStop}
              onStopSelect={handleStopSelect}
            />
          ) : (
            <>
              {selectedNeighborhood && (
                <PlacesPanel
                  neighborhood={selectedNeighborhood}
                  vibe={vibe}
                  places={places}
                  loading={placesLoading}
                  t={t}
                />
              )}
              {loading && <p className="status">{t.loading}</p>}
              {error && <p className="status error">Error: {error}</p>}
              {!loading && !error && neighborhoods.map((n) => (
                <NeighborhoodCard
                  key={n.district}
                  n={n}
                  vibe={vibe}
                  selected={selected?.district === n.district}
                  t={t}
                  onClick={() => {
                    flyToRef.current?.(n.district)
                    handleNeighborhoodClick(n, n.district)
                  }}
                />
              ))}
              <VibeKey t={t} />
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
