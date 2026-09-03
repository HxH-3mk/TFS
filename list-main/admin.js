// IndexedDB Setup
let db;
const DB_NAME = 'educationalMaterialsDB';
const DB_VERSION = 1;
const MATERIALS_STORE = 'materials';
const BOOKS_STORE = 'books';
const FILES_STORE = 'files';

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
            console.log('Database opened successfully');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create stores for materials and books if they don't exist
            if (!db.objectStoreNames.contains(MATERIALS_STORE)) {
                const materialsStore = db.createObjectStore(MATERIALS_STORE, { keyPath: 'id' });
                materialsStore.createIndex('name', 'name', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(BOOKS_STORE)) {
                const booksStore = db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
                booksStore.createIndex('name', 'name', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(FILES_STORE)) {
                const filesStore = db.createObjectStore(FILES_STORE, { keyPath: 'id' });
            }
        };
    });
}

let currentAdminMaterials = [];
let currentAdminBooks = [];

// Load saved materials and books from IndexedDB
async function loadSavedItems() {
    try {
        await initDB();
        
        // Load materials
        currentAdminMaterials = await getAllItems(MATERIALS_STORE);
        displayItems('material', currentAdminMaterials);
        
        // Load books
        currentAdminBooks = await getAllItems(BOOKS_STORE);
        displayItems('book', currentAdminBooks);
        
        // Update stats
        updateAdminStats();
        
        // Update storage status badge
        await updateStorageStatusBadge();
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
        showNotification('حدث خطأ في تحميل البيانات');
    }
}

// Update Admin Stats Cards
function updateAdminStats() {
    const matCount = currentAdminMaterials.length;
    const bookCount = currentAdminBooks.length;
    
    const statsMat = document.getElementById('statsMaterialsCount');
    const statsBook = document.getElementById('statsBooksCount');
    const listMat = document.getElementById('materialsListCount');
    const listBook = document.getElementById('booksListCount');
    
    if (statsMat) statsMat.textContent = matCount;
    if (statsBook) statsBook.textContent = bookCount;
    if (listMat) listMat.textContent = `${matCount} مذكرات`;
    if (listBook) listBook.textContent = `${bookCount} كتب`;
}

// Filter Admin Items
function filterAdminItems(type, query) {
    const q = (query || '').trim().toLowerCase();
    if (type === 'material') {
        const filtered = currentAdminMaterials.filter(m => 
            (m.name || '').toLowerCase().includes(q) ||
            (m.school || '').toLowerCase().includes(q) ||
            (m.teacher || '').toLowerCase().includes(q) ||
            (m.grade || '').toLowerCase().includes(q)
        );
        renderAdminList('material', filtered);
    } else {
        const filtered = currentAdminBooks.filter(b => 
            (b.name || '').toLowerCase().includes(q) ||
            (b.grade || '').toLowerCase().includes(q)
        );
        renderAdminList('book', filtered);
    }
}

// Get all items from a store
function getAllItems(storeName) {
    return new Promise((resolve, reject) => {
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

// Add an item to a store
function addItem(storeName, item) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(item);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Update an item in a store
function updateItem(storeName, item) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Delete an item from a store
function deleteItem(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        
        request.onsuccess = () => {
            resolve();
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Store a file in IndexedDB
function storeFile(id, file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const transaction = db.transaction(FILES_STORE, 'readwrite');
                const store = transaction.objectStore(FILES_STORE);
                const fileData = {
                    id: id,
                    name: file.name,
                    type: file.type,
                    data: event.target.result
                };
                const request = store.put(fileData);
                
                request.onsuccess = () => {
                    resolve(fileData);
                };
                
                request.onerror = (event) => {
                    reject(event.target.error);
                };
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = (event) => {
            reject(event.target.error);
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Get a file from IndexedDB
function getFile(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(FILES_STORE, 'readonly');
        const store = transaction.objectStore(FILES_STORE);
        const request = store.get(id);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Display items in the page
function displayItems(type, items) {
    renderAdminList(type, items);
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

// Render Admin List
function renderAdminList(type, items) {
    const containerId = type === 'material' ? 'materialsList' : 'booksList';
    const container = document.getElementById(containerId) || document.querySelector(`#tab-${type}s .items-list`);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 2rem; color: var(--text-muted); background: var(--bg-alt); border-radius: var(--radius-md);">
                <p>لا توجد ${type === 'material' ? 'مذكرات' : 'كتب'} مضافة حالياً</p>
            </div>
        `;
    } else {
        items.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';
            
            const previewId = `admin-preview-${type}-${item.id}`;
            if (type === 'material') {
                itemCard.innerHTML = `
                    <div class="item-thumbnail" id="${previewId}">
                        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    </div>
                    <div class="item-details">
                        <div class="item-title">${escapeHtml(item.name)}</div>
                        <div class="item-info">
                            <span><strong>المدرسة:</strong> ${escapeHtml(item.school || '-')}</span>
                            <span><strong>المعلم:</strong> ${escapeHtml(item.teacher || '-')}</span>
                            <span><strong>الصف:</strong> ${escapeHtml(item.grade || '-')}</span>
                        </div>
                        <div class="item-info">
                            <span><strong>الطباعة:</strong> ${escapeHtml(item.sides || 'وجه واحد')}</span>
                            <span><strong>السعر:</strong> <span style="color:var(--primary); font-weight:700">${item.price || 0} ر.س</span></span>
                            ${item.fileName ? `<span style="color:var(--text-muted); font-size:0.75rem;">📁 ${escapeHtml(item.fileName)}</span>` : ''}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button type="button" class="btn btn-warning" onclick="editMaterial('${item.id}')">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            تعديل
                        </button>
                        <button type="button" class="btn btn-danger" onclick="deleteMaterial('${item.id}')">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            حذف
                        </button>
                    </div>
                `;
            } else {
                itemCard.innerHTML = `
                    <div class="item-thumbnail" id="${previewId}">
                        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                    </div>
                    <div class="item-details">
                        <div class="item-title">${escapeHtml(item.name)}</div>
                        <div class="item-info">
                            <span><strong>الصف:</strong> ${escapeHtml(item.grade || '-')}</span>
                            <span><strong>السعر:</strong> <span style="color:var(--primary); font-weight:700">${item.price || 0} ر.س</span></span>
                            ${item.fileName ? `<span style="color:var(--text-muted); font-size:0.75rem;">📁 ${escapeHtml(item.fileName)}</span>` : ''}
                        </div>
                    </div>
                    <div class="item-actions">
                        <button type="button" class="btn btn-warning" onclick="editBook('${item.id}')">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            تعديل
                        </button>
                        <button type="button" class="btn btn-danger" onclick="deleteBook('${item.id}')">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            حذف
                        </button>
                    </div>
                `;
            }
            
            container.appendChild(itemCard);
            
            // Display PDF preview
            if (item.fileId || item.fileName || item.id) {
                renderPdfPreviewFromDB(item.fileId, previewId, item.fileName, item.id, item.name);
            }
        });
    }
}

// Render PDF preview from Linked Local Directory or IndexedDB
async function renderPdfPreviewFromDB(fileId, containerId, fileName = null, itemId = null, itemName = null) {
    try {
        const blob = await getPDFBlob(fileId, fileName, false, itemId, itemName);
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
        }).catch(function(error) {
            console.warn('PDF preview render error:', error);
        }).finally(() => {
            URL.revokeObjectURL(url);
        });
    } catch (error) {
        console.error('Error rendering PDF preview:', error);
    }
}

// Calculate default book price based on Copy-and-Print-Centers-Price-Calculator:
// Rule: 7 sheets per 1 SAR (pricePerPage = 7), with wire (withWire = true), 2 sides (sides = 2).
// Rounding rule: Rounds UP to the next integer (Math.ceil) e.g. 32.02 -> 33
function calculateBookPrice(pageCount) {
    if (!pageCount || isNaN(pageCount) || pageCount <= 0) return 0;
    
    const pricePerPage = 7; // 7 أوراق بريال
    const sides = 2; // وجهين
    const withWire = true; // بسلك
    
    const paperPrice = pageCount / pricePerPage;
    // Wire price formula for sides = 2: (pageCount <= 100 ? 5 : (pageCount / 20))
    const wirePrice = withWire ? (sides === 1 ? (pageCount <= 50 ? 5 : (pageCount / 10)) : (pageCount <= 100 ? 5 : (pageCount / 20))) : 0;
    
    const totalPrice = paperPrice + wirePrice;
    // تقريب لأقرب رقم صحيح تالي (Math.ceil)
    return Math.ceil(totalPrice);
}

// Update file name and preview when a file is selected
function updateFileName(input, elementId) {
    const fileNameElement = document.getElementById(elementId);
    const previewId = elementId === 'materialFileName' ? 'materialPreview' : 'bookPreview';
    const previewContainer = document.getElementById(previewId);
    
    if (input.files.length > 0) {
        const file = input.files[0];
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileNameElement.textContent = `✓ ${file.name} (${fileSizeMB} MB)`;
        fileNameElement.style.display = 'inline-block';
        
        // Display PDF preview & calculate default price for books
        const reader = new FileReader();
        reader.onload = function(e) {
            if (!previewContainer) return;
            previewContainer.innerHTML = '<div class="loading-spinner" style="width:30px;height:30px;"></div>';
            
            const canvas = document.createElement('canvas');
            
            pdfjsLib.getDocument(e.target.result).promise.then(function(pdf) {
                // Auto calculate default price when uploading a book PDF
                if (elementId === 'bookFileName') {
                    const pages = pdf.numPages;
                    const calculatedPrice = calculateBookPrice(pages);
                    const bookPriceInput = document.getElementById('bookPrice');
                    const bookPriceHint = document.getElementById('bookPriceHint');
                    
                    if (bookPriceInput) {
                        bookPriceInput.value = String(calculatedPrice);
                    }
                    if (bookPriceHint) {
                        const paperPrice = (pages / 7).toFixed(2);
                        const wirePrice = (pages <= 100 ? 5 : (pages / 20)).toFixed(2);
                        const rawTotal = (parseFloat(paperPrice) + parseFloat(wirePrice)).toFixed(2);
                        bookPriceHint.innerHTML = `💡 السعر الافتراضي: <strong>${calculatedPrice} ر.س</strong> (${pages} صفحة | قبل التقريب: ${rawTotal} ر.س | ورقي: ${paperPrice} + سلك: ${wirePrice}) - يمكنك تعديله يدوياً.`;
                        bookPriceHint.style.display = 'block';
                    }
                }
                
                return pdf.getPage(1);
            }).then(function(page) {
                // Render at high-DPI (scale 1.5) for crisp, large preview
                const viewport = page.getViewport({ scale: 1.5 });
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                const renderContext = {
                    canvasContext: canvas.getContext('2d'),
                    viewport: viewport
                };
                
                return page.render(renderContext).promise;
            }).then(() => {
                previewContainer.innerHTML = '';
                previewContainer.appendChild(canvas);
            }).catch(function(error) {
                console.error('Error displaying PDF preview:', error);
                previewContainer.innerHTML = '<p style="color:var(--danger)">تعذر عرض معاينة PDF</p>';
            });
        };
        reader.readAsDataURL(file);
    } else {
        fileNameElement.textContent = '';
        fileNameElement.style.display = 'none';
        if (elementId === 'bookFileName') {
            const hint = document.getElementById('bookPriceHint');
            if (hint) { hint.style.display = 'none'; hint.textContent = ''; }
        }
        if (previewContainer) {
            previewContainer.innerHTML = `
                <div class="preview-empty-placeholder">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <span>ستظهر معاينة الصفحة الأولى هنا فور اختيار الملف</span>
                </div>
            `;
        }
    }
}

// Reset form
function resetForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.reset();
    
    if (formId === 'materialForm') {
        const nameTag = document.getElementById('materialFileName');
        if (nameTag) { nameTag.textContent = ''; nameTag.style.display = 'none'; }
        
        const preview = document.getElementById('materialPreview');
        if (preview) {
            preview.innerHTML = `
                <div class="preview-empty-placeholder">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <span>ستظهر معاينة الصفحة الأولى هنا فور اختيار الملف</span>
                </div>
            `;
        }
        form.dataset.editId = '';
        form.dataset.fileId = '';
        
        const titleElem = document.getElementById('materialFormTitle');
        if (titleElem) titleElem.textContent = 'إضافة مذكرة جديدة';
        
        const submitButton = form.querySelector('.btn-primary');
        if (submitButton) {
            submitButton.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                <span>حفظ المذكرة</span>
            `;
        }
        document.getElementById('materialFile').setAttribute('required', 'required');
    } else if (formId === 'bookForm') {
        const nameTag = document.getElementById('bookFileName');
        if (nameTag) { nameTag.textContent = ''; nameTag.style.display = 'none'; }
        
        const priceHint = document.getElementById('bookPriceHint');
        if (priceHint) { priceHint.style.display = 'none'; priceHint.textContent = ''; }
        
        const preview = document.getElementById('bookPreview');
        if (preview) {
            preview.innerHTML = `
                <div class="preview-empty-placeholder">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <span>ستظهر معاينة الصفحة الأولى هنا فور اختيار الملف</span>
                </div>
            `;
        }
        form.dataset.editId = '';
        form.dataset.fileId = '';
        
        const titleElem = document.getElementById('bookFormTitle');
        if (titleElem) titleElem.textContent = 'إضافة كتاب جديد';
        
        const submitButton = form.querySelector('.btn-primary');
        if (submitButton) {
            submitButton.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                <span>حفظ الكتاب</span>
            `;
        }
        document.getElementById('bookFile').setAttribute('required', 'required');
    }
}

// Show Modern Toast Notification
function showNotification(message) {
    const notification = document.getElementById('notification');
    const textElem = document.getElementById('notificationText') || notification;
    if (!notification) return;
    
    textElem.textContent = message;
    notification.style.display = 'flex';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3500);
}

// Helper: Safely set grade value in select dropdown
function setSelectGradeValue(selectId, gradeValue) {
    const select = document.getElementById(selectId);
    if (!select) return;
    if (!gradeValue) {
        select.value = '';
        return;
    }
    
    // Check if grade value matches an existing option
    let matchFound = false;
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === gradeValue) {
            select.selectedIndex = i;
            matchFound = true;
            break;
        }
    }
    
    // If not found (e.g. legacy custom string), create a custom option
    if (!matchFound) {
        const customOpt = document.createElement('option');
        customOpt.value = gradeValue;
        customOpt.textContent = gradeValue;
        select.appendChild(customOpt);
        select.value = gradeValue;
    }
}

// Sync data.json with linked directory automatically
async function syncDataJsonToLinkedDirectory() {
    if (!linkedDirectoryHandle) return;
    try {
        const materials = await getAllItems(MATERIALS_STORE);
        const books = await getAllItems(BOOKS_STORE);
        const exportObj = {
            exportDate: new Date().toISOString(),
            version: '2.0',
            materials: materials,
            books: books
        };
        const jsonHandle = await linkedDirectoryHandle.getFileHandle('data.json', { create: true });
        const writable = await jsonHandle.createWritable();
        await writable.write(JSON.stringify(exportObj, null, 2));
        await writable.close();
    } catch (e) {
        console.warn('Auto-sync data.json to directory notice:', e);
    }
}

// Edit material
async function editMaterial(id) {
    try {
        const material = await getItemById(MATERIALS_STORE, id);
        if (material) {
            document.getElementById('materialName').value = material.name || '';
            document.getElementById('schoolName').value = material.school || '';
            document.getElementById('teacherName').value = material.teacher || '';
            setSelectGradeValue('grade', material.grade || '');
            document.getElementById('sides').value = material.sides || 'وجه واحد';
            document.getElementById('price').value = material.price || '';
            
            const form = document.getElementById('materialForm');
            form.dataset.editId = id;
            form.dataset.fileId = material.fileId || id;
            
            if (material.fileName || material.fileId) {
                const nameTag = document.getElementById('materialFileName');
                nameTag.textContent = `الملف الحالي: ${material.fileName || material.name}`;
                nameTag.style.display = 'inline-block';
                
                document.getElementById('materialFile').removeAttribute('required');
                
                renderPdfPreviewFromDB(material.fileId, 'materialPreview', material.fileName, material.id, material.name);
            }
            
            const titleElem = document.getElementById('materialFormTitle');
            if (titleElem) titleElem.textContent = `تعديل المذكرة: ${material.name}`;
            
            const submitButton = form.querySelector('.btn-primary');
            if (submitButton) {
                submitButton.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>تحديث المذكرة</span>
                `;
            }
            
            form.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Error loading material for edit:', error);
        showNotification('حدث خطأ أثناء تحميل بيانات المذكرة');
    }
}

// Edit book
async function editBook(id) {
    try {
        const book = await getItemById(BOOKS_STORE, id);
        if (book) {
            document.getElementById('bookName').value = book.name || '';
            setSelectGradeValue('bookGrade', book.grade || '');
            document.getElementById('bookPrice').value = book.price || '';
            
            const form = document.getElementById('bookForm');
            form.dataset.editId = id;
            form.dataset.fileId = book.fileId || id;
            
            if (book.fileName || book.fileId) {
                const nameTag = document.getElementById('bookFileName');
                nameTag.textContent = `الملف الحالي: ${book.fileName || book.name}`;
                nameTag.style.display = 'inline-block';
                
                document.getElementById('bookFile').removeAttribute('required');
                
                renderPdfPreviewFromDB(book.fileId, 'bookPreview', book.fileName, book.id, book.name);
            }
            
            const titleElem = document.getElementById('bookFormTitle');
            if (titleElem) titleElem.textContent = `تعديل الكتاب: ${book.name}`;
            
            const submitButton = form.querySelector('.btn-primary');
            if (submitButton) {
                submitButton.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>تحديث الكتاب</span>
                `;
            }
            
            form.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Error loading book for edit:', error);
        showNotification('حدث خطأ أثناء تحميل بيانات الكتاب');
    }
}

// Get item by ID
function getItemById(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Delete material
async function deleteMaterial(id) {
    if (confirm('هل أنت متأكد من حذف هذه المذكرة نهائياً؟')) {
        try {
            const material = await getItemById(MATERIALS_STORE, id);
            
            if (material && material.fileId) {
                await deleteItem(FILES_STORE, material.fileId);
            }
            if (id) {
                await deleteItem(FILES_STORE, id);
            }
            
            await deleteItem(MATERIALS_STORE, id);
            await syncDataJsonToLinkedDirectory();
            await loadSavedItems();
            showNotification('تم حذف المذكرة بنجاح');
        } catch (error) {
            console.error('Error deleting material:', error);
            showNotification('حدث خطأ أثناء الحذف');
        }
    }
}

// Delete book
async function deleteBook(id) {
    if (confirm('هل أنت متأكد من حذف هذا الكتاب نهائياً؟')) {
        try {
            const book = await getItemById(BOOKS_STORE, id);
            
            if (book && book.fileId) {
                await deleteItem(FILES_STORE, book.fileId);
            }
            if (id) {
                await deleteItem(FILES_STORE, id);
            }
            
            await deleteItem(BOOKS_STORE, id);
            await syncDataJsonToLinkedDirectory();
            await loadSavedItems();
            showNotification('تم حذف الكتاب بنجاح');
        } catch (error) {
            console.error('Error deleting book:', error);
            showNotification('حدث خطأ أثناء الحذف');
        }
    }
}

// Handle material form submission
document.getElementById('materialForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('materialFile');
    const editId = this.dataset.editId;
    const targetId = editId || Date.now().toString();
    let fileId = this.dataset.fileId || targetId;
    let fileName = null;
    let thumbnail = null;
    
    try {
        if (editId) {
            const existing = await getItemById(MATERIALS_STORE, editId);
            if (existing) {
                fileId = existing.fileId || existing.id;
                fileName = existing.fileName;
                thumbnail = existing.thumbnail || null;
            }
        }
        
        // Capture thumbnail from preview canvas if available
        const previewCanvas = document.querySelector('#materialPreview canvas');
        if (previewCanvas) {
            try {
                thumbnail = previewCanvas.toDataURL('image/jpeg', 0.85);
            } catch (err) {
                console.warn('Failed to capture thumbnail:', err);
            }
        }
        
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            fileId = targetId;
            fileName = file.name.normalize('NFC');
            await storeFile(fileId, file);
            
            // If local directory is linked, also save to sample-pdfs in that directory!
            if (linkedDirectoryHandle) {
                try {
                    const pdfsDirHandle = await linkedDirectoryHandle.getDirectoryHandle('sample-pdfs', { create: true });
                    const diskFileName = `${targetId}_${fileName}`;
                    const buf = await file.arrayBuffer();
                    await savePDFFile(pdfsDirHandle, diskFileName, buf);
                } catch (dirSaveErr) {
                    console.warn('Auto-save to linked directory notice:', dirSaveErr);
                }
            }
        } else if (!editId && !fileId) {
            showNotification('الرجاء اختيار ملف PDF');
            return;
        }
        
        const materialData = {
            id: targetId,
            name: document.getElementById('materialName').value.trim(),
            school: document.getElementById('schoolName').value.trim(),
            teacher: document.getElementById('teacherName').value.trim(),
            grade: document.getElementById('grade').value.trim(),
            sides: document.getElementById('sides').value,
            price: document.getElementById('price').value.trim(),
            fileId: fileId,
            fileName: fileName,
            thumbnail: thumbnail,
            dateAdded: editId ? ((await getItemById(MATERIALS_STORE, editId)) || {}).dateAdded || new Date().toISOString() : new Date().toISOString()
        };
        
        if (editId) {
            await updateItem(MATERIALS_STORE, materialData);
            showNotification('تم تحديث المذكرة بنجاح');
        } else {
            await addItem(MATERIALS_STORE, materialData);
            showNotification('تم إضافة وحفظ المذكرة بنجاح');
        }
        
        await syncDataJsonToLinkedDirectory();
        resetForm('materialForm');
        await loadSavedItems();
    } catch (error) {
        console.error('Error saving material:', error);
        showNotification('حدث خطأ أثناء حفظ المذكرة');
    }
});

// Handle book form submission
document.getElementById('bookForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('bookFile');
    const editId = this.dataset.editId;
    const targetId = editId || Date.now().toString();
    let fileId = this.dataset.fileId || targetId;
    let fileName = null;
    let thumbnail = null;
    
    try {
        if (editId) {
            const existing = await getItemById(BOOKS_STORE, editId);
            if (existing) {
                fileId = existing.fileId || existing.id;
                fileName = existing.fileName;
                thumbnail = existing.thumbnail || null;
            }
        }
        
        // Capture thumbnail from preview canvas if available
        const previewCanvas = document.querySelector('#bookPreview canvas');
        if (previewCanvas) {
            try {
                thumbnail = previewCanvas.toDataURL('image/jpeg', 0.85);
            } catch (err) {
                console.warn('Failed to capture thumbnail:', err);
            }
        }
        
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            fileId = targetId;
            fileName = file.name.normalize('NFC');
            await storeFile(fileId, file);
            
            // If local directory is linked, also save to sample-pdfs in that directory!
            if (linkedDirectoryHandle) {
                try {
                    const pdfsDirHandle = await linkedDirectoryHandle.getDirectoryHandle('sample-pdfs', { create: true });
                    const diskFileName = `${targetId}_${fileName}`;
                    const buf = await file.arrayBuffer();
                    await savePDFFile(pdfsDirHandle, diskFileName, buf);
                } catch (dirSaveErr) {
                    console.warn('Auto-save to linked directory notice:', dirSaveErr);
                }
            }
        } else if (!editId && !fileId) {
            showNotification('الرجاء اختيار ملف PDF');
            return;
        }
        
        const bookData = {
            id: targetId,
            name: document.getElementById('bookName').value.trim(),
            grade: document.getElementById('bookGrade').value.trim(),
            price: document.getElementById('bookPrice').value.trim(),
            fileId: fileId,
            fileName: fileName,
            thumbnail: thumbnail,
            dateAdded: editId ? ((await getItemById(BOOKS_STORE, editId)) || {}).dateAdded || new Date().toISOString() : new Date().toISOString()
        };
        
        if (editId) {
            await updateItem(BOOKS_STORE, bookData);
            showNotification('تم تحديث الكتاب بنجاح');
        } else {
            await addItem(BOOKS_STORE, bookData);
            showNotification('تم إضافة وحفظ الكتاب بنجاح');
        }
        
        await syncDataJsonToLinkedDirectory();
        resetForm('bookForm');
        await loadSavedItems();
    } catch (error) {
        console.error('Error saving book:', error);
        showNotification('حدث خطأ أثناء حفظ الكتاب');
    }
});

// Switch between tabs
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const targetContent = document.getElementById(tabId);
    if (targetContent) targetContent.classList.add('active');
    
    const targetBtn = document.querySelector(`.tab[onclick="switchTab('${tabId}')"]`);
    if (targetBtn) targetBtn.classList.add('active');
}

// Support for drag and drop file upload
const fileDropAreas = document.querySelectorAll('.file-input-container');

fileDropAreas.forEach(area => {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        area.addEventListener(eventName, () => {
            area.style.borderColor = 'var(--primary)';
            area.style.backgroundColor = 'var(--primary-light)';
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, () => {
            area.style.borderColor = '';
            area.style.backgroundColor = '';
        }, false);
    });
    
    area.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            let fileInput;
            let fileNameElementId;
            
            if (area.closest('#materialForm')) {
                fileInput = document.getElementById('materialFile');
                fileNameElementId = 'materialFileName';
            } else if (area.closest('#bookForm')) {
                fileInput = document.getElementById('bookFile');
                fileNameElementId = 'bookFileName';
            }
            
            if (fileInput) {
                fileInput.files = files;
                updateFileName(fileInput, fileNameElementId);
            }
        }
    }, false);
});

// Theme Toggle Helper
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Load saved items when the page loads
document.addEventListener('DOMContentLoaded', loadSavedItems);


// Show loading overlay
function showLoading(message) {
    const overlay = document.getElementById('loadingOverlay');
    const messageElement = document.getElementById('loadingMessage');
    
    if (messageElement) {
        messageElement.textContent = message || 'جاري المعالجة...';
    }
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}


// Directory Handle & Local Folder Storage Management
let linkedDirectoryHandle = null;

// Persist directory handle to IndexedDB
async function saveDirectoryHandle(handle) {
    if (!db || !handle) return;
    try {
        const transaction = db.transaction(FILES_STORE, 'readwrite');
        const store = transaction.objectStore(FILES_STORE);
        store.put({ id: '__linked_dir_handle__', handle: handle, name: handle.name, date: new Date().toISOString() });
    } catch (e) {
        console.warn('Could not persist directory handle:', e);
    }
}

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

// Update the storage status badge and description
async function updateStorageStatusBadge() {
    if (!linkedDirectoryHandle) {
        linkedDirectoryHandle = await getStoredDirectoryHandle();
    }
    
    const badge = document.getElementById('storageStatusText');
    const desc = document.getElementById('linkedFolderStatusDesc');
    const btnDisconnect = document.getElementById('btnDisconnectFolder');
    
    if (linkedDirectoryHandle) {
        if (badge) {
            badge.textContent = `📂 مجلد محلي: ${linkedDirectoryHandle.name}`;
            badge.style.color = 'var(--primary)';
        }
        if (desc) {
            desc.innerHTML = `<span style="color:var(--success); font-weight:700;">✅ متصل بمجلد الكمبيوتر:</span> <strong>${escapeHtml(linkedDirectoryHandle.name)}</strong> (ملفات الـ PDF تُقرأ مباشرة من القرص بدون شغل ذاكرة المتصفح).`;
        }
        if (btnDisconnect) btnDisconnect.style.display = 'inline-flex';
    } else {
        if (badge) {
            badge.textContent = 'ذاكرة المتصفح (IndexedDB)';
            badge.style.color = 'var(--success)';
        }
        if (desc) {
            desc.textContent = 'لم يتم ربط مجلد محلي بعد. البيانات تُقرأ حالياً من ذاكرة المتصفح.';
        }
        if (btnDisconnect) btnDisconnect.style.display = 'none';
    }
}

// Disconnect local folder and switch back to standard IndexedDB mode
async function disconnectLocalFolder() {
    if (!confirm('هل تريد فصل المجلد المحلي والعودة للتخزين الافتراضي؟')) return;
    try {
        if (db) {
            const transaction = db.transaction(FILES_STORE, 'readwrite');
            const store = transaction.objectStore(FILES_STORE);
            store.delete('__linked_dir_handle__');
        }
        linkedDirectoryHandle = null;
        await updateStorageStatusBadge();
        showNotification('تم فصل المجلد المحلي بنجاح');
    } catch (e) {
        console.error('Error disconnecting folder:', e);
    }
}

// Helper: Deep and robust search for PDF file inside directory handle and subfolders
async function findFileInDirectoryHandle(rootDirHandle, fileId, rawFileName, itemId = null, itemName = null) {
    if (!rootDirHandle) return null;
    
    const idsToTry = [fileId, itemId].filter(Boolean).map(x => x.toString().trim());
    const namesToTry = [rawFileName, itemName].filter(Boolean).map(x => x.toString().trim());
    
    // Normalization helper for Arabic, punctuation, and case differences
    const norm = (str) => (str || '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/[\s_\-\.\(\)]+/g, '');
        
    const targetNorms = namesToTry.map(n => norm(n.replace(/\.pdf$/i, ''))).filter(Boolean);
    
    // Collect all directories to search: root directory + common subdirectories
    const dirsToSearch = [rootDirHandle];
    const subDirNames = ['sample-pdfs', 'sample_pdfs', 'pdfs', 'PDFs', 'files', 'materials', 'books'];
    
    for (const subName of subDirNames) {
        try {
            const subHandle = await rootDirHandle.getDirectoryHandle(subName);
            if (subHandle) dirsToSearch.push(subHandle);
        } catch (e) {
            // Subdir doesn't exist
        }
    }
    
    // 1. Fast Pass: Direct exact candidates on all candidate directories
    const candidateNames = [];
    for (const cleanId of idsToTry) {
        for (const cleanName of namesToTry) {
            const cleanNameNoExt = cleanName.replace(/\.pdf$/i, '');
            candidateNames.push(`${cleanId}_${cleanName}`);
            candidateNames.push(`${cleanId}_${cleanNameNoExt}.pdf`);
            candidateNames.push(`${cleanId}-${cleanNameNoExt}.pdf`);
        }
        candidateNames.push(`${cleanId}.pdf`);
    }
    for (const cleanName of namesToTry) {
        const cleanNameNoExt = cleanName.replace(/\.pdf$/i, '');
        candidateNames.push(cleanName);
        candidateNames.push(`${cleanNameNoExt}.pdf`);
    }
    
    for (const dir of dirsToSearch) {
        for (const candidate of candidateNames) {
            try {
                const fileHandle = await dir.getFileHandle(candidate);
                const file = await fileHandle.getFile();
                if (file && file.size > 0) return file;
            } catch (e) {
                // Try next
            }
        }
    }
    
    // 2. Deep Pass: Iterate directory entries with fuzzy and normalized Arabic matching
    for (const dir of dirsToSearch) {
        try {
            if (typeof dir.entries === 'function' || typeof dir.values === 'function') {
                const iterator = dir.entries ? dir.entries() : dir.values();
                for await (const entry of iterator) {
                    const handle = Array.isArray(entry) ? entry[1] : entry;
                    const name = Array.isArray(entry) ? entry[0] : handle.name;
                    
                    if (!handle || handle.kind !== 'file') continue;
                    if (!name.toLowerCase().endsWith('.pdf') && !name.toLowerCase().includes('.pdf')) continue;
                    
                    const entryName = name;
                    const entryNorm = norm(entryName.replace(/\.pdf$/i, ''));
                    
                    // Match by file ID or item ID prefix (e.g., 1788251448243_...)
                    for (const cleanId of idsToTry) {
                        if (cleanId && entryName.startsWith(cleanId)) {
                            try {
                                const file = await handle.getFile();
                                if (file && file.size > 0) return file;
                            } catch (e) {}
                        }
                    }
                    
                    // Match by normalized text inclusion
                    for (const targetNorm of targetNorms) {
                        if (targetNorm && (entryNorm.includes(targetNorm) || targetNorm.includes(entryNorm))) {
                            try {
                                const file = await handle.getFile();
                                if (file && file.size > 0) return file;
                            } catch (e) {}
                        }
                    }
                    
                    // Match after stripping leading numeric IDs (e.g., 1709123456_name.pdf -> name.pdf)
                    const nameWithoutPrefix = entryName.replace(/^\d+[\s_\-]+/, '');
                    for (const cleanName of namesToTry) {
                        if (cleanName && norm(nameWithoutPrefix) === norm(cleanName)) {
                            try {
                                const file = await handle.getFile();
                                if (file && file.size > 0) return file;
                            } catch (e) {}
                        }
                    }
                }
            }
        } catch (iterErr) {
            console.warn('Error scanning directory entries:', iterErr);
        }
    }
    
    return null;
}

// Helper to get PDF File/Blob either from linked local directory OR from IndexedDB
async function getPDFBlob(fileId, rawFileName, isInteractive = false, itemId = null, itemName = null) {
    if (!linkedDirectoryHandle) {
        linkedDirectoryHandle = await getStoredDirectoryHandle();
    }
    
    if (linkedDirectoryHandle) {
        try {
            const opts = { mode: 'read' };
            let perm = 'denied';
            
            if (typeof linkedDirectoryHandle.queryPermission === 'function') {
                try {
                    perm = await linkedDirectoryHandle.queryPermission(opts);
                } catch (e) {
                    perm = 'prompt';
                }
            } else {
                perm = 'granted';
            }
            
            // Only request permission during direct user clicks to avoid browser security gesture errors
            if (perm !== 'granted' && isInteractive) {
                if (typeof linkedDirectoryHandle.requestPermission === 'function') {
                    try {
                        perm = await linkedDirectoryHandle.requestPermission(opts);
                    } catch (permErr) {
                        console.warn('requestPermission failed:', permErr);
                    }
                }
            }
            
            if (perm === 'granted') {
                const foundFile = await findFileInDirectoryHandle(linkedDirectoryHandle, fileId, rawFileName, itemId, itemName);
                if (foundFile) return foundFile;
            }
        } catch (dirErr) {
            console.warn('Error reading from linked directory:', dirErr);
        }
    }
    
    // Fallback: Retrieve from IndexedDB files store
    const idsToSearchDB = [fileId, itemId].filter(Boolean);
    for (const searchId of idsToSearchDB) {
        try {
            const fileData = await getFile(searchId);
            if (fileData && fileData.data) {
                return new Blob([fileData.data], { type: 'application/pdf' });
            }
        } catch (dbErr) {
            console.warn('IndexedDB file fetch notice:', dbErr);
        }
    }
    
    return null;
}

// Link local data directory (Zero-RAM mode)
async function linkLocalDataDirectory() {
    try {
        if (window.showDirectoryPicker) {
            const dirHandle = await window.showDirectoryPicker({
                id: 'educational-materials',
                mode: 'read'
            });
            
            showLoading('جاري قراءة البيانات من المجلد المحلي...');
            
            let jsonData = null;
            let xmlDoc = null;
            
            // 1. Try reading data.json
            try {
                const jsonHandle = await dirHandle.getFileHandle('data.json');
                const jsonFile = await jsonHandle.getFile();
                const jsonText = await jsonFile.text();
                jsonData = JSON.parse(jsonText);
            } catch (e) {
                // 2. Fallback to data.xml
                try {
                    const xmlHandle = await dirHandle.getFileHandle('data.xml');
                    const xmlFile = await xmlHandle.getFile();
                    const xmlText = await xmlFile.text();
                    const parser = new DOMParser();
                    xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                } catch (err) {
                    hideLoading();
                    alert('لم يتم العثور على ملف data.json أو data.xml داخل المجلد المختار.\nيرجى التأكد من استخراج ملفات النسخة الاحتياطية واختيار المجلد الصحيح.');
                    return;
                }
            }
            
            // Clear metadata stores (keep files store empty to save memory!)
            await clearStore(MATERIALS_STORE);
            await clearStore(BOOKS_STORE);
            await clearStore(FILES_STORE);
            
            // Save directory handle
            linkedDirectoryHandle = dirHandle;
            await saveDirectoryHandle(dirHandle);
            
            // Import Metadata
            if (jsonData) {
                if (Array.isArray(jsonData.materials)) {
                    for (const m of jsonData.materials) {
                        await addItem(MATERIALS_STORE, m);
                    }
                }
                if (Array.isArray(jsonData.books)) {
                    for (const b of jsonData.books) {
                        await addItem(BOOKS_STORE, b);
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
                    await addItem(MATERIALS_STORE, material);
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
                    await addItem(BOOKS_STORE, book);
                }
            }
            
            hideLoading();
            showNotification(`تم ربط المجلد "${dirHandle.name}" بنجاح بدون استهلاك ذاكرة المتصفح!`);
            await loadSavedItems();
            await updateStorageStatusBadge();
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
                    
                    showLoading('جاري قراءة واستيراد المجلد...');
                    
                    let jsonFile = files.find(f => f.name.toLowerCase() === 'data.json');
                    let xmlFile = files.find(f => f.name.toLowerCase() === 'data.xml');
                    
                    if (!jsonFile && !xmlFile) {
                        hideLoading();
                        alert('لم يتم العثور على data.json أو data.xml داخل المجلد المحدد');
                        return;
                    }
                    
                    await clearStore(MATERIALS_STORE);
                    await clearStore(BOOKS_STORE);
                    await clearStore(FILES_STORE);
                    
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
                            for (const m of data.materials) await addItem(MATERIALS_STORE, m);
                        }
                        if (Array.isArray(data.books)) {
                            for (const b of data.books) await addItem(BOOKS_STORE, b);
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
                            await addItem(MATERIALS_STORE, material);
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
                            await addItem(BOOKS_STORE, book);
                        }
                    }
                    
                    hideLoading();
                    showNotification('تم استيراد المجلد والبيانات بنجاح!');
                    await loadSavedItems();
                    await updateStorageStatusBadge();
                } catch (err) {
                    console.error('Fallback folder import error:', err);
                    hideLoading();
                    alert('حدث خطأ أثناء قراءة المجلد: ' + err.message);
                } finally {
                    document.body.removeChild(input);
                }
            };
            input.click();
        }
    } catch (error) {
        console.error('Error linking local directory:', error);
        hideLoading();
        if (error.name !== 'AbortError') {
            alert('حدث خطأ أثناء ربط المجلد المحلي: ' + error.message);
        }
    }
}

// تصدير البيانات وحفظها مباشرة في مجلد على القرص الصلب
async function exportDataAsXML() {
    try {
        if (!window.showDirectoryPicker) {
            alert('متصفحك لا يدعم هذه الخاصية. يرجى استخدام متصفح Google Chrome أو Microsoft Edge.');
            return;
        }
        
        let dirHandle;
        try {
            dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                id: 'educational-materials'
            });
        } catch (error) {
            if (error.name === 'AbortError') return;
            alert('يرجى اختيار مجلد لحفظ البيانات والملفات.');
            return;
        }

        showLoading('جاري حفظ البيانات والملفات في المجلد المحدد...');

        let pdfsDirHandle = await dirHandle.getDirectoryHandle('sample-pdfs', { create: true });

        const materials = await getAllItems(MATERIALS_STORE);
        const books = await getAllItems(BOOKS_STORE);

        // 1. JSON Export
        const exportObj = {
            exportDate: new Date().toISOString(),
            version: '2.0',
            materials: materials,
            books: books
        };
        const jsonHandle = await dirHandle.getFileHandle('data.json', { create: true });
        const jsonWritable = await jsonHandle.createWritable();
        await jsonWritable.write(JSON.stringify(exportObj, null, 2));
        await jsonWritable.close();

        // 2. XML Export
        const xmlDoc = document.implementation.createDocument(null, 'data', null);
        const root = xmlDoc.documentElement;

        const materialsElem = xmlDoc.createElement('materials');
        root.appendChild(materialsElem);

        for (const material of materials) {
            const materialElem = xmlDoc.createElement('material');
            materialElem.setAttribute('id', material.id);

            const addField = (name, value) => {
                const elem = xmlDoc.createElement(name);
                elem.textContent = value || '';
                materialElem.appendChild(elem);
            };

            addField('name', material.name);
            addField('school', material.school);
            addField('teacher', material.teacher);
            addField('grade', material.grade);
            addField('sides', material.sides);
            addField('price', material.price);
            if (material.thumbnail) addField('thumbnail', material.thumbnail);

            if (material.fileId || material.fileName || material.id) {
                const pdfBlob = await getPDFBlob(material.fileId, material.fileName, true, material.id, material.name);
                if (pdfBlob) {
                    const fileName = `${material.id}_${material.fileName || 'material.pdf'}`;
                    addField('file', fileName);
                    const buf = await pdfBlob.arrayBuffer();
                    await savePDFFile(pdfsDirHandle, fileName, buf);
                }
            }

            materialsElem.appendChild(materialElem);
        }

        const booksElem = xmlDoc.createElement('books');
        root.appendChild(booksElem);

        for (const book of books) {
            const bookElem = xmlDoc.createElement('book');
            bookElem.setAttribute('id', book.id);

            const addField = (name, value) => {
                const elem = xmlDoc.createElement(name);
                elem.textContent = value || '';
                bookElem.appendChild(elem);
            };

            addField('name', book.name);
            addField('grade', book.grade);
            addField('price', book.price);
            if (book.thumbnail) addField('thumbnail', book.thumbnail);

            if (book.fileId || book.fileName || book.id) {
                const pdfBlob = await getPDFBlob(book.fileId, book.fileName, true, book.id, book.name);
                if (pdfBlob) {
                    const fileName = `${book.id}_${book.fileName || 'book.pdf'}`;
                    addField('file', fileName);
                    const buf = await pdfBlob.arrayBuffer();
                    await savePDFFile(pdfsDirHandle, fileName, buf);
                }
            }

            booksElem.appendChild(bookElem);
        }

        const serializer = new XMLSerializer();
        const xmlString = serializer.serializeToString(xmlDoc);

        const xmlHandle = await dirHandle.getFileHandle('data.xml', { create: true });
        const xmlWritable = await xmlHandle.createWritable();
        await xmlWritable.write(xmlString);
        await xmlWritable.close();

        // Also link this directory immediately!
        linkedDirectoryHandle = dirHandle;
        await saveDirectoryHandle(dirHandle);
        await updateStorageStatusBadge();

        hideLoading();
        showNotification('تم حفظ وتصدير كافة الملفات والبيانات إلى المجلد بنجاح!');
    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);
        hideLoading();
        alert('حدث خطأ أثناء حفظ البيانات في المجلد: ' + error.message);
    }
}

// حفظ ملف PDF
async function savePDFFile(dirHandle, fileName, data) {
    try {
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
    } catch (error) {
        console.error('خطأ في حفظ ملف PDF:', error, fileName);
    }
}

// تصدير البيانات كملف واحد (ZIP)
async function exportDataAsZip() {
    try {
        showLoading('جاري تجميع وضغط النسخة الاحتياطية (ZIP)...');
        
        if (typeof JSZip === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        }
        
        const materials = await getAllItems(MATERIALS_STORE);
        const books = await getAllItems(BOOKS_STORE);
        
        const zip = new JSZip();
        const pdfFolder = zip.folder('sample-pdfs');
        
        // 1. data.json
        const exportObj = {
            exportDate: new Date().toISOString(),
            version: '2.0',
            materials: materials,
            books: books
        };
        zip.file('data.json', JSON.stringify(exportObj, null, 2));

        // 2. data.xml
        const xmlDoc = document.implementation.createDocument(null, 'data', null);
        const root = xmlDoc.documentElement;
        
        const materialsElem = xmlDoc.createElement('materials');
        root.appendChild(materialsElem);
        
        for (const material of materials) {
            const materialElem = xmlDoc.createElement('material');
            materialElem.setAttribute('id', material.id);
            
            const addField = (name, value) => {
                const elem = xmlDoc.createElement(name);
                elem.textContent = value || '';
                materialElem.appendChild(elem);
            };
            
            addField('name', material.name);
            addField('school', material.school);
            addField('teacher', material.teacher);
            addField('grade', material.grade);
            addField('sides', material.sides);
            addField('price', material.price);
            if (material.thumbnail) addField('thumbnail', material.thumbnail);
            
            if (material.fileId || material.fileName || material.id) {
                const pdfBlob = await getPDFBlob(material.fileId, material.fileName, true, material.id, material.name);
                if (pdfBlob) {
                    const fileName = `${material.id}_${material.fileName || 'material.pdf'}`;
                    addField('file', fileName);
                    const buf = await pdfBlob.arrayBuffer();
                    pdfFolder.file(fileName, buf);
                }
            }
            
            materialsElem.appendChild(materialElem);
        }
        
        const booksElem = xmlDoc.createElement('books');
        root.appendChild(booksElem);
        
        for (const book of books) {
            const bookElem = xmlDoc.createElement('book');
            bookElem.setAttribute('id', book.id);
            
            const addField = (name, value) => {
                const elem = xmlDoc.createElement(name);
                elem.textContent = value || '';
                bookElem.appendChild(elem);
            };
            
            addField('name', book.name);
            addField('grade', book.grade);
            addField('price', book.price);
            if (book.thumbnail) addField('thumbnail', book.thumbnail);
            
            if (book.fileId || book.fileName || book.id) {
                const pdfBlob = await getPDFBlob(book.fileId, book.fileName, true, book.id, book.name);
                if (pdfBlob) {
                    const fileName = `${book.id}_${book.fileName || 'book.pdf'}`;
                    addField('file', fileName);
                    const buf = await pdfBlob.arrayBuffer();
                    pdfFolder.file(fileName, buf);
                }
            }
            
            booksElem.appendChild(bookElem);
        }
        
        const serializer = new XMLSerializer();
        const xmlString = serializer.serializeToString(xmlDoc);
        zip.file('data.xml', xmlString);

        // README text file explaining how to link the unzipped folder
        const readmeContent = `تعليمات الاستعادة الخفيفة (بدون استهلاك ذاكرة المتصفح):\n1. قم بفك ضغط هذا الملف في أي مكان على جهازك (مثال: المستندات أو القرص D).\n2. افتح صفحة لوحة الإدارة أو الموقع الرئيسي.\n3. اختر "النسخ الاحتياطي ومجلد الجهاز" ثم اضغط "تحديد / ربط مجلد من الكمبيوتر" واختر المجلد المفكوك.\n4. سيعمل الموقع مباشرة من القرص الصلب بدون تحميل أي ملفات لذاكرة المتصفح!`;
        zip.file('README.txt', readmeContent);
        
        const content = await zip.generateAsync({ type: 'blob' });
        downloadBlob(content, 'educational-materials.zip');
        
        hideLoading();
        showNotification('تم تصدير ملف النسخة الاحتياطية بنجاح!');
    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);
        hideLoading();
        alert('حدث خطأ أثناء تصدير ملف ZIP: ' + error.message);
    }
}

// Helper: Smart lookup and extraction of PDF files inside JSZip
async function findAndExtractZipFile(zipContent, fileId, rawFileName) {
    if (!zipContent || !zipContent.files) return null;
    
    const cleanId = (fileId || '').toString().trim();
    const cleanName = (rawFileName || '').toString().trim();
    const cleanNameNoExt = cleanName.replace(/\.pdf$/i, '');
    
    const norm = (s) => (s || '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/[\s_\-\.\(\)\\\/]+/g, '');
        
    const targetNorm = norm(cleanNameNoExt);
    
    // 1. Direct candidate paths
    const candidates = [
        `sample-pdfs/${cleanId}_${cleanName}`,
        `sample-pdfs/${cleanId}_${cleanNameNoExt}.pdf`,
        `sample-pdfs/${cleanName}`,
        `sample-pdfs/${cleanNameNoExt}.pdf`,
        `sample-pdfs/${cleanId}.pdf`,
        `${cleanId}_${cleanName}`,
        `${cleanId}_${cleanNameNoExt}.pdf`,
        `${cleanName}`,
        `${cleanNameNoExt}.pdf`,
        `${cleanId}.pdf`,
        `sample-pdfs\\${cleanId}_${cleanName}`,
        `sample-pdfs\\${cleanName}`
    ];
    
    for (const cand of candidates) {
        if (zipContent.files[cand] && !zipContent.files[cand].dir) {
            return await zipContent.files[cand].async('arraybuffer');
        }
    }
    
    // 2. Iterate all entries in ZIP
    for (const [path, zipObj] of Object.entries(zipContent.files)) {
        if (zipObj.dir) continue;
        const entryName = path.split(/[\/\\]/).pop();
        if (!entryName.toLowerCase().endsWith('.pdf') && !entryName.toLowerCase().includes('.pdf')) continue;
        
        if (cleanId && entryName.startsWith(cleanId)) {
            return await zipObj.async('arraybuffer');
        }
        
        const entryNorm = norm(entryName.replace(/\.pdf$/i, ''));
        if (targetNorm && (entryNorm.includes(targetNorm) || targetNorm.includes(entryNorm))) {
            return await zipObj.async('arraybuffer');
        }
    }
    
    return null;
}

// استيراد البيانات من ملف ZIP (الاستيراد التقليدي)
async function importDataFromZip() {
    try {
        if (typeof JSZip === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        }
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.zip';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        const filePromise = new Promise((resolve, reject) => {
            fileInput.onchange = () => {
                if (fileInput.files.length > 0) resolve(fileInput.files[0]);
                else reject(new Error('لم يتم اختيار ملف'));
            };
            setTimeout(() => {
                if (fileInput.files.length === 0) reject(new Error('تم إلغاء اختيار الملف'));
            }, 100000);
        });
        
        fileInput.click();
        const file = await filePromise;
        
        showLoading('جاري استيراد البيانات والملفات إلى المتصفح...');
        
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        await clearStore(MATERIALS_STORE);
        await clearStore(BOOKS_STORE);
        await clearStore(FILES_STORE);
        
        if (zipContent.files['data.json']) {
            const jsonText = await zipContent.files['data.json'].async('text');
            const data = JSON.parse(jsonText);
            
            if (Array.isArray(data.materials)) {
                for (const m of data.materials) {
                    await addItem(MATERIALS_STORE, m);
                    if (m.fileId || m.fileName) {
                        const buf = await findAndExtractZipFile(zipContent, m.fileId || m.id, m.fileName || m.name);
                        if (buf) {
                            await storeFileData(m.fileId || m.id, m.fileName, buf);
                        }
                    }
                }
            }
            if (Array.isArray(data.books)) {
                for (const b of data.books) {
                    await addItem(BOOKS_STORE, b);
                    if (b.fileId || b.fileName) {
                        const buf = await findAndExtractZipFile(zipContent, b.fileId || b.id, b.fileName || b.name);
                        if (buf) {
                            await storeFileData(b.fileId || b.id, b.fileName, buf);
                        }
                    }
                }
            }
        } else if (zipContent.files['data.xml']) {
            const xmlContent = await zipContent.files['data.xml'].async('text');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            
            const materialNodes = xmlDoc.querySelectorAll('materials > material');
            for (const node of materialNodes) {
                const id = node.getAttribute('id');
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
                
                const buf = await findAndExtractZipFile(zipContent, id, fileName || material.name);
                if (buf) {
                    await storeFileData(id, material.fileName, buf);
                }
                
                await addItem(MATERIALS_STORE, material);
            }
            
            const bookNodes = xmlDoc.querySelectorAll('books > book');
            for (const node of bookNodes) {
                const id = node.getAttribute('id');
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
                
                const buf = await findAndExtractZipFile(zipContent, id, fileName || book.name);
                if (buf) {
                    await storeFileData(id, book.fileName, buf);
                }
                
                await addItem(BOOKS_STORE, book);
            }
        }
        
        document.body.removeChild(fileInput);
        hideLoading();
        showNotification('تم استيراد البيانات والملفات بنجاح');
        await loadSavedItems();
        await updateStorageStatusBadge();
    } catch (error) {
        console.error('خطأ في استيراد البيانات:', error);
        hideLoading();
        if (error.message !== 'تم إلغاء اختيار الملف') {
            alert('حدث خطأ أثناء استيراد البيانات: ' + error.message);
        }
    }
}

// مسح مخزن في IndexedDB
function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

// تنزيل ملف كـ blob
function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// تحميل سكريبت خارجي
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// تخزين بيانات الملف في IndexedDB
async function storeFileData(id, fileName, data) {
    const fileData = {
        id: id,
        name: fileName,
        type: 'application/pdf',
        data: data
    };
    await addItem(FILES_STORE, fileData);
}
