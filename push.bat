@echo off
rem Push via bare clone - works around repo-specific git push failure
cd /d "%~dp0"

if not exist d:\code\igo-push-clone.git (
  echo Creating bare clone at d:\code\igo-push-clone.git ...
  git clone --bare d:\toos_dev\impostergameonline d:\code\igo-push-clone.git
  if errorlevel 1 goto err
)

echo [1/2] Sync commits to bare clone...
git -C d:\code\igo-push-clone.git fetch d:\toos_dev\impostergameonline +main:main
if errorlevel 1 goto err

echo [2/2] Push to GitHub over SSH...
git -C d:\code\igo-push-clone.git push git@github.com:xuanxuyin/impostergameonline.git main
if errorlevel 1 goto err

echo.
echo Push OK - Cloudflare Pages will auto-deploy in about a minute
exit /b 0

:err
echo.
echo Push FAILED - see messages above
exit /b 1
