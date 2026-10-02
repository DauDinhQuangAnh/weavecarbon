"use client";

import React, { useState } from "react";
import { Compass, MapPin, Navigation2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClimateLocation } from "@/lib/climateRiskApi";

export interface GisCoordinateMapProps {
  latitude: string;
  longitude: string;
  precisionMeters: string;
  existingLocations?: ClimateLocation[];
  onSelectCoordinates: (lat: number, lng: number) => void;
  disabled?: boolean;
}

const VIETNAM_INDUSTRIAL_PRESETS = [
  { name: "KCN VSIP I", province: "Bình Dương", lat: 10.934125, lng: 106.702341 },
  { name: "KCN Hiệp Phước", province: "TP. Hồ Chí Minh", lat: 10.641256, lng: 106.742398 },
  { name: "KCN Amata", province: "Đồng Nai", lat: 10.965412, lng: 106.874521 },
  { name: "KCN Tràng Duệ", province: "Hải Phòng", lat: 20.884512, lng: 106.589234 },
  { name: "KCN Yên Phong", province: "Bắc Ninh", lat: 21.205432, lng: 105.978654 },
  { name: "KCN Hòa Khánh", province: "Đà Nẵng", lat: 16.073412, lng: 108.145623 },
];

// Map bounding box for Vietnam:
// Lat: 8.2° N (Ca Mau) to 23.5° N (Ha Giang)
// Lng: 102.1° E (Dien Bien) to 110.0° E
const MIN_LAT = 8.0;
const MAX_LAT = 24.0;
const MIN_LNG = 102.0;
const MAX_LNG = 110.0;
const SVG_WIDTH = 480;
const SVG_HEIGHT = 440;

function latLngToSvg(lat: number, lng: number): { x: number; y: number } {
  const clampedLat = Math.max(MIN_LAT, Math.min(MAX_LAT, lat));
  const clampedLng = Math.max(MIN_LNG, Math.min(MAX_LNG, lng));

  const x = ((clampedLng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * SVG_WIDTH;
  const y = SVG_HEIGHT - ((clampedLat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * SVG_HEIGHT;
  return { x, y };
}

function svgToLatLng(x: number, y: number): { lat: number; lng: number } {
  const lng = MIN_LNG + (x / SVG_WIDTH) * (MAX_LNG - MIN_LNG);
  const lat = MIN_LAT + ((SVG_HEIGHT - y) / SVG_HEIGHT) * (MAX_LAT - MIN_LAT);
  return {
    lat: Math.round(lat * 1000000) / 1000000,
    lng: Math.round(lng * 1000000) / 1000000,
  };
}

export const GisCoordinateMap: React.FC<GisCoordinateMapProps> = ({
  latitude,
  longitude,
  precisionMeters,
  existingLocations = [],
  onSelectCoordinates,
  disabled = false,
}) => {
  const [hoverCoord, setHoverCoord] = useState<{ lat: number; lng: number } | null>(null);

  const curLat = parseFloat(latitude);
  const curLng = parseFloat(longitude);
  const hasValidCoord = !isNaN(curLat) && !isNaN(curLng) && curLat >= -90 && curLat <= 90 && curLng >= -180 && curLng <= 180;
  const currentPin = hasValidCoord ? latLngToSvg(curLat, curLng) : null;

  // Convert precision meters to approximate pixel radius
  // 1 degree latitude ~= 111,000 meters. SVG height 440px covers 16 degrees (~1,776,000 m).
  // 1 px ~= 4,000 meters.
  const precisionNum = parseFloat(precisionMeters) || 100;
  const bufferPixelRadius = Math.max(6, Math.min(60, (precisionNum / 4000) * 12 + 6));

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * SVG_HEIGHT;
    const coords = svgToLatLng(x, y);
    onSelectCoordinates(coords.lat, coords.lng);
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * SVG_HEIGHT;
    setHoverCoord(svgToLatLng(x, y));
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Navigation2 className="h-4 w-4 text-sky-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Bản đồ GIS định vị cơ sở (Việt Nam & ASEAN)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
          {hoverCoord ? (
            <span>Con trỏ: {hoverCoord.lat.toFixed(4)}°N, {hoverCoord.lng.toFixed(4)}°E</span>
          ) : (
            <span>Nhấp vào bản đồ để chọn tọa độ GPS</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Interactive Map Area */}
        <div className="lg:col-span-2 relative rounded-xl border border-slate-200 bg-gradient-to-b from-sky-950/90 via-slate-900 to-slate-950 overflow-hidden shadow-inner flex items-center justify-center p-2">
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-auto max-h-[380px] cursor-crosshair select-none"
            onClick={handleSvgClick}
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={() => setHoverCoord(null)}
          >
            <defs>
              {/* Grid pattern */}
              <pattern id="gisGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              </pattern>
              {/* Radial gradient for selected location buffer */}
              <radialGradient id="bufferGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.05" />
              </radialGradient>
            </defs>

            {/* Background Grid */}
            <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#gisGrid)" />

            {/* Coastal & Territory Guide Lines (stylized Vietnam S-shape territory) */}
            <path
              d="M 120,40 Q 200,60 260,90 T 250,150 Q 260,200 310,240 T 320,330 Q 270,390 220,400 T 170,410"
              fill="none"
              stroke="#0284c7"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              opacity="0.3"
            />
            {/* Parallels and Meridians */}
            <line x1="0" y1="110" x2={SVG_WIDTH} y2="110" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />
            <text x="8" y="106" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">20°N (Bắc Bộ)</text>

            <line x1="0" y1="220" x2={SVG_WIDTH} y2="220" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />
            <text x="8" y="216" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">16°N (Trung Bộ)</text>

            <line x1="0" y1="350" x2={SVG_WIDTH} y2="350" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />
            <text x="8" y="346" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">11°N (Nam Bộ)</text>

            <line x1="240" y1="0" x2="240" y2={SVG_HEIGHT} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 2" />
            <text x="244" y="16" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">106°E</text>

            {/* Existing Saved Locations */}
            {existingLocations.map((loc) => {
              const pt = latLngToSvg(loc.latitude, loc.longitude);
              return (
                <g key={loc.id} className="opacity-75 hover:opacity-100 transition-opacity">
                  <circle cx={pt.x} cy={pt.y} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
                  <text
                    x={pt.x + 6}
                    y={pt.y + 3}
                    fill="#a7f3d0"
                    fontSize="9"
                    fontFamily="sans-serif"
                    className="pointer-events-none"
                  >
                    {loc.facilityName || loc.id.slice(0, 6)}
                  </text>
                </g>
              );
            })}

            {/* Current Active Pin & Precision Buffer */}
            {currentPin && (
              <g>
                {/* Precision buffer radius */}
                <circle
                  cx={currentPin.x}
                  cy={currentPin.y}
                  r={bufferPixelRadius}
                  fill="url(#bufferGlow)"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                {/* Center marker */}
                <circle cx={currentPin.x} cy={currentPin.y} r="6" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                <circle cx={currentPin.x} cy={currentPin.y} r="2" fill="#ffffff" />
                <text
                  x={currentPin.x}
                  y={currentPin.y - 12}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.8))"
                >
                  {hasValidCoord ? `${curLat.toFixed(3)}°, ${curLng.toFixed(3)}°` : "Vị trí"}
                </text>
              </g>
            )}
          </svg>

          {/* Compass Rose */}
          <div className="absolute top-4 right-4 bg-slate-900/80 border border-slate-700/60 rounded-full p-2 text-slate-300 shadow-md flex items-center justify-center">
            <Compass className="w-5 h-5 text-sky-400" />
          </div>

          {/* Map legend */}
          <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> Đang chọn
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Đã lưu
            </span>
            <span className="text-slate-400">Sai số: ±{precisionMeters}m</span>
          </div>
        </div>

        {/* Industrial Hub Presets & Coordinate Display */}
        <div className="space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Gợi ý KCN trọng điểm Việt Nam</span>
            </div>
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {VIETNAM_INDUSTRIAL_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectCoordinates(preset.lat, preset.lng)}
                  className="w-full text-left p-2 rounded-lg border border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 transition-all flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{preset.name}</p>
                    <p className="text-[11px] text-slate-500">{preset.province}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono text-slate-600 bg-white">
                    {preset.lat.toFixed(2)}°, {preset.lng.toFixed(2)}°
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Coordinate Summary Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            <p className="font-semibold text-slate-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              Tọa độ GPS hiện tại
            </p>
            <div className="font-mono text-slate-800 text-[11px] space-y-0.5 pt-1">
              <p>Vĩ độ (Lat): {latitude || "Chưa nhập"}</p>
              <p>Kinh độ (Lng): {longitude || "Chưa nhập"}</p>
              <p>Vùng đệm sai số: ±{precisionMeters || "100"} mét</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
