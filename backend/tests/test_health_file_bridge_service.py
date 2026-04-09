from __future__ import annotations

import asyncio

from app.services.health_file_bridge_service import run_health_file_bridge


def test_health_file_bridge_service_returns_complete_skeleton_for_metadata_only_input():
    result = asyncio.run(
        run_health_file_bridge(
            {
                "childId": "child-1",
                "sourceRole": "teacher",
                "files": [
                    {
                        "fileId": "file-1",
                        "name": "outside-note.pdf",
                        "mimeType": "application/pdf",
                        "sizeBytes": 1024,
                    }
                ],
                "requestSource": "pytest-service",
            }
        )
    )

    assert result["source"] == "backend-rule"
    assert result["fallback"] is False
    assert result["mock"] is True
    assert result["liveReadyButNotVerified"] is True
    assert "T7 skeleton" in result["disclaimer"]
    assert result["extractedFacts"]
    assert result["riskItems"][0]["title"] == "Need manual interpretation by teacher"
    assert result["schoolTodayActions"]
    assert result["familyTonightActions"]
    assert result["followUpPlan"]
    assert result["writebackSuggestion"]["status"] == "placeholder"


def test_health_file_bridge_service_bridges_fever_and_medication_signals_without_claiming_live_ocr():
    result = asyncio.run(
        run_health_file_bridge(
            {
                "childId": "child-2",
                "sourceRole": "parent",
                "fileKind": "prescription",
                "files": [
                    {
                        "fileId": "file-2",
                        "name": "recheck-slip.png",
                        "mimeType": "image/png",
                        "previewText": "发热 38.1，明早复查，继续雾化",
                    }
                ],
                "requestSource": "pytest-service",
                "optionalNotes": "家长补充：有过敏史，今天仍在用药。",
            }
        )
    )

    fact_labels = [item["label"] for item in result["extractedFacts"]]
    risk_titles = [item["title"] for item in result["riskItems"]]

    assert "Temperature signal" in fact_labels
    assert "Allergy or medication signal" in fact_labels
    assert "Need same-day health recheck in daycare" in risk_titles
    assert "Need teacher review before routine care" in risk_titles
    assert result["escalationSuggestion"]["level"] == "school-health-review"
    assert result["escalationSuggestion"]["shouldEscalate"] is True
    assert "verified OCR" in result["disclaimer"]
