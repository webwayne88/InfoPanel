from flask import Flask, Response, request, jsonify
from flask_cors import CORS
import json
import uuid

import assistant_llm

app = Flask(__name__)
CORS(app)

class CustomTable:
    def __init__(self, query_description, table):
        self.query_description = query_description
        self.table = table
        self.hidden_table = f"""<div class="expandable-widget">
    <style>
        .expandable-widget {{
            margin: 20px 0;
            font-family: Arial, sans-serif;
        }}
        
        .expand-btn {{
            position: relative;
            padding: 15px 40px 15px 20px;
            background: #22c55a;
            border: 1px solid #ccc;
            border-radius: 4px;
            cursor: pointer;
            text-align: left;
            width: auto;
            transition: background 0.3s;
        }}
        
        .expand-btn::after {{
            content: '▼';
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 12px;
            transition: transform 0.3s;
        }}
        
        .expand-btn.active::after {{
            transform: translateY(-50%) rotate(180deg);
        }}
        
        .content-wrapper {{
            width: auto;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
        }}
        
        .content-box {{
            width: auto;        
            padding: 3px;
        }}
        
        .info-table {{
            width: auto;
            border-collapse: collapse;
        }}
        
        .info-table td, .info-table th {{
            padding: 8px;
            border: 1px solid #ddd;
        }}
        
    </style>

    <button class="expand-btn" onclick="toggleExpandable(this)">
        {self.query_description}
    </button>

    <div class="content-wrapper">
        <div class="content-box">
            {self.table}
            </div>
    </div>
</div>"""

def generate_answers(question):
        message_id = str(uuid.uuid4())
        answers = {}
        try:
            print("Функция генерации сработала")
            # Планирование вопросов
            thinking_message = {'message_id': message_id,
                                'type': 'thinking',
                                'content': f"Начинаю анализировать, какие данные нужно найти для ответа на вопрос... <br>"}
            result = f"data: {json.dumps(thinking_message, ensure_ascii=True)}\n\n"
            yield result
            llm_questions_string = assistant_llm.planner_function(question)
            
            llm_questions = json.loads(llm_questions_string)
            llm_questions = llm_questions["questions"]
            print("planner questions",llm_questions)
            
            memory = """История обращений к базе данных (возможно, нужно сформировать вопрос на основе ответов на предыдущие вопросы):
            """
            # Генерация запросов и поиск в базе данных
            for current_question in llm_questions:
                error_prompt = ""
                print("2")
                for _ in range(3):
                    try:
                        print("3")
                        prompt = error_prompt if error_prompt != "" else current_question
                        queries = []
                        thinking_message = {'message_id': message_id,
                                            'type': 'thinking',
                                            'content': f"Нужно найти: <b>{current_question}</b> <br> Для этого сформирую и если нужно переформулирую запрос к базе данных: <br>"}
                        result = f"data: {json.dumps(thinking_message, ensure_ascii=True)}\n\n"
                        yield result
                        
                        print("new query generation")
                        db_query = assistant_llm.sql_translator_function(prompt, memory)
                        queries.append(db_query)
                        thinking_message = {'type': 'thinking', 'content': f"<i>{db_query}</i> <br>"}
                        result = f"data: {json.dumps(thinking_message, ensure_ascii=True)}\n\n"
                        print(result)
                        yield result
                        db_query = assistant_llm.sql_critique_function(current_question, queries)
                        llm_result = assistant_llm.db_searcher(db_query)
                        memory += f"""Вопрос: {current_question} Что было найдено: {llm_result[:3].to_string()}
"""
                        break

                    except:
                        error_prompt = f"""На вопрос {current_question} ты дал неверный ответ: {db_query}, так как запрос не выполнился.
                        Проанализируй структуру базы данных лучше: {assistant_llm.database_description} Попробуй ответить на похожий вопрос, но самое главное валидным запросом"""

                        thinking_message = {'type': 'thinking', 'content': "Ошибка, невалидный запрос <br>"}
                        result = f"data: {json.dumps(thinking_message, ensure_ascii=True)}\n\n"
                        yield result
                answers[current_question] = llm_result.to_dict()
                print("перед отправкой вопроса", current_question)
                print(llm_result)
                if llm_result is None:
                    custom_table = "Пустая таблица"
                else:
                    table_description = f"Итоговый запрос: <b>{db_query}</b>"
                    formatted_table = llm_result.to_html(index=False, classes=["info-table"])
                    custom_table = CustomTable(table_description, formatted_table)
                    result_table = custom_table.hidden_table

                thinking_message = {'type': 'thinking', 'content': result_table}
                result = f"data: {json.dumps(thinking_message, ensure_ascii=True)}\n\n"
                print(result)
                yield result

            answers_text = str(answers)
            print(answers_text)
            # Интерпретация найденных ответов на вопросы
            for word in assistant_llm.interpret_answer_function(question, answers_text):
                result = f"data: {json.dumps(word)}\n\n"
                print(result)
                yield result

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

@app.route('/api/chat', methods=['POST'])
def chat_stream():
    print("бэкенд начал работать")
    # Получаем данные ДО генерации потока
    data = request.get_json()
    if not data or 'prompt' not in data:
        return jsonify({"error": "Missing prompt"}), 400
        
    question = data['prompt']
    
    return Response(generate_answers(question), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(port=8090, debug=True)