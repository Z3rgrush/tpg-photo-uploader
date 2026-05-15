import os
import requests as http

from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.adimage import AdImage
from facebook_business.adobjects.advideo import AdVideo

VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.wmv', '.m4v', '.webm'}


def _is_video(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in VIDEO_EXTENSIONS


class UploaderAPI:
    def __init__(self, access_token, ad_account_id, app_id=None, app_secret=None):
        FacebookAdsApi.init(app_id or '', app_secret or '', access_token)
        self._token = access_token
        acc = str(ad_account_id).lstrip('act_')
        self.account_id = f'act_{acc}'
        self.account = AdAccount(self.account_id)

    def upload(self, file_path: str, title: str) -> dict:
        if _is_video(file_path):
            return self._upload_video(file_path, title)
        return self._upload_image(file_path, title)

    # ------------------------------------------------------------------
    # Image
    # ------------------------------------------------------------------

    def _upload_image(self, file_path: str, title: str) -> dict:
        img = AdImage(parent_id=self.account_id)
        img[AdImage.Field.filename] = file_path
        img.remote_create()

        image_hash = img.get(AdImage.Field.hash) or img.get('hash', '')
        image_id   = img.get('id', '')
        meta_name  = self._get_image_name(image_hash) if image_hash else ''

        return {
            'type':      'image',
            'title':     title,
            'meta_name': meta_name,
            'id':        image_id,
            'hash':      image_hash,
        }

    def _get_image_name(self, image_hash: str) -> str:
        try:
            resp = http.get(
                f'https://graph.facebook.com/v19.0/{self.account_id}/adimages',
                params={
                    'hashes': f'["{image_hash}"]',
                    'fields': 'name,hash',
                    'access_token': self._token,
                },
            ).json()
            data = resp.get('data', [])
            return data[0].get('name', '') if data else ''
        except Exception:
            return ''

    # ------------------------------------------------------------------
    # Video
    # ------------------------------------------------------------------

    def _upload_video(self, file_path: str, title: str) -> dict:
        video = AdVideo(parent_id=self.account_id)
        video[AdVideo.Field.filepath] = file_path
        video[AdVideo.Field.name]     = title
        video.remote_create()

        video_id  = video.get('id', '')
        meta_name = self._get_video_name(video_id) if video_id else ''

        return {
            'type':      'video',
            'title':     title,
            'meta_name': meta_name,
            'id':        video_id,
            'hash':      '',
        }

    def _get_video_name(self, video_id: str) -> str:
        try:
            resp = http.get(
                f'https://graph.facebook.com/v19.0/{video_id}',
                params={'fields': 'title', 'access_token': self._token},
            ).json()
            return resp.get('title', '')
        except Exception:
            return ''
