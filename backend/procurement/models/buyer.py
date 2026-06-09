from django.db import models


class Buyer(models.Model):
    shot_name = models.CharField("Фамилия и инициалы", max_length=64, unique=True, db_index=True)
    full_name = models.CharField("ФИО полностью", max_length=128, unique=True, db_index=True)
    is_active = models.BooleanField("Действующий (не действующий) сотрудник", default=True)

    class Meta:
        verbose_name = "Работник-закупщик"
        verbose_name_plural = "Работники-закупщики"
        ordering = ['shot_name']


    def __str__(self):
        return f"{self.shot_name}"