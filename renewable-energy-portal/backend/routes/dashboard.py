from flask import Blueprint, request, jsonify, session
from backend.models.database import db, User, WeatherData, ProductionData, StorageData, TransmissionData, EnergyStats, Alert
from backend.services.weather_service import fetch_weather_api
from backend.ml_models.problem_detector import ProblemDetector
import datetime

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')

@dashboard_bp.route('/stats', methods=['GET'])
def get_stats():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    stats = EnergyStats.query.order_by(EnergyStats.date.desc()).first()
    if not stats:
        stats = EnergyStats()
    
    problems = db.session.query(db.func.count(Problem.id)).filter_by(status='pending').scalar()
    alerts = Alert.query.filter_by(is_read=False).count()
    
    total_produced = ProductionData.query.filter_by(data_date=datetime.date.today()).with_entities(db.func.sum(ProductionData.energy_produced_kw)).scalar() or 0
    total_stored = StorageData.query.filter_by(data_date=datetime.date.today()).with_entities(db.func.sum(StorageData.stored_energy_kw)).scalar() or 0
    total_distributed = TransmissionData.query.filter_by(data_date=datetime.date.today()).with_entities(db.func.sum(TransmissionData.energy_sent_kw)).scalar() or 0
    
    solar = ProductionData.query.filter_by(source_type='solar', data_date=datetime.date.today()).with_entities(db.func.sum(ProductionData.energy_produced_kw)).scalar() or 0
    wind = ProductionData.query.filter_by(source_type='wind', data_date=datetime.date.today()).with_entities(db.func.sum(ProductionData.energy_produced_kw)).scalar() or 0
    hydro = ProductionData.query.filter_by(source_type='hydro', data_date=datetime.date.today()).with_entities(db.func.sum(ProductionData.energy_produced_kw)).scalar() or 0
    
    return jsonify({
        "total_produced_kw": total_produced,
        "total_stored_kw": total_stored,
        "total_distributed_kw": total_distributed,
        "solar_produced": solar,
        "wind_produced": wind,
        "hydro_produced": hydro,
        "pending_problems": problems or 0,
        "unread_alerts": alerts,
        "emergency_reserved": stats.emergency_reserved_kw,
        "consumption": 23,
        "shortage": max(0, 23 - total_distributed),
        "theft_detected": stats.theft_detected,
        "daily_production_data": get_daily_production_breakdown(),
        "storage_data": get_storage_breakdown(),
        "distribution_data": get_distribution_breakdown()
    })

def get_daily_production_breakdown():
    today = datetime.date.today()
    sources = ['solar', 'wind', 'hydro']
    result = {}
    for s in sources:
        data = ProductionData.query.filter_by(source_type=s, data_date=today).all()
        result[s] = {"produced_kw": sum(d.energy_produced_kw for d in data), "hours": sum(d.hours_operational for d in data)}
    return result

def get_storage_breakdown():
    today = datetime.date.today()
    data = StorageData.query.filter_by(data_date=today).all()
    return {
        "stored": sum(d.stored_energy_kw for d in data),
        "emergency": sum(d.emergency_stored_kw for d in data),
        "battery_health_avg": sum(d.battery_health for d in data) / len(data) if data else 100
    }

def get_distribution_breakdown():
    today = datetime.date.today()
    data = TransmissionData.query.filter_by(data_date=today).all()
    return {
        "total_sent": sum(d.energy_sent_kw for d in data),
        "destinations": list(set(d.destination for d in data))
    }

from backend.models.database import Problem

@dashboard_bp.route('/alerts', methods=['GET'])
def get_alerts():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    alerts = Alert.query.order_by(Alert.created_at.desc()).all()
    return jsonify([{"id": a.id, "title": a.title, "message": a.message, "alert_type": a.alert_type, "requires_action": a.requires_action, "is_read": a.is_read, "created_at": a.created_at.isoformat()} for a in alerts])

@dashboard_bp.route('/alerts/<int:id>/read', methods=['POST'])
def mark_alert_read(id):
    alert = Alert.query.get(id)
    if alert:
        alert.is_read = True
        db.session.commit()
    return jsonify({"message": "Alert marked as read"})

@dashboard_bp.route('/problems', methods=['GET'])
def get_problems():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    source = request.args.get('source')
    query = Problem.query
    if source:
        query = query.filter_by(source_type=source)
    problems = query.order_by(Problem.created_at.desc()).all()
    return jsonify([{
        "id": p.id, "source_type": p.source_type, "stage": p.stage,
        "title": p.title, "description": p.description, "severity": p.severity,
        "status": p.status, "ai_solution": p.ai_solution, "ai_confidence": p.ai_confidence,
        "past_occurrences": p.past_occurrences, "admin_approved": p.admin_approved,
        "resolved": p.resolved, "created_at": p.created_at.isoformat()
    } for p in problems])

@dashboard_bp.route('/problems/<int:id>/approve', methods=['POST'])
def approve_problem(id):
    prob = Problem.query.get(id)
    if prob:
        prob.admin_approved = True
        prob.status = 'approved'
        db.session.commit()
    return jsonify({"message": "Problem approved"})

@dashboard_bp.route('/problems/<int:id>/reject', methods=['POST'])
def reject_problem(id):
    prob = Problem.query.get(id)
    if prob:
        prob.admin_rejected = True
        prob.status = 'rejected'
        db.session.commit()
    return jsonify({"message": "Problem rejected"})

@dashboard_bp.route('/problems/<int:id>/custom-solution', methods=['POST'])
def custom_solution(id):
    data = request.json
    prob = Problem.query.get(id)
    if prob:
        prob.admin_solution = data.get('solution')
        prob.status = 'custom'
        prob.admin_approved = True
        db.session.commit()
    return jsonify({"message": "Custom solution submitted"})
