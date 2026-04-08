from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone
from typing import Any


DEMO_TZ = timezone(timedelta(hours=8))
INSTITUTION_ID = "inst-demo"
INSTITUTION_NAME = "智慧托育示范园"
DEFAULT_PERIOD_LABEL = "本周"
DEFAULT_PRIORITY_CHILD_ID = "c-16"
DEFAULT_HIGH_RISK_CHILD_ID = "c-8"
DEFAULT_HYDRATION_CHILD_ID = "c-15"

ATTENDANCE_DAYS = (0, 1, 2, 3)
DEFAULT_SNAPSHOT_KEYS = (
    "children",
    "attendance",
    "meals",
    "growth",
    "feedback",
    "health",
    "taskCheckIns",
    "interventionCards",
    "consultations",
    "mobileDrafts",
    "reminders",
)

CHILD_SEEDS: list[dict[str, Any]] = [
    {"id": "c-1", "name": "林小雨", "nickname": "小雨", "birthDate": "2023-08-12", "gender": "female", "allergies": ["牛奶", "芒果"], "className": "向阳班"},
    {"id": "c-2", "name": "张浩然", "nickname": "浩浩", "birthDate": "2022-05-09", "gender": "male", "allergies": [], "className": "向阳班"},
    {"id": "c-3", "name": "陈思琪", "nickname": "琪琪", "birthDate": "2020-11-19", "gender": "female", "allergies": ["芒果"], "className": "晨曦班"},
    {"id": "c-4", "name": "王小明", "nickname": "明明", "birthDate": "2024-06-03", "gender": "male", "allergies": [], "className": "向阳班"},
    {"id": "c-5", "name": "赵安安", "nickname": "安安", "birthDate": "2019-10-01", "gender": "female", "allergies": [], "className": "晨曦班"},
    {"id": "c-6", "name": "刘子轩", "nickname": "轩轩", "birthDate": "2023-01-20", "gender": "male", "allergies": ["鸡蛋"], "className": "向阳班"},
    {"id": "c-7", "name": "杨梓涵", "nickname": "涵涵", "birthDate": "2022-09-15", "gender": "female", "allergies": [], "className": "向阳班"},
    {"id": "c-8", "name": "黄嘉豪", "nickname": "豪豪", "birthDate": "2023-11-08", "gender": "male", "allergies": ["花生"], "className": "向阳班"},
    {"id": "c-9", "name": "吴悦彤", "nickname": "彤彤", "birthDate": "2021-03-22", "gender": "female", "allergies": [], "className": "晨曦班"},
    {"id": "c-10", "name": "孙宇航", "nickname": "航航", "birthDate": "2021-07-30", "gender": "male", "allergies": ["海鲜"], "className": "晨曦班"},
    {"id": "c-11", "name": "周诗雨", "nickname": "诗诗", "birthDate": "2022-12-05", "gender": "female", "allergies": [], "className": "向阳班"},
    {"id": "c-12", "name": "徐铭泽", "nickname": "铭铭", "birthDate": "2024-02-14", "gender": "male", "allergies": [], "className": "向阳班"},
    {"id": "c-13", "name": "何欣怡", "nickname": "欣欣", "birthDate": "2020-06-18", "gender": "female", "allergies": ["牛奶"], "className": "晨曦班"},
    {"id": "c-14", "name": "郑浩宇", "nickname": "浩宇", "birthDate": "2021-11-25", "gender": "male", "allergies": [], "className": "晨曦班"},
    {"id": "c-15", "name": "马若曦", "nickname": "曦曦", "birthDate": "2023-04-09", "gender": "female", "allergies": ["虾"], "className": "向阳班"},
    {"id": "c-16", "name": "高子墨", "nickname": "墨墨", "birthDate": "2022-02-28", "gender": "male", "allergies": [], "className": "晨曦班"},
    {"id": "c-17", "name": "陈子昂", "nickname": "子昂", "birthDate": "2022-01-17", "gender": "male", "allergies": [], "className": "向阳班"},
    {"id": "c-18", "name": "李沐宸", "nickname": "沐宸", "birthDate": "2022-02-18", "gender": "male", "allergies": [], "className": "晨曦班"},
    {"id": "c-19", "name": "张依诺", "nickname": "依诺", "birthDate": "2022-03-19", "gender": "female", "allergies": [], "className": "向阳班"},
    {"id": "c-20", "name": "王梓瑜", "nickname": "梓瑜", "birthDate": "2022-04-20", "gender": "female", "allergies": [], "className": "晨曦班"},
    {"id": "c-21", "name": "刘佳怡", "nickname": "佳怡", "birthDate": "2022-05-11", "gender": "female", "allergies": [], "className": "向阳班"},
    {"id": "c-22", "name": "赵梓轩", "nickname": "梓轩", "birthDate": "2022-06-12", "gender": "male", "allergies": [], "className": "晨曦班"},
    {"id": "c-23", "name": "黄语桐", "nickname": "语桐", "birthDate": "2022-07-13", "gender": "female", "allergies": [], "className": "向阳班"},
    {"id": "c-24", "name": "周浩轩", "nickname": "浩轩", "birthDate": "2022-08-14", "gender": "male", "allergies": [], "className": "晨曦班"},
    {"id": "c-25", "name": "吴雨桐", "nickname": "雨桐", "birthDate": "2022-09-15", "gender": "female", "allergies": [], "className": "向阳班"},
    {"id": "c-26", "name": "孙可馨", "nickname": "可馨", "birthDate": "2022-10-16", "gender": "female", "allergies": [], "className": "晨曦班"},
    {"id": "c-27", "name": "徐皓轩", "nickname": "皓轩", "birthDate": "2022-11-17", "gender": "male", "allergies": [], "className": "向阳班"},
    {"id": "c-28", "name": "马伊诺", "nickname": "伊诺", "birthDate": "2022-12-18", "gender": "female", "allergies": [], "className": "晨曦班"},
    {"id": "c-29", "name": "朱俊熙", "nickname": "俊熙", "birthDate": "2022-01-19", "gender": "male", "allergies": [], "className": "向阳班"},
    {"id": "c-30", "name": "胡子萱", "nickname": "子萱", "birthDate": "2022-02-20", "gender": "female", "allergies": [], "className": "晨曦班"},
    {"id": "c-31", "name": "郭梓睿", "nickname": "梓睿", "birthDate": "2022-03-21", "gender": "male", "allergies": [], "className": "向阳班"},
    {"id": "c-32", "name": "何瑞瑜", "nickname": "瑞瑜", "birthDate": "2022-04-22", "gender": "female", "allergies": [], "className": "晨曦班"},
    {"id": "c-33", "name": "高梦琪", "nickname": "梦琪", "birthDate": "2022-05-23", "gender": "female", "allergies": [], "className": "向阳班"},
    {"id": "c-34", "name": "林子涵", "nickname": "子涵", "birthDate": "2022-06-24", "gender": "female", "allergies": [], "className": "晨曦班"},
    {"id": "c-35", "name": "郑宇辰", "nickname": "宇辰", "birthDate": "2022-07-25", "gender": "male", "allergies": [], "className": "向阳班"},
    {"id": "c-36", "name": "梁奕辰", "nickname": "奕辰", "birthDate": "2022-08-26", "gender": "male", "allergies": [], "className": "晨曦班"},
]

SCENARIO_BY_CHILD = {
    "c-1": "positive-emotion",
    "c-2": "positive-motor",
    "c-3": "positive-language",
    "c-4": "transition-watch",
    "c-5": "positive-selfcare",
    "c-6": "allergy-watch",
    "c-7": "positive-motor",
    "c-8": "separation-sleep",
    "c-9": "positive-fine-motor",
    "c-10": "impulse-watch",
    "c-11": "picky-eating",
    "c-12": "language-review",
    "c-13": "positive-social",
    "c-14": "sleep-review",
    "c-15": "hydration-risk",
    "c-16": "sensitive-high-risk",
    "c-17": "mild-health",
    "c-18": "stable",
    "c-19": "family-gap",
    "c-20": "growth-review",
    "c-21": "picky-lite",
    "c-22": "stable",
    "c-23": "positive-social",
    "c-24": "review-lite",
    "c-25": "family-gap",
    "c-26": "positive-selfcare",
    "c-27": "mild-health",
    "c-28": "hydration-lite",
    "c-29": "positive-motor",
    "c-30": "stable",
    "c-31": "growth-review",
    "c-32": "positive-language",
    "c-33": "stable",
    "c-34": "stable",
    "c-35": "mild-health",
    "c-36": "positive-social",
}

HEALTH_ABNORMAL_IDS = {"c-6", "c-15", "c-16", "c-17", "c-27", "c-35"}
PICKY_OR_HYDRATION_IDS = {"c-11", "c-15", "c-21", "c-24", "c-28"}
GROWTH_ATTENTION_IDS = {"c-4", "c-8", "c-10", "c-12", "c-14", "c-16", "c-20", "c-31"}
PENDING_REVIEW_IDS = {"c-8", "c-12", "c-14", "c-20", "c-24"}
FEEDBACK_GAP_IDS = {"c-4", "c-8", "c-14", "c-16", "c-19", "c-24", "c-25", "c-31", "c-35"}
ESCALATION_CANDIDATE_IDS = {"c-8", "c-14", "c-15", "c-16"}
HIGHLIGHT_IDS = {"c-1", "c-2", "c-3", "c-5", "c-7", "c-13", "c-23", "c-29"}
NO_FEEDBACK_IDS = {"c-4", "c-19", "c-24", "c-25", "c-27", "c-30", "c-31", "c-35"}

SPECIAL_NOTES_BY_FOCUS = {
    "positive-emotion": "情绪恢复稳定，适合作为家长侧正向亮点。",
    "positive-motor": "大动作与专注表现稳定，适合作为录屏亮点。",
    "positive-language": "语言表达清晰，适合周报中的正向案例。",
    "positive-selfcare": "自理能力强，适合正向展示。",
    "positive-fine-motor": "精细动作发展稳定，适合家长侧正向展示。",
    "positive-social": "社交与分享表现突出，适合作为微绘本亮点。",
    "transition-watch": "入园过渡仍需陪伴，建议继续温和跟进。",
    "allergy-watch": "需继续避开过敏食物并观察皮肤反应。",
    "separation-sleep": "午睡前需要稳定过渡，适合作为会诊演示样本。",
    "impulse-watch": "等待与轮流时易着急，需要持续引导。",
    "picky-eating": "偏好熟悉食物，需要鼓励尝试蔬菜。",
    "language-review": "语言观察建议继续复查，不夸大为诊断结论。",
    "sleep-review": "午睡与晚间作息波动，需要待复查。",
    "hydration-risk": "补水偏低且需结合饮食节奏跟进。",
    "sensitive-high-risk": "环境变化时情绪敏感，可作为高风险会诊样本。",
    "mild-health": "有轻度健康观察信号，需保守跟进。",
    "family-gap": "家长反馈闭环偏弱，适合演示家园协同缺口。",
    "growth-review": "成长观察待继续复核，不包装成诊断结论。",
    "review-lite": "需要留一个待复查点，便于后续演示闭环。",
    "picky-lite": "偶发偏食，需要继续鼓励多样化进食。",
    "hydration-lite": "饮水量偏低但尚可通过提醒改善。",
    "stable": "已适应托育环境，可作为稳定背景样本。",
}


def _resolve_now(now: datetime | None = None) -> datetime:
    base = now or datetime.now(DEMO_TZ)
    if base.tzinfo is None:
        return base.replace(tzinfo=DEMO_TZ)
    return base.astimezone(DEMO_TZ)


def _date_text(now: datetime, days_ago: int) -> str:
    return (now - timedelta(days=days_ago)).date().isoformat()


def _datetime_text(now: datetime, days_ago: int, *, hour: int, minute: int) -> str:
    local = (now - timedelta(days=days_ago)).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return local.isoformat()


def _record_id(prefix: str, child_id: str, suffix: str) -> str:
    return f"{prefix}-{child_id}-{suffix}"


def _guardian(seed: dict[str, Any]) -> list[dict[str, Any]]:
    relation = "father" if seed["gender"] == "male" else "mother"
    label = "爸爸" if relation == "father" else "妈妈"
    child_index = int(seed["id"].split("-")[1])
    return [{"name": f"{seed['name'][0]}{label}", "relation": relation, "phone": f"1380000{child_index:04d}"}]


def _child_list_item(child: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": child["id"],
        "name": child["name"],
        "nickname": child.get("nickname"),
        "className": child["className"],
        "institutionId": child["institutionId"],
    }


def _ordered_selected_first(items: list[dict[str, Any]], selected_id: str) -> list[dict[str, Any]]:
    return sorted(items, key=lambda item: (item.get("id") != selected_id, item.get("className", ""), item.get("id", "")))


def _build_children() -> list[dict[str, Any]]:
    children: list[dict[str, Any]] = []
    for index, seed in enumerate(CHILD_SEEDS, start=1):
        focus = SCENARIO_BY_CHILD[seed["id"]]
        children.append(
            {
                "id": seed["id"],
                "name": seed["name"],
                "nickname": seed["nickname"],
                "birthDate": seed["birthDate"],
                "gender": seed["gender"],
                "allergies": list(seed["allergies"]),
                "heightCm": 88 + ((index * 3) % 24),
                "weightKg": round(13.2 + ((index * 5) % 18) / 2.0, 1),
                "guardians": _guardian(seed),
                "institutionId": INSTITUTION_ID,
                "className": seed["className"],
                "specialNotes": SPECIAL_NOTES_BY_FOCUS[focus],
            }
        )
    return children


def _build_attendance_records(child: dict[str, Any], now: datetime) -> list[dict[str, Any]]:
    child_number = int(child["id"].split("-")[1])
    records: list[dict[str, Any]] = []
    for days_ago in ATTENDANCE_DAYS:
        status = "present"
        if days_ago == 1 and child_number in {18, 30}:
            status = "late"
        if days_ago == 2 and child_number in {4, 25, 33}:
            status = "absent"
        records.append(
            {
                "id": _record_id("attendance", child["id"], str(days_ago)),
                "childId": child["id"],
                "date": _date_text(now, days_ago),
                "status": status,
                "checkedInAt": _datetime_text(now, days_ago, hour=8, minute=36 + (child_number % 8)),
            }
        )
    return records


def _meal_record(
    child: dict[str, Any],
    now: datetime,
    *,
    days_ago: int,
    foods: list[str],
    intake_level: str,
    preference: str,
    water_ml: int,
    nutrition_score: int,
    summary: str,
) -> dict[str, Any]:
    return {
        "id": _record_id("meal", child["id"], str(days_ago)),
        "childId": child["id"],
        "date": _date_text(now, days_ago),
        "meal": "lunch",
        "foods": foods,
        "intakeLevel": intake_level,
        "preference": preference,
        "waterMl": water_ml,
        "nutritionScore": nutrition_score,
        "aiEvaluation": {"summary": summary},
    }


def _build_meal_records(child: dict[str, Any], now: datetime) -> list[dict[str, Any]]:
    focus = SCENARIO_BY_CHILD[child["id"]]
    if focus == "picky-eating":
        return [
            _meal_record(child, now, days_ago=0, foods=["米饭", "蒸蛋", "青菜"], intake_level="low", preference="dislike", water_ml=115, nutrition_score=63, summary="偏爱主食和鸡蛋，蔬菜基本未动。"),
            _meal_record(child, now, days_ago=2, foods=["面条", "胡萝卜", "鸡肉"], intake_level="low", preference="dislike", water_ml=120, nutrition_score=65, summary="重复挑出胡萝卜，只愿意吃面和鸡肉。"),
            _meal_record(child, now, days_ago=4, foods=["米饭", "南瓜", "鱼丸"], intake_level="medium", preference="neutral", water_ml=135, nutrition_score=71, summary="主食接受度尚可，但仍需要鼓励尝试蔬菜。"),
            _meal_record(child, now, days_ago=6, foods=["小米饭", "西兰花", "牛肉"], intake_level="low", preference="dislike", water_ml=110, nutrition_score=64, summary="看到西兰花后出现回避，进食速度明显变慢。"),
        ]
    if focus == "hydration-risk":
        return [
            _meal_record(child, now, days_ago=0, foods=["米饭", "鸡肉", "青菜"], intake_level="medium", preference="neutral", water_ml=90, nutrition_score=73, summary="进食尚可，但全天饮水偏低，需要反复提醒。"),
            _meal_record(child, now, days_ago=1, foods=["小馄饨", "豆腐", "菠菜"], intake_level="medium", preference="neutral", water_ml=88, nutrition_score=72, summary="午餐接受度稳定，但补水不足 100ml。"),
            _meal_record(child, now, days_ago=3, foods=["米饭", "虾仁替代菜", "南瓜"], intake_level="good", preference="accept", water_ml=96, nutrition_score=77, summary="避开过敏食物后进食更顺利，但仍需要定时喝水。"),
            _meal_record(child, now, days_ago=5, foods=["面条", "鸡丝", "油麦菜"], intake_level="medium", preference="neutral", water_ml=92, nutrition_score=74, summary="进食正常，饮水仍偏少。"),
        ]
    if focus == "hydration-lite":
        return [
            _meal_record(child, now, days_ago=0, foods=["米饭", "豆腐", "青菜"], intake_level="medium", preference="neutral", water_ml=118, nutrition_score=76, summary="进食平稳，下午喝水量仍偏少。"),
            _meal_record(child, now, days_ago=3, foods=["鸡肉", "南瓜", "米饭"], intake_level="good", preference="accept", water_ml=122, nutrition_score=80, summary="整体进食不错，但需要继续提醒补水。"),
            _meal_record(child, now, days_ago=5, foods=["粥", "鸡蛋", "西兰花"], intake_level="medium", preference="neutral", water_ml=115, nutrition_score=75, summary="饮水量略低于班级平均。"),
        ]
    if focus == "picky-lite":
        return [
            _meal_record(child, now, days_ago=0, foods=["米饭", "鸡肉", "西兰花"], intake_level="medium", preference="neutral", water_ml=132, nutrition_score=74, summary="对新蔬菜略有犹豫，但在提醒后愿意尝试一口。"),
            _meal_record(child, now, days_ago=3, foods=["面条", "胡萝卜", "牛肉"], intake_level="low", preference="dislike", water_ml=128, nutrition_score=70, summary="会先挑出胡萝卜，需要同伴示范后才继续吃。"),
            _meal_record(child, now, days_ago=5, foods=["米饭", "南瓜", "鱼丸"], intake_level="medium", preference="neutral", water_ml=130, nutrition_score=73, summary="熟悉食物接受度更高。"),
        ]
    intake_level = "good" if focus.startswith("positive") or focus == "stable" else "medium"
    preference = "accept" if intake_level == "good" else "neutral"
    base_score = 86 if intake_level == "good" else 79
    water = 165 if intake_level == "good" else 148
    summary = "主食、蛋白和蔬菜搭配稳定，饮水记录正常。"
    if focus in {"transition-watch", "family-gap", "growth-review", "review-lite", "sleep-review", "sensitive-high-risk", "separation-sleep"}:
        summary = "进食基本完成，仍需结合情绪和作息一起观察。"
    if focus == "impulse-watch":
        summary = "进食速度快，等待加餐时容易着急，需要提醒轮流。"
    return [
        _meal_record(child, now, days_ago=1, foods=["米饭", "鸡肉", "青菜"], intake_level=intake_level, preference=preference, water_ml=water, nutrition_score=base_score, summary=summary),
        _meal_record(child, now, days_ago=4, foods=["面条", "豆腐", "南瓜"], intake_level="medium", preference="neutral", water_ml=max(water - 10, 120), nutrition_score=base_score - 4, summary="整体进食稳定，水量接近班级平均。"),
    ]


def _health_record(
    child: dict[str, Any],
    now: datetime,
    *,
    days_ago: int,
    temperature: float,
    mood: str,
    remark: str,
    is_abnormal: bool,
) -> dict[str, Any]:
    return {
        "id": _record_id("health", child["id"], str(days_ago)),
        "childId": child["id"],
        "date": _date_text(now, days_ago),
        "temperature": temperature,
        "mood": mood,
        "handMouthEye": "正常",
        "isAbnormal": is_abnormal,
        "remark": remark,
        "checkedBy": "李老师",
    }


def _build_health_records(child: dict[str, Any], now: datetime) -> list[dict[str, Any]]:
    focus = SCENARIO_BY_CHILD[child["id"]]
    if focus == "allergy-watch":
        return [
            _health_record(child, now, days_ago=0, temperature=36.7, mood="稳定", remark="点心后手背轻微泛红，已提醒避开鸡蛋类加餐。", is_abnormal=True),
            _health_record(child, now, days_ago=2, temperature=36.6, mood="稳定", remark="皮肤状态较昨日平稳，继续观察。", is_abnormal=False),
        ]
    if focus == "separation-sleep":
        return [
            _health_record(child, now, days_ago=0, temperature=36.6, mood="午睡前紧张", remark="晨检体温正常，但午睡前再次出现哭闹，需要安抚。", is_abnormal=False),
            _health_record(child, now, days_ago=2, temperature=36.5, mood="依恋老师", remark="入园时提到想妈妈，过渡时间仍偏长。", is_abnormal=False),
        ]
    if focus == "sleep-review":
        return [
            _health_record(child, now, days_ago=0, temperature=36.5, mood="疲惫", remark="近两天午睡质量偏差，上午活动时精神不足。", is_abnormal=False),
            _health_record(child, now, days_ago=1, temperature=36.6, mood="易躁", remark="前一晚入睡较晚，晨间明显困倦。", is_abnormal=False),
        ]
    if focus == "hydration-risk":
        return [
            _health_record(child, now, days_ago=0, temperature=36.6, mood="稍疲惫", remark="今日口唇偏干，提醒后才愿意补水。", is_abnormal=True),
            _health_record(child, now, days_ago=3, temperature=36.6, mood="稳定", remark="补水后精神状态稍有改善。", is_abnormal=False),
        ]
    if focus == "sensitive-high-risk":
        return [
            _health_record(child, now, days_ago=0, temperature=36.5, mood="敏感紧张", remark="换教室后出现明显紧张反应，需要老师单独陪伴。", is_abnormal=True),
            _health_record(child, now, days_ago=2, temperature=36.4, mood="恢复中", remark="环境变化时仍容易退缩。", is_abnormal=False),
        ]
    if focus == "mild-health":
        return [
            _health_record(child, now, days_ago=0, temperature=37.6, mood="疲惫", remark="晨检出现轻咳或喉咙发红，建议今天继续观察。", is_abnormal=True),
            _health_record(child, now, days_ago=2, temperature=36.7, mood="稳定", remark="前两日状态相对平稳。", is_abnormal=False),
        ]
    return [_health_record(child, now, days_ago=0, temperature=36.6, mood="稳定", remark="晨检状态平稳。", is_abnormal=False)]


def _growth_record(
    child: dict[str, Any],
    now: datetime,
    *,
    days_ago: int,
    category: str,
    tags: list[str],
    description: str,
    selected_indicators: list[str],
    needs_attention: bool = False,
    follow_up_action: str | None = None,
    review_status: str | None = None,
    review_days_ahead: int | None = None,
) -> dict[str, Any]:
    record: dict[str, Any] = {
        "id": _record_id("growth", child["id"], str(days_ago)),
        "childId": child["id"],
        "createdAt": _datetime_text(now, days_ago, hour=10, minute=10 + int(child["id"].split("-")[1]) % 20),
        "recorder": "李老师",
        "recorderRole": "teacher",
        "category": category,
        "tags": tags,
        "selectedIndicators": selected_indicators,
        "description": description,
        "needsAttention": needs_attention,
        "followUpAction": follow_up_action or "",
    }
    if review_status:
        record["reviewStatus"] = review_status
    if review_days_ahead is not None:
        record["reviewDate"] = _date_text(now, -review_days_ahead)
    return record


def _build_growth_records(child: dict[str, Any], now: datetime) -> list[dict[str, Any]]:
    focus = SCENARIO_BY_CHILD[child["id"]]
    positive_note = f"{child['name']} 今天在集体活动中表现稳定，愿意跟随老师完成任务。"
    if focus == "positive-emotion":
        return [_growth_record(child, now, days_ago=0, category="social-emotional", tags=["稳定", "主动问好"], description=f"{child['name']} 入园后恢复较快，愿意主动和老师说早安。", selected_indicators=["情绪调节"])]
    if focus == "positive-motor":
        return [_growth_record(child, now, days_ago=1, category="gross-motor", tags=["平衡", "专注"], description=f"{child['name']} 在户外活动中能稳定完成平衡路线，专注时间比上周更稳。", selected_indicators=["大动作"])]
    if focus == "positive-language":
        return [_growth_record(child, now, days_ago=1, category="language", tags=["表达清晰", "主动分享"], description=f"{child['name']} 今天能完整描述活动经过，并愿意回应同伴提问。", selected_indicators=["语言表达"])]
    if focus == "positive-selfcare":
        return [_growth_record(child, now, days_ago=2, category="self-care", tags=["自理", "带动同伴"], description=f"{child['name']} 今天能自主完成洗手和收纳，还会提醒同伴按步骤完成。", selected_indicators=["自理能力"])]
    if focus == "positive-fine-motor":
        return [_growth_record(child, now, days_ago=2, category="fine-motor", tags=["串珠", "专注"], description=f"{child['name']} 完成串珠和涂色任务时专注稳定，手部控制较好。", selected_indicators=["精细动作"])]
    if focus == "positive-social":
        return [_growth_record(child, now, days_ago=0, category="social", tags=["分享", "合作"], description=f"{child['name']} 主动邀请同伴合作，愿意等待轮流并分享材料。", selected_indicators=["社会交往"])]
    if focus == "transition-watch":
        return [_growth_record(child, now, days_ago=0, category="social-emotional", tags=["入园适应", "分离焦虑"], description=f"{child['name']} 入园后需要陪伴过渡约 10 分钟，之后能逐步参与活动。", selected_indicators=["情绪调节"], needs_attention=True, follow_up_action="继续使用固定接园和入园问候流程。")]
    if focus == "separation-sleep":
        return [
            _growth_record(child, now, days_ago=0, category="sleep-routine", tags=["午睡", "哭闹", "安抚"], description=f"{child['name']} 午睡前再次哭闹，需要抱抱和安抚后才肯躺下。", selected_indicators=["情绪调节"], needs_attention=True, follow_up_action="连续观察午睡前过渡，并同步家庭晚间作息。", review_status="待复查", review_days_ahead=1),
            _growth_record(child, now, days_ago=3, category="social-emotional", tags=["想妈妈", "依恋"], description=f"{child['name']} 晨间入园提到想妈妈，情绪平复前不愿离开老师。", selected_indicators=["情绪调节"], needs_attention=True, follow_up_action="留意入园过渡时长。"),
        ]
    if focus == "impulse-watch":
        return [_growth_record(child, now, days_ago=1, category="social", tags=["等待困难", "冲动"], description=f"{child['name']} 排队等待时容易着急，需要老师提醒轮流和降速。", selected_indicators=["社会交往"], needs_attention=True, follow_up_action="继续在规则游戏中练习等待。")]
    if focus == "picky-eating":
        return [_growth_record(child, now, days_ago=2, category="diet-behavior", tags=["偏食", "蔬菜回避"], description=f"{child['name']} 遇到新蔬菜仍以回避为主，熟悉食物接受度明显更高。", selected_indicators=["饮食行为"], needs_attention=True, follow_up_action="保持园内与家庭一致的食物引导方式。")]
    if focus == "language-review":
        return [
            _growth_record(child, now, days_ago=0, category="language", tags=["咿呀", "模仿"], description=f"{child['name']} 能回应点名并模仿单音节表达，但主动表达仍偏少。", selected_indicators=["语言表达"], needs_attention=True, follow_up_action="两周内继续观察词汇和跟读意愿。", review_status="待复查", review_days_ahead=2),
            _growth_record(child, now, days_ago=4, category="language", tags=["模仿", "指认"], description=f"{child['name']} 对图片指认反应积极，愿意跟随老师发音。", selected_indicators=["语言表达"]),
        ]
    if focus == "sleep-review":
        return [
            _growth_record(child, now, days_ago=0, category="sleep-routine", tags=["难入睡", "易醒"], description=f"{child['name']} 午睡入睡时间再次超过 25 分钟，醒后情绪恢复偏慢。", selected_indicators=["睡眠作息"], needs_attention=True, follow_up_action="连续记录晚间入睡时间并校对午睡质量。", review_status="待复查", review_days_ahead=1),
            _growth_record(child, now, days_ago=2, category="social-emotional", tags=["疲惫", "易躁"], description=f"{child['name']} 因睡眠不足，在上午活动中更容易急躁。", selected_indicators=["情绪调节"], needs_attention=True, follow_up_action="优先保证睡前节奏。"),
        ]
    if focus == "hydration-risk":
        return [_growth_record(child, now, days_ago=1, category="diet-behavior", tags=["饮水偏低", "需提醒"], description=f"{child['name']} 今天补水依赖老师反复提醒，建议继续观察午后精神状态。", selected_indicators=["饮食行为"], needs_attention=True, follow_up_action="在园内外同步使用小水杯定时补水。")]
    if focus == "sensitive-high-risk":
        return [
            _growth_record(child, now, days_ago=0, category="social-emotional", tags=["环境变化", "退缩"], description=f"{child['name']} 换教室后情绪明显波动，躲在角落哭闹约 10 分钟。", selected_indicators=["情绪调节"], needs_attention=True, follow_up_action="保留固定安抚流程并减少突发环境变化。"),
            _growth_record(child, now, days_ago=3, category="social", tags=["敏感", "声响回撤"], description=f"{child['name']} 对突发声响较敏感，回教室过渡时需要单独陪伴。", selected_indicators=["社会交往"], needs_attention=True, follow_up_action="继续观察触发点并与家长同步。"),
        ]
    if focus == "family-gap":
        return [_growth_record(child, now, days_ago=2, category="daily-observation", tags=["待闭环"], description=f"{child['name']} 园内表现整体稳定，但近期家庭侧反馈尚未形成稳定闭环。", selected_indicators=["家园协同"], needs_attention=True, follow_up_action="尽快补齐家庭回传。")]
    if focus == "growth-review":
        return [_growth_record(child, now, days_ago=1, category="development", tags=["待复核"], description=f"{child['name']} 本周成长观察有新变化，建议继续保守观察。", selected_indicators=["成长观察"], needs_attention=True, follow_up_action="一周内复核一次新表现。", review_status="待复查", review_days_ahead=2)]
    if focus == "review-lite":
        return [_growth_record(child, now, days_ago=1, category="development", tags=["跟进", "复查点"], description=f"{child['name']} 本周出现一次轻微波动，建议留一个待复查点即可。", selected_indicators=["成长观察"], needs_attention=True, follow_up_action="保持轻量跟进。", review_status="待复查", review_days_ahead=3)]
    if focus == "picky-lite":
        return [_growth_record(child, now, days_ago=1, category="diet-behavior", tags=["挑食", "尝试"], description=f"{child['name']} 对少数新菜仍显谨慎，但在同伴示范下愿意尝试。", selected_indicators=["饮食行为"], needs_attention=True, follow_up_action="继续用小份尝试法。")]
    if focus == "hydration-lite":
        return [_growth_record(child, now, days_ago=2, category="diet-behavior", tags=["饮水提醒"], description=f"{child['name']} 下午活动后补水主动性偏弱，需要固定提醒。", selected_indicators=["饮食行为"], needs_attention=True, follow_up_action="午后活动后固定补水。")]
    if focus == "mild-health":
        return [_growth_record(child, now, days_ago=1, category="health-observation", tags=["健康观察", "轻症"], description=f"{child['name']} 今天有轻度不适信号，班级已保守跟进。", selected_indicators=["健康观察"], needs_attention=True, follow_up_action="关注 48 小时内体温和精神状态。")]
    return [_growth_record(child, now, days_ago=2, category="daily-observation", tags=["稳定"], description=positive_note, selected_indicators=["日常观察"])]


def _feedback_record(
    child: dict[str, Any],
    now: datetime,
    *,
    days_ago: int,
    status: str,
    content: str,
    child_reaction: str,
    improved: str,
    free_note: str,
) -> dict[str, Any]:
    return {
        "id": _record_id("feedback", child["id"], str(days_ago)),
        "childId": child["id"],
        "date": _date_text(now, days_ago),
        "status": status,
        "content": content,
        "sourceWorkflow": "manual",
        "executed": True,
        "childReaction": child_reaction,
        "improved": improved,
        "freeNote": free_note,
    }


def _build_feedback_records(child: dict[str, Any], now: datetime) -> list[dict[str, Any]]:
    child_id = child["id"]
    focus = SCENARIO_BY_CHILD[child_id]
    if child_id in NO_FEEDBACK_IDS:
        return []
    if focus == "separation-sleep":
        return [_feedback_record(child, now, days_ago=1, status="部分执行", content="昨晚已尝试提前进入睡前安静流程，但孩子仍会在说到午睡时变得黏人。", child_reaction="入睡前情绪波动仍较明显", improved="partial", free_note="需要继续和园内保持同一套安抚话术。")]
    if focus == "picky-eating":
        return [
            _feedback_record(child, now, days_ago=1, status="在家已配合", content="昨晚继续尝试把蔬菜藏在面食里，孩子愿意尝试几口。", child_reaction="对熟悉口味接受更高", improved="partial", free_note="希望继续和园内同步节奏。"),
            _feedback_record(child, now, days_ago=0, status="今晚反馈", content="今晚会继续用小份蔬菜加主食的方式，再看是否愿意主动入口。", child_reaction="待观察", improved="unknown", free_note="明早补充结果。"),
        ]
    if focus == "sleep-review":
        return [_feedback_record(child, now, days_ago=1, status="部分执行", content="前晚已尝试提前关灯，但昨晚又因玩具拖延入睡。", child_reaction="晨起仍显困倦", improved="partial", free_note="需要继续固定睡前节奏。")]
    if focus == "hydration-risk":
        return [_feedback_record(child, now, days_ago=0, status="已知晓", content="家里已准备带刻度的小水壶，今晚会继续提醒定时喝水。", child_reaction="在家喝水意愿一般", improved="unknown", free_note="明早反馈晚间补水情况。")]
    if focus == "sensitive-high-risk":
        return [_feedback_record(child, now, days_ago=0, status="今晚反馈", content="这两天在家确实更敏感，我们会减少突发声响并用绘本引导识别情绪。", child_reaction="需要安静环境时更愿意靠近家长", improved="partial", free_note="明天继续回传反应。")]
    if focus in {"positive-emotion", "positive-language", "positive-social", "positive-selfcare", "positive-motor", "positive-fine-motor"}:
        return [_feedback_record(child, now, days_ago=1, status="在家已配合", content=f"已看到 {child['name']} 今天的亮点记录，家里会继续用同样方式鼓励。", child_reaction="愿意复述今天最开心的瞬间", improved="yes", free_note="适合作为正向展示素材。")]
    if focus == "allergy-watch":
        return [_feedback_record(child, now, days_ago=2, status="已知晓", content="已确认家里和园里都继续避开鸡蛋点心。", child_reaction="状态稳定", improved="yes", free_note="会继续看皮肤变化。")]
    return [_feedback_record(child, now, days_ago=2, status="已知晓", content=f"已收到关于 {child['name']} 的日常观察，今晚会继续留意。", child_reaction="在家状态平稳", improved="unknown", free_note="如有新变化会同步老师。")]


def _sort_records(snapshot: dict[str, Any]) -> None:
    for key, field_name in (("attendance", "date"), ("meals", "date"), ("health", "date"), ("feedback", "date")):
        snapshot[key].sort(key=lambda item: item.get(field_name, ""), reverse=True)
    snapshot["growth"].sort(key=lambda item: item.get("createdAt", ""), reverse=True)


def build_demo_snapshot(now: datetime | None = None) -> dict[str, Any]:
    current = _resolve_now(now)
    children = _build_children()
    snapshot: dict[str, Any] = {key: [] for key in DEFAULT_SNAPSHOT_KEYS}
    snapshot["children"] = children
    snapshot["updatedAt"] = current.isoformat()

    for child in children:
        snapshot["attendance"].extend(_build_attendance_records(child, current))
        snapshot["meals"].extend(_build_meal_records(child, current))
        snapshot["health"].extend(_build_health_records(child, current))
        snapshot["growth"].extend(_build_growth_records(child, current))
        snapshot["feedback"].extend(_build_feedback_records(child, current))

    _sort_records(snapshot)
    return snapshot


def _pick_child(snapshot: dict[str, Any], child_id: str | None) -> dict[str, Any]:
    normalized_id = (child_id or "").strip()
    children = [item for item in snapshot.get("children", []) if isinstance(item, dict)]
    if normalized_id:
        for child in children:
            if child.get("id") == normalized_id:
                return copy.deepcopy(child)
    for preferred_id in (DEFAULT_HIGH_RISK_CHILD_ID, DEFAULT_HYDRATION_CHILD_ID, DEFAULT_PRIORITY_CHILD_ID):
        for child in children:
            if child.get("id") == preferred_id:
                return copy.deepcopy(child)
    return copy.deepcopy(children[0]) if children else {}


def _class_visible_children(snapshot: dict[str, Any], selected_child_id: str) -> list[dict[str, Any]]:
    selected = _pick_child(snapshot, selected_child_id)
    class_name = selected.get("className")
    classmates = [_child_list_item(child) for child in snapshot.get("children", []) if child.get("className") == class_name]
    return _ordered_selected_first(classmates, selected_child_id)


def _present_children(snapshot: dict[str, Any], selected_child_id: str, now: datetime) -> list[dict[str, Any]]:
    today = _date_text(now, 0)
    present_ids = {
        item.get("childId")
        for item in snapshot.get("attendance", [])
        if item.get("date") == today and item.get("status") in {"present", "late"}
    }
    visible = _class_visible_children(snapshot, selected_child_id)
    return [item for item in visible if item.get("id") in present_ids]


def _overview() -> dict[str, Any]:
    feedback_children = len(CHILD_SEEDS) - len(NO_FEEDBACK_IDS)
    return {
        "visibleChildren": len(CHILD_SEEDS),
        "classCount": 2,
        "attendanceRate": 92,
        "healthAbnormalCount": len(HEALTH_ABNORMAL_IDS),
        "growthAttentionCount": len(GROWTH_ATTENTION_IDS),
        "pendingReviewCount": len(PENDING_REVIEW_IDS),
        "feedbackCount": feedback_children,
        "feedbackCompletionRate": round(feedback_children * 100 / len(CHILD_SEEDS)),
        "riskChildrenCount": len(ESCALATION_CANDIDATE_IDS),
        "riskClassCount": 2,
    }


def _summary(selected_child_id: str | None) -> dict[str, Any]:
    return {
        "health": {"abnormalCount": len(HEALTH_ABNORMAL_IDS)},
        "growth": {
            "attentionCount": len(GROWTH_ATTENTION_IDS),
            "pendingReviewCount": len(PENDING_REVIEW_IDS),
        },
        "meals": {
            "allergyRiskCount": 3,
            "pickyCount": len(PICKY_OR_HYDRATION_IDS),
            "hydrationLowCount": len(PICKY_OR_HYDRATION_IDS),
        },
        "feedback": {
            "count": len(CHILD_SEEDS) - len(NO_FEEDBACK_IDS),
            "gapCount": len(FEEDBACK_GAP_IDS),
            "completionRate": _overview()["feedbackCompletionRate"],
        },
        "priorityChildId": DEFAULT_PRIORITY_CHILD_ID,
        "highlights": [
            "正向亮点与高风险样本并存，适合周报和家长侧录屏。",
            "重点样本可覆盖健康、饮食、成长、反馈与待复查链路。",
        ],
        "escalationCandidates": sorted(ESCALATION_CANDIDATE_IDS),
        "selectedChildId": (selected_child_id or "").strip(),
    }


def build_demo_weekly_snapshot(*, target_child_id: str | None = None, now: datetime | None = None) -> dict[str, Any]:
    current = _resolve_now(now)
    snapshot = build_demo_snapshot(current)
    selected = _pick_child(snapshot, target_child_id or DEFAULT_PRIORITY_CHILD_ID)
    return {
        "institutionName": INSTITUTION_NAME,
        "institutionId": INSTITUTION_ID,
        "periodLabel": DEFAULT_PERIOD_LABEL,
        "overview": _overview(),
        "summary": _summary(selected.get("id")),
        "child": _child_list_item(selected) if selected else {},
        "updatedAt": snapshot["updatedAt"],
    }


def build_demo_child_service_payload(*, target_child_id: str | None = None, now: datetime | None = None) -> dict[str, Any]:
    current = _resolve_now(now)
    snapshot = build_demo_snapshot(current)
    selected = _pick_child(snapshot, target_child_id or DEFAULT_HIGH_RISK_CHILD_ID)
    selected_id = selected.get("id", DEFAULT_HIGH_RISK_CHILD_ID)
    return {
        "targetChildId": selected_id,
        "visibleChildren": _class_visible_children(snapshot, selected_id),
        "presentChildren": _present_children(snapshot, selected_id, current),
        "healthCheckRecords": [copy.deepcopy(item) for item in snapshot["health"] if item.get("childId") == selected_id],
        "growthRecords": [copy.deepcopy(item) for item in snapshot["growth"] if item.get("childId") == selected_id],
        "guardianFeedbacks": [copy.deepcopy(item) for item in snapshot["feedback"] if item.get("childId") == selected_id],
        "currentUser": {
            "id": "teacher-demo",
            "name": "演示老师",
            "className": selected.get("className") or "向阳班",
            "institutionId": INSTITUTION_ID,
            "institutionName": INSTITUTION_NAME,
        },
        "snapshot": build_demo_weekly_snapshot(target_child_id=selected_id, now=current),
    }


def build_demo_admin_payload(now: datetime | None = None) -> dict[str, Any]:
    current = _resolve_now(now)
    snapshot = build_demo_snapshot(current)
    children = [_child_list_item(child) for child in snapshot["children"]]
    ordered_children = _ordered_selected_first(children, DEFAULT_PRIORITY_CHILD_ID)
    return {
        "visibleChildren": ordered_children,
        "guardianFeedbacks": copy.deepcopy(snapshot["feedback"]),
        "currentUser": {
            "id": "admin-demo",
            "name": "园长王老师",
            "institutionId": INSTITUTION_ID,
            "institutionName": INSTITUTION_NAME,
        },
        "snapshot": build_demo_weekly_snapshot(target_child_id=DEFAULT_PRIORITY_CHILD_ID, now=current),
    }


def build_demo_consultation_feed_items(now: datetime | None = None) -> list[dict[str, Any]]:
    current = _resolve_now(now)
    snapshot = build_demo_snapshot(current)
    child_map = {child["id"]: child for child in snapshot["children"]}
    specs = [
        {
            "childId": "c-16",
            "daysAgo": 0,
            "riskLevel": "high",
            "status": "pending",
            "ownerRole": "admin",
            "ownerName": "园长王老师",
            "triggerReason": "环境变化后的情绪崩溃仍在反复",
            "summary": "情绪敏感样本仍需高风险闭环，建议优先保留安抚流程并同步家庭回传。",
            "shouldEscalate": True,
        },
        {
            "childId": "c-15",
            "daysAgo": 1,
            "riskLevel": "high",
            "status": "pending",
            "ownerRole": "teacher",
            "ownerName": "班级老师",
            "triggerReason": "补水持续偏低并叠加过敏饮食避让",
            "summary": "饮水偏低样本需要继续日内补水记录，并约定晚间家庭补水反馈。",
            "shouldEscalate": True,
        },
        {
            "childId": "c-14",
            "daysAgo": 2,
            "riskLevel": "high",
            "status": "watch",
            "ownerRole": "teacher",
            "ownerName": "班级老师",
            "triggerReason": "午睡和晚间作息波动仍未完全稳定",
            "summary": "睡眠待复查样本需要保留 48 小时复查点，避免过早下结论。",
            "shouldEscalate": False,
        },
        {
            "childId": "c-8",
            "daysAgo": 3,
            "riskLevel": "medium",
            "status": "pending",
            "ownerRole": "teacher",
            "ownerName": "班级老师",
            "triggerReason": "午睡前分离焦虑与家庭反馈缺口叠加",
            "summary": "午睡分离焦虑样本适合继续用园内记录加家庭反馈形成闭环。",
            "shouldEscalate": False,
        },
    ]
    items: list[dict[str, Any]] = []
    for spec in specs:
        child = child_map[spec["childId"]]
        generated_at = _datetime_text(current, spec["daysAgo"], hour=17, minute=20)
        director_card = {
            "title": "园长决策卡",
            "reason": spec["triggerReason"],
            "recommendedOwnerRole": spec["ownerRole"],
            "recommendedOwnerName": spec["ownerName"],
            "recommendedAt": "today" if spec["daysAgo"] == 0 else _date_text(current, spec["daysAgo"]),
            "status": spec["status"],
        }
        items.append(
            {
                "consultationId": f"consultation-{spec['childId']}",
                "childId": spec["childId"],
                "generatedAt": generated_at,
                "riskLevel": spec["riskLevel"],
                "triggerReason": spec["triggerReason"],
                "triggerReasons": [spec["triggerReason"], f"{child['name']} 的园内观察与家庭反馈需要继续闭环。"],
                "summary": spec["summary"],
                "directorDecisionCard": director_card,
                "status": spec["status"],
                "ownerName": spec["ownerName"],
                "ownerRole": spec["ownerRole"],
                "dueAt": director_card["recommendedAt"],
                "whyHighPriority": spec["triggerReason"],
                "todayInSchoolActions": ["补齐当日关键观察记录。", "同步班级老师执行结果。"],
                "tonightAtHomeActions": ["今晚反馈孩子情绪与进食变化。", "如有异常波动，明早继续回传。"],
                "followUp48h": ["48 小时内复查执行结果，并决定是否继续升级。"],
                "syncTargets": ["教师端结果卡", "家长端今晚任务", *([] if not spec["shouldEscalate"] else ["园长端决策卡"])],
                "shouldEscalateToAdmin": spec["shouldEscalate"],
                "explainabilitySummary": {
                    "agentParticipants": ["健康观察", "饮食行为", "家园协同", "协调器"],
                    "keyFindings": [spec["triggerReason"], "需要把园内动作和家庭反馈接成一条线。"],
                    "coordinationConclusion": spec["summary"],
                    "evidenceHighlights": [f"child: {child['name']}", f"class: {child['className']}"],
                },
                "providerTraceSummary": {
                    "traceId": f"demo-trace-{spec['childId']}",
                    "status": "fallback",
                    "provider": "mock-brain",
                    "source": "mock",
                    "model": "mock-high-risk-v1",
                    "transport": "fastapi-brain",
                    "transportSource": "fastapi-brain",
                    "consultationSource": "demo-fallback",
                    "fallbackReason": "demo-snapshot",
                    "brainProvider": "mock",
                    "realProvider": False,
                    "fallback": True,
                },
                "memoryMetaSummary": {
                    "backend": "demo_snapshot",
                    "degraded": False,
                    "usedSources": ["demo_snapshot"],
                    "errors": [],
                    "matchedSnapshotIds": [],
                    "matchedTraceIds": [],
                },
            }
        )
    return items
