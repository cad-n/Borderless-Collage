import React, { useMemo, useState, useEffect, useRef } from "react";
import { 
  Download, 
  ImagePlus, 
  RefreshCw, 
  Trash2, 
  Shuffle, 
  Maximize, 
  Info,
  ChevronDown,
  X,
  Link as LinkIcon,
  Loader2,
  Check
} from "lucide-react";

/**
 * BORDERLESS COLLAGE MAKER
 * Professional Edition: Automated High-Fidelity Rendering with Manual Focal Point Control
 */

const ASPECTS = [
  { id: "16:9", label: "16:9", w: 16, h: 9 },
  { id: "5:4", label: "5:4", w: 5, h: 4 },
  { id: "4:3", label: "4:3", w: 4, h: 3 },
  { id: "3:2", label: "3:2", w: 3, h: 2 },
  { id: "1:1", label: "1:1", w: 1, h: 1 },
  { id: "9:16", label: "9:16", w: 9, h: 16 },
  { id: "4:5", label: "4:5", w: 4, h: 5 },
  { id: "3:4", label: "3:4", w: 3, h: 4 },
  { id: "2:3", label: "2:3", w: 2, h: 3 },
  { id: "custom", label: "Custom Ratio", w: 1, h: 1 },
];

function logicalTemplates(n) {
  const T = [];
  if (n === 0) return [];
  if (n === 1) return [{ id: "single", name: "Single Frame", rects: [{ x: 0, y: 0, w: 1, h: 1 }] }];

  if (n === 2) {
    T.push({ id: "2-stack", name: "Stacked Rows", rects: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }] });
    T.push({ id: "2-side", name: "Side-by-Side", rects: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }] });
  } else if (n === 3) {
    T.push({ id: "3-stack", name: "Three Rows (Stacked)", rects: [{ x: 0, y: 0, w: 1, h: 1/3 }, { x: 0, y: 1/3, w: 1, h: 1/3 }, { x: 0, y: 2/3, w: 1, h: 1/3 }] });
    T.push({ id: "3-row", name: "Three Columns", rects: [{ x: 0, y: 0, w: 1/3, h: 1 }, { x: 1/3, y: 0, w: 1/3, h: 1 }, { x: 2/3, y: 0, w: 1/3, h: 1 }] });
  } else if (n >= 4) {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const rects = [];
    for (let i = 0; i < n; i++) {
      rects.push({ x: (i % cols) * (1/cols), y: Math.floor(i / cols) * (1/rows), w: 1/cols, h: 1/rows });
    }
    T.push({ id: "grid", name: "Standard Grid", rects });
  }
  return T;
}

/**
 * Enhanced drawCover to support manual offsets (0 to 1)
 */
function drawCover(ctx, img, dx, dy, dW, dH, offsetX = 0.5, offsetY = 0.5) {
  const sAR = img.naturalWidth / img.naturalHeight;
  const dAR = dW / dH;
  let sx = 0, sy = 0, sW = img.naturalWidth, sH = img.naturalHeight;

  if (sAR > dAR) {
    sW = dAR * sH;
    sx = (img.naturalWidth - sW) * offsetX;
  } else {
    sH = sW / dAR;
    sy = (img.naturalHeight - sH) * offsetY;
  }
  ctx.drawImage(img, sx, sy, sW, sH, dx, dy, dW, dH);
}

const LogoIcon = () => (
  <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
    <div className="absolute inset-0 bg-indigo-500/10 blur-lg rounded-lg"></div>
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_8px_rgba(79,70,229,0.4)]">
      <rect x="0" y="0" width="50" height="50" fill="#4f46e5" />
      <rect x="50" y="0" width="50" height="50" fill="#facc15" />
      <rect x="0" y="50" width="50" height="50" fill="#facc15" />
      <rect x="50" y="50" width="50" height="50" fill="#4f46e5" />
    </svg>
  </div>
);

export default function App() {
  const [images, setImages] = useState([]);
  const [imageOffsets, setImageOffsets] = useState({}); // { [index]: { x: 0.5, y: 0.5 } }
  const [aspect, setAspect] = useState(ASPECTS[5]);
  const [customAspect, setCustomAspect] = useState({ w: 9, h: 16 });
  const [templateIdx, setTemplateIdx] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  // Drag interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const startDragRef = useRef({ x: 0, y: 0, offX: 0.5, offY: 0.5 });

  const fileInputRef = useRef(null);
  const N = images.length;
  const templates = useMemo(() => logicalTemplates(N), [N]);

  useEffect(() => { setTemplateIdx(0); }, [N]);

  const onSelectFiles = async (e) => {
    const fs = Array.from(e.target.files || []).filter(f => /^image\//.test(f.type));
    const dataUrls = await Promise.all(fs.map(f => new Promise(res => {
      const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f);
    })));
    setImages(p => [...p, ...dataUrls]);
    e.target.value = "";
  };

  const handleUrlFetch = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingUrl(true);
    try {
      const res = await fetch(urlInput);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => { setImages(p => [...p, String(reader.result)]); setUrlInput(""); setIsFetchingUrl(false); };
      reader.readAsDataURL(blob);
    } catch { setIsFetchingUrl(false); }
  };

  const aspectWH = useMemo(() => {
    const w = aspect.id === 'custom' ? Number(customAspect.w) : aspect.w;
    const h = aspect.id === 'custom' ? Number(customAspect.h) : aspect.h;
    return { w: Math.max(0.1, w || 1), h: Math.max(0.1, h || 1) };
  }, [aspect, customAspect]);

  const previewRects = useMemo(() => (templates[templateIdx]?.rects || []), [templates, templateIdx]);

  const onPointerDown = (e, idx) => {
    if (!images[idx]) return;
    const offset = imageOffsets[idx] || { x: 0.5, y: 0.5 };
    setIsDragging(true);
    setDraggingIdx(idx);
    startDragRef.current = { 
      x: e.clientX, 
      y: e.clientY, 
      offX: offset.x, 
      offY: offset.y 
    };
    e.target.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!isDragging || draggingIdx === null) return;
    
    const dx = e.clientX - startDragRef.current.x;
    const dy = e.clientY - startDragRef.current.y;
    
    // Sensivity adjustment based on element size
    const rect = e.currentTarget.getBoundingClientRect();
    const moveX = dx / rect.width;
    const moveY = dy / rect.height;

    setImageOffsets(prev => ({
      ...prev,
      [draggingIdx]: {
        x: Math.max(0, Math.min(1, startDragRef.current.offX - moveX)),
        y: Math.max(0, Math.min(1, startDragRef.current.offY - moveY))
      }
    }));
  };

  const onPointerUp = (e) => {
    setIsDragging(false);
    setDraggingIdx(null);
  };

  const doSave = async () => {
    if (N === 0) return;
    setIsExporting(true);
    setSaveSuccess(false);

    try {
      const { w: aw, h: ah } = aspectWH;
      const targetLongEdge = 4000; 
      const scale = targetLongEdge / Math.max(aw, ah);
      const W = Math.round(aw * scale);
      const H = Math.round(ah * scale);

      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const els = await Promise.all(images.slice(0, previewRects.length).map(src => new Promise((res, rej) => {
        const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = rej; im.src = src;
      })));

      previewRects.forEach((r, i) => {
        if (els[i]) {
          const offset = imageOffsets[i] || { x: 0.5, y: 0.5 };
          drawCover(ctx, els[i], Math.round(r.x * W), Math.round(r.y * H), Math.round(r.w * W), Math.round(r.h * H), offset.x, offset.y);
        }
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], "collage_hq.png", { type: "image/png" });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Borderless Collage" });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `collage_full_quality.png`;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }, "image/png");

    } catch (err) {
      console.error("Export failure:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 selection:bg-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-4 space-y-6">
          <header>
            <h1 className="text-2xl font-black tracking-tighter flex items-center gap-3">
              <LogoIcon /> 
              <span>BORDERLESS COLLAGE MAKER</span>
            </h1>
          </header>

          <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-6 shadow-sm">
            <div className="space-y-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-100"
              >
                <ImagePlus size={20} /> Add Photos
              </button>
              <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={onSelectFiles} />
              
              <div className="flex gap-2">
                <input 
                  type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  placeholder="Import from URL..."
                  className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={handleUrlFetch} disabled={isFetchingUrl || !urlInput} className="bg-neutral-800 text-white p-3 rounded-xl">
                  {isFetchingUrl ? <Loader2 className="animate-spin" size={18} /> : <LinkIcon size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-neutral-100">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className={`flex flex-col gap-1 transition-all ${aspect.id === 'custom' ? 'flex-[2.5]' : 'flex-1'}`}>
                    <label className="text-[10px] font-black text-neutral-400 uppercase">Ratio</label>
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <select 
                          value={aspect.id} 
                          onChange={(e) => setAspect(ASPECTS.find(a => a.id === e.target.value))} 
                          className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 pr-8 text-sm font-bold outline-none cursor-pointer"
                        >
                          {ASPECTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400" />
                      </div>
                      
                      {aspect.id === 'custom' && (
                        <>
                          <div className="flex flex-col gap-1 flex-1 relative">
                            <label className="text-[10px] font-black text-neutral-400 uppercase absolute -top-5 left-0">Width</label>
                            <input 
                              type="number" 
                              value={customAspect.w} 
                              onChange={e => setCustomAspect(p => ({...p, w: e.target.value}))}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="W"
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 relative">
                            <label className="text-[10px] font-black text-neutral-400 uppercase absolute -top-5 left-0">Height</label>
                            <input 
                              type="number" 
                              value={customAspect.h} 
                              onChange={e => setCustomAspect(p => ({...p, h: e.target.value}))}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="H"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase">Layout</label>
                    <div className="relative">
                      <select 
                        value={templateIdx} 
                        disabled={N === 0} 
                        onChange={(e) => setTemplateIdx(parseInt(e.target.value, 10))} 
                        className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 pr-8 text-sm font-bold outline-none disabled:opacity-30 cursor-pointer"
                      >
                        {templates.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400" />
                    </div>
                  </div>
                </div>
              </div>

              <button 
                disabled={N === 0 || isExporting}
                onClick={doSave}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl ${saveSuccess ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100'}`}
              >
                {isExporting ? <Loader2 className="animate-spin" /> : saveSuccess ? <Check /> : <Download />}
                {isExporting ? 'Rendering...' : saveSuccess ? 'Saved!' : 'Save Collage'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {images.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200 group shadow-sm">
                <img src={src} className="w-full h-full object-cover" alt="" />
                <button onClick={() => setImages(p => p.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                {i < previewRects.length && <div className="absolute bottom-0 inset-x-0 h-1 bg-indigo-600" />}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-2">
            <span>Canvas: {aspectWH.w}:{aspectWH.h}</span>
            <button 
              onClick={() => setTemplateIdx(p => (p + 1) % templates.length)} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-indigo-100"
            >
              <RefreshCw size={10} /> Toggle Arrangement
            </button>
          </div>
          
          <div className="flex-1 bg-neutral-200 rounded-[40px] p-6 md:p-12 flex items-center justify-center min-h-[500px] shadow-inner">
            {N === 0 ? (
              <div className="text-center space-y-4 opacity-20">
                <Maximize size={64} className="mx-auto" />
                <p className="font-black text-xl uppercase tracking-tighter text-neutral-600">No Photos Selected</p>
              </div>
            ) : (
              <div 
                className="relative bg-white shadow-2xl transition-all duration-700 ease-in-out overflow-hidden select-none" 
                style={{ width: '100%', maxWidth: '800px', aspectRatio: `${aspectWH.w} / ${aspectWH.h}` }}
              >
                <div className="absolute inset-0">
                  {previewRects.map((r, i) => {
                    const offset = imageOffsets[i] || { x: 0.5, y: 0.5 };
                    return (
                      <div 
                        key={i} 
                        className="absolute overflow-hidden cursor-move touch-none" 
                        onPointerDown={(e) => onPointerDown(e, i)}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerLeave={onPointerUp}
                        style={{ 
                          left: `${r.x * 100}%`, 
                          top: `${r.y * 100}%`, 
                          width: `${r.w * 100}%`, 
                          height: `${r.h * 100}%` 
                        }}
                      >
                        {images[i] ? (
                          <img 
                            src={images[i]} 
                            className="w-full h-full object-cover pointer-events-none" 
                            style={{ objectPosition: `${offset.x * 100}% ${offset.y * 100}%` }}
                            alt="" 
                          />
                        ) : (
                          <div className="w-full h-full bg-neutral-100 animate-pulse pointer-events-none" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="text-center">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              Drag images in the preview to adjust framing
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}