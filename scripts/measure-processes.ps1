param([int]$RootProcess)
$ErrorActionPreference = 'Stop'
$allProcesses = Get-CimInstance Win32_Process
$processIds = [Collections.Generic.HashSet[int]]::new()
[void]$processIds.Add($RootProcess)
do {
    $changed = $false
    foreach ($process in $allProcesses) {
        if ($processIds.Contains([int]$process.ParentProcessId) -and $processIds.Add([int]$process.ProcessId)) { $changed = $true }
    }
} while ($changed)
$rows = @(foreach ($process in $allProcesses) {
    if ($processIds.Contains([int]$process.ProcessId)) {
        $sample = Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
        if ($sample) { [pscustomobject]@{ name=$sample.ProcessName; workingSetBytes=$sample.WorkingSet64; privateCommitBytes=$sample.PrivateMemorySize64; cpuSeconds=$sample.TotalProcessorTime.TotalSeconds } }
    }
})
[pscustomobject]@{
    workingSetBytes=($rows | Measure-Object workingSetBytes -Sum).Sum
    privateCommitBytes=($rows | Measure-Object privateCommitBytes -Sum).Sum
    cpuSeconds=($rows | Measure-Object cpuSeconds -Sum).Sum
    processes=$rows
} | ConvertTo-Json -Depth 3 -Compress
