"""Animal photos on disk (settings.MEDIA_ROOT/animals). animals.photo_url keeps
the public URL; the file name is random so it can't be guessed or collide."""
import re
import secrets

from django.conf import settings

URL_PREFIX = '/api/media/animals/'
CONTENT_TYPES = {'jpg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp', 'gif': 'image/gif'}
_NAME = re.compile(r'^[A-Za-z0-9_-]{16,64}\.(jpg|png|webp|gif)$')


def _folder():
    folder = settings.MEDIA_ROOT / 'animals'
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def save(content, extension):
    """Stores the bytes and returns the URL to save in animals.photo_url."""
    name = f'{secrets.token_urlsafe(24)}.{extension}'
    (_folder() / name).write_bytes(content)
    return URL_PREFIX + name


def path(name):
    """File for a name from the URL, or None if it isn't one of ours or doesn't exist."""
    if not _NAME.match(name):
        return None
    file = _folder() / name
    return file if file.is_file() else None


def delete_url(photo_url):
    """Deletes the file behind a photo_url we stored (external URLs are left alone)."""
    if photo_url and photo_url.startswith(URL_PREFIX):
        file = path(photo_url[len(URL_PREFIX):])
        if file:
            file.unlink(missing_ok=True)
