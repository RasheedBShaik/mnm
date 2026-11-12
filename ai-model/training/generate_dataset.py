
import json
import random
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_FILE = BASE_DIR / "data" / "maintenance_dataset.json"

random.seed(42)

categories = {
    "Plumbing": {
        "issues": [
            "water is leaking",
            "the pipe is leaking",
            "the drain is blocked",
            "the sink is overflowing",
            "the toilet is clogged",
            "the tap is dripping",
            "water pressure is low",
            "the shower is not working",
            "the water heater is leaking",
            "the bathroom drain smells bad",
            "the flush is not working",
            "the pipe has burst",
            "water is pooling on the floor",
            "the faucet is loose",
            "the water supply has stopped",
            "the kitchen drain is blocked",
            "the washbasin is overflowing",
            "the shower head is leaking",
            "the water tank is overflowing",
            "the bathroom tap is broken"
        ],
        "locations": [
            "in my bathroom",
            "under the kitchen sink",
            "in the kitchen",
            "near the washbasin",
            "inside the bathroom",
            "on the balcony",
            "near the water tank",
            "in the utility room",
            "in my apartment",
            "near the shower",
            "in the common washroom",
            "under the bathroom floor"
        ],
        "openings": [
            "I noticed that",
            "Please help because",
            "There is a problem:",
            "I want to report that",
            "The maintenance team should check because",
            "Since this morning,",
            "For the last two days,",
            "I have noticed that",
            "Can someone inspect this?",
            "We are experiencing an issue:",
            "Urgent maintenance required:",
            "Please send a plumber because"
        ]
    },

    "Electrical": {
        "issues": [
            "the lights are not working",
            "the power keeps going off",
            "the circuit breaker keeps tripping",
            "the bedroom switch is broken",
            "the ceiling fan is not rotating",
            "the electrical socket is damaged",
            "the wiring is sparking",
            "there is a burning smell near the switchboard",
            "the hallway light is flickering",
            "the power supply is unstable",
            "the fuse has blown",
            "the distribution board is making noise",
            "the bedroom has no electricity",
            "the bathroom exhaust fan is not working",
            "the main switch is faulty",
            "the plug point is overheating",
            "the corridor lights are off",
            "the inverter is not supplying power",
            "the generator is not starting",
            "the doorbell is not working"
        ],
        "locations": [
            "in my bedroom",
            "in the kitchen",
            "in the living room",
            "near the main entrance",
            "in the bathroom",
            "in the electrical panel",
            "in the corridor",
            "on the first floor",
            "in my apartment",
            "near the switchboard",
            "in the parking area",
            "in the common area"
        ],
        "openings": [
            "I noticed that",
            "Please investigate because",
            "I want to report that",
            "There is an electrical issue:",
            "Since yesterday,",
            "For several hours,",
            "Could an electrician check this?",
            "The maintenance team should inspect because",
            "We are facing a problem:",
            "Urgent electrical repair needed:"
        ]
    },

    "HVAC": {
        "issues": [
            "the air conditioner is not cooling",
            "the AC is making strange noises",
            "the AC is leaking water",
            "the thermostat is not responding",
            "the ventilation system is not working",
            "the air conditioner is blowing hot air",
            "the AC compressor is not starting",
            "the air filter is dirty",
            "the cooling is very weak",
            "the central air system has stopped",
            "the AC remote is not working",
            "the indoor unit is vibrating",
            "the outdoor unit is making noise",
            "the room is not getting cold",
            "the ventilation fan has stopped",
            "the AC has a bad smell",
            "the air ducts are blocked",
            "the thermostat shows an incorrect temperature",
            "the heating system is not working",
            "the AC shuts down unexpectedly"
        ],
        "locations": [
            "in my bedroom",
            "in the living room",
            "in the conference room",
            "in my apartment",
            "on the office floor",
            "in the reception area",
            "in the server room",
            "in the classroom",
            "in the common hall",
            "in the guest room",
            "in the kitchen",
            "in the office"
        ],
        "openings": [
            "I noticed that",
            "Please arrange an HVAC technician because",
            "I want to report that",
            "There is a cooling issue:",
            "Since this afternoon,",
            "For the past few days,",
            "Could someone inspect this?",
            "The AC needs maintenance because",
            "We are experiencing a problem:",
            "Please investigate:"
        ]
    },

    "Civil": {
        "issues": [
            "there are cracks in the wall",
            "the floor tiles are broken",
            "the ceiling paint is peeling",
            "the bathroom wall has damp patches",
            "the door is not closing properly",
            "the window frame is damaged",
            "the plaster is falling off",
            "the ceiling has water stains",
            "the floor is uneven",
            "the wall paint is damaged",
            "the staircase handrail is loose",
            "the balcony tiles are cracked",
            "the wooden door is swollen",
            "the window latch is broken",
            "the roof has developed cracks",
            "the wall has developed a large hole",
            "the bathroom grout is damaged",
            "the plaster has started crumbling",
            "the floor has become slippery due to seepage",
            "the ceiling is showing signs of damage"
        ],
        "locations": [
            "in my bedroom",
            "in the bathroom",
            "in the kitchen",
            "in the living room",
            "on the balcony",
            "near the staircase",
            "in the corridor",
            "at the main entrance",
            "in the office",
            "on the terrace",
            "in the common area",
            "inside my apartment"
        ],
        "openings": [
            "I noticed that",
            "Please arrange a civil repair because",
            "I want to report that",
            "There is a structural maintenance issue:",
            "Since last week,",
            "For the past few days,",
            "Could the maintenance team inspect this?",
            "We need a repair because",
            "Please send someone to check:",
            "I am reporting the following damage:"
        ]
    },

    "Appliances": {
        "issues": [
            "the refrigerator is not cooling",
            "the washing machine is not draining",
            "the microwave is not heating",
            "the dishwasher is not cleaning",
            "the oven is not turning on",
            "the refrigerator is making loud noises",
            "the washing machine is vibrating heavily",
            "the microwave display is not working",
            "the chimney exhaust is not working",
            "the induction stove is not heating",
            "the refrigerator door is not closing",
            "the washing machine is leaking",
            "the dishwasher is overflowing",
            "the freezer is not freezing",
            "the dryer is not drying clothes",
            "the water purifier is not dispensing water",
            "the electric kettle is not working",
            "the refrigerator light is not turning on",
            "the washing machine drum is stuck",
            "the oven temperature is incorrect"
        ],
        "locations": [
            "in my kitchen",
            "in the utility area",
            "inside my apartment",
            "in the pantry",
            "in the shared kitchen",
            "in the laundry room",
            "in the staff kitchen",
            "in the guest apartment",
            "in the dining area",
            "in the office pantry",
            "in the common kitchen",
            "in my furnished apartment"
        ],
        "openings": [
            "I noticed that",
            "Please arrange an appliance technician because",
            "I want to report that",
            "There is an appliance issue:",
            "Since yesterday,",
            "For the last few days,",
            "Could someone inspect the appliance?",
            "The appliance needs repair because",
            "We are facing an issue:",
            "Please send a technician:"
        ]
    },

    "Security": {
        "issues": [
            "the CCTV camera is not working",
            "the main gate access system is broken",
            "the biometric scanner is not responding",
            "the security alarm is not working",
            "the boom barrier is stuck",
            "the intercom is not working",
            "the access card reader is damaged",
            "the surveillance monitor has stopped",
            "the security gate is not locking",
            "the motion sensor is faulty",
            "the entrance camera has no display",
            "the visitor management system is offline",
            "the door access reader is not detecting cards",
            "the security camera footage is unavailable",
            "the emergency alarm is malfunctioning",
            "the automatic gate is not opening",
            "the security control panel is showing an error",
            "the perimeter sensor is not detecting movement",
            "the video door phone is not working",
            "the parking access system is broken"
        ],
        "locations": [
            "at the main entrance",
            "near the parking gate",
            "in the reception area",
            "in the security office",
            "on the ground floor",
            "near the elevator lobby",
            "at the building entrance",
            "in the parking area",
            "in the control room",
            "at the rear entrance",
            "in the common area",
            "near the visitor entrance"
        ],
        "openings": [
            "I noticed that",
            "Please arrange a security system technician because",
            "I want to report that",
            "There is a security system issue:",
            "Since this morning,",
            "For the last two days,",
            "Could someone inspect this equipment?",
            "The security system needs repair because",
            "We are experiencing an issue:",
            "Please investigate:"
        ]
    }
}


def generate_examples(category, details, start_id):

    examples = []
    seen = set()

    attempts = 0

    while len(examples) < 250 and attempts < 10000:

        attempts += 1

        opening = random.choice(details["openings"])
        issue = random.choice(details["issues"])
        location = random.choice(details["locations"])

        complaint = f"{opening} {issue} {location}."

        complaint = complaint[0].upper() + complaint[1:]

        if complaint in seen:
            continue

        seen.add(complaint)

        examples.append({
            "id": start_id + len(examples),
            "text": complaint,
            "category": category
        })

    if len(examples) != 250:
        raise ValueError(f"Could not generate 250 examples for {category}")

    return examples


def main():

    all_complaints = []

    next_id = 1

    for category, details in categories.items():

        examples = generate_examples(
            category,
            details,
            next_id
        )

        all_complaints.extend(examples)

        next_id += len(examples)

        print(f"{category}: {len(examples)} examples")

    random.shuffle(all_complaints)

    dataset = {
        "complaints": all_complaints
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as file:

        json.dump(
            dataset,
            file,
            indent=2,
            ensure_ascii=False
        )

    print("\n================================")
    print("MNM DATASET GENERATED")
    print("================================")
    print("Total complaints:", len(all_complaints))
    print("Categories:", len(categories))
    print("Output:", OUTPUT_FILE)


if __name__ == "__main__":
    main()
