import argparse
import csv
import json
import math
import random
import re
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RARITIES = ["common", "uncommon", "rare", "epic", "legendary"]
OLD_WEIGHTS = [50, 28, 14, 6, 2]
KUDOS_WEIGHTS = [50, 28, 18, 3.5, 0.5]
LOW_WEIGHTS = [50, 28, 14, 0, 0]
PROFILES = {
    "light": {"hugs": [1, 0, 0, 1, 0], "received": [0, 1, 0, 0, 1], "kudos": [1, 0, 0, 0, 0], "every": 2, "received_kudos": 0.5, "circle": 12},
    "typical": {"hugs": [2, 2, 2, 2, 2], "received": [1, 1, 1, 1, 1], "kudos": [0, 1, 0, 1, 0], "every": 1, "received_kudos": 1, "circle": 48},
    "heavy": {"hugs": [10, 10, 10, 10, 10], "received": [4, 4, 4, 4, 4], "kudos": [2, 2, 2, 2, 2], "every": 1, "received_kudos": 5, "circle": 160},
}
THRESHOLDS = {"people": [1, 10, 25, 50], "teams": [1, 5, 15, 50], "reach": [3, 10, 25, 50], "hoggies": [10, 40, 100, 151], "kudos": [1, 25, 100, 500]}


def catalogue():
    source = (ROOT / "convex/hoggies/catalogue.ts").read_text()
    section = source.split("const versionOne:")[1].split("const versionTwoCrests:")[0]
    pools = []
    for rarity in RARITIES:
        block = re.search(rf"  {rarity}: \[(.*?)\n  \],", section, re.S).group(1)
        pools.append(re.findall(r'^    \["([^"]+)",', block, re.M))
    assert [len(pool) for pool in pools] == [60, 40, 30, 15, 6]
    return pools


POOLS = catalogue()


def level_of(xp):
    level = 1
    while (20 if level + 1 == 2 else 50 * level * (level - 1)) <= xp:
        level += 1
    return level


def chances(weights, floor=0):
    allowed = [weight if i >= floor else 0 for i, weight in enumerate(weights)]
    return [weight / sum(allowed) for weight in allowed]


class Member:
    def __init__(self, seed, policy, profile, hug_rate, kudos_weights, forge):
        self.rng = random.Random(seed)
        self.policy = policy
        self.profile = profile
        self.hug_rate = hug_rate
        self.kudos_weights = kudos_weights
        self.forge_enabled = forge
        self.counts = [Counter() for _ in RARITIES]
        self.drops = Counter()
        self.duplicates = 0
        self.xp = 0
        self.level = 1
        self.people = set()
        self.teams = set()
        self.milestones = set()
        self.kudos_count = 0
        self.kudos_days = set()
        self.onboarding = set()
        self.first_epic = None
        self.first_legendary = None
        self.day = 0
        roster = list(range(profile["circle"]))
        random.Random(809).shuffle(roster)
        self.roster = roster
        self.draw("welcome", floor=2)

    def draw(self, source, floor=0, achievement=False, exact=None):
        weights = OLD_WEIGHTS if self.policy == "today" else (self.kudos_weights if source == "kudos" else LOW_WEIGHTS)
        pools = [list(pool) for pool in POOLS]
        if exact is not None:
            weights = [int(i == exact) for i in range(5)]
            pools = [[hoggie for hoggie in pool if not self.counts[i][hoggie]] for i, pool in enumerate(pools)]
            if not pools[exact]:
                pools[exact] = POOLS[exact]
        elif achievement and self.policy == "today":
            fresh = [[hoggie for hoggie in pool if not self.counts[i][hoggie]] for i, pool in enumerate(pools)]
            if any(fresh[i] for i in range(floor, 5)):
                pools = fresh
        weights = [weight if i >= floor and pools[i] else 0 for i, weight in enumerate(weights)]
        rarity = self.rng.choices(range(5), weights=weights)[0]
        hoggie = self.rng.choice(pools[rarity])
        self.duplicates += int(self.counts[rarity][hoggie] > 0)
        self.counts[rarity][hoggie] += 1
        self.drops[source] += 1
        if rarity == 3 and self.first_epic is None:
            self.first_epic = self.day // 7 + 1
        if rarity == 4 and self.first_legendary is None:
            self.first_legendary = self.day // 7 + 1

    def settle(self):
        while True:
            before = sum(self.drops.values())
            while self.level < level_of(self.xp):
                self.level += 1
                self.draw("level")
                self.draw("level")
                self.draw("level", floor=2)
            reached = {person // 4 for person in self.people}
            complete = {team for team in reached if all(team * 4 + offset in self.people for offset in range(4))}
            for team in sorted(complete - self.teams):
                self.teams.add(team)
                self.draw("team", floor=2, achievement=True)
            facts = {"people": len(self.people), "teams": len(self.teams), "reach": len(reached), "hoggies": sum(len(counts) for counts in self.counts), "kudos": self.kudos_count}
            for milestone, thresholds in THRESHOLDS.items():
                for tier, threshold in enumerate(thresholds):
                    key = (milestone, tier)
                    if facts[milestone] >= threshold and key not in self.milestones:
                        self.milestones.add(key)
                        self.draw("milestone", floor=tier + 1 if self.policy == "today" else min(tier + 1, 2), achievement=True)
            if self.forge_enabled:
                ceiling = 4 if self.policy == "today" else 2
                for rarity in range(ceiling):
                    for hoggie in sorted(self.counts[rarity]):
                        while self.counts[rarity][hoggie] >= 4:
                            self.counts[rarity][hoggie] -= 3
                            self.draw("forge", exact=rarity + 1)
            if sum(self.drops.values()) == before:
                break

    def kudos(self, day):
        if len(self.onboarding) == 3:
            self.weekly_eligible_kudos += 1
        person = self.roster[self.kudos_count % len(self.roster)]
        new_person = person not in self.people
        self.people.add(person)
        self.kudos_count += 1
        self.kudos_days.add(day)
        self.xp += 10 + 15
        self.draw("kudos")
        finished = []
        if "first" not in self.onboarding:
            finished.append("first")
        elif new_person and "new" not in self.onboarding:
            finished.append("new")
        if len(self.kudos_days) >= 2 and "days" not in self.onboarding:
            finished.append("days")
        for step in finished:
            self.onboarding.add(step)
            self.xp += 50
            self.draw("onboarding")

    def week(self, week):
        profile = self.profile
        self.weekly_eligible_kudos = 0
        kudos_this_week = sum(profile["kudos"]) if week % profile["every"] == 0 else 0
        self.xp += (int(week % 2 == 0) if profile["received_kudos"] == 0.5 else profile["received_kudos"]) * 5
        first_received = True
        for weekday in range(5):
            self.day = week * 7 + weekday
            hugs = profile["hugs"][weekday]
            received = profile["received"][weekday]
            self.xp += hugs + received
            if self.policy == "proposed":
                self.xp += 9 * int(hugs > 0) + 4 * int(received > 0 and first_received)
                found = False
                for _ in range(hugs):
                    if not found and self.rng.random() < self.hug_rate:
                        self.draw("hug")
                        found = True
            if received:
                first_received = False
            for _ in range(profile["kudos"][weekday] if kudos_this_week else 0):
                self.kudos(self.day)
            self.settle()
        quests = (1 + int(kudos_this_week > 0)) if self.policy == "proposed" else min(self.weekly_eligible_kudos, 2)
        for _ in range(quests):
            self.xp += 20
            self.draw("weekly")
        self.settle()
        return {"unique": sum(len(counts) for counts in self.counts), "epic": len(self.counts[3]), "legendary": len(self.counts[4]), "drops": sum(self.drops.values()), "duplicates": self.duplicates, "level": self.level, "ever_epic": int(self.first_epic is not None), "ever_legendary": int(self.first_legendary is not None), **{f"source_{source}": self.drops[source] for source in ["welcome", "kudos", "hug", "level", "team", "milestone", "weekly", "onboarding", "forge"]}}


def run(trials, hug_rate, kudos_weights, forge):
    observations = {}
    for name, profile in PROFILES.items():
        for policy in ["today", "proposed"]:
            for trial in range(trials):
                member = Member(20261029 + trial, policy, profile, hug_rate, kudos_weights, forge)
                for week in range(12):
                    row = member.week(week)
                    bucket = observations.setdefault((name, policy, week + 1), {key: [] for key in row})
                    for key, value in row.items():
                        bucket[key].append(value)
    rows = []
    for (name, policy, week), bucket in observations.items():
        row = {"profile": name, "policy": policy, "week": week}
        for key, values in bucket.items():
            ordered = sorted(values)
            row[f"{key}_mean"] = round(sum(values) / trials, 4)
            if key in ["unique", "epic", "legendary", "drops"]:
                row[f"{key}_p10"] = ordered[math.floor((trials - 1) * 0.1)]
                row[f"{key}_p90"] = ordered[math.floor((trials - 1) * 0.9)]
        rows.append(row)
    return rows


def verify():
    assert len(set(hoggie for pool in POOLS for hoggie in pool)) == 151
    assert abs(sum(chances(OLD_WEIGHTS, 2)[3:]) - 8 / 22) < 1e-12
    assert chances(OLD_WEIGHTS, 3) == [0, 0, 0, 0.75, 0.25]
    assert chances(LOW_WEIGHTS, 2) == [0, 0, 1, 0, 0]
    assert [level_of(xp) for xp in [0, 19, 20, 99, 100, 299, 300]] == [1, 1, 2, 2, 3, 3, 4]
    member = Member(123, "proposed", PROFILES["heavy"], 1, KUDOS_WEIGHTS, True)
    for _ in range(500):
        member.draw("hug")
    member.settle()
    assert not member.counts[3] and not member.counts[4]
    print("Verified catalogue, floor normalization, XP boundaries, and hug-only rarity ceiling.")


def verify_results(rows, trials, kudos_weights):
    for row in rows:
        if row["policy"] != "proposed":
            continue
        profile = PROFILES[row["profile"]]
        opportunities = math.ceil(row["week"] / profile["every"]) * sum(profile["kudos"])
        for rarity, index in [("epic", 3), ("legendary", 4)]:
            chance = 1 - (1 - kudos_weights[index] / sum(kudos_weights)) ** opportunities
            tolerance = 5 * math.sqrt(chance * (1 - chance) / trials) + 0.0001
            assert abs(row[f"ever_{rarity}_mean"] - chance) < tolerance, (row, rarity, chance)
    print("Verified every proposed weekly high-rarity probability against the closed-form kudos-only calculation.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--trials", type=int, default=10000)
    parser.add_argument("--hug-rate", type=float, default=0.2)
    parser.add_argument("--keep-kudos-weights", action="store_true")
    parser.add_argument("--no-forge", action="store_true")
    parser.add_argument("--output", type=Path, default=HERE / "results.csv")
    args = parser.parse_args()
    verify()
    assert args.trials > 0 and 0 <= args.hug_rate <= 1
    kudos_weights = OLD_WEIGHTS if args.keep_kudos_weights else KUDOS_WEIGHTS
    rows = run(args.trials, args.hug_rate, kudos_weights, not args.no_forge)
    verify_results(rows, args.trials, kudos_weights)
    with args.output.open("w") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps([row for row in rows if row["week"] in [2, 4, 8, 12]], indent=2))


if __name__ == "__main__":
    main()
