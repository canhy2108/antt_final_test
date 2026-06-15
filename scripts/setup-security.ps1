# PowerShell Script for BudgetBee Security Setup on Windows

# Color output
function Write-Success { Write-Host -ForegroundColor Green $args }
function Write-Error { Write-Host -ForegroundColor Red $args }
function Write-Warning { Write-Host -ForegroundColor Yellow $args }
function Write-Info { Write-Host -ForegroundColor Cyan $args }

Write-Info "================================"
Write-Info "BudgetBee Security Setup"
Write-Info "================================"
Write-Info ""

# Check prerequisites
Write-Info "Checking prerequisites..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed. Please install Docker Desktop for Windows."
    exit 1
}

if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Error "Docker Compose is not installed. Please install Docker Desktop for Windows."
    exit 1
}

Write-Success "✓ Docker and Docker Compose are installed"

# Create SSL directory
Write-Info ""
Write-Info "Creating SSL certificate directory..."
if (-not (Test-Path "docker/nginx/ssl")) {
    New-Item -ItemType Directory -Path "docker/nginx/ssl" -Force | Out-Null
    Write-Success "✓ SSL directory created"
}

# Check if OpenSSL is available (for WSL or Git Bash)
Write-Info ""
Write-Info "Checking for OpenSSL..."
if (Get-Command openssl -ErrorAction SilentlyContinue) {
    Write-Success "✓ OpenSSL is available"
    
    # Generate self-signed certificate
    Write-Info "Generating self-signed SSL certificate..."
    $CertPath = "docker/nginx/ssl"
    $ValidDays = 365
    
    openssl req -x509 -nodes -days $ValidDays `
        -newkey rsa:2048 `
        -keyout "$CertPath/key.pem" `
        -out "$CertPath/cert.pem" `
        -subj "/C=VN/ST=Vietnam/L=Hanoi/O=BudgetBee/CN=localhost"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✓ SSL certificate generated successfully"
    } else {
        Write-Warning "⚠ SSL certificate generation may have failed"
    }
} else {
    Write-Warning "⚠ OpenSSL not found. Using Docker to generate certificates..."
    docker run --rm `
        -v "$((Get-Location).Path)/docker/nginx/ssl:/certs" `
        alpine/openssl req -x509 -nodes -days 365 `
        -newkey rsa:2048 `
        -keyout /certs/key.pem `
        -out /certs/cert.pem `
        -subj "/C=VN/ST=Vietnam/L=Hanoi/O=BudgetBee/CN=localhost"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✓ SSL certificate generated successfully"
    } else {
        Write-Error "✗ Failed to generate SSL certificate"
        exit 1
    }
}

# Create .env file if it doesn't exist
Write-Info ""
Write-Info "Setting up environment configuration..."
if (-not (Test-Path "BudgetBee/.env")) {
    Write-Warning "⚠ Creating .env file from example..."
    Copy-Item "BudgetBee/.env.example.secure" "BudgetBee/.env" -Force
    Write-Info "Please edit BudgetBee/.env with your secure values"
} else {
    Write-Info "✓ .env file already exists"
}

# Generate Laravel APP_KEY
Write-Info ""
Write-Info "Generating Laravel APP_KEY..."
$CurrentLocation = Get-Location
Set-Location "BudgetBee/api"

# Check if .env exists and has APP_KEY
$EnvContent = Get-Content ..\.env
if (-not ($EnvContent -match "^APP_KEY=base64:")) {
    Write-Info "Generating new APP_KEY..."
    docker run --rm `
        -v "$((Get-Location).Path):/app" `
        laravel/laravel:latest `
        php artisan key:generate --env=production
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✓ APP_KEY generated"
    }
}

Set-Location $CurrentLocation

# Update dependencies
Write-Info ""
Write-Info "Updating dependencies..."
Write-Warning "⚠ This may take several minutes..."

Write-Info ""
Write-Info "Updating PHP dependencies..."
Set-Location "BudgetBee/api"
composer update
composer audit

Set-Location $CurrentLocation

Write-Info ""
Write-Info "Updating Node.js dependencies..."
Set-Location "BudgetBee/web"
npm update
npm audit fix

Set-Location $CurrentLocation

# Build and start Docker containers
Write-Info ""
Write-Info "Building Docker images..."
Write-Warning "⚠ This may take several minutes..."

Set-Location "docker"
docker-compose build --no-cache

Set-Location $CurrentLocation

# Display completion summary
Write-Info ""
Write-Success "================================"
Write-Success "Security Setup Complete!"
Write-Success "================================"
Write-Info ""
Write-Info "Next steps:"
Write-Info "1. Edit BudgetBee/.env with secure values"
Write-Info "2. Run: docker-compose -f docker/docker-compose.yml up -d"
Write-Info "3. Test HTTPS: https://localhost"
Write-Info "4. Review SECURITY.md for security features"
Write-Info "5. Review IMPLEMENTATION_GUIDE.md for deployment steps"
Write-Info ""
Write-Success "✓ All security components are now in place!"
