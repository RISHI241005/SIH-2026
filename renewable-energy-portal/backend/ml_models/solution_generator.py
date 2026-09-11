import json
import numpy as np
from datetime import datetime

class SolutionGenerator:
    def __init__(self):
        self.solution_db = {
            ('solar', 'production'): {
                'efficiency_drop': {
                    'solution': '1. Clean all panels immediately\n2. Inspect for micro-cracks\n3. Apply anti-reflective coating\n4. Replace degraded cells\n5. Optimize panel angle',
                    'steps': ['clean panels', 'inspect damage', 'apply coating', 'replace cells', 'recalibrate'],
                    'timeline': '2-3 days', 'cost_estimate': '₹50,000-₹1,00,000',
                    'expected_improvement': '15-20% efficiency recovery'
                },
                'dust_accumulation': {
                    'solution': '1. Activate automated cleaning system\n2. Manual wipe for critical areas\n3. Install dust guards\n4. Increase cleaning frequency to daily',
                    'steps': ['activate cleaning', 'manual wipe', 'install guards', 'increase frequency'],
                    'timeline': '1 day', 'cost_estimate': '₹10,000-₹25,000',
                    'expected_improvement': '8-15% output increase'
                }
            },
            ('wind', 'production'): {
                'blade_wear': {
                    'solution': '1. Schedule blade inspection\n2. Apply protective coating\n3. Adjust turbine pitch\n4. Install vibration dampeners\n5. Consider blade replacement',
                    'steps': ['inspect blades', 'apply coating', 'adjust pitch', 'install dampeners'],
                    'timeline': '3-5 days', 'cost_estimate': '₹75,000-₹2,00,000',
                    'expected_improvement': 'Reduced vibration by 60%'
                },
                'low_wind_speed': {
                    'solution': '1. Switch to hybrid mode\n2. Activate solar backup\n3. Discharge batteries to meet demand\n4. Optimize turbine orientation',
                    'steps': ['activate hybrid', 'solar backup', 'discharge batteries', 'optimize orientation'],
                    'timeline': 'Immediate', 'cost_estimate': '₹0 (operational)',
                    'expected_improvement': 'Maintain 80% of target output'
                }
            },
            ('hydro', 'production'): {
                'turbine_erosion': {
                    'solution': '1. Shut down affected turbine\n2. Inspect for cavitation damage\n3. Apply anti-cavitation coating\n4. Adjust operating pressure\n5. Schedule full overhaul',
                    'steps': ['shutdown', 'inspect', 'apply coating', 'adjust pressure', 'overhaul'],
                    'timeline': '5-7 days', 'cost_estimate': '₹1,00,000-₹3,00,000',
                    'expected_improvement': 'Full turbine recovery'
                }
            },
            ('solar', 'storage'): {
                'battery_degradation': {
                    'solution': '1. Test individual cell health\n2. Replace degraded cells\n3. Recalibrate BMS\n4. Implement proper charge cycles\n5. Monitor for 1 week',
                    'steps': ['test cells', 'replace', 'recalibrate BMS', 'monitor'],
                    'timeline': '2-3 days', 'cost_estimate': '₹30,000-₹80,000',
                    'expected_improvement': 'Restore 95% capacity'
                }
            },
            ('solar', 'distribution'): {
                'transmission_loss': {
                    'solution': '1. Inspect all transmission lines\n2. Replace damaged cables\n3. Upgrade transformers\n4. Install power quality monitors\n5. Implement smart grid routing',
                    'steps': ['inspect lines', 'replace cables', 'upgrade transformers', 'install monitors'],
                    'timeline': '3-5 days', 'cost_estimate': '₹50,000-₹1,50,000',
                    'expected_improvement': 'Reduce losses by 3-5%'
                }
            },
            ('wind', 'storage'): {
                'battery_overload': {
                    'solution': '1. Reduce charging current immediately\n2. Activate load balancing\n3. Redirect excess to emergency storage\n4. Inspect battery management system\n5. Upgrade if necessary',
                    'steps': ['reduce current', 'load balance', 'redirect excess', 'inspect BMS'],
                    'timeline': 'Immediate to 1 day', 'cost_estimate': '₹0-₹20,000',
                    'expected_improvement': 'Safe operating restored'
                }
            },
            ('wind', 'forecast'): {
                'wind_pattern_shift': {
                    'solution': '1. Analyze historical wind patterns\n2. Adjust turbine orientation algorithm\n3. Prepare solar backup\n4. Update 48-hour production forecast\n5. Notify distribution team',
                    'steps': ['analyze patterns', 'adjust orientation', 'prepare backup', 'update forecast'],
                    'timeline': '1 day', 'cost_estimate': '₹0 (operational)',
                    'expected_improvement': 'Adapt to new conditions'
                }
            }
        }

    def generate_solution(self, source_type, stage, problem_title):
        default_sol = {
            'solution': f'For {source_type} {stage} issue: {problem_title}. Recommended actions: 1. Analyze root cause 2. Apply corrective maintenance 3. Monitor system recovery 4. Document findings for AI learning.',
            'steps': ['analyze root cause', 'corrective maintenance', 'monitor recovery', 'document findings'],
            'timeline': '1-3 days', 'cost_estimate': '₹10,000-₹50,000',
            'expected_improvement': 'Issue resolution expected',
            'confidence': 0.85
        }
        return default_sol

    def generate_comprehensive_plan(self, source_type, problem_data):
        plan = {
            'source': source_type,
            'problem_title': problem_data.get('title', ''),
            'immediate_actions': [],
            'short_term': [],
            'long_term': [],
            'resource_allocation': {},
            'risk_assessment': [],
            'timeline': '1 week'
        }
        
        if problem_data.get('severity') == 'critical':
            plan['immediate_actions'].append('Emergency shutdown if necessary')
            plan['immediate_actions'].append('Alert maintenance team')
            plan['immediate_actions'].append('Activate backup systems')
        elif problem_data.get('severity') == 'high':
            plan['immediate_actions'].append('Priority inspection scheduled')
            plan['immediate_actions'].append('Reduce load on affected system')
        else:
            plan['immediate_actions'].append('Monitor situation closely')
        
        plan['short_term'] = ['Analyze data patterns', 'Implement corrective measures', 'Verify resolution']
        plan['long_term'] = ['Preventive maintenance schedule', 'System upgrade evaluation', 'Staff training']
        plan['resource_allocation'] = {'personnel': 2, 'budget': '₹25,000-₹1,00,000', 'equipment': 'Standard toolkit'}
        plan['risk_assessment'] = ['Equipment damage if ignored', 'Energy shortage risk', 'Cost of delay']
        
        return plan

    def compare_solutions(self, ai_solution, custom_solution):
        return {
            'ai_solution': ai_solution,
            'custom_solution': custom_solution,
            'comparison': {
                'cost_efficiency': self._compare_cost(ai_solution, custom_solution),
                'time_efficiency': self._compare_time(ai_solution, custom_solution),
                'effectiveness': self._compare_effectiveness(ai_solution, custom_solution)
            },
            'recommendation': 'AI solution is recommended for optimal results unless custom solution addresses specific site constraints.'
        }

    def _compare_cost(self, ai, custom):
        return {'ai': 'Medium', 'custom': 'Variable', 'winner': 'AI'}

    def _compare_time(self, ai, custom):
        return {'ai': 'Faster', 'custom': 'May take longer', 'winner': 'AI'}

    def _compare_effectiveness(self, ai, custom):
        return {'ai': 'High', 'custom': 'Site-specific', 'winner': 'Depends on context'}


class SolutionAnalyzer:
    def __init__(self):
        self.quality_metrics = ['cost', 'time', 'effectiveness', 'safety', 'feasibility']

    def analyze_solution_quality(self, solution_text):
        score = np.random.uniform(70, 98)
        return {
            'quality_score': round(score, 1),
            'metrics': {
                'cost_effectiveness': round(np.random.uniform(70, 95), 1),
                'implementation_time': round(np.random.uniform(1, 5), 1),
                'expected_effectiveness': round(np.random.uniform(75, 98), 1),
                'safety_rating': round(np.random.uniform(80, 100), 1),
                'feasibility': round(np.random.uniform(75, 95), 1)
            },
            'recommendations': ['Consider additional safety measures', 'Review cost implications', 'Validate with field data']
        }
