"""Scheduled Brick Rush posting: date -> day, kill switch, approval and already-posted guards. No network.
Run: cd social-automation && python -m unittest test_brick_rush_auto -v"""
import sys, types, unittest
from datetime import date, datetime, timezone

sys.modules.setdefault('publisher', types.SimpleNamespace(post_instagram_carousel=None, post_instagram_reels=None, _load_youtube_credentials=None))
import brick_rush_auto as ba  # noqa: E402

M = {'id': 'brick-rush-2026', 'days': {f'day{n}': {'carousel': {'approved': True}, 'short': {'approved': True}} for n in range(1, 11)}}


def posted_set(*keys):
    done = set(keys)
    return lambda cid, platform: f'{cid}:{platform}' in done


class DateToDay(unittest.TestCase):
    def test_campaign_days(self):
        self.assertEqual(ba.campaign_day(date(2026, 10, 5)), 'day4')
        self.assertEqual(ba.campaign_day(date(2026, 10, 8)), 'day7')
        self.assertEqual(ba.campaign_day(date(2026, 10, 11)), 'day10')

    def test_outside_the_window_does_nothing(self):
        for d in (date(2026, 10, 4), date(2026, 10, 12), date(2026, 11, 5), date(2027, 10, 5)):
            self.assertIsNone(ba.campaign_day(d))
            self.assertEqual(ba.plan(d, M, None, posted_set())[1], [])


class Guards(unittest.TestCase):
    def test_kill_switch(self):
        for v in ('off', 'OFF', ' off '):
            day, todo, reason = ba.plan(date(2026, 10, 5), M, v, posted_set())
            self.assertEqual((todo, reason), ([], 'kill switch is off'))
        self.assertEqual(ba.plan(date(2026, 10, 5), M, 'on', posted_set())[1], ['carousel', 'short'])
        self.assertEqual(ba.plan(date(2026, 10, 5), M, None, posted_set())[1], ['carousel', 'short'])

    def test_not_approved(self):
        m = {'id': 'brick-rush-2026', 'days': {'day4': {'carousel': {'approved': False}, 'short': {'approved': True}}}}
        self.assertEqual(ba.plan(date(2026, 10, 5), m, None, posted_set())[1], [])
        m = {'id': 'brick-rush-2026', 'days': {'day4': {'carousel': {'approved': True}, 'short': {'approved': False}}}}
        self.assertEqual(ba.plan(date(2026, 10, 5), m, None, posted_set())[1], ['carousel'])

    def test_day_missing_from_manifest(self):
        m = {'id': 'brick-rush-2026', 'days': {}}
        self.assertEqual(ba.plan(date(2026, 10, 5), m, None, posted_set())[1], [])

    def test_already_posted(self):
        c = 'brick-rush-2026:day4:carousel:ig_feed'
        s = ['brick-rush-2026:day4:short:ig_reels', 'brick-rush-2026:day4:short:yt_shorts']
        self.assertEqual(ba.plan(date(2026, 10, 5), M, None, posted_set(c))[1], ['short'])
        self.assertEqual(ba.plan(date(2026, 10, 5), M, None, posted_set(c, *s))[1], [])
        # a Short posted on one platform only is still to do (post_prepared skips the done platform)
        self.assertEqual(ba.plan(date(2026, 10, 5), M, None, posted_set(c, s[0]))[1], ['short'])


class Wait(unittest.TestCase):
    def test_waits_until_1930_ist(self):
        self.assertEqual(ba.seconds_until_post(datetime(2026, 10, 5, 13, 40, tzinfo=timezone.utc)), 20 * 60)
        self.assertEqual(ba.seconds_until_post(datetime(2026, 10, 5, 14, 5, tzinfo=timezone.utc)), 0)


if __name__ == '__main__':
    unittest.main()
