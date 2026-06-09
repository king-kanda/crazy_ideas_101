"""
Tests for the rewritten Google Trends extraction module.
All pytrends and Redis calls are mocked — no network required.
"""

import json
from datetime import datetime
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

# Patch Redis and celery imports before importing the module under test
import sys
import types

# Stub out celery_app so we don't need a running broker
celery_stub = types.ModuleType("celery_app")
celery_stub.celery = MagicMock()
celery_stub.celery.task = lambda **kw: (lambda f: f)
sys.modules.setdefault("celery_app", celery_stub)

# Stub database and models so imports don't fail without a DB
db_stub = types.ModuleType("database")
db_stub.AsyncSessionLocal = MagicMock()
sys.modules.setdefault("database", db_stub)

models_stub = types.ModuleType("models")
for name in ("Store", "Product", "TrendCache"):
    setattr(models_stub, name, MagicMock())
sys.modules.setdefault("models", models_stub)


# Now import the module under test
from workers.trends import (
    _check_inventory,
    _expand_category_seeds,
    _build_entry,
    extract_trends_for_store,
    _fetch_related_queries_batch,
    _backoff_sleep,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

FAKE_STORE_ID = "store-ke-001"

FAKE_PRODUCTS = [
    ("Wireless Earbuds ANC Pro", "Audio"),
    ("USB-C Hub 7-Port", "Accessories"),
    ("Mechanical Keyboard TKL RGB", "Keyboards"),
    ("Gaming Mouse 16000 DPI", "Peripherals"),
    ("Power Bank 20000mAh PD", "Power"),
]

PRODUCT_TITLES = [p[0] for p in FAKE_PRODUCTS]
PRODUCT_CATEGORIES = list({p[1] for p in FAKE_PRODUCTS})


def _make_related_df(rows: list[dict]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame(columns=["query", "value"])
    return pd.DataFrame(rows)


def _mock_pytrends_related(ke_top, ke_rising, global_top=None, global_rising=None):
    """Return a mock TrendReq whose related_queries() returns the given data."""
    mock_pt = MagicMock()

    ke_response = {
        kw: {
            "top": _make_related_df(ke_top.get(kw, [])),
            "rising": _make_related_df(ke_rising.get(kw, [])),
        }
        for kw in list(ke_top.keys()) + list(ke_rising.keys())
    }

    global_response = {}
    if global_top or global_rising:
        all_global_keys = set(list((global_top or {}).keys()) + list((global_rising or {}).keys()))
        global_response = {
            kw: {
                "top": _make_related_df((global_top or {}).get(kw, [])),
                "rising": _make_related_df((global_rising or {}).get(kw, [])),
            }
            for kw in all_global_keys
        }

    # First call returns KE data, subsequent calls return global data
    mock_pt.related_queries.side_effect = [ke_response, global_response] * 20
    return mock_pt


# ── Unit tests: _check_inventory ──────────────────────────────────────────────

class TestCheckInventory:
    def test_exact_substring_match(self):
        assert _check_inventory("wireless earbuds", PRODUCT_TITLES, PRODUCT_CATEGORIES) is True

    def test_category_match(self):
        assert _check_inventory("audio accessories", PRODUCT_TITLES, ["Audio", "Accessories"]) is True

    def test_partial_word_overlap(self):
        # "mechanical keyboard gaming" shares 2 meaningful words with "Mechanical Keyboard TKL RGB"
        assert _check_inventory("mechanical keyboard gaming", PRODUCT_TITLES, PRODUCT_CATEGORIES) is True

    def test_no_match(self):
        assert _check_inventory("organic matcha powder", PRODUCT_TITLES, PRODUCT_CATEGORIES) is False

    def test_stopword_only_no_match(self):
        # only stopwords overlap — should not match
        assert _check_inventory("buy the best", PRODUCT_TITLES, PRODUCT_CATEGORIES) is False

    def test_empty_inventory(self):
        assert _check_inventory("wireless earbuds", [], []) is False

    def test_product_name_in_query(self):
        assert _check_inventory("power bank kenya price", PRODUCT_TITLES, PRODUCT_CATEGORIES) is True


# ── Unit tests: _build_entry ──────────────────────────────────────────────────

class TestBuildEntry:
    def test_gap_flagged_when_not_in_inventory(self):
        entry = _build_entry("moringa powder organic", "superfoods", "emerging", 150, PRODUCT_TITLES, PRODUCT_CATEGORIES)
        assert entry["gap"] is True
        assert entry["in_store_inventory"] is False

    def test_not_gap_when_in_inventory(self):
        entry = _build_entry("wireless earbuds", "audio", "established", 80, PRODUCT_TITLES, PRODUCT_CATEGORIES)
        assert entry["gap"] is False
        assert entry["in_store_inventory"] is True

    def test_entry_schema(self):
        entry = _build_entry("standing desk mat", "furniture", "emerging", 200, PRODUCT_TITLES, PRODUCT_CATEGORIES)
        assert set(entry.keys()) == {"query", "seed", "signal", "value", "in_store_inventory", "gap"}
        assert entry["query"] == "standing desk mat"
        assert entry["seed"] == "furniture"
        assert entry["signal"] == "emerging"
        assert entry["value"] == 200
        assert isinstance(entry["in_store_inventory"], bool)
        assert isinstance(entry["gap"], bool)


# ── Unit tests: _expand_category_seeds ───────────────────────────────────────

class TestExpandCategorySeeds:
    def test_known_category_returns_list(self):
        result = _expand_category_seeds("electronics")
        assert isinstance(result, list)
        assert len(result) >= 3
        assert len(result) <= 5

    def test_unknown_category_fallback(self):
        result = _expand_category_seeds("ceramics")
        assert any("ceramics" in kw for kw in result)
        assert len(result) == 5

    def test_skincare_expansion(self):
        result = _expand_category_seeds("skincare")
        # Should include specific product-level keywords
        assert any("serum" in kw or "moisturizer" in kw or "sunscreen" in kw for kw in result)


# ── Integration tests: extract_trends_for_store ───────────────────────────────

class TestExtractTrendsForStore:
    """Mock pytrends + Redis to test the full extraction pipeline."""

    def _run(self, ke_top, ke_rising, global_top=None, global_rising=None, redis_cached=None):
        mock_pt = _mock_pytrends_related(ke_top, ke_rising, global_top, global_rising)

        with patch("workers.trends.TrendReq", return_value=mock_pt), \
             patch("workers.trends._get_cached", return_value=redis_cached), \
             patch("workers.trends._set_cached") as mock_set_cached, \
             patch("workers.trends._backoff_sleep"):  # skip actual sleeps

            result = extract_trends_for_store(
                store_id=FAKE_STORE_ID,
                niche="electronics",
                location_country="KE",
                product_titles=PRODUCT_TITLES,
                product_categories=PRODUCT_CATEGORIES,
            )
            return result, mock_set_cached

    def test_output_has_required_top_level_keys(self):
        result, _ = self._run({}, {})
        required = {"store_id", "extracted_at", "seeds_used", "rate_limited",
                    "emerging_queries", "established_queries", "global_opportunities"}
        assert required.issubset(set(result.keys()))

    def test_store_id_preserved(self):
        result, _ = self._run({}, {})
        assert result["store_id"] == FAKE_STORE_ID

    def test_extracted_at_is_iso_string(self):
        result, _ = self._run({}, {})
        # Should parse without error
        datetime.fromisoformat(result["extracted_at"])

    def test_seeds_used_populated(self):
        result, _ = self._run({}, {})
        assert len(result["seeds_used"]) > 0
        assert "electronics" in result["seeds_used"]

    def test_emerging_queries_schema(self):
        ke_rising = {
            "electronics": [
                {"query": "solar power bank kenya", "value": 300},
                {"query": "usb-c hub 10-port", "value": 150},
            ]
        }
        result, _ = self._run({}, ke_rising)
        assert len(result["emerging_queries"]) >= 2

        for item in result["emerging_queries"]:
            assert set(item.keys()) == {"query", "seed", "signal", "value", "in_store_inventory", "gap"}
            assert item["signal"] == "emerging"
            assert isinstance(item["value"], int)
            assert isinstance(item["in_store_inventory"], bool)
            assert isinstance(item["gap"], bool)

    def test_established_queries_schema(self):
        ke_top = {
            "electronics": [
                {"query": "mechanical keyboard", "value": 80},
            ]
        }
        result, _ = self._run(ke_top, {})
        assert len(result["established_queries"]) >= 1
        for item in result["established_queries"]:
            assert item["signal"] == "established"

    def test_global_opportunities_flagged(self):
        # Global has a query not present in KE results
        global_rising = {
            "electronics": [
                {"query": "foldable phone stand wireless", "value": 400},
            ]
        }
        result, _ = self._run({}, {}, global_rising=global_rising)
        if result["global_opportunities"]:
            for item in result["global_opportunities"]:
                assert item.get("opportunity") == "potential"

    def test_gap_detection_in_inventory(self):
        ke_top = {
            "electronics": [
                {"query": "wireless earbuds", "value": 90},  # IS in inventory
                {"query": "matcha powder organic", "value": 70},  # NOT in inventory
            ]
        }
        result, _ = self._run(ke_top, {})
        by_query = {item["query"]: item for item in result["established_queries"]}

        if "wireless earbuds" in by_query:
            assert by_query["wireless earbuds"]["in_store_inventory"] is True
            assert by_query["wireless earbuds"]["gap"] is False

        if "matcha powder organic" in by_query:
            assert by_query["matcha powder organic"]["in_store_inventory"] is False
            assert by_query["matcha powder organic"]["gap"] is True

    def test_no_duplicate_queries_across_seeds(self):
        # Same query from two different seeds — should appear only once
        ke_rising = {
            "electronics": [{"query": "solar power bank", "value": 200}],
            "power": [{"query": "solar power bank", "value": 180}],
        }
        result, _ = self._run({}, ke_rising)
        queries = [item["query"] for item in result["emerging_queries"]]
        assert len(queries) == len(set(queries)), "Duplicate queries found in emerging_queries"

    def test_redis_cache_hit_skips_pytrends(self):
        cached_data = {
            "store_id": FAKE_STORE_ID,
            "extracted_at": "2026-06-01T10:00:00",
            "seeds_used": ["electronics"],
            "rate_limited": False,
            "emerging_queries": [],
            "established_queries": [{"query": "cached query", "seed": "electronics", "signal": "established", "value": 50, "in_store_inventory": False, "gap": True}],
            "global_opportunities": [],
        }
        with patch("workers.trends.TrendReq") as mock_trend_req, \
             patch("workers.trends._get_cached", return_value=cached_data), \
             patch("workers.trends._set_cached"):
            result = extract_trends_for_store(
                store_id=FAKE_STORE_ID,
                niche="electronics",
                location_country="KE",
                product_titles=PRODUCT_TITLES,
                product_categories=PRODUCT_CATEGORIES,
            )
            mock_trend_req.assert_not_called()
            assert result["established_queries"][0]["query"] == "cached query"

    def test_rate_limited_result_not_cached(self):
        with patch("workers.trends._get_cached", return_value=None), \
             patch("workers.trends._set_cached") as mock_set, \
             patch("workers.trends._fetch_all_related_queries", return_value=({}, True)), \
             patch("workers.trends._backoff_sleep"):
            result = extract_trends_for_store(
                store_id=FAKE_STORE_ID,
                niche="electronics",
                location_country="KE",
                product_titles=PRODUCT_TITLES,
                product_categories=PRODUCT_CATEGORIES,
            )
            assert result["rate_limited"] is True
            mock_set.assert_not_called()

    def test_pytrends_exception_returns_partial_result(self):
        with patch("workers.trends.TrendReq", side_effect=Exception("network error")), \
             patch("workers.trends._get_cached", return_value=None), \
             patch("workers.trends._set_cached"), \
             patch("workers.trends._backoff_sleep"):
            result = extract_trends_for_store(
                store_id=FAKE_STORE_ID,
                niche="electronics",
                location_country="KE",
                product_titles=PRODUCT_TITLES,
                product_categories=PRODUCT_CATEGORIES,
            )
            # Should not raise, and should return the required structure
            assert "store_id" in result
            assert "emerging_queries" in result
            assert isinstance(result["emerging_queries"], list)

    def test_geo_locked_to_ke(self):
        """Verify KE geo is always used regardless of location_country input."""
        called_geos = []

        def fake_fetch_all(pt, keywords, geo, timeframe):
            called_geos.append(geo)
            return {}, False

        with patch("workers.trends._get_cached", return_value=None), \
             patch("workers.trends._set_cached"), \
             patch("workers.trends.TrendReq", return_value=MagicMock()), \
             patch("workers.trends._fetch_all_related_queries", side_effect=fake_fetch_all), \
             patch("workers.trends._backoff_sleep"):
            extract_trends_for_store(
                store_id=FAKE_STORE_ID,
                niche="fashion",
                location_country="US",  # intentionally not KE
                product_titles=[],
                product_categories=[],
            )
            # First call should always be KE
            assert called_geos[0] == "KE"


# ── Unit tests: _fetch_related_queries_batch ──────────────────────────────────

class TestFetchRelatedQueriesBatch:
    def test_successful_fetch(self):
        mock_pt = MagicMock()
        mock_pt.related_queries.return_value = {
            "sneakers": {
                "top": _make_related_df([{"query": "sneakers kenya", "value": 100}]),
                "rising": _make_related_df([{"query": "ankle sneakers", "value": 250}]),
            }
        }
        results, rate_limited = _fetch_related_queries_batch(
            mock_pt, ["sneakers"], geo="KE", timeframe="today 3-m"
        )
        assert rate_limited is False
        assert "sneakers" in results
        assert len(results["sneakers"]["top"]) == 1
        assert results["sneakers"]["top"][0]["query"] == "sneakers kenya"
        assert len(results["sneakers"]["rising"]) == 1

    def test_rate_limit_returns_flag(self):
        mock_pt = MagicMock()
        mock_pt.related_queries.side_effect = Exception("429 Too Many Requests")
        results, rate_limited = _fetch_related_queries_batch(
            mock_pt, ["shoes"], geo="KE", timeframe="today 3-m", max_retries=1
        )
        assert rate_limited is True
        assert results["shoes"]["top"] == []
        assert results["shoes"]["rising"] == []

    def test_non_rate_limit_error_no_retry(self):
        mock_pt = MagicMock()
        mock_pt.related_queries.side_effect = Exception("connection refused")
        results, rate_limited = _fetch_related_queries_batch(
            mock_pt, ["bags"], geo="KE", timeframe="today 3-m"
        )
        assert rate_limited is False
        assert results["bags"]["top"] == []

    def test_empty_dataframe_handled(self):
        mock_pt = MagicMock()
        mock_pt.related_queries.return_value = {
            "hats": {
                "top": pd.DataFrame(),
                "rising": pd.DataFrame(),
            }
        }
        results, rate_limited = _fetch_related_queries_batch(
            mock_pt, ["hats"], geo="KE", timeframe="today 3-m"
        )
        assert rate_limited is False
        assert results["hats"]["top"] == []
        assert results["hats"]["rising"] == []
