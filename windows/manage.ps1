param([ValidateSet('Install','Uninstall','Status','Recover','Snapshot','Stop','Start','Restore','Remove')][string]$Action='Status',[string]$AppExe,[string]$CodexCli,[switch]$Internal)
$ErrorActionPreference='Stop'
$Root=Split-Path $PSScriptRoot -Parent
$Dest=Join-Path $env:LOCALAPPDATA 'Tonut'
$TaskName='Tonut'
. (Join-Path $PSScriptRoot 'host.ps1') -HostAction Library
function Stop-Ring {
 if(Test-Path $Dest) {
  [IO.File]::WriteAllText((Join-Path $Dest 'stop.request'),"stop`n")
  $Until=(Get-Date).AddSeconds(45)
  while(@(Get-TonutOwnedProcesses $Dest).Count -or (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue).State -eq 'Running') {if((Get-Date) -gt $Until) {throw 'Owned workers still stopping; no forced termination'};Start-Sleep -Milliseconds 250}
  # A lock file is diagnostic legacy data, never evidence of a live process.
  Remove-Item (Join-Path $Dest 'supervisor.lock') -Force -ErrorAction SilentlyContinue
 }
}
function Start-Ring($Snapshot) {
 if($Snapshot -and -not $Snapshot.active) {return}
 if(-not $Snapshot) {
  $Config=Get-Content (Join-Path $Dest 'config.json') -Raw|ConvertFrom-Json
  $Node=$Config.node
  $Q=[char]34
  $Command=$Q+(Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe')+$Q+' -NoProfile -NonInteractive -File '+$Q+(Join-Path $Dest 'windows\watchdog.ps1')+$Q+' -Node '+$Q+$Node+$Q
  $Line='WScript.Quit CreateObject("WScript.Shell").Run('+$Q+$Command.Replace('"','""')+$Q+', 0, True)'
  [IO.File]::WriteAllText((Join-Path $Dest 'start.vbs'),$Line)
  $User=[Security.Principal.WindowsIdentity]::GetCurrent().Name
  $Trigger=New-ScheduledTaskTrigger -AtLogOn -User $User
  $Principal=New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
  $Start=New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32/wscript.exe') -Argument ('"'+(Join-Path $Dest 'start.vbs')+'"')
  $Settings=New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $TaskName -Action $Start -Trigger $Trigger -Principal $Principal -Settings $Settings -Force|Out-Null
 }
 Remove-Item (Join-Path $Dest 'stop.request') -Force -ErrorAction SilentlyContinue
 Start-ScheduledTask -TaskName $TaskName
}
if($Internal) {
 $Result=$null;$Snapshot=if($env:TONUT_SERVICE_SNAPSHOT) {$env:TONUT_SERVICE_SNAPSHOT|ConvertFrom-Json} else {$null}
 switch($Action) {
  'Snapshot' {$Task=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue;if($Task -and ($Task.Actions.Count -ne 1 -or $Task.Actions[0].Arguments -ne ('"'+(Join-Path $Dest 'start.vbs')+'"'))) {throw 'Conflicting scheduled task'};$Result=@{xml=if($Task) {Export-ScheduledTask -TaskName $TaskName} else {$null};active=(@(Get-TonutOwnedProcesses $Dest).Count -gt 0)}}
  'Stop' {Stop-Ring}
  'Start' {Start-Ring $Snapshot}
  'Restore' {if($Snapshot.xml) {Register-ScheduledTask -TaskName $TaskName -Xml $Snapshot.xml -Force|Out-Null} else {Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue}}
  'Remove' {Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue}
  default {throw 'Invalid internal service operation'}
 }
 ConvertTo-Json -InputObject $Result -Depth 8 -Compress;exit
}
if($Action -eq 'Status') {
 $Items=@(Get-TonutOwnedProcesses $Dest);[pscustomobject]@{Task=(Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue).State;OwnedProcesses=$Items.Count}
 foreach($N in @('agent','startup','supervisor','watchdog')) {$P=Join-Path $Dest ('diagnostics\'+$N+'.status.json');if(Test-Path $P){$S=Get-Content $P -Raw|ConvertFrom-Json;[pscustomobject]@{Component=$N;Code=$S.code;At=$S.at}}};exit
}
if($Action -notin @('Install','Uninstall','Recover')) {throw 'Internal service actions require the installer'}
$Sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$Mutex=[Threading.Mutex]::new($false,('Local\TonutInstall.'+$Sid));$Owned=$false
try {
 try {$Owned=$Mutex.WaitOne(0)} catch [Threading.AbandonedMutexException] {$Owned=$true}
 if(-not $Owned) {throw 'Another Tonut installation is in progress'}
 $Node=(Get-Command node -ErrorAction Stop).Source
 if([int]((& $Node -p 'process.versions.node.split(".")[0]')|Select-Object -Last 1) -lt 24) {throw 'Node24+ required'}
 if($Action -eq 'Install') {
  if($AppExe -and $CodexCli) {$Config=New-TonutConfig $AppExe $CodexCli}
  elseif(Test-Path (Join-Path $Dest 'config.json')) {$Config=Resolve-TonutConfig (Get-Content (Join-Path $Dest 'config.json') -Raw|ConvertFrom-Json)}
  else {throw 'First installation requires official -AppExe and -CodexCli paths'}
  $Config|Add-Member -NotePropertyName node -NotePropertyValue $Node -Force
  $env:TONUT_VALIDATED_CONFIG=$Config|ConvertTo-Json -Depth 8 -Compress
 }
 & $Node (Join-Path $Root 'windows\deploy.mjs') $Action.ToLowerInvariant()
 if($LASTEXITCODE -ne 0) {throw 'Tonut operation failed; rollback receipt retained when recovery is pending'}
 Write-Output ('Tonut '+$Action+' complete. Windows remains beta until on-device lifecycle validation.')
} finally {Remove-Item Env:TONUT_VALIDATED_CONFIG -ErrorAction SilentlyContinue;if($Owned){$Mutex.ReleaseMutex()};$Mutex.Dispose()}
