import json

with open('45774.json', 'r') as f:
    data = json.load(f)

for key, item in data["panels"]["items"].items():
    if isinstance(item, dict) and "panel_type" in item:
        item["panel_type"] = "Generic_Wall"

with open('45774_original.json', 'w') as f:
    json.dump(data, f, indent=4)