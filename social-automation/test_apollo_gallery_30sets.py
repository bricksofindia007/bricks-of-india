"""
test_apollo_gallery_30sets.py -- DIAGNOSTIC, throwaway (feature branch, not merged).

Tests the rewritten _lego_com_scrape_product_page() (Apollo-schema gallery
extraction) against 30 real sets spanning 2011-2026 across many themes.
Resolves each bare set number to its canonical LEGO.com product URL via the
redirect LEGO.com itself serves for /en-us/product/<number>, then runs the
rewritten parser. Reports per-set image count or explicit failure reason.
No averaging. No fallback to Brickset/Rebrickable -- LEGO.com only, by design,
to isolate what the rewritten parser alone can do.
"""
import sys
import requests
import scraper

SETS = [
    ("42083", "Bugatti Chiron", 2018, "Technic"),
    ("60064", "Arctic Supply Plane", 2014, "Arctic"),
    ("10219", "Maersk Container Train", 2011, "Creator Expert"),
    ("910063", "W.A.L.T.", 2026, "BrickLink Designer Program"),
    ("42211", "Lunar Outpost Moon Rover Space Vehicle", 2025, "Technic"),
    ("60197", "Passenger Train", 2018, "Trains"),
    ("76410", "Slytherin House Banner", 2023, "Harry Potter"),
    ("72006", "Axl's Rolling Arsenal", 2018, "Nexo Knights"),
    ("70624", "Vermillion Invader", 2017, "Ninjago"),
    ("71042", "Silent Mary", 2017, "Pirates of the Caribbean"),
    ("75051", "Jedi Scout Fighter", 2014, "Star Wars"),
    ("60324", "Mobile Crane", 2022, "Construction"),
    ("21260", "The Cherry Blossom Garden", 2024, "Minecraft"),
    ("70436", "Phantom Fire Truck 3000", 2020, "Hidden Side"),
    ("41231", "Harley Quinn To The Rescue", 2016, "DC Super Hero Girls"),
    ("41067", "Belle's Enchanted Castle", 2016, "Disney Princess"),
    ("71763", "Lloyd's Race Car EVO", 2022, "Ninjago"),
    ("75316", "Mandalorian Starfighter", 2021, "Star Wars"),
    ("3061", "City Park Cafe", 2012, "Friends"),
    ("76463", "Hogwarts Castle: Hospital Wing", 2026, "Harry Potter"),
    ("40186", "Year of the Pig", 2019, "Unknown"),
    ("60425", "Jungle Explorer Water Plane", 2024, "Jungle"),
    ("60505", "Airplane, Service Truck & Hovercraft Remix", 2026, "City"),
    ("41106", "Pop Star Tour Bus", 2015, "Friends"),
    ("71860", "Lloyd's Titan Mech 15th Anniversary", 2026, "Ninjago"),
    ("21346", "Family Tree", 2024, "LEGO Ideas and CUUSOO"),
    ("71433", "Goombas' Playground", 2024, "Super Mario"),
    ("9444", "Cole's Tread Assault", 2012, "Ninjago"),
    ("10260", "Downtown Diner", 2018, "Modular Buildings"),
    ("6586975", "Riyadh Grand Opening", 2025, "LEGO Brand Store"),
]

MIN_GALLERY_IMAGES = scraper.MIN_GALLERY_IMAGES


def resolve_product_url(num: str) -> tuple[int, str | None]:
    """Follow LEGO.com's own redirect from the bare-number URL. Returns
    (http_status_of_bare_url, resolved_url_or_None)."""
    bare_url = f"https://www.lego.com/en-us/product/{num}"
    try:
        resp = requests.get(bare_url, headers=scraper._lego_headers(), timeout=25, allow_redirects=True)
        return resp.status_code, (resp.url if resp.status_code == 200 else None)
    except Exception as exc:
        return -1, None


def main():
    results = []
    for num, name, year, theme in SETS:
        status, resolved_url = resolve_product_url(num)
        if resolved_url is None:
            results.append((num, name, year, theme, None, f'product_url_resolve_failed_http_{status}'))
            print(f'{num:10s} {year} {theme[:20]:20s} {name[:35]:35s} -> FAIL (resolve, http={status})')
            continue
        data = scraper._lego_com_scrape_product_page(resolved_url)
        imgs = data.get('gallery_images', [])
        if imgs:
            results.append((num, name, year, theme, len(imgs), None))
            print(f'{num:10s} {year} {theme[:20]:20s} {name[:35]:35s} -> {len(imgs)} images')
        else:
            reason = data.get('_failure', 'unknown')
            results.append((num, name, year, theme, 0, reason))
            print(f'{num:10s} {year} {theme[:20]:20s} {name[:35]:35s} -> FAIL ({reason})')

    print('\n--- Distribution ---')
    counts = [r[4] for r in results if r[4] is not None]
    for num, name, year, theme, count, reason in sorted(results, key=lambda r: (r[4] if r[4] is not None else -1)):
        tag = f'{count} images' if count is not None else f'FAIL: {reason}'
        print(f'  {num:10s} ({year}, {theme}): {tag}')

    below_threshold = [r for r in results if (r[4] or 0) < MIN_GALLERY_IMAGES]
    at_or_above = [r for r in results if (r[4] or 0) >= MIN_GALLERY_IMAGES]
    print(f'\nTotal sets tested: {len(results)}')
    print(f'>= {MIN_GALLERY_IMAGES} images (would PASS gate): {len(at_or_above)}')
    print(f'< {MIN_GALLERY_IMAGES} images or failed entirely (would FAIL gate): {len(below_threshold)}')


if __name__ == '__main__':
    main()
