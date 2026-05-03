import numpy as np

def calculate_nmae(y_true, y_pred, capacity_mw):
    """
    Calculate Normalized Mean Absolute Error (nMAE)
    Normalized by plant capacity.
    """
    if len(y_true) == 0:
        return np.nan
    mae = np.mean(np.abs(y_true - y_pred))
    nmae = mae / capacity_mw
    return nmae

def calculate_nrmse(y_true, y_pred, capacity_mw):
    """
    Calculate Normalized Root Mean Squared Error (nRMSE)
    Normalized by plant capacity.
    """
    if len(y_true) == 0:
        return np.nan
    rmse = np.sqrt(np.mean((y_true - y_pred)**2))
    nrmse = rmse / capacity_mw
    return nrmse

def evaluate_predictions(y_true, y_pred, capacity_mw):
    """
    Returns a dictionary of evaluation metrics.
    """
    return {
        'nMAE': calculate_nmae(y_true, y_pred, capacity_mw),
        'nRMSE': calculate_nrmse(y_true, y_pred, capacity_mw)
    }
