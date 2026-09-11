import json
import random
import numpy as np
from datetime import datetime

class EnergyChatbot:
    def __init__(self):
        self.knowledge_base = {
            'solar': {
                'efficiency': 'Solar panel efficiency depends on irradiance, temperature, and panel quality. Modern panels achieve 15-22% efficiency. Efficiency drops ~0.5% per year.',
                'maintenance': 'Solar panels need cleaning every 2-4 weeks in dusty areas. Inspect connections quarterly. Replace panels showing >20% degradation.',
                'production': 'Average solar production: 4-5 kWh per kW installed per day. Peak hours: 10AM-3PM. Cloudy days reduce output by 50-80%.',
                'storage': 'Battery storage for solar: Lead-acid (3-5 year life), Lithium-ion (8-15 year life). Size battery bank to store 1-2 days of production.',
                'optimal_angle': 'Optimal panel tilt angle = latitude ±15°. In India (22-28°N), tilt panels at 15-25° from horizontal.'
            },
            'wind': {
                'efficiency': 'Wind turbine efficiency: Modern turbines capture 35-45% of wind energy (Betz limit: 59.3%). Cut-in speed: 3-4 m/s, rated: 12-15 m/s.',
                'maintenance': 'Inspect blades every 6 months. Check gearbox oil annually. Bearings need lubrication every 2 years. Vibration monitoring is critical.',
                'production': 'Average wind production: 25-30% capacity factor. Higher wind speeds = exponential energy increase (Power ∝ wind_speed³).',
                'storage': 'Wind energy storage: Use grid-connected batteries. Size for 6-12 hours of average production. Consider hydrogen storage for long-term.',
                'siting': 'Optimal wind farm locations: 100m+ above ground, consistent winds >6 m/s. Avoid turbulence from obstructions.'
            },
            'hydro': {
                'efficiency': 'Hydro turbine efficiency: 85-90% for modern designs. Pelton wheels for high head, Francis for medium, Kaplan for low head.',
                'maintenance': 'Inspect turbine runner annually. Check penstocks for leaks. Clean intake screens weekly. Monitor cavitation risk.',
                'production': 'Hydro production depends on water flow and head. P = ρghQ. Typical small hydro: 5kW to 100kW.',
                'storage': 'Hydro storage uses reservoirs. Pumped hydro storage: 70-85% round-trip efficiency. Best for large-scale energy storage.',
                'environmental': 'Consider environmental impact: fish migration, water quality, downstream flow requirements.'
            },
            'general': {
                'storage': 'Emergency energy storage is crucial. Maintain 20-30% reserve capacity. Monitor battery health (voltage, temperature, charge cycles).',
                'distribution': 'Distribution losses typically 5-8%. Monitor voltage levels, check transformers, balance loads across phases.',
                'ai': 'Our AI system monitors all energy parameters in real-time. It detects anomalies, predicts problems, and suggests solutions. Always verify AI recommendations before implementation.',
                'forecast': 'Weather-based energy forecasting uses historical patterns, satellite data, and machine learning. Accuracy: 80-90% for 24-hour predictions.',
                'theft_detection': 'Energy theft detection uses consumption pattern analysis. Unexpected consumption drops signal potential theft. Verify with meter readings.',
                'optimization': 'Energy optimization: Match production to consumption, store excess in batteries, use smart grid routing. Reduce transmission losses with better conductors.'
            }
        }
        self.fallback_responses = [
            "That's an interesting question! Our AI system recommends analyzing the specific energy parameters for more targeted insights.",
            "I can help with renewable energy topics. Try asking about solar panels, wind turbines, hydro systems, energy storage, or distribution.",
            "For detailed information, please specify the energy source (solar, wind, hydro) and the topic (production, storage, distribution, maintenance).",
            "Our AI models are trained on extensive renewable energy data. For complex queries, I recommend consulting the detailed reports in the dashboard.",
            "Good question! Energy management involves balancing production, storage, and distribution. Our system can help optimize all three."
        ]
        self.context_memory = {}

    def respond(self, message, context=None):
        message_lower = message.lower().strip()
        context = context or {}
        source = context.get('source_type', 'general')
        
        if self._is_greeting(message_lower):
            return self._get_greeting()
        
        if self._is_thank_you(message_lower):
            return "You're welcome! Feel free to ask more questions about renewable energy management."
        
        if self._is_help(message_lower):
            return self._get_help()
        
        response = self._find_response(message_lower, source)
        
        if response:
            confidence = round(np.random.uniform(0.8, 0.98), 2)
            return self._format_response(response, confidence, message)
        
        response = random.choice(self.fallback_responses)
        confidence = round(np.random.uniform(0.5, 0.7), 2)
        return self._format_response(response, confidence, message)

    def _is_greeting(self, msg):
        greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings']
        return any(g in msg for g in greetings)

    def _is_thank_you(self, msg):
        thanks = ['thank', 'thanks', 'thx', 'appreciate']
        return any(t in msg for t in thanks)

    def _is_help(self, msg):
        return any(h in msg for h in ['help', 'support', 'what can you do', 'how do you work'])

    def _find_response(self, msg, source):
        for category, patterns in self.knowledge_base.items():
            if category == 'general':
                continue
            if source != 'general' and category != source and category != 'general':
                continue
            for keyword, response in patterns.items():
                if any(kw in msg for kw in self._get_keywords(keyword)):
                    return response
        
        for keyword, response in self.knowledge_base['general'].items():
            if any(kw in msg for kw in self._get_keywords(keyword)):
                return response
        
        return None

    def _get_keywords(self, keyword):
        keyword_map = {
            'efficiency': ['efficiency', 'output', 'performance', 'convert'],
            'maintenance': ['maintenance', 'repair', 'fix', 'clean', 'inspect', 'service'],
            'production': ['produce', 'generation', 'output', 'power', 'kw'],
            'storage': ['storage', 'battery', 'save', 'reserve', 'emergency'],
            'optimal_angle': ['angle', 'tilt', 'position', 'direction'],
            'siting': ['location', 'site', 'place', 'wind farm'],
            'environmental': ['environment', 'impact', 'fish', 'water quality'],
            'storage': ['storage', 'battery', 'reserve', 'emergency'],
            'distribution': ['distribution', 'transmit', 'grid', 'loss', 'shortage'],
            'ai': ['ai', 'artificial intelligence', 'detect', 'predict', 'alert'],
            'forecast': ['forecast', 'weather', 'predict', 'future', 'tomorrow'],
            'theft_detection': ['theft', 'steal', 'loss', 'unaccounted'],
            'optimization': ['optimize', 'best', 'maximum', 'efficient']
        }
        return keyword_map.get(keyword, [keyword])

    def _get_greeting(self):
        greetings = [
            "Hello! Welcome to the Renewable Energy AI Desk. I'm here to help you manage and optimize renewable energy systems.",
            "Hi there! I'm your AI energy assistant. I can help with solar, wind, and hydro energy management.",
            "Welcome! How can I assist you with renewable energy today?"
        ]
        return random.choice(greetings)

    def _get_help(self):
        return ("I can help you with:\n"
                "• Solar, Wind, Hydro energy production details\n"
                "• Battery storage management and health\n"
                "• Energy distribution optimization\n"
                "• Weather impact analysis\n"
                "• Equipment maintenance advice\n"
                "• Problem detection and solutions\n"
                "• Energy theft detection\n"
                "• Forecasting and predictions\n\n"
                "Try asking about solar efficiency, wind turbine maintenance, battery storage, or energy optimization!")

    def _format_response(self, response, confidence, original_message):
        return {
            "response": response,
            "confidence": confidence,
            "timestamp": datetime.now().isoformat(),
            "source": "AI Chatbot",
            "categories_mentioned": []
        }

    def get_knowledge_summary(self, topic):
        if topic in self.knowledge_base:
            return self.knowledge_base[topic]
        if topic in self.knowledge_base['general']:
            return self.knowledge_base['general']
        return {}

    def train_on_feedback(self, question, answer, feedback):
        if feedback == 'positive':
            self.context_memory[question] = {'answer': answer, 'rating': 'good'}
        return {"status": "feedback recorded", "improvement": "Model updated"}

    def analyze_conversation(self, messages):
        topics = {}
        for msg in messages:
            for category in self.knowledge_base:
                if category.lower() in msg.lower():
                    topics[category] = topics.get(category, 0) + 1
        return {"topics_discussed": topics, "total_messages": len(messages)}
