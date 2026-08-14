"""Generate Ashvale character animation candidates with the PixelLab v2 API.

The script never prints the API key and writes only to a staging directory.
Runtime integration remains a separate, review-gated step.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_ROOT = PROJECT_ROOT / "assets" / "characters" / "classes"
STAGING_ROOT = PROJECT_ROOT / "artifacts" / "pixellab-candidates"
API_URL = "https://api.pixellab.ai/v2/animate-with-text"
API_V3_URL = "https://api.pixellab.ai/v2/animate-with-text-v3"
JOB_URL = "https://api.pixellab.ai/v2/background-jobs/{job_id}"
EDIT_URL = "https://api.pixellab.ai/v2/edit-animation-v2"
FRAME_SIZE = 64
DIRECTIONS = {
    "down": "south",
    "left": "west",
    "up": "north",
    "right": "east",
}

DESCRIPTIONS = {
    "warrior": (
        "The exact same original Ashvale warrior shown in the reference: compact top-down "
        "pixel-art action RPG hero, navy tunic and cape, restrained silver shoulder armor, "
        "brown leather boots and gloves, short dark-blue hair, clean small symmetrical eyes, "
        "one-handed silver sword held as an attached part of the body. Preserve the reference "
        "identity, face, proportions, palette, lighting, silhouette, equipment, and pixel density."
    ),
    "archer": (
        "The exact same original Ashvale archer shown in the reference: compact top-down "
        "pixel-art action RPG hero, forest-green layered cloak and tunic, brown leather boots "
        "and bracers, short brown hair, clean small symmetrical eyes, wooden bow and a fixed "
        "back quiver. Preserve the reference identity, face, proportions, palette, lighting, "
        "silhouette, equipment sides, and pixel density."
    ),
}

ACTIONS = {
    "warrior": {
        "walk": (
            "A seamless four-frame walk cycle in place: left-foot contact, passing pose, "
            "right-foot contact, recovery. Feet visibly alternate while the pelvis, root, and "
            "ground baseline stay fixed. Sword, arms, head, torso, cape, and armor remain fully "
            "connected with subtle counter-motion. No sliding or vertical hovering."
        ),
        "attack": (
            "A readable four-frame one-handed melee sword attack: preparation with sword drawn "
            "back, connected arm driving a real sword swing, impact frame with sword at full "
            "extension, recovery to guard. The physical sword moves continuously with the hand; "
            "do not create a separate slash effect. Root and feet stay planted."
        ),
    },
    "archer": {
        "walk": (
            "A seamless four-frame walk cycle in place: left-foot contact, passing pose, "
            "right-foot contact, recovery. Legs make clear alternating steps while root and "
            "ground baseline stay fixed. The bow remains attached in the hands and the quiver "
            "stays fixed on the same back side in every frame. No sliding or hovering."
        ),
        "attack": (
            "A readable four-frame bow attack: raise the attached bow and take an arrow, draw "
            "the string with both hands, release the arrow on frame three, recover to ready. "
            "Keep the quiver fixed on the same back side. The bow, string, hands, and arrow are "
            "connected and readable; root and feet stay planted."
        ),
    },
}

EDIT_ACTIONS = {
    "warrior": {
        "walk": (
            "Preserve this exact warrior, face, head, torso, armor, cape, palette and sword. "
            "Repair the four-frame walk into clear alternating foot contacts with connected limbs. "
            "Keep root x and foot baseline identical in every frame. Remove all detached pixels, "
            "purple fringe and afterimages. Do not alter the face or switch equipment sides."
        ),
        "attack": (
            "Preserve this exact warrior, face, head, body, armor, palette and physical sword. "
            "Replace every separate white slash arc with the real attached sword moving through "
            "prepare, swing, impact and recovery. Keep head, torso, arms and legs fully connected, "
            "feet planted at one root and baseline, and remove detached pixels and purple fringe."
        ),
    },
    "archer": {
        "walk": (
            "Preserve this exact archer, face, head, torso, green clothing, bow, palette and quiver. "
            "Repair the four-frame walk into distinct left contact, passing, right contact and "
            "recovery poses with truly alternating legs. Keep root and baseline fixed. Keep the "
            "quiver attached on exactly the same back side. Remove stray pixels and colored fringe."
        ),
        "attack": (
            "Preserve this exact archer, face, head, body, green clothing, bow, palette and quiver. "
            "Clarify the four phases as raise bow, draw string, release arrow, recover. Keep bow, "
            "string and both hands connected; keep the quiver fixed on the same back side. Keep root "
            "and baseline fixed and remove detached pixels, tails and colored fringe."
        ),
    },
}

NEGATIVE = (
    "purple or magenta fringe, chroma key, colored halo, glow, antialiasing, partial transparency, "
    "detached head, detached limbs, sliced body, floating body parts, stray pixels, dust, trails, "
    "afterimages, motion blur, slash effect, extra weapon, duplicate bow, duplicate quiver, "
    "equipment switching sides, frame drift, root drift, baseline bounce, cropped body, shadow, "
    "background, text, watermark"
)


def encode_png(path: Path) -> dict[str, str]:
    return {
        "type": "base64",
        "base64": base64.b64encode(path.read_bytes()).decode("ascii"),
        "format": "png",
    }


def decode_image(encoded: str) -> bytes:
    payload = encoded.split(",", 1)[-1]
    return base64.b64decode(payload)


def api_request(token: str, url: str, payload: dict[str, object] | None = None) -> dict[str, object]:
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Ashvale-PixelLab-Client/1.0",
        },
        method="POST" if payload is not None else "GET",
    )
    try:
        with urlopen(request, timeout=180) as response:
            return json.load(response)
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"PixelLab HTTP {error.code}: {detail[:500]}") from error
    except URLError as error:
        raise RuntimeError(f"PixelLab network error: {error.reason}") from error


def call_pixellab(token: str, payload: dict[str, object]) -> dict[str, object]:
    return api_request(token, API_URL, payload)


def call_pixellab_v3(token: str, payload: dict[str, object]) -> dict[str, object]:
    accepted = api_request(token, API_V3_URL, payload)
    job_id = accepted.get("background_job_id")
    if not isinstance(job_id, str):
        raise RuntimeError("PixelLab v3 did not return a background_job_id")
    for _ in range(60):
        time.sleep(5)
        job = api_request(token, JOB_URL.format(job_id=job_id))
        status = job.get("status")
        if status == "completed":
            result = job.get("last_response")
            if not isinstance(result, dict):
                raise RuntimeError("PixelLab v3 completed without result data")
            return result
        if status == "failed":
            raise RuntimeError(f"PixelLab v3 job failed: {job.get('last_response')}")
    raise RuntimeError("PixelLab v3 job timed out")


def poll_job(token: str, accepted: dict[str, object]) -> dict[str, object]:
    job_id = accepted.get("background_job_id")
    if not isinstance(job_id, str):
        raise RuntimeError("PixelLab did not return a background_job_id")
    for _ in range(60):
        time.sleep(5)
        job = api_request(token, JOB_URL.format(job_id=job_id))
        status = job.get("status")
        if status == "completed":
            result = job.get("last_response")
            if isinstance(result, dict):
                return result
            raise RuntimeError("PixelLab completed without result data")
        if status == "failed":
            raise RuntimeError(f"PixelLab job failed: {job.get('last_response')}")
    raise RuntimeError("PixelLab job timed out")


def validate_frame(path: Path) -> None:
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        if rgba.size != (FRAME_SIZE, FRAME_SIZE):
            raise RuntimeError(f"Unexpected PixelLab frame size {rgba.size}: {path}")
        if rgba.getchannel("A").getbbox() is None:
            raise RuntimeError(f"Empty PixelLab frame: {path}")


def generate(character: str, state: str, direction: str, token: str, model: str) -> None:
    reference = RUNTIME_ROOT / character / "frames" / "idle" / direction / "frame-00.png"
    output_dir = STAGING_ROOT / model / character / state / direction
    output_dir.mkdir(parents=True, exist_ok=True)
    payload: dict[str, object] = {
        "image_size": {"width": FRAME_SIZE, "height": FRAME_SIZE},
        "description": DESCRIPTIONS[character],
        "negative_description": NEGATIVE,
        "action": ACTIONS[character][state],
        "text_guidance_scale": 9.0,
        "image_guidance_scale": 2.0,
        "n_frames": 4,
        "view": "low top-down",
        "direction": DIRECTIONS[direction],
        "reference_image": encode_png(reference),
        "seed": 0,
    }
    if model == "edit":
        existing = [
            RUNTIME_ROOT / character / "frames" / state / direction / f"frame-{index:02d}.png"
            for index in range(4)
        ]
        response = poll_job(
            token,
            api_request(
                token,
                EDIT_URL,
                {
                    "description": EDIT_ACTIONS[character][state],
                    "frames": [
                        {"image": encode_png(path), "size": {"width": 64, "height": 64}}
                        for path in existing
                    ],
                    "image_size": {"width": 64, "height": 64},
                    "seed": 0,
                    "no_background": True,
                },
            ),
        )
    elif model == "v3":
        response = call_pixellab_v3(
            token,
            {
                "first_frame": encode_png(reference),
                "action": ACTIONS[character][state] + " " + NEGATIVE,
                "frame_count": 4,
                "seed": 0,
                "no_background": True,
                "drift_threshold": 0,
                "enhance_prompt": False,
            },
        )
    else:
        response = call_pixellab(token, payload)
    images = response.get("images")
    if not isinstance(images, list) or len(images) < 4:
        raise RuntimeError(f"PixelLab returned {len(images) if isinstance(images, list) else 0} frames")
    for index, item in enumerate(images):
        if not isinstance(item, dict) or not isinstance(item.get("base64"), str):
            raise RuntimeError(f"Malformed PixelLab frame {index}")
        path = output_dir / f"frame-{index:02d}.png"
        path.write_bytes(decode_image(item["base64"]))
        validate_frame(path)
    print(f"Generated {character}/{state}/{direction}: {len(images)} candidate frames")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--characters", nargs="+", choices=tuple(DESCRIPTIONS), required=True)
    parser.add_argument("--states", nargs="+", choices=("walk", "attack"), required=True)
    parser.add_argument("--directions", nargs="+", choices=tuple(DIRECTIONS), default=tuple(DIRECTIONS))
    parser.add_argument("--model", choices=("classic", "v3", "edit"), default="edit")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    token = os.environ.get("PIXELLAB_API_KEY")
    if not token:
        raise SystemExit("PIXELLAB_API_KEY is missing")
    for character in args.characters:
        for state in args.states:
            for direction in args.directions:
                generate(character, state, direction, token, args.model)


if __name__ == "__main__":
    main()
