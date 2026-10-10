/**
 * Fun 3D Serve Trajectory Viewer
 *
 * Stylized, non-measured visualization: only the start/landing points
 * (x, y on the ground) of each serve are real data. Flight height is a
 * synthesized parabolic arc for visual effect only - the app does not
 * record the actual curve of a serve.
 */

function vSub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function vDot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function vCross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}
function vLen(a) { return Math.sqrt(vDot(a, a)); }
function vNorm(a) {
  const len = vLen(a) || 1;
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

class Court3DView {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    this.trajectories = [];

    // Orbit camera state (spherical coordinates around a fixed target)
    this.theta = 0; // azimuth, radians - 0 = behind the server baseline
    this.phi = 24 * Math.PI / 180; // elevation angle above the court
    this.radius = 17;
    this.target = { x: 9, y: 4.5, z: 1.1 };
    this.focal = 0; // computed per-resize from canvas size

    this.minPhi = 8 * Math.PI / 180;
    this.maxPhi = 72 * Math.PI / 180;

    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    this.initCanvasSize();
    this.setupEvents();
  }

  initCanvasSize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.dpr = dpr;
    this.focal = this.canvas.width * 1.1;
    this.render();
  }

  setupEvents() {
    window.addEventListener('resize', () => this.initCanvasSize());

    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.canvas.setPointerCapture(e.pointerId);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      this.theta -= dx * 0.008;
      this.phi = Math.min(this.maxPhi, Math.max(this.minPhi, this.phi + dy * 0.006));
      this.render();
    });

    const endDrag = () => {
      this.dragging = false;
      this.canvas.style.cursor = 'grab';
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
  }

  setTrajectories(serves) {
    this.trajectories = serves || [];
    this.render();
  }

  getCameraPos() {
    const { target, radius, theta, phi } = this;
    return {
      x: target.x - radius * Math.cos(phi) * Math.cos(theta),
      y: target.y + radius * Math.cos(phi) * Math.sin(theta),
      z: target.z + radius * Math.sin(phi)
    };
  }

  // Project a world-space point {x,y,z} (meters) to canvas pixels.
  // Returns null if the point is behind the camera.
  project(p) {
    const cam = this.getCameraPos();
    const fwd = vNorm(vSub(this.target, cam));
    const worldUp = { x: 0, y: 0, z: 1 };
    const right = vNorm(vCross(fwd, worldUp));
    const up = vCross(right, fwd);

    const rel = vSub(p, cam);
    const cx = vDot(rel, right);
    const cy = vDot(rel, up);
    const cz = vDot(rel, fwd);

    if (cz < 0.05) return null;

    const scale = this.focal / cz;
    return {
      x: this.canvas.width / 2 + cx * scale,
      y: this.canvas.height / 2 - cy * scale,
      depth: cz
    };
  }

  projectPath(points) {
    const out = [];
    for (const p of points) {
      const proj = this.project(p);
      if (proj) out.push(proj);
    }
    return out;
  }

  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.drawBackground();
    this.drawGround();
    this.drawCourtLines();
    this.drawNet();
    this.drawTrajectories();
  }

  drawBackground() {
    const { ctx, canvas } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0b1120');
    grad.addColorStop(1, '#141f33');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  fillQuad(points3d, fillStyle) {
    const pts = this.projectPath(points3d);
    if (pts.length < points3d.length) return; // some corner behind camera, skip
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  strokePath(points3d, strokeStyle, lineWidth) {
    const pts = this.projectPath(points3d);
    if (pts.length < 2) return;
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth * this.dpr;
    ctx.stroke();
  }

  drawGround() {
    // Outer free zone (terracotta) and inner playing court (blue)
    this.fillQuad(
      [{ x: -3.5, y: -2.5, z: 0 }, { x: 21.5, y: -2.5, z: 0 }, { x: 21.5, y: 11.5, z: 0 }, { x: -3.5, y: 11.5, z: 0 }],
      '#7c3414'
    );
    this.fillQuad(
      [{ x: 0, y: 0, z: 0 }, { x: 18, y: 0, z: 0 }, { x: 18, y: 9, z: 0 }, { x: 0, y: 9, z: 0 }],
      '#1d3f8a'
    );
  }

  drawCourtLines() {
    const z = 0.01;
    this.strokePath([{ x: 0, y: 0, z }, { x: 18, y: 0, z }, { x: 18, y: 9, z }, { x: 0, y: 9, z }, { x: 0, y: 0, z }], '#ffffff', 2);
    this.strokePath([{ x: 6, y: 0, z }, { x: 6, y: 9, z }], 'rgba(255,255,255,0.85)', 1.5);
    this.strokePath([{ x: 12, y: 0, z }, { x: 12, y: 9, z }], 'rgba(255,255,255,0.85)', 1.5);
  }

  drawNet() {
    const NET_H = 2.43;
    // Net mesh panel
    this.fillQuad(
      [{ x: 9, y: 0, z: 0.1 }, { x: 9, y: 9, z: 0.1 }, { x: 9, y: 9, z: NET_H }, { x: 9, y: 0, z: NET_H }],
      'rgba(226, 232, 240, 0.22)'
    );
    // Top band
    this.strokePath([{ x: 9, y: 0, z: NET_H }, { x: 9, y: 9, z: NET_H }], '#f8fafc', 3);
    // Posts
    this.strokePath([{ x: 9, y: -0.1, z: 0 }, { x: 9, y: -0.1, z: NET_H + 0.15 }], '#94a3b8', 2);
    this.strokePath([{ x: 9, y: 9.1, z: 0 }, { x: 9, y: 9.1, z: NET_H + 0.15 }], '#94a3b8', 2);
    // Antennae
    this.strokePath([{ x: 9, y: 0, z: NET_H }, { x: 9, y: 0, z: NET_H + 0.8 }], '#ef4444', 2.5);
    this.strokePath([{ x: 9, y: 9, z: NET_H }, { x: 9, y: 9, z: NET_H + 0.8 }], '#ef4444', 2.5);
  }

  outcomeColor(outcome) {
    if (outcome === 'Ace') return '#10b981';
    if (outcome === 'Fault') return '#ef4444';
    return '#3b82f6'; // In / Rally
  }

  // Synthesize a flight arc height (meters) - NOT measured data, purely
  // for a fun visual. Jump serves get a slightly higher, punchier arc.
  arcPeakHeight(serveType) {
    let peak = 2.6;
    if (serveType && serveType.indexOf('Jump') !== -1) peak += 0.6;
    if (serveType && serveType.indexOf('Topspin') !== -1) peak += 0.2;
    return peak;
  }

  drawTrajectories() {
    const camPos = this.getCameraPos();
    const withDepth = this.trajectories.map((serve) => {
      const midX = (serve.start_x + serve.end_x) / 2;
      const midY = (serve.start_y + serve.end_y) / 2;
      const depth = Math.hypot(midX - camPos.x, midY - camPos.y, 1.5 - camPos.z);
      return { serve, depth };
    });
    withDepth.sort((a, b) => b.depth - a.depth); // far first, near last

    withDepth.forEach(({ serve }) => this.drawSingleTrajectory(serve));
  }

  drawSingleTrajectory(serve) {
    const peak = this.arcPeakHeight(serve.serve_type);
    const steps = 28;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: serve.start_x + (serve.end_x - serve.start_x) * t,
        y: serve.start_y + (serve.end_y - serve.start_y) * t,
        z: peak * Math.sin(Math.PI * t)
      });
    }

    const color = this.outcomeColor(serve.outcome);
    this.strokePath(points, color, 2.5);

    // Ground shadow + landing marker
    const startGround = this.project({ x: serve.start_x, y: serve.start_y, z: 0 });
    const endGround = this.project({ x: serve.end_x, y: serve.end_y, z: 0 });
    const { ctx } = this;

    if (startGround) {
      ctx.beginPath();
      ctx.arc(startGround.x, startGround.y, 4 * this.dpr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    }

    if (endGround) {
      ctx.beginPath();
      ctx.ellipse(endGround.x, endGround.y, 9 * this.dpr, 4 * this.dpr, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(endGround.x, endGround.y, 5 * this.dpr, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

window.Court3DView = Court3DView;
