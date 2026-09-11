from flask_sqlalchemy import SQLAlchemy
from backend.models.database import db, User, WeatherData, ProductionData, StorageData, TransmissionData, EnergyStats, Problem, Alert, Feedback, Complaint
from werkzeug.security import generate_password_hash
import datetime

def init_db():
    db.create_all()
    _seed_data()

def _seed_data():
    if User.query.filter_by(username='admin').first() is None:
        admin = User(
            username='admin', email='admin@renewable.com',
            password=generate_password_hash('admin123'),
            role='admin', scale='large'
        )
        db.session.add(admin)
    
    uploader = User(
        username='uploader1', email='uploader@renewable.com',
        password=generate_password_hash('upload123'),
        role='data_uploader', scale='small'
    )
    db.session.add(uploader)
    db.session.commit()

    if Alert.query.count() == 0:
        alerts = [
            Alert(title='High Wind Speed Alert', message='Wind speeds exceeding threshold at Delhi zone', alert_type='warning', requires_action=True),
            Alert(title='Solar Panel Efficiency Drop', message='Solar panel efficiency dropped by 12% in Kolkata zone', alert_type='critical', requires_action=True),
            Alert(title='Battery Maintenance Due', message='Mumbai battery bank requires maintenance in 3 days', alert_type='info', requires_action=False),
            Alert(title='Grid Frequency Anomaly', message='Unusual frequency pattern detected in Hyderabad distribution', alert_type='warning', requires_action=True),
        ]
        for a in alerts:
            db.session.add(a)
        db.session.commit()

    if Problem.query.count() == 0:
        pd = ProblemDetector()
        problems_data = [
            {'source_type': 'solar', 'stage': 'production', 'title': 'Panel Degradation Detected', 'description': 'Solar panels in Kolkata zone showing 12% efficiency drop.', 'severity': 'high'},
            {'source_type': 'wind', 'stage': 'production', 'title': 'Turbine Blade Wear', 'description': 'Wind turbines in Delhi showing abnormal vibration patterns.', 'severity': 'medium'},
            {'source_type': 'hydro', 'stage': 'storage', 'title': 'Battery Capacity Reduction', 'description': 'Hydro storage batteries showing 8% capacity reduction.', 'severity': 'medium'},
            {'source_type': 'solar', 'stage': 'distribution', 'title': 'Transmission Loss Spike', 'description': 'Unexpected 5% increase in transmission losses.', 'severity': 'high'},
        ]
        for pdata in problems_data:
            problem = Problem(
                source_type=pdata['source_type'],
                stage=pdata['stage'],
                title=pdata['title'],
                description=pdata['description'],
                severity=pdata['severity'],
                status='pending',
                ai_solution='Investigate and apply corrective maintenance',
                ai_confidence=0.87,
                past_occurrences=0
            )
            db.session.add(problem)
        db.session.commit()

    if EnergyStats.query.count() == 0:
        stats = EnergyStats(
            date=datetime.date.today(),
            total_produced_kw=30.0,
            total_stored_kw=25.0,
            total_distributed_kw=23.0,
            emergency_reserved_kw=5.0,
            solar_produced=12.0,
            wind_produced=12.0,
            hydro_produced=6.0,
            shortage_kw=0,
            theft_detected=False
        )
        db.session.add(stats)
        db.session.commit()

    if StorageData.query.count() == 0:
        sd = StorageData(
            source_type='solar', stored_energy_kw=15.0, emergency_stored_kw=5.0,
            total_received_kw=21.0, battery_charge_count=1, battery_discharge_count=0,
            energy_sent_kw=15.0, battery_health=92.0
        )
        db.session.add(sd)
        db.session.commit()

    if TransmissionData.query.count() == 0:
        trans = TransmissionData(
            destination='Hostel Rooms', energy_sent_kw=7.0, source_type='solar'
        )
        db.session.add(trans)
        db.session.commit()
