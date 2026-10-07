"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  ChannelParameters, ChannelShape, HydraulicResult, PROFILE_K, displayHeight, wallProfile, wetPolyline,
} from "@/lib/hydraulics";

export type CameraView = "perspective" | "top" | "side" | "section";
const VIEWS: Record<CameraView, [number, number, number]> = {
  perspective: [6, 3.5, 8],
  top: [0, 12, 0.01],
  side: [12, 0.5, 0],
  section: [0, 0, 12],
};
const BG: Record<ChannelShape, string> = {
  rectangular: "#070d17", triangular: "#08111c", trapezoidal: "#070f19", circular: "#050a11",
};
const REGIME_COLOR = { SUBCRITICAL: "#2f8fd8", CRITICAL: "#2dd4bf", SUPERCRITICAL: "#7dd3fc" } as const;
const K = PROFILE_K;
const N_SURF = 48;
const N_PART = 160;

type OC = {
  target: THREE.Vector3; update: () => void;
  addEventListener: (t: string, f: () => void) => void;
  removeEventListener: (t: string, f: () => void) => void;
};

function CameraRig({ view, nonce, reduced }: { view: CameraView; nonce: number; reduced: boolean }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OC | null;
  const goal = useRef(new THREE.Vector3(...VIEWS.perspective));
  const active = useRef(false);
  useEffect(() => {
    goal.current.set(...VIEWS[view]);
    active.current = true;
  }, [view, nonce]);
  useEffect(() => {
    if (!controls) return;
    const stop = () => { active.current = false; };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);
  useFrame((_, dt) => {
    if (!active.current || !controls) return;
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 4);
    camera.position.lerp(goal.current, k);
    controls.target.lerp(new THREE.Vector3(0, 0, 0), k);
    controls.update();
    if (camera.position.distanceTo(goal.current) < 0.02) active.current = false;
  });
  return null;
}

function makeStripGeometry(vertCount: number, segments: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
  const idx: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = 2 * i;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  g.setIndex(idx);
  return g;
}

interface SceneProps {
  shape: ChannelShape; p: ChannelParameters; r: HydraulicResult; showDims: boolean; reduced: boolean;
}

function Scene({ shape, p, r, showDims, reduced }: SceneProps) {
  const H = displayHeight(shape, p, r.criticalDepth);
  const target = useMemo(() => wallProfile(shape, p, H), [shape, p.B, p.m, p.D, H]); // eslint-disable-line react-hooks/exhaustive-deps

  const group = useRef<THREE.Group>(null);
  const lblY = useRef<THREE.Group>(null);
  const lblYc = useRef<THREE.Group>(null);
  const ycLine = useRef<THREE.Mesh>(null);
  const cur = useRef<Float32Array | null>(null);
  const yS = useRef(p.y);

  const wall = useMemo(() => makeStripGeometry(K * 2, K - 1), []);
  const wet = useMemo(() => makeStripGeometry((K + 2) * 2, K + 1), []);
  const surf = useMemo(() => makeStripGeometry((N_SURF + 1) * 2, N_SURF), []);
  const seeds = useMemo(() => {
    const a = new Float32Array(N_PART * 2);
    for (let i = 0; i < a.length; i++) a[i] = Math.random();
    return a;
  }, []);
  const partGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N_PART * 3), 3));
    return g;
  }, []);
  useEffect(() => () => { wall.dispose(); wet.dispose(); surf.dispose(); partGeo.dispose(); }, [wall, wet, surf, partGeo]);

  useFrame((state, dt0) => {
    // Visual animation only — hydraulics were computed once when the parameters changed.
    const dt = Math.min(dt0, 0.05);
    const t = state.clock.elapsedTime;
    const kShape = reduced ? 1 : 1 - Math.exp(-dt * 5); // ≈ 0.8 s morph settle
    const kY = reduced ? 1 : 1 - Math.exp(-dt * 9);
    if (!cur.current) cur.current = Float32Array.from(target);
    const c = cur.current;
    for (let i = 0; i < c.length; i++) c[i] += (target[i] - c[i]) * kShape;
    yS.current += (p.y - yS.current) * kY;

    let maxX = 0, maxZ = 0;
    for (let i = 0; i < K; i++) {
      maxX = Math.max(maxX, Math.abs(c[2 * i]));
      maxZ = Math.max(maxZ, c[2 * i + 1]);
    }
    const s = 4 / Math.max(maxX * 2, maxZ * 1.3, 1e-3);
    const Ls = 8 / s;
    if (group.current) {
      group.current.scale.setScalar(s);
      group.current.position.y = (-maxZ * s) / 2;
    }

    // walls
    const wp = wall.attributes.position.array as Float32Array;
    for (let i = 0; i < K; i++) {
      const x = c[2 * i], z = c[2 * i + 1];
      wp.set([x, z, -Ls / 2, x, z, Ls / 2], 6 * i);
    }
    wall.attributes.position.needsUpdate = true;
    wall.computeVertexNormals();

    // water volume (wet part of the morphing wall)
    const yw = Math.min(yS.current, maxZ);
    const w = wetPolyline(c, yw);
    const n = w.length / 2;
    const vp = wet.attributes.position.array as Float32Array;
    for (let i = 0; i < n; i++) vp.set([w[2 * i], w[2 * i + 1], -Ls / 2, w[2 * i], w[2 * i + 1], Ls / 2], 6 * i);
    wet.attributes.position.needsUpdate = true;
    wet.setDrawRange(0, n >= 2 ? (n - 1) * 6 : 0);
    wet.computeVertexNormals();

    const xl = n ? w[0] : 0, xr = n ? w[2 * (n - 1)] : 0;
    const speed = reduced ? 0 : Math.min(0.5 + 0.45 * (Number.isFinite(r.velocity) ? r.velocity : 0), 4.5);
    const fr = Number.isFinite(r.froude) ? r.froude : 0;
    const amp = reduced ? 0 : (0.006 + 0.01 * Math.min(fr, 2)) / s;

    // water surface with small downstream-travelling ripples
    const sp = surf.attributes.position.array as Float32Array;
    for (let j = 0; j <= N_SURF; j++) {
      const z = (j / N_SURF - 0.5) * Ls;
      const ph = z * s * 2.2 - t * (1.2 + speed);
      sp.set([xl, yw + amp * Math.sin(ph), z, xr, yw + amp * Math.sin(ph + 0.7), z], 6 * j);
    }
    surf.attributes.position.needsUpdate = true;
    surf.computeVertexNormals();

    // particles (speed is purely visual)
    const pp = partGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < N_PART; i++) {
      const f = (seeds[2 * i + 1] + (speed * t) / 8) % 1;
      pp.set([xl + (xr - xl) * (0.04 + 0.92 * seeds[2 * i]), yw + 0.012 / s, (f - 0.5) * Ls], 3 * i);
    }
    partGeo.attributes.position.needsUpdate = true;

    // labels + critical-depth reference line
    if (lblY.current) lblY.current.position.set(xl - 0.05 / s, yw, Ls / 2);
    const yc = r.criticalDepth;
    const ycOk = Number.isFinite(yc) && yc <= maxZ;
    if (ycLine.current) {
      ycLine.current.visible = ycOk;
      if (ycOk) {
        const e = wetPolyline(c, yc);
        const m = e.length / 2;
        const a = m ? e[0] : 0, b = m ? e[2 * (m - 1)] : 0;
        ycLine.current.position.set((a + b) / 2, yc, Ls / 2);
        ycLine.current.scale.set(Math.max(b - a, 0.01) + 0.2 / s, 0.012 / s, 0.012 / s);
        if (lblYc.current) lblYc.current.position.set(b + 0.1 / s, yc, Ls / 2);
      }
    }
  });

  const color = REGIME_COLOR[r.flowRegime];
  const ycOkReact = Number.isFinite(r.criticalDepth);

  return (
    <>
      <color attach="background" args={[BG[shape]]} />
      <fog attach="fog" args={[BG[shape], 14, 34]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#9cc7ff", "#0a1220", 0.5]} />
      <directionalLight position={[6, 9, 5]} intensity={1.3} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} />
      <directionalLight position={[-6, 3, -6]} intensity={0.5} color="#38bdf8" />

      <gridHelper args={[40, 40, "#1e3a5f", "#102238"]} position={[0, -2.05, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.04, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={0.35} />
      </mesh>

      <group ref={group}>
        <mesh geometry={wall} castShadow receiveShadow frustumCulled={false}>
          <meshStandardMaterial color="#6b8aab" transparent opacity={0.5} roughness={0.6} metalness={0.1}
            side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh geometry={wet} frustumCulled={false}>
          <meshPhysicalMaterial color={color} transparent opacity={0.55} roughness={0.15} metalness={0.1}
            side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh geometry={surf} frustumCulled={false}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={r.flowRegime === "SUPERCRITICAL" ? 0.35 : 0.15}
            transparent opacity={0.8} roughness={0.05} metalness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <points geometry={partGeo} frustumCulled={false}>
          <pointsMaterial color="#ffffff" size={0.05} sizeAttenuation transparent opacity={0.75} depthWrite={false} />
        </points>

        <mesh ref={ycLine} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>

        {showDims && (
          <group ref={lblY}>
            <Html style={{ pointerEvents: "none", transform: "translate(-100%,-50%)" }}>
              <div className="whitespace-nowrap rounded bg-slate-900/80 px-1.5 py-0.5 text-[11px] text-cyan-300">
                y = {p.y.toFixed(3)} m
              </div>
            </Html>
          </group>
        )}
        {showDims && ycOkReact && (
          <group ref={lblYc}>
            <Html style={{ pointerEvents: "none", transform: "translate(0,-50%)" }}>
              <div className="whitespace-nowrap rounded bg-slate-900/80 px-1.5 py-0.5 text-[11px] text-amber-300">
                CRITICAL DEPTH yc = {r.criticalDepth.toFixed(3)} m
              </div>
            </Html>
          </group>
        )}
      </group>

      {/* flow direction (+z) */}
      <mesh position={[0, -1.9, 4.6]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.5, 16]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      <Html position={[0, -1.6, 4.6]} center style={{ pointerEvents: "none" }}>
        <div className="text-[11px] tracking-widest text-sky-300">FLOW →</div>
      </Html>
    </>
  );
}

export default function Channel3D(props: { shape: ChannelShape; p: ChannelParameters; r: HydraulicResult; showDims: boolean }) {
  const [view, setView] = useState<CameraView>("perspective");
  const [nonce, setNonce] = useState(0);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const h = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  const go = (v: CameraView) => { setView(v); setNonce((n) => n + 1); };
  const buttons: [string, CameraView][] = [["Reset Camera", "perspective"], ["Top", "top"], ["Side", "side"], ["Perspective", "perspective"], ["Cross Section", "section"]];

  return (
    <div className="relative h-full w-full">
      <Canvas shadows dpr={[1, 2]} camera={{ position: VIEWS.perspective, fov: 40 }}>
        <Scene {...props} reduced={reduced} />
        <OrbitControls makeDefault enableDamping enablePan enableZoom minDistance={3} maxDistance={24} />
        <CameraRig view={view} nonce={nonce} reduced={reduced} />
      </Canvas>
      <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1.5">
        {buttons.map(([label, v]) => (
          <button key={label} className="btn" onClick={() => go(v)}>{label}</button>
        ))}
      </div>
    </div>
  );
}