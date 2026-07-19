import kagglehub
import pandas as pd
import json
import os
import random
from datetime import datetime, timedelta

path = kagglehub.dataset_download("datasetengineer/sustainable-sports-event-management-dataset-ssem")
files = os.listdir(path)
csv_file = [f for f in files if f.endswith('.csv')][0]
df = pd.read_csv(os.path.join(path, csv_file))

# Map Waste Generation categorical values to numeric fill levels
waste_mapping = {
    'Low': 25,
    'Moderate': 55,
    'High': 85
}

# Define our FIFA 2026 bins
bins = [
    {'bin_id': 'BIN-AZT1', 'zone': 'Estadio Azteca'},
    {'bin_id': 'BIN-MET1', 'zone': 'MetLife Stadium'},
    {'bin_id': 'BIN-ATT1', 'zone': 'AT&T Stadium'},
    {'bin_id': 'BIN-SOF1', 'zone': 'SoFi Stadium'},
    {'bin_id': 'BIN-BCP1', 'zone': 'BC Place'},
    {'bin_id': 'BIN-BMO1', 'zone': 'BMO Field'}
]

# Generate synthetic waste data based on the dataset
generated_bins = []
base_time = datetime.now()

# Sample a subset of rows from the dataset (e.g. 50 events)
sample_df = df.sample(50).reset_index(drop=True)

for idx, row in sample_df.iterrows():
    b = random.choice(bins)
    
    waste_category = row.get('Waste Generation', 'Moderate')
    base_fill = waste_mapping.get(waste_category, 50)
    
    # Add some random noise to the fill level
    fill_level = min(100, max(0, base_fill + random.uniform(-15, 15)))
    
    timestamp = (base_time + timedelta(minutes=idx * 5)).isoformat()
    
    generated_bins.append({
        'bin_id': b['bin_id'],
        'zone': b['zone'],
        'fill_level': round(fill_level, 1),
        'timestamp': timestamp,
        'sustainability_score': row.get('Sustainability Score', 'Moderate')
    })

bins_df = pd.DataFrame(generated_bins)
bins_df.to_csv('bins_data.csv', index=False)
print(f"Generated bins_data.csv with {len(bins_df)} records.")

with open('bins_data.json', 'w') as f:
    json.dump(generated_bins, f, indent=4)
print("Generated bins_data.json")

# Generate synthetic zone data based on the dataset
zones = [
    {'zone_id': 'Estadio Azteca', 'capacity': 87523},
    {'zone_id': 'MetLife Stadium', 'capacity': 82500},
    {'zone_id': 'AT&T Stadium', 'capacity': 80000},
    {'zone_id': 'SoFi Stadium', 'capacity': 70240},
    {'zone_id': 'BC Place', 'capacity': 54500}
]

generated_zones = []

# Map Event Scale to occupancy factor
scale_mapping = {
    'Local': 0.3,
    'National': 0.6,
    'International': 0.95
}

for idx, row in sample_df.iterrows():
    z = random.choice(zones)
    
    event_scale = row.get('Event Scale', 'National')
    base_factor = scale_mapping.get(event_scale, 0.6)
    
    # Random occupancy based on scale
    occupancy = int(z['capacity'] * min(1.0, max(0.1, base_factor + random.uniform(-0.15, 0.15))))
    
    timestamp = (base_time + timedelta(minutes=idx * 5)).isoformat()
    
    generated_zones.append({
        'zone_id': z['zone_id'],
        'occupancy': occupancy,
        'capacity': z['capacity'],
        'timestamp': timestamp,
        'sustainability_score': row.get('Sustainability Score', 'Moderate')
    })

zones_df = pd.DataFrame(generated_zones)
zones_df.to_csv('zones_data.csv', index=False)
print(f"Generated zones_data.csv with {len(zones_df)} records.")

with open('zones_data.json', 'w') as f:
    json.dump(generated_zones, f, indent=4)
print("Generated zones_data.json")
