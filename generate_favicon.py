"""Génère les favicons noir-sur-blanc à partir de logo.png.

Usage (depuis padelup-web/) :
    pip install Pillow
    python generate_favicon.py

Sortie :
    - favicon.png          (512×512, noir sur blanc) — favicon principal
    - favicon-32x32.png    (32×32, pour le navigateur)
    - favicon-16x16.png    (16×16, pour le navigateur)
    - apple-touch-icon.png (180×180, noir sur blanc) — iOS bookmark
"""
from PIL import Image
import os

SRC = 'logo.png'
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)

def make_favicon(size, out_name, padding_ratio=0.10):
    """Charge le logo, recolore le silhouette en noir, le pose sur fond blanc."""
    logo = Image.open(SRC).convert('RGBA')

    # Crop sur le contenu utile (vire les zones transparentes)
    bbox = logo.getbbox()
    if bbox:
        logo = logo.crop(bbox)

    # Recolore : le logo source est en blanc sur transparent, on bascule en noir
    pixels = logo.load()
    w, h = logo.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0:
                pixels[x, y] = (BLACK[0], BLACK[1], BLACK[2], a)

    # Resize : occupe (1 - padding*2) du canvas pour avoir un peu de marge
    target_logo = int(size * (1 - padding_ratio * 2))
    ratio = min(target_logo / w, target_logo / h)
    new_w, new_h = max(1, int(w * ratio)), max(1, int(h * ratio))
    logo_resized = logo.resize((new_w, new_h), Image.LANCZOS)

    # Canvas blanc + paste centré
    canvas = Image.new('RGB', (size, size), WHITE)
    x_off = (size - new_w) // 2
    y_off = (size - new_h) // 2
    canvas.paste(logo_resized, (x_off, y_off), logo_resized)
    canvas.save(out_name, 'PNG', optimize=True)
    kb = os.path.getsize(out_name) / 1024
    print(f"  -> {out_name:28s} ({size}x{size}, {kb:.1f} KB)")

if __name__ == '__main__':
    if not os.path.exists(SRC):
        print(f"ERREUR : {SRC} introuvable. Lance ce script depuis le dossier padelup-web.")
        exit(1)

    print("Generation des favicons noir-sur-blanc...")
    make_favicon(512, 'favicon.png')
    make_favicon(32, 'favicon-32x32.png', padding_ratio=0.05)
    make_favicon(16, 'favicon-16x16.png', padding_ratio=0.02)
    make_favicon(180, 'apple-touch-icon.png', padding_ratio=0.10)
    print("\nTermine. Push avec git pour deployer.")
