from flask import Blueprint, request, jsonify, session
from backend.services.weather_service import fetch_weather_api
from backend.ml_models.problem_detector import ProblemDetector
import datetime
import requests

weather_bp = Blueprint('weather', __name__, url_prefix='/api/weather')

@weather_bp.route('/cities', methods=['GET'])
def get_cities():
    return jsonify({
        "cities": [
            {"name": "Kolkata", "country": "India", "lat": 22.57, "lon": 88.36},
            {"name": "Delhi", "country": "India", "lat": 28.61, "lon": 77.21},
            {"name": "Mumbai", "country": "India", "lat": 19.08, "lon": 72.88},
            {"name": "Hyderabad", "country": "India", "lat": 17.39, "lon": 78.49}
        ]
    })

@weather_bp.route('/current/<city>', methods=['GET'])
def get_current_weather(city):
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    api_data = fetch_weather_api(city)
    return jsonify({"city": city, "data": api_data})

@weather_bp.route('/historical/<city>', methods=['GET'])
def get_historical(city):
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    days = request.args.get('days', 7, type=int)
    data = WeatherData.query.filter_by(city=city, forecast_type='current').order_by(WeatherData.data_date.desc()).limit(days).all()
    return jsonify([{
        "city": w.city, "temperature": w.temperature, "humidity": w.humidity,
        "wind_speed": w.wind_speed, "solar_radiation": w.solar_radiation,
        "precipitation": w.precipitation, "data_date": w.data_date.isoformat()
    } for w in data])

@weather_bp.route('/forecast/<city>', methods=['GET'])
def get_forecast_weather(city):
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    api_forecast = fetch_weather_api(city)
    return jsonify({"city": city, "forecast": api_forecast})

@weather_bp.route('/upload', methods=['POST'])
def upload_weather():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
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
    return jsonify({"message": "Weather data uploaded", "id": w.id})

@weather_bp.route('/analyze/<city>', methods=['GET'])
def analyze_weather(city):
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    pd = ProblemDetector()
    api_data = fetch_weather_api(city)
    analysis = pd.analyze_weather_impact(city, api_data)
    return jsonify({"city": city, "analysis": analysis})
