"""Idempotency of post_prepared (round 10c): a re-run after a partial failure never double-posts.
No network: db and publisher are faked.  Run: cd social-automation && python -m unittest test_post_prepared -v"""
import json, sys, tempfile, types, unittest
from pathlib import Path
from unittest import mock

sys.modules.setdefault('publisher', types.SimpleNamespace(post_instagram_carousel=None, post_instagram_reels=None, _load_youtube_credentials=None))
import post_prepared as pp  # noqa: E402


class _Q:
    def __init__(self, store, name): self.store, self.name, self.f = store, name, {}
    def select(self, *_a): return self
    def eq(self, k, v): self.f[k] = v; return self
    def limit(self, _n): return self
    def insert(self, row): self.store.append(row); return self
    def execute(self): return mock.Mock(data=[r for r in self.store if all(r.get(k) == v for k, v in self.f.items())])


class _DB:
    def __init__(self): self.rows = []
    def _client(self): return types.SimpleNamespace(table=lambda n: _Q(self.rows, n))


def manifest(tmp):
    m = {'id': 'brick-rush-2026', 'days': {'day1': {'short': {'approved': True, 'label': 'S', 'video': 'v', 'ig_caption': 'c', 'yt_title': 't', 'yt_description': 'd'},
                                                     'carousel': {'approved': False, 'images': ['a', 'b'], 'caption': 'c'}}}}
    p = Path(tmp) / 'm.json'; p.write_text(json.dumps(m)); return str(p)


class Idempotent(unittest.TestCase):
    def run_main(self, db, mf, piece, reels, yt):
        argv = ['x', '--manifest', mf, '--day', 'day1', '--piece', piece]
        with mock.patch.dict(sys.modules, {'db': db}), mock.patch.object(sys, 'argv', argv), \
             mock.patch.object(pp.publisher, 'post_instagram_reels', reels), mock.patch.object(pp, 'youtube_upload', yt), \
             mock.patch.object(pp, 'Path', lambda *_: Path('/')):
            pp.main()

    def test_partial_failure_then_rerun_posts_each_platform_once(self):
        db = _DB()
        with tempfile.TemporaryDirectory() as tmp:
            mf = manifest(tmp)
            reels = mock.Mock(return_value='ig1'); yt_fail = mock.Mock(side_effect=RuntimeError('youtube down'))
            with self.assertRaises(RuntimeError):
                self.run_main(db, mf, 'short', reels, yt_fail)
            self.assertEqual(reels.call_count, 1)
            self.assertEqual([r['set_num'] for r in db.rows], ['campaign:brick-rush-2026:day1:short:ig_reels'])
            reels2 = mock.Mock(return_value='ig2'); yt_ok = mock.Mock(return_value='yt1')
            self.run_main(db, mf, 'short', reels2, yt_ok)
            reels2.assert_not_called()          # Instagram already done: skipped
            yt_ok.assert_called_once()          # YouTube retried
            self.assertEqual(len(db.rows), 2)
            self.run_main(db, mf, 'short', reels2, yt_ok)   # a third run posts nothing
            reels2.assert_not_called(); self.assertEqual(yt_ok.call_count, 1)

    def test_unapproved_piece_refuses(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SystemExit):
                self.run_main(_DB(), manifest(tmp), 'carousel', mock.Mock(), mock.Mock())


if __name__ == '__main__':
    unittest.main()
