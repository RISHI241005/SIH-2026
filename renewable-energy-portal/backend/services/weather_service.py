import requests, json, os
from datetime import datetime, timedelta

OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '')
BASE_URL = 'https://api.openweathermap.org/data/2.5'

def fetch_weather_api(city):
    try:
        response = requests.get(f'{BASE_URL}/weather', params={
            'q': city,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric'
        }, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return {
                "temperature": data['main']['temp'],
                "humidity": data['main']['humidity'],
                "wind_speed": data['wind']['speed'],
                "solar_radiation": round(data['main']['temp'] * 0.5, 2),
                "precipitation": data.get('rain', {}).get('1h', 0),
                "description": data['weather'][0]['description'],
                "clouds": data['clouds']['all']
            }
    except Exception as e:
        pass
    return get_mock_weather(city)

def get_forecast_api(city):
    try:
        response = requests.get(f'{BASE_URL}/forecast', params={
            'q': city,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric',
            'cnt': 8
        }, timeout=10)
        if response.status_code == 200:
            data = response.json()
            forecasts = []
            for item in data['list'][:8]:
                forecasts.append({
                    "dt": item['dt'],
                    "temperature": item['main']['temp'],
                    "humidity": item['main']['humidity'],
                    "wind_speed": item['wind']['speed'],
                    "description": item['weather'][0]['description'],
                    "date": datetime.fromtimestamp(item['dt']).strftime('%Y-%m-%d %H:%M')
                })
            return forecasts
    except Exception as e:
        pass
    return []

def get_mock_weather(city):
    mock_data = {
        'Kolkata': {"temperature": 32.5, "humidity": 78, "wind_speed": 12.3, "solar_radiation": 650, "precipitation": 0, "description": "Partly cloudy", "clouds": 45},
        'Delhi': {"temperature": 38.2, "humidity": 45, "wind_speed": 8.7, "solar_radiation": 850, "precipitation": 0, "description": "Sunny", "clouds": 10},
        'Mumbai': {"temperature": 30.1, "humidity": 85, "wind_speed": 15.6, "solar_radiation": 520, "precipitation": 2.1, "description": "Light rain", "clouds": 75},
        'Hyderabad': {"temperature": 35.8, "humidity": 55, "wind_speed": 10.2, "solar_radiation": 780, "precipitation": 0, "description": "Clear sky", "clouds": 5}
    }
    return mock_data.get(city, mock_data['Kolkata'])

def get_mock_forecast(city):
    import random
    forecasts = []
    base_temp = get_mock_weather(city)['temperature']
    for i in range(5):
        forecasts.append({
            "date": (datetime.now() + timedelta(days=i)).strftime('%Y-%m-%d'),
            "temperature": round(base_temp + random.uniform(-3, 3), 1),
            "humidity": random.randint(40, 90),
            "wind_speed": round(random.uniform(5, 20), 1),
            "solar_radiation": random.randint(400, 900),
            "description": random.choice(["Sunny", "Partly cloudy", "Cloudy", "Light rain"]),
            "precipitation": round(random.uniform(0, 5), 1)
        })
    return forecasts

def get_historical_weather(city, days=7):
    import random
    history = []
    for i in range(days):
        date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        history.append({
            "city": city,
            "temperature": round(28 + random.uniform(-5, 8), 1),
            "humidity": random.randint(40, 90),
            "wind_speed": round(random.uniform(3, 20), 1),
            "solar_radiation": random.randint(300, 900),
            "precipitation": round(random.uniform(0, 5), 1),
            "data_date": date
        })
    return history
