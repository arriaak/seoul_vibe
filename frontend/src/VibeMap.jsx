import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const SEOUL_CENTER = [37.5665, 126.978]
const ZOOM = 11
const DONG_ZOOM_THRESHOLD = 12

const GU_CODE_MAP = {
  '11110': '종로구', '11140': '중구',    '11170': '용산구', '11200': '성동구',
  '11215': '광진구', '11230': '동대문구', '11260': '중랑구', '11290': '성북구',
  '11305': '강북구', '11320': '도봉구',  '11350': '노원구', '11380': '은평구',
  '11410': '서대문구', '11440': '마포구', '11470': '양천구', '11500': '강서구',
  '11530': '구로구', '11545': '금천구',  '11560': '영등포구', '11590': '동작구',
  '11620': '관악구', '11650': '서초구',  '11680': '강남구', '11710': '송파구',
  '11740': '강동구',
}

function scoreToColor(score, vibe) {
  const accents = {
    nightlife: [168, 85, 247],
    chill:     [56, 189, 248],
    trendy:    [244, 114, 182],
  }
  const [r, g, b] = accents[vibe]
  const alpha = 0.15 + score * 0.7
  return `rgba(${r},${g},${b},${alpha})`
}

const BORDER = { nightlife: '#a855f7', chill: '#38bdf8', trendy: '#f472b6' }

const geoCache = {}
function fetchGeo(url) {
  if (!geoCache[url]) geoCache[url] = fetch(url).then((r) => r.json())
  return geoCache[url]
}

// onNeighborhoodClick(districtRow, neighborhoodName)
// neighborhoodName is dong name when zoomed in, gu name when zoomed out
function buildGuLayer(geojson, dataMap, scoreKey, vibe, selectedDistrict, onNeighborhoodClick) {
  return L.geoJSON(geojson, {
    style: (feature) => {
      const name = feature.properties.name
      const row = dataMap[name]
      const score = row ? row[scoreKey] : 0
      const selected = name === selectedDistrict
      return {
        fillColor: scoreToColor(score, vibe),
        fillOpacity: 1,
        color: selected ? '#ffffff' : BORDER[vibe],
        weight: selected ? 2.5 : 0.8,
      }
    },
    onEachFeature: (feature, layer) => {
      const name = feature.properties.name
      const row = dataMap[name]
      const score = row ? row[scoreKey].toFixed(2) : 'N/A'
      layer.bindTooltip(
        `<strong>${name}</strong><br/>${vibe}: ${score}`,
        { className: 'vibe-tooltip', sticky: true }
      )
      layer.on({
        click: () => onNeighborhoodClick(row ?? null, name),
        mouseover: (e) => { e.target.setStyle({ weight: 2, color: '#ffffff' }); e.target.bringToFront() },
        mouseout: (e) => {
          const sel = name === selectedDistrict
          e.target.setStyle({ color: sel ? '#ffffff' : BORDER[vibe], weight: sel ? 2.5 : 0.8 })
        },
      })
    },
  })
}

function buildDongLayer(geojson, dataMap, scoreKey, vibe, selectedDistrict, onNeighborhoodClick) {
  return L.geoJSON(geojson, {
    style: (feature) => {
      const guName = GU_CODE_MAP[feature.properties.EMD_CD.slice(0, 5)]
      const row = dataMap[guName]
      const score = row ? row[scoreKey] : 0
      const selected = guName === selectedDistrict
      return {
        fillColor: scoreToColor(score, vibe),
        fillOpacity: 1,
        color: selected ? '#ffffff' : BORDER[vibe],
        weight: 0.5,
      }
    },
    onEachFeature: (feature, layer) => {
      const dongName = feature.properties.EMD_KOR_NM
      const guName = GU_CODE_MAP[feature.properties.EMD_CD.slice(0, 5)]
      const row = dataMap[guName]
      const score = row ? row[scoreKey].toFixed(2) : 'N/A'
      layer.bindTooltip(
        `<strong>${dongName}</strong><span class="tt-sub">${guName}</span><br/>${vibe}: ${score}`,
        { className: 'vibe-tooltip', sticky: true }
      )
      layer.on({
        click: () => onNeighborhoodClick(row ?? null, dongName),
        mouseover: (e) => { e.target.setStyle({ weight: 1.5, color: '#ffffff' }); e.target.bringToFront() },
        mouseout: (e) => {
          const sel = guName === selectedDistrict
          e.target.setStyle({ color: sel ? '#ffffff' : BORDER[vibe], weight: 0.5 })
        },
      })
    },
  })
}

export default function VibeMap({
  neighborhoods, vibe, onNeighborhoodClick, selectedDistrict, flyToRef, markersRef,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const zoomRef = useRef(ZOOM)
  // Always holds the latest redraw function so the zoomend handler never goes stale
  const redrawRef = useRef(null)

  const dataMap = Object.fromEntries(neighborhoods.map((n) => [n.district, n]))
  const scoreKey = `vibe_${vibe}`

  function redrawLayer(map, zoom) {
    const isDong = zoom >= DONG_ZOOM_THRESHOLD
    const url = isDong ? '/seoul-dongs.geojson' : '/seoul-districts.geojson'
    fetchGeo(url).then((geojson) => {
      if (!mapRef.current) return
      layerRef.current?.remove()
      layerRef.current = isDong
        ? buildDongLayer(geojson, dataMap, scoreKey, vibe, selectedDistrict, onNeighborhoodClick)
        : buildGuLayer(geojson, dataMap, scoreKey, vibe, selectedDistrict, onNeighborhoodClick)
      layerRef.current.addTo(map)
    })
  }

  // Keep ref in sync with latest closure on every render
  redrawRef.current = redrawLayer

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const map = L.map(container, { center: SEOUL_CENTER, zoom: ZOOM })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    }).addTo(map)

    map.on('zoomend', () => {
      const z = map.getZoom()
      const wasAbove = zoomRef.current >= DONG_ZOOM_THRESHOLD
      const isAbove  = z >= DONG_ZOOM_THRESHOLD
      zoomRef.current = z
      // Call through the ref so we always use the current vibe/data
      if (wasAbove !== isAbove) redrawRef.current(map, z)
    })

    mapRef.current = map

    // Custom pane so markers always render above GeoJSON district/dong layers
    map.createPane('markersPane')
    map.getPane('markersPane').style.zIndex = 650

    if (flyToRef) {
      flyToRef.current = (districtName) => {
        fetchGeo('/seoul-districts.geojson').then((geojson) => {
          const feature = geojson.features.find((f) => f.properties.name === districtName)
          if (!feature) return
          const bounds = L.geoJSON(feature).getBounds()
          map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8 })
        })
      }
    }

    // Expose marker control to parent
    if (markersRef) {
      const markerGroup = L.layerGroup().addTo(map)
      const markerList = []
      const MARKER_COLORS = ['#38bdf8', '#f472b6', '#a855f7'] // cafe, restaurant, bar
      const BASE_STYLE   = { radius: 8,  weight: 2, color: '#fff', fillOpacity: 0.85 }
      const ACTIVE_STYLE = { radius: 13, weight: 3, color: '#fff', fillOpacity: 1.0  }

      markersRef.current = {
        setMarkers(places, { onMarkerClick } = {}) {
          markerGroup.clearLayers()
          markerList.length = 0
          places.forEach((place, i) => {
            // Supports both lat/lng (plan itinerary) and mapx/mapy × 10^7 (explore places)
            const lat = place.lat ?? (place.mapy ? Number(place.mapy) / 1e7 : null)
            const lng = place.lng ?? (place.mapx ? Number(place.mapx) / 1e7 : null)
            if (!lat || !lng) return
            const fillColor = MARKER_COLORS[i % MARKER_COLORS.length]
            const m = L.circleMarker([lat, lng], { ...BASE_STYLE, fillColor, pane: 'markersPane' })
              .bindPopup(`<strong>${place.name}</strong><br/><span style="font-size:0.8em;color:#aaa">${place.category}</span>`)
              .addTo(markerGroup)
            m.on('click', (e) => {
              L.DomEvent.stopPropagation(e)
              if (onMarkerClick) onMarkerClick(i)
            })
            markerList.push(m)
          })
        },
        highlightMarker(index) {
          markerList.forEach((m, i) => {
            const fillColor = MARKER_COLORS[i % MARKER_COLORS.length]
            if (i === index) {
              m.setStyle({ ...ACTIVE_STYLE, fillColor })
              m.openPopup()
            } else {
              m.setStyle({ ...BASE_STYLE, fillColor })
            }
          })
        },
        clear() {
          markerGroup.clearLayers()
          markerList.length = 0
        },
      }
    }

    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (!mapRef.current || neighborhoods.length === 0) return
    redrawLayer(mapRef.current, zoomRef.current)
  }, [neighborhoods, vibe, selectedDistrict])

  return <div ref={containerRef} className="map-container" />
}
