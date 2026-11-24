import logging

import requests
import urllib3
from django.core.cache import cache
from django.conf import settings

# Отключаем предупреждения SSL в консоли Docker
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger('goszakupki')


class GoszakupkiAPI:
    BASE_URL = "https://api.goszakupki.by"
    TIMEOUT = 15

    def __init__(self, username=settings.GPZ_USERNAME, password=settings.GPZ_PASSWORD):
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
        # НЕ логировать payload целиком — там пароль из GPZ_PASSWORD.
        payload = {"username": self.username, "password": self.password}
        logger.debug("POST %s (login, username=%s)", url, self.username)

        try:
            response = self.session.post(url, json=payload, timeout=self.TIMEOUT, verify=True)
        except requests.exceptions.SSLError:
            logger.warning("SSL verify=True не прошёл на %s — повтор с verify=False", url)
            response = self.session.post(url, json=payload, timeout=self.TIMEOUT, verify=False)
        except requests.exceptions.RequestException:
            logger.exception("Сетевой сбой при POST %s (login)", url)
            raise

        # ВЫВОД ДЕТАЛЕЙ ОШИБКИ 400:
        if response.status_code == 400:
            logger.error("Login 400 от goszakupki.by: %s", response.text[:2000])

        try:
            response.raise_for_status()
        except requests.exceptions.HTTPError:
            logger.exception(
                "Login упал: status=%s body=%s", response.status_code, response.text[:2000],
            )
            raise

        data = response.json()
        self._save_tokens(data['token'], data['refresh_token'])
        logger.info("Login на goszakupki.by успешен (username=%s)", self.username)
        return data['token']

    def _refresh_tokens(self, refresh_token):
        """Обновление пары токенов."""
        url = f"{self.BASE_URL}/auth/refresh-token"
        payload = {"refresh_token": refresh_token}

        try:
            response = self.session.post(url, json=payload, timeout=self.TIMEOUT, verify=False)
        except requests.exceptions.RequestException:
            logger.exception("Сетевой сбой при POST %s (refresh-token)", url)
            return self._login()

        if response.status_code == 200:
            data = response.json()
            self._save_tokens(data['token'], data['refresh_token'])
            logger.debug("Токен обновлён через refresh-token")
            return data['token']

        logger.warning(
            "refresh-token вернул status=%s body=%s — повторный login",
            response.status_code, response.text[:2000],
        )
        return self._login()

    def _save_tokens(self, token, refresh_token):
        """Сохранение токенов в кэш Django."""
        cache.set('gz_token', token, timeout=3600)  # 1 час
        cache.set('gz_refresh_token', refresh_token, timeout=86400 * 7)  # 7 дней

    def get_data(self, endpoint, params=None):
        """Универсальный метод для выполнения защищенных GET-запросов."""
        url = f"{self.BASE_URL}{endpoint}"
        headers = self._get_auth_headers()
        logger.debug("GET %s params=%s", url, params)

        try:
            response = self.session.get(url, headers=headers, params=params, timeout=self.TIMEOUT, verify=False)
        except requests.exceptions.RequestException as e:
            # Было `except requests.exceptions:` — это модуль, а не класс исключения,
            # такой except никогда не перехватывал ошибку сети и просто падал с TypeError.
            # Одна повторная попытка на случай единичного сетевого сбоя.
            logger.warning("Сетевой сбой при GET %s (%s) — повтор", url, e)
            try:
                response = self.session.get(url, headers=headers, params=params, timeout=self.TIMEOUT, verify=False)
            except requests.exceptions.RequestException:
                logger.exception("Повторный GET %s тоже упал сетевым сбоем", url)
                raise

        # Если токен устарел (401), сбрасываем кэш и пробуем повторно
        if response.status_code == 401:
            logger.info("401 на GET %s — сбрасываем токен и повторяем запрос", url)
            cache.delete('gz_token')
            headers = self._get_auth_headers()
            response = self.session.get(url, headers=headers, params=params, timeout=self.TIMEOUT, verify=False)

        try:
            response.raise_for_status()
        except requests.exceptions.HTTPError:
            logger.exception(
                "GET %s params=%s упал: status=%s body=%s",
                url, params, response.status_code, response.text[:2000],
            )
            raise

        return response.json(), response.headers

    def _write(self, method, endpoint, json_body=None):
        """Общая реализация POST/PUT с той же авторизацией/повторной попыткой при 401,
        что и get_data (см. выше) — для отправки черновика изменений ГПЗ (Этап 5, ТЗ п.3)."""
        url = f"{self.BASE_URL}{endpoint}"
        headers = self._get_auth_headers()
        request_func = getattr(self.session, method)
        logger.debug("%s %s body=%s", method.upper(), url, json_body)

        try:
            response = request_func(url, json=json_body, headers=headers, timeout=self.TIMEOUT, verify=False)
        except requests.exceptions.RequestException as e:
            logger.warning("Сетевой сбой при %s %s (%s) — повтор", method.upper(), url, e)
            try:
                response = request_func(url, json=json_body, headers=headers, timeout=self.TIMEOUT, verify=False)
            except requests.exceptions.RequestException:
                logger.exception("Повторный %s %s тоже упал сетевым сбоем", method.upper(), url)
                raise

        if response.status_code == 401:
            logger.info("401 на %s %s — сбрасываем токен и повторяем запрос", method.upper(), url)
            cache.delete('gz_token')
            headers = self._get_auth_headers()
            response = request_func(url, json=json_body, headers=headers, timeout=self.TIMEOUT, verify=False)

        try:
            response.raise_for_status()
        except requests.exceptions.HTTPError:
            logger.exception(
                "%s %s упал: status=%s body=%s",
                method.upper(), url, response.status_code, response.text[:2000],
            )
            raise

        return response.json(), response.headers

    def post_data(self, endpoint, json_body=None):
        """POST-запрос (создание плана/позиции плана — doc/api.yaml)."""
        return self._write('post', endpoint, json_body)

    def put_data(self, endpoint, json_body=None):
        """PUT-запрос (редактирование/удаление позиций плана — doc/api.yaml)."""
        return self._write('put', endpoint, json_body)
