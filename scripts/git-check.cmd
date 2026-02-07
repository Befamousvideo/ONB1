@echo off
setlocal

echo === git status ===
git status

echo.
echo === git rev-parse --short HEAD ===
git rev-parse --short HEAD

echo.
echo === git log --oneline --decorate -n 10 ===
git log --oneline --decorate -n 10

echo.
echo === git push ===
git push

echo.
echo === git status ===
git status

endlocal
