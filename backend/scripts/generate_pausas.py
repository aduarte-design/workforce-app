"""
One-off script that generates the 10 "Pausas Activas" illustrations using
Gemini Nano Banana (via emergentintegrations) and stores them in MongoDB as
base64 strings. Safe to re-run: it only regenerates entries whose image is
missing (unless FORCE=1 env var is set).
"""
import asyncio
import os
import sys
import base64
from pathlib import Path

# Make the backend package importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient
from emergentintegrations.llm.chat import LlmChat, UserMessage

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
FORCE = os.environ.get("FORCE", "0") == "1"

# Consistent style prompt suffix so every illustration matches the brand
STYLE_SUFFIX = (
    " Style: minimalist flat vector illustration, clean shapes, soft muted "
    "corporate palette dominated by deep green #122c2a, warm gold #b68a2e "
    "accents, on a light gray #f5f5f7 background. Single centered figure, "
    "large whitespace, professional wellness aesthetic, no text, no logos, "
    "no watermark. Square 1:1 composition."
)

PAUSAS = [
    {
        "order": 1,
        "name": "Estiramiento de cuello",
        "focus_area": "Cuello",
        "duration_seconds": 60,
        "description": "Alivia la tensión acumulada en el cuello por trabajar frente al computador.",
        "instructions": [
            "Siéntate con la espalda recta.",
            "Inclina lentamente la cabeza hacia el hombro derecho, sostén 10 segundos.",
            "Repite hacia el hombro izquierdo.",
            "Baja el mentón hacia el pecho, sostén 10 segundos.",
            "Realiza 3 repeticiones a cada lado.",
        ],
        "prompt": "One office worker sitting at a desk performing a gentle neck side stretch, tilting the head to one shoulder, calm expression.",
    },
    {
        "order": 2,
        "name": "Círculos con los hombros",
        "focus_area": "Hombros",
        "duration_seconds": 45,
        "description": "Libera la rigidez de los hombros y mejora la circulación.",
        "instructions": [
            "Ponte de pie o mantente sentado con la espalda recta.",
            "Eleva los hombros hacia las orejas.",
            "Rótalos hacia atrás en círculos amplios 10 veces.",
            "Repite el movimiento hacia adelante 10 veces.",
        ],
        "prompt": "One office worker rolling shoulders backwards in a wide circular motion at their standing desk, arrows subtly indicating circular motion.",
    },
    {
        "order": 3,
        "name": "Estiramiento de muñecas",
        "focus_area": "Muñecas y antebrazos",
        "duration_seconds": 60,
        "description": "Previene el síndrome del túnel carpiano en quienes usan mucho el teclado.",
        "instructions": [
            "Extiende un brazo al frente con la palma hacia abajo.",
            "Con la otra mano, presiona suavemente los dedos hacia abajo.",
            "Sostén 15 segundos y cambia de brazo.",
            "Repite con la palma hacia arriba.",
        ],
        "prompt": "One office worker extending an arm forward and using the other hand to gently press the fingers down, wrist stretch, standing next to a desk.",
    },
    {
        "order": 4,
        "name": "Estiramiento de espalda",
        "focus_area": "Espalda alta y media",
        "duration_seconds": 60,
        "description": "Relaja la espalda después de estar sentado durante largos periodos.",
        "instructions": [
            "De pie, entrelaza los dedos frente a ti.",
            "Extiende los brazos empujando las palmas hacia afuera.",
            "Redondea suavemente la espalda alta, sintiendo el estiramiento.",
            "Sostén 20 segundos y respira profundo.",
        ],
        "prompt": "One office worker standing with fingers interlaced and arms extended forward, palms pushing away, upper back gently rounded in a back stretch.",
    },
    {
        "order": 5,
        "name": "Estiramiento de piernas",
        "focus_area": "Piernas y glúteos",
        "duration_seconds": 60,
        "description": "Activa la circulación después de estar sentado.",
        "instructions": [
            "De pie, apóyate en el escritorio o silla.",
            "Levanta un pie hacia atrás llevando el talón hacia el glúteo.",
            "Sostén el tobillo con la mano y mantén 15 segundos.",
            "Cambia de pierna y repite 2 veces por lado.",
        ],
        "prompt": "One office worker standing and holding one ankle behind them, stretching the quadriceps, one hand resting on the desk for balance.",
    },
    {
        "order": 6,
        "name": "Descanso visual",
        "focus_area": "Ojos",
        "duration_seconds": 30,
        "description": "Regla 20-20-20 para reducir la fatiga ocular por pantallas.",
        "instructions": [
            "Aparta la vista de la pantalla.",
            "Mira algún objeto que esté a mínimo 6 metros de distancia.",
            "Mantén la mirada durante 20 segundos.",
            "Parpadea varias veces para hidratar los ojos.",
        ],
        "prompt": "One office worker sitting at their desk looking away from the computer screen toward a distant window, resting the eyes, calm expression.",
    },
    {
        "order": 7,
        "name": "Rotación de tobillos",
        "focus_area": "Tobillos y pies",
        "duration_seconds": 45,
        "description": "Activa la circulación en las piernas y previene la hinchazón.",
        "instructions": [
            "Sentado, extiende una pierna al frente.",
            "Rota el tobillo en círculos hacia la derecha 10 veces.",
            "Repite hacia la izquierda 10 veces.",
            "Cambia de pierna y repite.",
        ],
        "prompt": "One office worker seated on their chair with one leg extended, rotating the ankle in a circular motion, the other foot flat on the floor.",
    },
    {
        "order": 8,
        "name": "Inclinación lateral",
        "focus_area": "Costados y torso",
        "duration_seconds": 45,
        "description": "Estira los oblicuos y libera tensión en la zona lumbar.",
        "instructions": [
            "De pie, coloca una mano en la cadera.",
            "Eleva el otro brazo por encima de la cabeza.",
            "Inclínate suavemente hacia el lado contrario del brazo levantado.",
            "Sostén 15 segundos y cambia de lado.",
        ],
        "prompt": "One office worker standing with one hand on the hip and the other arm reaching over the head, doing a lateral side bend stretch.",
    },
    {
        "order": 9,
        "name": "Respiración profunda",
        "focus_area": "Mente y respiración",
        "duration_seconds": 90,
        "description": "Reduce el estrés y mejora la concentración.",
        "instructions": [
            "Siéntate con la espalda recta y los hombros relajados.",
            "Inhala profundamente por la nariz durante 4 segundos.",
            "Sostén el aire durante 4 segundos.",
            "Exhala lentamente por la boca durante 6 segundos.",
            "Repite 6 ciclos.",
        ],
        "prompt": "One office worker sitting upright with eyes closed and hands resting on the knees, taking a deep calm breath, subtle serenity.",
    },
    {
        "order": 10,
        "name": "Corrección postural",
        "focus_area": "Postura",
        "duration_seconds": 60,
        "description": "Realinea la columna y previene dolores por mala postura.",
        "instructions": [
            "Siéntate con la espalda recta contra el respaldo.",
            "Junta los omóplatos como si sostuvieras un lápiz entre ellos.",
            "Baja los hombros lejos de las orejas.",
            "Sostén 10 segundos y relaja. Repite 5 veces.",
        ],
        "prompt": "One office worker sitting at their desk with an upright posture, shoulder blades squeezed together, chin tucked slightly, ideal posture example.",
    },
]


async def generate_one(chat: LlmChat, prompt: str) -> str:
    """Generate a single image and return the raw base64 string (no data: prefix)."""
    full_prompt = prompt + STYLE_SUFFIX
    msg = UserMessage(text=full_prompt)
    _text, images = await chat.send_message_multimodal_response(msg)
    if not images:
        raise RuntimeError("Gemini did not return any image")
    return images[0]["data"]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    if FORCE:
        print("FORCE=1 → wiping pausas_activas collection")
        await db.pausas_activas.delete_many({})

    for p in PAUSAS:
        existing = await db.pausas_activas.find_one({"order": p["order"]})
        if existing and existing.get("image_base64") and not FORCE:
            print(f"[{p['order']:>2}] {p['name']}: already has image, skipping")
            continue

        print(f"[{p['order']:>2}] {p['name']}: generating image...")
        # Fresh chat per image so history doesn't bloat
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"pausa-{p['order']}",
            system_message="You are a wellness illustrator producing minimalist flat vector illustrations.",
        ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

        try:
            b64 = await generate_one(chat, p["prompt"])
        except Exception as e:
            print(f"    ! failed: {e}")
            continue

        doc = {
            "order": p["order"],
            "name": p["name"],
            "focus_area": p["focus_area"],
            "duration_seconds": p["duration_seconds"],
            "description": p["description"],
            "instructions": p["instructions"],
            "image_base64": f"data:image/jpeg;base64,{b64}",
        }

        if existing:
            await db.pausas_activas.update_one({"_id": existing["_id"]}, {"$set": doc})
        else:
            await db.pausas_activas.insert_one(doc)
        print(f"    ✓ saved ({len(b64)} chars)")

    total = await db.pausas_activas.count_documents({})
    print(f"\nTotal pausas activas in DB: {total}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
