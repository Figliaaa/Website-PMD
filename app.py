from flask import Flask, render_template, request, jsonify
import json
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(__file__)
RULES_PATH = os.path.join(BASE_DIR, 'rules.json')

with open(RULES_PATH, 'r', encoding='utf-8') as f:
    RULES = json.load(f)

WORKPIECES = list(RULES.keys())
TOOL_MATERIALS = set()
for wp in RULES.values():
    # some entries might not have 'recommendations'
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
    tool_choice = data.get('tool_material')  
    operation = data.get('operation')  

    if not wp_name or wp_name not in RULES:
        return jsonify({'error': 'Material benda kerja tidak valid.'}), 400

    wp_rules = RULES[wp_name]

    result = {
        'workpiece': wp_name,
        'operation': operation or 'unspecified',
        'recommendations': {}
    }

    result['recommendations'] = wp_rules.get('recommendations', {})

    if operation and 'operation' in wp_rules and operation in wp_rules['operation']:
        result['operation_details'] = wp_rules['operation'][operation]

    if tool_choice:
        rec = wp_rules.get('recommendations', {}).get(tool_choice)
        if not rec:
            return jsonify({'error': f'Rekomendasi untuk pahat \"{tool_choice}\" pada material ini tidak tersedia.'}), 400
        result['recommendations'] = {tool_choice: rec}  # keep only selected tool in recommendations
        result['chosen_tool'] = tool_choice
        result['chosen'] = rec
    else:
        if 'operation_details' in result:
            op_recommended = result['operation_details'].get('recommended_tools', [])
            prefs = op_recommended + [p for p in ['Carbide', 'HSS', 'Ceramic', 'CBN'] if p not in op_recommended]
        else:
            prefs = ['Carbide', 'HSS', 'Ceramic', 'CBN']

        chosen = None
        chosen_tool = None
        for p in prefs:
            if p in result['recommendations']:
                chosen = result['recommendations'][p]
                chosen_tool = p
                break

        if chosen is None:
            for k, v in result['recommendations'].items():
                chosen = v
                chosen_tool = k
                break

        if chosen is None:
            return jsonify({'error': 'Tidak ada rekomendasi pahat tersedia untuk material/operasi ini.'}), 400

        result['chosen_tool'] = chosen_tool
        result['chosen'] = chosen

    return jsonify({'recommendation': result})


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
