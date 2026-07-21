import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Scene colors mirror the app's design tokens (actor-marketing, actor-finance,
// actor-human, status-approved) so the 3D view stays visually consistent with
// the rest of the UI. Built with plain Three.js (imperative, no JSX) because
// this platform's dev-mode source-tagging instruments every JSX element with
// data-source-* props, which breaks @react-three/fiber's custom reconciler.
const COLORS = {
  marketing: 0xb23fd6,
  finance: 0x1f9fe0,
  human: 0xf2932e,
  approved: 0x2ecc71,
  floor: 0x12141c,
  grid: 0x2a2e3d,
  sparkle: 0x8a93ff,
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
    new THREE.IcosahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.4 }),
  );
  gem.position.y = 0.9;
  gem.castShadow = true;
  group.add(gem);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.75, 0.95, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.85, 0.1, 32),
    new THREE.MeshStandardMaterial({ color: 0x1a1d29, roughness: 0.6 }),
  );
  base.position.y = 0.05;
  group.add(base);

  const labelSprite = makeTextSprite(label, "#f5f5f7", 30);
  labelSprite.position.y = -0.35;
  group.add(labelSprite);

  const subSprite = makeTextSprite(sublabel, "#9a9db0", 20);
  subSprite.position.y = -0.65;
  group.add(subSprite);

  return { group, gem, ring, baseY: 0.9 };
}

function makeTextSprite(text: string, color: string, fontSize: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const scale = 4;
  canvas.width = 512;
  canvas.height = 96;
  ctx.scale(1, 1);
  ctx.font = `600 ${fontSize * scale / 4 * 4}px Inter, sans-serif`;
  ctx.font = `600 ${fontSize}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Render at higher resolution for crisp text
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
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 });
  const line = new THREE.Line(geometry, material);

  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 12, 12),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 }),
  );
  particle.visible = false;

  return { line, particle, curve, material };
}

export interface OfficeSceneProps {
  negotiatingCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export function OfficeScene({ negotiatingCount, pendingCount, approvedCount, rejectedCount }: OfficeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{ negotiatingCount: number; pendingCount: number; approvedCount: number; rejectedCount: number }>({
    negotiatingCount, pendingCount, approvedCount, rejectedCount,
  });

  useEffect(() => {
    stateRef.current = { negotiatingCount, pendingCount, approvedCount, rejectedCount };
  }, [negotiatingCount, pendingCount, approvedCount, rejectedCount]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 3.4, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0x0b0d14, 1);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI / 3.2;
    controls.maxPolarAngle = Math.PI / 2.4;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(3, 5, 2);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0x7c8fff, 0.4);
    pointLight.position.set(0, 3, 0);
    scene.add(pointLight);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 64),
      new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(8.4, 28, COLORS.grid, COLORS.grid);
    scene.add(grid);

    // Stations
    const marketingPos = new THREE.Vector3(-1.9, 0, 1.1);
    const financePos = new THREE.Vector3(1.9, 0, 1.1);
    const humanPos = new THREE.Vector3(0, 0, -1.9);

    const marketing = createStation(COLORS.marketing, "Marketing", "Proposes budgets");
    marketing.group.position.copy(marketingPos);
    scene.add(marketing.group);

    const finance = createStation(COLORS.finance, "Finance", "Checks policy");
    finance.group.position.copy(financePos);
    scene.add(finance.group);

    const human = createStation(COLORS.human, "Human", "Approves in Notion");
    human.group.position.copy(humanPos);
    scene.add(human.group);

    // Beams
    const negotiationBeam = createBeam(marketingPos, financePos, COLORS.marketing);
    scene.add(negotiationBeam.line, negotiationBeam.particle);

    const approvalBeam = createBeam(financePos, humanPos, COLORS.human);
    scene.add(approvalBeam.line, approvalBeam.particle);

    const outcomeBeam = createBeam(humanPos, marketingPos, COLORS.human);
    scene.add(outcomeBeam.line, outcomeBeam.particle);

    // Sparkles
    const sparkleGeometry = new THREE.BufferGeometry();
    const sparkleCount = 40;
    const sparklePositions = new Float32Array(sparkleCount * 3);
    for (let i = 0; i < sparkleCount; i++) {
      sparklePositions[i * 3] = (Math.random() - 0.5) * 7;
      sparklePositions[i * 3 + 1] = Math.random() * 2.5;
      sparklePositions[i * 3 + 2] = (Math.random() - 0.5) * 7;
    }
    sparkleGeometry.setAttribute("position", new THREE.BufferAttribute(sparklePositions, 3));
    const sparkleMaterial = new THREE.PointsMaterial({ color: COLORS.sparkle, size: 0.05, transparent: true, opacity: 0.5 });
    const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
    scene.add(sparkles);

    let frameId: number;
    const clock = new THREE.Clock();

    function animate() {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const { negotiatingCount, pendingCount, approvedCount, rejectedCount } = stateRef.current;

      const negotiationActive = negotiatingCount > 0;
      const approvalActive = pendingCount > 0;
      const outcomeActive = approvedCount > 0 || rejectedCount > 0;

      // Float + pulse stations
      [marketing, finance].forEach((station) => {
        station.gem.position.y = station.baseY + Math.sin(elapsed * 1.5) * 0.05;
        station.gem.rotation.y += 0.008;
        (station.gem.material as THREE.MeshStandardMaterial).emissiveIntensity = negotiationActive
          ? 0.6 + Math.sin(elapsed * 3) * 0.3
          : 0.35;
        if (negotiationActive) {
          const s = 1 + Math.sin(elapsed * 3) * 0.08;
          station.ring.scale.set(s, s, s);
        }
      });
      human.gem.position.y = human.baseY + Math.sin(elapsed * 1.5 + 1) * 0.05;
      human.gem.rotation.y += 0.008;
      (human.gem.material as THREE.MeshStandardMaterial).emissiveIntensity = approvalActive
        ? 0.6 + Math.sin(elapsed * 3) * 0.3
        : 0.35;
      if (approvalActive) {
        const s = 1 + Math.sin(elapsed * 3) * 0.08;
        human.ring.scale.set(s, s, s);
      }

      // Beam particles
      negotiationBeam.material.opacity = negotiationActive ? 0.7 : 0.2;
      negotiationBeam.particle.visible = negotiationActive;
      if (negotiationActive) {
        const t = (elapsed * 0.4) % 1;
        negotiationBeam.particle.position.copy(negotiationBeam.curve.getPoint(t));
      }

      approvalBeam.material.opacity = approvalActive ? 0.7 : 0.2;
      approvalBeam.particle.visible = approvalActive;
      if (approvalActive) {
        const t = (elapsed * 0.4 + 0.33) % 1;
        approvalBeam.particle.position.copy(approvalBeam.curve.getPoint(t));
      }

      const outcomeColor = approvedCount > 0 ? COLORS.approved : COLORS.human;
      (outcomeBeam.material as THREE.LineBasicMaterial).color.setHex(outcomeColor);
      (outcomeBeam.particle.material as THREE.MeshStandardMaterial).color.setHex(outcomeColor);
      (outcomeBeam.particle.material as THREE.MeshStandardMaterial).emissive.setHex(outcomeColor);
      outcomeBeam.material.opacity = outcomeActive ? 0.7 : 0.2;
      outcomeBeam.particle.visible = outcomeActive;
      if (outcomeActive) {
        const t = (elapsed * 0.4 + 0.66) % 1;
        outcomeBeam.particle.position.copy(outcomeBeam.curve.getPoint(t));
      }

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
          if (Array.isArray(material)) {
            material.forEach((m) => m.dispose());
          } else {
            material?.dispose();
          }
        }
      });
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[320px] w-full overflow-hidden rounded-lg border bg-[#0b0d14] sm:h-[380px]"
    />
  );
}
