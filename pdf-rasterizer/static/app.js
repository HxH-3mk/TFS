// PDF Rasterizer Pro - Frontend Logic

let fileQueue = []; // List of uploaded file objects
let currentJobId = null;
let eventSource = null;
let globalDpi = 200;
let globalFormat = 'jpeg';

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    fetchSystemInfo();
    setupDropZone();
});

// Theme Toggle
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('rasterizer_theme', next);
}

// Fetch System Info
async function fetchSystemInfo() {
    try {
        const res = await fetch('/api/system-info');
        const data = await res.json();
        const cpuText = document.getElementById('cpuCountText');
        if (cpuText) {
            cpuText.textContent = `معالج متوازي: ${data.cpu_count} أنوية`;
        }
    } catch (e) {
        console.warn('System info check failed:', e);
    }
}

// Dropzone Setup
function setupDropZone() {
    const zone = document.getElementById('dropZone');
    if (!zone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        zone.addEventListener(evt, e => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(evt => {
        zone.addEventListener(evt, () => zone.classList.add('dragover'));
    });

    ['dragleave', 'drop'].forEach(evt => {
        zone.addEventListener(evt, () => zone.classList.remove('dragover'));
    });

    zone.addEventListener('drop', e => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFilesSelected(files);
        }
    });
}

// Global DPI Selection
function handleGlobalDpiChange(val) {
    const customInput = document.getElementById('customDpiInput');
    if (val === 'custom') {
        customInput.style.display = 'block';
        globalDpi = parseInt(customInput.value) || 200;
    } else {
        customInput.style.display = 'none';
        globalDpi = parseInt(val) || 200;
    }

    // Update DPI for any queued items that haven't been customized manually
    fileQueue.forEach(item => {
        if (!item.hasCustomDpi && item.status === 'ready') {
            item.dpi = globalDpi;
            const el = document.getElementById(`dpi-select-${item.file_id}`);
            if (el) el.value = val === 'custom' ? 'custom' : val;
        }
    });
}

function handleCustomDpiInput(val) {
    const dpi = parseInt(val);
    if (dpi && dpi >= 30 && dpi <= 1200) {
        globalDpi = dpi;
        fileQueue.forEach(item => {
            if (!item.hasCustomDpi && item.status === 'ready') {
                item.dpi = globalDpi;
            }
        });
    }
}

function handleGlobalFormatChange(val) {
    globalFormat = val;
    fileQueue.forEach(item => {
        if (item.status === 'ready') {
            item.format = globalFormat;
        }
    });
}

// Upload & Append Files
async function handleFilesSelected(files) {
    if (!files || files.length === 0) return;

    const pdfFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
        showToast('يرجى اختيار ملفات PDF فقط', 'warning');
        return;
    }

    showToast(`جاري فحص ورفع ${pdfFiles.length} ملف...`, 'info');

    const formData = new FormData();
    pdfFiles.forEach(f => formData.append('files', f));

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            showToast(data.error || 'حدث خطأ أثناء رفع الملفات', 'danger');
            return;
        }

        data.files.forEach(uploaded => {
            // Check if already in queue
            const exists = fileQueue.some(q => q.file_id === uploaded.file_id || q.original_name === uploaded.original_name);
            if (!exists) {
                fileQueue.push({
                    ...uploaded,
                    dpi: globalDpi,
                    format: globalFormat,
                    status: 'ready',
                    progress_percent: 0,
                    message: 'جاهز للتحويل',
                    hasCustomDpi: false
                });
            }
        });

        renderQueue();
        showToast(`تمت إضافة ${data.count} ملفات إلى قائمة التحويل`);
    } catch (e) {
        console.error(e);
        showToast('تعذر رفع الملفات إلى السيرفر', 'danger');
    }
}

// Render File Queue Cards
function renderQueue() {
    const list = document.getElementById('filesList');
    const actionsBar = document.getElementById('actionsBar');
    const summaryText = document.getElementById('queueSummaryText');

    if (!list) return;

    if (fileQueue.length === 0) {
        list.innerHTML = '';
        actionsBar.style.display = 'none';
        return;
    }

    actionsBar.style.display = 'flex';
    const totalPages = fileQueue.reduce((acc, f) => acc + (f.pages || 0), 0);
    const totalSizeMB = (fileQueue.reduce((acc, f) => acc + (f.size || 0), 0) / (1024 * 1024)).toFixed(2);
    summaryText.textContent = `${fileQueue.length} ملفات جاهزة (${totalPages} صفحة إجمالية - ${totalSizeMB} MB)`;

    list.innerHTML = '';

    fileQueue.forEach(item => {
        const card = document.createElement('div');
        card.id = `card-${item.file_id}`;
        card.className = `file-card ${item.status}`;

        const sizeMB = (item.size / (1024 * 1024)).toFixed(2);

        card.innerHTML = `
            <div class="file-card-top">
                <div class="file-main-info">
                    <div class="file-icon">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                    </div>
                    <div class="file-names">
                        <span class="file-title">${escapeHtml(item.original_name)}</span>
                        <div class="file-meta-row">
                            <span>📄 ${item.pages} صفحة</span>
                            <span>⚖️ ${sizeMB} MB</span>
                            <span id="output-meta-${item.file_id}" style="color:var(--success); font-weight:700;"></span>
                        </div>
                    </div>
                </div>

                <div class="file-card-actions">
                    <label style="font-size:0.8rem; font-weight:600;">DPI:</label>
                    <select id="dpi-select-${item.file_id}" class="file-dpi-select" onchange="handleItemDpiChange('${item.file_id}', this.value)" ${item.status === 'processing' ? 'disabled' : ''}>
                        <option value="72" ${item.dpi == 72 ? 'selected' : ''}>72 DPI</option>
                        <option value="150" ${item.dpi == 150 ? 'selected' : ''}>150 DPI</option>
                        <option value="200" ${item.dpi == 200 ? 'selected' : ''}>200 DPI (افتراضي)</option>
                        <option value="300" ${item.dpi == 300 ? 'selected' : ''}>300 DPI</option>
                        <option value="400" ${item.dpi == 400 ? 'selected' : ''}>400 DPI</option>
                        <option value="600" ${item.dpi == 600 ? 'selected' : ''}>600 DPI</option>
                    </select>

                    <button type="button" id="dl-btn-${item.file_id}" class="btn btn-success" style="display: ${item.status === 'completed' ? 'inline-flex' : 'none'}; padding:0.45rem 0.85rem; font-size:0.82rem;" onclick="downloadSingle('${item.file_id}')">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        تحميل
                    </button>

                    <button type="button" class="btn-icon" title="حذف من القائمة" onclick="removeItem('${item.file_id}')" ${item.status === 'processing' ? 'disabled' : ''}>
                        ✕
                    </button>
                </div>
            </div>

            <div class="progress-wrapper">
                <div class="progress-track">
                    <div class="progress-bar-fill" id="bar-${item.file_id}" style="width: ${item.progress_percent || 0}%;"></div>
                </div>
                <div class="progress-info-row">
                    <span id="msg-${item.file_id}">${item.message || 'جاهز للتحويل'}</span>
                    <span id="pct-${item.file_id}" style="font-weight:700;">${item.progress_percent || 0}%</span>
                </div>
            </div>
        `;

        list.appendChild(card);
    });
}

function handleItemDpiChange(fileId, val) {
    const item = fileQueue.find(f => f.file_id === fileId);
    if (item) {
        item.dpi = parseInt(val) || 200;
        item.hasCustomDpi = true;
    }
}

function removeItem(fileId) {
    fileQueue = fileQueue.filter(f => f.file_id !== fileId);
    renderQueue();
}

function clearQueue() {
    if (currentJobId && eventSource) {
        cancelJob();
    }
    fileQueue = [];
    currentJobId = null;
    renderQueue();
    document.getElementById('downloadZipBtn').style.display = 'none';
}

// Start Processing All Files in Parallel
async function startProcessingAll() {
    if (fileQueue.length === 0) return;

    const payload = {
        files: fileQueue.map(f => ({
            file_id: f.file_id,
            original_name: f.original_name,
            safe_name: f.safe_name,
            pages: f.pages,
            size: f.size,
            saved_path: f.saved_path,
            dpi: f.dpi || globalDpi,
            format: f.format || globalFormat
        }))
    };

    // UI state adjustments
    document.getElementById('startAllBtn').style.display = 'none';
    document.getElementById('cancelBtn').style.display = 'inline-flex';
    document.getElementById('downloadZipBtn').style.display = 'none';

    try {
        const res = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.error || 'تعذر بدء عملية التحويل', 'danger');
            resetUiButtons();
            return;
        }

        currentJobId = data.job_id;
        showToast('بدأت المعالجة المتوازية للملفات...');
        listenToJobProgress(currentJobId);
    } catch (e) {
        console.error(e);
        showToast('خطأ في الاتصال بالسيرفر', 'danger');
        resetUiButtons();
    }
}

// Listen to Real-time Progress (SSE)
function listenToJobProgress(jobId) {
    if (eventSource) {
        eventSource.close();
    }

    eventSource = new EventSource(`/api/stream/${jobId}`);

    eventSource.onmessage = e => {
        try {
            const job = JSON.parse(e.data);
            updateJobUi(job);

            if (job.status === 'completed') {
                eventSource.close();
                showToast('🎉 اكتمل تحويل جميع الملفات بنجاح!', 'success');
                onJobFinished(true);
            } else if (job.status === 'cancelled') {
                eventSource.close();
                showToast('تم إلغاء التحويل', 'warning');
                onJobFinished(false);
            } else if (job.status === 'error') {
                eventSource.close();
                showToast('حدث خطأ أثناء معالجة بعض الملفات', 'danger');
                onJobFinished(false);
            }
        } catch (err) {
            console.error('SSE parse error:', err);
        }
    };

    eventSource.onerror = () => {
        // Fallback to polling if SSE drops
        eventSource.close();
        pollJobProgress(jobId);
    };
}

// Fallback polling
async function pollJobProgress(jobId) {
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`/api/progress/${jobId}`);
            if (!res.ok) {
                clearInterval(interval);
                return;
            }
            const job = await res.json();
            updateJobUi(job);

            if (['completed', 'error', 'cancelled'].includes(job.status)) {
                clearInterval(interval);
                onJobFinished(job.status === 'completed');
            }
        } catch (e) {
            clearInterval(interval);
        }
    }, 400);
}

function updateJobUi(job) {
    if (!job || !job.files) return;

    job.files.forEach(jf => {
        const item = fileQueue.find(f => f.file_id === jf.file_id);
        if (!item) return;

        item.status = jf.status;
        item.progress_percent = jf.progress_percent || 0;
        item.message = jf.message || '';

        const card = document.getElementById(`card-${jf.file_id}`);
        const bar = document.getElementById(`bar-${jf.file_id}`);
        const pct = document.getElementById(`pct-${jf.file_id}`);
        const msg = document.getElementById(`msg-${jf.file_id}`);
        const dlBtn = document.getElementById(`dl-btn-${jf.file_id}`);
        const outMeta = document.getElementById(`output-meta-${jf.file_id}`);

        if (card) {
            card.className = `file-card ${jf.status}`;
        }
        if (bar) {
            bar.style.width = `${jf.progress_percent}%`;
        }
        if (pct) {
            pct.textContent = `${jf.progress_percent}%`;
        }
        if (msg) {
            msg.textContent = jf.message || '';
        }
        if (jf.status === 'completed') {
            if (dlBtn) dlBtn.style.display = 'inline-flex';
            if (outMeta && jf.output_size) {
                const outMB = (jf.output_size / (1024 * 1024)).toFixed(2);
                outMeta.textContent = `✓ حجم جديد: ${outMB} MB`;
            }
        }
    });
}

function onJobFinished(isSuccess) {
    resetUiButtons();
    if (isSuccess && fileQueue.length > 1) {
        document.getElementById('downloadZipBtn').style.display = 'inline-flex';
    }
}

function resetUiButtons() {
    document.getElementById('startAllBtn').style.display = 'inline-flex';
    document.getElementById('cancelBtn').style.display = 'none';
}

// Cancel ongoing job
async function cancelJob() {
    if (!currentJobId) return;
    try {
        await fetch(`/api/cancel/${currentJobId}`, { method: 'POST' });
        showToast('جاري إيقاف المعالجة...');
    } catch (e) {
        console.error(e);
    }
}

// Download Single PDF
function downloadSingle(fileId) {
    window.location.href = `/api/download/${fileId}`;
}

// Download All As ZIP
function downloadAllAsZip() {
    if (!currentJobId) return;
    window.location.href = `/api/download-all/${currentJobId}`;
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.getElementById('toastNotification');
    const msg = document.getElementById('toastMessage');
    if (!toast || !msg) return;

    msg.textContent = message;
    toast.style.display = 'flex';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 4000);
}

// Helper: Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
