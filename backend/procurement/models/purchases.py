from django.db import models
from django.conf import settings


class Purchases(models.Model):
    purchase_id = models.PositiveIntegerField("ID плана", null=True, blank=True)
    purchase_num = models.CharField("Регистрационный номер плана ГПЗ на goszakupki.by", max_length=32, null=True,
                                    blank=True, db_index=True)
    company = models.CharField("Наименование организации", default=settings.COMPANY_NAME)
    ved = models.CharField("Ведомственная принадлежность", default=settings.VED_NAME)
    country = models.CharField("Страна организации", default=settings.COUNTRY)
    region = models.CharField("Область (регион) организации", null=True, blank=True)
    city = models.CharField("Город (населенный пункт) организации", null=True, blank=True)
    address = models.CharField("Адрес организации", null=True, blank=True)
    establishment = models.PositiveIntegerField("Идентификатор ведомства, к которому относится организация", null=True,
                                                blank=True)
    date_added = models.DateTimeField('Время добавления плана', null=True, blank=True)
    date_edit = models.DateTimeField('Время редактирования плана', null=True, blank=True)
    date_sign = models.DateTimeField('Дата утверждения плана', null=True, blank=True)
    signer_descrip = models.CharField("Лицо утвердившее план", default=settings.SIGNER_DESCRIP)
    sender_descrip = models.CharField("Лицо разместившее план", default=settings.SENDER_DESCRIP)
    year = models.PositiveIntegerField("Год плана", null=True, blank=True)
    is_draft = models.PositiveIntegerField("Признак черновика плана", default=1)
    at_updated = models.CharField('Метка времени последнего обновления плана закупок', null=True, blank=True)

    class Meta:
        verbose_name = "План закупок ГКСЭ"
        verbose_name_plural = "Планы закупок ГКСЭ"
        ordering = ['-year']

    def __str__(self):
        return f"{self.purchase_id}"
