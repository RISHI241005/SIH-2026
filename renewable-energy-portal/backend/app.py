import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, request, session, redirect, url_for, render_template_string, send_from_directory
from flask_cors import CORS
import os as _os, json, datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

app = Flask(__name__, 
            template_folder='templates',
            static_folder=FRONTEND_DIR,
            static_url_path='/static')
app.config['SECRET_KEY'] = 'renewable-energy-portal-secret-key-2024'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(BASE_DIR, 'database', 'energy.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
CORS(app, supports_credentials=True, origins=['*'])

from backend.models.database import db, init_db
from backend.routes.auth import auth_bp
from backend.routes.dashboard import dashboard_bp
from backend.routes.energy import energy_bp
from backend.routes.weather import weather_bp
from backend.routes.ai import ai_bp
from backend.routes.uploader import uploader_bp
from backend.routes.admin import admin_bp

db.init_app(app)

app.register_blueprint(auth_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(energy_bp)
app.register_blueprint(weather_bp)
app.register_blueprint(ai_bp)
app.register_blueprint(uploader_bp)
app.register_blueprint(admin_bp)

@app.route('/')
def home():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/login')
def login_page():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'login.html')

@app.route('/admin')
def admin_page():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'admin_dashboard.html')

@app.route('/energy-tracking')
def energy_page():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'energy_tracking.html')

@app.route('/ai-desk')
def ai_page():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'ai_desk.html')

@app.route('/forecasts')
def forecasts_page():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'forecasts.html')

@app.route('/approvals')
def approvals_page():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'approvals.html')

@app.route('/feedback')
def feedback_page():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'feedback.html')

@app.route('/complaints')
def complaints_page():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'complaints.html')

@app.route('/loading')
def loading_page():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'pages'), 'loading.html')

@app.route('/api/test')
def test():
    return jsonify({"status": "ok", "message": "Renewable Energy Portal API is running"})

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
