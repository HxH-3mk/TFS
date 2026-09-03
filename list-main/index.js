// IndexedDB Setup
let db;
const DB_NAME = 'educationalMaterialsDB';
const DB_VERSION = 1;
const MATERIALS_STORE = 'materials';
const BOOKS_STORE = 'books';
const FILES_STORE = 'files';

let allItems = [];
let currentCategory = 'all';
let currentSearchQuery = '';

// Initialize the database
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('Error opening database:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(MATERIALS_STORE)) {
                const materialsStore = db.createObjectStore(MATERIALS_STORE, { keyPath: 'id' });
                materialsStore.createIndex('name', 'name', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(BOOKS_STORE)) {
                const booksStore = db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
                booksStore.createIndex('name', 'name', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(FILES_STORE)) {
                db.createObjectStore(FILES_STORE, { keyPath: 'id' });
            }
        };
    });
}

// Get all items from a store
function getAllItems(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => {
            resolve(request.result || []);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Get file from IndexedDB
function getFile(fileId) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        
        const transaction = db.transaction(FILES_STORE, 'readonly');
        const store = transaction.objectStore(FILES_STORE);
        const request = store.get(fileId);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Update an item in a store (for caching thumbnails)
function updateItem(storeName, item) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        try {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve();
        } catch (e) {
            resolve();
        }
    });
}

// Create a material card
function createMaterialCard(material) {
    const card = document.createElement('div');
    card.className = 'material-card';
    
    const previewId = `preview-${material.id}`;
    const previewInner = material.thumbnail 
        ? `<img src="${material.thumbnail}" alt="${escapeHtml(material.name)}" class="pdf-thumbnail-img" loading="lazy">`
        : `<div class="pdf-placeholder">
                <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <span>معاينة المذكرة</span>
            </div>`;
    
    card.innerHTML = `
        <div class="card-preview-area" title="انقر لتحميل المذكرة فوراً">
            <span class="card-badge">مذكرة</span>
            <span class="grade-badge">${escapeHtml(material.grade || 'غير محدد')}</span>
            <div class="preview-container" id="${previewId}">
                ${previewInner}
            </div>
            <button class="preview-overlay-btn" type="button">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                تحميل المذكرة
            </button>
        </div>
        <div class="details">
            <h3 class="material-title">${escapeHtml(material.name)}</h3>
            <div class="info-chips">
                ${material.school ? `
                <span class="chip" title="المدرسة">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                    ${escapeHtml(material.school)}
                </span>` : ''}
                
                ${material.teacher ? `
                <span class="chip" title="المعلم">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    ${escapeHtml(material.teacher)}
                </span>` : ''}
                
                ${material.sides ? `
                <span class="chip" title="الطباعة">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                    ${escapeHtml(material.sides)}
                </span>` : ''}
            </div>
            
            <div class="card-footer">
                <div class="price-tag">
                    <span class="price-label">السعر</span>
                    <span class="price-value">${material.price || 0} <small style="font-size:0.75rem">ر.س</small></span>
                </div>
                <button type="button" class="download-link">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    تحميل
                </button>
            </div>
        </div>
    `;
    
    const targetFileName = material.fileName || (material.name ? material.name + '.pdf' : 'material.pdf');
    const onDownload = (e) => {
        if (e) e.stopPropagation();
        downloadFile(material.fileId, targetFileName, material.name, material.id);
    };
    
    const previewArea = card.querySelector('.card-preview-area');
    const overlayBtn = card.querySelector('.preview-overlay-btn');
    const downloadBtn = card.querySelector('.download-link');
    
    if (previewArea) previewArea.addEventListener('click', onDownload);
    if (overlayBtn) overlayBtn.addEventListener('click', onDownload);
    if (downloadBtn) downloadBtn.addEventListener('click', onDownload);
    
    return card;
}

// Create a book card
function createBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    
    const previewId = `preview-${book.id}`;
    const previewInner = book.thumbnail 
        ? `<img src="${book.thumbnail}" alt="${escapeHtml(book.name)}" class="pdf-thumbnail-img" loading="lazy">`
        : `<div class="pdf-placeholder">
                <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <span>معاينة الكتاب</span>
            </div>`;
    
    card.innerHTML = `
        <div class="card-preview-area" title="انقر لتحميل الكتاب فوراً">
            <span class="card-badge" style="background: rgba(114, 9, 183, 0.85)">كتاب</span>
            <span class="grade-badge">${escapeHtml(book.grade || 'غير محدد')}</span>
            <div class="preview-container" id="${previewId}">
                ${previewInner}
            </div>
            <button class="preview-overlay-btn" type="button">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                تحميل الكتاب
            </button>
        </div>
        <div class="details">
            <h3 class="book-title">${escapeHtml(book.name)}</h3>
            <div class="info-chips">
                <span class="chip" title="الصف الدراسي">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
                    الصف: ${escapeHtml(book.grade || 'الكل')}
                </span>
            </div>
            
            <div class="card-footer">
                <div class="price-tag">
                    <span class="price-label">السعر</span>
                    <span class="price-value">${book.price || 0} <small style="font-size:0.75rem">ر.س</small></span>
                </div>
                <button type="button" class="download-link">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    تحميل
                </button>
            </div>
        </div>
    `;
    
    const targetFileName = book.fileName || (book.name ? book.name + '.pdf' : 'book.pdf');
    const onDownload = (e) => {
        if (e) e.stopPropagation();
        downloadFile(book.fileId, targetFileName, book.name, book.id);
    };
    
    const previewArea = card.querySelector('.card-preview-area');
    const overlayBtn = card.querySelector('.preview-overlay-btn');
    const downloadBtn = card.querySelector('.download-link');
    
    if (previewArea) previewArea.addEventListener('click', onDownload);
    if (overlayBtn) overlayBtn.addEventListener('click', onDownload);
    if (downloadBtn) downloadBtn.addEventListener('click', onDownload);
    
    return card;
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

// Directory Handle & Local Folder Storage Management for Home Page
let indexLinkedDirectoryHandle = null;

// Retrieve stored directory handle from IndexedDB
async function getStoredDirectoryHandle() {
    if (!db) return null;
    try {
        const transaction = db.transaction(FILES_STORE, 'readonly');
        const store = transaction.objectStore(FILES_STORE);
        const req = store.get('__linked_dir_handle__');
        return new Promise((resolve) => {
            req.onsuccess = () => resolve(req.result ? req.result.handle : null);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

// --- Google Drive Cloud Sync Configuration ---
function getCloudApiUrl() {
    return (localStorage.getItem('gdrive_api_url') || '').trim();
}

function setCloudApiUrl(url) {
    if (url && url.trim() !== '') {
        localStorage.setItem('gdrive_api_url', url.trim());
    } else {
        localStorage.removeItem('gdrive_api_url');
    }
}

// Update the cloud button and indicator in the home page
function updateCloudStorageButton() {
    const btn = document.getElementById('btnCloudSyncHome');
    const btnText = document.getElementById('cloudSyncHomeText');
    const cloudUrl = getCloudApiUrl();
    
    if (btn && btnText) {
        if (cloudUrl) {
            btnText.textContent = '☁️ متصل بسحابة Drive';
            btn.style.borderColor = 'var(--primary)';
            btn.style.color = 'var(--primary)';
            btn.style.background = 'var(--primary-light)';
            btn.title = 'متصل بسحابة Google Drive (انقر لتعديل الرابط أو المزامنة)';
        } else {
            btnText.textContent = 'سحابة Drive';
            btn.style.borderColor = '';
            btn.style.color = '';
            btn.style.background = '';
            btn.title = 'ربط سحابة Google Drive للمزامنة مع كافة الأجهزة';
        }
    }
}

// Open Cloud Settings Modal
function openCloudSettingsModal() {
    const modal = document.getElementById('cloudModal');
    const input = document.getElementById('cloudApiUrlInput');
    const statusMsg = document.getElementById('cloudStatusMsg');
    
    if (input) input.value = getCloudApiUrl();
    if (statusMsg) statusMsg.style.display = 'none';
    if (modal) modal.classList.add('active');
}

// Close Cloud Settings Modal
function closeCloudModal(e) {
    if (e && e.target && e.target.classList.contains('modal-dialog')) return;
    const modal = document.getElementById('cloudModal');
    if (modal) modal.classList.remove('active');
}

// Test Cloud Connection from Modal
async function testCloudConnectionFromModal() {
    const input = document.getElementById('cloudApiUrlInput');
    const statusMsg = document.getElementById('cloudStatusMsg');
    const url = (input ? input.value : '').trim();
    
    if (!url) {
        alert('الرجاء إدخال رابط Google Apps Script Web App');
        return;
    }
    
    if (statusMsg) {
        statusMsg.style.display = 'block';
        statusMsg.style.background = 'var(--bg-alt)';
        statusMsg.style.color = 'var(--text-primary)';
        statusMsg.textContent = '⏳ جاري فحص الاتصال بسحابة Google Drive...';
    }
    
    try {
        const pingUrl = url + (url.includes('?') ? '&' : '?') + 'action=ping&t=' + Date.now();
        const resp = await fetch(pingUrl);
        const data = await resp.json();
        
        if (data && data.status === 'ok') {
            if (statusMsg) {
                statusMsg.style.background = 'var(--success-light)';
                statusMsg.style.color = 'var(--success)';
                statusMsg.textContent = `✅ ${data.message} (المجلد: ${data.folderName || 'Educational_Materials_Storage'})`;
            }
        } else {
            throw new Error((data && data.message) || 'استجابة غير صالحة');
        }
    } catch (err) {
        if (statusMsg) {
            statusMsg.style.background = 'var(--danger-light)';
            statusMsg.style.color = 'var(--danger)';
            statusMsg.textContent = `❌ تعذر الاتصال: ${err.message}. تأكد من نشر السكربت بصلاحية "Anyone" (أي مستخدم).`;
        }
    }
}

// Save Cloud API URL and sync data
async function saveCloudApiUrlFromModal() {
    const input = document.getElementById('cloudApiUrlInput');
    const url = (input ? input.value : '').trim();
    
    if (!url) {
        alert('الرجاء إدخال رابط Google Apps Script Web App');
        return;
    }
    
    setCloudApiUrl(url);
    updateCloudStorageButton();
    
    try {
        const getDataUrl = url + (url.includes('?') ? '&' : '?') + 'action=getData&t=' + Date.now();
        const resp = await fetch(getDataUrl);
        const data = await resp.json();
        
        if (data && (Array.isArray(data.materials) || Array.isArray(data.books))) {
            const transMat = db.transaction(MATERIALS_STORE, 'readwrite');
            transMat.objectStore(MATERIALS_STORE).clear();
            const transBook = db.transaction(BOOKS_STORE, 'readwrite');
            transBook.objectStore(BOOKS_STORE).clear();
            
            if (Array.isArray(data.materials)) {
                for (const m of data.materials) await updateItem(MATERIALS_STORE, m);
            }
            if (Array.isArray(data.books)) {
                for (const b of data.books) await updateItem(BOOKS_STORE, b);
            }
            
            await loadEducationalData();
            closeCloudModal();
            alert('تم ربط سحابة Google Drive ومزامنة كافة المذكرات والكتب بنجاح!');
        } else {
            closeCloudModal();
            alert('تم حفظ الرابط السحابي بنجاح!');
        }
    } catch (err) {
        console.warn('Cloud sync error on save:', err);
        closeCloudModal();
        alert('تم حفظ الرابط، ولكن حدث خطأ أثناء جلب البيانات: ' + err.message);
    }
}

// Disconnect Cloud API from Modal
function disconnectCloudFromModal() {
    if (!confirm('هل تريد فصل الرابط السحابي والعودة للتخزين العادي؟')) return;
    setCloudApiUrl('');
    updateCloudStorageButton();
    closeCloudModal();
    alert('تم فصل الرابط السحابي.');
}

// Update the storage button text on the home page
async function updateHomeStorageButton() {
    if (!indexLinkedDirectoryHandle) {
        indexLinkedDirectoryHandle = await getStoredDirectoryHandle();
    }
    const btnText = document.getElementById('linkFolderHomeText');
    const btn = document.getElementById('btnLinkFolderHome');
    if (btnText && btn) {
        if (indexLinkedDirectoryHandle) {
            btnText.textContent = `📁 ${indexLinkedDirectoryHandle.name}`;
            btn.style.borderColor = 'var(--primary)';
            btn.style.color = 'var(--primary)';
            btn.title = `المجلد المتصل: ${indexLinkedDirectoryHandle.name} (انقر للتغيير أو إعادة الربط)`;
        } else {
            btnText.textContent = 'مجلد محلي';
            btn.style.borderColor = '';
            btn.style.color = '';
            btn.title = 'ربط مجلد المذكرات والكتب على جهازك';
        }
    }
    updateCloudStorageButton();
}

// --- Download Progress UI Helpers ---
let downloadProgressTimer = null;

function showDownloadProgress(title, percent = 0, sub = 'يرجى الانتظار قليلاً...', source = 'جاري المعالجة...') {
    const overlay = document.getElementById('downloadProgressOverlay');
    const titleEl = document.getElementById('downloadProgressTitle');
    const subEl = document.getElementById('downloadProgressSub');
    const barEl = document.getElementById('downloadProgressBar');
    const percentEl = document.getElementById('downloadProgressPercent');
    const sourceEl = document.getElementById('downloadProgressSource');
    
    if (downloadProgressTimer) {
        clearTimeout(downloadProgressTimer);
        downloadProgressTimer = null;
    }
    
    if (overlay) overlay.style.display = 'block';
    if (titleEl) titleEl.textContent = title ? `جاري تجهيز: ${title}` : 'جاري تجهيز الملف...';
    if (subEl) subEl.textContent = sub;
    if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
    if (sourceEl) sourceEl.textContent = source;
}

function updateDownloadProgress(percent, sub = null, source = null) {
    const subEl = document.getElementById('downloadProgressSub');
    const barEl = document.getElementById('downloadProgressBar');
    const percentEl = document.getElementById('downloadProgressPercent');
    const sourceEl = document.getElementById('downloadProgressSource');
    
    if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
    if (sub && subEl) subEl.textContent = sub;
    if (source && sourceEl) sourceEl.textContent = source;
}

function finishDownloadProgress(message = '✅ تم تجهيز الملف، يبدأ التنزيل الآن...') {
    updateDownloadProgress(100, message, 'اكتمل التحميل');
    downloadProgressTimer = setTimeout(() => {
        const overlay = document.getElementById('downloadProgressOverlay');
        if (overlay) overlay.style.display = 'none';
    }, 2000);
}

function hideDownloadProgress() {
    const overlay = document.getElementById('downloadProgressOverlay');
    if (overlay) overlay.style.display = 'none';
}

// Collect all PDF file handles recursively from directory and subdirectories
async function collectAllPdfsFromDirectory(dirHandle, maxDepth = 4, currentDepth = 0) {
    const results = [];
    if (!dirHandle || currentDepth > maxDepth) return results;
    
    try {
        if (typeof dirHandle.values === 'function' || typeof dirHandle.entries === 'function') {
            const iterator = dirHandle.values ? dirHandle.values() : dirHandle.entries();
            for await (const entry of iterator) {
                const handle = Array.isArray(entry) ? entry[1] : entry;
                if (!handle) continue;
                if (handle.kind === 'file') {
                    if (handle.name && (handle.name.toLowerCase().endsWith('.pdf') || handle.name.toLowerCase().includes('.pdf'))) {
                        results.push(handle);
                    }
                } else if (handle.kind === 'directory') {
                    const subResults = await collectAllPdfsFromDirectory(handle, maxDepth, currentDepth + 1);
                    results.push(...subResults);
                }
            }
        }
    } catch (err) {
        console.warn('Directory scan notice at depth', currentDepth, err);
    }
    return results;
}

// Deep and robust search for PDF file inside directory handle and all subdirectories
async function findFileInDirectoryHandle(rootDirHandle, fileId, rawFileName, itemId = null, itemName = null) {
    if (!rootDirHandle) return null;
    
    const idsToTry = [fileId, itemId].filter(Boolean).map(x => x.toString().trim());
    const namesToTry = [rawFileName, itemName].filter(Boolean).map(x => x.toString().trim());
    
    const norm = (str) => (str || '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/[\s_\-\.\(\)\[\]]+/g, '');
        
    const tokenize = (str) => (str || '')
        .toLowerCase()
        .replace(/\.pdf$/i, '')
        .split(/[\s_\-\.\(\)\[\]]+/)
        .filter(x => x && x.length > 1);
        
    const itemTokens = [];
    namesToTry.forEach(n => itemTokens.push(...tokenize(n)));
    
    // 1. Collect all PDF file handles across all subdirectories recursively
    const allPdfHandles = await collectAllPdfsFromDirectory(rootDirHandle);
    if (allPdfHandles.length === 0) return null;
    
    // 2. Exact candidate matching
    const candidateNames = [];
    for (const cleanId of idsToTry) {
        for (const cleanName of namesToTry) {
            const cleanNoExt = cleanName.replace(/\.pdf$/i, '');
            candidateNames.push(`${cleanId}_${cleanName}`);
            candidateNames.push(`${cleanId}_${cleanNoExt}.pdf`);
            candidateNames.push(`${cleanId}-${cleanNoExt}.pdf`);
            candidateNames.push(`${cleanId}-${cleanName}`);
        }
        candidateNames.push(`${cleanId}.pdf`);
    }
    for (const cleanName of namesToTry) {
        const cleanNoExt = cleanName.replace(/\.pdf$/i, '');
        candidateNames.push(cleanName);
        candidateNames.push(`${cleanNoExt}.pdf`);
    }
    
    for (const handle of allPdfHandles) {
        if (candidateNames.includes(handle.name)) {
            try {
                const file = await handle.getFile();
                if (file && file.size > 0) return file;
            } catch (e) {}
        }
    }
    
    // 3. Match by ID prefix (e.g. 1787670050911_... or 1787670050911-...)
    for (const cleanId of idsToTry) {
        if (!cleanId) continue;
        for (const handle of allPdfHandles) {
            if (handle.name.startsWith(cleanId)) {
                try {
                    const file = await handle.getFile();
                    if (file && file.size > 0) return file;
                } catch (e) {}
            }
        }
    }
    
    // 4. Token-based overlap matching (resilient against hyphens, spaces, rasterized prefixes)
    let bestHandle = null;
    let bestScore = 0;
    
    for (const handle of allPdfHandles) {
        const fileTokens = tokenize(handle.name);
        let score = 0;
        for (const token of itemTokens) {
            if (fileTokens.includes(token) || handle.name.toLowerCase().includes(token)) {
                score++;
            }
        }
        if (score > bestScore && score >= 2) {
            bestScore = score;
            bestHandle = handle;
        }
    }
    
    if (bestHandle) {
        try {
            const file = await bestHandle.getFile();
            if (file && file.size > 0) return file;
        } catch (e) {}
    }
    
    // 5. Normalized text inclusion
    const targetNorms = namesToTry.map(n => norm(n.replace(/\.pdf$/i, ''))).filter(Boolean);
    for (const handle of allPdfHandles) {
        const entryNorm = norm(handle.name.replace(/\.pdf$/i, ''));
        for (const targetNorm of targetNorms) {
            if (targetNorm && (entryNorm.includes(targetNorm) || targetNorm.includes(entryNorm))) {
                try {
                    const file = await handle.getFile();
                    if (file && file.size > 0) return file;
                } catch (e) {}
            }
        }
    }
    
    return null;
}

// Helper to get PDF File/Blob either from linked local directory, IndexedDB, or Google Drive Cloud API
async function getPDFBlob(fileId, rawFileName, isInteractive = false, itemId = null, itemName = null, onProgress = null) {
    if (typeof onProgress === 'function') onProgress(10, 'جاري البحث عن الملف وتجهيزه...', 'فحص المصادر');
    
    // 1. Priority: Linked Local Directory
    if (!indexLinkedDirectoryHandle) {
        indexLinkedDirectoryHandle = await getStoredDirectoryHandle();
    }
    
    if (indexLinkedDirectoryHandle) {
        try {
            const opts = { mode: 'read' };
            let perm = 'denied';
            
            if (typeof indexLinkedDirectoryHandle.queryPermission === 'function') {
                try {
                    perm = await indexLinkedDirectoryHandle.queryPermission(opts);
                } catch (e) {
                    perm = 'prompt';
                }
            } else {
                perm = 'granted';
            }
            
            if (perm !== 'granted' && isInteractive) {
                if (typeof indexLinkedDirectoryHandle.requestPermission === 'function') {
                    try {
                        perm = await indexLinkedDirectoryHandle.requestPermission(opts);
                    } catch (permErr) {
                        console.warn('requestPermission failed:', permErr);
                    }
                }
            }
            
            if (perm === 'granted') {
                if (typeof onProgress === 'function') onProgress(35, 'جاري قراءة الملف من المجلد المحلي...', 'مجلد محلي');
                const foundFile = await findFileInDirectoryHandle(indexLinkedDirectoryHandle, fileId, rawFileName, itemId, itemName);
                if (foundFile) {
                    if (typeof onProgress === 'function') onProgress(90, 'تم استخراج الملف بنجاح...', 'مجلد محلي');
                    return foundFile;
                }
            }
        } catch (dirErr) {
            console.warn('Error reading from linked directory:', dirErr);
        }
    }
    
    // 2. Priority: IndexedDB files store
    if (typeof onProgress === 'function') onProgress(45, 'فحص ذاكرة المتصفح (IndexedDB)...', 'IndexedDB');
    const idsToSearchDB = [fileId, itemId].filter(Boolean);
    for (const searchId of idsToSearchDB) {
        try {
            const fileData = await getFile(searchId);
            if (fileData && fileData.data) {
                if (typeof onProgress === 'function') onProgress(90, 'تم استخراج الملف بنجاح...', 'IndexedDB');
                return new Blob([fileData.data], { type: 'application/pdf' });
            }
        } catch (dbErr) {
            console.warn('IndexedDB file fetch notice:', dbErr);
        }
    }
    
    // 3. Priority: Google Drive Cloud Sync API
    const cloudUrl = getCloudApiUrl();
    if (cloudUrl) {
        try {
            if (typeof onProgress === 'function') onProgress(50, 'الاتصال بسحابة Google Drive...', 'Google Drive');
            const queryParams = new URLSearchParams({
                action: 'getFile',
                format: 'base64',
                fileId: fileId || '',
                fileName: rawFileName || '',
                itemId: itemId || '',
                itemName: itemName || ''
            });
            const fetchUrl = cloudUrl + (cloudUrl.includes('?') ? '&' : '?') + queryParams.toString();
            const resp = await fetch(fetchUrl);
            if (resp.ok) {
                if (typeof onProgress === 'function') onProgress(75, 'جاري استلام وفك تشفير الملف السحابي...', 'Google Drive');
                const jsonRes = await resp.json();
                if (jsonRes && jsonRes.status === 'ok') {
                    if (jsonRes.base64) {
                        const byteChars = atob(jsonRes.base64);
                        const byteNums = new Array(byteChars.length);
                        for (let i = 0; i < byteChars.length; i++) {
                            byteNums[i] = byteChars.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNums);
                        const cloudBlob = new Blob([byteArray], { type: 'application/pdf' });
                        
                        // Auto-cache in IndexedDB for instant offline access
                        try {
                            const targetKey = fileId || itemId;
                            if (targetKey && db) {
                                const trans = db.transaction(FILES_STORE, 'readwrite');
                                trans.objectStore(FILES_STORE).put({
                                    id: targetKey,
                                    name: rawFileName || itemName || 'document.pdf',
                                    type: 'application/pdf',
                                    data: byteArray.buffer
                                });
                            }
                        } catch (cacheErr) {}
                        
                        if (typeof onProgress === 'function') onProgress(95, 'تم استلام الملف بنجاح...', 'Google Drive');
                        return cloudBlob;
                    } else if (jsonRes.downloadUrl) {
                        if (typeof onProgress === 'function') onProgress(95, 'تم استلام الرابط السحابي المباشر...', 'Google Drive');
                        return {
                            isCloudUrl: true,
                            url: jsonRes.downloadUrl,
                            fileName: jsonRes.fileName || rawFileName || itemName || 'document.pdf',
                            previewUrl: jsonRes.previewUrl,
                            size: jsonRes.size
                        };
                    }
                }
            }
        } catch (cloudFetchErr) {
            console.warn('Cloud PDF fetch notice:', cloudFetchErr);
        }
    }
    
    return null;
}

// Render PDF preview from local directory or IndexedDB with automatic thumbnail caching
async function renderPdfPreviewFromDB(item, containerId) {
    if (!item) return;
    if (item.thumbnail) return; // Already rendered as <img>!
    
    const fileId = item.fileId;
    const fileName = item.fileName;
    if (!fileId && !fileName && !item.id) return;
    
    try {
        const blob = await getPDFBlob(fileId, fileName, false, item.id, item.name);
        if (!blob) return;
        
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        
        const url = URL.createObjectURL(blob);
        
        pdfjsLib.getDocument(url).promise.then(function(pdf) {
            return pdf.getPage(1);
        }).then(function(page) {
            const viewport = page.getViewport({ scale: 1.0 });
            const containerWidth = container.clientWidth || 160;
            const containerHeight = container.clientHeight || 160;
            
            const scale = Math.min(
                containerWidth / viewport.width,
                containerHeight / viewport.height
            ) * 0.95;
            
            const scaledViewport = page.getViewport({ scale: scale > 0 ? scale : 0.4 });
            
            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;
            
            const renderContext = {
                canvasContext: canvas.getContext('2d'),
                viewport: scaledViewport
            };
            
            return page.render(renderContext).promise;
        }).then(() => {
            container.innerHTML = '';
            container.appendChild(canvas);
            
            // Auto-cache thumbnail in IndexedDB if not present!
            try {
                const thumbData = canvas.toDataURL('image/jpeg', 0.85);
                item.thumbnail = thumbData;
                const storeName = item.type === 'material' ? MATERIALS_STORE : BOOKS_STORE;
                updateItem(storeName, item);
            } catch (err) {
                // Non-critical cache error
            }
        }).catch(function(error) {
            console.warn('PDF Preview render error for', fileId || fileName, error);
        }).finally(() => {
            URL.revokeObjectURL(url);
        });
    } catch (error) {
        console.error('Error rendering PDF preview:', error);
    }
}

// Recursively find data.json or data.xml in directory handle or any subdirectories
async function findDataFileInDirectoryHandle(dirHandle, maxDepth = 4, currentDepth = 0) {
    if (!dirHandle || currentDepth > maxDepth) return null;
    
    // 1. Direct check in current folder for data.json
    try {
        const jsonHandle = await dirHandle.getFileHandle('data.json');
        const file = await jsonHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        if (data && (Array.isArray(data.materials) || Array.isArray(data.books))) {
            return { type: 'json', data: data, handle: jsonHandle, dirHandle: dirHandle };
        }
    } catch (e) {}
    
    // 2. Direct check in current folder for data.xml
    try {
        const xmlHandle = await dirHandle.getFileHandle('data.xml');
        const file = await xmlHandle.getFile();
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        return { type: 'xml', xmlDoc: xmlDoc, handle: xmlHandle, dirHandle: dirHandle };
    } catch (e) {}
    
    // 3. Scan subdirectories
    try {
        if (typeof dirHandle.values === 'function' || typeof dirHandle.entries === 'function') {
            const iterator = dirHandle.values ? dirHandle.values() : dirHandle.entries();
            for await (const entry of iterator) {
                const handle = Array.isArray(entry) ? entry[1] : entry;
                if (handle && handle.kind === 'directory') {
                    const subRes = await findDataFileInDirectoryHandle(handle, maxDepth, currentDepth + 1);
                    if (subRes) return subRes;
                }
            }
        }
    } catch (err) {
        console.warn('Subdir scan warning:', err);
    }
    
    return null;
}

// Link local data directory from Home Page
async function linkLocalDataDirectory() {
    try {
        if (window.showDirectoryPicker) {
            const dirHandle = await window.showDirectoryPicker({
                id: 'educational-materials',
                mode: 'read'
            });
            
            const foundData = await findDataFileInDirectoryHandle(dirHandle);
            let jsonData = null;
            let xmlDoc = null;
            
            if (foundData) {
                if (foundData.type === 'json') jsonData = foundData.data;
                if (foundData.type === 'xml') xmlDoc = foundData.xmlDoc;
            } else {
                // Auto-discover PDF files if no data.json or data.xml exists!
                const pdfHandles = await collectAllPdfsFromDirectory(dirHandle);
                if (pdfHandles.length > 0) {
                    jsonData = {
                        materials: pdfHandles.map(h => {
                            const name = h.name.replace(/\.pdf$/i, '');
                            const cleanName = name.replace(/^\d+[\s_\-]+/, '');
                            const idMatch = h.name.match(/^\d+/);
                            const id = idMatch ? idMatch[0] : Date.now().toString() + Math.floor(Math.random() * 1000);
                            return {
                                id: id,
                                name: cleanName || name,
                                school: '',
                                teacher: '',
                                grade: 'أخرى',
                                sides: 'وجه واحد',
                                price: '25',
                                fileName: h.name,
                                fileId: id,
                                thumbnail: null,
                                dateAdded: new Date().toISOString()
                            };
                        }),
                        books: []
                    };
                } else {
                    alert('لم يتم العثور على ملفات PDF أو ملف data.json داخل المجلد المختار.\nيرجى التأكد من اختيار مجلد المواد والكتب الصحيح.');
                    return;
                }
            }
            
            // Clear metadata stores (keep files store clean to save memory!)
            const transMat = db.transaction(MATERIALS_STORE, 'readwrite');
            transMat.objectStore(MATERIALS_STORE).clear();
            const transBook = db.transaction(BOOKS_STORE, 'readwrite');
            transBook.objectStore(BOOKS_STORE).clear();
            const transFile = db.transaction(FILES_STORE, 'readwrite');
            transFile.objectStore(FILES_STORE).clear();
            
            // Save directory handle
            indexLinkedDirectoryHandle = dirHandle;
            const transSave = db.transaction(FILES_STORE, 'readwrite');
            transSave.objectStore(FILES_STORE).put({ id: '__linked_dir_handle__', handle: dirHandle, name: dirHandle.name });
            
            // Import Metadata using updateItem (safe from ConstraintErrors)
            let importedCount = 0;
            if (jsonData) {
                if (Array.isArray(jsonData.materials)) {
                    for (const m of jsonData.materials) {
                        await updateItem(MATERIALS_STORE, m);
                        importedCount++;
                    }
                }
                if (Array.isArray(jsonData.books)) {
                    for (const b of jsonData.books) {
                        await updateItem(BOOKS_STORE, b);
                        importedCount++;
                    }
                }
            } else if (xmlDoc) {
                const materialNodes = xmlDoc.querySelectorAll('materials > material');
                for (const node of materialNodes) {
                    const id = node.getAttribute('id') || Date.now().toString();
                    const getField = (f) => node.querySelector(f) ? node.querySelector(f).textContent : '';
                    const fileName = getField('file');
                    const rawName = fileName ? fileName.replace(/^\d+[\s_\-]+/, '') : '';
                    
                    const material = {
                        id: id,
                        name: getField('name'),
                        school: getField('school'),
                        teacher: getField('teacher'),
                        grade: getField('grade'),
                        sides: getField('sides'),
                        price: getField('price'),
                        fileName: rawName || fileName,
                        fileId: id,
                        thumbnail: getField('thumbnail') || null,
                        dateAdded: new Date().toISOString()
                    };
                    await updateItem(MATERIALS_STORE, material);
                    importedCount++;
                }
                
                const bookNodes = xmlDoc.querySelectorAll('books > book');
                for (const node of bookNodes) {
                    const id = node.getAttribute('id') || Date.now().toString();
                    const getField = (f) => node.querySelector(f) ? node.querySelector(f).textContent : '';
                    const fileName = getField('file');
                    const rawName = fileName ? fileName.replace(/^\d+[\s_\-]+/, '') : '';
                    
                    const book = {
                        id: id,
                        name: getField('name'),
                        grade: getField('grade'),
                        price: getField('price'),
                        fileName: rawName || fileName,
                        fileId: id,
                        thumbnail: getField('thumbnail') || null,
                        dateAdded: new Date().toISOString()
                    };
                    await updateItem(BOOKS_STORE, book);
                    importedCount++;
                }
            }
            
            await loadEducationalData();
            await updateHomeStorageButton();
            alert(`✅ تم ربط المجلد بنجاح واستيراد ${importedCount} مادة وكتاب!`);
        } else {
            // Fallback for non-Chromium browsers (Firefox / Safari / HTTP)
            const input = document.createElement('input');
            input.type = 'file';
            input.webkitdirectory = true;
            input.directory = true;
            input.multiple = true;
            input.style.display = 'none';
            document.body.appendChild(input);
            
            input.onchange = async () => {
                try {
                    const files = Array.from(input.files);
                    if (files.length === 0) return;
                    
                    let jsonFile = files.find(f => f.name.toLowerCase() === 'data.json');
                    let xmlFile = files.find(f => f.name.toLowerCase() === 'data.xml');
                    
                    if (!jsonFile && !xmlFile) {
                        alert('لم يتم العثور على data.json أو data.xml داخل المجلد المحدد');
                        return;
                    }
                    
                    // Clear stores
                    const transMat = db.transaction(MATERIALS_STORE, 'readwrite');
                    transMat.objectStore(MATERIALS_STORE).clear();
                    const transBook = db.transaction(BOOKS_STORE, 'readwrite');
                    transBook.objectStore(BOOKS_STORE).clear();
                    const transFile = db.transaction(FILES_STORE, 'readwrite');
                    transFile.objectStore(FILES_STORE).clear();
                    
                    // Store files in IndexedDB for offline access
                    for (const f of files) {
                        if (f.name.toLowerCase().endsWith('.pdf')) {
                            const buf = await f.arrayBuffer();
                            const cleanId = f.name.split('_')[0];
                            const fileData = {
                                id: cleanId,
                                name: f.name,
                                type: 'application/pdf',
                                data: buf
                            };
                            const trans = db.transaction(FILES_STORE, 'readwrite');
                            trans.objectStore(FILES_STORE).put(fileData);
                        }
                    }
                    
                    if (jsonFile) {
                        const text = await jsonFile.text();
                        const data = JSON.parse(text);
                        if (Array.isArray(data.materials)) {
                            for (const m of data.materials) await updateItem(MATERIALS_STORE, m);
                        }
                        if (Array.isArray(data.books)) {
                            for (const b of data.books) await updateItem(BOOKS_STORE, b);
                        }
                    } else if (xmlFile) {
                        const text = await xmlFile.text();
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(text, 'text/xml');
                        
                        const materialNodes = xmlDoc.querySelectorAll('materials > material');
                        for (const node of materialNodes) {
                            const id = node.getAttribute('id') || Date.now().toString();
                            const getField = (f) => node.querySelector(f) ? node.querySelector(f).textContent : '';
                            const fileName = getField('file');
                            const rawName = fileName ? fileName.replace(/^\d+[\s_\-]+/, '') : '';
                            const material = {
                                id: id,
                                name: getField('name'),
                                school: getField('school'),
                                teacher: getField('teacher'),
                                grade: getField('grade'),
                                sides: getField('sides'),
                                price: getField('price'),
                                fileName: rawName || fileName,
                                fileId: id,
                                thumbnail: getField('thumbnail') || null,
                                dateAdded: new Date().toISOString()
                            };
                            await updateItem(MATERIALS_STORE, material);
                        }
                        
                        const bookNodes = xmlDoc.querySelectorAll('books > book');
                        for (const node of bookNodes) {
                            const id = node.getAttribute('id') || Date.now().toString();
                            const getField = (f) => node.querySelector(f) ? node.querySelector(f).textContent : '';
                            const fileName = getField('file');
                            const rawName = fileName ? fileName.replace(/^\d+[\s_\-]+/, '') : '';
                            const book = {
                                id: id,
                                name: getField('name'),
                                grade: getField('grade'),
                                price: getField('price'),
                                fileName: rawName || fileName,
                                fileId: id,
                                thumbnail: getField('thumbnail') || null,
                                dateAdded: new Date().toISOString()
                            };
                            await updateItem(BOOKS_STORE, book);
                        }
                    }
                    
                    await loadEducationalData();
                    alert('تم استيراد المجلد والبيانات بنجاح!');
                } catch (err) {
                    console.error('Fallback folder import error:', err);
                    alert('حدث خطأ أثناء قراءة المجلد: ' + err.message);
                } finally {
                    document.body.removeChild(input);
                }
            };
            input.click();
        }
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Error linking local directory on home:', error);
        alert('حدث خطأ أثناء ربط المجلد: ' + error.message);
    }
}

// Quick Preview Modal
async function openPreviewModal(fileId, title, badgeText, fileName) {
    const modal = document.getElementById('previewModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBadge = document.getElementById('modalBadge');
    const modalCanvasContainer = document.getElementById('modalCanvasContainer');
    const modalDownloadBtn = document.getElementById('modalDownloadBtn');
    
    if (!modal) return;
    
    modalTitle.textContent = title;
    modalBadge.textContent = badgeText;
    modalBadge.style.background = badgeText === 'كتاب' ? '#7209b7' : '#4361ee';
    modalCanvasContainer.innerHTML = '<div class="spinner"></div>';
    modal.classList.add('active');
    
    modalDownloadBtn.onclick = () => {
        downloadFile(fileId, fileName || (title + '.pdf'), title);
    };
    
    if (fileId || fileName) {
        try {
            const blob = await getPDFBlob(fileId, fileName, true, null, title);
            if (blob) {
                if (blob.isCloudUrl) {
                    let directDownloadUrl = blob.url;
                    if (directDownloadUrl && (directDownloadUrl.includes('drive.google.com') || directDownloadUrl.includes('drive.usercontent.google.com'))) {
                        const idMatch = directDownloadUrl.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
                        if (idMatch) {
                            directDownloadUrl = `https://drive.usercontent.google.com/download?id=${idMatch[1]}&export=download&authuser=0&confirm=t`;
                        }
                    }
                    modalCanvasContainer.innerHTML = `
                        <div style="text-align:center; padding: 2rem 1rem;">
                            <div style="font-size:3rem; margin-bottom:1rem;">☁️</div>
                            <h4 style="color:var(--text-primary); margin-bottom:0.5rem;">الملف متوفر على Google Drive</h4>
                            <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:1.5rem;">يمكنك تحميل الملف فوراً أو معاينته مباشرة عبر درايف</p>
                            <div style="display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap;">
                                ${blob.previewUrl ? `<a href="${blob.previewUrl}" target="_blank" class="nav-btn nav-btn-outline" style="text-decoration:none;">👁️ معاينة في Google Drive</a>` : ''}
                                <a href="${directDownloadUrl}" target="_blank" class="nav-btn nav-btn-primary" style="text-decoration:none;">📥 تحميل الملف فوراً</a>
                            </div>
                        </div>
                    `;
                    return;
                }
                
                const url = URL.createObjectURL(blob);
                
                pdfjsLib.getDocument(url).promise.then(pdf => pdf.getPage(1)).then(page => {
                    const viewport = page.getViewport({ scale: 1.3 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    
                    const renderContext = {
                        canvasContext: canvas.getContext('2d'),
                        viewport: viewport
                    };
                    
                    return page.render(renderContext).promise.then(() => {
                        modalCanvasContainer.innerHTML = '';
                        modalCanvasContainer.appendChild(canvas);
                    });
                }).catch(err => {
                    modalCanvasContainer.innerHTML = '<p style="color:var(--text-muted)">تعذر عرض معاينة كاملة للملف</p>';
                }).finally(() => {
                    URL.revokeObjectURL(url);
                });
            } else {
                modalCanvasContainer.innerHTML = '<p style="color:var(--text-muted)">الملف غير متوفر حالياً. يرجى التأكد من ربط مجلد البيانات المحلي أو سحابة Google Drive.</p>';
            }
        } catch (e) {
            modalCanvasContainer.innerHTML = '<p style="color:var(--text-muted)">حدث خطأ أثناء تحميل المعاينة</p>';
        }
    } else {
        modalCanvasContainer.innerHTML = '<p style="color:var(--text-muted)">لا يوجد ملف PDF مرتبط</p>';
    }
}

function closePreviewModal(e) {
    if (e && e.target && e.target.classList.contains('modal-dialog')) return;
    const modal = document.getElementById('previewModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Download a file
async function downloadFile(fileId, fileName, itemName = null, itemId = null) {
    const displayName = itemName || fileName || 'الملف التعليمي';
    showDownloadProgress(displayName, 15, 'جاري البحث وتجهيز الملف...', 'بدء التحميل');
    
    try {
        let blob = await getPDFBlob(fileId, fileName, true, itemId, itemName, (pct, sub, source) => {
            updateDownloadProgress(pct, sub, source);
        });
        
        // If not found and showDirectoryPicker is supported, prompt to re-link folder
        if (!blob && window.showDirectoryPicker) {
            hideDownloadProgress();
            const shouldReselect = confirm(
                'ملف الـ PDF غير متوفر في المسار الحالي (' + displayName + ').\n\n' +
                'هل ترغب في تحديد / إعادة اختيار مجلد المواد والكتب على جهازك للوصول إلى الملفات فوراً؟'
            );
            if (shouldReselect) {
                await linkLocalDataDirectory();
                showDownloadProgress(displayName, 30, 'إعادة البحث في المجلد الجديد...', 'مجلد محلي');
                blob = await getPDFBlob(fileId, fileName, true, itemId, itemName, (pct, sub, source) => {
                    updateDownloadProgress(pct, sub, source);
                });
            }
        }
        
        if (!blob) {
            hideDownloadProgress();
            alert('عذراً، ملف الـ PDF غير متوفر (' + (fileName || itemName || 'الملف') + ').\nيرجى النقر على زر "مجلد محلي" في الأعلى والتأكد من اختيار المجلد الذي يحتوي على الملفات، أو التحقق من المزامنة السحابية.');
            return;
        }
        
        // Handle Google Drive direct cloud URL (large files / high-speed download)
        if (blob && blob.isCloudUrl) {
            finishDownloadProgress('✅ تم تجهيز الرابط السحابي، يبدأ التنزيل المباشر الآن...');
            let targetUrl = blob.url;
            if (targetUrl && (targetUrl.includes('drive.google.com') || targetUrl.includes('drive.usercontent.google.com'))) {
                const idMatch = targetUrl.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
                if (idMatch) {
                    targetUrl = `https://drive.usercontent.google.com/download?id=${idMatch[1]}&export=download&authuser=0&confirm=t`;
                }
            }
            const a = document.createElement('a');
            a.href = targetUrl;
            a.target = '_blank';
            a.download = fileName || (displayName + '.pdf');
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
            }, 500);
            return;
        }
        
        finishDownloadProgress('✅ تم تجهيز الملف، يبدأ التنزيل الآن...');
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || (displayName + '.pdf');
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 300);
    } catch (error) {
        hideDownloadProgress();
        console.error('Error downloading file:', error);
        alert('حدث خطأ أثناء تحميل الملف: ' + error.message);
    }
}

// Search and Filter Handlers
function handleSearch(query) {
    currentSearchQuery = (query || '').trim().toLowerCase();
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
        clearBtn.style.display = currentSearchQuery ? 'flex' : 'none';
    }
    applyFilterAndRender();
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    handleSearch('');
}

function filterCategory(category, buttonElement) {
    currentCategory = category;
    
    // Update active button state
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    if (buttonElement) {
        buttonElement.classList.add('active');
    }
    
    applyFilterAndRender();
}

let currentSelectedGrade = 'all';

// Educational Stages and Grades Configuration
const EDUCATIONAL_STRUCTURE = [
    {
        key: 'primary',
        name: 'المرحلة الابتدائية',
        icon: '🎒',
        desc: 'الصفوف من الأول إلى السادس الابتدائي',
        grades: [
            'الأول الابتدائي',
            'الثاني الابتدائي',
            'الثالث الابتدائي',
            'الرابع الابتدائي',
            'الخامس الابتدائي',
            'السادس الابتدائي'
        ]
    },
    {
        key: 'middle',
        name: 'المرحلة المتوسطة',
        icon: '🏫',
        desc: 'الصفوف من الأول إلى الثالث المتوسط',
        grades: [
            'الأول المتوسط',
            'الثاني المتوسط',
            'الثالث المتوسط'
        ]
    },
    {
        key: 'high',
        name: 'المرحلة الثانوية',
        icon: '🎓',
        desc: 'الصفوف من الأول إلى الثالث الثانوي',
        grades: [
            'الأول الثانوي',
            'الثاني الثانوي',
            'الثالث الثانوي'
        ]
    },
    {
        key: 'other',
        name: 'مواد ومراجع عامة',
        icon: '📚',
        desc: 'مذكرات ومراجع تعليمية متنوعة',
        grades: [
            'أخرى'
        ]
    }
];

// Helper: Normalize Grade String
function normalizeGrade(grade) {
    if (!grade) return 'أخرى';
    const g = grade.trim();
    for (const stage of EDUCATIONAL_STRUCTURE) {
        for (const validGrade of stage.grades) {
            if (g === validGrade || g.includes(validGrade)) {
                return validGrade;
            }
        }
    }
    return g;
}

// Update the Quick Grade Navigation Bar
function updateGradeNavigation() {
    const navWrapper = document.getElementById('gradesNavWrapper');
    const navPills = document.getElementById('gradesNavPills');
    if (!navWrapper || !navPills) return;
    
    // Count items per grade
    const gradeCounts = {};
    allItems.forEach(item => {
        const grade = normalizeGrade(item.grade);
        gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    });
    
    const availableGrades = Object.keys(gradeCounts).filter(g => gradeCounts[g] > 0);
    
    if (availableGrades.length <= 1) {
        navWrapper.style.display = 'none';
        return;
    }
    
    navWrapper.style.display = 'flex';
    navPills.innerHTML = '';
    
    // "جميع الصفوف" button
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `grade-nav-btn ${currentSelectedGrade === 'all' ? 'active' : ''}`;
    allBtn.innerHTML = `<span>جميع الصفوف</span> <span class="grade-nav-count">${allItems.length}</span>`;
    allBtn.onclick = () => selectGrade('all');
    navPills.appendChild(allBtn);
    
    // Order available grades according to EDUCATIONAL_STRUCTURE
    EDUCATIONAL_STRUCTURE.forEach(stage => {
        stage.grades.forEach(gradeName => {
            if (gradeCounts[gradeName]) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `grade-nav-btn ${currentSelectedGrade === gradeName ? 'active' : ''}`;
                btn.innerHTML = `<span>${gradeName}</span> <span class="grade-nav-count">${gradeCounts[gradeName]}</span>`;
                btn.onclick = () => selectGrade(gradeName);
                navPills.appendChild(btn);
            }
        });
    });
}

function selectGrade(grade) {
    currentSelectedGrade = grade;
    applyFilterAndRender();
}

// Apply Filter & Search and Render Cards Grouped into Distinct Grade & Stage Containers
function applyFilterAndRender() {
    const container = document.getElementById('stagesContainer');
    if (!container) return;
    
    updateGradeNavigation();
    
    let filtered = allItems;
    
    // 1. Search Query Filter
    if (currentSearchQuery) {
        filtered = filtered.filter(item => {
            const nameMatch = (item.name || '').toLowerCase().includes(currentSearchQuery);
            const schoolMatch = (item.school || '').toLowerCase().includes(currentSearchQuery);
            const teacherMatch = (item.teacher || '').toLowerCase().includes(currentSearchQuery);
            const gradeMatch = (item.grade || '').toLowerCase().includes(currentSearchQuery);
            return nameMatch || schoolMatch || teacherMatch || gradeMatch;
        });
    }
    
    // 2. Active Category Filter
    if (currentCategory === 'materials') {
        filtered = filtered.filter(item => item.type === 'material');
    } else if (currentCategory === 'books') {
        filtered = filtered.filter(item => item.type === 'book');
    }
    
    // 3. Selected Grade Filter
    if (currentSelectedGrade !== 'all') {
        filtered = filtered.filter(item => normalizeGrade(item.grade) === currentSelectedGrade);
    }
    
    container.innerHTML = '';
    
    if (filtered.length === 0) {
        if (!currentSearchQuery && currentCategory === 'all' && currentSelectedGrade === 'all') {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" width="54" height="54" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <div class="empty-title">لا توجد مواد مضافة حالياً</div>
                    <div class="empty-subtitle">إذا قمت بفك ضغط ملف النسخة الاحتياطية على جهازك، يمكنك ربط المجلد مباشرة لتصفح جميع الكتب والمذكرات فوراً وبدون استهلاك ذاكرة المتصفح</div>
                    <button type="button" class="nav-btn nav-btn-primary" style="margin-top:1.25rem; display:inline-flex; align-items:center; gap:0.5rem; padding:0.65rem 1.4rem; cursor:pointer; font-size:0.95rem;" onclick="linkLocalDataDirectory()">
                        <span>📂 تحديد وربط مجلد المواد من الكمبيوتر</span>
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" width="54" height="54" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    <div class="empty-title">لا توجد مواد دراسية مطابقة</div>
                    <div class="empty-subtitle">${currentSearchQuery ? 'جرب البحث بكلمات أخرى أو تحقق من الحروف' : 'لم تتم إضافة أي مذكرات أو كتب دراسية بعد لهذا الاختيار'}</div>
                </div>
            `;
        }
        return;
    }
    
    // Group by Stage -> then by Grade
    EDUCATIONAL_STRUCTURE.forEach(stageCfg => {
        const gradeBlocksToRender = [];
        let stageTotalItems = 0;
        
        stageCfg.grades.forEach(gradeName => {
            const gradeItems = filtered.filter(item => normalizeGrade(item.grade) === gradeName);
            if (gradeItems.length === 0) return;
            
            stageTotalItems += gradeItems.length;
            
            const materialsInGrade = gradeItems.filter(item => item.type === 'material');
            const booksInGrade = gradeItems.filter(item => item.type === 'book');
            
            const gradeBlock = document.createElement('div');
            gradeBlock.className = 'grade-block';
            gradeBlock.id = `grade-${encodeURIComponent(gradeName)}`;
            
            const countText = gradeItems.length === 1 ? 'مادة واحدة' : `${gradeItems.length} مواد`;
            
            gradeBlock.innerHTML = `
                <div class="grade-header">
                    <div class="grade-title-wrap">
                        <span class="grade-tag-icon">🏷️</span>
                        <h3 class="grade-name">${gradeName}</h3>
                    </div>
                    <span class="grade-count-badge">${countText}</span>
                </div>
                <div class="grade-content"></div>
            `;
            
            const gradeContent = gradeBlock.querySelector('.grade-content');
            
            // Materials inside Grade
            if (materialsInGrade.length > 0) {
                const matSection = document.createElement('div');
                matSection.className = 'stage-sub-section';
                const matCount = materialsInGrade.length === 1 ? 'مذكرة واحدة' : `${materialsInGrade.length} مذكرات`;
                
                matSection.innerHTML = `
                    <div class="stage-sub-header materials-header">
                        <div class="stage-sub-title">
                            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                            <span>مذكرات ${gradeName}</span>
                        </div>
                        <span class="stage-sub-badge">${matCount}</span>
                    </div>
                    <div class="stage-cards-grid"></div>
                `;
                
                const grid = matSection.querySelector('.stage-cards-grid');
                materialsInGrade.forEach(item => {
                    grid.appendChild(createMaterialCard(item));
                    if (item.fileId && !item.thumbnail) renderPdfPreviewFromDB(item, `preview-${item.id}`);
                });
                gradeContent.appendChild(matSection);
            }
            
            // Books inside Grade
            if (booksInGrade.length > 0) {
                const bookSection = document.createElement('div');
                bookSection.className = 'stage-sub-section';
                const bookCount = booksInGrade.length === 1 ? 'كتاب واحد' : `${booksInGrade.length} كتب`;
                
                bookSection.innerHTML = `
                    <div class="stage-sub-header books-header">
                        <div class="stage-sub-title">
                            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                            <span>كتب ${gradeName}</span>
                        </div>
                        <span class="stage-sub-badge">${bookCount}</span>
                    </div>
                    <div class="stage-cards-grid"></div>
                `;
                
                const grid = bookSection.querySelector('.stage-cards-grid');
                booksInGrade.forEach(item => {
                    grid.appendChild(createBookCard(item));
                    if (item.fileId && !item.thumbnail) renderPdfPreviewFromDB(item, `preview-${item.id}`);
                });
                gradeContent.appendChild(bookSection);
            }
            
            gradeBlocksToRender.push(gradeBlock);
        });
        
        // Non-standard grades in 'other'
        if (stageCfg.key === 'other') {
            const allStandardGrades = [];
            EDUCATIONAL_STRUCTURE.slice(0, 3).forEach(s => allStandardGrades.push(...s.grades));
            const otherItems = filtered.filter(item => !allStandardGrades.includes(normalizeGrade(item.grade)));
            
            if (otherItems.length > 0) {
                const customGrades = [...new Set(otherItems.map(i => normalizeGrade(i.grade)))];
                customGrades.forEach(customGradeName => {
                    const customGradeItems = otherItems.filter(i => normalizeGrade(i.grade) === customGradeName);
                    if (customGradeItems.length === 0) return;
                    stageTotalItems += customGradeItems.length;
                    
                    const gradeBlock = document.createElement('div');
                    gradeBlock.className = 'grade-block';
                    gradeBlock.innerHTML = `
                        <div class="grade-header">
                            <div class="grade-title-wrap">
                                <span class="grade-tag-icon">📚</span>
                                <h3 class="grade-name">${customGradeName}</h3>
                            </div>
                            <span class="grade-count-badge">${customGradeItems.length} مواد</span>
                        </div>
                        <div class="grade-content">
                            <div class="stage-cards-grid"></div>
                        </div>
                    `;
                    const grid = gradeBlock.querySelector('.stage-cards-grid');
                    customGradeItems.forEach(item => {
                        const card = item.type === 'material' ? createMaterialCard(item) : createBookCard(item);
                        grid.appendChild(card);
                        if (item.fileId && !item.thumbnail) renderPdfPreviewFromDB(item, `preview-${item.id}`);
                    });
                    gradeBlocksToRender.push(gradeBlock);
                });
            }
        }
        
        if (gradeBlocksToRender.length === 0) return;
        
        const stageCard = document.createElement('section');
        stageCard.className = 'stage-main-card';
        stageCard.id = `stage-card-${stageCfg.key}`;
        
        const stageCountText = stageTotalItems === 1 ? 'مادة واحدة' : `${stageTotalItems} مواد متوفرة`;
        
        stageCard.innerHTML = `
            <div class="stage-main-header">
                <div class="stage-main-title-wrap">
                    <span class="stage-main-icon">${stageCfg.icon}</span>
                    <div>
                        <h2 class="stage-main-title">${stageCfg.name}</h2>
                        <p class="stage-main-desc">${stageCfg.desc}</p>
                    </div>
                </div>
                <span class="stage-total-badge">${stageCountText}</span>
            </div>
            <div class="stage-body-content"></div>
        `;
        
        const bodyContent = stageCard.querySelector('.stage-body-content');
        gradeBlocksToRender.forEach(gb => bodyContent.appendChild(gb));
        
        container.appendChild(stageCard);
    });
}


// Update Badge Counters
function updateBadgeCounters() {
    const materialsCount = allItems.filter(i => i.type === 'material').length;
    const booksCount = allItems.filter(i => i.type === 'book').length;
    const totalCount = allItems.length;
    
    const totalBadge = document.getElementById('totalCountBadge');
    const materialsBadge = document.getElementById('materialsCountBadge');
    const booksBadge = document.getElementById('booksCountBadge');
    
    if (totalBadge) totalBadge.textContent = totalCount;
    if (materialsBadge) materialsBadge.textContent = materialsCount;
    if (booksBadge) booksBadge.textContent = booksCount;
}

// Theme Toggle Helper
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Load and display educational items from database
async function loadEducationalData() {
    try {
        await initDB();
        
        let materials = (await getAllItems(MATERIALS_STORE)) || [];
        let books = (await getAllItems(BOOKS_STORE)) || [];
        
        // If DB is completely empty, auto-populate from default dataset
        if (materials.length === 0 && books.length === 0) {
            if (window.DEFAULT_EDUCATIONAL_DATA) {
                const defData = window.DEFAULT_EDUCATIONAL_DATA;
                if (Array.isArray(defData.materials)) {
                    for (const m of defData.materials) await updateItem(MATERIALS_STORE, m);
                }
                if (Array.isArray(defData.books)) {
                    for (const b of defData.books) await updateItem(BOOKS_STORE, b);
                }
                materials = (await getAllItems(MATERIALS_STORE)) || [];
                books = (await getAllItems(BOOKS_STORE)) || [];
            }
        }
        
        allItems = [
            ...materials.map(m => ({ ...m, type: 'material' })),
            ...books.map(b => ({ ...b, type: 'book' }))
        ];
        
        updateBadgeCounters();
        applyFilterAndRender();
        await updateHomeStorageButton();
        
        // Background Cloud Sync Check
        const cloudUrl = getCloudApiUrl();
        if (cloudUrl) {
            fetch(cloudUrl + (cloudUrl.includes('?') ? '&' : '?') + 'action=getData&t=' + Date.now())
                .then(res => res.json())
                .then(async cloudData => {
                    if (cloudData && (Array.isArray(cloudData.materials) || Array.isArray(cloudData.books))) {
                        const newMaterials = cloudData.materials || [];
                        const newBooks = cloudData.books || [];
                        
                        // Check if cloud data is newer or has items
                        if (newMaterials.length > 0 || newBooks.length > 0) {
                            const transMat = db.transaction(MATERIALS_STORE, 'readwrite');
                            transMat.objectStore(MATERIALS_STORE).clear();
                            const transBook = db.transaction(BOOKS_STORE, 'readwrite');
                            transBook.objectStore(BOOKS_STORE).clear();
                            
                            for (const m of newMaterials) await updateItem(MATERIALS_STORE, m);
                            for (const b of newBooks) await updateItem(BOOKS_STORE, b);
                            
                            allItems = [
                                ...newMaterials.map(m => ({ ...m, type: 'material' })),
                                ...newBooks.map(b => ({ ...b, type: 'book' }))
                            ];
                            updateBadgeCounters();
                            applyFilterAndRender();
                        }
                    }
                })
                .catch(cloudErr => console.warn('Background cloud sync notice:', cloudErr));
        }
    } catch (error) {
        console.warn('Data load notice / fallback:', error);
        allItems = [];
        updateBadgeCounters();
        applyFilterAndRender();
        await updateHomeStorageButton();
    }
}

// Load items when page loads
document.addEventListener('DOMContentLoaded', loadEducationalData);

