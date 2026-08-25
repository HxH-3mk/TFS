"""
High-Performance PDF Rasterization Engine (PDF -> Images -> PDF)
Powered by PyMuPDF (fitz) with True Multi-Processing (100% Multi-Core CPU Utilization)
"""

import os
import sys
import time
import math
import fitz  # PyMuPDF
import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor, as_completed

def get_pdf_info(pdf_path):
    """Retrieve metadata and page count of a PDF quickly without loading full document."""
    try:
        doc = fitz.open(pdf_path)
        page_count = doc.page_count
        first_page = doc[0] if page_count > 0 else None
        dimensions = (first_page.rect.width, first_page.rect.height) if first_page else (0, 0)
        doc.close()
        file_size = os.path.getsize(pdf_path)
        return {
            'success': True,
            'pages': page_count,
            'size': file_size,
            'dimensions': dimensions
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

# Top-level standalone worker for multiprocessing (runs in independent Python processes with 0 GIL lock)
def _render_chunk_worker(args):
    """
    Dedicated worker process to render a batch of pages.
    Opens document once per chunk, renders all assigned pages to high-res images at 100% CPU speed.
    """
    pdf_path, page_indices, dpi, img_format = args
    results = []
    doc = None
    fmt = "jpeg" if img_format.lower() in ("jpeg", "jpg") else "png"
    
    try:
        doc = fitz.open(pdf_path)
        for page_num in page_indices:
            page = doc[page_num]
            # Native C++ rendering directly to RGB Pixmap with target DPI
            pix = page.get_pixmap(dpi=dpi, alpha=False, colorspace=fitz.csRGB)
            img_bytes = pix.tobytes(fmt)
            width = page.rect.width
            height = page.rect.height
            results.append((page_num, width, height, img_bytes, None))
    except Exception as exc:
        results.append((-1, 0, 0, None, str(exc)))
    finally:
        if doc is not None:
            doc.close()
            
    return results

def rasterize_pdf(
    input_path,
    output_path,
    dpi=200,
    img_format="jpeg",
    max_workers=None,
    progress_callback=None,
    cancel_check=None
):
    """
    Rasterizes an entire PDF file utilizing 100% of ALL CPU cores:
    - Uses ProcessPoolExecutor to bypass Python GIL completely.
    - Balances page distribution across all CPU cores.
    - Assembles final PDF with exact page sizes, orientation, and resolution.
    
    Args:
        input_path: Path to source PDF.
        output_path: Path to write rasterized output PDF.
        dpi: Dots per inch resolution (default 200).
        img_format: 'jpeg' (fast, compact) or 'png' (lossless).
        max_workers: Number of CPU worker processes (defaults to os.cpu_count()).
        progress_callback: Function called with (completed_pages, total_pages, stage_message).
        cancel_check: Function returning True if job was cancelled.
    """
    t_start = time.time()
    
    if max_workers is None:
        max_workers = os.cpu_count() or 4
        
    doc = fitz.open(input_path)
    total_pages = doc.page_count
    doc.close()
    
    if total_pages == 0:
        raise ValueError("الملف لا يحتوي على أي صفحات.")

    # Calculate optimal chunk size to distribute evenly across all CPU cores
    # We create ~2-4 tasks per core for fine-grained load balancing and smooth progress tracking
    total_workers = min(max_workers, total_pages)
    target_tasks = max(total_workers, min(total_pages, total_workers * 3))
    chunk_size = max(1, math.ceil(total_pages / target_tasks))
    
    chunks = []
    for i in range(0, total_pages, chunk_size):
        chunk_indices = list(range(i, min(i + chunk_size, total_pages)))
        chunks.append((input_path, chunk_indices, dpi, img_format))

    all_rendered_pages = [None] * total_pages
    completed_pages = 0
    
    # ProcessPoolExecutor for true multi-core parallel execution (100% CPU usage)
    ctx = mp.get_context('spawn')
    with ProcessPoolExecutor(max_workers=total_workers, mp_context=ctx) as executor:
        future_to_chunk = {executor.submit(_render_chunk_worker, task): task for task in chunks}
        
        for future in as_completed(future_to_chunk):
            if cancel_check and cancel_check():
                executor.shutdown(wait=False, cancel_futures=True)
                raise InterruptedError("تم إلغاء عملية التحويل بواسطة المستخدم.")
                
            chunk_results = future.result()
            
            for page_num, width, height, img_bytes, error in chunk_results:
                if error:
                    raise RuntimeError(f"خطأ أثناء معالجة الصفحة: {error}")
                if page_num >= 0:
                    all_rendered_pages[page_num] = (width, height, img_bytes)
                    completed_pages += 1
                    
            if progress_callback:
                pct = int((completed_pages / total_pages) * 100)
                progress_callback(completed_pages, total_pages, f"معالجة متوازية: {completed_pages} من {total_pages} صفحة ({pct}%)")

    # Assemble output PDF document
    if progress_callback:
        progress_callback(total_pages, total_pages, "جاري تجميع وضغط ملف الـ PDF النهائي...")

    out_doc = fitz.open()
    for page_num in range(total_pages):
        page_data = all_rendered_pages[page_num]
        if page_data is not None:
            width, height, img_bytes = page_data
            page = out_doc.new_page(width=width, height=height)
            page.insert_image(page.rect, stream=img_bytes)

    out_doc.save(
        output_path,
        deflate=True,
        garbage=3,
        clean=True
    )
    out_doc.close()

    elapsed = time.time() - t_start
    output_size = os.path.getsize(output_path)
    pages_per_sec = round(total_pages / elapsed, 1) if elapsed > 0 else total_pages

    return {
        'success': True,
        'pages': total_pages,
        'dpi': dpi,
        'format': img_format,
        'elapsed_seconds': round(elapsed, 2),
        'pages_per_second': pages_per_sec,
        'output_size': output_size
    }
