import os

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
        acc = str(ad_account_id).lstrip('act_')
        self.account_id = f'act_{acc}'
        self.account = AdAccount(self.account_id)

    def upload(self, file_path: str, name: str) -> dict:
        """
        Upload an image or video to the Meta ad account.
        Returns a dict with: type, name, id (and hash for images).
        """
        if _is_video(file_path):
            return self._upload_video(file_path, name)
        return self._upload_image(file_path, name)

    def _upload_image(self, file_path: str, name: str) -> dict:
        img = AdImage(parent_id=self.account_id)
        img[AdImage.Field.filename] = file_path
        img.remote_create()
        image_hash = img.get(AdImage.Field.hash) or img.get('hash', '')
        image_id   = img.get('id', '')
        return {
            'type':   'image',
            'name':   name,
            'id':     image_id,
            'hash':   image_hash,
        }

    def _upload_video(self, file_path: str, name: str) -> dict:
        video = AdVideo(parent_id=self.account_id)
        video[AdVideo.Field.filepath] = file_path
        video[AdVideo.Field.name]     = name
        video.remote_create()
        video_id = video.get('id', '')
        return {
            'type': 'video',
            'name': name,
            'id':   video_id,
        }
