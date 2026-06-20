"""evals/tests/test_replay.py — offline replay reproduces live scores from recorded traces."""
from __future__ import annotations

import pytest

from evals.packs import VERTICAL_PACK_IDS, get_pack
from evals.replay import ReplayRecorder, load_records, replay_scores
from evals.runner import EvalHarnessRunner


def _live_and_replayed(pack_id: str, tmp_path):
    recorder = ReplayRecorder(tmp_path / f"{pack_id}.json")
    runner = EvalHarnessRunner(recorder=recorder)
    live = runner.run(pack_id)
    recorder.flush()
    records = load_records(recorder.path)
    replayed = replay_scores(records, cases=get_pack(pack_id).cases)
    return live, replayed


@pytest.mark.parametrize("pack_id", VERTICAL_PACK_IDS)
def test_replay_reproduces_live_scores(pack_id, tmp_path):
    live, replayed = _live_and_replayed(pack_id, tmp_path)
    assert len(replayed) == len(live)
    by_live = {r.case_id: r for r in live}
    by_replay = {r.case_id: r for r in replayed}
    assert by_live.keys() == by_replay.keys()
    for case_id, live_result in by_live.items():
        rep = by_replay[case_id]
        assert rep.passed == live_result.passed
        assert rep.scores == live_result.scores


def test_records_are_persisted_without_re_running_pipeline(tmp_path):
    # Replay must NOT need the pipeline: scoring comes purely from the recorded views.
    recorder = ReplayRecorder(tmp_path / "finance.json")
    EvalHarnessRunner(recorder=recorder).run("finance_hero_v1")
    recorder.flush()
    records = load_records(recorder.path)
    # Drive replay with only the recorded views + the case definitions; no harness involved.
    replayed = replay_scores(records, cases=get_pack("finance_hero_v1").cases)
    assert all(r.passed for r in replayed)
    assert len(replayed) == 5


def test_replay_record_roundtrips(tmp_path):
    recorder = ReplayRecorder(tmp_path / "rt.json")
    EvalHarnessRunner(recorder=recorder).run("legal_thin_v1")
    recorder.flush()
    loaded = load_records(recorder.path)
    assert [r.model_dump() for r in loaded] == [r.model_dump() for r in recorder.records]
