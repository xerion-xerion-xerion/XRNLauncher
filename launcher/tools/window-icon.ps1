param([Parameter(Mandatory)][string]$Exe,[Parameter(Mandatory)][string]$Icon)
$ErrorActionPreference='Stop'
$resolvedExe=(Resolve-Path -LiteralPath $Exe).Path
$resolvedIcon=(Resolve-Path -LiteralPath $Icon).Path
if([IO.Path]::GetFileName($resolvedExe) -ne 'XRNLauncher.exe' -or [IO.Path]::GetExtension($resolvedIcon) -ne '.ico'){throw 'Invalid XRN icon target'}
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;using System.Collections.Generic;
public static class XrnWindowIcon {
 delegate bool EnumProc(IntPtr h,IntPtr p);
 [DllImport("user32.dll")]static extern bool EnumWindows(EnumProc p,IntPtr l);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint id);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr LoadImage(IntPtr h,string path,uint type,int w,int he,uint flags);
 [DllImport("user32.dll")]static extern IntPtr SendMessage(IntPtr h,uint msg,IntPtr wp,IntPtr lp);
 [DllImport("shell32.dll")]static extern int SHGetPropertyStoreForWindow(IntPtr h,ref Guid iid,[MarshalAs(UnmanagedType.Interface)]out IPropertyStore store);
 [ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IPropertyStore {
  void GetCount(out uint count);void GetAt(uint i,out Key key);void GetValue(ref Key key,out Variant value);void SetValue(ref Key key,ref Variant value);void Commit();
 }
 [StructLayout(LayoutKind.Sequential)]struct Key{public Guid fmtid;public uint pid;public Key(uint p){fmtid=new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");pid=p;}}
 [StructLayout(LayoutKind.Explicit,Size=24)]struct Variant{[FieldOffset(0)]public ushort vt;[FieldOffset(8)]public IntPtr ptr;}
 static void Set(IPropertyStore store,uint id,string text){var key=new Key(id);var value=new Variant{vt=31,ptr=Marshal.StringToCoTaskMemUni(text)};try{store.SetValue(ref key,ref value);}finally{Marshal.FreeCoTaskMem(value.ptr);}}
 public static int Apply(int[] processes,string icon,string exe){var ids=new HashSet<int>(processes);int count=0;
  EnumWindows((h,p)=>{uint pid;GetWindowThreadProcessId(h,out pid);if(!ids.Contains((int)pid)||!IsWindowVisible(h))return true;try{Guid iid=new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");IPropertyStore store;if(SHGetPropertyStoreForWindow(h,ref iid,out store)==0){Set(store,5,"XRNLauncher.Client");Set(store,2,"\""+exe+"\"");Set(store,3,icon+",0");Set(store,4,"XRN Launcher");store.Commit();var key=new Key(5);Variant value;store.GetValue(ref key,out value);if(value.vt==31&&Marshal.PtrToStringUni(value.ptr)=="XRNLauncher.Client")count++;Marshal.FreeCoTaskMem(value.ptr);Marshal.ReleaseComObject(store);}}catch{}return true;},IntPtr.Zero);return count;
 }
}
'@
for($attempt=0;$attempt -lt 8;$attempt++){
 $xrnProcesses=@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $resolvedExe} | Select-Object -ExpandProperty ProcessId)
 if($xrnProcesses.Count -gt 0){$count=[XrnWindowIcon]::Apply([int[]]$xrnProcesses,$resolvedIcon,$resolvedExe);if($count -gt 0){Write-Output ('XRN window icons applied: '+$count);break}}
 Start-Sleep -Milliseconds 300
}
# Repair only XRN shortcuts targeting this exact executable; retain their arguments and position.
$xrnShortcutRoots=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'),(Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'))
$xrnShell=New-Object -ComObject WScript.Shell
$xrnFixed=0
foreach($xrnShortcutRoot in $xrnShortcutRoots){
 if(-not(Test-Path -LiteralPath $xrnShortcutRoot -PathType Container)){continue}
 foreach($xrnShortcutFile in (Get-ChildItem -LiteralPath $xrnShortcutRoot -Filter '*.lnk' -File -ErrorAction SilentlyContinue)){
  try{
   $xrnLink=$xrnShell.CreateShortcut($xrnShortcutFile.FullName)
   if(-not [StringComparer]::OrdinalIgnoreCase.Equals($xrnLink.TargetPath,$resolvedExe)){continue}
   $xrnIconLocation=$resolvedIcon+',0'
   if($xrnLink.IconLocation -eq $xrnIconLocation){continue}
   $xrnBackup=Join-Path $env:APPDATA 'XRNLauncher\logs\icon-shortcuts'
   New-Item -ItemType Directory -Path $xrnBackup -Force | Out-Null
   $xrnHash=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($xrnShortcutFile.FullName))).Replace('-','').Substring(0,16)
   $xrnBackupFile=Join-Path $xrnBackup ($xrnHash+'.lnk')
   if(-not(Test-Path -LiteralPath $xrnBackupFile)){Copy-Item -LiteralPath $xrnShortcutFile.FullName -Destination $xrnBackupFile}
   $xrnLink.IconLocation=$xrnIconLocation;$xrnLink.Save();$xrnFixed++
  }catch{}
 }
}
Write-Output ('XRN shortcut icons refreshed: '+$xrnFixed)
