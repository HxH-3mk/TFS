/**
 * Google Apps Script - منصة المواد التعليمية (المزامنة السحابية عبر Google Drive)
 * إصدار متطور 2.5: يدعم الملفات الكبيرة حتى 200MB+ والبحث التكراري الذكي
 */

var FOLDER_ID = ""; // ضع معرف مجلد Google Drive هنا (اختياري)

function getTargetFolder() {
  if (FOLDER_ID && FOLDER_ID.trim() !== "") {
    try {
      return DriveApp.getFolderById(FOLDER_ID.trim());
    } catch (e) {
      Logger.log("Folder not found by ID, fallback to auto search");
    }
  }
  
  var folders = DriveApp.getFoldersByName("Educational_Materials_Storage");
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder("Educational_Materials_Storage");
  }
}

function getSubFolder(parentFolder, subName) {
  var subs = parentFolder.getFoldersByName(subName);
  if (subs.hasNext()) {
    return subs.next();
  } else {
    return parentFolder.createFolder(subName);
  }
}

function doGet(e) {
  try {
    var params = e.parameter || {};
    var action = params.action || "getData";
    
    // 1. فحص الاتصال (Ping)
    if (action === "ping") {
      var folder = getTargetFolder();
      return createJsonResponse({
        status: "ok",
        message: "Google Drive Sync API متصل بنجاح!",
        folderName: folder.getName(),
        folderId: folder.getId()
      });
    }
    
    // 2. جلب ملف data.json
    if (action === "getData") {
      var folder = getTargetFolder();
      var jsonFiles = folder.getFilesByName("data.json");
      if (jsonFiles.hasNext()) {
        var jsonFile = jsonFiles.next();
        var content = jsonFile.getBlob().getDataAsString("UTF-8");
        return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
      } else {
        var defaultData = {
          exportDate: new Date().toISOString(),
          version: "2.0",
          materials: [],
          books: []
        };
        return createJsonResponse(defaultData);
      }
    }
    
    // 3. جلب ملف PDF أو رابط تحميله المباشر
    if (action === "getFile" || action === "download" || action === "getFileInfo") {
      var fileId = params.fileId || "";
      var fileName = params.fileName || "";
      var itemId = params.itemId || "";
      var itemName = params.itemName || "";
      
      var foundFile = findPdfFileInDrive(fileId, fileName, itemId, itemName);
      if (foundFile) {
        var driveFileId = foundFile.getId();
        var fileSize = foundFile.getSize();
        
        try {
          foundFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr) {}
        
        var directDownloadUrl = "https://drive.usercontent.google.com/download?id=" + driveFileId + "&export=download&authuser=0&confirm=t";
        var previewUrl = "https://drive.google.com/file/d/" + driveFileId + "/view";
        
        // إذا كان الملف صغيراً والمستخدم طلب base64 (أقل من 20MB)
        if (params.format === "base64" && fileSize < 20 * 1024 * 1024) {
          try {
            var blob = foundFile.getBlob();
            return createJsonResponse({
              status: "ok",
              driveId: driveFileId,
              fileName: foundFile.getName(),
              size: fileSize,
              downloadUrl: directDownloadUrl,
              mimeType: "application/pdf",
              base64: Utilities.base64Encode(blob.getBytes())
            });
          } catch (memErr) {
            // Fallback to direct download url on memory error
          }
        }
        
        // للملفات الكبيرة (حتى 200MB+)
        return createJsonResponse({
          status: "ok",
          driveId: driveFileId,
          fileName: foundFile.getName(),
          size: fileSize,
          downloadUrl: directDownloadUrl,
          previewUrl: previewUrl
        });
      } else {
        return createJsonResponse({
          status: "error",
          message: "الملف غير متوفر في مجلد Google Drive"
        });
      }
    }
    
    // 4. سرد الملفات
    if (action === "listFiles") {
      var folder = getTargetFolder();
      var allFilesList = [];
      collectAllDriveFiles(folder, allFilesList, 0);
      return createJsonResponse({ status: "ok", total: allFilesList.length, files: allFilesList });
    }
    
    // 5. تنظيف المجلد
    if (action === "cleanFolder") {
      var folder = getTargetFolder();
      var files = folder.getFiles();
      while (files.hasNext()) files.next().setTrashed(true);
      var subFolders = folder.getFolders();
      while (subFolders.hasNext()) subFolders.next().setTrashed(true);
      
      getSubFolder(folder, "sample-pdfs");
      var initData = {
        exportDate: new Date().toISOString(),
        version: "2.0",
        materials: [],
        books: []
      };
      folder.createFile("data.json", JSON.stringify(initData, null, 2), "application/json");
      
      return createJsonResponse({
        status: "ok",
        message: "تم تنظيف مجلد Google Drive وإعادة تهيئته بنجاح!"
      });
    }

    return createJsonResponse({ status: "error", message: "إجراء غير معروف: " + action });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

function doPost(e) {
  try {
    var postData = {};
    if (e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        postData = e.parameter || {};
      }
    } else {
      postData = e.parameter || {};
    }
    
    var action = postData.action || "saveData";
    var folder = getTargetFolder();
    
    if (action === "saveData") {
      var dataObj = postData.data;
      if (!dataObj) return createJsonResponse({ status: "error", message: "لا توجد بيانات مرفقة" });
      
      var jsonString = (typeof dataObj === "string") ? dataObj : JSON.stringify(dataObj, null, 2);
      var existing = folder.getFilesByName("data.json");
      while (existing.hasNext()) existing.next().setTrashed(true);
      
      folder.createFile("data.json", jsonString, "application/json");
      return createJsonResponse({ status: "ok", message: "تم تحديث data.json في Google Drive بنجاح!" });
    }
    
    if (action === "uploadPdf") {
      var fileName = postData.fileName;
      var base64Data = postData.base64;
      
      if (!fileName || !base64Data) {
        return createJsonResponse({ status: "error", message: "اسم الملف أو البيانات المرمزة مفقودة" });
      }
      
      var pdfsFolder = getSubFolder(folder, "sample-pdfs");
      var existingPdfs = pdfsFolder.getFilesByName(fileName);
      while (existingPdfs.hasNext()) existingPdfs.next().setTrashed(true);
      
      var decodedBytes = Utilities.base64Decode(base64Data);
      var blob = Utilities.newBlob(decodedBytes, "application/pdf", fileName);
      var newFile = pdfsFolder.createFile(blob);
      try {
        newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {}
      
      return createJsonResponse({
        status: "ok",
        message: "تم رفع الملف إلى Google Drive بنجاح!",
        fileId: newFile.getId(),
        fileName: fileName
      });
    }
    
    return createJsonResponse({ status: "error", message: "إجراء POST غير معروف: " + action });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

function collectAllDriveFiles(folder, list, depth) {
  if (depth > 3) return;
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getName().toLowerCase().indexOf(".pdf") !== -1) {
      list.push(f);
    }
  }
  var subFolders = folder.getFolders();
  while (subFolders.hasNext()) {
    collectAllDriveFiles(subFolders.next(), list, depth + 1);
  }
}

function findPdfFileInDrive(fileId, rawFileName, itemId, itemName) {
  var folder = getTargetFolder();
  var allPdfFiles = [];
  collectAllDriveFiles(folder, allPdfFiles, 0);
  
  if (allPdfFiles.length === 0) return null;
  
  var idsToTry = [fileId, itemId].filter(function(x) { return x && x.toString().trim() !== ""; });
  var namesToTry = [rawFileName, itemName].filter(function(x) { return x && x.toString().trim() !== ""; });
  
  var tokenize = function(str) {
    return (str || "").toLowerCase().replace(/\.pdf$/i, "").split(/[\s_\-\.\(\)\[\]]+/).filter(function(x) { return x && x.length > 1; });
  };
  
  var itemTokens = [];
  namesToTry.forEach(function(n) {
    var t = tokenize(n);
    t.forEach(function(tok) { itemTokens.push(tok); });
  });
  
  // 1. Direct candidates
  var cleanCandidates = [];
  idsToTry.forEach(function(id) {
    namesToTry.forEach(function(name) {
      var nameNoExt = name.replace(/\.pdf$/i, "");
      cleanCandidates.push(id + "_" + name);
      cleanCandidates.push(id + "_" + nameNoExt + ".pdf");
      cleanCandidates.push(id + "-" + nameNoExt + ".pdf");
      cleanCandidates.push(id + "-" + name);
    });
    cleanCandidates.push(id + ".pdf");
  });
  namesToTry.forEach(function(name) {
    var nameNoExt = name.replace(/\.pdf$/i, "");
    cleanCandidates.push(name);
    cleanCandidates.push(nameNoExt + ".pdf");
  });
  
  for (var i = 0; i < allPdfFiles.length; i++) {
    var fName = allPdfFiles[i].getName();
    if (cleanCandidates.indexOf(fName) !== -1) return allPdfFiles[i];
  }
  
  // 2. ID prefix match
  for (var j = 0; j < idsToTry.length; j++) {
    var cleanId = idsToTry[j];
    for (var k = 0; k < allPdfFiles.length; k++) {
      if (allPdfFiles[k].getName().indexOf(cleanId) === 0) return allPdfFiles[k];
    }
  }
  
  // 3. Multi-token scoring match
  var bestFile = null;
  var bestScore = 0;
  for (var m = 0; m < allPdfFiles.length; m++) {
    var fileTokens = tokenize(allPdfFiles[m].getName());
    var score = 0;
    for (var t = 0; t < itemTokens.length; t++) {
      if (fileTokens.indexOf(itemTokens[t]) !== -1 || allPdfFiles[m].getName().toLowerCase().indexOf(itemTokens[t]) !== -1) {
        score++;
      }
    }
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestFile = allPdfFiles[m];
    }
  }
  if (bestFile) return bestFile;
  
  return null;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
