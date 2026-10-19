import json
import subprocess
import sys

deployment = "different-dog-467"
issuer = f"https://{deployment}.convex.site"
identities = [line.split() for line in open(sys.argv[1])]
members = {user: member for member, user in (line.split()[:2] for line in open(sys.argv[2]))}
out = sys.argv[3]


def run(function, args, identity):
    user, user_id, session = identity
    command = ["npx", "--no", "--", "convex", "run", f"website/{function}", json.dumps(args), "--identity", json.dumps({"subject": f"{user_id}|{session}", "issuer": issuer}), "--deployment", deployment]
    answer = subprocess.run(command, capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=120)
    if answer.returncode != 0:
        return {"error": answer.stderr.strip().splitlines()[-1:]}
    return json.loads(answer.stdout)


walk = {}
for identity in identities:
    user = identity[0]
    other = next(member for someone, member in members.items() if someone != user)
    steps = {}
    album = run("album:getAlbum", {}, identity)
    steps["packs before opening"] = album.get("packs")
    steps["opened"] = [run("album:openThoughtfulPack", {"pack": pack["pack"]}, identity) for pack in album.get("packs", [])]
    tray = run("album:getAlbum", {}, identity).get("tray", [])
    steps["tray after opening"] = tray
    steps["put in"] = run("album:putIn", {"item": tray[0]["item"]}, identity) if tray else None
    steps["put all in"] = run("album:putAllIn", {}, identity)
    earned = run("album:getAlbum", {}, identity).get("emojis", [])
    steps["marked seen"] = run("album:markEmojisSeen", {"ids": [emoji["id"] for emoji in earned if emoji.get("earned")][:2]}, identity)
    steps["unlock a team sticker"] = run("album:unlockTeamSticker", {"team": "proof-hedgehogs"}, identity)
    steps["getAlbum"] = run("album:getAlbum", {}, identity)
    steps["getAlbumHoggies"] = run("album:getAlbumHoggies", {}, identity)
    steps["getThoughtfulBoards"] = run("album:getThoughtfulBoards", {}, identity)
    steps["getAlbumPerson"] = run("album:getAlbumPerson", {"person": other}, identity)
    steps["getAlbumWeek"] = run("album:getAlbumWeek", {}, identity)
    steps["getAlbumProfile"] = run("album:getAlbumProfile", {}, identity)
    steps["getEmojiMappings"] = run("emojiMappings:getEmojiMappings", {}, identity)
    walk[user] = steps

json.dump(walk, open(out, "w"), indent=1)
