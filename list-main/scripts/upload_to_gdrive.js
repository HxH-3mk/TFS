/**
 * أداة سريعة لرفع كامل مجلد النسخة الاحتياطية (data.json + كافة ملفات sample-pdfs) إلى Google Drive
 * 
 * طريقة الاستخدام من سطر الأوامر:
 * node upload_to_gdrive.js "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const urlModule = require('url');

const apiUrl = process.argv[2] || process.env.GDRIVE_API_URL;

if (!apiUrl) {
    console.error('الرجاء تمرير رابط Google Apps Script Web App URL.');
    console.error('مثال:');
    console.error('node upload_to_gdrive.js "https://script.google.com/macros/s/.../exec"');
    process.exit(1);
}

const dataDir = path.resolve(__dirname, '../../educational-materials');
const jsonPath = path.join(dataDir, 'data.json');
const pdfsDir = path.join(dataDir, 'sample-pdfs');

if (!fs.existsSync(jsonPath)) {
    console.error('لم يتم العثور على ملف data.json في:', jsonPath);
    process.exit(1);
}

function sendPostRequest(targetUrl, payload) {
    return new Promise((resolve, reject) => {
        const dataStr = JSON.stringify(payload);
        const parsed = urlModule.parse(targetUrl);
        
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(dataStr)
            }
        };

        const req = https.request(options, (res) => {
            // Handle HTTP 302 / 301 redirects (common in Google Apps Script)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return sendPostRequest(res.headers.location, payload).then(resolve).catch(reject);
            }
            
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(body);
                    resolve(parsedData);
                } catch (e) {
                    resolve({ raw: body });
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(dataStr);
        req.end();
    });
}

async function main() {
    console.log('🚀 بدء المزامنة والرفع إلى Google Drive...');
    console.log('🔗 الرابط:', apiUrl);
    
    // 1. قراءة ورفع data.json
    console.log('\n1️⃣ جاري رفع ملف البيانات data.json...');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const dataRes = await sendPostRequest(apiUrl, {
        action: 'saveData',
        data: jsonData
    });
    console.log('✅ نتيجة حفظ البيانات:', dataRes);

    // 2. قراءة ورفع كافة ملفات sample-pdfs
    if (fs.existsSync(pdfsDir)) {
        const files = fs.readdirSync(pdfsDir).filter(f => f.toLowerCase().endsWith('.pdf'));
        console.log(`\n2️⃣ جاري رفع ${files.length} ملف PDF إلى Google Drive...`);
        
        for (let i = 0; i < files.length; i++) {
            const fName = files[i];
            const fPath = path.join(pdfsDir, fName);
            const buf = fs.readFileSync(fPath);
            const base64 = buf.toString('base64');
            const sizeMb = (buf.length / (1024 * 1024)).toFixed(2);
            
            console.log(`[${i+1}/${files.length}] جاري رفع: ${fName} (${sizeMb} MB)...`);
            try {
                const uploadRes = await sendPostRequest(apiUrl, {
                    action: 'uploadPdf',
                    fileName: fName,
                    base64: base64
                });
                console.log(`   ✅ تم الرفع: ${uploadRes.message || 'بنجاح'}`);
            } catch (err) {
                console.error(`   ❌ خطأ في رفع ${fName}:`, err.message);
            }
        }
    }
    
    console.log('\n🎉 اكتملت المزامنة السحابية بالكامل!');
}

main().catch(err => console.error('حدث خطأ:', err));
