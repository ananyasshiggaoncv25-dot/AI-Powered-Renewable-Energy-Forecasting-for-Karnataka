import pandas as pd
import numpy as np
import sys
import os

# Add src to path to import evaluation metrics
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from src.evaluation.metrics import evaluate_predictions

def load_data(filepath='data/raw/synthetic_generation.csv'):
    df = pd.read_csv(filepath)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    return df

def run_persistence_baseline(df, test_start='2023-01-01'):
    """
    Day-ahead persistence: generation tomorrow is same as generation today.
    Shift by 24 hours.
    """
    print("\n--- Running Persistence Baseline ---")
    results = []
    
    for asset_id in df['asset_id'].unique():
        asset_df = df[df['asset_id'] == asset_id].copy()
        asset_df = asset_df.sort_values('timestamp')
        capacity = asset_df['capacity_mw'].iloc[0]
        
        # Persistence prediction
        asset_df['pred_persistence'] = asset_df['generation_mw'].shift(24)
        
        # Filter for test set
        test_df = asset_df[asset_df['timestamp'] >= test_start].dropna(subset=['pred_persistence'])
        
        metrics = evaluate_predictions(test_df['generation_mw'].values, test_df['pred_persistence'].values, capacity)
        print(f"{asset_id} Persistence -> nMAE: {metrics['nMAE']:.4f}, nRMSE: {metrics['nRMSE']:.4f}")
        results.append({'asset_id': asset_id, 'model': 'Persistence', **metrics})
        
    return pd.DataFrame(results)

def run_climatology_baseline(df, test_start='2023-01-01'):
    """
    Climatology: average generation for a given month and hour of the day from training data.
    """
    print("\n--- Running Climatology Baseline ---")
    results = []
    
    df['month'] = df['timestamp'].dt.month
    df['hour'] = df['timestamp'].dt.hour
    
    train_df = df[df['timestamp'] < test_start]
    test_df = df[df['timestamp'] >= test_start].copy()
    
    # Calculate climatology profile per asset, month, and hour
    climatology = train_df.groupby(['asset_id', 'month', 'hour'])['generation_mw'].mean().reset_index()
    climatology = climatology.rename(columns={'generation_mw': 'pred_climatology'})
    
    for asset_id in df['asset_id'].unique():
        asset_test = test_df[test_df['asset_id'] == asset_id].copy()
        capacity = asset_test['capacity_mw'].iloc[0]
        
        # Merge climatology profile into test set
        asset_test = asset_test.merge(climatology[climatology['asset_id'] == asset_id], on=['asset_id', 'month', 'hour'], how='left')
        
        # Fill NaN if any (e.g. if some month/hour was entirely missing in train, fallback to 0)
        asset_test['pred_climatology'] = asset_test['pred_climatology'].fillna(0)
        
        metrics = evaluate_predictions(asset_test['generation_mw'].values, asset_test['pred_climatology'].values, capacity)
        print(f"{asset_id} Climatology -> nMAE: {metrics['nMAE']:.4f}, nRMSE: {metrics['nRMSE']:.4f}")
        results.append({'asset_id': asset_id, 'model': 'Climatology', **metrics})
        
    return pd.DataFrame(results)

if __name__ == "__main__":
    filepath = 'data/raw/synthetic_generation.csv'
    if not os.path.exists(filepath):
        print(f"Error: Could not find {filepath}. Please run make_synthetic_data.py first.")
        sys.exit(1)
        
    df = load_data(filepath)
    
    res_pers = run_persistence_baseline(df)
    res_clim = run_climatology_baseline(df)
    
    print("\n--- Summary ---")
    summary = pd.concat([res_pers, res_clim]).sort_values(by='asset_id')
    print(summary.to_string(index=False))
