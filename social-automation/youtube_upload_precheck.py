"""Read-only pre-check before the Brick Rush long-form upload (round 4, item 1g). Posts nothing, changes nothing.
Prints: channel status (custom-thumbnail eligibility signals), the status of the latest uploads (did API uploads go
out Public, or were they locked private?), and the scopes the fresh access token holds. Never prints a token."""
import requests

import publisher


def main():
    creds = publisher._load_youtube_credentials()
    if creds is None:
        raise SystemExit('FAIL: no usable YouTube login')
    from google.auth.transport.requests import Request
    creds.refresh(Request())
    info = requests.get('https://oauth2.googleapis.com/tokeninfo', params={'access_token': creds.token}, timeout=30).json()
    print('scopes:', ', '.join(sorted(s.replace('https://www.googleapis.com/auth/', '') for s in (info.get('scope') or '').split())))
    from googleapiclient.discovery import build
    yt = build('youtube', 'v3', credentials=creds)
    ch = yt.channels().list(part='snippet,status,contentDetails', mine=True).execute()['items'][0]
    st = ch.get('status', {})
    print('channel:', ch['snippet']['title'])
    print('status.longUploadsStatus:', st.get('longUploadsStatus'), '(allowed = phone-verified; custom thumbnails need a verified channel)')
    print('status.privacyStatus:', st.get('privacyStatus'), '| isLinked:', st.get('isLinked'), '| madeForKids:', st.get('madeForKids'))
    uploads = ch['contentDetails']['relatedPlaylists']['uploads']
    items = yt.playlistItems().list(part='contentDetails', playlistId=uploads, maxResults=12).execute().get('items', [])
    ids = [i['contentDetails']['videoId'] for i in items]
    if ids:
        vids = yt.videos().list(part='snippet,status', id=','.join(ids)).execute().get('items', [])
        print(f'latest {len(vids)} uploads (newest first):')
        for v in vids:
            s = v['status']
            print(f"  {v['snippet']['publishedAt']} | {v['id']} | privacy={s.get('privacyStatus')} upload={s.get('uploadStatus')}"
                  f"{' rejection=' + s['rejectionReason'] if s.get('rejectionReason') else ''}"
                  f"{' failure=' + s['failureReason'] if s.get('failureReason') else ''} | {v['snippet']['title'][:60]}")


if __name__ == '__main__':
    main()
