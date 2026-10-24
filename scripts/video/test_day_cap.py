"""The judge refuses at or past the daily rupee stop and makes no model call. Below the stop it continues."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import coherence_judge as cj  # noqa: E402


def _no_call(*a, **k):
    raise AssertionError('the model must not be called when the cap refuses')


def test_refuses_at_stop(monkeypatch):
    monkeypatch.setenv('BOI_AI_DAY_RUPEES', str(cj._stop_inr()))
    monkeypatch.setenv('GROQ_API_KEY', 'x')
    r = cj.judge_coherence('script text', post=_no_call)
    assert r['pass'] is False and r.get('held') is True


def test_refuses_over_stop(monkeypatch):
    monkeypatch.setenv('BOI_AI_DAY_RUPEES', str(cj._stop_inr() + 5))
    monkeypatch.setenv('GROQ_API_KEY', 'x')
    assert cj.judge_coherence('script text', post=_no_call).get('held') is True


def test_below_stop_is_not_refused(monkeypatch):
    monkeypatch.setenv('BOI_AI_DAY_RUPEES', '1.0')
    assert cj._day_cap_refusal() is None


def test_missing_value_is_not_refused_here(monkeypatch):
    monkeypatch.delenv('BOI_AI_DAY_RUPEES', raising=False)
    assert cj._day_cap_refusal() is None


def test_not_a_number_fails_closed(monkeypatch):
    monkeypatch.setenv('BOI_AI_DAY_RUPEES', 'abc')
    assert cj._day_cap_refusal()['held'] is True
