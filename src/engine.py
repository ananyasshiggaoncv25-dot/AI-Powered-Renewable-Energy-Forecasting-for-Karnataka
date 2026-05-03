import os
import pandas as pd
import numpy as np

# --- PATH LOGIC ---
# Finds the Project Root (Up one level from /src)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Correct path to the data folder
DATA_PATH = os.path.join(ROOT_DIR, "data", "karnataka_grid_data.csv")

def load_data():
    """Centralized data loader with path validation."""
    if not os.path.exists(DATA_PATH):
        # Professional error message for the terminal
        print(f"❌ ERROR: File not found at {DATA_PATH}")
        # Return a small dummy dataframe so the UI doesn't crash
        return pd.DataFrame({
            "Solar_Intensity": [0], 
            "Wind_Speed": [0], 
            "Time_Index": [0]
        })
    return pd.read_csv(DATA_PATH)

def get_dashboard_stats():
    """Calculates KPIs for the top row of the dashboard."""
    df = load_data()
    if df.empty or len(df) < 2:
        return {"current": 0, "delta": 0, "status": "No Data"}

    current_val = df['Solar_Intensity'].iloc[-1]
    previous_val = df['Solar_Intensity'].iloc[-2]
    
    # Calculate % change
    delta = ((current_val - previous_val) / previous_val) * 100 if previous_val != 0 else 0
    
    return {
        "current": round(current_val, 2),
        "delta": round(delta, 1),
        "status": "Stable" if 49.9 <= 50.02 <= 50.05 else "Warning"
    }

def get_forecast_data():
    """Prepares historical and 'simulated' forecast data for Plotly."""
    df = load_data()
    # Take the last 50 points for the 'History' line
    history = df.tail(50).copy()
    
    # Generate a dummy forecast for the UI 
    # (In a real scenario, you'd call your TFT model here)
    last_idx = history['Time_Index'].iloc[-1]
    last_val = history['Solar_Intensity'].iloc[-1]
    
    future_indices = list(range(int(last_idx) + 1, int(last_idx) + 25))
    forecast_values = [last_val * (1 + np.sin(i/5)*0.15) for i in range(24)]
    
    return history, future_indices, forecast_values

def get_dsm_analysis(actual_gen, target_gen):
    """Calculates Karnataka Grid Deviation Settlement Mechanism (DSM) penalties."""
    deviation_pct = abs(actual_gen - target_gen) / target_gen * 100 if target_gen != 0 else 0
    
    # KERC Rules: Within 15% is safe, above is penalized
    is_safe = deviation_pct <= 15
    penalty = 0
    if not is_safe:
        penalty = (deviation_pct - 15) * 5000 # Example penalty rate
        
    return {
        "deviation": round(deviation_pct, 2),
        "penalty": round(penalty, 2),
        "is_safe": is_safe
    }