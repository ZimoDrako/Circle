"""Seed demo data for CIRCLE MVP using Supabase.

All records use demo=True so they can be identified and later removed.
Idempotent: only seeds when demo users do not already exist.
"""

from datetime import datetime, timezone, timedelta
import uuid
import random


DEMO_UNI = "California State University, Fullerton"

INTERESTS_POOL = [
    "Gaming", "Anime", "Manga", "Music", "Hip-hop", "Movies", "Sports",
    "Basketball", "Football", "Soccer", "Fitness", "Gym", "Food", "Coffee",
    "Art", "Fashion", "Technology", "AI", "Entrepreneurship", "Cars",
    "Photography", "Travel", "Hiking", "Books", "Finance", "Business",
    "Coding", "Nightlife", "Comedy", "Volunteering",
]

LOOKING_FOR_POOL = [
    "New friends", "Dating", "Study partners", "Gym partners",
    "Gaming partners", "People to attend events with", "Networking",
    "Exploring campus", "Just meeting people",
]

MAJORS = [
    "Computer Science", "Business Admin", "Psychology", "Biology",
    "Communications", "Art", "Engineering", "Kinesiology", "Nursing",
    "Political Science", "Economics", "Mathematics",
]

YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Grad"]

DAYS = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday"
]

TIMES = ["Morning", "Afternoon", "Evening", "Late night"]

FIRST_NAMES = [
    "Alex", "Jordan", "Sam", "Riley", "Casey", "Morgan", "Taylor", "Jamie",
    "Avery", "Quinn", "Sarah", "Michael", "Emma", "Daniel", "Sophia", "Ethan",
    "Olivia", "Liam", "Isabella", "Noah", "Mia", "Lucas", "Ava", "Mason",
    "Charlotte", "Aiden", "Amelia", "Kai", "Zoe", "Diego",
]

LAST_NAMES = [
    "Nguyen", "Garcia", "Rodriguez", "Kim", "Patel", "Lee", "Martinez",
    "Chen", "Singh", "Nakamura", "Cruz", "Rivera", "Anderson", "Brown",
    "Lopez", "Reyes", "Torres", "Khan", "Ali", "Park", "Wong", "Jackson",
    "Green", "Cooper", "Hayes", "Wright", "Wells", "Diaz", "Foster", "Bennett",
]

AVATAR_URLS = [
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80",
    "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=400&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80",
]

EVENT_IMAGES = [
    "https://images.unsplash.com/photo-1511578314322-379afb476865?w=900&q=80",
    "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=900&q=80",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&q=80",
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=900&q=80",
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=900&q=80",
    "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&q=80",
    "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=900&q=80",
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=900&q=80",
    "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=900&q=80",
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=900&q=80",
    "https://images.unsplash.com/photo-1509824227185-9c5a01ceba0d?w=900&q=80",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&q=80",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80",
    "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=900&q=80",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&q=80",
]

CLUB_IMAGES = [
    "https://images.unsplash.com/photo-1583468982228-19f19164aee2?w=600&q=80",
    "https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=600&q=80",
    "https://images.unsplash.com/photo-1560523159-4a9692d222f9?w=600&q=80",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=80",
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&q=80",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=600&q=80",
    "https://images.unsplash.com/photo-1526401485004-46910ecc8e51?w=600&q=80",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80",
]

CLUBS = [
    ("Titan Anime Club", "Weekly screenings, cosplay meetups, and manga discussions.", "Culture", ["Anime", "Manga", "Movies"]),
    ("CSUF Esports", "Competitive & casual gaming — Valorant, Smash, League.", "Gaming", ["Gaming", "Technology"]),
    ("Fullerton Basketball League", "Pickup games at the SRC every week.", "Sports", ["Basketball", "Sports", "Fitness"]),
    ("Titan Coding Society", "Hackathons, workshops, and open-source projects.", "Tech", ["Coding", "Technology", "AI"]),
    ("Photo Club Fullerton", "Photo walks around campus and Orange County.", "Art", ["Photography", "Art", "Travel"]),
    ("Titan Foodies", "Weekly food adventures through OC and LA.", "Food", ["Food", "Coffee", "Travel"]),
    ("Entrepreneurship Society", "Founders, side hustlers, and pitch nights.", "Business", ["Entrepreneurship", "Business", "Finance"]),
    ("Volunteer Titans", "Community service projects every weekend.", "Service", ["Volunteering", "Books"]),
]

RECS = [
    ("Best cheap tacos near campus", "$2 tacos at El Farolito on Placentia — open till 2am.", "Food", "El Farolito, Placentia Ave", ["Food", "Nightlife"]),
    ("Quiet study spot everyone forgets", "3rd floor Pollak Library east wing. Outlets and windows.", "Study", "Pollak Library", ["Books", "Coding"]),
    ("Best coffee walk from campus", "Milk + T on Yorba Linda — 8 min walk, huge study area.", "Coffee", "Milk + T", ["Coffee", "Books"]),
    ("Hidden gym floor", "SRC second floor after 8pm is empty. Free weights galore.", "Fitness", "Student Rec Center", ["Fitness", "Gym"]),
    ("Sunday flea market", "OC Marketplace at the Fairgrounds — vintage clothes + food.", "Explore", "OC Fairgrounds", ["Fashion", "Food"]),
]

SOCIAL_STYLE_QUESTIONS = [
    "arrival",
    "friday_night",
    "spontaneous",
    "group_size",
]

EVENTS = [
    ("Titan Gaming Night", "Casual Smash + Valorant tournament. Snacks provided.", "Gaming", ["Gaming"], "Student Union Room 210", 1),
    ("Pickup Basketball @ SRC", "Come thru — 5v5 all night.", "Sports", ["Basketball", "Sports"], "Student Rec Center", 1),
    ("Anime Movie Night", "We're screening Perfect Blue. Pizza after.", "Culture", ["Anime", "Movies"], "Titan Theatre", 2),
    ("Coffee & Code", "Bring your laptop. Hang out. Build something.", "Tech", ["Coding", "Coffee"], "Milk + T", 2),
    ("Photo Walk: Old Town Fullerton", "Golden hour, downtown streets, friendly group.", "Art", ["Photography", "Art"], "Old Town Fullerton", 3),
    ("Late Night Taco Run", "Anyone down? Meeting at the fountain at 11pm.", "Food", ["Food", "Nightlife"], "Fountain, main quad", 0),
    ("Study Session: Finals Prep", "Bring your notes. We'll bring the coffee.", "Study", ["Books", "Coding"], "Pollak Library, 3F", 4),
    ("Sunset Hike @ Chino Hills", "Easy 4-mile loop. Great sunset views.", "Outdoor", ["Hiking", "Travel"], "Chino Hills SP", 5),
    ("Networking Mixer: Startups", "Meet founders from the entrepreneurship society.", "Networking", ["Entrepreneurship", "Business"], "Mihaylo Hall", 4),
    ("Comedy Open Mic", "Signups at 7. Show at 8. Free entry.", "Culture", ["Comedy", "Nightlife"], "Becker Amphitheater", 6),
    ("Soccer Pickup", "10v10 on the intramural fields.", "Sports", ["Soccer", "Sports"], "Intramural Fields", 3),
    ("Art Workshop: Watercolors", "All materials provided. Beginners welcome.", "Art", ["Art"], "Visual Arts Center", 5),
    ("K-pop Dance Night", "Learn choreo + jam session.", "Culture", ["Music", "Fashion"], "Dance Studio A", 6),
    ("Board Games @ Coffee Shop", "Catan, Codenames, whatever you bring.", "Casual", ["Books"], "Java City", 2),
    ("Volunteer: Beach Cleanup", "Meet at 8am, carpool to Huntington Beach.", "Service", ["Volunteering"], "Parking Lot A", 6),
]


def _pick(lst, n):
    return random.sample(lst, min(n, len(lst)))


def _insert(supabase, table, record):
    """Insert one record into a Supabase table."""
    supabase.table(table).insert(record).execute()


def _select_one(supabase, table, **filters):
    """Return one matching Supabase record or None."""
    query = supabase.table(table).select("*")

    for key, value in filters.items():
        query = query.eq(key, value)

    result = query.limit(1).execute()
    return result.data[0] if result.data else None


async def seed_all(supabase, hash_password):
    # Idempotent check
    result = (
        supabase.table("users")
        .select("id", count="exact")
        .eq("demo", True)
        .limit(1)
        .execute()
    )

    if (result.count or 0) > 0:
        return

    random.seed(42)
    now = datetime.now(timezone.utc)
    user_ids = []

    # 30 demo students
    for i in range(30):
        first = FIRST_NAMES[i % len(FIRST_NAMES)]
        last = LAST_NAMES[i % len(LAST_NAMES)]
        uid = str(uuid.uuid4())

        user_ids.append(uid)

        interests = _pick(
            INTERESTS_POOL,
            random.randint(4, 8),
        )

        social = {
            q: random.randint(0, 4)
            for q in SOCIAL_STYLE_QUESTIONS
        }

        personality = {
            "extroversion": random.randint(20, 90),
            "spontaneity": random.randint(20, 90),
            "energy": random.randint(20, 90),
            "depth": random.randint(20, 90),
            "competitive": random.randint(20, 90),
            "adventurous": random.randint(20, 90),
        }

        doc = {
            "demo": True,
            "id": uid,
            "email": f"demo{i}@circle.demo",
            "password_hash": hash_password("demo1234"),
            "first_name": first,
            "last_name": last,
            "date_of_birth": "2003-01-01",
            "university": DEMO_UNI,
            "verified": random.random() < 0.7,
            "onboarded": True,
            "interests": interests,
            "looking_for": _pick(
                LOOKING_FOR_POOL,
                random.randint(2, 4),
            ),
            "social_style": social,
            "personality": personality,
            "year": random.choice(YEARS),
            "major": random.choice(MAJORS),
            "lives_on_campus": random.random() < 0.4,
            "availability_days": _pick(
                DAYS,
                random.randint(3, 6),
            ),
            "availability_times": _pick(
                TIMES,
                random.randint(2, 3),
            ),
            "profile_photo_url": AVATAR_URLS[
                i % len(AVATAR_URLS)
            ],
            "bio": random.choice([
                f"{random.choice(YEARS)} studying {random.choice(MAJORS).lower()}. Down to try new things.",
                "Coffee addict. Looking for people to explore OC with.",
                "Gym in the morning, gaming at night. Let's link.",
                "Trying to meet more people this semester.",
                "Love good food and long convos.",
            ]),
            "created_at": now.isoformat(),
        }

        _insert(supabase, "users", doc)

    # 8 clubs
    for idx, (name, desc, cat, tags) in enumerate(CLUBS):
        cid = str(uuid.uuid4())

        _insert(
            supabase,
            "clubs",
            {
                "demo": True,
                "id": cid,
                "university": DEMO_UNI,
                "name": name,
                "description": desc,
                "category": cat,
                "tags": tags,
                "image_url": CLUB_IMAGES[
                    idx % len(CLUB_IMAGES)
                ],
                "member_ids": _pick(
                    user_ids,
                    random.randint(8, 20),
                ),
                "created_at": now.isoformat(),
            },
        )

    # 15 events over the next 2 weeks
    for idx, (
        title,
        desc,
        cat,
        tags,
        loc,
        days_ahead,
    ) in enumerate(EVENTS):

        eid = str(uuid.uuid4())
        date = (
            now + timedelta(days=days_ahead)
        ).strftime("%Y-%m-%d")

        time = random.choice([
            "6:00 PM",
            "7:00 PM",
            "8:00 PM",
            "5:30 PM",
            "11:00 AM",
            "2:00 PM",
            "9:00 PM",
        ])

        creator = random.choice(user_ids)

        creator_user = _select_one(
            supabase,
            "users",
            id=creator,
        )

        _insert(
            supabase,
            "events",
            {
                "demo": True,
                "id": eid,
                "creator_id": creator,
                "creator_name": (
                    f"{creator_user['first_name']} "
                    f"{creator_user['last_name']}"
                    if creator_user
                    else "Student"
                ),
                "title": title,
                "description": desc,
                "date": date,
                "time": time,
                "location": loc,
                "category": cat,
                "tags": tags,
                "capacity": random.choice([
                    None,
                    20,
                    30,
                    50,
                ]),
                "cover_image_url": EVENT_IMAGES[
                    idx % len(EVENT_IMAGES)
                ],
                "event_type": random.choice([
                    "student",
                    "official",
                    "hangout",
                ]),
                "created_at": now.isoformat(),
            },
        )

        attendees = _pick(
            user_ids,
            random.randint(6, 22),
        )

        for attendee in attendees:
            _insert(
                supabase,
                "event_attendees",
                {
                    "event_id": eid,
                    "user_id": attendee,
                    "status": random.choice([
                        "going",
                        "going",
                        "interested",
                    ]),
                    "updated_at": now.isoformat(),
                },
            )

    # 5 recommendations
    for idx, (
        title,
        desc,
        cat,
        loc,
        tags,
    ) in enumerate(RECS):

        creator = random.choice(user_ids)

        creator_user = _select_one(
            supabase,
            "users",
            id=creator,
        )

        _insert(
            supabase,
            "recommendations",
            {
                "demo": True,
                "id": str(uuid.uuid4()),
                "creator_id": creator,
                "creator_name": (
                    f"{creator_user['first_name']} "
                    f"{creator_user['last_name']}"
                    if creator_user
                    else "Student"
                ),
                "creator_photo": (
                    creator_user.get("profile_photo_url")
                    if creator_user
                    else None
                ),
                "title": title,
                "description": desc,
                "category": cat,
                "location": loc,
                "tags": tags,
                "image_url": EVENT_IMAGES[
                    (idx + 5) % len(EVENT_IMAGES)
                ],
                "saves": random.randint(5, 40),
                "created_at": now.isoformat(),
            },
        )

    # 3 Circles with chat
    circle_specs = [
        (
            "Night Owls",
            ["Gaming", "Food", "Music", "Nightlife"],
        ),
        (
            "Coffee & Coding",
            ["Coding", "Coffee", "AI", "Books"],
        ),
        (
            "Titan Ballers",
            ["Basketball", "Fitness", "Sports"],
        ),
    ]

    for name, interests in circle_specs:
        members = _pick(
            user_ids,
            random.randint(5, 8),
        )

        cid = str(uuid.uuid4())

        _insert(
            supabase,
            "circles",
            {
                "demo": True,
                "id": cid,
                "type": "group",
                "name": name,
                "creator_id": members[0],
                "member_ids": members,
                "interests": interests,
                "event_id": None,
                "verified_only": False,
                "is_lounge": False,
                "created_at": now.isoformat(),
            },
        )

        sample_msgs = [
            "yo who's down for tonight",
            "im in, what time?",
            "8pm at the usual spot",
            "bring snacks",
            "on my way",
        ]

        for i, txt in enumerate(sample_msgs):
            sender = random.choice(members)

            _insert(
                supabase,
                "messages",
                {
                    "id": str(uuid.uuid4()),
                    "circle_id": cid,
                    "sender_id": sender,
                    "content": txt,
                    "system": False,
                    "created_at": (
                        now - timedelta(hours=5 - i)
                    ).isoformat(),
                },
            )


async def seed_lounge(supabase):
    """Create the private Verified Lounge if it does not exist."""

    existing = _select_one(
        supabase,
        "circles",
        is_lounge=True,
    )

    if existing:
        return

    now = datetime.now(timezone.utc)

    result = (
        supabase.table("users")
        .select("id,first_name")
        .eq("demo", True)
        .eq("verified", True)
        .limit(50)
        .execute()
    )

    verified = result.data or []
    members = [
        user["id"]
        for user in verified[:10]
    ]

    cid = str(uuid.uuid4())

    _insert(
        supabase,
        "circles",
        {
            "demo": True,
            "id": cid,
            "type": "group",
            "name": "Verified Lounge",
            "description": "A private space for CSUF Verified Titans only.",
            "creator_id": (
                members[0]
                if members
                else "system"
            ),
            "member_ids": members,
            "interests": [
                "Campus Life",
                "Titans",
                "Verified",
            ],
            "event_id": None,
            "verified_only": True,
            "is_lounge": True,
            "created_at": now.isoformat(),
        },
    )

    msgs = [
        (
            None,
            "Welcome to the Verified Lounge — real Titans only ✓",
        ),
        (
            0,
            "finally a chat without randoms lol",
        ),
        (
            1,
            "anyone know if the library is open late this week?",
        ),
        (
            2,
            "yep till midnight during midterms",
        ),
    ]

    for i, (idx, txt) in enumerate(msgs):
        sender = (
            "system"
            if idx is None or idx >= len(members)
            else members[idx]
        )

        _insert(
            supabase,
            "messages",
            {
                "id": str(uuid.uuid4()),
                "circle_id": cid,
                "sender_id": sender,
                "content": txt,
                "system": sender == "system",
                "created_at": (
                    now - timedelta(hours=4 - i)
                ).isoformat(),
            },
        )