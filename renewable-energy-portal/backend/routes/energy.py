from flask import Blueprint, request, jsonify, session
from backend.models.database import db, WeatherData, ProductionData, StorageData, TransmissionData
from backend.services.weather_service import fetch_weather_api
from backend.ml_models.problem_detector import ProblemDetector
import datetime

energy_bp = Blueprint('energy', __name__, url_prefix='/api/energy')

@energy_bp.route('/forecast', methods=['GET'])
def get_forecast():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    city = request.args.get('city', 'Kolkata')
    weather = WeatherData.query.filter_by(city=city, forecast_type='future').order_by(WeatherData.data_date.desc()).all()
    result = []
    for w in weather:
        result.append({
            "city": w.city, "temperature": w.temperature, "humidity": w.humidity,
            "wind_speed": w.wind_speed, "solar_radiation": w.solar_radiation,
            "precipitation": w.precipitation, "data_date": w.data_date.isoformat()
        })
    api_weather = fetch_weather_api(city)
    return jsonify({"historical": result, "api_forecast": api_weather})

@energy_bp.route('/production', methods=['GET'])
def get_production():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    source = request.args.get('source')
    date = request.args.get('date')
    query = ProductionData.query
    if source:
        query = query.filter_by(source_type=source)
    if date:
        query = query.filter_by(data_date=datetime.datetime.strptime(date, '%Y-%m-%d').date())
    data = query.order_by(ProductionData.data_date.desc()).all()
    return jsonify([{
        "id": d.id, "source_type": d.source_type, "energy_produced_kw": d.energy_produced_kw,
        "hours_operational": d.hours_operational, "equipment_status": d.equipment_status,
        "data_date": d.data_date.isoformat()
    } for d in data])

@energy_bp.route('/production', methods=['POST'])
def add_production():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.json
    prod = ProductionData(
        source_type=data['source_type'],
        energy_produced_kw=data['energy_produced_kw'],
        hours_operational=data['hours_operational'],
        equipment_status=data.get('equipment_status', 'normal'),
        uploaded_by=session.get('username')
    )
    db.session.add(prod)
    update_energy_stats()
    db.session.commit()
    return jsonify({"message": "Production data uploaded", "id": prod.id})

@energy_bp.route('/storage', methods=['GET'])
def get_storage():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    source = request.args.get('source')
    query = StorageData.query
    if source:
        query = query.filter_by(source_type=source)
    data = query.order_by(StorageData.data_date.desc()).all()
    return jsonify([{
        "id": d.id, "source_type": d.source_type, "stored_energy_kw": d.stored_energy_kw,
        "emergency_stored_kw": d.emergency_stored_kw, "total_received_kw": d.total_received_kw,
        "battery_charge_count": d.battery_charge_count, "battery_discharge_count": d.battery_discharge_count,
        "energy_sent_kw": d.energy_sent_kw, "battery_health": d.battery_health,
        "data_date": d.data_date.isoformat()
    } for d in data])

@energy_bp.route('/storage', methods=['POST'])
def add_storage():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.json
    store = StorageData(
        source_type=data['source_type'],
        stored_energy_kw=data['stored_energy_kw'],
        emergency_stored_kw=data['emergency_stored_kw'],
        total_received_kw=data['total_received_kw'],
        battery_charge_count=data.get('battery_charge_count', 0),
        battery_discharge_count=data.get('battery_discharge_count', 0),
        energy_sent_kw=data['energy_sent_kw'],
        battery_health=data.get('battery_health', 100.0),
        uploaded_by=session.get('username')
    )
    db.session.add(store)
    update_energy_stats()
    db.session.commit()
    return jsonify({"message": "Storage data uploaded", "id": store.id})

@energy_bp.route('/transmission', methods=['GET'])
def get_transmission():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    data = TransmissionData.query.order_by(TransmissionData.data_date.desc()).all()
    return jsonify([{
        "id": d.id, "destination": d.destination, "energy_sent_kw": d.energy_sent_kw,
        "source_type": d.source_type, "data_date": d.data_date.isoformat()
    } for d in data])

@energy_bp.route('/transmission', methods=['POST'])
def add_transmission():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.json
    trans = TransmissionData(
        destination=data['destination'],
        energy_sent_kw=data['energy_sent_kw'],
        source_type=data['source_type'],
        uploaded_by=session.get('username')
    )
    db.session.add(trans)
    update_energy_stats()
    db.session.commit()
    return jsonify({"message": "Transmission data uploaded", "id": trans.id})

@energy_bp.route('/flow', methods=['GET'])
def get_flow():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    source = request.args.get('source', 'solar')
    pd = ProblemDetector()
    prod_data = ProductionData.query.filter_by(source_type=source).order_by(ProductionData.data_date.desc()).limit(7).all()
    storage_data = StorageData.query.filter_by(source_type=source).order_by(StorageData.data_date.desc()).limit(7).all()
    trans_data = TransmissionData.query.filter_by(source_type=source).order_by(TransmissionData.data_date.desc()).limit(7).all()
    
    problems = Problem.query.filter_by(source_type=source).order_by(Problem.created_at.desc()).all()
    health = pd.calculate_health(source, prod_data, storage_data, trans_data)
    
    return jsonify({
        "source": source,
        "production": [{"date": d.data_date.isoformat(), "kw": d.energy_produced_kw} for d in prod_data],
        "storage": [{"date": d.data_date.isoformat(), "kw": d.stored_energy_kw, "health": d.battery_health} for d in storage_data],
        "distribution": [{"date": d.data_date.isoformat(), "kw": d.energy_sent_kw} for d in trans_data],
        "problems": [{"id": p.id, "title": p.title, "stage": p.stage, "severity": p.severity, "status": p.status} for p in problems],
        "health_score": health
    })

def update_energy_stats():
    today = datetime.date.today()
    existing = EnergyStats.query.filter_by(date=today).first()
    if not existing:
        existing = EnergyStats(date=today)
        db.session.add(existing)
    
    total_prod = ProductionData.query.filter_by(data_date=today).with_entities(db.func.sum(ProductionData.energy_produced_kw)).scalar() or 0
    total_stored = StorageData.query.filter_by(data_date=today).with_entities(db.func.sum(StorageData.stored_energy_kw)).scalar() or 0
    total_dist = TransmissionData.query.filter_by(data_date=today).with_entities(db.func.sum(TransmissionData.energy_sent_kw)).scalar() or 0
    emergency = StorageData.query.filter_by(data_date=today).with_entities(db.func.sum(StorageData.emergency_stored_kw)).scalar() or 0
    
    existing.total_produced_kw = total_prod
    existing.total_stored_kw = total_stored
    existing.total_distributed_kw = total_dist
    existing.emergency_reserved_kw = emergency
    existing.solar_produced = ProductionData.query.filter_by(source_type='solar', data_date=today).with_entities(db.func.sum(ProductionData.energy_produced_kw)).scalar() or 0
    existing.wind_produced = ProductionData.query.filter_by(source_type='wind', data_date=today).with_entities(db.func.sum(ProductionData.energy_produced_kw)).scalar() or 0
    existing.hydro_produced = ProductionData.query.filter_by(source_type='hydro', data_date=today).with_entities(db.func.sum(ProductionData.energy_produced_kw)).scalar() or 0
    existing.theft_detected = detect_theft(total_prod, total_dist, total_stored)
    db.session.commit()

def detect_theft(produced, distributed, stored):
    expected = distributed
    diff = produced - distributed - stored
    return abs(diff) > 2.0
