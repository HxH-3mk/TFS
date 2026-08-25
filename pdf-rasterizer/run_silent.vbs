' Silent Background Launcher for PDF Rasterizer Pro
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

' Run python server completely hidden without black console window
WshShell.CurrentDirectory = strPath
WshShell.Run "python app.py", 0, False

' Wait 1.5 seconds then open browser
WScript.Sleep 1500
WshShell.Run "http://127.0.0.1:5005"
