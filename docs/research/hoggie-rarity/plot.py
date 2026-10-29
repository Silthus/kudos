import csv
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


HERE = Path(__file__).resolve().parent
rows = list(csv.DictReader((HERE / "results.csv").open()))
figure, axes = plt.subplots(3, 3, figsize=(12, 9), sharex=True)
metrics = [("unique_mean", "Distinct hoggies"), ("ever_epic_mean", "Chance of any epic (%)"), ("ever_legendary_mean", "Chance of any legendary (%)")]
for column, profile in enumerate(["light", "typical", "heavy"]):
    for row, (metric, label) in enumerate(metrics):
        axis = axes[row, column]
        for policy, color, name in [("today", "#6250a4", "Current"), ("proposed", "#127f69", "Proposed")]:
            selected = [item for item in rows if item["profile"] == profile and item["policy"] == policy]
            axis.plot([int(item["week"]) for item in selected], [float(item[metric]) * (100 if row else 1) for item in selected], label=name, color=color, linewidth=2)
        if row == 0:
            axis.set_title(profile.capitalize())
        if column == 0:
            axis.set_ylabel(label)
        if row:
            axis.set_ylim(0, 105)
        if row == 2:
            axis.set_xlabel("Week")
        axis.set_xticks([1, 4, 8, 12])
        axis.grid(alpha=0.2)
axes[0, 0].legend()
figure.suptitle("Synthetic 12-week collections: more early finds, slower high rarities", fontsize=14)
figure.text(0.5, 0.01, "10,000 simulated members per profile/policy. Fixed action schedules; immediate reward turns. No production usage data.", ha="center", fontsize=9)
figure.tight_layout(rect=[0, 0.035, 1, 0.96])
matplotlib.rcParams["svg.hashsalt"] = "hoggie-rarity"
figure.savefig(HERE / "comparison.svg", metadata={"Date": None})
chart = HERE / "comparison.svg"
chart.write_text("\n".join(line.rstrip() for line in chart.read_text().splitlines()) + "\n")
