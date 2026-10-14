# getBook on a running local backend (#190)

A disposable `convex-local-backend` on 127.0.0.1:5610/5611 deployed from this branch, with the handshake mock on 5612 serving PostHog's flag definitions. Flag override, local only: `MOCK_FLAGS_ON=xp-levels,unlocks,achievements` beside `website`, then `xp-levels,unlocks` for step 7. Unlocks and the Book launched for a placeholder user before anyone joined (`feedback/unlockFilter:unopenedReplyOf`); Juno and Rowan were imported after, Juno with the zone Europe/Berlin and a session from imported `users` and `authSessions` rows. No cloud deployment was touched.

## 1. Juno joined after the launch, at level 1: the Book is locked
$ npx convex run website/book:getBook {} --identity {"subject":"ss7cxynxa5n3j42g4f6zde7k3x8g9yjw|jx7anmjs33t28wmdx85p16wm5h8g9vmk"}
{
  "kind": "locked",
  "level": 4
}

## 2. An unlocks row makes the Book ready (as a level-4 levelReached would)
$ npx convex run website/book:getBook {} --identity {"subject":"ss7cxynxa5n3j42g4f6zde7k3x8g9yjw|jx7anmjs33t28wmdx85p16wm5h8g9vmk"}
{
  "kind": "ready"
}

## 3. Juno opens the Book (openedAt set): getBook answers her ladders
$ npx convex run website/book:getBook {} --identity {"subject":"ss7cxynxa5n3j42g4f6zde7k3x8g9yjw|jx7anmjs33t28wmdx85p16wm5h8g9vmk"}
{
  "kind": "book",
  "ladders": [
    {
      "count": 0,
      "counts": "kudos given",
      "ladder": "generosity",
      "name": "Generosity",
      "next": {
        "at": 1,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 1,
          "earnedAt": null,
          "name": "First Thanks",
          "tier": "bronze"
        },
        {
          "at": 25,
          "earnedAt": null,
          "name": "Generous Soul",
          "tier": "silver"
        },
        {
          "at": 100,
          "earnedAt": null,
          "name": "Heart of the Team",
          "tier": "gold"
        },
        {
          "at": 500,
          "earnedAt": null,
          "name": "Patron of Praise",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 0,
      "counts": "kudos received",
      "ladder": "recognition",
      "name": "Recognition",
      "next": {
        "at": 1,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 1,
          "earnedAt": null,
          "name": "Noticed",
          "tier": "bronze"
        },
        {
          "at": 25,
          "earnedAt": null,
          "name": "Appreciated",
          "tier": "silver"
        },
        {
          "at": 100,
          "earnedAt": null,
          "name": "Highly Valued",
          "tier": "gold"
        },
        {
          "at": 500,
          "earnedAt": null,
          "name": "Hall of Fame",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 0,
      "counts": "different people thanked",
      "ladder": "connections",
      "name": "Connections",
      "next": {
        "at": 3,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 3,
          "earnedAt": null,
          "name": "Friendly Face",
          "tier": "bronze"
        },
        {
          "at": 6,
          "earnedAt": null,
          "name": "Connector",
          "tier": "silver"
        },
        {
          "at": 12,
          "earnedAt": null,
          "name": "Social Butterfly",
          "tier": "gold"
        },
        {
          "at": 24,
          "earnedAt": null,
          "name": "Constellation Maker",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 0,
      "counts": "days with a kudos given",
      "ladder": "dependability",
      "name": "Dependability",
      "next": {
        "at": 10,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 10,
          "earnedAt": null,
          "name": "Regular",
          "tier": "bronze"
        },
        {
          "at": 30,
          "earnedAt": null,
          "name": "Mainstay",
          "tier": "silver"
        },
        {
          "at": 100,
          "earnedAt": null,
          "name": "Pillar",
          "tier": "gold"
        },
        {
          "at": 250,
          "earnedAt": null,
          "name": "Cornerstone",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 0,
      "counts": "days thanking 3+ different people",
      "ladder": "applause",
      "name": "Applause",
      "next": {
        "at": 3,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 3,
          "earnedAt": null,
          "name": "Shout-out",
          "tier": "bronze"
        },
        {
          "at": 10,
          "earnedAt": null,
          "name": "Hype Squad",
          "tier": "silver"
        },
        {
          "at": 30,
          "earnedAt": null,
          "name": "Thunderous Applause",
          "tier": "gold"
        },
        {
          "at": 100,
          "earnedAt": null,
          "name": "Grand Chorus",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 0,
      "counts": "calendar months with a kudos given",
      "ladder": "seasons",
      "name": "Seasons",
      "next": {
        "at": 1,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 1,
          "earnedAt": null,
          "name": "First Chapter",
          "tier": "bronze"
        },
        {
          "at": 3,
          "earnedAt": null,
          "name": "Season of Thanks",
          "tier": "silver"
        },
        {
          "at": 6,
          "earnedAt": null,
          "name": "Half-Year Hero",
          "tier": "gold"
        },
        {
          "at": 12,
          "earnedAt": null,
          "name": "Year of Gratitude",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 0,
      "counts": "thanks again after 30+ days",
      "ladder": "old-friends",
      "name": "Old Friends",
      "next": {
        "at": 1,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 1,
          "earnedAt": null,
          "name": "Remembered",
          "tier": "bronze"
        },
        {
          "at": 3,
          "earnedAt": null,
          "name": "Old Friends",
          "tier": "silver"
        },
        {
          "at": 6,
          "earnedAt": null,
          "name": "Long Memory",
          "tier": "gold"
        },
        {
          "at": 12,
          "earnedAt": null,
          "name": "Evergreen",
          "tier": "diamond"
        }
      ]
    }
  ],
  "timeZone": "Europe/Berlin"
}

## 4. Juno gives Rowan 25 kudos, counted by Achievements' countKudosGiven
$ npx convex run achievements/achievements:countKudosGiven '<kudosGiven event, 25 kudos>'
## 5. Juno's Book after the kudos
$ npx convex run website/book:getBook '{}' --identity <Juno's session>
{
  "kind": "book",
  "ladders": [
    {
      "count": 25,
      "counts": "kudos given",
      "ladder": "generosity",
      "name": "Generosity",
      "next": {
        "at": 100,
        "tier": "gold"
      },
      "tiers": [
        {
          "at": 1,
          "earnedAt": 1791960806000,
          "name": "First Thanks",
          "tier": "bronze"
        },
        {
          "at": 25,
          "earnedAt": 1791960806000,
          "name": "Generous Soul",
          "tier": "silver"
        },
        {
          "at": 100,
          "earnedAt": null,
          "name": "Heart of the Team",
          "tier": "gold"
        },
        {
          "at": 500,
          "earnedAt": null,
          "name": "Patron of Praise",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 0,
      "counts": "kudos received",
      "ladder": "recognition",
      "name": "Recognition",
      "next": {
        "at": 1,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 1,
          "earnedAt": null,
          "name": "Noticed",
          "tier": "bronze"
        },
        {
          "at": 25,
          "earnedAt": null,
          "name": "Appreciated",
          "tier": "silver"
        },
        {
          "at": 100,
          "earnedAt": null,
          "name": "Highly Valued",
          "tier": "gold"
        },
        {
          "at": 500,
          "earnedAt": null,
          "name": "Hall of Fame",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 1,
      "counts": "different people thanked",
      "ladder": "connections",
      "name": "Connections",
      "next": {
        "at": 3,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 3,
          "earnedAt": null,
          "name": "Friendly Face",
          "tier": "bronze"
        },
        {
          "at": 6,
          "earnedAt": null,
          "name": "Connector",
          "tier": "silver"
        },
        {
          "at": 12,
          "earnedAt": null,
          "name": "Social Butterfly",
          "tier": "gold"
        },
        {
          "at": 24,
          "earnedAt": null,
          "name": "Constellation Maker",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 1,
      "counts": "days with a kudos given",
      "ladder": "dependability",
      "name": "Dependability",
      "next": {
        "at": 10,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 10,
          "earnedAt": null,
          "name": "Regular",
          "tier": "bronze"
        },
        {
          "at": 30,
          "earnedAt": null,
          "name": "Mainstay",
          "tier": "silver"
        },
        {
          "at": 100,
          "earnedAt": null,
          "name": "Pillar",
          "tier": "gold"
        },
        {
          "at": 250,
          "earnedAt": null,
          "name": "Cornerstone",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 0,
      "counts": "days thanking 3+ different people",
      "ladder": "applause",
      "name": "Applause",
      "next": {
        "at": 3,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 3,
          "earnedAt": null,
          "name": "Shout-out",
          "tier": "bronze"
        },
        {
          "at": 10,
          "earnedAt": null,
          "name": "Hype Squad",
          "tier": "silver"
        },
        {
          "at": 30,
          "earnedAt": null,
          "name": "Thunderous Applause",
          "tier": "gold"
        },
        {
          "at": 100,
          "earnedAt": null,
          "name": "Grand Chorus",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 1,
      "counts": "calendar months with a kudos given",
      "ladder": "seasons",
      "name": "Seasons",
      "next": {
        "at": 3,
        "tier": "silver"
      },
      "tiers": [
        {
          "at": 1,
          "earnedAt": 1791960806000,
          "name": "First Chapter",
          "tier": "bronze"
        },
        {
          "at": 3,
          "earnedAt": null,
          "name": "Season of Thanks",
          "tier": "silver"
        },
        {
          "at": 6,
          "earnedAt": null,
          "name": "Half-Year Hero",
          "tier": "gold"
        },
        {
          "at": 12,
          "earnedAt": null,
          "name": "Year of Gratitude",
          "tier": "diamond"
        }
      ]
    },
    {
      "count": 0,
      "counts": "thanks again after 30+ days",
      "ladder": "old-friends",
      "name": "Old Friends",
      "next": {
        "at": 1,
        "tier": "bronze"
      },
      "tiers": [
        {
          "at": 1,
          "earnedAt": null,
          "name": "Remembered",
          "tier": "bronze"
        },
        {
          "at": 3,
          "earnedAt": null,
          "name": "Old Friends",
          "tier": "silver"
        },
        {
          "at": 6,
          "earnedAt": null,
          "name": "Long Memory",
          "tier": "gold"
        },
        {
          "at": 12,
          "earnedAt": null,
          "name": "Evergreen",
          "tier": "diamond"
        }
      ]
    }
  ],
  "timeZone": "Europe/Berlin"
}

## 6. Compared with achievementsOf read directly for Juno
getBook ladders == achievementsOf ladders (projected to the website's names): True
timeZone: Europe/Berlin
ladders: ['generosity', 'recognition', 'connections', 'dependability', 'applause', 'seasons', 'old-friends']
generosity count 25 earned [('bronze', 1791960806000), ('silver', 1791960806000)] next {'at': 100, 'tier': 'gold'}
any reward or catalogueVersion in getBook's answer: False
rewards present in achievementsOf (dropped by getBook): True
## 7. The mock restarted with MOCK_FLAGS_ON=xp-levels,unlocks (achievements off), flags refreshed
$ npx convex run website/book:getBook '{}' --identity <Juno's session>
{
  "kind": "not-found"
}
