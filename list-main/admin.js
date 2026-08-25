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
            if (item.fileId) {
                renderPdfPreviewFromDB(item.fileId, previewId);
            }
        });
    }
}

// Render PDF preview from IndexedDB
async function renderPdfPreviewFromDB(fileId, containerId) {
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
            form.dataset.fileId = material.fileId;
            
            if (material.fileName) {
                const nameTag = document.getElementById('materialFileName');
                nameTag.textContent = `الملف الحالي: ${material.fileName}`;
                nameTag.style.display = 'inline-block';
                
                document.getElementById('materialFile').removeAttribute('required');
                
                if (material.fileId) {
                    renderPdfPreviewFromDB(material.fileId, 'materialPreview');
                }
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
            form.dataset.fileId = book.fileId;
            
            if (book.fileName) {
                const nameTag = document.getElementById('bookFileName');
                nameTag.textContent = `الملف الحالي: ${book.fileName}`;
                nameTag.style.display = 'inline-block';
                
                document.getElementById('bookFile').removeAttribute('required');
                
                if (book.fileId) {
                    renderPdfPreviewFromDB(book.fileId, 'bookPreview');
                }
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
            
            await deleteItem(MATERIALS_STORE, id);
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
            
            await deleteItem(BOOKS_STORE, id);
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
    let fileId = this.dataset.fileId || null;
    let fileName = null;
    let thumbnail = null;
    
    try {
        if (editId) {
            const existing = await getItemById(MATERIALS_STORE, editId);
            if (existing) {
                fileId = existing.fileId;
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
            fileId = editId || Date.now().toString();
            fileName = file.name;
            await storeFile(fileId, file);
        } else if (!editId && !fileId) {
            showNotification('الرجاء اختيار ملف PDF');
            return;
        }
        
        const materialData = {
            id: editId || Date.now().toString(),
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
    let fileId = this.dataset.fileId || null;
    let fileName = null;
    let thumbnail = null;
    
    try {
        if (editId) {
            const existing = await getItemById(BOOKS_STORE, editId);
            if (existing) {
                fileId = existing.fileId;
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
            fileId = editId || Date.now().toString();
            fileName = file.name;
            await storeFile(fileId, file);
        } else if (!editId && !fileId) {
            showNotification('الرجاء اختيار ملف PDF');
            return;
        }
        
        const bookData = {
            id: editId || Date.now().toString(),
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


// تصدير البيانات كملف XML
async function exportDataAsXML() {
    try {
        showLoading('جاري تصدير البيانات والملفات...');
        
        // إنشاء المجلد sample-pdfs إذا لم يكن موجودًا بالفعل
        let dirHandle;
        try {
            dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                id: 'educational-materials'
            });
        } catch (error) {
            console.error('خطأ في اختيار المجلد:', error);
            hideLoading();
            alert('يرجى اختيار مجلد لحفظ البيانات والملفات.');
            return;
        }

        // إنشاء مجلد sample-pdfs إذا لم يكن موجودًا
        let pdfsDirHandle;
        try {
            pdfsDirHandle = await dirHandle.getDirectoryHandle('sample-pdfs', { create: true });
        } catch (error) {
            console.error('خطأ في إنشاء مجلد sample-pdfs:', error);
            hideLoading();
            alert('حدث خطأ في إنشاء مجلد sample-pdfs');
            return;
        }

        // جلب البيانات من IndexedDB
        const materials = await getAllItems(MATERIALS_STORE);
        const books = await getAllItems(BOOKS_STORE);

        // إنشاء XML
        const xmlDoc = document.implementation.createDocument(null, 'data', null);
        const root = xmlDoc.documentElement;

        // إضافة قسم المذكرات
        const materialsElem = xmlDoc.createElement('materials');
        root.appendChild(materialsElem);

        for (const material of materials) {
            const materialElem = xmlDoc.createElement('material');
            materialElem.setAttribute('id', material.id);

            // إضافة حقول المذكرة
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

            // حفظ الملف PDF
            if (material.fileId) {
                const fileData = await getFile(material.fileId);
                if (fileData) {
                    const fileName = `${material.id}_${material.fileName}`;
                    addField('file', fileName);

                    // حفظ ملف PDF في مجلد sample-pdfs
                    await savePDFFile(pdfsDirHandle, fileName, fileData.data);
                }
            }

            materialsElem.appendChild(materialElem);
        }

        // إضافة قسم الكتب
        const booksElem = xmlDoc.createElement('books');
        root.appendChild(booksElem);

        for (const book of books) {
            const bookElem = xmlDoc.createElement('book');
            bookElem.setAttribute('id', book.id);

            // إضافة حقول الكتاب
            const addField = (name, value) => {
                const elem = xmlDoc.createElement(name);
                elem.textContent = value || '';
                bookElem.appendChild(elem);
            };

            addField('name', book.name);
            addField('grade', book.grade);
            addField('price', book.price);

            // حفظ الملف PDF
            if (book.fileId) {
                const fileData = await getFile(book.fileId);
                if (fileData) {
                    const fileName = `${book.id}_${book.fileName}`;
                    addField('file', fileName);

                    // حفظ ملف PDF في مجلد sample-pdfs
                    await savePDFFile(pdfsDirHandle, fileName, fileData.data);
                }
            }

            booksElem.appendChild(bookElem);
        }

        // تحويل XML إلى نص
        const serializer = new XMLSerializer();
        const xmlString = serializer.serializeToString(xmlDoc);

        // حفظ ملف XML
        try {
            const xmlHandle = await dirHandle.getFileHandle('data.xml', { create: true });
            const writable = await xmlHandle.createWritable();
            await writable.write(xmlString);
            await writable.close();
            
            hideLoading();
            alert('تم تصدير البيانات والملفات بنجاح');
        } catch (error) {
            console.error('خطأ في حفظ ملف XML:', error);
            hideLoading();
            alert('حدث خطأ في حفظ ملف البيانات XML');
        }
    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);
        hideLoading();
        alert('حدث خطأ أثناء تصدير البيانات');
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
        throw error;
    }
}

// استيراد البيانات من ملف XML
async function importDataFromXML() {
    try {
        showLoading('جاري استيراد البيانات والملفات...');
        
        // اختيار المجلد الذي يحتوي على data.xml
        let dirHandle;
        try {
            dirHandle = await window.showDirectoryPicker({
                id: 'educational-materials'
            });
        } catch (error) {
            console.error('خطأ في اختيار المجلد:', error);
            hideLoading();
            alert('يرجى اختيار المجلد الذي يحتوي على ملفات البيانات');
            return;
        }

        // التحقق من وجود ملف data.xml
        let xmlFileHandle;
        try {
            xmlFileHandle = await dirHandle.getFileHandle('data.xml');
        } catch (error) {
            console.error('خطأ: الملف data.xml غير موجود في المجلد المحدد:', error);
            hideLoading();
            alert('الملف data.xml غير موجود في المجلد المحدد');
            return;
        }

        // التحقق من وجود مجلد sample-pdfs
        let pdfsDirHandle;
        try {
            pdfsDirHandle = await dirHandle.getDirectoryHandle('sample-pdfs');
        } catch (error) {
            console.error('خطأ: مجلد sample-pdfs غير موجود:', error);
            hideLoading();
            alert('مجلد sample-pdfs غير موجود في المجلد المحدد');
            return;
        }

        // قراءة ملف XML
        const file = await xmlFileHandle.getFile();
        const xmlText = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        // مسح قواعد البيانات الحالية
        await clearStore(MATERIALS_STORE);
        await clearStore(BOOKS_STORE);
        await clearStore(FILES_STORE);

        // استيراد المذكرات
        const materialNodes = xmlDoc.querySelectorAll('materials > material');
        for (const materialNode of materialNodes) {
            const id = materialNode.getAttribute('id');
            const getField = (fieldName) => {
                const field = materialNode.querySelector(fieldName);
                return field ? field.textContent : '';
            };

            const material = {
                id: id,
                name: getField('name'),
                school: getField('school'),
                teacher: getField('teacher'),
                grade: getField('grade'),
                sides: getField('sides'),
                price: getField('price'),
                fileName: '',
                fileId: id,
                dateAdded: new Date().toISOString()
            };

            // استيراد ملف PDF المرتبط
            const fileName = getField('file');
            if (fileName) {
                material.fileName = fileName.split('_').slice(1).join('_'); // إزالة معرف الملف من اسم الملف
                
                try {
                    const fileData = await readPDFFile(pdfsDirHandle, fileName);
                    await storeFileData(id, material.fileName, fileData);
                } catch (error) {
                    console.error('خطأ في استيراد ملف PDF للمذكرة:', error);
                }
            }

            await addItem(MATERIALS_STORE, material);
        }

        // استيراد الكتب
        const bookNodes = xmlDoc.querySelectorAll('books > book');
        for (const bookNode of bookNodes) {
            const id = bookNode.getAttribute('id');
            const getField = (fieldName) => {
                const field = bookNode.querySelector(fieldName);
                return field ? field.textContent : '';
            };

            const book = {
                id: id,
                name: getField('name'),
                grade: getField('grade'),
                price: getField('price'),
                fileName: '',
                fileId: id,
                dateAdded: new Date().toISOString()
            };

            // استيراد ملف PDF المرتبط
            const fileName = getField('file');
            if (fileName) {
                book.fileName = fileName.split('_').slice(1).join('_'); // إزالة معرف الملف من اسم الملف
                
                try {
                    const fileData = await readPDFFile(pdfsDirHandle, fileName);
                    await storeFileData(id, book.fileName, fileData);
                } catch (error) {
                    console.error('خطأ في استيراد ملف PDF للكتاب:', error);
                }
            }

            await addItem(BOOKS_STORE, book);
        }

        hideLoading();
        alert('تم استيراد البيانات بنجاح');
        
        // إعادة تحميل الصفحة لعرض البيانات المستوردة
        await loadSavedItems();
    } catch (error) {
        console.error('خطأ في استيراد البيانات:', error);
        hideLoading();
        alert('حدث خطأ أثناء استيراد البيانات');
    }
}

// قراءة ملف PDF
async function readPDFFile(dirHandle, fileName) {
    try {
        const fileHandle = await dirHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        return await file.arrayBuffer();
    } catch (error) {
        console.error('خطأ في قراءة ملف PDF:', error, fileName);
        throw error;
    }
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

// مسح مخزن في IndexedDB
function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
            resolve();
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// تصدير البيانات كملف واحد (ZIP)
async function exportDataAsZip() {
    try {
        showLoading('جاري تصدير البيانات والملفات...');
        
        // تحميل مكتبة JSZip إذا لم تكن محملة بالفعل
        if (typeof JSZip === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        }
        
        // جلب البيانات من IndexedDB
        const materials = await getAllItems(MATERIALS_STORE);
        const books = await getAllItems(BOOKS_STORE);
        
        // إنشاء XML
        const xmlDoc = document.implementation.createDocument(null, 'data', null);
        const root = xmlDoc.documentElement;
        
        // إنشاء JSZip
        const zip = new JSZip();
        
        // إنشاء مجلد sample-pdfs
        const pdfFolder = zip.folder('sample-pdfs');
        
        // إضافة قسم المذكرات
        const materialsElem = xmlDoc.createElement('materials');
        root.appendChild(materialsElem);
        
        for (const material of materials) {
            const materialElem = xmlDoc.createElement('material');
            materialElem.setAttribute('id', material.id);
            
            // إضافة حقول المذكرة
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
            
            // حفظ الملف PDF
            if (material.fileId) {
                const fileData = await getFile(material.fileId);
                if (fileData) {
                    const fileName = `${material.id}_${material.fileName}`;
                    addField('file', fileName);
                    
                    // إضافة PDF إلى ملف الـ ZIP
                    pdfFolder.file(fileName, fileData.data);
                }
            }
            
            materialsElem.appendChild(materialElem);
        }
        
        // إضافة قسم الكتب
        const booksElem = xmlDoc.createElement('books');
        root.appendChild(booksElem);
        
        for (const book of books) {
            const bookElem = xmlDoc.createElement('book');
            bookElem.setAttribute('id', book.id);
            
            // إضافة حقول الكتاب
            const addField = (name, value) => {
                const elem = xmlDoc.createElement(name);
                elem.textContent = value || '';
                bookElem.appendChild(elem);
            };
            
            addField('name', book.name);
            addField('grade', book.grade);
            addField('price', book.price);
            
            // حفظ الملف PDF
            if (book.fileId) {
                const fileData = await getFile(book.fileId);
                if (fileData) {
                    const fileName = `${book.id}_${book.fileName}`;
                    addField('file', fileName);
                    
                    // إضافة PDF إلى ملف الـ ZIP
                    pdfFolder.file(fileName, fileData.data);
                }
            }
            
            booksElem.appendChild(bookElem);
        }
        
        // تحويل XML إلى نص
        const serializer = new XMLSerializer();
        const xmlString = serializer.serializeToString(xmlDoc);
        
        // إضافة ملف XML إلى ZIP
        zip.file('data.xml', xmlString);
        
        // إنشاء ملف ZIP
        const content = await zip.generateAsync({ type: 'blob' });
        
        // تنزيل الملف
        downloadBlob(content, 'educational-materials.zip');
        
        hideLoading();
    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);
        hideLoading();
        alert('حدث خطأ أثناء تصدير البيانات');
    }
}

// استيراد البيانات من ملف ZIP
async function importDataFromZip() {
    try {
        // تحميل مكتبة JSZip إذا لم تكن محملة بالفعل
        if (typeof JSZip === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        }
        
        // إنشاء عنصر إدخال ملف مؤقت
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.zip';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        // إنشاء promise للانتظار حتى يتم اختيار ملف
        const filePromise = new Promise((resolve, reject) => {
            fileInput.onchange = () => {
                if (fileInput.files.length > 0) {
                    resolve(fileInput.files[0]);
                } else {
                    reject(new Error('لم يتم اختيار ملف'));
                }
            };
            
            // إلغاء إذا تم النقر خارج مربع الملفات
            setTimeout(() => {
                if (fileInput.files.length === 0) {
                    reject(new Error('تم إلغاء اختيار الملف'));
                }
            }, 100000); // 100 ثانية كحد أقصى
        });
        
        // فتح مربع حوار اختيار الملف
        fileInput.click();
        
        // انتظار اختيار الملف
        const file = await filePromise;
        
        showLoading('جاري استيراد البيانات والملفات...');
        
        // قراءة ملف ZIP
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        // التحقق من وجود ملف data.xml
        if (!zipContent.files['data.xml']) {
            throw new Error('الملف غير صالح: data.xml غير موجود');
        }
        
        // قراءة ملف XML
        const xmlContent = await zipContent.files['data.xml'].async('text');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        // مسح قواعد البيانات الحالية
        await clearStore(MATERIALS_STORE);
        await clearStore(BOOKS_STORE);
        await clearStore(FILES_STORE);
        
        // استيراد المذكرات
        const materialNodes = xmlDoc.querySelectorAll('materials > material');
        for (const materialNode of materialNodes) {
            const id = materialNode.getAttribute('id');
            const getField = (fieldName) => {
                const field = materialNode.querySelector(fieldName);
                return field ? field.textContent : '';
            };
            
            const material = {
                id: id,
                name: getField('name'),
                school: getField('school'),
                teacher: getField('teacher'),
                grade: getField('grade'),
                sides: getField('sides'),
                price: getField('price'),
                fileName: '',
                fileId: id,
                dateAdded: new Date().toISOString()
            };
            
            // استيراد ملف PDF المرتبط
            const fileName = getField('file');
            if (fileName) {
                material.fileName = fileName.split('_').slice(1).join('_'); // إزالة معرف الملف من اسم الملف
                
                try {
                    // قراءة ملف PDF من الأرشيف
                    const pdfPath = `sample-pdfs/${fileName}`;
                    if (zipContent.files[pdfPath]) {
                        const pdfData = await zipContent.files[pdfPath].async('arraybuffer');
                        await storeFileData(id, material.fileName, pdfData);
                    }
                } catch (error) {
                    console.error('خطأ في استيراد ملف PDF للمذكرة:', error);
                }
            }
            
            await addItem(MATERIALS_STORE, material);
        }
        
        // استيراد الكتب
        const bookNodes = xmlDoc.querySelectorAll('books > book');
        for (const bookNode of bookNodes) {
            const id = bookNode.getAttribute('id');
            const getField = (fieldName) => {
                const field = bookNode.querySelector(fieldName);
                return field ? field.textContent : '';
            };
            
            const book = {
                id: id,
                name: getField('name'),
                grade: getField('grade'),
                price: getField('price'),
                fileName: '',
                fileId: id,
                dateAdded: new Date().toISOString()
            };
            
            // استيراد ملف PDF المرتبط
            const fileName = getField('file');
            if (fileName) {
                book.fileName = fileName.split('_').slice(1).join('_'); // إزالة معرف الملف من اسم الملف
                
                try {
                    // قراءة ملف PDF من الأرشيف
                    const pdfPath = `sample-pdfs/${fileName}`;
                    if (zipContent.files[pdfPath]) {
                        const pdfData = await zipContent.files[pdfPath].async('arraybuffer');
                        await storeFileData(id, book.fileName, pdfData);
                    }
                } catch (error) {
                    console.error('خطأ في استيراد ملف PDF للكتاب:', error);
                }
            }
            
            await addItem(BOOKS_STORE, book);
        }
        
        // حذف عنصر الإدخال المؤقت
        document.body.removeChild(fileInput);
        
        hideLoading();
        alert('تم استيراد البيانات بنجاح');
        
        // إعادة تحميل الصفحة لعرض البيانات المستوردة
        await loadSavedItems();
    } catch (error) {
        console.error('خطأ في استيراد البيانات:', error);
        hideLoading();
        if (error.message === 'تم إلغاء اختيار الملف') {
            // لا شيء - تم إلغاء العملية من قبل المستخدم
        } else {
            alert('حدث خطأ أثناء استيراد البيانات: ' + error.message);
        }
    }
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
