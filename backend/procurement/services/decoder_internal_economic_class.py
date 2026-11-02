def decoder_iec(internal_economic_class=None, *args, **kwargs):
    section_id, subsection_id, kind_id, article_id = None, None, None, None

    if internal_economic_class and internal_economic_class.code:
        code_str = internal_economic_class.code
        current_len = len(code_str)

        section_code = None
        subsection_code = None
        kind_code = None
        article_code = None

        if current_len == 10:
            section_code = code_str[:1] + "000000"  # 1000000
            subsection_code = code_str[:2] + "00000"  # 1100000
            kind_code = code_str[:5] + "00"  # 1100300
            article_code = code_str[:7]  # 1100303

        elif current_len == 7:
            section_code = code_str[:1] + "000000"
            subsection_code = code_str[:2] + "00000"
            if not code_str.endswith("00005") and not code_str.endswith("00"):
                kind_code = code_str[:5] + "00"
                article_code = code_str

        search_codes = [c for c in [section_code, subsection_code, kind_code, article_code] if c]

        from procurement.models import InternalEconomicClassifier
        parent_mappings = dict(InternalEconomicClassifier.objects.filter(code__in=search_codes).values_list("code", "id"))

        section_id = parent_mappings.get(section_code)
        subsection_id = parent_mappings.get(subsection_code)
        kind_id = parent_mappings.get(kind_code)
        article_id = parent_mappings.get(article_code)

    return section_id, subsection_id, kind_id, article_id
