import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// SOC floor visualization: 5 stations (4 AI agents + human approval) arranged
// in a pentagon, with pulse beams that light up based on live agent/incident
// state. Built with plain Three.js (imperative, no JSX) -- see office-scene.tsx
// in the budget OS for why @react-three/fiber is avoided on this platform.
const COLORS = {
  threatDetection: 0x1f9fe0,
  malwareAnalysis: 0x9747d6,
  incidentResponse: 0xf2932e,
  compliance: 0x1fa085,
  human: 0xe0b93a,
  resolved: 0x2ecc71,
  floor: 0x0b0d16,
  grid: 0x252a3d,
  sparkle: 0x7d8fff,
};

interface Station {
  group: THREE.Group;
  gem: THREE.Mesh;
  ring: THREE.Mesh;
  baseY: number;
}

function createStation(color: number, label: string, sublabel: string): Station {
  const group = new THREE.Group();

  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.5, 0),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.5 }),
  );
  gem.position.y = 0.85;
  gem.castShadow = true;
  group.add(gem);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.88, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.8, 0.1, 32),
    new THREE.MeshStandardMaterial({ color: 0x161a26, roughness: 0.6 }),
  );
  base.position.y = 0.05;
  group.add(base);

  const labelSprite = makeTextSprite(label, "#f2f3f7", 30);
  labelSprite.position.y = -0.32;
  group.add(labelSprite);

  const subSprite = makeTextSprite(sublabel, "#8d91a8", 18);
  subSprite.position.y = -0.6;
  group.add(subSprite);

  return { group, gem, ring, baseY: 0.85 };
}

function makeTextSprite(text: string, color: string, fontSize: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 512;
  canvas.height = 96;
  ctx.scale(2, 2);
  ctx.font = `600 ${fontSize}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 24);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.6, 0.3, 1);
  return sprite;
}

function createBeam(from: THREE.Vector3, to: THREE.Vector3, color: number) {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  mid.y += 0.15;
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const points = curve.getPoints(32);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.18 });
  const line = new THREE.Line(geometry, material);

  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 12, 12),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 }),
  );
  particle.visible = false;

  return { line, particle, curve, material };
}

export interface SocSceneProps {
  detectionActive: boolean;
  malwareActive: boolean;
  responseActive: boolean;
  approvalPendingCount: number;
  resolvedCount: number;
}

export function SocScene({ detectionActive, malwareActive, responseActive, approvalPendingCount, resolvedCount }: SocSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ detectionActive, malwareActive, responseActive, approvalPendingCount, resolvedCount });

  useEffect(() => {
    stateRef.current = { detectionActive, malwareActive, responseActive, approvalPendingCount, resolvedCount };
  }, [detectionActive, malwareActive, responseActive, approvalPendingCount, resolvedCount]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 3.8, 5.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0x0b0d16, 1);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI / 3.4;
    controls.maxPolarAngle = Math.PI / 2.3;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(3, 5, 2);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0x6c7dff, 0.45);
    pointLight.position.set(0, 3, 0);
    scene.add(pointLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 64),
      new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(new THREE.GridHelper(9, 30, COLORS.grid, COLORS.grid));

    // Pentagon layout: 5 stations
    const radius = 2.2;
    const angles = [-90, -18, 54, 126, 198].map((deg) => (deg * Math.PI) / 180);
    const positions = angles.map((a) => new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));

    const detection = createStation(COLORS.threatDetection, "Detection", "Scans events");
    detection.group.position.copy(positions[0]);
    scene.add(detection.group);

    const malware = createStation(COLORS.malwareAnalysis, "Malware", "Analyzes files");
    malware.group.position.copy(positions[1]);
    scene.add(malware.group);

    const response = createStation(COLORS.incidentResponse, "Response", "Blocks threats");
    response.group.position.copy(positions[2]);
    scene.add(response.group);

    const human = createStation(COLORS.human, "Human", "Approves in Notion");
    human.group.position.copy(positions[3]);
    scene.add(human.group);

    const compliance = createStation(COLORS.compliance, "Compliance", "Audits everything");
    compliance.group.position.copy(positions[4]);
    scene.add(compliance.group);

    // Beams: detection -> malware -> response -> human -> compliance (pentagon ring)
    const beams = [
      createBeam(positions[0], positions[1], COLORS.threatDetection),
      createBeam(positions[1], positions[2], COLORS.malwareAnalysis),
      createBeam(positions[2], positions[3], COLORS.incidentResponse),
      createBeam(positions[3], positions[4], COLORS.human),
      createBeam(positions[4], positions[0], COLORS.compliance),
    ];
    beams.forEach((b) => scene.add(b.line, b.particle));

    const sparkleGeometry = new THREE.BufferGeometry();
    const sparkleCount = 45;
    const sparklePositions = new Float32Array(sparkleCount * 3);
    for (let i = 0; i < sparkleCount; i++) {
      sparklePositions[i * 3] = (Math.random() - 0.5) * 8;
      sparklePositions[i * 3 + 1] = Math.random() * 2.5;
      sparklePositions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    sparkleGeometry.setAttribute("position", new THREE.BufferAttribute(sparklePositions, 3));
    const sparkles = new THREE.Points(sparkleGeometry, new THREE.PointsMaterial({ color: COLORS.sparkle, size: 0.05, transparent: true, opacity: 0.5 }));
    scene.add(sparkles);

    let frameId: number;
    const clock = new THREE.Clock();

    function pulseStation(station: Station, active: boolean, elapsed: number, phase = 0) {
      station.gem.position.y = station.baseY + Math.sin(elapsed * 1.5 + phase) * 0.05;
      station.gem.rotation.y += 0.008;
      (station.gem.material as THREE.MeshStandardMaterial).emissiveIntensity = active ? 0.6 + Math.sin(elapsed * 3) * 0.3 : 0.32;
      if (active) {
        const s = 1 + Math.sin(elapsed * 3) * 0.08;
        station.ring.scale.set(s, s, s);
      } else {
        station.ring.scale.set(1, 1, 1);
      }
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const { detectionActive, malwareActive, responseActive, approvalPendingCount, resolvedCount } = stateRef.current;
      const approvalActive = approvalPendingCount > 0;
      const complianceActive = detectionActive || malwareActive || responseActive || approvalActive;

      pulseStation(detection, detectionActive, elapsed, 0);
      pulseStation(malware, malwareActive, elapsed, 0.5);
      pulseStation(response, responseActive, elapsed, 1);
      pulseStation(human, approvalActive, elapsed, 1.5);
      pulseStation(compliance, complianceActive, elapsed, 2);

      const beamStates = [detectionActive, malwareActive, responseActive, approvalActive, complianceActive];
      beams.forEach((beam, i) => {
        const active = beamStates[i];
        beam.material.opacity = active ? 0.65 : 0.15;
        beam.particle.visible = active;
        if (active) {
          const t = (elapsed * 0.4 + i * 0.2) % 1;
          beam.particle.position.copy(beam.curve.getPoint(t));
        }
      });

      const resolvedColor = resolvedCount > 0 ? COLORS.resolved : COLORS.compliance;
      (beams[4].material as THREE.LineBasicMaterial).color.setHex(resolvedColor);

      sparkles.rotation.y += 0.0006;

      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          obj.geometry?.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material?.dispose();
        }
      });
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="h-[340px] w-full overflow-hidden rounded-lg border bg-[#0b0d16] sm:h-[400px]" />;
}
