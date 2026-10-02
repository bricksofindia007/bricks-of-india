"""The posting login refreshes with the scopes saved in the token, so a re-consent that adds the
comment scope (force-ssl) takes effect without a code change.  No network.
Run: cd social-automation && python -m unittest test_youtube_scopes -v"""
import json, unittest
from unittest import mock

import publisher


class ScopesFromToken(unittest.TestCase):
    def load(self, token):
        with mock.patch.object(publisher, 'YOUTUBE_CLIENT_SECRETS', json.dumps(token)), \
             mock.patch('google.oauth2.credentials.Credentials.from_authorized_user_info') as f:
            f.return_value = mock.Mock(expired=False)
            publisher._load_youtube_credentials()
            return f.call_args[0][1]

    def base(self, **kw):
        return {'token': 't', 'refresh_token': 'r', 'token_uri': 'u', 'client_id': 'c', 'client_secret': 's', **kw}

    def test_uses_scopes_saved_in_token(self):
        scopes = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl']
        self.assertEqual(self.load(self.base(scopes=scopes)), scopes)

    def test_older_token_without_scopes_falls_back(self):
        self.assertEqual(self.load(self.base()), publisher.YT_SCOPES)


if __name__ == '__main__':
    unittest.main()
