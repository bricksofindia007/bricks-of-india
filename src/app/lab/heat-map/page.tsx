'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────────
type View = 'india' | 'world';
type TimeRange = '12mo' | '5yr';

interface StateRow { name: string; score: number; trend: string; change: string; note: string; }
interface CityRow  { name: string; lat: number; lng: number; score: number; }
interface WorldRow { name: string; lat: number; lng: number; score: number; }
interface Tooltip  { x: number; y: number; name: string; score: number; change?: string; note?: string; }

// ── Static data ────────────────────────────────────────────────────────────────
const STATE_DATA: StateRow[] = [
  { name: 'Delhi',             score: 95, trend: 'up',     change: '+15%', note: "Dilli ki awaaz. NCR accounts for nearly a third of all LEGO searches in India. EMI chahiye." },
  { name: 'Maharashtra',       score: 92, trend: 'up',     change: '+18%', note: "Mumbai never sleeps and never stops Googling LEGO either. Pune catching up fast — IT money, LEGO problems." },
  { name: 'Karnataka',         score: 88, trend: 'up',     change: '+22%', note: "Bengaluru engineers who build production infra want to build something with their hands. Preferably Technic." },
  { name: 'Tamil Nadu',        score: 76, trend: 'up',     change: '+11%', note: "Chennai leads a quiet southern uprising. Auto engineers here have opinions about Technic gear ratios that would scare you." },
  { name: 'Telangana',         score: 71, trend: 'up',     change: '+19%', note: "Hyderabad HITEC City effect. Same people buying expensive laptops are now eyeing the Millennium Falcon." },
  { name: 'Goa',               score: 67, trend: 'up',     change: '+21%', note: "Highest per-capita interest in India. Small state, big wallets. Susegad with sets." },
  { name: 'Gujarat',           score: 65, trend: 'stable', change: '+4%',  note: "Steady. Ahmedabad and Surat move the numbers. Gujaratis know value — and they have clocked the import markup." },
  { name: 'Kerala',            score: 62, trend: 'up',     change: '+16%', note: "High literacy plus high diaspora equals gifting culture that punches above its weight. Every NRI visit includes a set or three." },
  { name: 'Haryana',           score: 59, trend: 'up',     change: '+14%', note: "Gurugram and Faridabad riding NCR coattails. All the Delhi money, none of the commute." },
  { name: 'West Bengal',       score: 58, trend: 'up',     change: '+13%', note: "Kolkata has historically been India's collector capital. LEGO is just the latest chapter." },
  { name: 'Punjab',            score: 55, trend: 'up',     change: '+10%', note: "Chandigarh leads. The NRI connection brings in sets from abroad — sometimes before India even gets them." },
  { name: 'Uttar Pradesh',     score: 52, trend: 'up',     change: '+8%',  note: "Massive base. Noida and Ghaziabad drag the NCR halo. Lucknow emerging." },
  { name: 'Rajasthan',         score: 48, trend: 'up',     change: '+9%',  note: "Jaipur quietly becoming a tier-2 LEGO hub. Palace City energy meets Creator Expert ambitions." },
  { name: 'Andhra Pradesh',    score: 44, trend: 'up',     change: '+7%',  note: "Vijayawada and Visakhapatnam showing early-mover energy." },
  { name: 'Uttarakhand',       score: 42, trend: 'up',     change: '+8%',  note: "Dehradun and hill towns drive seasonal spikes. Board game cafe vibes." },
  { name: 'Madhya Pradesh',    score: 38, trend: 'stable', change: '+2%',  note: "Indore showing early signals. Market is awake, just not caffeinated yet." },
  { name: 'Himachal Pradesh',  score: 35, trend: 'stable', change: '+3%',  note: "Small but engaged urban base. Shimla tourism means real exposure." },
  { name: 'Jammu and Kashmir', score: 31, trend: 'stable', change: '+4%',  note: "Jammu urban areas lead. Early days." },
  { name: 'Assam',             score: 30, trend: 'up',     change: '+6%',  note: "Guwahati is the gateway to northeast growth. One brick at a time." },
  { name: 'Bihar',             score: 29, trend: 'up',     change: '+5%',  note: "Patna emerging. When the wallets catch up, this number moves fast." },
  { name: 'Odisha',            score: 28, trend: 'stable', change: '+3%',  note: "Bhubaneswar urban pockets showing growth." },
  { name: 'Jharkhand',         score: 24, trend: 'stable', change: '+2%',  note: "Ranchi leads. Mineral wealth in the ground, LEGO wealth still arriving." },
  { name: 'Chhattisgarh',      score: 22, trend: 'stable', change: '+1%',  note: "Early-stage market. The interest is there." },
];

const CITY_DATA: Record<string, CityRow[]> = {
  Maharashtra: [
    { name: 'Mumbai',    lat: 19.076, lng: 72.877, score: 100 },
    { name: 'Pune',      lat: 18.520, lng: 73.856, score: 82  },
    { name: 'Nagpur',    lat: 21.145, lng: 79.088, score: 45  },
  ],
  Karnataka: [
    { name: 'Bengaluru', lat: 12.972, lng: 77.594, score: 96 },
    { name: 'Mysuru',    lat: 12.297, lng: 76.639, score: 52 },
  ],
  Delhi: [
    { name: 'New Delhi', lat: 28.614, lng: 77.209, score: 100 },
    { name: 'Noida',     lat: 28.535, lng: 77.391, score: 85  },
    { name: 'Gurugram',  lat: 28.459, lng: 77.027, score: 80  },
  ],
  'Tamil Nadu': [
    { name: 'Chennai',    lat: 13.083, lng: 80.270, score: 88 },
    { name: 'Coimbatore', lat: 11.017, lng: 76.955, score: 58 },
  ],
  Telangana: [
    { name: 'Hyderabad', lat: 17.385, lng: 78.487, score: 91 },
  ],
  Gujarat: [
    { name: 'Ahmedabad', lat: 23.023, lng: 72.572, score: 74 },
    { name: 'Surat',     lat: 21.170, lng: 72.831, score: 62 },
  ],
  Kerala: [
    { name: 'Kochi', lat: 9.932, lng: 76.267, score: 78 },
  ],
  'West Bengal': [
    { name: 'Kolkata', lat: 22.573, lng: 88.364, score: 72 },
  ],
  Rajasthan: [
    { name: 'Jaipur', lat: 26.913, lng: 75.787, score: 65 },
  ],
  Goa: [
    { name: 'Panaji', lat: 15.499, lng: 73.827, score: 72 },
  ],
  Punjab: [
    { name: 'Chandigarh', lat: 30.733, lng: 76.779, score: 58 },
  ],
  Haryana: [
    { name: 'Gurugram', lat: 28.459, lng: 77.027, score: 78 },
  ],
};

const WORLD_DATA: WorldRow[] = [
  { name: 'United States',   lat: 39.5,  lng: -98.4,  score: 100 },
  { name: 'Germany',         lat: 51.2,  lng: 10.4,   score: 94  },
  { name: 'United Kingdom',  lat: 55.4,  lng: -3.4,   score: 88  },
  { name: 'Netherlands',     lat: 52.1,  lng: 5.3,    score: 85  },
  { name: 'Sweden',          lat: 60.1,  lng: 18.6,   score: 79  },
  { name: 'France',          lat: 46.2,  lng: 2.2,    score: 78  },
  { name: 'Singapore',       lat: 1.3,   lng: 103.8,  score: 74  },
  { name: 'Australia',       lat: -25.3, lng: 133.8,  score: 72  },
  { name: 'Canada',          lat: 56.1,  lng: -106.3, score: 70  },
  { name: 'Italy',           lat: 41.9,  lng: 12.6,   score: 69  },
  { name: 'Japan',           lat: 36.2,  lng: 138.3,  score: 68  },
  { name: 'South Korea',     lat: 35.9,  lng: 127.8,  score: 65  },
  { name: 'Spain',           lat: 40.5,  lng: -3.7,   score: 63  },
  { name: 'China',           lat: 35.9,  lng: 104.2,  score: 62  },
  { name: 'Poland',          lat: 51.9,  lng: 19.1,   score: 60  },
  { name: 'India',           lat: 20.6,  lng: 78.9,   score: 58  },
  { name: 'UAE',             lat: 23.4,  lng: 53.8,   score: 55  },
  { name: 'Brazil',          lat: -14.2, lng: -51.9,  score: 52  },
  { name: 'Mexico',          lat: 23.6,  lng: -102.6, score: 48  },
];

// Name normaliser — datamaps `name` field → STATE_DATA key
const NAME_MAP: Record<string, string> = {
  'Delhi': 'Delhi', 'Maharashtra': 'Maharashtra', 'Karnataka': 'Karnataka',
  'Tamil Nadu': 'Tamil Nadu', 'Telangana': 'Telangana', 'Goa': 'Goa',
  'Gujarat': 'Gujarat', 'Kerala': 'Kerala', 'Haryana': 'Haryana',
  'West Bengal': 'West Bengal', 'Punjab': 'Punjab', 'Uttar Pradesh': 'Uttar Pradesh',
  'Rajasthan': 'Rajasthan', 'Andhra Pradesh': 'Andhra Pradesh',
  'Uttarakhand': 'Uttarakhand', 'Madhya Pradesh': 'Madhya Pradesh',
  'Himachal Pradesh': 'Himachal Pradesh', 'Jammu and Kashmir': 'Jammu and Kashmir',
  'Assam': 'Assam', 'Bihar': 'Bihar', 'Odisha': 'Odisha',
  'Jharkhand': 'Jharkhand', 'Chhattisgarh': 'Chhattisgarh',
  'Chandigarh': 'Punjab', 'Puducherry': 'Tamil Nadu',
};

function stateColor(score: number): string {
  if (score >= 85) return '#E3000B';
  if (score >= 70) return '#FF6B35';
  if (score >= 55) return '#F7A800';
  if (score >= 40) return '#006CB7';
  return '#CBD5E0';
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function HeatMapPage() {
  const svgRef       = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [view,          setView]          = useState<View>('india');
  const [timeRange,     setTimeRange]     = useState<TimeRange>('12mo');
  const [drill,         setDrill]         = useState<string | null>(null);
  const [tooltip,       setTooltip]       = useState<Tooltip | null>(null);
  const [selectedState, setSelectedState] = useState<StateRow>(STATE_DATA[0]);
  const [loading,       setLoading]       = useState(true);

  const stateMap = new Map(STATE_DATA.map(s => [s.name, s]));

  const renderMap = useCallback(async (cancelled: { v: boolean }) => {
    setLoading(true);
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js');
      if (cancelled.v) return;

      const d3        = (window as any).d3;
      const topojson  = (window as any).topojson;
      const svgEl     = svgRef.current;
      const container = containerRef.current;
      if (!svgEl || !container) return;

      const W = container.clientWidth  || 600;
      const H = container.clientHeight || 500;

      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();
      svg.attr('width', W).attr('height', H);

      const g = svg.append('g');
      const zoom = d3.zoom().scaleExtent([0.5, 8])
        .on('zoom', (e: any) => g.attr('transform', e.transform));
      svg.call(zoom);

      // ── World view ──
      if (view === 'world') {
        const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        if (cancelled.v) return;
        const projection = d3.geoNaturalEarth1().scale(W / 6.3).translate([W / 2, H / 2]);
        const path       = d3.geoPath().projection(projection);
        const countries  = topojson.feature(world, world.objects.countries);

        g.selectAll('path').data(countries.features).join('path')
          .attr('d', path)
          .attr('fill', '#F5F5F5')
          .attr('stroke', 'rgba(0,0,0,0.1)')
          .attr('stroke-width', 0.5);

        const rScale = d3.scaleSqrt().domain([0, 100]).range([4, 30]);

        WORLD_DATA.forEach((country: WorldRow) => {
          const [cx, cy] = projection([country.lng, country.lat]) as [number, number];
          const r     = rScale(country.score);
          const color = country.score >= 70 ? '#E3000B' : '#F7A800';

          if (country.score >= 70) {
            const pulse = g.append('circle')
              .attr('cx', cx).attr('cy', cy).attr('r', r)
              .attr('fill', color).attr('opacity', 0.15);
            pulse.append('animate')
              .attr('attributeName', 'r')
              .attr('values', `${r};${r * 1.6};${r}`)
              .attr('dur', '2s').attr('repeatCount', 'indefinite');
          }

          g.append('circle')
            .attr('cx', cx).attr('cy', cy).attr('r', r)
            .attr('fill', color).attr('opacity', 0.8)
            .attr('stroke', '#fff').attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .on('mousemove', (e: MouseEvent) => {
              const rect = container.getBoundingClientRect();
              setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, name: country.name, score: country.score });
            })
            .on('mouseleave', () => setTooltip(null));
        });

      // ── City drill-down ──
      } else if (drill) {
        const cities = CITY_DATA[drill] ?? [];
        const lats   = cities.map(c => c.lat);
        const lngs   = cities.map(c => c.lng);
        const midLat = (Math.min(...lats)  + Math.max(...lats))  / 2;
        const midLng = (Math.min(...lngs)  + Math.max(...lngs))  / 2;

        const projection = d3.geoMercator()
          .center([midLng, midLat])
          .scale(W * 14)
          .translate([W / 2, H / 2]);

        const rScale   = d3.scaleSqrt().domain([0, 100]).range([14, 44]);
        const topCity  = [...cities].sort((a, b) => b.score - a.score)[0];

        cities.forEach((city: CityRow) => {
          const [cx, cy] = projection([city.lng, city.lat]) as [number, number];
          const r     = rScale(city.score);
          const color = city.score >= 70 ? '#E3000B' : '#F7A800';
          const isTop = city.name === topCity.name;

          g.append('circle')
            .attr('cx', cx).attr('cy', cy).attr('r', r)
            .attr('fill', color).attr('opacity', 0.85)
            .attr('stroke', '#fff').attr('stroke-width', 2.5);

          if (isTop) {
            g.append('text')
              .attr('x', cx).attr('y', cy - r - 6)
              .attr('text-anchor', 'middle').attr('font-size', '20px').text('👑');
          }

          g.append('text')
            .attr('x', cx).attr('y', cy + 5)
            .attr('text-anchor', 'middle').attr('font-size', '12px')
            .attr('font-weight', 'bold').attr('fill', '#fff').text(city.score);

          g.append('text')
            .attr('x', cx).attr('y', cy + r + 16)
            .attr('text-anchor', 'middle').attr('font-size', '11px')
            .attr('fill', '#4A5568').text(city.name);
        });

      // ── India choropleth ──
      } else {
        const indiaGeo = await d3.json('https://raw.githubusercontent.com/markmarkoh/datamaps/master/src/js/data/ind.json');
        if (cancelled.v) return;
        const features = indiaGeo.features.filter((f: any) => f.properties.gadm_level === 1);
        const projection = d3.geoMercator().fitSize([W, H - 10], { type: 'FeatureCollection', features });
        const path = d3.geoPath().projection(projection);

        g.selectAll('path').data(features).join('path')
          .attr('d', path)
          .attr('fill', (f: any) => {
            const raw     = f.properties.name || f.properties.woe_name || '';
            const mapped  = NAME_MAP[raw] || raw;
            const s       = stateMap.get(mapped);
            return s ? stateColor(s.score) : '#E2E8F0';
          })
          .attr('stroke', 'rgba(247,168,0,0.35)')
          .attr('stroke-width', 0.8)
          .style('cursor', 'pointer')
          .on('mousemove', (e: MouseEvent, f: any) => {
            const raw    = f.properties.name || f.properties.woe_name || '';
            const mapped = NAME_MAP[raw] || raw;
            const s      = stateMap.get(mapped);
            if (!s) return;
            const rect = container.getBoundingClientRect();
            setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, name: s.name, score: s.score, change: s.change, note: s.note });
          })
          .on('mouseleave', () => setTooltip(null))
          .on('click', (_: any, f: any) => {
            const raw    = f.properties.name || f.properties.woe_name || '';
            const mapped = NAME_MAP[raw] || raw;
            const s      = stateMap.get(mapped);
            if (!s) return;
            setSelectedState(s);
          });
      }
    } finally {
      if (!cancelled.v) setLoading(false);
    }
  }, [view, drill]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cancelled = { v: false };
    renderMap(cancelled);
    return () => { cancelled.v = true; };
  }, [renderMap]);

  const rankList = view === 'world'
    ? [...WORLD_DATA].sort((a, b) => b.score - a.score)
    : [...STATE_DATA].sort((a, b) => b.score - a.score);

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'var(--font-inter), sans-serif', color: '#1A1A1A', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderLeft: '4px solid #F7A800', marginLeft: 24 }}>
        <div>
          <Link href="/lab" style={{ color: '#006CB7', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>← The Lab</Link>
          <h1 style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '1.7rem', color: '#1A1A1A', margin: '4px 0 2px' }}>LEGO Search Pulse</h1>
          <p style={{ color: '#4A5568', fontSize: '0.8rem', margin: 0 }}>Google Trends Search Interest · Relative Index 0–100 · Q1 2026</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingRight: 8 }}>
          <div style={{ display: 'flex', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            {(['india', 'world'] as View[]).map(v => (
              <button key={v} onClick={() => { setView(v); setDrill(null); }}
                style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: view === v ? '#F7A800' : '#fff', color: view === v ? '#fff' : '#4A5568', transition: 'background 0.15s' }}>
                {v === 'india' ? '🇮🇳 India' : '🌍 World'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            {(['12mo', '5yr'] as TimeRange[]).map(t => (
              <button key={t} onClick={() => setTimeRange(t)}
                style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: timeRange === t ? '#F7A800' : '#fff', color: timeRange === t ? '#fff' : '#4A5568', transition: 'background 0.15s' }}>
                {t === '12mo' ? '12 Months' : '5 Years'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      {drill && (
        <div style={{ padding: '10px 24px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
          <button onClick={() => setDrill(null)} style={{ background: 'none', border: 'none', color: '#006CB7', cursor: 'pointer', fontWeight: 600, padding: 0 }}>← All States</button>
          <span style={{ color: '#CBD5E0' }}>·</span>
          <span style={{ color: '#4A5568' }}>{drill}</span>
        </div>
      )}

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, gap: 16, padding: '16px 24px 0', minHeight: 0 }}>

        {/* Map */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden', background: '#FAFAFA', minHeight: 400, height: 0 }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A5568', fontSize: '0.88rem' }}>
              Loading map…
            </div>
          )}
          <svg ref={svgRef} style={{ width: '100%', display: 'block' }} />

          {tooltip && (
            <div style={{ position: 'absolute', left: tooltip.x + 14, top: Math.max(8, tooltip.y - 10), background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', pointerEvents: 'none', maxWidth: 210, zIndex: 20 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1A1A1A' }}>{tooltip.name}</div>
              <div style={{ fontFamily: 'var(--font-fredoka)', fontSize: '1.6rem', color: '#F7A800', fontWeight: 700, lineHeight: 1.1 }}>{tooltip.score}</div>
              {tooltip.change && <div style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700 }}>↑ {tooltip.change}</div>}
              {tooltip.note && <div style={{ fontSize: '0.7rem', color: '#4A5568', marginTop: 6, lineHeight: 1.45, fontStyle: 'italic' }}>{tooltip.note}</div>}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div style={{ width: 272, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* Selected state hero */}
          {view === 'india' && (
            <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 16, flexShrink: 0 }}>
              <div style={{ fontSize: '0.68rem', color: '#4A5568', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{drill ? 'Selected' : 'Top State'}</div>
              <div style={{ fontFamily: 'var(--font-fredoka)', fontSize: '1rem', fontWeight: 700, color: '#1A1A1A', marginTop: 2 }}>{selectedState.name}</div>
              <div style={{ fontFamily: 'var(--font-fredoka)', fontSize: '3rem', fontWeight: 700, color: '#F7A800', lineHeight: 1 }}>{selectedState.score}</div>
              <div style={{ fontSize: '0.78rem', color: '#16A34A', fontWeight: 700, marginTop: 2 }}>↑ {selectedState.change}</div>
              <div style={{ fontSize: '0.76rem', color: '#4A5568', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>{selectedState.note}</div>
              {CITY_DATA[selectedState.name] && (
                <button onClick={() => setDrill(selectedState.name)}
                  style={{ marginTop: 10, width: '100%', padding: '8px', background: '#F7A800', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', color: '#fff' }}>
                  View Cities →
                </button>
              )}
            </div>
          )}

          {/* Ranked list */}
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '14px', flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: '0.68rem', color: '#4A5568', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 10 }}>
              {view === 'india' ? 'All States' : 'Countries'} · Ranked
            </div>
            {rankList.map((item, i) => {
              const s = 'trend' in item ? (item as StateRow) : null;
              return (
                <div key={item.name}
                  onClick={() => { if (s) { setSelectedState(s); if (CITY_DATA[s.name]) setDrill(s.name); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: s ? 'pointer' : 'default' }}>
                  <span style={{ fontSize: '0.68rem', color: '#CBD5E0', width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.8rem', color: '#1A1A1A', fontWeight: 500 }}>{item.name}</span>
                  {s && s.trend === 'up' && <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 700 }}>↑</span>}
                  <span style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, fontSize: '0.88rem', color: item.score >= 70 ? '#E3000B' : item.score >= 45 ? '#F7A800' : '#4A5568' }}>
                    {item.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 24px', fontSize: '0.68rem', color: '#CBD5E0', borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 16 }}>
        Data: Google Trends Q1 2025 · Relative search interest index 0–100 · India normalised to highest state · Bricks of India editorial layer
      </div>
    </div>
  );
}
