# Local Postgres Dev

## Prereqs
- Docker Desktop installed and running
- `psql` available on PATH (PostgreSQL client)

## Start the Database
```powershell
cd C:\Users\vince\source\repos\ONB1
cp .env.example .env  # edit as needed

docker compose up -d
```

## Run Migration
```powershell
$env:DATABASE_URL = "postgresql://onb1:onb1_dev_password@localhost:5432/onb1"
.\db\migrate.ps1
```

## Run Seed
```powershell
$env:DATABASE_URL = "postgresql://onb1:onb1_dev_password@localhost:5432/onb1"
.\db\seed.ps1
```

## Verify
```powershell
$env:DATABASE_URL = "postgresql://onb1:onb1_dev_password@localhost:5432/onb1"
psql $env:DATABASE_URL -c "\dt"
psql $env:DATABASE_URL -c "SELECT name FROM accounts;"
```
