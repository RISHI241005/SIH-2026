from flask import Blueprint, request, jsonify, session
from backend.models.database import db, User, WeatherData, EnergyStats, Alert
from werkzeug.security import generate_password_hash, check_password_hash
import datetime, json

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'data_uploader')
    scale = data.get('scale', 'small')
    
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400
    
    user = User(
        username=username, email=email,
        password=generate_password_hash(password),
        role=role, scale=scale
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "User created successfully", "user": {"id": user.id, "username": user.username, "role": user.role}})

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({"error": "Invalid credentials"}), 401
    
    session['user_id'] = user.id
    session['username'] = user.username
    session['role'] = user.role
    session['scale'] = user.scale
    return jsonify({"message": "Login successful", "user": {"id": user.id, "username": user.username, "role": user.role, "scale": user.scale}})

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})

@auth_bp.route('/me', methods=['GET'])
def me():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": {"id": user.id, "username": user.username, "email": user.email, "role": user.role, "scale": user.scale}})

@auth_bp.route('/check', methods=['GET'])
def check():
    if 'user_id' not in session:
        return jsonify({"authenticated": False}), 200
    return jsonify({"authenticated": True, "user": {"username": session.get('username'), "role": session.get('role'), "scale": session.get('scale')}})
