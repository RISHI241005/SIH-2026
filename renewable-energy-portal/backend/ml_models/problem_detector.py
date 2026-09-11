import numpy as np
import json
from datetime import datetime
from backend.services.weather_service import get_mock_weather, get_mock_forecast, get_historical_weather

class ProblemDetector:
    def __init__(self):
        self.problem_patterns = {
            'solar': {
                'production': {
                    'efficiency_drop': {'threshold': 0.85, 'severity': 'high', 'keywords': ['efficiency', 'degradation', 'output']},
                    'dust_accumulation': {'threshold': 0.90, 'severity': 'medium', 'keywords': ['dust', 'cleaning', 'panel']},
                    'equipment_failure': {'threshold': 0.70, 'severity': 'critical', 'keywords': ['failure', 'broken', 'malfunction']}
                },
                'storage': {
                    'battery_degradation': {'threshold': 85, 'severity': 'medium', 'keywords': ['battery', 'capacity', 'health']},
                    'overcharge': {'threshold': 95, 'severity': 'high', 'keywords': ['overcharge', 'overvoltage']},
                    'deep_discharge': {'threshold': 20, 'severity': 'critical', 'keywords': ['deep', 'discharge', 'empty']}
                },
                'distribution': {
                    'transmission_loss': {'threshold': 5, 'severity': 'high', 'keywords': ['loss', 'transmission', 'grid']},
                    'grid_instability': {'threshold': 3, 'severity': 'medium', 'keywords': ['instability', 'fluctuation', 'frequency']}
                },
                'forecast': {
                    'weather_risk': {'threshold': 70, 'severity': 'low', 'keywords': ['cloud', 'rain', 'storm', 'wind']},
                    'low_irradiance': {'threshold': 300, 'severity': 'medium', 'keywords': ['irradiance', 'solar_radiation']}
                }
            },
            'wind': {
                'production': {
                    'blade_wear': {'threshold': 0.90, 'severity': 'medium', 'keywords': ['blade', 'vibration', 'wear']},
                    'turbine_failure': {'threshold': 0.70, 'severity': 'critical', 'keywords': ['failure', 'shutdown', 'turbine']},
                    'low_wind_speed': {'threshold': 3, 'severity': 'low', 'keywords': ['wind_speed', 'low_wind']}
                },
                'storage': {
                    'battery_overload': {'threshold': 90, 'severity': 'high', 'keywords': ['overload', 'battery']},
                    'capacity_reduction': {'threshold': 85, 'severity': 'medium', 'keywords': ['capacity', 'reduce']}
                },
                'distribution': {
                    'power_surge': {'threshold': 110, 'severity': 'high', 'keywords': ['surge', 'excess']},
                    'frequency_deviation': {'threshold': 2, 'severity': 'medium', 'keywords': ['frequency', 'deviation']}
                },
                'forecast': {
                    'wind_pattern_shift': {'threshold': 20, 'severity': 'low', 'keywords': ['wind_pattern', 'shift', 'change']},
                    'storm_warning': {'threshold': 30, 'severity': 'high', 'keywords': ['storm', 'severe']}
                }
            },
            'hydro': {
                'production': {
                    'turbine_erosion': {'threshold': 0.85, 'severity': 'medium', 'keywords': ['erosion', 'turbine', 'cavitation']},
                    'flow_reduction': {'threshold': 0.80, 'severity': 'high', 'keywords': ['flow', 'water_level']}
                },
                'storage': {
                    'battery_aging': {'threshold': 80, 'severity': 'medium', 'keywords': ['aging', 'battery']},
                    'overflow_risk': {'threshold': 95, 'severity': 'high', 'keywords': ['overflow', 'excess_storage']}
                },
                'distribution': {
                    'voltage_drop': {'threshold': 5, 'severity': 'high', 'keywords': ['voltage', 'drop']},
                    'cable_degradation': {'threshold': 0.80, 'severity': 'medium', 'keywords': ['cable', 'degradation']}
                },
                'forecast': {
                    'monsoon_risk': {'threshold': 60, 'severity': 'high', 'keywords': ['monsoon', 'flood']},
                    'drought_warning': {'threshold': 40, 'severity': 'medium', 'keywords': ['drought', 'low_water']}
                }
            }
        }
        self.weather_impact_weights = {'solar': 0.3, 'wind': 0.35, 'hydro': 0.25}

    def analyze(self, source_type, stage):
        problems_found = False
        problems = []
        summary = ""
        
        patterns = self.problem_patterns.get(source_type, {}).get(stage, {})
        mock_weather = get_mock_weather('Kolkata')
        
        for problem_type, config in patterns.items():
            severity = config['severity']
            if self._should_detect(source_type, stage, problem_type, severity):
                problems.append({
                    'title': self._get_title(source_type, stage, problem_type),
                    'description': self._get_description(source_type, stage, problem_type),
                    'severity': severity,
                    'type': problem_type,
                    'solution': self._generate_basic_solution(source_type, stage, problem_type),
                    'confidence': round(np.random.uniform(0.7, 0.95), 2)
                })
                problems_found = True
        
        if source_type == 'solar' and stage == 'forecast':
            if mock_weather['temperature'] > 35:
                problems.append({
                    'title': 'High Temperature Alert',
                    'description': f"Temperature at {mock_weather['temperature']}C may reduce solar panel efficiency",
                    'severity': 'medium', 'type': 'temperature_risk',
                    'solution': 'Activate cooling systems and reduce panel load by 10%',
                    'confidence': 0.88
                })
                problems_found = True
        
        summary = f"Analysis complete for {source_type} {stage}. Found {len(problems)} potential issues." if problems else f"No issues detected for {source_type} {stage}."
        
        return {
            'problems_found': problems_found,
            'problems': problems,
            'summary': summary,
            'source_type': source_type,
            'stage': stage,
            'timestamp': datetime.now().isoformat()
        }

    def _should_detect(self, source, stage, ptype, severity):
        base_prob = {'critical': 0.3, 'high': 0.4, 'medium': 0.5, 'low': 0.6}
        return np.random.random() < base_prob.get(severity, 0.5)

    def _get_title(self, source, stage, ptype):
        titles = {
            'efficiency_drop': f'{source.title()} Efficiency Drop Detected',
            'dust_accumulation': f'{source.title()} Panel Dust Accumulation',
            'equipment_failure': f'{source.title()} Equipment Failure Alert',
            'battery_degradation': f'{source.title()} Battery Degradation',
            'transmission_loss': f'{source.title()} Transmission Loss Detected',
            'blade_wear': f'{source.title()} Turbine Blade Wear',
            'low_wind_speed': f'{source.title()} Low Wind Speed Warning',
            'battery_overload': f'{source.title()} Battery Overload',
            'power_surge': f'{source.title()} Power Surge Detected',
            'weather_risk': f'{source.title()} Weather Risk Forecast',
            'low_irradiance': f'{source.title()} Low Solar Irradiance',
            'wind_pattern_shift': f'{source.title()} Wind Pattern Shift',
            'turbine_erosion': f'{source.title()} Turbine Erosion',
            'flow_reduction': f'{source.title()} Flow Reduction',
            'battery_aging': f'{source.title()} Battery Aging',
            'voltage_drop': f'{source.title()} Voltage Drop',
            'storm_warning': f'{source.title()} Storm Warning',
            'monsoon_risk': f'{source.title()} Monsoon Risk',
            'drought_warning': f'{source.title()} Drought Warning',
            'overcharge': f'{source.title()} Battery Overcharge Risk',
            'deep_discharge': f'{source.title()} Deep Discharge Alert',
            'grid_instability': f'{source.title()} Grid Instability',
            'cable_degradation': f'{source.title()} Cable Degradation',
            'capacity_reduction': f'{source.title()} Capacity Reduction',
            'turbine_failure': f'{source.title()} Turbine Failure',
            'power_surge': f'{source.title()} Power Surge Alert',
            'frequency_deviation': f'{source.title()} Frequency Deviation',
            'overflow_risk': f'{source.title()} Overflow Risk',
            'grid_frequency': f'{source.title()} Grid Frequency Anomaly',
            'battery_maintenance': f'{source.title()} Battery Maintenance Due'
        }
        return titles.get(ptype, f'{source.title()} {stage} Issue: {ptype}')

    def _get_description(self, source, stage, ptype):
        weather = get_mock_weather('Kolkata')
        descriptions = {
            'efficiency_drop': f'{source.title()} panels showing reduced efficiency. Current conditions: {weather["description"]} at {weather["temperature"]}C',
            'dust_accumulation': f'Dust accumulation detected on {source.title()} panels reducing output by estimated 8-15%',
            'equipment_failure': f'Critical equipment malfunction detected in {source.title()} production system',
            'battery_degradation': f'Battery capacity has decreased below optimal levels for {source.title()} storage',
            'transmission_loss': f'Unexpected energy loss detected in {source.title()} distribution grid',
            'blade_wear': f'Turbine blades showing abnormal wear patterns with vibration levels exceeding thresholds',
            'low_wind_speed': f'Wind speed below optimal operating range for {source.title()} turbines',
            'battery_overload': f'Battery system approaching overload capacity for {source.title()} storage',
            'power_surge': f'Power surge detected in {source.title()} distribution network',
            'weather_risk': f'Weather conditions may adversely affect {source.title()} energy generation',
            'low_irradiance': f'Solar irradiance levels below expected thresholds',
            'wind_pattern_shift': f'Predicted wind pattern shift may affect {source.title()} output in coming days',
            'turbine_erosion': f'Turbine cavitation and erosion detected in {source.title()} hydro system',
            'flow_reduction': f'Water flow reduction detected in {source.title()} hydro system',
            'battery_aging': f'Battery aging detected in {source.title()} storage system',
            'voltage_drop': f'Voltage drop detected in {source.title()} distribution lines',
            'storm_warning': f'Severe weather storm warning for {source.title()} zones',
            'monsoon_risk': f'Monsoon conditions may affect {source.title()} operations',
            'drought_warning': f'Drought conditions may reduce {source.title()} water availability',
            'overcharge': f'Battery overcharge risk detected in {source.title()} storage system',
            'deep_discharge': f'Deep discharge alert for {source.title()} battery system',
            'grid_instability': f'Grid frequency instability detected in {source.title()} distribution',
            'cable_degradation': f'Cable degradation detected in {source.title()} transmission lines',
            'capacity_reduction': f'Battery capacity reduced below expected levels for {source.title()}',
            'turbine_failure': f'Critical turbine failure in {source.title()} system',
            'frequency_deviation': f'Frequency deviation detected in {source.title()} grid',
            'overflow_risk': f'Overflow risk detected in {source.title()} storage tanks',
            'grid_frequency': f'Unusual grid frequency pattern detected in {source.title()} system',
            'battery_maintenance': f'Battery maintenance schedule due for {source.title()} storage'
        }
        return descriptions.get(ptype, f'{source.title()} {stage} issue: {ptype}')

    def _generate_basic_solution(self, source, stage, ptype):
        solutions = {
            'efficiency_drop': 'Schedule panel cleaning and inspect for micro-cracks. Consider anti-reflective coating.',
            'dust_accumulation': 'Initiate automated panel cleaning cycle and check filter systems.',
            'equipment_failure': 'Immediately shut down affected equipment and dispatch maintenance team.',
            'battery_degradation': 'Replace degraded battery cells and recalibrate battery management system.',
            'transmission_loss': 'Inspect transmission lines for faults and upgrade transformers if needed.',
            'blade_wear': 'Schedule turbine blade inspection and consider protective coating application.',
            'low_wind_speed': 'Switch to hybrid mode combining solar backup and adjust storage discharge.',
            'battery_overload': 'Reduce charging rate and activate load balancing to prevent damage.',
            'power_surge': 'Activate surge protectors and reroute excess energy to emergency storage.',
            'weather_risk': 'Adjust operational parameters based on weather forecast and activate preventive measures.',
            'low_irradiance': 'Supplement with wind energy and optimize battery discharge schedule.',
            'wind_pattern_shift': 'Adjust turbine orientation and prepare backup generation for next 48 hours.',
            'turbine_erosion': 'Schedule turbine maintenance and install anti-cavitation equipment.',
            'flow_reduction': 'Check water intake systems and optimize turbine blade pitch.',
            'battery_aging': 'Initiate battery replacement schedule and optimize charge cycles.',
            'voltage_drop': 'Check voltage regulators and inspect distribution transformers.',
            'storm_warning': 'Secure equipment and switch to protected operational mode.',
            'monsoon_risk': 'Activate flood prevention systems and adjust production schedules.',
            'drought_warning': 'Reduce hydro load and switch to alternative generation sources.',
            'overcharge': 'Reduce charging current and activate voltage regulation.',
            'deep_discharge': 'Immediately stop discharge and connect to charging source.',
            'grid_instability': 'Activate frequency regulators and redistribute load.',
            'cable_degradation': 'Replace affected cables and upgrade insulation.',
            'capacity_reduction': 'Recalibrate battery management and consider capacity expansion.',
            'turbine_failure': 'Emergency shutdown and dispatch specialized repair crew.',
            'frequency_deviation': 'Adjust generator speed and activate frequency correction.',
            'overflow_risk': 'Divert excess energy to emergency storage or reduce input.',
            'grid_frequency': 'Adjust power output to stabilize grid frequency.',
            'battery_maintenance': 'Schedule preventive maintenance and inspect all battery connections.'
        }
        return solutions.get(ptype, f'Investigate {source} {stage} issue and apply standard maintenance procedures.')

    def analyze_weather_impact(self, city, weather_data):
        impact = []
        temp = weather_data.get('temperature', 25)
        wind = weather_data.get('wind_speed', 10)
        humidity = weather_data.get('humidity', 50)
        solar_rad = weather_data.get('solar_radiation', 500)
        
        if temp > 35:
            impact.append({"type": "high_temp", "message": f"High temperature {temp}C may reduce solar efficiency by 10-15%", "severity": "medium"})
        if wind > 15:
            impact.append({"type": "high_wind", "message": f"High wind speed {wind} m/s can boost wind energy but may damage turbines", "severity": "low"})
        if humidity > 80:
            impact.append({"type": "high_humidity", "message": f"High humidity {humidity}% may reduce panel efficiency", "severity": "low"})
        if solar_rad < 300:
            impact.append({"type": "low_solar", "message": f"Low solar radiation {solar_rad} W/m2 will reduce solar output significantly", "severity": "high"})
        
        return {"city": city, "impact": impact, "recommendations": self._get_weather_recommendations(impact)}

    def _get_weather_recommendations(self, impacts):
        recs = []
        for imp in impacts:
            if imp['type'] == 'high_temp':
                recs.append('Activate cooling systems and reduce panel load')
            elif imp['type'] == 'high_wind':
                recs.append('Optimize turbine angles and secure loose equipment')
            elif imp['type'] == 'high_humidity':
                recs.append('Increase panel cleaning frequency')
            elif imp['type'] == 'low_solar':
                recs.append('Switch to wind/hydro backup and reduce consumption')
        return recs if recs else ['Continue normal operations']

    def predict_production(self, source_type, days):
        import random
        production = []
        base = {'solar': 25, 'wind': 30, 'hydro': 20}[source_type]
        for i in range(days):
            production.append({
                "day": i + 1,
                "predicted_kw": round(base + random.uniform(-5, 10), 2),
                "confidence": round(random.uniform(0.7, 0.95), 2),
                "weather_factor": random.choice(['good', 'normal', 'poor'])
            })
        return {"source": source_type, "days": days, "predictions": production}

    def get_ai_forecast(self, city):
        weather = get_mock_weather(city)
        forecast = get_mock_forecast(city)
        return {
            "city": city,
            "current": weather,
            "weekly_forecast": forecast,
            "energy_implications": self._get_energy_implications(weather)
        }

    def _get_energy_implications(self, weather):
        implications = []
        if weather['temperature'] > 35:
            implications.append("High temperatures may reduce solar panel efficiency by 10-15%")
        if weather['wind_speed'] > 15:
            implications.append("High wind speeds favor wind energy generation")
        if weather['precipitation'] > 1:
            implications.append("Rain may reduce solar output but can benefit hydro systems")
        if weather['solar_radiation'] < 400:
            implications.append("Low solar radiation expected, consider alternative sources")
        return implications if implications else ["Weather conditions favorable for energy generation"]
