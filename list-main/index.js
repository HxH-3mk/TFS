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
        <div class="card-preview-area" onclick="openPreviewModal('${material.fileId}', '${escapeHtml(material.name)}', 'مذكرة', '${material.fileName || ''}')">
            <span class="card-badge">مذكرة</span>
            <span class="grade-badge">${escapeHtml(material.grade || 'غير محدد')}</span>
            <div class="preview-container" id="${previewId}">
                ${previewInner}
            </div>
            <button class="preview-overlay-btn" type="button">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
                معاينة سريعة
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
                <button type="button" class="download-link" onclick="downloadFile('${material.fileId}', '${escapeHtml(material.fileName || material.name + '.pdf')}')">
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
        <div class="card-preview-area" onclick="openPreviewModal('${book.fileId}', '${escapeHtml(book.name)}', 'كتاب', '${book.fileName || ''}')">
            <span class="card-badge" style="background: rgba(114, 9, 183, 0.85)">كتاب</span>
            <span class="grade-badge">${escapeHtml(book.grade || 'غير محدد')}</span>
            <div class="preview-container" id="${previewId}">
                ${previewInner}
            </div>
            <button class="preview-overlay-btn" type="button">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
                معاينة سريعة
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
                <button type="button" class="download-link" onclick="downloadFile('${book.fileId}', '${escapeHtml(book.fileName || book.name + '.pdf')}')">
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

// Render PDF preview from IndexedDB with automatic thumbnail caching
async function renderPdfPreviewFromDB(item, containerId) {
    if (!item) return;
    if (item.thumbnail) return; // Already rendered as <img>!
    
    const fileId = item.fileId;
    if (!fileId) return;
    
    try {
        const fileData = await getFile(fileId);
        if (!fileData) return;
        
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        
        const blob = new Blob([fileData.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        pdfjsLib.getDocument(url).promise.then(function(pdf) {
            return pdf.getPage(1);
        }).then(function(page) {
            const viewport = page.getViewport({ scale: 1.0 });
            const containerWidth = container.clientWidth || 240;
            const containerHeight = container.clientHeight || 180;
            
            const scale = Math.min(
                containerWidth / viewport.width,
                containerHeight / viewport.height
            ) * 0.95;
            
            const scaledViewport = page.getViewport({ scale: scale > 0 ? scale : 0.5 });
            
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
            
            // Cache thumbnail into item for instant loading on next visits!
            try {
                const thumbData = canvas.toDataURL('image/jpeg', 0.85);
                item.thumbnail = thumbData;
                const storeName = item.type === 'material' ? MATERIALS_STORE : BOOKS_STORE;
                updateItem(storeName, item);
            } catch (err) {
                // Non-critical cache error
            }
        }).catch(function(error) {
            console.warn('PDF Preview render error for', fileId, error);
        }).finally(() => {
            URL.revokeObjectURL(url);
        });
    } catch (error) {
        console.error('Error rendering PDF preview:', error);
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
        downloadFile(fileId, fileName || (title + '.pdf'));
    };
    
    if (fileId) {
        try {
            const fileData = await getFile(fileId);
            if (fileData) {
                const blob = new Blob([fileData.data], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                
                pdfjsLib.getDocument(url).promise.then(pdf => pdf.getPage(1)).then(page => {
                    const viewport = page.getViewport({ scale: 1.2 });
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
                modalCanvasContainer.innerHTML = '<p style="color:var(--text-muted)">الملف غير متوفر في الذاكرة</p>';
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
async function downloadFile(fileId, fileName) {
    try {
        const fileData = await getFile(fileId);
        if (!fileData) {
            alert('عذراً، الملف غير موجود في قاعدة البيانات.');
            return;
        }
        
        const blob = new Blob([fileData.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'download.pdf';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 150);
    } catch (error) {
        console.error('Error downloading file:', error);
        alert('حدث خطأ أثناء تحميل الملف');
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

// Load and display items when page loads
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await initDB();
        
        const materials = (await getAllItems(MATERIALS_STORE)) || [];
        const books = (await getAllItems(BOOKS_STORE)) || [];
        
        allItems = [
            ...materials.map(m => ({ ...m, type: 'material' })),
            ...books.map(b => ({ ...b, type: 'book' }))
        ];
        
        updateBadgeCounters();
        applyFilterAndRender();
    } catch (error) {
        console.warn('Data load notice / fallback:', error);
        allItems = [];
        updateBadgeCounters();
        applyFilterAndRender();
    }
});

