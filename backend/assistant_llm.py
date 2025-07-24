import pandas as pd
import sqlite3
from langchain_community.chat_models.gigachat import GigaChat
from langchain.schema import SystemMessage, HumanMessage
from langchain.prompts import PromptTemplate
from langchain_core.messages import HumanMessage
from datetime import datetime
import pytz
from langchain.vectorstores import FAISS
from langchain_community.embeddings import GigaChatEmbeddings
from dotenv import load_dotenv
import os
import yaml

import check_good_tags
from assistant_prompt_collection import AssistantPrompts

load_dotenv()

giga_key = os.getenv("GIGA_API_KEY")
giga_llm = GigaChat(credentials=giga_key, verify_ssl_certs=False, scope="GIGACHAT_API_CORP", temperature=0, model="GigaChat-2-Max", profanity_check=False)
giga_llm_streaming = GigaChat(credentials=giga_key, verify_ssl_certs=False, scope="GIGACHAT_API_CORP", temperature=0, model="GigaChat-2-Max", profanity_check=False, streaming=True)



giga_embeddings = GigaChatEmbeddings(
    credentials=giga_key,
    verify_ssl_certs=False,
    scope='GIGACHAT_API_CORP'
)


def load_yaml_data(filepath: str):
    with open(filepath, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data

system_prompts = load_yaml_data("prompt_collection.yaml")

# Подключение к базе данных
conn = sqlite3.connect("./database_datetime_corrected_test.sqlite")
cursor = conn.cursor()

# Запрос для получения SQL-запросов создания таблиц
cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

database_description = ""
for table in tables:
    database_description += f"Таблица: {table[0]} \n {table[1][7:]} \n"

conn.close()

database_description_text = f"Структура базы данных для которой необходимо написать вопросы: {database_description}"
print(database_description_text)

assistant_prompts = AssistantPrompts(database_description)
planner_system_prompt = assistant_prompts.PLANNER_SYSTEM_PROMPT
translator_system_prompt = assistant_prompts.TRANSLATOR_SYSTEM_PROMPT
interpreter_system_prompt = assistant_prompts.INTERPRETER_SYSTEM_PROMPT
sql_critique_system_prompt = assistant_prompts.SQL_CRITIQUE_PROMPT

def get_current_datetime_prompt():
    # Получаем текущую дату и время

    tz_moscow = pytz.timezone('Europe/Moscow')
    moscow_current_datetime = tz_moscow.localize(datetime.now())
    #current_datetime = datetime.now()

    # Сохраняем её в удобочитаемом виде
    current_datetime_formatted = moscow_current_datetime.strftime("%Y-%m-%d %H:%M:%S")
    date_prompt = f"""Учти, что текущее время: {current_datetime_formatted}
    """
    return date_prompt

def db_searcher(current_query):
    """Поиск в базе данных"""
    conn = sqlite3.connect('./database_datetime_corrected_test.sqlite')
    results = pd.read_sql_query(current_query, conn)
    if results.empty:
        raise ValueError("empty dataframe")
    results = results.head(30)
    return results

def planner_function(question):
    """
   Планирование запросов
    """
    
    planner_prompt = f"""Текущая задача пользователя: {question} Твой ответ:"""
    datetime_prompt = get_current_datetime_prompt()
    vector_store = FAISS.load_local("question_instructions_test", giga_embeddings, allow_dangerous_deserialization=True)
    similarity_qa = vector_store.similarity_search(question, k=1)[0]
    print(similarity_qa)
    similarity_result = {"question": similarity_qa, "answer": similarity_qa.metadata["instruction"]}
    result_planner_system_prompt = planner_system_prompt + datetime_prompt + f"""Пример похожей или такой же задачи, подсказка:
Вопрос пользователя: {similarity_result["question"]}
Нужный ответ: {similarity_result["answer"]}

Если задача такая же, то ответь так же"""

    messages = [
            SystemMessage(content=result_planner_system_prompt),
            HumanMessage(content=planner_prompt)
        ]
    
    check_current_question = giga_llm.invoke(messages)
    result = str(check_current_question.content)
    
    return result


def sql_translator_function(question, history_prompt):
    """
    Преобразование запроса на естественном языке в sql запрос и поиск в базе данных
    """
    
    datetime_prompt = get_current_datetime_prompt()
    result_translator_system_prompt = translator_system_prompt + history_prompt + datetime_prompt
    current_question_query = giga_llm.invoke([{"role": "system", "content": result_translator_system_prompt},
                                                {"role": "user", "content": question}])
    
    result_llm = current_question_query.content
    result_query = result_llm.replace("```sql", "").replace("```", "").replace("\n", " ").strip()
    result_query = result_query.split(";")[0] + ";"
    print(result_query)


    return result_query

def sql_critique_function(current_question, query):
    """
    Выбор sql запроса
    """
    
    
    question = f"""Выбери для вопроса {current_question} наиболее подходящий запрос из следующих запросов: {query}. Итоговый запрос:"""


    datetime_prompt = get_current_datetime_prompt()
    result_sql_critique_system_prompt = sql_critique_system_prompt + datetime_prompt
    current_question_query = giga_llm.invoke([{"role": "system", "content": result_sql_critique_system_prompt},
                                                {"role": "user", "content": question}])
    
    result_llm = current_question_query.content

    result_query = result_llm.replace("```sql", "").replace("```", "").replace("\n", " ").strip()
    result_query = result_query.split(";")[0] + ";"
    print(result_query)


    return result_query

def interpret_answer_function(questions, questions_and_answers: str):
    """
    Интерпретация найденных данных для пользователя
    """
   
   
    current_dialog = f"Текущий вопрос: {questions}. Найденные данные для ответа на этот вопрос: {questions_and_answers}"

    datetime_prompt = get_current_datetime_prompt()
    result_interpreter_system_prompt = interpreter_system_prompt + datetime_prompt

    prompt = result_interpreter_system_prompt + current_dialog
    answer = ""
    for mini_answer in giga_llm_streaming.stream(prompt):
         word = mini_answer.content
         word = check_good_tags.sanitize_html(word)
         answer += word
         yield {'type': 'final', 'content': word}
