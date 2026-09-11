from flask import Blueprint, request, jsonify, session
from backend.models.database import db, WeatherData, ProductionData, StorageData, TransmissionData
import datetime

uploader_bp = Blueprint('uploader', __name__, url_prefix='/api/uploader')

@uploader_bp.route('/weather', methods=['POST'])
def upload_weather():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get('role') != 'data_uploader':
        return jsonify({"error": "Access denied"}), 403
    data = request.json
    w = WeatherData(
        city=data['city'],
        temperature=data.get('temperature'),
        humidity=data.get('humidity'),
        wind_speed=data.get('wind_speed'),
        solar_radiation=data.get('solar_radiation'),
        precipitation=data.get('precipitation'),
        forecast_type=data.get('type', 'current'),
        data_date=datetime.datetime.strptime(data['date'], '%Y-%m-%d').date() if isinstance(data['date'], str) else data['date'],
        uploaded_by=session.get('username')
    )
    db.session.add(w)
    db.session.commit()
    return jsonify({"message": "Weather data uploaded successfully", "id": w.id})

@uploader_bp.route('/production', methods=['POST'])
def upload_production():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get('role') != 'data_uploader':
        return jsonify({"error": "Access denied"}), 403
    data = request.json
    prod = ProductionData(
        source_type=data['source_type'],
        energy_produced_kw=data['energy_produced_kw'],
        hours_operational=data['hours_operational'],
        equipment_status=data.get('equipment_status', 'normal'),
        data_date=datetime.datetime.strptime(data['date'], '%Y-%m-%d').date() if isinstance(data['date'], str) else data['date'],
        uploaded_by=session.get('username')
    )
    db.session.add(prod)
    db.session.commit()
    return jsonify({"message": "Production data uploaded successfully", "id": prod.id})

@uploader_bp.route('/storage', methods=['POST'])
def upload_storage():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get('role') != 'data_uploader':
        return jsonify({"error": "Access denied"}), 403
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
        data_date=datetime.datetime.strptime(data['date'], '%Y-%m-%d').date() if isinstance(data['date'], str) else data['date'],
        uploaded_by=session.get('username')
    )
    db.session.add(store)
    db.session.commit()
    return jsonify({"message": "Storage data uploaded successfully", "id": store.id})

@uploader_bp.route('/transmission', methods=['POST'])
def upload_transmission():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get('role') != 'data_uploader':
        return jsonify({"error": "Access denied"}), 403
    data = request.json
    trans = TransmissionData(
        destination=data['destination'],
        energy_sent_kw=data['energy_sent_kw'],
        source_type=data['source_type'],
        data_date=datetime.datetime.strptime(data['date'], '%Y-%m-%d').date() if isinstance(data['date'], str) else data['date'],
        uploaded_by=session.get('username')
    )
    db.session.add(trans)
    db.session.commit()
    return jsonify({"message": "Transmission data uploaded successfully", "id": trans.id})

@uploader_bp.route('/dashboard', methods=['GET'])
def uploader_dashboard():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    today = datetime.date.today()
    weather_count = WeatherData.query.filter_by(data_date=today, uploaded_by=session.get('username')).count()
    prod_count = ProductionData.query.filter_by(data_date=today, uploaded_by=session.get('username')).count()
    storage_count = StorageData.query.filter_by(data_date=today, uploaded_by=session.get('username')).count()
    trans_count = TransmissionData.query.filter_by(data_date=today, uploaded_by=session.get('username')).count()
    return jsonify({
        "weather_uploaded": weather_count,
        "production_uploaded": prod_count,
        "storage_uploaded": storage_count,
        "transmission_uploaded": trans_count
    })
