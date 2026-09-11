from flask import Blueprint, request, jsonify, session
from backend.models.database import db, Problem, Feedback, Complaint, Alert, User
import datetime

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@admin_bp.route('/problems/<int:id>/approve', methods=['POST'])
def approve_problem(id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Admin access required"}), 403
    prob = Problem.query.get(id)
    if prob:
        prob.admin_approved = True
        prob.status = 'approved'
        db.session.commit()
    return jsonify({"message": "Problem approved"})

@admin_bp.route('/problems/<int:id>/reject', methods=['POST'])
def reject_problem(id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Admin access required"}), 403
    prob = Problem.query.get(id)
    if prob:
        prob.admin_rejected = True
        prob.status = 'rejected'
        db.session.commit()
    return jsonify({"message": "Problem rejected"})

@admin_bp.route('/problems/<int:id>/custom-solution', methods=['POST'])
def custom_solution(id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Admin access required"}), 403
    data = request.json
    prob = Problem.query.get(id)
    if prob:
        prob.admin_solution = data.get('solution', '')
        prob.status = 'custom'
        prob.admin_approved = True
        db.session.commit()
    return jsonify({"message": "Custom solution submitted"})

@admin_bp.route('/feedback', methods=['POST'])
def submit_feedback():
    data = request.json
    fb = Feedback(
        username=data.get('username', session.get('username', 'anonymous')),
        category=data.get('category', 'general'),
        rating=data.get('rating', 5),
        comment=data.get('comment', '')
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify({"message": "Feedback submitted"})

@admin_bp.route('/feedback', methods=['GET'])
def get_feedback():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Admin access required"}), 403
    fb = Feedback.query.order_by(Feedback.created_at.desc()).all()
    return jsonify([{"id": f.id, "username": f.username, "category": f.category, "rating": f.rating, "comment": f.comment, "created_at": f.created_at.isoformat()} for f in fb])

@admin_bp.route('/complaints', methods=['POST'])
def submit_complaint():
    data = request.json
    c = Complaint(
        username=data.get('username', session.get('username', 'anonymous')),
        area=data.get('area', 'general'),
        description=data.get('description', '')
    )
    db.session.add(c)
    db.session.commit()
    return jsonify({"message": "Complaint filed", "id": c.id})

@admin_bp.route('/complaints', methods=['GET'])
def get_complaints():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Admin access required"}), 403
    complaints = Complaint.query.order_by(Complaint.created_at.desc()).all()
    return jsonify([{"id": c.id, "username": c.username, "area": c.area, "description": c.description, "status": c.status, "created_at": c.created_at.isoformat()} for c in complaints])

@admin_bp.route('/complaints/<int:id>/status', methods=['POST'])
def update_complaint_status(id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Admin access required"}), 403
    c = Complaint.query.get(id)
    if c:
        c.status = request.json.get('status', 'resolved')
        db.session.commit()
    return jsonify({"message": "Complaint status updated"})

@admin_bp.route('/overview', methods=['GET'])
def admin_overview():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({"error": "Admin access required"}), 403
    from backend.models.database import EnergyStats, ProductionData, StorageData, TransmissionData
    today = datetime.date.today()
    stats = EnergyStats.query.filter_by(date=today).first() or EnergyStats(date=today)
    return jsonify({
        "total_produced": stats.total_produced_kw,
        "total_stored": stats.total_stored_kw,
        "total_distributed": stats.total_distributed_kw,
        "solar": stats.solar_produced,
        "wind": stats.wind_produced,
        "hydro": stats.hydro_produced,
        "pending_problems": Problem.query.filter_by(status='pending').count(),
        "unresolved_complaints": Complaint.query.filter_by(status='pending').count(),
        "total_users": User.query.count() if 'User' in dir() else 0,
        "alerts": Alert.query.filter_by(is_read=False).count()
    })
