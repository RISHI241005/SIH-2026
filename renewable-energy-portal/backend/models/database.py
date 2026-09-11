from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='data_uploader')
    scale = db.Column(db.String(20), nullable=False, default='small')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

class WeatherData(db.Model):
    __tablename__ = 'weather_data'
    id = db.Column(db.Integer, primary_key=True)
    city = db.Column(db.String(50), nullable=False)
    temperature = db.Column(db.Float)
    humidity = db.Column(db.Float)
    wind_speed = db.Column(db.Float)
    solar_radiation = db.Column(db.Float)
    precipitation = db.Column(db.Float)
    forecast_type = db.Column(db.String(20), default='current')
    data_date = db.Column(db.Date, default=datetime.utcnow)
    uploaded_by = db.Column(db.String(80))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ProductionData(db.Model):
    __tablename__ = 'production_data'
    id = db.Column(db.Integer, primary_key=True)
    source_type = db.Column(db.String(20), nullable=False)
    energy_produced_kw = db.Column(db.Float)
    hours_operational = db.Column(db.Float)
    equipment_status = db.Column(db.String(50), default='normal')
    data_date = db.Column(db.Date, default=datetime.utcnow)
    uploaded_by = db.Column(db.String(80))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class StorageData(db.Model):
    __tablename__ = 'storage_data'
    id = db.Column(db.Integer, primary_key=True)
    source_type = db.Column(db.String(20), nullable=False)
    stored_energy_kw = db.Column(db.Float)
    emergency_stored_kw = db.Column(db.Float)
    total_received_kw = db.Column(db.Float)
    battery_charge_count = db.Column(db.Integer, default=0)
    battery_discharge_count = db.Column(db.Integer, default=0)
    energy_sent_kw = db.Column(db.Float)
    battery_health = db.Column(db.Float, default=100.0)
    data_date = db.Column(db.Date, default=datetime.utcnow)
    uploaded_by = db.Column(db.String(80))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class TransmissionData(db.Model):
    __tablename__ = 'transmission_data'
    id = db.Column(db.Integer, primary_key=True)
    destination = db.Column(db.String(100))
    energy_sent_kw = db.Column(db.Float)
    source_type = db.Column(db.String(20))
    data_date = db.Column(db.Date, default=datetime.utcnow)
    uploaded_by = db.Column(db.String(80))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Problem(db.Model):
    __tablename__ = 'problems'
    id = db.Column(db.Integer, primary_key=True)
    source_type = db.Column(db.String(20), nullable=False)
    stage = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), default='medium')
    status = db.Column(db.String(20), default='pending')
    detected_by = db.Column(db.String(50), default='AI')
    detected_at = db.Column(db.DateTime, default=datetime.utcnow)
    past_occurrences = db.Column(db.Integer, default=0)
    ai_solution = db.Column(db.Text)
    ai_confidence = db.Column(db.Float, default=0.0)
    admin_approved = db.Column(db.Boolean, default=False)
    admin_rejected = db.Column(db.Boolean, default=False)
    admin_solution = db.Column(db.Text)
    resolved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Alert(db.Model):
    __tablename__ = 'alerts'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    alert_type = db.Column(db.String(20), default='info')
    requires_action = db.Column(db.Boolean, default=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Feedback(db.Model):
    __tablename__ = 'feedbacks'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    category = db.Column(db.String(20), nullable=False)
    rating = db.Column(db.Integer)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Complaint(db.Model):
    __tablename__ = 'complaints'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    area = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class EnergyStats(db.Model):
    __tablename__ = 'energy_stats'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, default=datetime.utcnow)
    total_produced_kw = db.Column(db.Float, default=0)
    total_stored_kw = db.Column(db.Float, default=0)
    total_distributed_kw = db.Column(db.Float, default=0)
    emergency_reserved_kw = db.Column(db.Float, default=0)
    solar_produced = db.Column(db.Float, default=0)
    wind_produced = db.Column(db.Float, default=0)
    hydro_produced = db.Column(db.Float, default=0)
    shortage_kw = db.Column(db.Float, default=0)
    theft_detected = db.Column(db.Boolean, default=False)

def init_db():
    db.create_all()
    seed_initial_data()

def seed_initial_data():
    from backend.ml_models.problem_detector import ProblemDetector
    from backend.ml_models.solution_generator import SolutionGenerator
    if User.query.count() == 0:
        admin = User(
            username='admin', email='admin@renewable.com',
            password='admin123', role='admin', scale='large'
        )
        db.session.add(admin)
        db.session.commit()
    
    if Alert.query.count() == 0:
        alerts = [
            Alert(title='High Wind Speed Alert', message='Wind speeds exceeding 40m/s detected at Delhi zone', alert_type='warning', requires_action=True),
            Alert(title='Solar Panel Efficiency Drop', message='Solar panel efficiency dropped by 12% in Kolkata zone', alert_type='critical', requires_action=True),
            Alert(title='Battery Maintenance Due', message='Mumbai battery bank requires maintenance in 3 days', alert_type='info', requires_action=False),
            Alert(title='Grid Frequency Anomaly', message='Unusual frequency pattern detected in Hyderabad distribution', alert_type='warning', requires_action=True),
        ]
        for a in alerts:
            db.session.add(a)
        db.session.commit()
    
    if Problem.query.count() == 0:
        pd = ProblemDetector()
        sg = SolutionGenerator()
        problems_data = [
            {'source_type': 'solar', 'stage': 'production', 'title': 'Panel Degradation Detected', 'description': 'Solar panels in Kolkata zone showing 12% efficiency drop. Possible causes: dust accumulation, micro-cracks, or aging cells.', 'severity': 'high'},
            {'source_type': 'wind', 'stage': 'production', 'title': 'Turbine Blade Wear', 'description': 'Wind turbines in Delhi zone showing abnormal vibration patterns. Blade wear detected at 5% above threshold.', 'severity': 'medium'},
            {'source_type': 'hydro', 'stage': 'storage', 'title': 'Battery Capacity Reduction', 'description': 'Hydro storage batteries in Mumbai showing 8% capacity reduction. Charge cycles may need calibration.', 'severity': 'medium'},
            {'source_type': 'solar', 'stage': 'distribution', 'title': 'Transmission Loss Spike', 'description': 'Unexpected 5% increase in transmission losses detected in Hyderabad solar grid.', 'severity': 'high'},
            {'source_type': 'wind', 'stage': 'forecast', 'title': 'Wind Pattern Shift', 'description': 'AI predicts 20% wind speed reduction for next 48 hours across all wind zones.', 'severity': 'low'},
        ]
        for pdata in problems_data:
            sol = sg.generate_solution(pdata['source_type'], pdata['stage'], pdata['title'])
            confidence = sol.get('confidence', 0.85)
            prob = Problem(
                source_type=pdata['source_type'],
                stage=pdata['stage'],
                title=pdata['title'],
                description=pdata['description'],
                severity=pdata['severity'],
                ai_solution=sol['solution'],
                ai_confidence=confidence,
                past_occurrences=pdata.get('past_occurrences', 0)
            )
            db.session.add(prob)
        db.session.commit()
