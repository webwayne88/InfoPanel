import re

def sanitize_html(text):
    safe_tags = {'b', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'th', 'td', 'br'}
    
    # Регулярное выражение для нахождения тегов вместе с содержанием
    pattern = r'(<\s*/?\s*[a-zA-Z0-9]+\s*[^>]*>)'
    
    # Замена: если тег допустимый, он сохраняется, иначе удаляется
    def replace_tag(match):
        full_tag = match.group(0)
        tag_name_match = re.search(r'[a-zA-Z0-9]+', full_tag)
        if tag_name_match:
            tag_name = tag_name_match.group(0).lower()
            if tag_name in safe_tags:
                return full_tag  # Оставляем тег
            else:
                return ''       # Удаляем опасный тег
        else:
            return ''           # Если тег непонятен, тоже удаляем
    
    clean_text = re.sub(pattern, replace_tag, text)
    return clean_text
