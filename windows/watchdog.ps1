param([Parameter(Mandatory=$true)][string]$Node)
$ErrorActionPreference='Stop'
$Root=Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'host.ps1') -HostAction Library
$Sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$Mutex=[Threading.Mutex]::new($false,('Local\TonutRuntime.'+$Sid))
$Owned=$false
try {
 try {$Owned=$Mutex.WaitOne(0)} catch [Threading.AbandonedMutexException] {$Owned=$true}
 if(-not $Owned) {exit 0}
 while(-not (Test-Path (Join-Path $Root 'stop.request'))) {
  try {
   # After a parent crash, prior children see IPC disconnect; wait for them to leave before starting another tree.
   $Until=(Get-Date).AddSeconds(40)
   while(@(Get-TonutOwnedProcesses $Root | Where-Object {$_.ProcessId -ne $PID}).Count) {
    if((Get-Date) -gt $Until) {throw 'Previous Tonut workers still stopping'}
    if(Test-Path (Join-Path $Root 'stop.request')) {exit 0}
    Start-Sleep -Milliseconds 300
   }
   $Config=Get-Content (Join-Path $Root 'config.json') -Raw|ConvertFrom-Json
   $Config=Resolve-TonutConfig $Config;Write-TonutConfig (Join-Path $Root 'config.json') $Config
   $Info=New-Object Diagnostics.ProcessStartInfo
   $Info.FileName=$Node;$Info.Arguments='"'+(Join-Path $Root 'windows\supervisor.mjs')+'"'
   $Info.RedirectStandardInput=$true;$Info.UseShellExecute=$false;$Info.CreateNoWindow=$true;$Info.WorkingDirectory=$Root
   $Child=[Diagnostics.Process]::Start($Info)
   try {$Child.WaitForExit()} finally {$Child.Dispose()}
  } catch { # Only fixed diagnostics; no executable paths, commands or exception text.
   $Dir=Join-Path $Root 'diagnostics';New-Item $Dir -ItemType Directory -Force|Out-Null
   [IO.File]::WriteAllText((Join-Path $Dir 'watchdog.status.json'),('{"code":"worker_fault","at":'+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+'}'))
  }
  for($I=0;$I -lt 20 -and -not (Test-Path (Join-Path $Root 'stop.request'));$I++) {Start-Sleep -Milliseconds 250}
 }
} finally {if($Owned) {$Mutex.ReleaseMutex()};$Mutex.Dispose()}
