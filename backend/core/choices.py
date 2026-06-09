from django.db import models


class PlanStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Черновик (Редактирование)'
    ON_REVIEW = 'ON_REVIEW', 'На проверке у финансиста'
    ACTIVE = 'ACTIVE', 'Утвержден (Доступен для договоров)'
    PUBLISHED = 'PUBLISHED', 'Опубликован на goszakupki.by'
    REJECTED = 'REJECTED', 'Отклонен финансистом'
    DELETED = 'DELETED', 'Исключен'


class ProcurementItemTypes(models.TextChoices):
    job = 'job', 'работа/услуга'
    product = 'product', 'товар'


class CurrencyTypes(models.TextChoices):
    """Валюты согласно Общереспубликанскому классификатору валют ОКРБ 017-99"""
    BYN = 'BYN', 'Белорусский рубль (BYN)'
    RUB = 'RUB', 'Российский рубль (RUB)'
    USD = 'USD', 'Доллар США (USD)'
    EUR = 'EUR', 'Евро (EUR)'
    CNY = 'CNY', 'Китайский юань (CNY)'


# class UnitOfMeasurementType(models.TextChoices):
#     MTR = '0006', 'м'
#     LM = '0018', 'пог.м'
#     MTK = '0055', 'м2'
#     LTR = '0112', 'л'
#     MTQ = '0113', 'м3'
#     A44 = '0116', 'дал'
#     GRM = '0163', 'г'
#     KGM = '0166', 'кг'
#     MLT = '0231', 'мл'
#     GGAL = '0233', 'Гкал'
#     KWH = '0245', 'кВт·ч'
#     LEF = '0625', 'лист.'
#     C62 = '0642', 'ед.'
#     SET = '0704', 'набор'
#     PR = '0715', 'пар'
#     RM = '0728', 'пач.'
#     NRL = '0736', 'рул.'
#     NMP = '0778', 'упак.'
#     H87 = '0796', 'шт.'
#     KT = '0839', 'компл.'
#     Bo = '0868', 'бут'
#     _AMP = '0870', 'ампул.'
#     _UE = '0876', 'усл. ед.'

# class ExternalEconomicCodeType(models.TextChoices):
#     """
#     Статьи бюджетной классификации для поля economic_code.
#     Используется для интеграции со сторонними ИС и внешними планами.
#     """
# SALARY = "1 10 01 0", "1.10.01.00 Заработная плата"
# SALARY_CHARGES = "1 10 02 99", "1.10.02.99 Начисления на зар. плату"
# SUPPLIES = "1 10 03 99", "1.10.03.99 Приобретение предметов снабжения и расходных материалов"
# BUSINESS_TRIPS = "1 10 04 99", "1.10.04.99 Командировки"
# TRANSPORT_SERVICES = "1 10 05 0", "1.10.05.00 Оплата транспортных услуг"
# COMMUNICATION_SERVICES = "1 10 06 0", "1.10.06.00 Оплата услуг связи"
# UTILITY_SERVICES = "1 10 07 99", "1.10.07.99 Оплата коммунальных услуг"
# OTHER_CURRENT_COSTS = "1 10 10 99", "1.10.10.99 Прочие текущие расходы"
# CURRENT_TRANSFERS = "1 30 03 99", "1.30.03.99 Текущие трансферты"
# EQUIPMENT_ACQUISITION = "2 40 01 0", "2.40.01.00 Приобретение оборудования и других основных средств"
# CAPITAL_REPAIR = "2 40 03 0", "2.40.03.00 Капитальный ремонт"


# class ProgramCodeType(models.TextChoices):
#     CODE_99_0 = "99 0", "99 0"
#     CODE_19_01 = "19 01", "19 01"


# class UserRoleType(models.TextChoices):
#     ADMIN_MAIN = 'ADMIN_MAIN', 'Главный администратор'
#     ADMIN_LOCAL = 'ADMIN_LOCAL', 'Локальный администратор'
#     HEAD = 'HEAD', 'Главный руководитель'
#     MANAGER = 'MANAGER', 'Руководитель подразделения'
#     ACCOUNTANT = 'ACCOUNTANT', 'Бухгалтер'
#     STOREKEEPER = 'STOREKEEPER', 'Заведующий складом'
#     EXPERT = 'EXPERT', 'Эксперт'
#
#
# class RegionType(models.IntegerChoices):
#     BREST = 1, 'Управление ГКСЭ по Брестской области'
#     VITEBSK = 2, 'Управление ГКСЭ по Витебской области'
#     GOMEL = 3, 'Управление ГКСЭ по Гомельской области'
#     GRODNO = 4, 'Управление ГКСЭ по Гродненской области'
#     MINSK_REGION = 5, 'Управление ГКСЭ по Минской области'
#     MOGILEV = 6, 'Управление ГКСЭ по Могилевской области'
#     MINSK_CITY = 7, 'Управление ГКСЭ по г. Минску'
#     CENTRAL = 8, 'Центральный аппарат'
#
#
# class TransactionTypes(models.TextChoices):
#     ISSUE = 'ISSUE', 'Выдача'
#     WRITE_OFF = 'WRITE_OFF', 'Списание'
#     TRANSFER = 'TRANSFER', 'Передача'
#
#
# class ReportStatusTypes(models.TextChoices):
#     DRAFT = 'DRAFT', 'Черновик'
#     APPROVED = 'APPROVED', 'Одобрено'
#     REJECTED = 'REJECTED', 'Отклонено'
#
#
# class ExpertMethodTypes(models.TextChoices):
#     BIOGENETIC = 'BIOGENETIC', 'Биолого-генетические'
#     CHEMICALS = 'CHEMICALS', 'Химические'
#     HISTOLOGICAL = 'HISTOLOGICAL', 'Гистологические'
#     FORENSIC = 'FORENSIC', 'Медико-криминалистические'

# class FunctionalCodeType(models.TextChoices):
#     CODE_39 = "3 12 0 39", "03_12_00 § 039"
#     CODE_42 = "3 12 0 42", "03_12_00 § 042"
#     CODE_751 = "3 12 0 751", "03_12_00 § 751"
#     CODE_851 = "3 12 0 851", "03_12_00 § 851 (Витебск 3)"
#     CODE_853 = "3 12 0 853", "03_12_00 § 853 (Пинск)"
#     CODE_854 = "3 12 0 854", "03_12_00 § 854 (Гомель 2)"
#     CODE_856 = "3 12 0 856", "03_12_00 § 856 (Кальварийская, 43)"
#     CODE_900 = "3 12 0 900", "03_12_00 § 900 (Гомель 2)"
#     CODE_06_01_857 = "6 1 0 857", "06_01_00 § 857 (Арендное жилье ЦА Указ 119)"
