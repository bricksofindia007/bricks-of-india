"""
Unit tests for coherence_judge.py (#365). No network: `post` is faked.

Run: cd scripts/video && python -m unittest test_coherence_judge -v
"""

from __future__ import annotations

import unittest

import coherence_judge as cj


class _Resp:
    def __init__(self, status=200, content='COHERENT', body=None):
        self.status, self.content, self.body = status, content, body

    def raise_for_status(self):
        if self.status >= 400:
            raise RuntimeError(f'{self.status} error')

    def json(self):
        if self.body is not None:
            return self.body
        return {'choices': [{'message': {'content': self.content}}]}


def _post_returning(resp, seen=None):
    def post(url, headers=None, json=None, timeout=None):
        if seen is not None:
            seen.append(json)
        return resp
    return post


def _post_raising(exc):
    def post(*a, **k):
        raise exc
    return post


class JudgeTests(unittest.TestCase):
    def test_live_model_not_the_shut_down_qwen(self):
        seen = []
        cj.judge_coherence('A script.', post=_post_returning(_Resp(), seen), api_key='k')
        self.assertEqual(seen[0]['model'], 'openai/gpt-oss-120b')
        self.assertNotIn('qwen', seen[0]['model'])

    def test_coherent_passes(self):
        r = cj.judge_coherence('x', post=_post_returning(_Resp(content='COHERENT')), api_key='k')
        self.assertEqual(r['pass'], True)
        self.assertNotIn('held', r)

    def test_incoherent_fails_not_held(self):
        r = cj.judge_coherence('x', post=_post_returning(_Resp(content='INCOHERENT: dangling ending')), api_key='k')
        self.assertEqual(r['pass'], False)
        self.assertNotIn('held', r)

    def test_dead_model_404_is_held_not_passed(self):
        r = cj.judge_coherence('x', post=_post_returning(_Resp(status=404)), api_key='k')
        self.assertEqual((r['pass'], r['held']), (False, True))

    def test_quota_timeout_and_network_errors_are_held(self):
        for exc in (TimeoutError('timed out'), ConnectionError('reset')):
            r = cj.judge_coherence('x', post=_post_raising(exc), api_key='k')
            self.assertEqual((r['pass'], r['held']), (False, True))
        r = cj.judge_coherence('x', post=_post_returning(_Resp(status=429)), api_key='k')
        self.assertEqual((r['pass'], r['held']), (False, True))

    def test_missing_key_is_held(self):
        r = cj.judge_coherence('x', post=_post_returning(_Resp()), api_key='')
        self.assertEqual((r['pass'], r['held']), (False, True))

    def test_malformed_or_empty_reply_is_held(self):
        for resp in (_Resp(body={'choices': []}), _Resp(content=''), _Resp(content='Looks fine to me')):
            r = cj.judge_coherence('x', post=_post_returning(resp), api_key='k')
            self.assertEqual((r['pass'], r['held']), (False, True))

    def test_only_held_failures(self):
        held = cj._held('x')
        ok = {'pass': True, 'detail': ''}
        bad = {'pass': False, 'detail': 'real failure'}
        self.assertTrue(cj.only_held_failures({'a': ok, 'coherence': held}))
        self.assertFalse(cj.only_held_failures({'a': bad, 'coherence': held}))
        self.assertFalse(cj.only_held_failures({'a': ok, 'coherence': ok}))
        self.assertTrue(cj.only_held_failures({'_meta': {'pass': None}, 'coherence': held}))


if __name__ == '__main__':
    unittest.main()
