"""
Data Hub for Karnataka Renewable Energy Forecasting
Loads and provides access to featured generation data for ML models.
"""
import os
import pandas as pd
from typing import Optional

class DataHub:
    def __init__(self, data_path: Optional[str] = None):
        if data_path is None:
            # Default path relative to this file
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            data_path = os.path.join(base_dir, 'data', 'processed', 'featured_generation.csv')
        
        self.data_path = data_path
        self._data: Optional[pd.DataFrame] = None
    
    def load_data(self) -> pd.DataFrame:
        """Load the featured generation data."""
        if self._data is None:
            if not os.path.exists(self.data_path):
                raise FileNotFoundError(f"Data file not found: {self.data_path}")
            self._data = pd.read_csv(self.data_path)
            print(f"Loaded data with {len(self._data)} rows from {self.data_path}")
        return self._data
    
    def get_asset_data(self, asset_id: str) -> pd.DataFrame:
        """Get data for a specific asset."""
        data = self.load_data()
        return data[data['asset_id'] == asset_id].copy()
    
    def get_available_assets(self) -> list[str]:
        """Get list of available asset IDs."""
        data = self.load_data()
        return data['asset_id'].unique().tolist()

# Global instance
data_hub = DataHub()

if __name__ == "__main__":
    # Example usage
    data = data_hub.load_data()
    print("Available assets:", data_hub.get_available_assets())
    print("Sample data:")
    print(data.head())