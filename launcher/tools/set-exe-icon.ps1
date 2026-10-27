#Requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory)][string]$Exe,[string]$Ico,[string]$Png)
$ErrorActionPreference='Stop'
if (-not $Ico -and $Png) { $Ico=Join-Path (Split-Path -Parent $Png) 'icon.ico' }
if (-not (Test-Path -LiteralPath $Exe -PathType Leaf)) { throw 'Executable introuvable' }
if (-not $Ico -or -not (Test-Path -LiteralPath $Ico -PathType Leaf)) { throw 'Fichier ICO multiresolution requis' }
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class XrnPEIcons {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="BeginUpdateResourceW")] static extern IntPtr Begin(string file,bool deleteExisting);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="UpdateResourceW")] static extern bool Number(IntPtr h,IntPtr type,IntPtr name,ushort lang,byte[] data,uint size);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="UpdateResourceW")] static extern bool Named(IntPtr h,IntPtr type,string name,ushort lang,byte[] data,uint size);
 [DllImport("kernel32.dll",SetLastError=true,EntryPoint="EndUpdateResourceW")] static extern bool Finish(IntPtr h,bool discard);
 static void Check(bool ok) { if(!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
 public static void Write(string exe,string ico) {
  byte[] bytes=File.ReadAllBytes(ico);
  if(bytes.Length<6 || BitConverter.ToUInt16(bytes,2)!=1) throw new InvalidDataException("ICO invalide");
  int count=BitConverter.ToUInt16(bytes,4);
  if(count<7 || 6+16*count>bytes.Length) throw new InvalidDataException("ICO incomplet");
  byte[][] blobs=new byte[count][];
  byte[] group;
  using(MemoryStream stream=new MemoryStream()) {
   using(BinaryWriter writer=new BinaryWriter(stream)) {
    writer.Write((ushort)0);writer.Write((ushort)1);writer.Write((ushort)count);
    for(int i=0;i<count;i++) {
     int entry=6+16*i;
     int size=checked((int)BitConverter.ToUInt32(bytes,entry+8));
     int offset=checked((int)BitConverter.ToUInt32(bytes,entry+12));
     if(offset<0 || size<0 || (long)offset+size>bytes.Length) throw new InvalidDataException("ICO hors fichier");
     blobs[i]=new byte[size];Buffer.BlockCopy(bytes,offset,blobs[i],0,size);
     writer.Write(bytes,entry,8);writer.Write((uint)size);writer.Write((ushort)(50000+i));
    }
    writer.Flush();group=stream.ToArray();
   }
  }
  IntPtr handle=Begin(exe,false);
  if(handle==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
  try {
   foreach(ushort language in new ushort[]{0,1033}) {
    for(int i=0;i<count;i++) Check(Number(handle,new IntPtr(3),new IntPtr(50000+i),language,blobs[i],(uint)blobs[i].Length));
    foreach(string name in new string[]{"IDR_MAINFRAME","IDR_X001_APP_LIST"}) Check(Named(handle,new IntPtr(14),name,language,group,(uint)group.Length));
    Check(Number(handle,new IntPtr(14),new IntPtr(1),language,group,(uint)group.Length));
   }
   bool success=Finish(handle,false);handle=IntPtr.Zero;Check(success);
  } finally { if(handle!=IntPtr.Zero) Finish(handle,true); }
 }
}
'@
[XrnPEIcons]::Write((Resolve-Path -LiteralPath $Exe).Path,(Resolve-Path -LiteralPath $Ico).Path)
Write-Output 'Icones multiresolution integrees aux groupes principaux de l executable.'
