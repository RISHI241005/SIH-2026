@echo off
cd /d "%~dp0"
echo Starting Renewable Energy Portal...
echo ====================================
python -m pip install flask flask-cors flask-sqlalchemy scikit-learn pandas numpy requests --quiet 2>nul
echo.
echo Starting backend server on port 5000...
python backend/app.py
