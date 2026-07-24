(() => {
  'use strict';

  const state = {
    stream: null,
    mode: 'bw',       // 'bw' | 'color'
    shots: [],        // { id, dataUrl, width, height }
  };

  let pdf = null;
  let dragCard = null;

  const $ = (id) => document.getElementById(id);

  const els = {
    screenCamera: $('screen-camera'),
    screenReview: $('screen-review'),
    screenDone: $('screen-done'),

    video: $('video'),
    shotCount: $('shotCount'),
    modeToggle: $('modeToggle'),
    captureBtn: $('captureBtn'),
    doneBtn: $('doneBtn'),
    doneCount: $('doneCount'),
    filmstrip: $('filmstrip'),
    scanBeam: $('scanBeam'),
    flash: $('flash'),
    cameraHint: $('cameraHint'),
    cameraError: $('cameraError'),

    backBtn: $('backBtn'),
    reviewCount: $('reviewCount'),
    reviewGrid: $('reviewGrid'),
    exportBtn: $('exportBtn'),
    exportLabel: $('exportLabel'),

    doneSub: $('doneSub'),
    restartBtn: $('restartBtn'),
  };

  // ---------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------
  async function startCamera() {
    els.cameraError.hidden = true;
    els.cameraHint.hidden = false;
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 2000 },
          height: { ideal: 2000 },
        },
      });
      els.video.srcObject = state.stream;
      await els.video.play();
    } catch (err) {
      console.error('camera error', err);
      showCameraFallback(
        '카메라를 사용할 수 없어요. 브라우저의 카메라 권한을 허용했는지 확인하거나, 아래에서 사진을 직접 선택해주세요.'
      );
    }
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
    }
  }

  function showCameraFallback(message) {
    els.cameraHint.hidden = true;
    els.cameraError.hidden = false;
    els.cameraError.innerHTML = '';
    const p = document.createElement('p');
    p.style.margin = '0 0 14px';
    p.textContent = message;
    const label = document.createElement('label');
    label.className = 'restart-btn';
    label.style.cursor = 'pointer';
    label.textContent = '사진에서 선택하기';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.multiple = true;
    input.style.display = 'none';
    input.addEventListener('change', (e) => handleFileFallback(e.target.files));
    label.appendChild(input);
    els.cameraError.appendChild(p);
    els.cameraError.appendChild(label);
  }

  async function handleFileFallback(fileList) {
    const files = Array.from(fileList || []);
    for (const file of files) {
      const dataUrl = await fileToProcessedDataUrl(file, state.mode);
      if (dataUrl) {
        state.shots.push(makeShot(dataUrl.dataUrl, dataUrl.width, dataUrl.height));
      }
    }
    renderFilmstrip();
    updateShotCount();
  }

  function fileToProcessedDataUrl(file, mode) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        applyScanFilter(ctx, canvas.width, canvas.height, mode);
        URL.revokeObjectURL(url);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.86),
          width: canvas.width,
          height: canvas.height,
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  // ---------------------------------------------------------------
  // Scan-look image processing (contrast stretch + optional grayscale)
  // ---------------------------------------------------------------
  function applyScanFilter(ctx, width, height, mode) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // sample every 4th pixel to find luminance min/max quickly on large photos
    let min = 255, max = 0;
    for (let i = 0; i < data.length; i += 16) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    // pad the range slightly so we don't clip real content
    min = Math.max(0, min - 6);
    max = Math.min(255, max + 6);
    const range = Math.max(max - min, 1);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (mode === 'bw') {
        let lum = 0.299 * r + 0.587 * g + 0.114 * b;
        lum = ((lum - min) / range) * 255;
        lum = (lum - 128) * 1.25 + 128 + 12; // extra contrast + brighten like paper
        lum = Math.min(255, Math.max(0, lum));
        data[i] = data[i + 1] = data[i + 2] = lum;
      } else {
        data[i] = clamp(((r - min) / range) * 255 * 1.03);
        data[i + 1] = clamp(((g - min) / range) * 255 * 1.03);
        data[i + 2] = clamp(((b - min) / range) * 255 * 1.03);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
  function clamp(v) { return Math.min(255, Math.max(0, v)); }

  // ---------------------------------------------------------------
  // Capture
  // ---------------------------------------------------------------
  function capture() {
    const video = els.video;
    if (!video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    applyScanFilter(ctx, canvas.width, canvas.height, state.mode);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    state.shots.push(makeShot(dataUrl, canvas.width, canvas.height));

    playCaptureFeedback();
    renderFilmstrip();
    updateShotCount();
  }

  function makeShot(dataUrl, width, height) {
    return { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, dataUrl, width, height };
  }

  function playCaptureFeedback() {
    els.flash.classList.remove('fire'); void els.flash.offsetWidth; els.flash.classList.add('fire');
    els.scanBeam.classList.remove('sweep'); void els.scanBeam.offsetWidth; els.scanBeam.classList.add('sweep');
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function renderFilmstrip() {
    els.filmstrip.innerHTML = '';
    state.shots.forEach((shot, i) => {
      const div = document.createElement('div');
      div.className = 'filmstrip-thumb';
      div.innerHTML = `<img src="${shot.dataUrl}" alt="page ${i + 1}"><span class="idx">${i + 1}</span>`;
      els.filmstrip.appendChild(div);
    });
    els.filmstrip.scrollLeft = els.filmstrip.scrollWidth;
  }

  function updateShotCount() {
    const n = state.shots.length;
    els.shotCount.textContent = n;
    els.doneBtn.disabled = n === 0;
    els.doneCount.textContent = n > 0 ? `${n}장` : '';
  }

  function updateModeUI() {
    els.modeToggle.querySelectorAll('.mode-option').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });
  }

  // ---------------------------------------------------------------
  // Review screen (reorder + delete)
  // ---------------------------------------------------------------
  function goToReview() {
    stopCamera();
    els.screenCamera.hidden = true;
    els.screenReview.hidden = false;
    renderReview();
    updateReviewCount();
  }

  function goToCamera() {
    els.screenReview.hidden = true;
    els.screenDone.hidden = true;
    els.screenCamera.hidden = false;
    startCamera();
  }

  function renderReview() {
    els.reviewGrid.innerHTML = '';
    state.shots.forEach((shot, i) => {
      els.reviewGrid.appendChild(buildReviewCard(shot, i));
    });
  }

  function buildReviewCard(shot, i) {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.dataset.id = shot.id;
    card.innerHTML = `
      <img src="${shot.dataUrl}" alt="page ${i + 1}">
      <span class="idx">${i + 1}</span>
      <button class="remove" type="button" aria-label="삭제">✕</button>
    `;
    card.querySelector('.remove').addEventListener('click', () => {
      state.shots = state.shots.filter((s) => s.id !== shot.id);
      renderReview();
      updateReviewCount();
    });
    attachDrag(card);
    return card;
  }

  function attachDrag(card) {
    card.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.remove')) return;
      dragCard = card;
      try { card.setPointerCapture(e.pointerId); } catch (_) {}
      card.classList.add('dragging');
    });
    card.addEventListener('pointermove', (e) => {
      if (dragCard !== card) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = el && el.closest('.review-card');
      if (target && target !== card && target.parentElement === els.reviewGrid) {
        const cards = Array.from(els.reviewGrid.children);
        const dragIdx = cards.indexOf(card);
        const targetIdx = cards.indexOf(target);
        if (dragIdx < targetIdx) els.reviewGrid.insertBefore(card, target.nextSibling);
        else els.reviewGrid.insertBefore(card, target);
        relabelIndices();
      }
    });
    const stop = () => {
      if (dragCard === card) {
        card.classList.remove('dragging');
        dragCard = null;
        syncOrderFromDOM();
      }
    };
    card.addEventListener('pointerup', stop);
    card.addEventListener('pointercancel', stop);
  }

  function relabelIndices() {
    Array.from(els.reviewGrid.children).forEach((card, i) => {
      card.querySelector('.idx').textContent = i + 1;
    });
  }

  function syncOrderFromDOM() {
    const ids = Array.from(els.reviewGrid.children).map((c) => c.dataset.id);
    state.shots = ids.map((id) => state.shots.find((s) => s.id === id)).filter(Boolean);
  }

  function updateReviewCount() {
    els.reviewCount.textContent = state.shots.length;
    els.exportBtn.disabled = state.shots.length === 0;
  }

  // ---------------------------------------------------------------
  // PDF export
  // ---------------------------------------------------------------
  async function exportPdf() {
    if (!state.shots.length) return;
    els.exportBtn.disabled = true;
    const total = state.shots.length;
    pdf = null;

    for (let i = 0; i < total; i++) {
      els.exportLabel.textContent = `PDF 생성 중… (${i + 1}/${total})`;
      const shot = state.shots[i];
      const orientation = shot.width > shot.height ? 'l' : 'p';
      if (i === 0) {
        pdf = new window.jspdf.jsPDF({
          orientation,
          unit: 'px',
          format: [shot.width, shot.height],
          compress: true,
        });
      } else {
        pdf.addPage([shot.width, shot.height], orientation);
      }
      pdf.addImage(shot.dataUrl, 'JPEG', 0, 0, shot.width, shot.height, undefined, 'FAST');
      // let the UI paint the progress label between pages
      await new Promise((r) => requestAnimationFrame(r));
    }

    const filename = buildFilename();
    pdf.save(filename);
    showDone(total, filename);
    els.exportBtn.disabled = false;
    els.exportLabel.textContent = 'PDF로 저장';
  }

  function buildFilename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `scan_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
  }

  function showDone(total, filename) {
    els.screenReview.hidden = true;
    els.screenDone.hidden = false;
    els.doneSub.textContent = `${total}장 · ${filename}`;
  }

  function restart() {
    state.shots = [];
    renderFilmstrip();
    updateShotCount();
    els.screenDone.hidden = true;
    goToCamera();
  }

  // ---------------------------------------------------------------
  // Wire up events
  // ---------------------------------------------------------------
  els.captureBtn.addEventListener('click', capture);

  els.modeToggle.addEventListener('click', (e) => {
    const opt = e.target.closest('.mode-option');
    if (!opt) return;
    state.mode = opt.dataset.mode;
    updateModeUI();
  });

  els.doneBtn.addEventListener('click', goToReview);
  els.backBtn.addEventListener('click', goToCamera);
  els.exportBtn.addEventListener('click', exportPdf);
  els.restartBtn.addEventListener('click', restart);

  // init
  updateModeUI();
  updateShotCount();
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    startCamera();
  } else {
    showCameraFallback('이 브라우저는 카메라 촬영을 지원하지 않아요. 아래에서 사진을 직접 선택해주세요.');
  }
})();
