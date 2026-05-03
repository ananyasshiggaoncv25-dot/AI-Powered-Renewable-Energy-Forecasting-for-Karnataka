import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta

def generate_synthetic_data(start_date='2022-01-01', end_date='2023-12-31', output_path='data/raw/synthetic_generation.csv'):
    print(f"Generating synthetic data from {start_date} to {end_date}...")
    
    # Define date range
    dates = pd.date_range(start=start_date, end=end_date, freq='h')
    n_samples = len(dates)
    
    # Define clusters
    clusters = [
        {'asset_id': 'SOLAR_PAVAGADA', 'asset_type': 'Solar', 'capacity_mw': 2050, 'lat': 14.1, 'lon': 77.27},
        {'asset_id': 'WIND_CHITRADURGA', 'asset_type': 'Wind', 'capacity_mw': 1500, 'lat': 14.23, 'lon': 76.4}
    ]
    
    all_data = []
    
    for cluster in clusters:
        df = pd.DataFrame({'timestamp': dates})
        df['asset_id'] = cluster['asset_id']
        df['asset_type'] = cluster['asset_type']
        df['capacity_mw'] = cluster['capacity_mw']
        df['latitude'] = cluster['lat']
        df['longitude'] = cluster['lon']
        
        # Time features
        hour = df['timestamp'].dt.hour
        dayofyear = df['timestamp'].dt.dayofyear
        
        # General weather
        # Temperature: Base 25C + seasonal variation + diurnal variation + noise
        seasonal_temp = 5 * np.sin(2 * np.pi * dayofyear / 365)
        diurnal_temp = 5 * np.sin(2 * np.pi * (hour - 6) / 24)
        df['temperature_c'] = 25 + seasonal_temp + diurnal_temp + np.random.normal(0, 1, n_samples)
        
        # Cloud cover (0-100%): random walk bounded to [0, 100]
        cloud_cover = np.zeros(n_samples)
        cloud_cover[0] = np.random.uniform(0, 50)
        for i in range(1, n_samples):
            step = np.random.normal(0, 5)
            cloud_cover[i] = np.clip(cloud_cover[i-1] + step, 0, 100)
        df['cloud_cover_pct'] = cloud_cover
        
        if cluster['asset_type'] == 'Solar':
            # Solar specific: GHI based on hour (bell curve peaking at 12:00)
            ghi_ideal = np.where((hour >= 6) & (hour <= 18), 1000 * np.sin(np.pi * (hour - 6) / 12), 0)
            
            # GHI reduced by cloud cover
            df['ghi'] = ghi_ideal * (1 - (df['cloud_cover_pct'] / 100) * 0.75) # max 75% reduction from clouds
            df['wind_speed_ms'] = 0.0 # not highly relevant for solar generation model
            df['wind_direction_deg'] = 0.0
            
            # Generation: Proportional to GHI, reduced by high temp (>25C reduces efficiency)
            temp_penalty = np.where(df['temperature_c'] > 25, (df['temperature_c'] - 25) * 0.005, 0)
            efficiency = 0.85 * (1 - temp_penalty)
            
            # Max capacity achieved at 1000 GHI under ideal conditions
            gen = (df['ghi'] / 1000) * cluster['capacity_mw'] * efficiency
            # Add noise and clip
            df['generation_mw'] = np.clip(gen + np.random.normal(0, cluster['capacity_mw'] * 0.01, n_samples), 0, cluster['capacity_mw'])
            
            # Zero generation at night
            df.loc[df['ghi'] <= 0, 'generation_mw'] = 0
            
        elif cluster['asset_type'] == 'Wind':
            df['ghi'] = 0.0
            
            # Wind specific: Wind speed follows Weibull-like distribution, higher in monsoon (day 150-250)
            seasonal_wind = np.where((dayofyear >= 150) & (dayofyear <= 250), 3, 0) # Higher wind in monsoon
            diurnal_wind = 1.5 * np.sin(2 * np.pi * hour / 24) # Windier at certain times
            
            base_wind = np.random.weibull(2, n_samples) * 5 # Base wind ~ 4.4 m/s
            df['wind_speed_ms'] = np.clip(base_wind + seasonal_wind + diurnal_wind, 0, 25)
            
            df['wind_direction_deg'] = np.random.uniform(0, 360, n_samples)
            
            # Generation: Wind power curve
            # cut-in: 3 m/s, rated: 12 m/s, cut-out: 25 m/s
            gen = np.zeros(n_samples)
            
            # Linear rise from cut-in to rated
            mask_linear = (df['wind_speed_ms'] >= 3) & (df['wind_speed_ms'] < 12)
            gen[mask_linear] = cluster['capacity_mw'] * ((df['wind_speed_ms'][mask_linear] - 3) / (12 - 3)) ** 3
            
            # Constant at rated capacity
            mask_rated = (df['wind_speed_ms'] >= 12) & (df['wind_speed_ms'] < 25)
            gen[mask_rated] = cluster['capacity_mw']
            
            df['generation_mw'] = np.clip(gen + np.random.normal(0, cluster['capacity_mw'] * 0.02, n_samples), 0, cluster['capacity_mw'])
            
        all_data.append(df)
        
    final_df = pd.concat(all_data, ignore_index=True)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    final_df.to_csv(output_path, index=False)
    print(f"Successfully generated {len(final_df)} rows of synthetic data at '{output_path}'")
    return final_df

if __name__ == "__main__":
    generate_synthetic_data()
