$apiKey = "bbOLCdhIAXmiodAVUTcybpZQMqcA89fkeBx3rYbAKuAiceIlQFiKBOLTyn3c"
$headers = @{ "Authorization" = $apiKey }
$page = 1
$allLeagues = @()
do {
    $url = "https://api.sportmonks.com/v3/football/leagues?page=$page&per_page=50"
    Write-Host "Fetching page $page..."
    try {
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
        if ($response.data) {
            $allLeagues += $response.data
        }
        $hasMore = $response.pagination.has_more
    } catch {
        Write-Host "Error fetching page $page"
        $hasMore = $false
    }
    $page++
} while ($hasMore -eq $true -and $page -le 30)

Write-Host "Total leagues fetched: $($allLeagues.Count)"

$formatted = @()
foreach ($l in $allLeagues) {
    $emoji = "⚽"
    if ($l.name -like "*Cup*" -or $l.name -like "*Trophy*" -or $l.name -like "*Copa*") { $emoji = "🏆" }
    if ($l.sub_type -eq "friendly") { $emoji = "🤝" }
    
    $country = "World"
    if ($l.country -and $l.country.name) {
        $country = $l.country.name
    }
    if ($l.type -eq "cup_international" -or $l.sub_type -eq "cup_international") {
        $country = "International"
    }

    $isCup = ($l.type -eq "cup" -or $l.sub_type -eq "domestic_cup" -or $l.name -like "*Cup*")
    $isInternational = ($l.type -eq "cup_international" -or $l.sub_type -eq "cup_international")

    # Generate a shortName
    $shortName = $l.name
    if ($shortName.Length -gt 15) {
        $shortName = $shortName.Substring(0, 15)
    }

    $item = [PSCustomObject]@{
        id = $l.id
        sportmonksId = $l.id
        name = $l.name
        shortName = $shortName
        country = $country
        emoji = $emoji
        isCup = $isCup
        isInternational = $isInternational
    }
    $formatted += $item
}

$formatted | ConvertTo-Json -Depth 5 | Out-File -FilePath "scratch/all_subscription_leagues.json" -Encoding utf8
Write-Host "Done! Saved to scratch/all_subscription_leagues.json"
