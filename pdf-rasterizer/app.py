import os
import sys
import time
import uuid
import zipfile
import threading
import json
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_file, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Ensure safe UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from rasterizer import get_pdf_info, rasterize_pdf


app = Flask(__name__)
CORS(app)

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'temp_uploads')
OUTPUT_FOLDER = os.path.join(BASE_DIR, 'temp_outputs')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# In-memory job tracker
JOBS = {}
JOBS_LOCK = threading.Lock()

def cleanup_old_files():
    """Periodically cleans files older than 2 hours."""
    now = time.time()
    for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER]:
        try:
            for fname in os.listdir(folder):
                fpath = os.path.join(folder, fname)
                if os.path.isfile(fpath) and os.stat(fpath).st_mtime < now - 7200:
                    try:
                        os.remove(fpath)
                    except Exception:
                        pass
        except Exception:
            pass

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/system-info', methods=['GET'])
def system_info():
    import fitz
    return jsonify({
        'cpu_count': os.cpu_count() or 4,
        'pymupdf_version': fitz.__version__,
        'default_dpi': 200,
        'status': 'جاهز للعمل بكامل قوة المعالج'
    })

@app.route('/api/upload', methods=['POST'])
def upload_files():
    cleanup_old_files()
    
    if 'files' not in request.files:
        return jsonify({'error': 'لم يتم تحديد أي ملفات'}), 400
        
    uploaded_files = request.files.getlist('files')
    if not uploaded_files or uploaded_files[0].filename == '':
        return jsonify({'error': 'قائمة الملفات فارغة'}), 400
        
    items = []
    
    for file in uploaded_files:
        orig_name = file.filename
        if not orig_name.lower().endswith('.pdf'):
            continue
            
        file_id = str(uuid.uuid4())
        safe_name = secure_filename(orig_name) or f"document_{file_id[:8]}.pdf"
        saved_filename = f"{file_id}_{safe_name}"
        saved_path = os.path.join(UPLOAD_FOLDER, saved_filename)
        
        file.save(saved_path)
        
        # Get PDF info
        info = get_pdf_info(saved_path)
        if not info.get('success'):
            try:
                os.remove(saved_path)
            except Exception:
                pass
            continue
            
        items.append({
            'file_id': file_id,
            'original_name': orig_name,
            'safe_name': safe_name,
            'pages': info['pages'],
            'size': info['size'],
            'dimensions': info.get('dimensions', (0, 0)),
            'saved_path': saved_path
        })
        
    if not items:
        return jsonify({'error': 'لم يتم العثور على ملفات PDF صالحة'}), 400
        
    return jsonify({
        'success': True,
        'count': len(items),
        'files': items
    })

def _process_job_worker(job_id, files_config):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        return
        
    job['status'] = 'processing'
    job['start_time'] = time.time()
    
    total_files = len(files_config)
    
    for idx, f_cfg in enumerate(files_config):
        if job.get('cancelled'):
            job['status'] = 'cancelled'
            break
            
        file_id = f_cfg['file_id']
        dpi = int(f_cfg.get('dpi', 200))
        img_format = f_cfg.get('format', 'jpeg')
        
        # Find file in job list
        target_item = None
        for item in job['files']:
            if item['file_id'] == file_id:
                target_item = item
                break
                
        if not target_item:
            continue
            
        target_item['status'] = 'processing'
        target_item['dpi'] = dpi
        target_item['format'] = img_format
        target_item['current_page'] = 0
        target_item['progress_percent'] = 0
        
        input_path = target_item['saved_path']
        output_filename = f"rasterized_{dpi}dpi_{target_item['safe_name']}"
        output_path = os.path.join(OUTPUT_FOLDER, f"{file_id}_{output_filename}")
        
        def progress_cb(curr, tot, msg):
            target_item['current_page'] = curr
            target_item['total_pages'] = tot
            pct = int((curr / tot) * 100) if tot > 0 else 0
            target_item['progress_percent'] = pct
            target_item['message'] = msg
            
        def cancel_check():
            return job.get('cancelled', False)
            
        try:
            res = rasterize_pdf(
                input_path=input_path,
                output_path=output_path,
                dpi=dpi,
                img_format=img_format,
                progress_callback=progress_cb,
                cancel_check=cancel_check
            )
            
            target_item['status'] = 'completed'
            target_item['output_path'] = output_path
            target_item['output_filename'] = output_filename
            target_item['output_size'] = res['output_size']
            target_item['elapsed_seconds'] = res['elapsed_seconds']
            target_item['pages_per_second'] = res['pages_per_second']
            target_item['progress_percent'] = 100
            target_item['message'] = f"اكتمل في {res['elapsed_seconds']} ثانية ({res['pages_per_second']} صفحة/ثانية)"
            
            with JOBS_LOCK:
                job['completed_files'] += 1
                
        except InterruptedError:
            target_item['status'] = 'cancelled'
            target_item['message'] = 'تم إلغاء التحويل'
            break
        except Exception as err:
            target_item['status'] = 'error'
            target_item['error'] = str(err)
            target_item['message'] = f"خطأ: {str(err)}"
            
    if job['status'] != 'cancelled':
        has_errors = any(f['status'] == 'error' for f in job['files'])
        if has_errors and all(f['status'] == 'error' for f in job['files']):
            job['status'] = 'error'
        else:
            job['status'] = 'completed'
            
    job['end_time'] = time.time()
    job['total_elapsed'] = round(job['end_time'] - job['start_time'], 2)

@app.route('/api/process', methods=['POST'])
def start_processing():
    data = request.get_json() or {}
    files = data.get('files', [])
    
    if not files:
        return jsonify({'error': 'لم يتم تحديد أي ملفات للمعالجة'}), 400
        
    job_id = str(uuid.uuid4())
    
    job_files = []
    for f in files:
        job_files.append({
            'file_id': f['file_id'],
            'original_name': f.get('original_name', 'document.pdf'),
            'safe_name': f.get('safe_name', 'document.pdf'),
            'pages': f.get('pages', 0),
            'size': f.get('size', 0),
            'saved_path': f.get('saved_path'),
            'status': 'queued',
            'progress_percent': 0,
            'current_page': 0,
            'message': 'في الانتظار...'
        })
        
    with JOBS_LOCK:
        JOBS[job_id] = {
            'job_id': job_id,
            'status': 'queued',
            'total_files': len(job_files),
            'completed_files': 0,
            'cancelled': False,
            'files': job_files,
            'created_at': time.time()
        }
        
    # Start thread
    thread = threading.Thread(target=_process_job_worker, args=(job_id, files), daemon=True)
    thread.start()
    
    return jsonify({
        'success': True,
        'job_id': job_id
    })

@app.route('/api/progress/<job_id>', methods=['GET'])
def get_progress(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return jsonify({'error': 'المهمة غير موجودة'}), 404
        return jsonify(job)

@app.route('/api/stream/<job_id>')
def stream_progress(job_id):
    """Server-Sent Events (SSE) stream for real-time progress update."""
    def event_stream():
        while True:
            with JOBS_LOCK:
                job = JOBS.get(job_id)
                if not job:
                    yield f"data: {json.dumps({'error': 'job not found'})}\n\n"
                    break
                
                payload = json.dumps(job)
                yield f"data: {payload}\n\n"
                
                if job['status'] in ('completed', 'error', 'cancelled'):
                    break
                    
            time.sleep(0.25)
            
    return Response(event_stream(), mimetype='text/event-stream')

@app.route('/api/cancel/<job_id>', methods=['POST'])
def cancel_job(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return jsonify({'error': 'المهمة غير موجودة'}), 404
        job['cancelled'] = True
    return jsonify({'success': True, 'message': 'تم إرسال أمر الإلغاء'})

@app.route('/api/download/<file_id>', methods=['GET'])
def download_single(file_id):
    # Search in all jobs for output file
    target = None
    with JOBS_LOCK:
        for j in JOBS.values():
            for f in j['files']:
                if f['file_id'] == file_id and f.get('output_path'):
                    target = f
                    break
            if target:
                break
                
    if not target or not os.path.exists(target['output_path']):
        # Look in output folder
        for fname in os.listdir(OUTPUT_FOLDER):
            if fname.startswith(file_id) and fname.endswith('.pdf'):
                fpath = os.path.join(OUTPUT_FOLDER, fname)
                disp_name = fname[len(file_id)+1:]
                return send_file(fpath, as_attachment=True, download_name=disp_name)
        return jsonify({'error': 'الملف المطلوب غير متوفر أو تم حذفه'}), 404
        
    return send_file(
        target['output_path'],
        as_attachment=True,
        download_name=target['output_filename']
    )

@app.route('/api/download-all/<job_id>', methods=['GET'])
def download_all_zip(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return jsonify({'error': 'المهمة غير موجودة'}), 404
            
    completed_files = [f for f in job['files'] if f['status'] == 'completed' and f.get('output_path') and os.path.exists(f['output_path'])]
    
    if not completed_files:
        return jsonify({'error': 'لا توجد ملفات مكتملة للتحميل'}), 400
        
    zip_path = os.path.join(OUTPUT_FOLDER, f"rasterized_bundle_{job_id[:8]}.zip")
    
    # Fast instant packaging with ZIP_STORED (No CPU re-compression overhead)
    if not os.path.exists(zip_path):
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_STORED) as zipf:
            for f in completed_files:
                zipf.write(f['output_path'], arcname=f['output_filename'])
            
    return send_file(
        zip_path,
        as_attachment=True,
        download_name=f"Rasterized_PDFs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    )


if __name__ == '__main__':
    import multiprocessing as mp
    mp.freeze_support()
    
    port = 5005
    print("=" * 60)
    print("  [*] PDF Rasterizer Engine Running!")
    print(f"  [*] Web Interface: http://127.0.0.1:{port}")
    print(f"  [*] CPU Cores Detected: {os.cpu_count()}")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)


