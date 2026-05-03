import os
import pandas as pd
import torch
from pytorch_forecasting import TimeSeriesDataSet, TemporalFusionTransformer
from lightning.pytorch import Trainer
import lightning.pytorch as pl

# --- PATH LOGIC ---
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT_DIR, "data", "karnataka_grid_data.csv")
MODEL_SAVE_PATH = os.path.join(ROOT_DIR, "models", "tft_model.ckpt")

class BharatGridAI:
    def __init__(self):
        self.data_path = DATA_PATH
        self.model = None
        self.training_ds = None

    def prepare_data(self):
        """Loads and prepares the TimeSeriesDataSet."""
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"CSV not found at {self.data_path}")

        df = pd.read_csv(self.data_path)
        df["Group"] = "Karnataka_Main"
        df["Time_Index"] = range(len(df))
        
        # Ensure 'models' folder exists
        os.makedirs(os.path.join(ROOT_DIR, "models"), exist_ok=True)

        max_prediction_length = 4
        max_encoder_length = 5
        training_cutoff = df["Time_Index"].max() - max_prediction_length

        self.training_ds = TimeSeriesDataSet(
            df[lambda x: x.Time_Index <= training_cutoff],
            time_idx="Time_Index",
            target="Solar_Intensity",
            group_ids=["Group"],
            max_encoder_length=max_encoder_length,
            max_prediction_length=max_prediction_length,
            time_varying_known_reals=["Time_Index"],
            time_varying_unknown_reals=["Solar_Intensity", "Wind_Speed"],
        )

        validation = TimeSeriesDataSet.from_dataset(self.training_ds, df, predict=True, stop_randomization=True)
        
        train_loader = self.training_ds.to_dataloader(train=True, batch_size=4, num_workers=0)
        val_loader = validation.to_dataloader(train=False, batch_size=4, num_workers=0)
        
        return train_loader, val_loader

    def train(self, epochs=10):
        """Runs the training pipeline and saves the model."""
        train_loader, val_loader = self.prepare_data()

        # Initialize Model
        self.model = TemporalFusionTransformer.from_dataset(
            self.training_ds, 
            learning_rate=0.03, 
            hidden_size=16,
            attention_head_size=4,
            dropout=0.1
        )

        trainer = Trainer(
            accelerator="cpu", 
            max_epochs=epochs,
            enable_model_summary=True
        )

        trainer.fit(self.model, train_dataloaders=train_loader, val_dataloaders=val_loader)
        
        # Save the model weights
        trainer.save_checkpoint(MODEL_SAVE_PATH)
        
        # Extract metrics
        val_loss = trainer.callback_metrics.get("val_loss", torch.tensor(0.0)).item()
        return {"val_loss": round(val_loss, 4), "status": "Success"}

    def get_predictions(self, data):
        """Utility for the dashboard to get live predictions."""
        # This would load the saved .ckpt and run inference
        if self.model is None:
            if os.path.exists(MODEL_SAVE_PATH):
                self.model = TemporalFusionTransformer.load_from_checkpoint(MODEL_SAVE_PATH)
            else:
                return "Model not trained yet."
        
        # Inference logic goes here
        return "Prediction Data"

# --- HELPER FOR FRONTEND ---
def run_full_training():
    ai = BharatGridAI()
    metrics = ai.train(epochs=10)
    return metrics