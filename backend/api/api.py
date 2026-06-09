# goszakupki_api.py
import requests
import urllib3
from django.core.cache import cache

# Отключаем предупреждения SSL в консоли Docker
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class GosZakupkiAPI:
    BASE_URL = "https://api.goszakupki.by"
    TIMEOUT = 15

    def __init__(self, username, password):
        self.username = username
        self.password = password
        # Создаем сессию для стабильного TLS-соединения (Keep-Alive)
        self.session = requests.Session()
        # Имитируем реальный браузер, чтобы сервер не сбрасывал соединение
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Content-Type": "application/json"
        })

    def _get_auth_headers(self):
        """Получает токен из кэша или инициирует обновление."""
        token = cache.get('gz_token')
        if not token:
            refresh_token = cache.get('gz_refresh_token')
            if refresh_token:
                token = self._refresh_tokens(refresh_token)
            else:
                token = self._login()

        return {"Authorization": f"Bearer {token}"}

    def _login(self):
        url = f"{self.BASE_URL}/auth/login"
        payload = {"username": self.username, "password": self.password}

        try:
            response = self.session.post(url, json=payload, timeout=self.TIMEOUT, verify=True)
        except requests.exceptions.SSLError:
            response = self.session.post(url, json=payload, timeout=self.TIMEOUT, verify=False)

        # ВЫВОД ДЕТАЛЕЙ ОШИБКИ 400:
        if response.status_code == 400:
            print("Детали ошибки 400 от сервера:", response.text)  # Или используйте logging.error()

        response.raise_for_status()
        data = response.json()
        self._save_tokens(data['token'], data['refresh_token'])
        return data['token']

    def _refresh_tokens(self, refresh_token):
        """Обновление пары токенов."""
        url = f"{self.BASE_URL}/auth/refresh-token"
        payload = {"refresh_token": refresh_token}

        response = self.session.post(url, json=payload, timeout=self.TIMEOUT, verify=False)
        if response.status_code == 200:
            data = response.json()
            self._save_tokens(data['token'], data['refresh_token'])
            return data['token']

        return self._login()

    def _save_tokens(self, token, refresh_token):
        """Сохранение токенов в кэш Django."""
        cache.set('gz_token', token, timeout=3600)  # 1 час
        cache.set('gz_refresh_token', refresh_token, timeout=86400 * 7)  # 7 дней

    def get_data(self, endpoint, params=None):
        """Универсальный метод для выполнения защищенных GET-запросов."""
        url = f"{self.BASE_URL}{endpoint}"
        headers = self._get_auth_headers()

        try:
            response = self.session.get(url, headers=headers, params=params, timeout=self.TIMEOUT, verify=False)
            print(response.headers)
        except requests.exceptions:
            response = self.session.get(url, headers=headers, params=params, timeout=self.TIMEOUT, verify=False)
            print("Детали ошибки от сервера:", response.text)

        # Если токен устарел (401), сбрасываем кэш и пробуем повторно
        if response.status_code == 401:
            cache.delete('gz_token')
            headers = self._get_auth_headers()
            response = self.session.get(url, headers=headers, params=params, timeout=self.TIMEOUT, verify=False)


        response.raise_for_status()
        return response.json()
