'use client';

import { useMissionStore } from '@/store/useMissionStore';
import { Play, Pause, RotateCcw, Clock, Zap, X, MapPin } from 'lucide-react';

export default function MissionReplayControls() {
  const isMissionReplayPlaying = useMissionStore((state) => state.isMissionReplayPlaying);
  const toggleMissionReplay = useMissionStore((state) => state.toggleMissionReplay);
  const replayProgress = useMissionStore((state) => state.replayProgress);
  const setReplayProgress = useMissionStore((state) => state.setReplayProgress);
  const replaySpeed = useMissionStore((state) => state.replaySpeed);
  const setReplaySpeed = useMissionStore((state) => state.setReplaySpeed);
  const currentRoute = useMissionStore((state) => state.currentRoute);

  if (!currentRoute) return null;

  const totalDistKm = currentRoute.distanceMeters / 1000;
  const currentDistKm = totalDistKm * replayProgress;
  const totalDurationSec = currentRoute.estimatedDurationSeconds;
  const currentDurationSec = totalDurationSec * replayProgress;

  const hours = Math.floor(currentDurationSec / 3600);
  const minutes = Math.floor((currentDurationSec % 3600) / 60);

  const totalKcal = currentRoute.energyJoules ? currentRoute.energyJoules / 4184 : 1904;
  const currentKcal = Math.round(totalKcal * replayProgress);

  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4">
      <div className="rounded-2xl border border-cyan-500/50 bg-black/90 p-4 shadow-2xl backdrop-blur-md font-mono text-xs text-zinc-300">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMissionReplayPlaying ? 'bg-cyan-400' : 'bg-zinc-500'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isMissionReplayPlaying ? 'bg-cyan-500' : 'bg-zinc-600'}`} />
            </span>
            <span className="font-bold text-white tracking-wider">MARSWALK REPLAY ENGINE</span>
            <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded">
              {replaySpeed}x SPEED
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Speed Toggles */}
            <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-[10px]">
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setReplaySpeed(spd)}
                  className={`px-2 py-0.5 rounded font-bold transition ${
                    replaySpeed === spd
                      ? 'bg-cyan-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (isMissionReplayPlaying) toggleMissionReplay();
                setReplayProgress(0);
              }}
              className="text-zinc-500 hover:text-red-400 transition"
              title="Close Replay"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>TRAVERSE PROGRESS</span>
            <span className="font-bold text-cyan-300">{(replayProgress * 100).toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.005"
            value={replayProgress}
            onChange={(e) => setReplayProgress(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
          />
        </div>

        {/* Telemetry Stats & Play Controls */}
        <div className="mt-3.5 flex items-center justify-between pt-2 border-t border-zinc-800/80">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={toggleMissionReplay}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3 py-1.5 shadow-md shadow-cyan-600/30 transition"
            >
              {isMissionReplayPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isMissionReplayPlaying ? 'Pause' : 'Play'}</span>
            </button>

            {/* Rewind */}
            <button
              onClick={() => setReplayProgress(0)}
              className="flex items-center gap-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1.5 text-zinc-300 transition"
              title="Restart from beginning"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Real-time Telemetry Readout */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1 text-zinc-300">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>{currentDistKm.toFixed(1)} / {totalDistKm.toFixed(1)} km</span>
            </div>

            <div className="flex items-center gap-1 text-amber-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{hours}h {minutes}m</span>
            </div>

            <div className="flex items-center gap-1 text-yellow-300">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span>{currentKcal.toLocaleString()} kcal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
