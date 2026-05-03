import random
import time
# Import the logic you wrote in your other files
from src.wind_logic import predict_turbine_power
from solar_logic import predict_solar_power

def run_15_minute_loop():
    print("--- ⚡ Starting Karnataka Grid Simulation ⚡ ---")
    
    for cycle in range(1, 6):  # We'll run 5 cycles
        print(f"\n[Cycle {cycle}] Time: {cycle * 15} minutes past 10:00 AM")
        
        # 1. Simulate real-world weather inputs
        sim_wind = random.uniform(0, 30) # Random wind speed
        sim_sun = random.randint(0, 150)  # Random sun intensity
        
        # 2. Feed those inputs into your Physics Rules
        print(f"Current Wind: {sim_wind:.1f} m/s | Current Sun: {sim_sun}")
        
        wind_output = predict_turbine_power(sim_wind)
        solar_output = predict_solar_power(sim_sun)
        
        total_grid_power = wind_output + solar_output
        print(f">>> TOTAL GRID OUTPUT: {total_grid_power:.2f} Units")
        
        time.sleep(2) # Pause so you can see the loop happening

run_15_minute_loop()