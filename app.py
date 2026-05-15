import os
import uuid
import random
import string

from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv

from api import UploaderAPI

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__, static_folder='static')

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff',
    '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.m4v', '.webm',
}


def get_api() -> UploaderAPI:
    token      = os.getenv('META_ACCESS_TOKEN', '')
    account_id = os.getenv('META_AD_ACCOUNT_ID', '')
    if not token or not account_id:
        raise RuntimeError('META_ACCESS_TOKEN and META_AD_ACCOUNT_ID must be set in .env')
    return UploaderAPI(
        access_token=token,
        ad_account_id=account_id,
        app_id=os.getenv('META_APP_ID'),
        app_secret=os.getenv('META_APP_SECRET'),
    )


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)


@app.route('/api/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    base_name = request.form.get('name', '').strip() or file.filename
    suffix = ''.join(random.choices(string.ascii_letters + string.digits, k=5))
    name = f"{base_name}_{suffix}"

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({'error': f'Unsupported file type: {ext}'}), 400

    # Save to a temp path so the SDK can read it from disk
    tmp_name  = f'{uuid.uuid4()}{ext}'
    tmp_path  = os.path.join(UPLOAD_DIR, tmp_name)
    file.save(tmp_path)

    try:
        result = get_api().upload(file_path=tmp_path, name=name)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5002))
    app.run(debug=False, host='0.0.0.0', port=port)
