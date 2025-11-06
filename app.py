from flask import Flask, render_template, request, jsonify
import json
import os


app = Flask(__name__)


BASE_DIR = os.path.dirname(__file__)
RULES_PATH = os.path.join(BASE_DIR, 'rules.json')


with open(RULES_PATH, 'r', encoding='utf-8') as f:
    RULES = json.load(f)


# Build lists for options
WORKPIECES = list(RULES.keys())
TOOL_MATERIALS = set()
for wp in RULES.values():
    for tm in wp.get('recommendations', {}).keys():
        TOOL_MATERIALS.add(tm)
TOOL_MATERIALS = sorted(list(TOOL_MATERIALS))

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/options')
def options_api():
    return jsonify({
        'workpieces': WORKPIECES,
        'tool_materials': TOOL_MATERIALS
})


@app.route('/api/recommend', methods=['POST'])
def recommend_api():
    data = request.get_json() or {}
    wp_name = data.get('workpiece_material')
    tool_choice = data.get('tool_material') # may be None or empty
    operation = data.get('operation') # 'roughing' or 'finishing' (optional)


    if not wp_name or wp_name not in RULES:
        return jsonify({'error': 'Material benda kerja tidak valid.'}), 400


    wp_rules = RULES[wp_name]


# If tool chosen and has direct recommendation
    result = {
    'workpiece': wp_name,
    'operation': operation or 'unspecified',
    'recommendations': {}
    }


    if tool_choice:
        rec = wp_rules.get('recommendations', {}).get(tool_choice)
        if not rec:
            return jsonify({'error': f'Rekomendasi untuk pahat "{tool_choice}" pada material ini tidak tersedia.'}), 400
        result['recommendations'][tool_choice] = rec
    else:
    # return recommendations for all tool materials in this workpiece
        result['recommendations'] = wp_rules.get('recommendations', {})


# attach general notes
    result['general_notes'] = wp_rules.get('general_notes', '')


# simple action plan: choose first recommendation if tool_choice not provided
    if tool_choice:
        chosen = result['recommendations'][tool_choice]
    else:
    # pick best default order: prefer Carbide then HSS then Ceramic then CBN
        prefs = ['Carbide', 'HSS', 'Ceramic', 'CBN']
        chosen = None
        for p in prefs:
            if p in result['recommendations']:
                chosen = result['recommendations'][p]
                chosen_tool = p
                break
        if chosen is None:
    # fallback to any
            for k, v in result['recommendations'].items():
                chosen = v
                chosen_tool = k
                break
        result['chosen_tool'] = chosen_tool
        result['chosen'] = chosen


    return jsonify({'recommendation': result})


if __name__ == '__main__':
    app.run(debug=True)