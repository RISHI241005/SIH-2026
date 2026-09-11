from flask import Blueprint, request, jsonify, session
from backend.ml_models.problem_detector import ProblemDetector
from backend.ml_models.solution_generator import SolutionGenerator
from backend.ml_models.chatbot import EnergyChatbot
from backend.models.database import db, Problem
import json

ai_bp = Blueprint('ai', __name__, url_prefix='/api/ai')

@ai_bp.route('/detect-problems', methods=['POST'])
def detect_problems():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.json
    source_type = data.get('source_type', 'solar')
    stage = data.get('stage', 'production')
    
    pd = ProblemDetector()
    result = pd.analyze(source_type, stage)
    return jsonify(result)

@ai_bp.route('/problems/auto-detect', methods=['POST'])
def auto_detect():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    pd = ProblemDetector()
    all_problems = []
    for source in ['solar', 'wind', 'hydro']:
        for stage in ['forecast', 'production', 'storage', 'distribution']:
            result = pd.analyze(source, stage)
            if result['problems_found']:
                for p in result['problems']:
                    problem = Problem(
                        source_type=source,
                        stage=stage,
                        title=p['title'],
                        description=p['description'],
                        severity=p['severity'],
                        ai_solution=p.get('solution', ''),
                        ai_confidence=p.get('confidence', 0.0)
                    )
                    db.session.add(problem)
                    all_problems.append(p)
    db.session.commit()
    return jsonify({"detected_problems": len(all_problems), "problems": all_problems})

@ai_bp.route('/generate-solution', methods=['POST'])
def generate_solution():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.json
    sg = SolutionGenerator()
    source = data.get('source_type', 'solar')
    stage = data.get('stage', 'production')
    problem_title = data.get('title', '')
    
    result = sg.generate_solution(source, stage, problem_title)
    return jsonify(result)

@ai_bp.route('/chat', methods=['POST'])
def chat():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.json
    message = data.get('message', '')
    context = data.get('context', {})
    
    chatbot = EnergyChatbot()
    response = chatbot.respond(message, context)
    return jsonify({"response": response, "confidence": 0.85, "source": "AI Chatbot"})

@ai_bp.route('/insights', methods=['GET'])
def get_insights():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    pd = ProblemDetector()
    insights = []
    for source in ['solar', 'wind', 'hydro']:
        prod = pd.analyze(source, 'production')
        if prod['problems_found']:
            insights.append({"source": source, "insight": prod['summary']})
    return jsonify({"insights": insights, "total_insights": len(insights)})

@ai_bp.route('/predict-production', methods=['POST'])
def predict_production():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.json
    source = data.get('source_type', 'solar')
    days = data.get('days', 7)
    
    pd = ProblemDetector()
    prediction = pd.predict_production(source, days)
    return jsonify({"source": source, "prediction": prediction})

@ai_bp.route('/forecast', methods=['GET'])
def ai_forecast():
    if 'user_id' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    city = request.args.get('city', 'Kolkata')
    pd = ProblemDetector()
    forecast = pd.get_ai_forecast(city)
    return jsonify({"city": city, "forecast": forecast})
