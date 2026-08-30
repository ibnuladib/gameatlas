"""Tag taxonomy and matching — no database imports so tests stay lightweight."""

TAXONOMY: dict[str, tuple[str, list[str]]] = {
    "RPG": ("Genre", ["rpg", "role-playing", "jrpg"]),
    "Action": ("Genre", ["action"]),
    "Adventure": ("Genre", ["adventure"]),
    "Strategy": ("Genre", ["strategy"]),
    "Simulation": ("Genre", ["simulation", "sim"]),
    "Shooter": ("Genre", ["shooter", "fps", "tps"]),
    "Racing": ("Genre", ["racing", "driving"]),
    "Platformer": ("Genre", ["platformer", "platform"]),
    "Puzzle": ("Genre", ["puzzle"]),
    "Horror": ("Genre", ["horror"]),
    "Open World": ("Gameplay", ["open world", "open-world"]),
    "Exploration": ("Gameplay", ["exploration"]),
    "Crafting": ("Gameplay", ["crafting"]),
    "Base Building": ("Gameplay", ["base building", "base-building", "city builder"]),
    "Stealth": ("Gameplay", ["stealth"]),
    "Survival": ("Gameplay", ["survival"]),
    "Turn-Based": ("Gameplay", ["turn-based", "turn based"]),
    "Real-Time Combat": ("Gameplay", ["real-time", "action rpg", "hack and slash"]),
    "Character Customization": ("Gameplay", ["character customization"]),
    "Resource Management": ("Gameplay", ["resource management", "management"]),
    "Story-Rich": ("Experience", ["story rich", "story-rich", "narrative"]),
    "Difficult": ("Experience", ["difficult", "souls-like", "soulslike"]),
    "Relaxing": ("Experience", ["relaxing", "cozy", "casual"]),
    "Competitive": ("Experience", ["competitive", "esports"]),
    "Atmospheric": ("Experience", ["atmospheric"]),
    "Immersive": ("Experience", ["immersive", "immersion"]),
    "Casual": ("Experience", ["casual"]),
    "Challenging": ("Experience", ["challenging", "difficult"]),
    "Fantasy": ("Setting", ["fantasy"]),
    "Sci-Fi": ("Setting", ["sci-fi", "science fiction", "sci fi"]),
    "Medieval": ("Setting", ["medieval"]),
    "Cyberpunk": ("Setting", ["cyberpunk"]),
    "Post-Apocalyptic": ("Setting", ["post-apocalyptic", "post apocalyptic"]),
    "Historical": ("Setting", ["historical"]),
    "Modern": ("Setting", ["modern"]),
    "Space": ("Setting", ["space", "spaceship"]),
    "Single Player": ("Player structure", ["single-player", "single player"]),
    "Multiplayer": ("Player structure", ["multi-player", "multiplayer", "online pvp"]),
    "Co-op": ("Player structure", ["co-op", "coop", "online co-op", "cooperative"]),
    "PvP": ("Player structure", ["pvp", "player versus player"]),
    "Local Multiplayer": ("Player structure", ["shared/split screen", "local multiplayer", "local co-op"]),
}


def blob_from_row(row: dict) -> str:
    parts = list(row.get("genres") or []) + list(row.get("steam_tags") or [])
    return " | ".join(p.lower() for p in parts)


def matched_tags(blob: str) -> list[tuple[str, str, float, str]]:
    assigned: list[tuple[str, str, float, str]] = []
    for name, (category, aliases) in TAXONOMY.items():
        if any(alias in blob for alias in aliases):
            assigned.append((name, category, 1.0, "steam"))
    return assigned
